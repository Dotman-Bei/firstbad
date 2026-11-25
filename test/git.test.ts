import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GitError,
  addWorktree,
  branchExists,
  checkoutDetached,
  commonDir,
  isAncestor,
  removeWorktree,
  revParse,
  statusPorcelain,
  subjectOf,
  topLevel,
} from '../src/git.js';
import { git, makeRepo, tempDir } from './helpers.js';

describe('git helpers', () => {
  it('resolves refs, subjects and ancestry', async () => {
    const repo = makeRepo([
      { subject: 'one', files: { 'a.txt': '1' }, tag: 'v1' },
      { subject: 'two', files: { 'a.txt': '2' } },
      { subject: 'three', files: { 'a.txt': '3' } },
    ]);
    expect(await revParse(repo, 'HEAD')).toMatch(/^[0-9a-f]{40}$/);
    expect(await subjectOf(repo, 'HEAD')).toBe('three');
    expect(await isAncestor(repo, 'v1', 'HEAD')).toBe(true);
    expect(await isAncestor(repo, 'HEAD', 'v1')).toBe(false);
    await expect(revParse(repo, 'no-such-ref')).rejects.toBeInstanceOf(GitError);
    expect(fs.realpathSync(await topLevel(repo))).toBe(fs.realpathSync(repo));
    expect(fs.realpathSync(await commonDir(repo))).toBe(fs.realpathSync(path.join(repo, '.git')));
    expect(await branchExists(repo, 'main')).toBe(true);
    expect(await branchExists(repo, 'nope')).toBe(false);
  });

  it('adds, uses and removes a detached worktree without touching the checkout', async () => {
    const repo = makeRepo([
      { subject: 'one', files: { 'a.txt': '1' }, tag: 'v1' },
      { subject: 'two', files: { 'a.txt': '2' } },
    ]);
    const head = await revParse(repo, 'HEAD');
    const wt = path.join(tempDir('firstbad-wt-'), 'wt');
    await addWorktree(repo, wt, 'v1');
    expect(await subjectOf(wt, 'HEAD')).toBe('one');
    await checkoutDetached(wt, head);
    expect(await subjectOf(wt, 'HEAD')).toBe('two');
    fs.writeFileSync(path.join(wt, 'a.txt'), 'changed');
    expect(await statusPorcelain(wt)).toContain('a.txt');
    await removeWorktree(repo, wt);
    expect(fs.existsSync(wt)).toBe(false);
    expect(git(repo, 'worktree', 'list')).not.toContain('firstbad-wt-');
    expect(git(repo, 'status', '--porcelain')).toBe('');
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(head);
  });
});
