import { scrub } from '../scrub.js';

export interface KaneRunEnd {
  status: string;
  summary: string;
  oneLiner: string;
  reason: string;
  creditsConsumed: number | null;
  observed: string;
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
// key other than 'url'; two or more candidate keys give an empty value (retried once), never a guess between keys.
export interface ObservedValue {
  key: string | null;
  value: string;
}

export function observedFrom(finalState: unknown): ObservedValue {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return { key: null, value: '' };
  const record = finalState as Record<string, unknown>;
  if ('observed' in record) return { key: 'observed', value: text(record.observed).trim() };
  const candidates = Object.keys(record).filter((k) => k !== 'url');
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only === undefined) return { key: null, value: '' };
  return { key: only, value: text(record[only]).trim() };
}

export function observedOf(finalState: unknown): string {
  return observedFrom(finalState).value;
}

function toRunEnd(o: Record<string, unknown>, line: string): KaneRunEnd {
  return {
    status: text(o.status),
    summary: scrub(text(o.summary)).slice(0, 500),
    oneLiner: scrub(text(o.one_liner)).slice(0, 300),
    reason: scrub(text(o.reason)).slice(0, 500),
    creditsConsumed: num(o.credits_consumed) ?? num(o.credits),
    observed: scrub(observedOf(o.final_state)).slice(0, 200),
    testUrl: typeof o.test_url === 'string' && o.test_url !== '' ? scrub(o.test_url) : null,
    resultCode: o.result_code === undefined || o.result_code === null ? null : text(o.result_code),
    durationSec: num(o.duration),
    blamesTest: /automation_bug|config_issue/.test(line),
  };
}

export function parseKaneStream(stdout: string): KaneStream {
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
      stream.runEnd = toRunEnd(o, line);
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
