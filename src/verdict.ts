import { valuesMatch } from './check.js';
import type { VerdictMode } from './kane-profile.js';
import type { KaneRunResult } from './kane/runner.js';

export type VerdictKind = 'PASS' | 'FAIL' | 'SKIP' | 'ABORT';
export type Phase = 'bracket' | 'bisect' | 'confirm' | 'fix';

export interface StepOutcome {
  ok: boolean;
  detail: string;
}

export interface ClassifyInput {
  setup?: StepOutcome;
  ready?: StepOutcome;
  kane?: KaneRunResult;
  expected: string;
  badValue: string | null;
  mode: VerdictMode;
}

export interface Classification {
  verdict: VerdictKind;
  reason: string;
  observed: string | null;
  misphrased: boolean;
  emptyValue: boolean;
  retryable: boolean;
}

const AUTH_RE = /auth|log ?in|credential|unauthori[sz]ed|forbidden|\b401\b|\b403\b/i;

export function isAuthFailure(r: KaneRunResult): boolean {
  return r.exitCode === 2 && AUTH_RE.test([...r.stream.errors, r.stderrTail].join('\n'));
}

export function isTransient(r: KaneRunResult): boolean {
  return r.killed || r.terminalMode || r.stream.runEnd === null || r.exitCode === 3;
}

function transientReason(r: KaneRunResult): string {
  if (r.terminalMode) return 'Kane started in terminal mode (the first stdout line was not JSON)';
  if (r.killed) return 'Kane timed out (killed by the outer timer)';
  if (r.exitCode === 3) return 'Kane timed out or was cancelled (exit 3)';
  const detail = r.stream.errors[0] ?? r.stderrTail.split(/\r?\n/).find((l) => l.trim() !== '') ?? 'no run_end';
  return `Kane error (exit ${r.exitCode === null ? 'none' : String(r.exitCode)}): ${detail}`;
}

export function classify(i: ClassifyInput): Classification {
  const out = (verdict: VerdictKind, reason: string, extra: Partial<Classification> = {}): Classification => ({
    verdict,
    reason,
    observed: null,
    misphrased: false,
    emptyValue: false,
    retryable: false,
    ...extra,
  });
  if (i.setup !== undefined && !i.setup.ok) return out('SKIP', `setup failed (${i.setup.detail})`);
  if (i.ready !== undefined && !i.ready.ok) return out('SKIP', `page never loaded (${i.ready.detail})`);
  const k = i.kane;
  if (k === undefined) return out('SKIP', 'Kane did not run');
  if (k.spawnError !== null) {
    return out(
      'ABORT',
      k.spawnError === 'ENOENT' ? 'kane-cli not found (install it with npm install -g @testmuai/kane-cli)' : `could not start Kane (${k.spawnError})`,
    );
  }
  if (isAuthFailure(k)) return out('ABORT', 'Kane authentication failed — run kane-cli login');
  const end = k.stream.runEnd;
  if (end === null || isTransient(k)) return out('SKIP', transientReason(k), { retryable: true });
  const observed = end.observed.trim();
  const why = end.summary || end.oneLiner || end.reason;
  if (observed === '') {
    return out('SKIP', `Kane could not read the value${why ? `: ${why}` : ''}`, {
      misphrased: end.blamesTest,
      emptyValue: true,
      retryable: true,
    });
  }
  if (valuesMatch(observed, i.expected)) {
    if (i.mode === 'value-only') return out('PASS', `stored ${observed}`, { observed });
    if (end.status === 'passed') return out('PASS', why || `stored ${observed}`, { observed });
    return out('SKIP', `Kane and the stored value disagree (stored ${observed}, Kane said ${end.status || 'failed'}${why ? `: ${why}` : ''})`, {
      observed,
    });
  }
  if (i.badValue === null || valuesMatch(observed, i.badValue)) {
    if (i.mode === 'status+value' && end.status === 'passed') {
      return out('FAIL', `Kane reported pass but stored ${observed}: false pass caught (#239)`, { observed });
    }
    const fallback = `stored ${observed}, expected ${i.expected}`;
    return out('FAIL', i.mode === 'value-only' ? fallback : why || fallback, { observed });
  }
  return out('SKIP', `observed ${observed}, differs from the bad ref's ${i.badValue}: not this bug`, { observed });
}

export function exitCodeFor(v: VerdictKind): 0 | 1 | 125 | 128 {
  switch (v) {
    case 'PASS':
      return 0;
    case 'FAIL':
      return 1;
    case 'SKIP':
      return 125;
    case 'ABORT':
      return 128;
  }
}
