import { scrub } from '../scrub.js';

export interface KaneRunEnd {
  status: string;
  summary: string;
  oneLiner: string;
  reason: string;
  creditsConsumed: number | null;
  observed: string;
  observedKey: string | null;
  finalStateKeys: string[];
  testUrl: string | null;
  resultCode: string | null;
  durationSec: number | null;
  blamesTest: boolean;
}

export interface KaneTestMdDone {
  overallStatus: string;
  durationSec: number | null;
}

export interface KaneStream {
  lines: number;
  firstLineIsJson: boolean;
  streamStart: boolean;
  cliVersion: string | null;
  runEnd: KaneRunEnd | null;
  testMdDone: KaneTestMdDone | null;
  errors: string[];
  stepsDone: number;
  stepsFailed: number;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

// Which final_state key holds the stored value (spec section 4): 'observed' when present; otherwise the only
// key other than 'url'; with two or more candidate keys, the one candidate whose name shares a word with the
// store phrase. No match, several matches or no store phrase give an empty value (retried once). A key is
// never chosen by its value.
export interface ObservedValue {
  key: string | null;
  value: string;
}

// Lowercase words of letters and digits: "the total amount shown next to the word Total" gives the, total, amount, ...
function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== '');
}

// A key name is first split at camelCase boundaries: cart_total, cartTotal and CART-TOTAL all give cart, total.
function keyWords(key: string): string[] {
  return words(key.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2').replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2'));
}

export function observedFrom(finalState: unknown, store?: string): ObservedValue {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return { key: null, value: '' };
  const record = finalState as Record<string, unknown>;
  const read = (key: string): ObservedValue => ({ key, value: text(record[key]).trim() });
  if ('observed' in record) return read('observed');
  const candidates = Object.keys(record).filter((k) => k !== 'url');
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only !== undefined) return read(only);
  if (candidates.length === 0 || store === undefined) return { key: null, value: '' };
  const phrase = new Set(words(store));
  const named = candidates.filter((k) => keyWords(k).some((w) => phrase.has(w)));
  const match = named.length === 1 ? named[0] : undefined;
  return match === undefined ? { key: null, value: '' } : read(match);
}

export function observedOf(finalState: unknown): string {
  return observedFrom(finalState).value;
}

// The final_state key names only, never their values (spec section 8): at most 30, each scrubbed and cut to 64 chars.
function keysOf(finalState: unknown): string[] {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return [];
  return Object.keys(finalState)
    .slice(0, 30)
    .map((k) => scrub(k).slice(0, 64));
}

function toRunEnd(o: Record<string, unknown>, line: string, store: string | undefined): KaneRunEnd {
  const found = observedFrom(o.final_state, store);
  return {
    status: text(o.status),
    summary: scrub(text(o.summary)).slice(0, 500),
    oneLiner: scrub(text(o.one_liner)).slice(0, 300),
    reason: scrub(text(o.reason)).slice(0, 500),
    creditsConsumed: num(o.credits_consumed) ?? num(o.credits),
    observed: scrub(found.value).slice(0, 200),
    observedKey: found.key === null ? null : scrub(found.key).slice(0, 64),
    finalStateKeys: keysOf(o.final_state),
    testUrl: typeof o.test_url === 'string' && o.test_url !== '' ? scrub(o.test_url) : null,
    resultCode: o.result_code === undefined || o.result_code === null ? null : text(o.result_code),
    durationSec: num(o.duration),
    blamesTest: /automation_bug|config_issue/.test(line),
  };
}

export function parseKaneStream(stdout: string, store?: string): KaneStream {
  const stream: KaneStream = {
    lines: 0,
    firstLineIsJson: false,
    streamStart: false,
    cliVersion: null,
    runEnd: null,
    testMdDone: null,
    errors: [],
    stepsDone: 0,
    stepsFailed: 0,
  };
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  stream.lines = lines.length;
  lines.forEach((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
    const o = parsed as Record<string, unknown>;
    if (index === 0) stream.firstLineIsJson = true;
    const type = typeof o.type === 'string' ? o.type : undefined;
    if (type === 'stream_start') {
      stream.streamStart = true;
      stream.cliVersion = typeof o.cli_version === 'string' ? o.cli_version : null;
    } else if (type === 'run_end') {
      stream.runEnd = toRunEnd(o, line, store);
    } else if (type === 'test_md_done') {
      stream.testMdDone = { overallStatus: text(o.overall_status), durationSec: num(o.duration_s) };
    } else if (type === 'error') {
      stream.errors.push(scrub(text(o.message ?? o.error ?? o)).slice(0, 500));
    } else if (type === undefined && 'step' in o) {
      if (o.status === 'done') stream.stepsDone += 1;
      else if (o.status === 'failed') stream.stepsFailed += 1;
    }
  });
  return stream;
}
