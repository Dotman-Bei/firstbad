import type { TemplateId } from './kane-profile.js';

export interface Check {
  url: string;
  do: string;
  store: string;
  expected: string;
}

function clean(s: string): string {
  return s.trim().replace(/[.,\s]+$/u, '');
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// Spec section 3. Must stay identical to compose() in scripts/spike/run-spike.mjs.
export function composeObjective(c: Check, template: TemplateId): string {
  const url = c.url.trim();
  const d = clean(c.do);
  const st = clean(c.store);
  const ex = c.expected.trim();
  switch (template) {
    case 'commas-assert':
      return `Go to ${url}, ${d}, store ${st} as 'observed', then assert the stored observed value is "${ex}"`;
    case 'sentences-assert':
      return `Go to ${url}. ${capitalize(d)}. Store ${st} as 'observed'. Then assert that the stored observed value is "${ex}".`;
    case 'store-only':
      return `Go to ${url}, ${d}, then store ${st} as 'observed'`;
    default: {
      const unknown: never = template;
      throw new Error(`unknown template ${String(unknown)}`);
    }
  }
}

export function validateCheck(c: Check): string[] {
  const problems: string[] = [];
  if (!/^https?:\/\//i.test(c.url.trim())) problems.push('--url must start with http:// or https://');
  if (c.do.trim() === '') problems.push('--do must not be empty');
  if (c.store.trim() === '') problems.push('--store must not be empty');
  if (c.expected.trim() === '') problems.push('--expect must not be empty');
  const fields: Array<[string, string]> = [
    ['--url', c.url],
    ['--do', c.do],
    ['--store', c.store],
    ['--expect', c.expected],
  ];
  for (const [flag, value] of fields) if (value.includes('{{')) problems.push(`${flag} must not contain {{`);
  if (c.expected.includes('"')) problems.push('--expect must not contain a double quote');
  return problems;
}

export function normalizeValue(v: string): string {
  let s = v.trim().replace(/\s+/g, ' ').toLowerCase();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function numberTokens(s: string): number[] {
  const m = s.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/-?\d+(?:\.\d+)?/g);
  return m === null ? [] : m.map(Number);
}

export function valuesMatch(a: string, b: string): boolean {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  if (na === '' || nb === '') return false;
  if (na === nb) return true;
  const ta = numberTokens(na);
  const tb = numberTokens(nb);
  return ta.length === 1 && tb.length === 1 && ta[0] === tb[0];
}
