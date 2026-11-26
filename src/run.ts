import path from 'node:path';
import type { Check } from './check.js';
import { commitFix, fix, fixCommitMessage, type FixResult } from './fix.js';
import { commonDir } from './git.js';
import { waitDown } from './app/serve.js';
import { PreflightError, cleanupSession, hunt, prepareSession, type CleanupReport, type Prepared } from './hunt.js';
import type { AgentPromptRoute, TemplateId, VerdictMode } from './kane-profile.js';
import { kaneBalance } from './kane/runner.js';
import { buildReport, formatTimelineLine, writeReport, type Report, type ReportInput } from './report.js';
import { readLedger, readLimits, readSession, stamp, type HuntLog } from './session.js';
import { killTrackedNow, reopenSpawns, stopTracked } from './util/proc.js';

export interface FlowOptions {
  repoDir: string;
  good: string;
  bad: string;
  check: Check;
  serve: string;
  setup: string | null;
  agentArgv: string[] | null;
  noFix: boolean;
  outDir: string | null;
  kaneCmd: string[];
  env: NodeJS.ProcessEnv;
  print: (line: string) => void;
  color: boolean;
  template?: TemplateId;
  verdictMode?: VerdictMode;
  promptRoute?: AgentPromptRoute;
  oracleCmd?: string[];
  objective?: string | null;
  // Tests inject these; the CLI uses the process itself.
  signals?: Pick<NodeJS.EventEmitter, 'on' | 'removeListener'>;
  exit?: (code: number) => void;
}

export interface FlowResult {
  exitCode: 0 | 1 | 3 | 130;
  report: Report | null;
  reportPaths: { md: string; json: string } | null;
  message: string;
}

export async function runFlow(o: FlowOptions): Promise<FlowResult> {
  const log: HuntLog = {
    entry: (e) => o.print(formatTimelineLine(e, o.color)),
    info: (line) => o.print(`  ${line}`),
  };
  let prepared: Prepared;
  try {
    prepared = await prepareSession(
      { repoDir: o.repoDir, good: o.good, bad: o.bad, check: o.check, serve: o.serve, setup: o.setup, kaneCmd: o.kaneCmd, env: o.env, template: o.template, verdictMode: o.verdictMode, objective: o.objective },
      log,
    );
  } catch (err) {
    if (err instanceof PreflightError) {
      o.print(`firstbad: ${err.message}`);
      return { exitCode: 3, report: null, reportPaths: null, message: err.message };
    }
    throw err;
  }
  const limits = readLimits(o.env);
  const signals = o.signals ?? process;
  const exit = o.exit ?? ((code: number) => process.exit(code));
  let interrupted = false;
  let cleanup: Promise<CleanupOutcome> | null = null;
  const cleanOnce = (close: boolean): Promise<CleanupOutcome> =>
    (cleanup ??= cleanupAll(prepared, limits.keepSession, close));
  const onSignal = (signal: NodeJS.Signals): void => {
    if (interrupted) {
      // A second interrupt must never hang: kill what is left without waiting and leave now.
      o.print('firstbad: interrupted again, exiting now; run "firstbad clean" to remove anything left behind');
      killTrackedNow();
      exit(130);
      return;
    }
    interrupted = true;
    o.print(`firstbad: interrupted (${signal}), stopping child processes, then removing the worktree and session`);
    const watchdog = setTimeout(() => {
      o.print('firstbad: cleanup did not finish within 30 s, exiting; run "firstbad clean" to remove anything left behind');
      killTrackedNow();
      exit(130);
    }, 30_000);
    watchdog.unref();
    void cleanOnce(true)
      .then(
        (r) => {
          for (const line of describeLeftovers(r, prepared.session.repoDir)) o.print(line);
        },
        (err: unknown) => o.print(`firstbad: cleanup failed: ${err instanceof Error ? err.message : String(err)}; run "firstbad clean"`),
      )
      .finally(() => {
        clearTimeout(watchdog);
        exit(130);
      });
  };
  for (const s of HANDLED_SIGNALS) signals.on(s, onSignal);
  const balance = prepared.balanceBefore === null ? 'unknown' : prepared.balanceBefore.toFixed(2);
  o.print(`firstbad: hunting "${o.check.store}" (expect ${o.check.expected}) from ${o.good} to ${o.bad}, balance ${balance} credits, cap ${limits.maxRuns} Kane runs`);
  try {
    const h = await hunt(prepared, log, o.oracleCmd);
    o.print(`firstbad: ${h.message}`);
    let fixResult: FixResult | null = null;
    let fixCommit: string | null = null;
    if (h.status === 'confirmed' && !o.noFix) {
      fixResult = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: o.agentArgv, env: o.env, route: o.promptRoute }, log);
    }
    const balanceAfter = await kaneBalance(o.kaneCmd, o.env);
    const session = readSession(prepared.sessionPath);
    const input: ReportInput = {
      check: o.check,
      refs: { good: o.good, bad: o.bad },
      hunt: h,
      fix: fixResult,
      fixCommit: null,
      timeline: readLedger(session.ledgerPath),
      runsUsed: session.runsUsed,
      balanceBefore: prepared.balanceBefore,
      balanceAfter,
    };
    if (fixResult !== null && fixResult.status === 'verified') {
      writeReport(session.worktreeDir, buildReport(input), 'firstbad-report');
      fixCommit = await commitFix(prepared.sessionPath, fixCommitMessage(o.check.store, h.culprit === null ? prepared.badSha : h.culprit.commit));
    }
    const report = buildReport({ ...input, fixCommit });
    const outDir = o.outDir ?? path.join(await commonDir(session.repoDir), 'firstbad', 'reports', stamp());
    const reportPaths = writeReport(outDir, report, 'report');
    if (fixResult !== null) {
      const branch = fixResult.branch === null ? '' : ` on branch ${fixResult.branch}`;
      const commit = fixCommit === null ? '' : ` (commit ${fixCommit.slice(0, 7)})`;
      o.print(`firstbad: fix ${fixResult.status}${branch}${commit}: ${fixResult.message}`);
    }
    o.print(`firstbad: ${report.cost.kaneRuns} Kane runs, ${report.cost.creditsConsumed} credits reported by Kane, balance delta ${report.cost.balanceDelta ?? 'unknown'}`);
    o.print(`firstbad: report ${reportPaths.md}`);
    const ok = h.status === 'confirmed' && (o.noFix || fixResult?.status === 'verified');
    if (interrupted) return { exitCode: 130, report: null, reportPaths: null, message: 'interrupted' };
    return { exitCode: ok ? 0 : 1, report, reportPaths, message: h.message };
  } catch (err) {
    // After an interrupt the flow unwinds through killed children and refused spawns; that is expected.
    if (interrupted) return { exitCode: 130, report: null, reportPaths: null, message: 'interrupted' };
    throw err;
  } finally {
    const r = await cleanOnce(false);
    for (const s of HANDLED_SIGNALS) signals.removeListener(s, onSignal);
    reopenSpawns();
    if (!interrupted) for (const line of describeLeftovers(r, prepared.session.repoDir)) o.print(line);
  }
}

