import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STUB_KANE = path.join(ROOT, 'test', 'fixtures', 'stub-kane.mjs');
export const STUB_AGENT = path.join(ROOT, 'test', 'fixtures', 'stub-agent.mjs');
export const TINY_SERVER = path.join(ROOT, 'test', 'fixtures', 'tiny-server.mjs');
export const KANE_CMD = [process.execPath, STUB_KANE];

// A server that answers every request with the content of value.txt in its working directory.
export const VALUE_SERVER = [
  "import fs from 'node:fs';",
  "import http from 'node:http';",
  'const port = Number(process.argv[2]);',
  'http',
  '  .createServer((req, res) => {',
  "    res.writeHead(200, { 'content-type': 'text/plain' });",
  "    res.end(fs.readFileSync('value.txt', 'utf8'));",
  '  })',
  "  .listen(port, '127.0.0.1');",
  '',
].join('\n');

export const CRASH_SERVER = "throw new Error('server crashed on purpose');\n";

export function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

export function git(dir: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: dir, env: GIT_ENV, encoding: 'utf8' }).trim();
}

export interface FakeCommit {
  subject: string;
  files: Record<string, string>;
  tag?: string;
}

export function makeRepo(commits: FakeCommit[]): string {
  const dir = tempDir('firstbad-repo-');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'core.autocrlf', 'false');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  for (const c of commits) {
    for (const [file, content] of Object.entries(c.files)) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '--no-verify', '-m', c.subject);
    if (c.tag !== undefined) git(dir, 'tag', c.tag);
  }
  return dir;
}

// Nine commits: good from c1 (tag v1); the server crashes in c4-c5 (bisect's first probe lands on c5);
// the culprit c7 changes the value from $18.00 to $20.00.
export function bisectRepo(): string {
  return makeRepo([
    { subject: 'good: init', files: { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00', '.gitignore': 'node_modules/\n' }, tag: 'v1' },
    { subject: 'good: docs', files: { 'README.md': 'docs 1\n' } },
    { subject: 'good: more docs', files: { 'README.md': 'docs 2\n' } },
    { subject: 'broken: server crash', files: { 'server.mjs': CRASH_SERVER } },
    { subject: 'broken: still down', files: { 'README.md': 'docs 3\n' } },
    { subject: 'good: restore server', files: { 'server.mjs': VALUE_SERVER } },
    { subject: 'bad: culprit', files: { 'value.txt': '$20.00' } },
    { subject: 'bad: after one', files: { 'README.md': 'docs 4\n' } },
    { subject: 'bad: after two', files: { 'README.md': 'docs 5\n' } },
  ]);
}

// The stub kane-cli and anything it spawns inherit process.env, so tests steer the stub through it.
export function setStubPlan(dir: string, plan: unknown): { plan: string; log: string } {
  const planPath = path.join(dir, 'stub-plan.json');
  const logPath = path.join(dir, 'stub-log.jsonl');
  fs.writeFileSync(planPath, JSON.stringify(plan));
  process.env.STUB_KANE_PLAN = planPath;
  process.env.STUB_KANE_LOG = logPath;
  return { plan: planPath, log: logPath };
}

export function clearStubEnv(): void {
  for (const key of [
    'STUB_KANE_PLAN',
    'STUB_KANE_LOG',
    'STUB_KANE_BALANCE',
    'STUB_AGENT_MODE',
    'STUB_AGENT_FILE',
    'STUB_AGENT_CONTENT',
    'STUB_AGENT_NOOP_FIRST',
    'STUB_AGENT_STATE',
    'STUB_AGENT_LOG',
  ]) {
    delete process.env[key];
  }
}

export function stubRuns(logPath: string): number {
  if (!fs.existsSync(logPath)) return 0;
  return fs
    .readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '').length;
}
