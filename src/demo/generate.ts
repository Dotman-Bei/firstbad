import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_GOOD_TAG, demoHistory, type Edit } from './history.js';

export const DEMO_AUTHOR = { name: 'Corner Shop Dev', email: 'dev@corner-shop.invalid' };
const DEMO_START_MS = Date.UTC(2026, 10, 2, 9, 0, 0);
const GIT_FLAGS = ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'init.defaultBranch=main'];

export interface GeneratedDemo {
  dir: string;
  head: string;
  goodRef: string;
  commits: number;
}

function applyEdit(files: Map<string, string>, e: Edit): void {
  if ('content' in e) {
    files.set(e.path, e.content);
    return;
  }
  const current = files.get(e.path);
  if (current === undefined) throw new Error(`demo history: ${e.path} does not exist yet`);
  if ('append' in e) {
    files.set(e.path, current + e.append);
    return;
  }
  const at = current.indexOf(e.find);
  if (at < 0 || current.indexOf(e.find, at + 1) >= 0) throw new Error(`demo history: "${e.find}" must appear exactly once in ${e.path}`);
  files.set(e.path, current.slice(0, at) + e.replace + current.slice(at + e.find.length));
}

export function generateDemoRepo(dir: string): GeneratedDemo {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length > 0) throw new Error(`${dir} is not empty`);
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: DEMO_AUTHOR.name,
    GIT_AUTHOR_EMAIL: DEMO_AUTHOR.email,
    GIT_COMMITTER_NAME: DEMO_AUTHOR.name,
    GIT_COMMITTER_EMAIL: DEMO_AUTHOR.email,
  };
  const run = (args: string[], env: NodeJS.ProcessEnv = baseEnv): string =>
    execFileSync('git', [...GIT_FLAGS, ...args], { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  run(['init', '-q']);
  run(['config', 'core.autocrlf', 'false']);
  run(['config', 'commit.gpgsign', 'false']);
  run(['config', 'user.name', DEMO_AUTHOR.name]);
  run(['config', 'user.email', DEMO_AUTHOR.email]);
  const files = new Map<string, string>();
  const history = demoHistory();
  history.forEach((commit, index) => {
    const touched = new Set<string>();
    for (const e of commit.edits) {
      applyEdit(files, e);
      touched.add(e.path);
    }
    for (const file of touched) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, files.get(file) ?? '');
    }
    run(['add', '-A']);
    const date = new Date(DEMO_START_MS + index * 3 * 3600 * 1000).toISOString().replace('.000Z', 'Z');
    run(['commit', '-q', '--no-verify', '-m', commit.subject], { ...baseEnv, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
    if (index === 0) run(['tag', DEMO_GOOD_TAG]);
  });
  return { dir, head: run(['rev-parse', 'HEAD']), goodRef: DEMO_GOOD_TAG, commits: history.length };
}
