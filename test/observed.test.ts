import { describe, expect, it } from 'vitest';
import { observedFrom, observedOf, parseKaneStream } from '../src/kane/ndjson.js';
import type { KaneRunResult } from '../src/kane/runner.js';
import { classify } from '../src/verdict.js';

function stdoutWith(finalState: unknown, status: string): string {
  return [
    JSON.stringify({ v: 1, type: 'stream_start', cli_version: '0.10.9' }),
    JSON.stringify({
      v: 1,
      type: 'run_end',
      status,
      summary: 'Read the amount shown next to Total',
      reason: 'Objective completed',
      result_code: 100,
      final_state: finalState,
    }),
  ].join('\n');
}

function kaneResult(finalState: unknown, status = 'passed'): KaneRunResult {
  return {
    exitCode: 0,
    killed: false,
    terminalMode: false,
    spawnError: null,
    stream: parseKaneStream(stdoutWith(finalState, status)),
    stderrTail: '',
    durationMs: 10,
  };
}

const URL = 'http://127.0.0.1:4173/';

describe('observedFrom: which final_state key holds the stored value', () => {
  it('uses final_state.observed when it is present, even next to other keys', () => {
    expect(observedFrom({ url: URL, observed: ' $18.00 ' })).toEqual({ key: 'observed', value: '$18.00' });
    expect(observedFrom({ observed: '$20.00', total: '$18.00' })).toEqual({ key: 'observed', value: '$20.00' });
  });

  it('uses the one key other than url when observed is missing', () => {
    expect(observedFrom({ url: URL, total: '$18.00' })).toEqual({ key: 'total', value: '$18.00' });
    expect(observedFrom({ total: 18 })).toEqual({ key: 'total', value: '18' });
    expect(observedOf({ url: URL, total: '$18.00' })).toBe('$18.00');
  });

  it('treats several candidate keys, or none, as an empty value and never guesses', () => {
    expect(observedFrom({ url: URL, total: '$18.00', subtotal: '$20.00' })).toEqual({ key: null, value: '' });
    expect(observedFrom({ url: URL })).toEqual({ key: null, value: '' });
    expect(observedFrom({})).toEqual({ key: null, value: '' });
    expect(observedFrom(null)).toEqual({ key: null, value: '' });
    expect(observedFrom(['$18.00'])).toEqual({ key: null, value: '' });
    expect(observedOf({ a: '$18.00', b: '$20.00' })).toBe('');
  });
});

describe('a value read from another key still goes through the verdict rule', () => {
  it('parses run_end.observed from the single other key', () => {
    expect(parseKaneStream(stdoutWith({ url: URL, total: '$20.00' }, 'passed')).runEnd?.observed).toBe('$20.00');
  });

  it('compares it with the expected value and with the bad ref value', () => {
    const total = (v: string): KaneRunResult => kaneResult({ url: URL, total: v });
    expect(classify({ kane: total('$18.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('PASS');
    expect(classify({ kane: total('$20.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('FAIL');
    const third = classify({ kane: total('$7.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' });
    expect(third.verdict).toBe('SKIP');
    expect(third.reason).toContain("differs from the bad ref's $20.00");
  });

  it('keeps a status/value disagreement a SKIP', () => {
    const c = classify({ kane: kaneResult({ url: URL, total: '$18.00' }, 'failed'), expected: '$18.00', badValue: '$20.00', mode: 'status+value' });
    expect(c.verdict).toBe('SKIP');
    expect(c.reason).toContain('Kane and the stored value disagree');
  });

  it('retries several candidate keys like any empty value', () => {
    const c = classify({ kane: kaneResult({ url: URL, total: '$18.00', subtotal: '$20.00' }), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(c.verdict).toBe('SKIP');
    expect(c.emptyValue).toBe(true);
    expect(c.retryable).toBe(true);
  });
});