// SIGINT: Ctrl+C (Windows delivers it through the console control handler when firstbad runs in a
// console). SIGBREAK: Ctrl+Break on Windows. SIGTERM: kill on POSIX (Windows never generates it).
// SIGHUP: terminal closed (on Windows, the console window closed).
const HANDLED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'];

interface CleanupOutcome extends CleanupReport {
  stillRunning: number[];
  portBusy: string | null;
}

async function cleanupAll(p: Prepared, keep: boolean, close: boolean): Promise<CleanupOutcome> {
  // Stop every process tree first: a server or Kane still running in the worktree keeps it busy.
  const stillRunning = await stopTracked({ close });
  const { leftovers } = await cleanupSession(p.sessionPath, keep, p.session);
  const url = p.session.check.url;
  const portBusy = (await waitDown(url, 3000)) ? null : url;
  return { leftovers, stillRunning, portBusy };
}

export function describeLeftovers(r: CleanupOutcome, repoDir: string): string[] {
  const win = process.platform === 'win32';
  const lines: string[] = [];
  for (const pid of r.stillRunning) {
    lines.push(`firstbad: could not stop process ${pid}; stop it with: ${win ? `taskkill /pid ${pid} /T /F` : `kill -9 -${pid}`}`);
  }
  if (r.portBusy !== null) {
    const port = portOf(r.portBusy);
    lines.push(
      `firstbad: something still answers at ${r.portBusy}; find it with: ${win ? `netstat -ano | findstr :${port}` : `lsof -i :${port}`}, then ${win ? 'taskkill /pid <pid> /T /F' : 'kill <pid>'}`,
    );
  }
  for (const dir of r.leftovers) {
    lines.push(`firstbad: could not remove ${dir}; once nothing holds it, run: firstbad clean --repo "${repoDir}"`);
  }
  return lines;
}

function portOf(url: string): string {
  try {
    const u = new URL(url);
    return u.port !== '' ? u.port : u.protocol === 'https:' ? '443' : '80';
  } catch {
    return '?';
  }
}
