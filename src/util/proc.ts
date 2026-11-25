import { spawn as nodeSpawn, spawnSync, type ChildProcess } from 'node:child_process';
import spawn from 'cross-spawn';

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
  const started = Date.now();
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  return collect(child, opts, started);
}

export function execShell(command: string, opts: ExecOptions): Promise<ExecResult> {
  const started = Date.now();
  const child = nodeSpawn(command, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    shell: true,
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  return collect(child, opts, started);
}

export function spawnShell(command: string, opts: { cwd: string; env?: NodeJS.ProcessEnv }): ChildProcess {
  return nodeSpawn(command, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
}
