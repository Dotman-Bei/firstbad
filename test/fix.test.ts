import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { commitFix, fix, fixCommitMessage } from '../src/fix.js';
import { cleanupSession, hunt, prepareSession, type HuntResult, type Prepared } from '../src/hunt.js';
import type { HuntLog } from '../src/session.js';
import { KANE_CMD, STUB_AGENT, bisectRepo, clearStubEnv, git, setStubPlan, tempDir } from './helpers.js';

const log: HuntLog = { entry: () => undefined, info: () => undefined };
const AGENT = [process.execPath, STUB_AGENT];

async function huntRepo(port: number): Promise<{ repo: string; prepared: Prepared; h: HuntResult; work: string }> {
  const repo = bisectRepo();
  const work = tempDir('firstbad-fix-');
  setStubPlan(work, { default: { scenario: 'fetch' } });
  const prepared = await prepareSession(
    {
      repoDir: repo,
      good: 'v1',
      bad: 'HEAD',
      check: { url: `http://127.0.0.1:${port}/`, do: 'read the page', store: 'the page text', expected: '$18.00' },
      serve: `node server.mjs ${port}`,
      setup: null,
      kaneCmd: KANE_CMD,
      env: { ...process.env },
      template: 'commas-assert',
      verdictMode: 'status+value',
    },
    log,
  );
  const h = await hunt(prepared, log);
  expect(h.status).toBe('confirmed');
  return { repo, prepared, h, work };
}

afterEach(() => clearStubEnv());

describe('fix', () => {
  it('lets the agent patch the tree on its second attempt, proves it with Kane and commits on a new branch', async () => {
    const { repo, prepared, h, work } = await huntRepo(4341);
    try {
      process.env.STUB_AGENT_MODE = 'write';
      process.env.STUB_AGENT_FILE = 'value.txt';
      process.env.STUB_AGENT_CONTENT = '$18.00';
      process.env.STUB_AGENT_STATE = path.join(work, 'agent-state.json');
      process.env.STUB_AGENT_NOOP_FIRST = '1';
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: AGENT, env: { ...process.env } }, log);
      const short = (h.culprit?.commit ?? '').slice(0, 7);
      expect(r).toMatchObject({ status: 'verified', route: 'agent', attempts: 2, branch: `firstbad/fix-${short}` });
      expect(r.entries.map((e) => e.verdict)).toEqual(['PASS']);
      const sha = await commitFix(prepared.sessionPath, fixCommitMessage('the page text', h.culprit?.commit ?? ''));
      expect(git(repo, 'rev-parse', `firstbad/fix-${short}`)).toBe(sha);
      expect(git(repo, 'show', `firstbad/fix-${short}:value.txt`)).toBe('$18.00');
      expect(git(repo, 'log', '-1', '--format=%s', `firstbad/fix-${short}`)).toBe(
        `fix: restore "the page text" regression from ${short} (verified by Kane via firstbad)`,
      );
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('reverts the culprit when there is no agent', async () => {
    const { repo, prepared, h } = await huntRepo(4342);
    try {
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: null, env: { ...process.env } }, log);
      expect(r).toMatchObject({ status: 'verified', route: 'revert' });
      await commitFix(prepared.sessionPath, fixCommitMessage('the page text', h.culprit?.commit ?? ''));
      expect(git(repo, 'show', `${r.branch ?? ''}:value.txt`)).toBe('$18.00');
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('falls back to the revert when the agent command is not installed', async () => {
    const { prepared, h } = await huntRepo(4343);
    try {
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: ['firstbad-no-such-agent-xyz'], env: { ...process.env } }, log);
      expect(r).toMatchObject({ status: 'verified', route: 'revert' });
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('gives up after the attempt cap, deletes the branch, and skips an unconfirmed hunt', async () => {
    const { repo, prepared, h } = await huntRepo(4344);
    try {
      process.env.STUB_AGENT_MODE = 'noop';
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: AGENT, env: { ...process.env, FIRSTBAD_MAX_FIX_ATTEMPTS: '2' } }, log);
      expect(r).toMatchObject({ status: 'unverified', route: 'agent', branch: null, attempts: 2 });
      expect(r.entries).toHaveLength(0);
      expect(git(repo, 'branch', '--list', 'firstbad/*')).toBe('');
      const skipped = await fix(prepared.sessionPath, { ...h, status: 'unconfirmed' }, prepared.badSha, { agentArgv: AGENT, env: { ...process.env } }, log);
      expect(skipped.status).toBe('skipped');
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });
});
