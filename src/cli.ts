#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseAgent } from './agent.js';
import { validateCheck, type Check } from './check.js';
import { cleanLeftovers } from './clean.js';
import { runOracle } from './oracle.js';
import { DEMO_PORT, DemoDirError } from './demo/demo-config.js';
import { runDemo } from './demo/run-demo.js';
import { runFlow } from './run.js';
import { splitCommand } from './util/proc.js';
import { VERSION } from './version.js';

export interface CliIO {
  print(line: string): void;
  env: NodeJS.ProcessEnv;
  cwd: string;
  color: boolean;
}

export type Command = (args: string[], io: CliIO) => Promise<number>;

export const HELP = [
  'firstbad - git bisect with a real-browser oracle (Kane CLI)',
  '',
  'Usage:',
  '  firstbad hunt --good <ref> --url <url> --do "<steps>" --store "<what>" --expect "<value>" --serve "<cmd>"',
  '                [--bad <ref>] [--setup "<cmd>"] [--agent "<cmd>" | --agent none] [--no-fix] [--out <dir>] [--repo <path>]',
  "                [--objective \"<raw Kane objective that stores the value as 'observed'>\"]",
  '  firstbad oracle --session <file>    a git-bisect-run script (exit 0 good, 1 bad, 125 skip, 128 abort)',
  '  firstbad clean [--repo <path>]      remove leftover firstbad worktrees and session folders',
  '  firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" | --agent none] [--no-fix] [--force]',
  '                                      generate the 40-commit Corner Shop and hunt + fix its planted bug',
  '  firstbad --version | --help',
  '',
  'Environment: FIRSTBAD_KANE, FIRSTBAD_MIN_BALANCE (500), FIRSTBAD_MAX_RUNS (16), FIRSTBAD_MAX_FIX_ATTEMPTS (3),',
  '  FIRSTBAD_KANE_TIMEOUT_SEC (300), FIRSTBAD_AGENT_TIMEOUT_SEC (900), FIRSTBAD_READY_TIMEOUT_SEC (30),',
  '  FIRSTBAD_SETUP_TIMEOUT_SEC (600), FIRSTBAD_KEEP_SESSION, NO_COLOR',
].join('\n');

export function kaneCommand(env: NodeJS.ProcessEnv): string[] {
  const raw = env.FIRSTBAD_KANE;
  return splitCommand(raw === undefined || raw.trim() === '' ? 'kane-cli' : raw);
}

const HUNT_OPTIONS = {
  good: { type: 'string' },
  bad: { type: 'string' },
  url: { type: 'string' },
  do: { type: 'string' },
  store: { type: 'string' },
  expect: { type: 'string' },
  serve: { type: 'string' },
  setup: { type: 'string' },
  agent: { type: 'string' },
  'no-fix': { type: 'boolean' },
  out: { type: 'string' },
  repo: { type: 'string' },
  objective: { type: 'string' },
} as const;

function parseHunt(args: string[]) {
  return parseArgs({ args, options: HUNT_OPTIONS, allowPositionals: false, strict: true }).values;
}

