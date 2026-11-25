import { runSetup, startServer, urlResponds, waitDown, waitReady } from './app/serve.js';
import { composeObjective } from './check.js';
import { runKane, type KaneRunResult } from './kane/runner.js';
import { appendLedger, readSession, writeSession, type LedgerEntry } from './session.js';
import { classify, type Classification, type Phase, type VerdictKind } from './verdict.js';

export const KANE_MAX_STEPS = 25;

export interface ProbeTarget {
  phase: Phase;
  label: string;
  cwd: string;
  commit: string;
  subject: string;
}

export interface ProbeResult {
  entry: LedgerEntry;
  misphrased: boolean;
  emptyValue: boolean;
}

interface Outcome {
  verdict: VerdictKind;
  reason: string;
  observed: string | null;
  misphrased?: boolean;
  emptyValue?: boolean;
}

export async function probe(sessionPath: string, t: ProbeTarget): Promise<ProbeResult> {
  const started = Date.now();
  const first = readSession(sessionPath);
  let kaneRuns = 0;
  let credits: number | null = null;
  let last: KaneRunResult | undefined;
  const finish = (c: Outcome): ProbeResult => {
    const end = last?.stream.runEnd ?? null;
    const entry: LedgerEntry = {
      phase: t.phase,
      label: t.label,
      commit: t.commit,
      subject: t.subject,
      verdict: c.verdict,
      reason: c.reason,
      observed: c.observed,
      kaneRuns,
      creditsConsumed: credits,
      testUrl: end?.testUrl ?? null,
      resultCode: end?.resultCode ?? null,
      durationMs: Date.now() - started,
      at: new Date().toISOString(),
    };
    appendLedger(first.ledgerPath, entry);
    return { entry, misphrased: c.misphrased ?? false, emptyValue: c.emptyValue ?? false };
  };
  const common = { expected: first.check.expected, badValue: first.badValue, mode: first.verdictMode };

  if (first.setup !== null) {
    const setup = await runSetup(first.setup, t.cwd, first.setupTimeoutSec * 1000);
    if (!setup.ok) return finish(classify({ ...common, setup }));
  }
  if (await urlResponds(first.check.url)) {
    return finish({ verdict: 'ABORT', reason: `port busy: something is already serving ${first.check.url}; stop it or choose another port`, observed: null });
  }
  const server = startServer(first.serve, t.cwd);
  try {
    const ready = await waitReady(first.check.url, server, first.readyTimeoutSec * 1000);
    if (!ready.ok) return finish(classify({ ...common, ready }));
    let c: Classification | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const s = readSession(sessionPath);
      if (s.runsUsed >= s.maxRuns) return finish({ verdict: 'ABORT', reason: `run cap reached (FIRSTBAD_MAX_RUNS=${s.maxRuns})`, observed: null });
      s.runsUsed += 1;
      writeSession(sessionPath, s);
      kaneRuns += 1;
      last = await runKane({
        kaneCmd: s.kaneCmd,
        objective: composeObjective(s.check, s.template),
        timeoutSec: s.kaneTimeoutSec,
        maxSteps: KANE_MAX_STEPS,
        cwd: s.kaneCwd,
        label: `${t.phase}|${t.label}|${t.subject}`,
      });
      const spent = last.stream.runEnd?.creditsConsumed;
      if (typeof spent === 'number') credits = Math.round(((credits ?? 0) + spent) * 100) / 100;
      c = classify({ ...common, kane: last });
      if (!c.retryable) break;
    }
    if (c === undefined) return finish({ verdict: 'SKIP', reason: 'Kane did not run', observed: null });
    return finish(c);
  } finally {
    await server.stop();
    await waitDown(first.check.url, 5000);
  }
}
