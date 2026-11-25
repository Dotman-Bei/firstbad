import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanLeftovers } from '../src/clean.js';
import { main } from '../src/cli.js';
import { git, makeRepo, tempDir } from './helpers.js';

describe('clean', () => {
  it('removes leftover firstbad worktrees and session folders only', async () => {
    const repo = makeRepo([{ subject: 'one', files: { 'a.txt': '1' } }]);
    const tmpRoot = tempDir('firstbad-cleanroot-');
    const session = path.join(tmpRoot, 'firstbad-20261125-120000-abcdef');
    fs.mkdirSync(session);
    fs.writeFileSync(path.join(session, 'session.json'), '{}');
    git(repo, 'worktree', 'add', '--detach', path.join(session, 'wt'), 'HEAD');
    const unrelated = path.join(tmpRoot, 'firstbad-notes');
    fs.mkdirSync(unrelated);
    const r = await cleanLeftovers(repo, tmpRoot);
    expect(r.removedWorktrees).toHaveLength(1);
    expect(r.removedSessions).toEqual([session]);
    expect(fs.existsSync(unrelated)).toBe(true);
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
    const lines: string[] = [];
    const code = await main(['clean', '--repo', repo], { print: (l) => lines.push(l), env: process.env, cwd: process.cwd(), color: false });
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('removed 0 worktrees');
  });
});
