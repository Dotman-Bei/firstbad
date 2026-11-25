import os from 'node:os';
import spawn from 'cross-spawn';
import { scrub } from '../scrub.js';
import { execArgv, killTree } from '../util/proc.js';
import { parseKaneStream, type KaneStream } from './ndjson.js';

export interface RunKaneOptions {
  kaneCmd: string[];
  objective: string;
  timeoutSec: number;
  maxSteps: number;
  cwd: string;
  name?: string;
  label?: string;
  env?: NodeJS.ProcessEnv;
  killAfterMs?: number;
}

export interface KaneRunResult {
  exitCode: number | null;
  killed: boolean;
  terminalMode: boolean;
  spawnError: string | null;
  stream: KaneStream;
  stderrTail: string;
  durationMs: number;
}

export function kaneArgs(o: RunKaneOptions): string[] {
  const args = ['run', o.objective, '--agent', '--headless', '--timeout', String(o.timeoutSec), '--max-steps', String(o.maxSteps)];
  if (o.name !== undefined) args.push('--name', o.name);
  return args;
}

export function kaneEnv(base: NodeJS.ProcessEnv, label: string | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  if (env.KANE_CLI_USER_AGENT === undefined || env.KANE_CLI_USER_AGENT === '') env.KANE_CLI_USER_AGENT = 'firstbad';
  if (label !== undefined) env.FIRSTBAD_LABEL = label;
  return env;
}

export function stderrTail(stderr: string): string {
  const kept = stderr
    .split(/\r?\n/)
    .filter((l) => !/evidence/i.test(l))
    .join('\n');
  return scrub(kept).slice(-2000);
}

function isJsonObject(line: string): boolean {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null;
  } catch {
    return false;
  }
}

export function runKane(o: RunKaneOptions): Promise<KaneRunResult> {
  const [command, ...prefix] = o.kaneCmd;
  if (command === undefined) return Promise.reject(new Error('runKane: empty kaneCmd'));
  const started = Date.now();
  const killAfterMs = o.killAfterMs ?? (o.timeoutSec + 60) * 1000;
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let terminalMode = false;
    let firstLineChecked = false;
    let settled = false;
    const child = spawn(command, [...prefix, ...kaneArgs(o)], {
      cwd: o.cwd,
      env: kaneEnv(o.env ?? process.env, o.label),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    const timer = setTimeout(() => {
      killed = true;
      killTree(child.pid);
    }, killAfterMs);
    const finish = (exitCode: number | null, spawnError: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        killed,
        terminalMode,
        spawnError,
        stream: parseKaneStream(stdout),
        stderrTail: stderrTail(stderr),
        durationMs: Date.now() - started,
      });
    };
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      if (firstLineChecked) return;
      const complete = stdout.split(/\r?\n/).slice(0, -1);
      const first = complete.find((l) => l.trim() !== '');
      if (first === undefined) return;
      firstLineChecked = true;
      if (!isJsonObject(first.trim())) {
        terminalMode = true;
        killed = true;
        killTree(child.pid);
      }
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err: NodeJS.ErrnoException) => finish(null, err.code ?? err.message));
    child.on('close', (code: number | null) => finish(killed ? null : code, null));
  });
}

export function parseBalance(text: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(text);
  if (m === null || m[1] === undefined) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export async function kaneBalance(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<number | null> {
  const r = await execArgv([...kaneCmd, 'balance'], { cwd: os.tmpdir(), env: kaneEnv(env ?? process.env, undefined), timeoutMs: 60_000 });
  return r.code === 0 ? parseBalance(r.stdout) : null;
}

export async function kaneVersion(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<string | null> {
  const r = await execArgv([...kaneCmd, '--version'], { cwd: os.tmpdir(), env: kaneEnv(env ?? process.env, undefined), timeoutMs: 60_000 });
  if (r.code !== 0) return null;
  const m = /(\d+\.\d+\.\d+)/.exec(r.stdout);
  return m === null || m[1] === undefined ? null : m[1];
}

export function versionAtLeast(version: string, min: string): boolean {
  const a = version.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const b = min.split('.').map((p) => Number.parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}
