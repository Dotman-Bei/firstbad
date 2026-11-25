import { describe, expect, it } from 'vitest';
import { composeObjective, normalizeValue, validateCheck, valuesMatch, type Check } from '../src/check.js';

const CHECK: Check = {
  url: 'http://127.0.0.1:4173/',
  do: 'add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply.',
  store: 'the total amount shown next to the word Total',
  expected: '$18.00',
};

describe('composeObjective', () => {
  it('builds the three cookbook-style candidates exactly and never emits {{', () => {
    expect(composeObjective(CHECK, 'commas-assert')).toBe(
      "Go to http://127.0.0.1:4173/, add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply, store the total amount shown next to the word Total as 'observed', then assert the stored observed value is \"$18.00\"",
    );
    expect(composeObjective(CHECK, 'sentences-assert')).toBe(
      "Go to http://127.0.0.1:4173/. Add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply. Store the total amount shown next to the word Total as 'observed'. Then assert that the stored observed value is \"$18.00\".",
    );
    expect(composeObjective(CHECK, 'store-only')).toBe(
      "Go to http://127.0.0.1:4173/, add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply, then store the total amount shown next to the word Total in a variable named 'observed'",
    );
    for (const t of ['commas-assert', 'sentences-assert', 'store-only'] as const) {
      expect(composeObjective(CHECK, t)).not.toContain('{{');
    }
  });
});

describe('validateCheck', () => {
  it('accepts a good check and lists every problem of a bad one', () => {
    expect(validateCheck(CHECK)).toEqual([]);
    const problems = validateCheck({ url: 'localhost:4173', do: ' ', store: 'the {{total}}', expected: 'say "hi"' });
    expect(problems).toEqual([
      '--url must start with http:// or https://',
      '--do must not be empty',
      '--store must not contain {{',
      '--expect must not contain a double quote',
    ]);
    expect(validateCheck({ ...CHECK, expected: '' })).toEqual(['--expect must not be empty']);
  });
});

describe('valuesMatch', () => {
  it('matches equal text and equal single numbers only', () => {
    expect(normalizeValue('  "$18.00"  ')).toBe('$18.00');
    expect(valuesMatch('$18.00', '$18.00')).toBe(true);
    expect(valuesMatch('Total: $18.00', '$18.00')).toBe(true);
    expect(valuesMatch('18.00', '$18.00')).toBe(true);
    expect(valuesMatch('$18', '$18.00')).toBe(true);
    expect(valuesMatch('$1,250.00', '1250')).toBe(true);
    expect(valuesMatch('$20.00', '$18.00')).toBe(false);
    expect(valuesMatch('2 items for $18.00', '$18.00')).toBe(false);
    expect(valuesMatch('', '$18.00')).toBe(false);
    expect(valuesMatch('Example Domain', 'example   domain')).toBe(true);
  });
});
