import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { PreflightError, cleanupSession, hunt, parseBisectOutput, prepareSession, type PrepareOptions } from '../src/hunt.js';
import { runOracle } from '../src/oracle.js';
import { readSession, type HuntLog, type LedgerEntry } from '../src/session.js';
import { KANE_CMD, VALUE_SERVER, bisectRepo, clearStubEnv, git, makeRepo, setStubPlan, stubRuns, tempDir } from './helpers.js';

const lines: string[] = [];
const log: HuntLog = {
  entry: (e: LedgerEntry) => lines.push(`${e.phase} ${e.verdict} ${e.subject}`),
  info: (l: string) => lines.push(l),
};

function options(repo: string, port: number, over: Partial<PrepareOptions> = {}): PrepareOptions {
  return {
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
    ...over,
  };
}

afterEach(() => {
  clearStubEnv();
  lines.length = 0;
});

describe('hunt', () => {
  it('brackets, bisects around the broken commits and confirms the culprit without touching the checkout', async () => {
    const repo = bisectRepo();
    const head = git(repo, 'rev-parse', 'HEAD');
    const stub = setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'fetch' } });
    const prepared = await prepareSession(options(repo, 4331), log);
    try {
      const h = await hunt(prepared, log);
      expect(h.status).toBe('confirmed');
      expect(h.culprit?.subject).toBe('bad: culprit');
      expect(h.badValue).toBe('$20.00');
      expect(h.entries.filter((e) => e.phase === 'bracket').map((e) => e.verdict)).toEqual(['FAIL', 'PASS']);
      expect(h.entries.some((e) => e.phase === 'bisect' && e.verdict === 'SKIP' && e.reason.includes('page never loaded'))).toBe(true);
      expect(h.entries.filter((e) => e.phase === 'confirm').map((e) => e.verdict)).toEqual(['FAIL', 'PASS']);
      expect(stubRuns(stub.log)).toBeLessThanOrEqual(10);
      expect(readSession(prepared.sessionPath).runsUsed).toBe(stubRuns(stub.log));
      expect(lines.some((l) => l.startsWith('Bisecting:'))).toBe(true);
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
    expect(fs.existsSync(prepared.session.sessionDir)).toBe(false);
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(repo, 'status', '--porcelain')).toBe('');
  });

  it('reports nothing to hunt when the bad ref passes', async () => {
    const repo = makeRepo([
      { subject: 'good: a', files: { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, tag: 'v1' },
      { subject: 'good: b', files: { 'README.md': 'x\n' } },
    ]);
    setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'fetch' } });
    const prepared = await prepareSession(options(repo, 4332), log);
    try {
      expect((await hunt(prepared, log)).status).toBe('nothing-to-hunt');
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('aborts with a mis-phrased message after retrying an empty value once', async () => {
    const repo = bisectRepo();
    setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'misphrased' } });
    const prepared = await prepareSession(options(repo, 4333), log);
    try {
      const h = await hunt(prepared, log);
      expect(h.status).toBe('aborted');
      expect(h.message).toContain('mis-phrased');
      expect(readSession(prepared.sessionPath).runsUsed).toBe(2);
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('refuses to start below the balance floor, with unrelated refs or with a bad check', async () => {
    const repo = bisectRepo();
    setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'fetch' } });
    await expect(
      prepareSession(options(repo, 4334, { env: { ...process.env, STUB_KANE_BALANCE: '100', FIRSTBAD_MIN_BALANCE: '500' } }), log),
    ).rejects.toBeInstanceOf(PreflightError);
    await expect(prepareSession(options(repo, 4334, { good: 'HEAD', bad: 'v1' }), log)).rejects.toThrow(/not an ancestor/);
    await expect(
      prepareSession(options(repo, 4334, { check: { url: 'nope', do: 'x', store: 'y', expected: 'z' } }), log),
    ).rejects.toThrow(/--url/);
  });
});

describe('oracle and bisect output', () => {
  it('parses git bisect run output', () => {
    const a = 'a'.repeat(40);
    const b = 'b'.repeat(40);
    const c = 'c'.repeat(40);
    expect(parseBisectOutput(`running x\n${a} is the first bad commit\ncommit ${a}\n`)).toEqual({ firstBad: a, candidates: [] });
    expect(
      parseBisectOutput(`There are only 'skip'ped commits left to test.\nThe first bad commit could be any of:\n${b}\n${c}\nWe cannot bisect more!\n`),
    ).toEqual({ firstBad: null, candidates: [b, c] });
    expect(parseBisectOutput('nothing useful')).toEqual({ firstBad: null, candidates: [] });
  });

  it('never exits 1 when it crashes', async () => {
    const out: string[] = [];
    const code = await runOracle('/no/such/session.json', tempDir('firstbad-oracle-'), (l) => out.push(l));
    expect(code).toBe(128);
    expect(out[0]).toMatch(/^@@firstbad /);
  });
});
