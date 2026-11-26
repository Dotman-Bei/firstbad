import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn as nodeSpawn, spawnSync, type ChildProcess } from 'node:child_process';
import spawn from 'cross-spawn';

// Every child firstbad starts is tracked here, so an interrupt can stop the whole tree before the
// worktree and session folder are removed (a child still running in the worktree holds it busy on
// Windows, and a server child holds the check's port).
const live = new Set<ChildProcess>();
let closed = false;
const cleanupScope = new AsyncLocalStorage<boolean>();

export class ShutdownError extends Error {
  constructor() {
    super('firstbad is shutting down; not starting another process');
    this.name = 'ShutdownError';
  }
}

// Throws once stopTracked() has closed spawning, except inside allowDuringCleanup().
export function assertSpawnAllowed(): void {
  if (closed && cleanupScope.getStore() !== true) throw new ShutdownError();
}

export function allowDuringCleanup<T>(fn: () => Promise<T>): Promise<T> {
  return cleanupScope.run(true, fn);
}

export function reopenSpawns(): void {
  closed = false;
}

export function track<T extends ChildProcess>(child: T): T {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return child;
  live.add(child);
  const drop = (): void => {
    live.delete(child);
  };
  child.once('exit', drop);
  child.once('error', drop);
  return child;
}

function running(c: ChildProcess): boolean {
  return c.exitCode === null && c.signalCode === null;
}

function waitExit(children: ChildProcess[], timeoutMs: number): Promise<void> {
  const pending = children.filter(running);
  if (pending.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    let left = pending.length;
    for (const c of pending) {
      c.once('exit', () => {
        left -= 1;
        if (left === 0) {
          clearTimeout(timer);
          resolve();
        }
      });
    }
  });
}

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

// Stops every tracked child and everything it started; returns the pids still running afterwards.
// close=true also refuses new spawns (outside allowDuringCleanup) so an unwinding flow cannot start
// the next server after the interrupt.
// win32: taskkill /T /F per child (walks the parent-pid tree, so it reaches grandchildren under
// git bisect run). POSIX (untested): SIGTERM to each process group so the oracle can stop its own
// detached children, then SIGKILL to the group.
export async function stopTracked(opts: { close: boolean; graceMs?: number }): Promise<number[]> {
  if (opts.close) closed = true;
  const grace = opts.graceMs ?? 2000;
  const kids = [...live];
  if (kids.length === 0) return [];
  if (process.platform === 'win32') {
    for (const c of kids) if (running(c)) killTree(c.pid);
  } else {
    for (const c of kids) signalGroup(c.pid, 'SIGTERM');
    await waitExit(kids, grace);
    for (const c of kids) signalGroup(c.pid, 'SIGKILL');
  }
  await waitExit(kids, grace);
  return kids.filter(running).map((c) => c.pid ?? -1);
}

// Synchronous variant for a second interrupt or an exiting oracle: no waiting, no grace period.
export function killTrackedNow(): void {
  closed = true;
  for (const c of [...live]) if (running(c)) killTree(c.pid);
}

export interface ExecOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  input?: string;
}

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError: string | null;
  durationMs: number;
}

// Shell-style split: whitespace separates, "double" and 'single' quotes group; backslashes are literal
// (so Windows paths survive).
export function splitCommand(command: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (const ch of command) {
    if (quote !== null) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has) {
        out.push(cur);
        cur = '';
        has = false;
      }
      continue;
    }
    cur += ch;
    has = true;
  }
  if (quote !== null) throw new Error(`unterminated quote in command: ${command}`);
  if (has) out.push(cur);
  return out;
}

// Kills a process and everything it started. POSIX children are spawned detached (own process group).
export function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // the process is already gone
    }
  }
}

function collect(child: ChildProcess, opts: ExecOptions, started: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, opts.timeoutMs);
    const finish = (code: number | null, spawnError: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: timedOut ? null : code, stdout, stderr, timedOut, spawnError, durationMs: Date.now() - started });
    };
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err: NodeJS.ErrnoException) => finish(null, err.code ?? err.message));
    child.on('close', (code: number | null) => finish(code, null));
    if (child.stdin) {
      child.stdin.on('error', () => undefined);
      child.stdin.end(opts.input ?? '');
    }
  });
}

export function execArgv(argv: string[], opts: ExecOptions): Promise<ExecResult> {
  const [command, ...args] = argv;
  if (command === undefined) return Promise.reject(new Error('execArgv: empty argv'));
  try {
    assertSpawnAllowed();
  } catch (err) {
    return Promise.reject(err);
  }
  const started = Date.now();
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  return collect(track(child), opts, started);
}

export function execShell(command: string, opts: ExecOptions): Promise<ExecResult> {
  try {
    assertSpawnAllowed();
  } catch (err) {
    return Promise.reject(err);
  }
  const started = Date.now();
  const child = nodeSpawn(command, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    shell: true,
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  return collect(track(child), opts, started);
}

export function spawnShell(command: string, opts: { cwd: string; env?: NodeJS.ProcessEnv }): ChildProcess {
  assertSpawnAllowed();
  return track(
    nodeSpawn(command, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    }),
  );
}
