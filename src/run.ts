import path from 'node:path';
import type { Check } from './check.js';
import { commitFix, fix, fixCommitMessage, type FixResult } from './fix.js';
import { commonDir } from './git.js';
import { PreflightError, cleanupSession, hunt, prepareSession, type Prepared } from './hunt.js';
import type { AgentPromptRoute, TemplateId, VerdictMode } from './kane-profile.js';
import { kaneBalance } from './kane/runner.js';
import { buildReport, formatTimelineLine, writeReport, type Report, type ReportInput } from './report.js';
import { readLedger, readLimits, readSession, stamp, type HuntLog } from './session.js';

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
}

export interface FlowResult {
  exitCode: 0 | 1 | 3;
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
      { repoDir: o.repoDir, good: o.good, bad: o.bad, check: o.check, serve: o.serve, setup: o.setup, kaneCmd: o.kaneCmd, env: o.env, template: o.template, verdictMode: o.verdictMode },
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
    return { exitCode: ok ? 0 : 1, report, reportPaths, message: h.message };
  } finally {
    await cleanupSession(prepared.sessionPath, limits.keepSession);
  }
}
