import type { ChildProcess } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { execShell, killTree, spawnShell } from '../util/proc.js';
import type { StepOutcome } from '../verdict.js';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Any HTTP answer below 500 counts. agent:false so no keep-alive socket holds the process open.
export function urlResponds(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean): void => {
      if (done) return;
      done = true;
      resolve(value);
    };
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      finish(false);
      return;
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(parsed, { agent: false, timeout: timeoutMs }, (res) => {
      res.resume();
      finish((res.statusCode ?? 500) < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      finish(false);
    });
    req.on('error', () => finish(false));
  });
}

export interface ServerHandle {
  child: ChildProcess;
  exited(): number | null | undefined;
  output(): string;
  stop(): Promise<void>;
}

export function startServer(command: string, cwd: string, env?: NodeJS.ProcessEnv): ServerHandle {
  const child = spawnShell(command, { cwd, env });
  let out = '';
  let exitCode: number | null | undefined;
  const keep = (chunk: string): void => {
    out = (out + chunk).slice(-4000);
  };
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', keep);
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', keep);
  const exited = new Promise<void>((resolve) => {
    child.on('exit', (code: number | null) => {
      exitCode = code;
      resolve();
    });
    child.on('error', () => {
      exitCode = -1;
      resolve();
    });
  });
  return {
    child,
    exited: () => exitCode,
    output: () => out,
    stop: async () => {
      if (exitCode !== undefined) return;
      killTree(child.pid);
      await Promise.race([exited, sleep(5000)]);
    },
  };
}

export async function waitReady(url: string, server: ServerHandle, timeoutMs: number): Promise<StepOutcome> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const code = server.exited();
    if (code !== undefined) return { ok: false, detail: `server exited with code ${code === null ? 'none' : String(code)}` };
    if (await urlResponds(url, 1500)) return { ok: true, detail: 'ready' };
    await sleep(250);
  }
  const code = server.exited();
  if (code !== undefined) return { ok: false, detail: `server exited with code ${code === null ? 'none' : String(code)}` };
  return { ok: false, detail: `no answer from ${url} within ${Math.round(timeoutMs / 1000)} s` };
}

export async function waitDown(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await urlResponds(url, 1000))) return true;
    await sleep(200);
  }
  return false;
}

export async function runSetup(command: string, cwd: string, timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<StepOutcome> {
  const r = await execShell(command, { cwd, env, timeoutMs });
  if (r.timedOut) return { ok: false, detail: `timed out after ${Math.round(timeoutMs / 1000)} s` };
  if (r.spawnError !== null) return { ok: false, detail: `could not start (${r.spawnError})` };
  if (r.code !== 0) return { ok: false, detail: `exit ${r.code === null ? 'none' : String(r.code)}` };
  return { ok: true, detail: 'ok' };
}
