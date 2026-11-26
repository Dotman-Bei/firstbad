import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeDirWithRetry } from '../src/hunt.js';
import { runFlow, type FlowResult } from '../src/run.js';
import { reopenSpawns, spawnShell, stopTracked } from '../src/util/proc.js';
import { KANE_CMD, bisectRepo, clearStubEnv, git, setStubPlan, tempDir } from './helpers.js';

// No Kane credits: the stub kane-cli and plain node scripts stand in for every process.

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

// True when a fresh listener can bind the port (what a rerun needs).
function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function until(what: string, cond: () => boolean | Promise<boolean>, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const GRANDCHILD = [
  "import http from 'node:http';",
  "http.createServer((q, r) => r.end('up')).listen(Number(process.argv[2]), '127.0.0.1');",
  'setInterval(() => undefined, 1000);',
  '',
].join('\n');

// A long-running parent that starts a grandchild and then just waits, like cmd.exe -> node server.
const PARENT = [
  "import { spawn } from 'node:child_process';",
  "import fs from 'node:fs';",
  'const [script, port, pidFile, cwd] = process.argv.slice(2);',
  "const gc = spawn(process.execPath, [script, port], { cwd, stdio: 'ignore' });",
  'fs.writeFileSync(pidFile, String(gc.pid));',
  'setInterval(() => undefined, 1000);',
  '',
].join('\n');

afterEach(() => {
  clearStubEnv();
  reopenSpawns();
});

describe('process-tree cleanup', () => {
  it('kills a tracked parent and its grandchild, frees the port and removes the folder the grandchild runs in', async () => {
    const scripts = tempDir('firstbad-tree-scripts-');
    const session = tempDir('firstbad-tree-session-');
    fs.writeFileSync(path.join(scripts, 'grandchild.mjs'), GRANDCHILD);
    fs.writeFileSync(path.join(scripts, 'parent.mjs'), PARENT);
    const pidFile = path.join(scripts, 'gc.pid');
    const port = await freePort();
    const q = (s: string): string => `"${s}"`;
    const parent = spawnShell(
      [q(process.execPath), q(path.join(scripts, 'parent.mjs')), q(path.join(scripts, 'grandchild.mjs')), String(port), q(pidFile), q(session)].join(' '),
      { cwd: session },
    );
    await until('the grandchild to listen', async () => fs.existsSync(pidFile) && !(await portFree(port)));
    const gcPid = Number(fs.readFileSync(pidFile, 'utf8'));
    expect(alive(gcPid)).toBe(true);
    if (process.platform === 'win32') {
      // The bug: while the tree runs in the folder, Windows refuses to remove it.
      expect(await removeDirWithRetry(session, 0)).toBe(false);
    }

    const still = await stopTracked({ close: false });

    expect(still).toEqual([]);
    expect(parent.exitCode !== null || parent.signalCode !== null).toBe(true);
    await until('the grandchild to die', () => !alive(gcPid), 5000);
    expect(await portFree(port)).toBe(true);
    expect(await removeDirWithRetry(session)).toBe(true);
    expect(fs.existsSync(session)).toBe(false);
    fs.rmSync(scripts, { recursive: true, force: true });
  });
});

interface Interrupted {
  repo: string;
  port: number;
  kanePid: number;
  sessionDir: string;
  exits: number[];
  printed: string[];
  signals: EventEmitter;
  flow: Promise<FlowResult>;
}

// Starts a real hunt (stub Kane) and waits until it is stuck inside git bisect run: the oracle's app
// server answers on the port and a hanging stub Kane run is in flight, both grandchildren of firstbad.
async function huntStuckInBisect(): Promise<Interrupted> {
  const repo = bisectRepo();
  const port = await freePort();
  const stub = setStubPlan(tempDir('firstbad-int-'), {
    rules: [
      { labelIncludes: 'bad ref', steps: [{ scenario: 'fail' }] },
      { labelIncludes: 'good ref', steps: [{ scenario: 'pass' }] },
    ],
    default: { scenario: 'hang' },
  });
  const exits: number[] = [];
  const printed: string[] = [];
  const signals = new EventEmitter();
  const flow = runFlow({
    repoDir: repo,
    good: 'v1',
    bad: 'HEAD',
    check: { url: `http://127.0.0.1:${port}/`, do: 'read the page', store: 'the page text', expected: '$18.00' },
    serve: `node server.mjs ${port}`,
    setup: null,
    agentArgv: null,
    noFix: true,
    outDir: tempDir('firstbad-int-out-'),
    kaneCmd: KANE_CMD,
    env: { ...process.env },
    print: (l) => printed.push(l),
    color: false,
    template: 'commas-assert',
    verdictMode: 'status+value',
    signals,
    exit: (code) => exits.push(code),
  });
  type Logged = { label: string; pid: number; cwd: string };
  const bisectRun = (): Logged | undefined => {
    if (!fs.existsSync(stub.log)) return undefined;
    return fs
      .readFileSync(stub.log, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as Logged)
      .find((e) => e.label.startsWith('bisect|'));
  };
  await until('a hanging Kane run inside git bisect run', async () => bisectRun() !== undefined && !(await portFree(port)));
  const run = bisectRun();
  if (run === undefined) throw new Error('unreachable');
  const sessionDir = path.dirname(run.cwd);
  expect(fs.existsSync(path.join(sessionDir, 'session.json'))).toBe(true);
  expect(alive(run.pid)).toBe(true);
  return { repo, port, kanePid: run.pid, sessionDir, exits, printed, signals, flow };
}

async function expectAllGone(t: Interrupted): Promise<void> {
  await until('the stub Kane to die', () => !alive(t.kanePid), 5000);
  expect(await portFree(t.port)).toBe(true);
  expect(fs.existsSync(t.sessionDir)).toBe(false);
  expect(git(t.repo, 'worktree', 'list').split('\n')).toHaveLength(1);
}

describe('interrupting a hunt', () => {
  it('on SIGINT stops the whole tree under git bisect run, frees the port, removes worktree and session, exits 130', async () => {
    const t = await huntStuckInBisect();

    t.signals.emit('SIGINT', 'SIGINT');

    await until('exit to be called', () => t.exits.length > 0, 30_000);
    expect(t.exits).toEqual([130]);
    expect((await t.flow).exitCode).toBe(130);
    await expectAllGone(t);
    expect(t.printed.some((l) => l.startsWith('firstbad: interrupted (SIGINT)'))).toBe(true);
    expect(t.printed.filter((l) => l.includes('could not') || l.includes('still answers'))).toEqual([]);
  });

  it('handles SIGBREAK (Ctrl+Break on Windows) the same way', async () => {
    const t = await huntStuckInBisect();

    t.signals.emit('SIGBREAK', 'SIGBREAK');

    await until('exit to be called', () => t.exits.length > 0, 30_000);
    expect(t.exits).toEqual([130]);
    expect((await t.flow).exitCode).toBe(130);
    await expectAllGone(t);
  });

  it('a second interrupt during cleanup exits 130 at once instead of hanging', async () => {
    const t = await huntStuckInBisect();

    const started = Date.now();
    t.signals.emit('SIGINT', 'SIGINT');
    t.signals.emit('SIGINT', 'SIGINT');

    expect(t.exits[0]).toBe(130);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(t.printed.some((l) => l.startsWith('firstbad: interrupted again'))).toBe(true);
    // In this test the process does not really exit, so the first cleanup still finishes.
    expect((await t.flow).exitCode).toBe(130);
    await expectAllGone(t);
  });
});
