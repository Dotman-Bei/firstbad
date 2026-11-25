import path from 'node:path';
import { execArgv, type ExecResult } from './util/proc.js';

export class GitError extends Error {
  constructor(args: string[], r: ExecResult) {
    super(`git ${args.join(' ')} failed (exit ${r.code === null ? 'none' : String(r.code)}): ${(r.stderr || r.stdout).trim().slice(0, 500)}`);
    this.name = 'GitError';
  }
}

export function git(cwd: string, args: string[], timeoutMs = 120_000): Promise<ExecResult> {
  return execArgv(['git', ...args], { cwd, timeoutMs });
}

export async function gitOut(cwd: string, args: string[], timeoutMs?: number): Promise<string> {
  const r = await git(cwd, args, timeoutMs);
  if (r.code !== 0) throw new GitError(args, r);
  return r.stdout.trim();
}

export function revParse(cwd: string, ref: string): Promise<string> {
  return gitOut(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
}

export function subjectOf(cwd: string, ref: string): Promise<string> {
  return gitOut(cwd, ['log', '-1', '--format=%s', ref]);
}

export async function isAncestor(cwd: string, a: string, b: string): Promise<boolean> {
  const args = ['merge-base', '--is-ancestor', a, b];
  const r = await git(cwd, args);
  if (r.code === 0) return true;
  if (r.code === 1) return false;
  throw new GitError(args, r);
}

export function topLevel(cwd: string): Promise<string> {
  return gitOut(cwd, ['rev-parse', '--show-toplevel']);
}

export async function commonDir(cwd: string): Promise<string> {
  return path.resolve(cwd, await gitOut(cwd, ['rev-parse', '--git-common-dir']));
}

export async function addWorktree(repoDir: string, dir: string, ref: string): Promise<void> {
  await gitOut(repoDir, ['worktree', 'add', '--detach', dir, ref]);
}

export async function removeWorktree(repoDir: string, dir: string): Promise<void> {
  await git(repoDir, ['worktree', 'remove', '--force', dir]);
  await git(repoDir, ['worktree', 'prune']);
}

export async function checkoutDetached(cwd: string, ref: string): Promise<void> {
  await gitOut(cwd, ['checkout', '--detach', '--force', '--quiet', ref]);
}

export function statusPorcelain(cwd: string): Promise<string> {
  return gitOut(cwd, ['status', '--porcelain']);
}

export async function branchExists(cwd: string, name: string): Promise<boolean> {
  const r = await git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]);
  return r.code === 0;
}
