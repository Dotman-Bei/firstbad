import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, topLevel } from './git.js';

export interface CleanResult {
  removedWorktrees: string[];
  removedSessions: string[];
}

export async function cleanLeftovers(repoDir: string, tmpRoot: string = os.tmpdir()): Promise<CleanResult> {
  const top = await topLevel(repoDir);
  const list = await git(top, ['worktree', 'list', '--porcelain']);
  const removedWorktrees: string[] = [];
  for (const line of list.stdout.split(/\r?\n/)) {
    if (!line.startsWith('worktree ')) continue;
    const wt = line.slice('worktree '.length).trim();
    if (path.basename(wt) === 'wt' && path.basename(path.dirname(wt)).startsWith('firstbad-')) {
      await git(top, ['worktree', 'remove', '--force', wt]);
      removedWorktrees.push(wt);
    }
  }
  await git(top, ['worktree', 'prune']);
  const removedSessions: string[] = [];
  for (const name of fs.readdirSync(tmpRoot)) {
    if (!/^firstbad-\d{8}-\d{6}-/.test(name)) continue;
    const dir = path.join(tmpRoot, name);
    if (fs.existsSync(path.join(dir, 'session.json'))) {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      removedSessions.push(dir);
    }
  }
  return { removedWorktrees, removedSessions };
}
