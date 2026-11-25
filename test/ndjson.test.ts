import { describe, expect, it } from 'vitest';
import { observedOf, parseKaneStream } from '../src/kane/ndjson.js';

const line = (o: Record<string, unknown>): string => JSON.stringify({ v: 1, ts: '2026-11-25T12:00:00Z', ...o });

describe('parseKaneStream', () => {
  it('keeps only allow-listed run_end fields and counts steps', () => {
    const stdout = [
      line({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' }),
      'not json at all',
      line({ step: 1, status: 'running', remark: 'open' }),
      line({ step: 1, status: 'done', remark: 'open' }),
      line({ step: 2, status: 'failed', remark: 'assert' }),
      line({ type: 'warning', code: 'unresolved_variables' }),
      line({ type: 'error', message: 'Chrome CDP not ready' }),
      line({
        type: 'run_end',
        status: 'failed',
        summary: 'Expected "$18.00" but observed "$20.00"',
        one_liner: 'Total wrong',
        reason: { code: 'assertion_error.checkpoint_failed' },
        duration: '12.5',
        credits: 15.2,
        final_state: { observed: '$20.00', other: 'x' },
        context: { header: 'Authorization: Bearer stubsecret1234567890' },
        session_dir: '/tmp/stub-session-dir',
        test_url: 'https://tm.example.invalid/t/1',
        result_code: 720,
        triage: { category: 'automation_bug' },
      }),
    ].join('\n');
    const s = parseKaneStream(stdout);
    expect(s.firstLineIsJson).toBe(true);
    expect(s.streamStart).toBe(true);
    expect(s.cliVersion).toBe('0.10.9');
    expect(s.stepsDone).toBe(1);
    expect(s.stepsFailed).toBe(1);
    expect(s.errors).toEqual(['Chrome CDP not ready']);
    expect(s.runEnd).not.toBeNull();
    expect(s.runEnd?.status).toBe('failed');
    expect(s.runEnd?.observed).toBe('$20.00');
    expect(s.runEnd?.creditsConsumed).toBe(15.2);
    expect(s.runEnd?.durationSec).toBe(12.5);
    expect(s.runEnd?.resultCode).toBe('720');
    expect(s.runEnd?.reason).toContain('assertion_error.checkpoint_failed');
    expect(s.runEnd?.blamesTest).toBe(true);
    expect(s.runEnd?.testUrl).toBe('https://tm.example.invalid/t/1');
    const json = JSON.stringify(s);
    expect(json).not.toContain('stubsecret');
    expect(json).not.toContain('session_dir');
    expect(json).not.toContain('stub-session-dir');
  });

  it('reads test_md_done and reports prose or empty output', () => {
    const s = parseKaneStream(line({ type: 'test_md_done', overall_status: 'passed', duration_s: 4.2 }));
    expect(s.testMdDone).toEqual({ overallStatus: 'passed', durationSec: 4.2 });
    expect(parseKaneStream('Welcome to KaneAI\n' + line({ type: 'stream_start' })).firstLineIsJson).toBe(false);
    expect(parseKaneStream('').lines).toBe(0);
  });

  it('falls back to a single stored key and ignores ambiguous final states', () => {
    expect(observedOf({ observed: ' $18.00 ' })).toBe('$18.00');
    expect(observedOf({ total: 18 })).toBe('18');
    expect(observedOf({ a: 1, b: 2 })).toBe('');
    expect(observedOf({})).toBe('');
    expect(observedOf(null)).toBe('');
    expect(observedOf('x')).toBe('');
  });
});
