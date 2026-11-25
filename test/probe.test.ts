import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startServer, waitReady } from '../src/app/serve.js';
import { probe, type ProbeTarget } from '../src/probe.js';
import { readLedger, readSession, writeSession, type Session } from '../src/session.js';
import { CRASH_SERVER, KANE_CMD, TINY_SERVER, VALUE_SERVER, clearStubEnv, setStubPlan, tempDir } from './helpers.js';

let work = '';

function makeSession(port: number, files: Record<string, string>, over: Partial<Session> = {}): { sessionPath: string; app: string } {
  work = tempDir('firstbad-probe-');
  const app = path.join(work, 'app');
  fs.mkdirSync(app);
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(app, file), content);
  const kaneCwd = path.join(work, 'kane');
  fs.mkdirSync(kaneCwd);
  const session: Session = {
    version: 1,
    repoDir: app,
    sessionDir: work,
    worktreeDir: app,
    kaneCwd,
    ledgerPath: path.join(work, 'ledger.jsonl'),
    check: { url: `http://127.0.0.1:${port}/`, do: 'read the page', store: 'the page text', expected: '$18.00' },
    template: 'commas-assert',
    verdictMode: 'status+value',
    serve: `node server.mjs ${port}`,
    setup: null,
    kaneCmd: KANE_CMD,
    kaneTimeoutSec: 30,
    readyTimeoutSec: 10,
    setupTimeoutSec: 30,
    maxRuns: 16,
    runsUsed: 0,
    badValue: null,
    ...over,
  };
  const sessionPath = path.join(work, 'session.json');
  writeSession(sessionPath, session);
  fs.writeFileSync(session.ledgerPath, '');
  return { sessionPath, app };
}

const target = (app: string, label = 'probe'): ProbeTarget => ({ phase: 'bisect', label, cwd: app, commit: 'c'.repeat(40), subject: 'test commit' });

afterEach(() => clearStubEnv());

describe('probe', () => {
  it('passes a commit whose page shows the expected value and records the run', async () => {
    const { sessionPath, app } = makeSession(4321, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({
      phase: 'bisect',
      verdict: 'PASS',
      observed: '$18.00',
      kaneRuns: 1,
      creditsConsumed: 12.5,
      testUrl: 'https://kane.example.invalid/test-manager/stub',
    });
    const s = readSession(sessionPath);
    expect(s.runsUsed).toBe(1);
    expect(readLedger(s.ledgerPath)).toHaveLength(1);
  });

  it('fails a commit that shows the bad signature', async () => {
    const { sessionPath, app } = makeSession(4322, { 'server.mjs': VALUE_SERVER, 'value.txt': '$20.00' }, { badValue: '$20.00' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    expect((await probe(sessionPath, target(app))).entry).toMatchObject({ verdict: 'FAIL', observed: '$20.00' });
  });

  it('skips a failed setup and a server that never loads, without Kane', async () => {
    const a = makeSession(4323, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, { setup: 'node -e "process.exit(3)"' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    expect((await probe(a.sessionPath, target(a.app))).entry).toMatchObject({ verdict: 'SKIP', reason: 'setup failed (exit 3)', kaneRuns: 0 });
    const b = makeSession(4324, { 'server.mjs': CRASH_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    const r = await probe(b.sessionPath, target(b.app));
    expect(r.entry.verdict).toBe('SKIP');
    expect(r.entry.reason).toContain('page never loaded');
    expect(readSession(b.sessionPath).runsUsed).toBe(0);
  });

  it('aborts on a busy port and on the run cap', async () => {
    const busy = startServer(`node "${TINY_SERVER}" 4325`, os.tmpdir());
    try {
      expect((await waitReady('http://127.0.0.1:4325/', busy, 10_000)).ok).toBe(true);
      const a = makeSession(4325, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
      setStubPlan(work, { default: { scenario: 'fetch' } });
      const r = await probe(a.sessionPath, target(a.app));
      expect(r.entry.verdict).toBe('ABORT');
      expect(r.entry.reason).toContain('port busy');
    } finally {
      await busy.stop();
    }
    const b = makeSession(4326, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, { maxRuns: 0 });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    expect((await probe(b.sessionPath, target(b.app))).entry).toMatchObject({ verdict: 'ABORT', reason: 'run cap reached (FIRSTBAD_MAX_RUNS=0)' });
  });

  it('retries a transient Kane error once and counts both runs', async () => {
    const { sessionPath, app } = makeSession(4327, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'fetch' }, rules: [{ labelIncludes: 'retry-me', steps: [{ scenario: 'error' }, { scenario: 'fetch' }] }] });
    const r = await probe(sessionPath, target(app, 'retry-me'));
    expect(r.entry).toMatchObject({ verdict: 'PASS', kaneRuns: 2, creditsConsumed: 12.5 });
    expect(readSession(sessionPath).runsUsed).toBe(2);
  });

  it('retries an empty stored value once, then reports it as mis-phrased', async () => {
    const { sessionPath, app } = makeSession(4328, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'misphrased' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({ verdict: 'SKIP', kaneRuns: 2, observed: null });
    expect(r.misphrased).toBe(true);
    expect(r.emptyValue).toBe(true);
  });

  it('reads the one final_state key whose name shares a word with the store phrase', async () => {
    const check = { url: 'http://127.0.0.1:4329/', do: 'read the page', store: 'the total amount shown next to the word Total', expected: '$18.00' };
    const { sessionPath, app } = makeSession(4329, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, { check });
    setStubPlan(work, { default: { scenario: 'multikey' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({ verdict: 'PASS', observed: '$18.00', observedKey: 'cart_total', kaneRuns: 1 });
    expect(r.entry.finalStateKeys).toBeUndefined();
  });

  it('records the final_state key names, never their values, when no key name matches', async () => {
    const { sessionPath, app } = makeSession(4330, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'multikey' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({ verdict: 'SKIP', observed: null, kaneRuns: 2, finalStateKeys: ['url', 'cart_total', 'discount_code'] });
    expect(r.entry.observedKey).toBeUndefined();
    expect(r.emptyValue).toBe(true);
    expect(r.entry.reason).toContain('Kane could not read the value (final_state keys: url, cart_total, discount_code; 2 non-url keys)');
    expect(JSON.stringify(readLedger(readSession(sessionPath).ledgerPath))).not.toContain('SAVE10');
  });
});
