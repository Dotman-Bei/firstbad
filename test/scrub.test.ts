import { describe, expect, it } from 'vitest';
import { findSecrets, scrub, scrubDeep } from '../src/scrub.js';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdHViIn0.c2lnbmF0dXJlLXN0dWI';

describe('scrub', () => {
  it('redacts bearer tokens, JWT-shaped strings and key=value secrets', () => {
    expect(scrub(`Authorization: Bearer ${JWT}`)).toBe('Authorization: Bearer [redacted]');
    expect(scrub(`token ${JWT} end`)).toBe('token [redacted] end');
    expect(scrub('access_key=abcd1234efgh5678')).toBe('access_key=[redacted]');
    expect(scrub('{"password": "hunter2hunter2"}')).toBe('{"password": "[redacted]"}');
    expect(scrub('total $18.00')).toBe('total $18.00');
  });

  it('scrubs nested strings and finds nothing afterwards', () => {
    const out = scrubDeep({ a: ['Bearer abcdefgh12345678'], b: { c: 'secret: s3cr3tvalue99' }, n: 3, z: null });
    expect(out).toEqual({ a: ['Bearer [redacted]'], b: { c: 'secret: [redacted]' }, n: 3, z: null });
    expect(findSecrets(JSON.stringify(out))).toEqual([]);
    expect(findSecrets('Bearer abcdefgh12345678')).toEqual(['bearer']);
    expect(findSecrets(JWT)).toEqual(['jwt']);
    expect(findSecrets('api_key: zzzzzzzzzzzz')).toEqual(['key-value']);
  });
});
