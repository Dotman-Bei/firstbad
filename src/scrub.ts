interface SecretPattern {
  name: string;
  re: RegExp;
}

const PATTERNS: SecretPattern[] = [
  { name: 'bearer', re: /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  { name: 'jwt', re: /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g },
  { name: 'key-value', re: /\b(access[_-]?key|api[_-]?key|apikey|token|secret|password)(["']?\s*[:=]\s*["']?)[^\s"',;[\]]{8,}/gi },
];

export function scrub(text: string): string {
  return text
    .replace(PATTERNS[0]!.re, 'Bearer [redacted]')
    .replace(PATTERNS[1]!.re, '[redacted]')
    .replace(PATTERNS[2]!.re, (_match: string, key: string, sep: string) => `${key}${sep}[redacted]`);
}

export function scrubDeep<T>(value: T): T {
  if (typeof value === 'string') return scrub(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item: unknown) => scrubDeep(item)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = scrubDeep(item);
    return out as unknown as T;
  }
  return value;
}

export function findSecrets(text: string): string[] {
  return PATTERNS.filter((p) => new RegExp(p.re.source, p.re.flags.replace('g', '')).test(text)).map((p) => p.name);
}
