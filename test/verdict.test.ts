import { describe, expect, it } from 'vitest';
import type { KaneRunEnd } from '../src/kane/ndjson.js';
import type { KaneRunResult } from '../src/kane/runner.js';
import { classify, exitCodeFor, isAuthFailure, isTransient, type ClassifyInput } from '../src/verdict.js';

interface KaneShape {
  exitCode?: number | null;
  killed?: boolean;
  terminalMode?: boolean;
  spawnError?: string | null;
  stderrTail?: string;
  errors?: string[];
  end?: Partial<KaneRunEnd> | null;
}

function kane(p: KaneShape): KaneRunResult {
  const runEnd: KaneRunEnd | null =
    p.end === null
      ? null
      : {
          status: 'failed',
          summary: '',
          oneLiner: '',
          reason: '',
          creditsConsumed: 12,
          observed: '',
          observedKey: null,
          finalStateKeys: [],
          testUrl: null,
          resultCode: '720',
          durationSec: 1,
          blamesTest: false,
          ...(p.end ?? {}),
        };
  return {
    exitCode: p.exitCode === undefined ? 1 : p.exitCode,
    killed: p.killed ?? false,
    terminalMode: p.terminalMode ?? false,
    spawnError: p.spawnError ?? null,
    stderrTail: p.stderrTail ?? '',
    durationMs: 10,
    stream: {
      lines: 3,
      firstLineIsJson: true,
      streamStart: true,
      cliVersion: '0.10.9',
      runEnd,
      testMdDone: null,
      errors: p.errors ?? [],
      stepsDone: 1,
      stepsFailed: 0,
    },
  };
}

const base: Omit<ClassifyInput, 'kane'> = { expected: '$18.00', badValue: '$20.00', mode: 'status+value' };

describe('classify', () => {
  it('skips setup and serve failures without Kane', () => {
    expect(classify({ ...base, setup: { ok: false, detail: 'exit 3' } })).toMatchObject({ verdict: 'SKIP', reason: 'setup failed (exit 3)' });
    expect(classify({ ...base, ready: { ok: false, detail: 'server exited with code 1' } })).toMatchObject({
      verdict: 'SKIP',
      reason: 'page never loaded (server exited with code 1)',
    });
  });

  it('aborts when Kane is missing or not logged in', () => {
    expect(classify({ ...base, kane: kane({ spawnError: 'ENOENT', end: null }) }).verdict).toBe('ABORT');
    const auth = kane({ exitCode: 2, errors: ['Authentication failed: token expired'], end: null });
    expect(isAuthFailure(auth)).toBe(true);
    expect(classify({ ...base, kane: auth })).toMatchObject({ verdict: 'ABORT', reason: 'Kane authentication failed — run kane-cli login' });
  });

  it('marks transient outcomes as retryable skips', () => {
    const cdp = kane({ exitCode: 2, errors: ['Chrome CDP not ready after 30000ms'], end: null });
    expect(isTransient(cdp)).toBe(true);
    expect(classify({ ...base, kane: cdp })).toMatchObject({ verdict: 'SKIP', retryable: true });
    expect(classify({ ...base, kane: cdp }).reason).toContain('Chrome CDP');
    expect(classify({ ...base, kane: kane({ exitCode: null, killed: true, end: null }) }).reason).toContain('timed out');
    expect(classify({ ...base, kane: kane({ exitCode: null, killed: true, terminalMode: true, end: null }) }).reason).toContain('terminal mode');
    expect(classify({ ...base, kane: kane({ exitCode: 3, end: null }) }).reason).toContain('exit 3');
  });

  it('retries an empty value and flags a mis-phrased check', () => {
    const c = classify({ ...base, kane: kane({ end: { observed: '', blamesTest: true, summary: 'not found' } }) });
    expect(c).toMatchObject({ verdict: 'SKIP', misphrased: true, emptyValue: true, retryable: true, observed: null });
    expect(c.reason).toBe('Kane could not read the value (final_state keys: none; 0 non-url keys): not found');
  });

  it('passes on the expected value and treats an upload failure as a pass', () => {
    expect(classify({ ...base, kane: kane({ exitCode: 0, end: { status: 'passed', observed: '$18.00', summary: 'ok' } }) })).toMatchObject({
      verdict: 'PASS',
      observed: '$18.00',
      reason: 'ok',
    });
    expect(classify({ ...base, kane: kane({ exitCode: 1, end: { status: 'passed', observed: '$18.00' } }) }).verdict).toBe('PASS');
  });

  it('honours the verdict mode when Kane and the value disagree', () => {
    const disagree = kane({ end: { status: 'failed', observed: '$18.00' } });
    expect(classify({ ...base, kane: disagree }).verdict).toBe('SKIP');
    expect(classify({ ...base, kane: disagree }).reason).toContain('disagree');
    expect(classify({ ...base, mode: 'value-only', kane: disagree })).toMatchObject({ verdict: 'PASS', reason: 'stored $18.00' });
  });

  it('fails on the bad signature, establishes it in the bracket, and catches false passes', () => {
    expect(classify({ ...base, badValue: null, kane: kane({ end: { status: 'failed', observed: '$20.00', summary: 'Expected "$18.00" but observed "$20.00"' } }) })).toMatchObject({
      verdict: 'FAIL',
      observed: '$20.00',
      reason: 'Expected "$18.00" but observed "$20.00"',
    });
    expect(classify({ ...base, kane: kane({ end: { status: 'failed', observed: 'Total: $20.00' } }) }).verdict).toBe('FAIL');
    expect(classify({ ...base, kane: kane({ exitCode: 0, end: { status: 'passed', observed: '$20.00' } }) })).toMatchObject({
      verdict: 'FAIL',
      reason: 'Kane reported pass but stored $20.00: false pass caught (#239)',
    });
    expect(classify({ ...base, mode: 'value-only', kane: kane({ exitCode: 0, end: { status: 'passed', observed: '$20.00' } }) })).toMatchObject({
      verdict: 'FAIL',
      reason: 'stored $20.00, expected $18.00',
    });
  });

  it('skips a commit that shows a third value', () => {
    expect(classify({ ...base, kane: kane({ end: { status: 'failed', observed: '$19.00' } }) })).toMatchObject({
      verdict: 'SKIP',
      reason: "observed $19.00, differs from the bad ref's $20.00: not this bug",
      observed: '$19.00',
    });
  });

  it('maps verdicts to git bisect run exit codes', () => {
    expect([exitCodeFor('PASS'), exitCodeFor('FAIL'), exitCodeFor('SKIP'), exitCodeFor('ABORT')]).toEqual([0, 1, 125, 128]);
  });
});
