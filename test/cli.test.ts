import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HELP, kaneCommand, main, type CliIO } from '../src/cli.js';
import { VERSION } from '../src/version.js';
import { ROOT, STUB_AGENT, STUB_KANE, bisectRepo, clearStubEnv, git, setStubPlan, tempDir } from './helpers.js';

function io(lines: string[], env: NodeJS.ProcessEnv = process.env): CliIO {
  return { print: (l) => lines.push(l), env, cwd: process.cwd(), color: false };
}

afterEach(() => clearStubEnv());

describe('cli', () => {
  it('prints the version from the built binary and has help', () => {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js'), '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe(VERSION);
    expect(HELP).toContain('firstbad hunt');
    expect(HELP).toContain('firstbad oracle');
  });

  it('rejects missing, invalid and unknown options with exit 2', async () => {
    const lines: string[] = [];
    expect(await main(['hunt', '--good', 'v1'], io(lines))).toBe(2);
    expect(lines.join('\n')).toContain('missing --url');
    expect(await main(['hunt', '--good', 'v1', '--url', 'nope', '--do', 'x', '--store', 'y', '--expect', 'z', '--serve', 's'], io(lines))).toBe(2);
    expect(await main(['hunt', '--bogus'], io(lines))).toBe(2);
    expect(await main(['nope'], io(lines))).toBe(2);
    expect(kaneCommand({ FIRSTBAD_KANE: '"node" "x y.mjs"' })).toEqual(['node', 'x y.mjs']);
    expect(kaneCommand({})).toEqual(['kane-cli']);
  });

  it('runs a whole hunt, fixes it with the agent, commits the report and writes it to --out', async () => {
    const repo = bisectRepo();
    const work = tempDir('firstbad-cli-');
    setStubPlan(work, { default: { scenario: 'fetch' } });
    process.env.STUB_AGENT_MODE = 'write';
    process.env.STUB_AGENT_FILE = 'value.txt';
    process.env.STUB_AGENT_CONTENT = '$18.00';
    const env = { ...process.env, FIRSTBAD_KANE: `"${process.execPath}" "${STUB_KANE}"` };
    const out = path.join(work, 'out');
    const lines: string[] = [];
    const code = await main(
      [
        'hunt',
        '--repo', repo,
        '--good', 'v1',
        '--url', 'http://127.0.0.1:4351/',
        '--do', 'read the page',
        '--store', 'the page text',
        '--expect', '$18.00',
        '--serve', 'node server.mjs 4351',
        '--agent', `"${process.execPath}" "${STUB_AGENT}"`,
        '--out', out,
      ],
      io(lines, env),
    );
    expect(code).toBe(0);
    const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')) as {
      hunt: { status: string; culprit: { subject: string } };
      fix: { status: string; branch: string; commit: string };
    };
    expect(report.hunt.status).toBe('confirmed');
    expect(report.hunt.culprit.subject).toBe('bad: culprit');
    expect(report.fix.status).toBe('verified');
    expect(git(repo, 'rev-parse', report.fix.branch)).toBe(report.fix.commit);
    expect(git(repo, 'show', `${report.fix.branch}:firstbad-report.md`)).toContain('# firstbad report');
    expect(git(repo, 'show', `${report.fix.branch}:value.txt`)).toBe('$18.00');
    expect(lines.some((l) => l.includes('bracket') && l.includes('FAIL'))).toBe(true);
    expect(fs.readFileSync(path.join(out, 'report.md'), 'utf8')).toContain('## Timeline');
  });

  it('exits 3 when the preflight fails', async () => {
    const repo = bisectRepo();
    const lines: string[] = [];
    const env = { ...process.env, FIRSTBAD_KANE: 'firstbad-no-such-kane-cli-xyz' };
    const code = await main(
      ['hunt', '--repo', repo, '--good', 'v1', '--url', 'http://127.0.0.1:4352/', '--do', 'x', '--store', 'y', '--expect', 'z', '--serve', 'node server.mjs 4352'],
      io(lines, env),
    );
    expect(code).toBe(3);
    expect(lines.join('\n')).toContain('kane-cli was not found');
  });
});
