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

function kaneResult(finalState: unknown, status = 'passed', store?: string): KaneRunResult {
  return {
    exitCode: 0,
    killed: false,
    terminalMode: false,
    spawnError: null,
    stream: parseKaneStream(stdoutWith(finalState, status), store),
    stderrTail: '',
    durationMs: 10,
  };
}

const URL = 'http://127.0.0.1:4173/';
const STORE = 'the total amount shown next to the word Total';
const LIVE = { url: URL, cart_total: '$18.00', discount_code: 'SAVE10' };

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

describe('observedFrom with the store phrase: several keys are chosen by name, never by value (decision 14)', () => {
  it('case 1: observed present wins over every other key', () => {
    expect(observedFrom({ ...LIVE, observed: '$20.00' }, STORE)).toEqual({ key: 'observed', value: '$20.00' });
  });

  it('case 2: one other key is used without a name match, as before', () => {
    expect(observedFrom({ url: URL, discount_code: 'SAVE10' }, STORE)).toEqual({ key: 'discount_code', value: 'SAVE10' });
    expect(observedFrom({ url: URL, total: '$18.00' }, STORE)).toEqual({ key: 'total', value: '$18.00' });
  });

  it('case 3: several keys, exactly one shares a word with the store phrase', () => {
    expect(observedFrom(LIVE, STORE)).toEqual({ key: 'cart_total', value: '$18.00' });
    expect(observedFrom({ url: URL, cartTotal: '$18.00', discountCode: 'SAVE10' }, STORE)).toEqual({ key: 'cartTotal', value: '$18.00' });
    expect(observedFrom({ 'CART-TOTAL': '$18.00', 'promo code': 'SAVE10' }, STORE)).toEqual({ key: 'CART-TOTAL', value: '$18.00' });
    expect(observedFrom({ subtotal: '$20.00', grand_total: '$18.00' }, STORE)).toEqual({ key: 'grand_total', value: '$18.00' });
  });

  it('case 4: several keys with no match, or several matches, give an empty value', () => {
    expect(observedFrom({ url: URL, price: '$18.00', discount_code: 'SAVE10' }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom({ url: URL, cart_total: '$18.00', total_amount: '$20.00' }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom({ url: URL, subtotal: '$20.00', discount: '$2.00' }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom(LIVE)).toEqual({ key: null, value: '' });
    expect(observedFrom(LIVE, '')).toEqual({ key: null, value: '' });
  });

  it('case 5: only url, or nothing, gives an empty value', () => {
    expect(observedFrom({ url: URL }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom({}, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom(null, STORE)).toEqual({ key: null, value: '' });
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

describe('the name-matched key in a run_end, and the key names on an empty value', () => {
  it('reads cart_total from the live final_state and records the key names only', () => {
    const end = parseKaneStream(stdoutWith(LIVE, 'passed'), STORE).runEnd;
    expect(end?.observed).toBe('$18.00');
    expect(end?.observedKey).toBe('cart_total');
    expect(end?.finalStateKeys).toEqual(['url', 'cart_total', 'discount_code']);
    expect(JSON.stringify(end?.finalStateKeys)).not.toContain('SAVE10');
  });

  it('judges the name-matched value against the expected and the bad value', () => {
    const live = (v: string): KaneRunResult => kaneResult({ ...LIVE, cart_total: v }, 'passed', STORE);
    expect(classify({ kane: live('$18.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' })).toMatchObject({ verdict: 'PASS', observed: '$18.00' });
    expect(classify({ kane: live('$20.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('FAIL');
    expect(classify({ kane: live('$7.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('SKIP');
  });

  it('names the keys and counts the non-url ones when no value is read', () => {
    const c = classify({ kane: kaneResult(LIVE), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(c).toMatchObject({ verdict: 'SKIP', emptyValue: true, retryable: true, observed: null });
    expect(c.reason).toBe('Kane could not read the value (final_state keys: url, cart_total, discount_code; 2 non-url keys): Read the amount shown next to Total');
    expect(c.reason).not.toContain('SAVE10');
    const none = classify({ kane: kaneResult({}), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(none.reason).toBe('Kane could not read the value (final_state keys: none; 0 non-url keys): Read the amount shown next to Total');
    const blank = classify({ kane: kaneResult({ url: URL, total: '' }), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(blank.reason).toContain('(final_state keys: url, total; 1 non-url key)');
  });
});