async function huntCommand(args: string[], io: CliIO): Promise<number> {
  let values: ReturnType<typeof parseHunt>;
  try {
    values = parseHunt(args);
  } catch (err) {
    io.print(`firstbad hunt: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const { good, url, serve } = values;
  const raw = values.objective;
  const store = values.store ?? (raw !== undefined ? 'the observed value' : undefined);
  const steps = values.do ?? (raw !== undefined ? '(raw objective)' : undefined);
  const expected = values.expect;
  if (good === undefined || url === undefined || steps === undefined || store === undefined || expected === undefined || serve === undefined) {
    const given: Record<string, string | undefined> = { good, url, do: steps, store, expect: expected, serve };
    const missing = Object.keys(given).filter((k) => given[k] === undefined);
    io.print(`firstbad hunt: missing ${missing.map((k) => `--${k}`).join(', ')}`);
    return 2;
  }
  const check: Check = { url, do: steps, store, expected };
  const problems = validateCheck(check);
  if (problems.length > 0) {
    io.print(`firstbad hunt: ${problems.join('; ')}`);
    return 2;
  }
  const r = await runFlow({
    repoDir: path.resolve(io.cwd, values.repo ?? '.'),
    good,
    bad: values.bad ?? 'HEAD',
    check,
    serve,
    setup: values.setup ?? null,
    agentArgv: parseAgent(values.agent),
    noFix: values['no-fix'] === true,
    outDir: values.out === undefined ? null : path.resolve(io.cwd, values.out),
    kaneCmd: kaneCommand(io.env),
    env: io.env,
    print: (l) => io.print(l),
    color: io.color,
    objective: raw ?? null,
  });
  return r.exitCode;
}

async function oracleCommand(args: string[], io: CliIO): Promise<number> {
  const at = args.indexOf('--session');
  const sessionPath = at >= 0 ? args[at + 1] : undefined;
  if (sessionPath === undefined) {
    io.print('firstbad oracle: --session <file> is required');
    return 128;
  }
  return runOracle(path.resolve(io.cwd, sessionPath), io.cwd, (l) => io.print(l));
}

async function cleanCommand(args: string[], io: CliIO): Promise<number> {
  const at = args.indexOf('--repo');
  const repo = path.resolve(io.cwd, at >= 0 ? (args[at + 1] ?? '.') : '.');
  try {
    const r = await cleanLeftovers(repo);
    io.print(`firstbad: removed ${r.removedWorktrees.length} worktrees and ${r.removedSessions.length} session folders`);
    return 0;
  } catch (err) {
    io.print(`firstbad clean: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

const DEMO_OPTIONS = {
  dir: { type: 'string' },
  port: { type: 'string' },
  agent: { type: 'string' },
  'no-fix': { type: 'boolean' },
  force: { type: 'boolean' },
} as const;

function parseDemo(args: string[]) {
  return parseArgs({ args, options: DEMO_OPTIONS, allowPositionals: false, strict: true }).values;
}

async function demoCommand(args: string[], io: CliIO): Promise<number> {
  let values: ReturnType<typeof parseDemo>;
  try {
    values = parseDemo(args);
  } catch (err) {
    io.print(`firstbad demo: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const port = values.port === undefined ? DEMO_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    io.print('firstbad demo: --port must be an integer between 1 and 65535');
    return 2;
  }
  try {
    const r = await runDemo({
      dir: path.resolve(io.cwd, values.dir ?? 'firstbad-demo'),
      port,
      agentArgv: parseAgent(values.agent),
      noFix: values['no-fix'] === true,
      force: values.force === true,
      kaneCmd: kaneCommand(io.env),
      env: io.env,
      print: (l) => io.print(l),
      color: io.color,
    });
    return r.exitCode;
  } catch (err) {
    if (err instanceof DemoDirError) {
      io.print(`firstbad demo: ${err.message}`);
      return 2;
    }
    throw err;
  }
}

export const COMMANDS: Record<string, Command> = {
  hunt: huntCommand,
  oracle: oracleCommand,
  demo: demoCommand,
  clean: cleanCommand,
};

export async function main(argv: string[], io: CliIO): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined) {
    io.print(HELP);
    return 2;
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    io.print(HELP);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    io.print(VERSION);
    return 0;
  }
  const handler = COMMANDS[command];
  if (handler === undefined) {
    io.print(`firstbad: unknown command "${command}"\n\n${HELP}`);
    return 2;
  }
  return handler(rest, io);
}

function isEntry(): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return pathToFileURL(fs.realpathSync(script)).href === pathToFileURL(fs.realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
}

if (isEntry()) {
  main(process.argv.slice(2), {
    print: (l) => process.stdout.write(`${l}\n`),
    env: process.env,
    cwd: process.cwd(),
    color: process.stdout.isTTY === true && (process.env.NO_COLOR ?? '') === '',
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.stderr.write(`firstbad: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
      process.exitCode = 1;
    },
  );
}
