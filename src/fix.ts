import path from 'node:path';
import { buildFixPrompt, runAgent } from './agent.js';
import { branchExists, git, gitOut, statusPorcelain, subjectOf } from './git.js';
import type { HuntResult } from './hunt.js';
import { KANE_PROFILE, type AgentPromptRoute } from './kane-profile.js';
import { probe } from './probe.js';
import { readLimits, readSession, type HuntLog, type LedgerEntry } from './session.js';

export type FixStatus = 'verified' | 'unverified' | 'skipped';

export interface FixResult {
  status: FixStatus;
  route: 'agent' | 'revert' | null;
  branch: string | null;
  attempts: number;
  message: string;
  entries: LedgerEntry[];
}

export interface FixOptions {
  agentArgv: string[] | null;
  env: NodeJS.ProcessEnv;
  route?: AgentPromptRoute;
}

export function fixCommitMessage(store: string, culpritSha: string): string {
  return `fix: restore "${store}" regression from ${culpritSha.slice(0, 7)} (verified by Kane via firstbad)`;
}

async function freeBranchName(cwd: string, base: string): Promise<string> {
  if (!(await branchExists(cwd, base))) return base;
  for (let n = 2; n < 100; n += 1) {
    const name = `${base}-${n}`;
    if (!(await branchExists(cwd, name))) return name;
  }
  throw new Error(`no free branch name for ${base}`);
}

async function treeState(cwd: string): Promise<string> {
  const status = await statusPorcelain(cwd);
  const diff = await git(cwd, ['diff', 'HEAD']);
  return `${status}\n${diff.stdout}`;
}

async function discard(wt: string, branch: string, badSha: string): Promise<void> {
  await git(wt, ['reset', '--hard', '--quiet']);
  await git(wt, ['clean', '-fd', '--quiet']);
  await git(wt, ['checkout', '--detach', '--force', '--quiet', badSha]);
  await git(wt, ['branch', '-D', branch]);
}

export async function fix(sessionPath: string, h: HuntResult, badSha: string, o: FixOptions, log: HuntLog): Promise<FixResult> {
  const s = readSession(sessionPath);
  const wt = s.worktreeDir;
  const limits = readLimits(o.env);
  if (h.status !== 'confirmed' || h.culprit === null || h.badValue === null) {
    return { status: 'skipped', route: null, branch: null, attempts: 0, message: 'no confirmed culprit to fix', entries: [] };
  }
  const culprit = h.culprit;
  const badValue = h.badValue;
  const branch = await freeBranchName(wt, `firstbad/fix-${culprit.commit.slice(0, 7)}`);
  await gitOut(wt, ['checkout', '--force', '--quiet', '-b', branch, badSha]);
  const subject = await subjectOf(wt, badSha);
  const entries: LedgerEntry[] = [];

  const verify = async (label: string): Promise<LedgerEntry> => {
    const r = await probe(sessionPath, { phase: 'fix', label, cwd: wt, commit: badSha, subject });
    log.entry(r.entry);
    entries.push(r.entry);
    return r.entry;
  };

  const revert = async (why: string): Promise<FixResult> => {
    log.info(`${why}: reverting ${culprit.commit.slice(0, 7)} and proving the revert with Kane`);
    const rv = await git(wt, ['revert', '--no-commit', culprit.commit]);
    if (rv.code !== 0) {
      await git(wt, ['revert', '--abort']);
      await discard(wt, branch, badSha);
      return { status: 'unverified', route: 'revert', branch: null, attempts: 1, message: 'git revert of the culprit conflicts with later commits', entries };
    }
    const e = await verify('revert');
    if (e.verdict === 'PASS') return { status: 'verified', route: 'revert', branch, attempts: 1, message: 'Kane passed the reverted tree', entries };
    await discard(wt, branch, badSha);
    return { status: 'unverified', route: 'revert', branch: null, attempts: 1, message: `Kane did not pass the reverted tree: ${e.reason}`, entries };
  };

  if (o.agentArgv === null) return revert('no agent');
  const agentArgv = o.agentArgv;
  const culpritEntry = h.entries.find((e) => e.phase === 'confirm' && e.label === 'culprit') ?? h.entries.find((e) => e.verdict === 'FAIL');
  const kaneSummary = culpritEntry?.reason ?? '';
  const parentValue = h.entries.find((e) => e.phase === 'confirm' && e.label === 'parent')?.observed ?? null;
  const diff = (await gitOut(wt, ['show', '--format=fuller', culprit.commit])).split(/\r?\n/).slice(0, 300).join('\n');
  const failures: string[] = [];
  let lastState = await treeState(wt);

  for (let n = 1; n <= limits.maxFixAttempts; n += 1) {
    const prompt = buildFixPrompt({ check: s.check, badValue, culprit, parentValue, kaneSummary, culpritDiff: diff, attempt: n, previousFailures: failures });
    log.info(`fix attempt ${n}: handing Kane's failure to the agent (${path.basename(agentArgv[0] ?? 'agent')})`);
    const run = await runAgent(agentArgv, prompt, {
      cwd: wt,
      promptFile: path.join(s.sessionDir, `prompt-${n}.md`),
      timeoutMs: limits.agentTimeoutSec * 1000,
      route: o.route ?? KANE_PROFILE.agentPromptRoute,
      env: o.env,
    });
    if (run.notFound) return revert(`agent command not found (${agentArgv[0] ?? ''})`);
    if (run.timedOut) {
      failures.push(`attempt ${n}: the agent timed out`);
      continue;
    }
    const state = await treeState(wt);
    if (state === lastState) {
      const exit = run.exitCode !== 0 ? ` (exit ${run.exitCode === null ? 'none' : String(run.exitCode)})` : '';
      failures.push(`attempt ${n}: the agent made no change${exit}`);
      log.info(`fix attempt ${n}: the agent made no change`);
      continue;
    }
    lastState = state;
    const e = await verify(`fix attempt ${n}`);
    if (e.verdict === 'PASS') return { status: 'verified', route: 'agent', branch, attempts: n, message: `Kane passed the patched tree on attempt ${n}`, entries };
    if (e.verdict === 'ABORT') {
      await discard(wt, branch, badSha);
      return { status: 'unverified', route: 'agent', branch: null, attempts: n, message: e.reason, entries };
    }
    failures.push(`attempt ${n}: Kane said ${e.verdict}: ${e.reason}${e.observed === null ? '' : ` (stored ${e.observed})`}`);
  }
  await discard(wt, branch, badSha);
  return {
    status: 'unverified',
    route: 'agent',
    branch: null,
    attempts: limits.maxFixAttempts,
    message: `the agent did not produce a fix that Kane passes in ${limits.maxFixAttempts} attempts`,
    entries,
  };
}

export async function commitFix(sessionPath: string, message: string): Promise<string> {
  const s = readSession(sessionPath);
  const wt = s.worktreeDir;
  await gitOut(wt, ['add', '-A']);
  const name = (await git(wt, ['config', 'user.name'])).stdout.trim();
  const email = (await git(wt, ['config', 'user.email'])).stdout.trim();
  const ident = name !== '' && email !== '' ? [] : ['-c', 'user.name=firstbad', '-c', 'user.email=firstbad@localhost.invalid'];
  await gitOut(wt, [...ident, '-c', 'commit.gpgsign=false', 'commit', '--no-verify', '--quiet', '-m', message]);
  return gitOut(wt, ['rev-parse', 'HEAD']);
}
