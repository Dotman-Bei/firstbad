import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { kaneArgs, kaneBalance, kaneVersion, parseBalance, runKane, versionAtLeast, type RunKaneOptions } from '../src/kane/runner.js';
import { execArgv, splitCommand } from '../src/util/proc.js';

const STUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stub-kane.mjs');
const KANE = [process.execPath, STUB];
const OBJECTIVE = `Go to http://127.0.0.1:1/, look, store the total as 'observed', then assert the stored observed value is "$18.00"`;
let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-runner-'));
});

function stubEnv(plan: unknown, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const planPath = path.join(dir, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(plan));
  const env: NodeJS.ProcessEnv = { ...process.env, STUB_KANE_PLAN: planPath, STUB_KANE_LOG: path.join(dir, 'log.jsonl'), ...extra };
  delete env.KANE_CLI_USER_AGENT;
  return env;
}

function run(scenario: string, value?: string, extra: Partial<RunKaneOptions> = {}) {
  return runKane({
    kaneCmd: KANE,
    objective: OBJECTIVE,
    timeoutSec: 30,
    maxSteps: 25,
    cwd: dir,
    label: 'bracket|bad ref|c9',
    env: stubEnv({ default: { scenario, value } }),
    ...extra,
  });
}

describe('runKane against the stub', () => {
  it('parses a passing run and keeps secrets and evidence paths out', async () => {
    const r = await run('pass');
    expect(r.exitCode).toBe(0);
    expect(r.stream.runEnd?.status).toBe('passed');
    expect(r.stream.runEnd?.observed).toBe('$18.00');
    expect(r.stderrTail).not.toContain('evidence');
    const json = JSON.stringify(r);
    expect(json).not.toContain('session_dir');
    expect(json).not.toContain('stubsecret');
  });

  it('passes the agent flags, the label and the user agent', async () => {
    await run('pass', undefined, { name: 'firstbad-probe' });
    const logged = JSON.parse(fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf8').trim().split('\n')[0] ?? '{}') as {
      argv: string[];
      label: string;
      userAgent: string | null;
    };
    expect(logged.argv).toEqual(['run', OBJECTIVE, '--agent', '--headless', '--timeout', '30', '--max-steps', '25', '--name', 'firstbad-probe']);
    expect(logged.label).toBe('bracket|bad ref|c9');
    expect(logged.userAgent).toBe('firstbad');
    expect(kaneArgs({ kaneCmd: KANE, objective: 'o', timeoutSec: 5, maxSteps: 3, cwd: dir })).toEqual([
      'run', 'o', '--agent', '--headless', '--timeout', '5', '--max-steps', '3',
    ]);
  });

  it('treats an upload failure as exit 1 with a passed run_end', async () => {
    const r = await run('upload-failed');
    expect(r.exitCode).toBe(1);
    expect(r.stream.runEnd?.status).toBe('passed');
  });

  it('reports a failing value and scrubs leaked tokens', async () => {
    const fail = await run('fail', '$20.00');
    expect(fail.exitCode).toBe(1);
    expect(fail.stream.runEnd?.observed).toBe('$20.00');
    expect(fail.stream.runEnd?.summary).toContain('Expected "$18.00"');
    const leak = await run('token-leak', '$20.00');
    expect(leak.stream.runEnd?.reason).toContain('[redacted]');
    expect(JSON.stringify(leak)).not.toContain('eyJ');
  });

  it('handles crash, error, hang, prose and a missing binary', async () => {
    const crash = await run('crash');
    expect(crash.stream.runEnd).toBeNull();
    expect(crash.exitCode).toBe(1);
    expect(crash.stderrTail).toContain('fetch failed');
    const error = await run('error');
    expect(error.exitCode).toBe(2);
    expect(error.stream.errors[0]).toContain('CDP');
    const hang = await run('hang', undefined, { killAfterMs: 1500 });
    expect(hang.killed).toBe(true);
    expect(hang.exitCode).toBeNull();
    const prose = await run('prose');
    expect(prose.terminalMode).toBe(true);
    expect(prose.killed).toBe(true);
    const missing = await run('pass', undefined, { kaneCmd: ['firstbad-no-such-kane-cli-xyz'] });
    expect(missing.spawnError).toBe('ENOENT');
  });

  it('reads a served page in fetch mode', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('$18.00\n');
    });
    await new Promise<void>((resolve) => server.listen(4305, '127.0.0.1', () => resolve()));
    try {
      const r = await runKane({
        kaneCmd: KANE,
        objective: OBJECTIVE.replace('http://127.0.0.1:1/', 'http://127.0.0.1:4305/'),
        timeoutSec: 30,
        maxSteps: 25,
        cwd: dir,
        env: stubEnv({ default: { scenario: 'fetch' } }),
      });
      expect(r.exitCode).toBe(0);
      expect(r.stream.runEnd?.observed).toBe('$18.00');
    } finally {
      server.close();
    }
  });
});

describe('balance, version and process helpers', () => {
  it('parses balance and version', async () => {
    expect(await kaneBalance(KANE, stubEnv({}, { STUB_KANE_BALANCE: '1,234.5' }))).toBe(1234.5);
    expect(await kaneVersion(KANE, stubEnv({}))).toBe('0.10.9');
    expect(parseBalance('Available credits: 11178.5769')).toBe(11178.5769);
    expect(parseBalance('no digits here')).toBeNull();
    expect(versionAtLeast('0.10.9', '0.10.9')).toBe(true);
    expect(versionAtLeast('0.11.0', '0.10.9')).toBe(true);
    expect(versionAtLeast('0.10.8', '0.10.9')).toBe(false);
    expect(versionAtLeast('1.0.0', '0.10.9')).toBe(true);
  });

  it('splits commands and pipes stdin', async () => {
    expect(splitCommand('claude -p --allowedTools Read,Edit')).toEqual(['claude', '-p', '--allowedTools', 'Read,Edit']);
    expect(splitCommand('"C:\\Program Files\\node.exe" "C:\\a b\\stub.mjs"')).toEqual(['C:\\Program Files\\node.exe', 'C:\\a b\\stub.mjs']);
    expect(splitCommand("node 'x y.js'")).toEqual(['node', 'x y.js']);
    expect(() => splitCommand('node "unterminated')).toThrow(/unterminated/);
    const echo = await execArgv([process.execPath, '-e', 'process.stdin.pipe(process.stdout)'], { cwd: dir, timeoutMs: 20_000, input: 'hi' });
    expect(echo.code).toBe(0);
    expect(echo.stdout).toBe('hi');
  });
});
