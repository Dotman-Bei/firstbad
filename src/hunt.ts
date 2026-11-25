import { spawn as nodeSpawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCheck, type Check } from './check.js';
import { addWorktree, checkoutDetached, git, gitOut, isAncestor, removeWorktree, revParse, subjectOf, topLevel } from './git.js';
import { KANE_PROFILE, type TemplateId, type VerdictMode } from './kane-profile.js';
import { kaneBalance, kaneVersion, versionAtLeast } from './kane/runner.js';
import { ORACLE_MARK } from './oracle.js';
import { probe } from './probe.js';
import { readLedger, readLimits, readSession, stamp, writeSession, type HuntLog, type LedgerEntry, type Session } from './session.js';

export const MIN_KANE_VERSION = '0.10.9';

export class PreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreflightError';
  }
}

export interface PrepareOptions {
  repoDir: string;
  good: string;
  bad: string;
  check: Check;
  serve: string;
  setup: string | null;
  kaneCmd: string[];
  env: NodeJS.ProcessEnv;
  template?: TemplateId;
  verdictMode?: VerdictMode;
}

export interface Prepared {
  sessionPath: string;
  session: Session;
  balanceBefore: number | null;
  goodSha: string;
  badSha: string;
}

export type HuntStatus = 'confirmed' | 'unconfirmed' | 'nothing-to-hunt' | 'aborted';

export interface HuntResult {
  status: HuntStatus;
  message: string;
  culprit: { commit: string; subject: string } | null;
  parent: string | null;
  badValue: string | null;
  entries: LedgerEntry[];
}

// src/hunt.ts and dist/hunt.js both resolve this to <package root>/dist/oracle-bin.js.
export function defaultOracleCmd(): string[] {
  return [process.execPath, fileURLToPath(new URL('../dist/oracle-bin.js', import.meta.url))];
}

export async function prepareSession(o: PrepareOptions, log: HuntLog): Promise<Prepared> {
  const problems = validateCheck(o.check);
  if (problems.length > 0) throw new PreflightError(problems.join('; '));
  let repoDir: string;
  try {
    repoDir = await topLevel(o.repoDir);
  } catch {
    throw new PreflightError(`${o.repoDir} is not inside a git repository`);
  }
  let goodSha: string;
  let badSha: string;
  try {
    goodSha = await revParse(repoDir, o.good);
  } catch {
    throw new PreflightError(`--good ${o.good} does not name a commit`);
  }
  try {
    badSha = await revParse(repoDir, o.bad);
  } catch {
    throw new PreflightError(`--bad ${o.bad} does not name a commit`);
  }
  if (goodSha === badSha) throw new PreflightError('--good and --bad name the same commit');
  if (!(await isAncestor(repoDir, goodSha, badSha))) throw new PreflightError(`--good ${o.good} is not an ancestor of --bad ${o.bad}`);
  const limits = readLimits(o.env);
  const version = await kaneVersion(o.kaneCmd, o.env);
  if (version === null) throw new PreflightError('kane-cli was not found or did not run (install it: npm install -g @testmuai/kane-cli)');
  if (!versionAtLeast(version, MIN_KANE_VERSION)) {
    throw new PreflightError(`kane-cli ${version} is too old; firstbad needs ${MIN_KANE_VERSION} or later`);
  }
  const balanceBefore = await kaneBalance(o.kaneCmd, o.env);
  if (balanceBefore === null) log.info('warning: could not read kane-cli balance; continuing without the balance floor');
  else if (balanceBefore < limits.minBalance) {
    throw new PreflightError(`kane-cli balance ${balanceBefore} is below FIRSTBAD_MIN_BALANCE=${limits.minBalance}`);
  }
  const template = o.template ?? KANE_PROFILE.template;
  const verdictMode: VerdictMode = template === 'store-only' ? 'value-only' : (o.verdictMode ?? KANE_PROFILE.verdictMode);
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), `firstbad-${stamp()}-`));
  const kaneCwd = path.join(sessionDir, 'kane');
  fs.mkdirSync(kaneCwd);
  const worktreeDir = path.join(sessionDir, 'wt');
  await addWorktree(repoDir, worktreeDir, badSha);
  const session: Session = {
    version: 1,
    repoDir,
    sessionDir,
    worktreeDir,
    kaneCwd,
    ledgerPath: path.join(sessionDir, 'ledger.jsonl'),
    check: o.check,
    template,
    verdictMode,
    serve: o.serve,
    setup: o.setup,
    kaneCmd: o.kaneCmd,
    kaneTimeoutSec: limits.kaneTimeoutSec,
    readyTimeoutSec: limits.readyTimeoutSec,
    setupTimeoutSec: limits.setupTimeoutSec,
    maxRuns: limits.maxRuns,
    runsUsed: 0,
    badValue: null,
  };
  const sessionPath = path.join(sessionDir, 'session.json');
  writeSession(sessionPath, session);
  fs.writeFileSync(session.ledgerPath, '');
  return { sessionPath, session, balanceBefore, goodSha, badSha };
}

export function parseBisectOutput(output: string): { firstBad: string | null; candidates: string[] } {
  const m = /^([0-9a-f]{40}) is the first bad commit/m.exec(output);
  if (m !== null && m[1] !== undefined) return { firstBad: m[1], candidates: [] };
  if (/only 'skip'ped commits left to test/.test(output)) {
    const after = output.split(/The first bad commit could be any of:/)[1] ?? '';
    const candidates = [...after.matchAll(/^([0-9a-f]{40})\s*$/gm)].map((x) => x[1] ?? '').filter((x) => x !== '');
    return { firstBad: null, candidates };
  }
  return { firstBad: null, candidates: [] };
}

interface BisectRun {
  code: number | null;
  output: string;
  aborts: LedgerEntry[];
}

function runBisect(cwd: string, oracleArgv: string[], log: HuntLog): Promise<BisectRun> {
  return new Promise((resolve) => {
    const child = nodeSpawn('git', ['bisect', 'run', ...oracleArgv], { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    let pending = '';
    const aborts: LedgerEntry[] = [];
    const onLine = (line: string): void => {
      if (line.startsWith(ORACLE_MARK)) {
        try {
          const e = JSON.parse(line.slice(ORACLE_MARK.length)) as LedgerEntry;
          log.entry(e);
          if (e.verdict === 'ABORT') aborts.push(e);
        } catch {
          log.info(line);
        }
      } else if (line.startsWith('Bisecting:')) {
        log.info(line);
      }
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      pending += chunk;
      const parts = pending.split(/\r?\n/);
      pending = parts.pop() ?? '';
      for (const part of parts) onLine(part);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', (err: Error) => {
      output += `\n${err.message}`;
      resolve({ code: null, output, aborts });
    });
    child.on('close', (code: number | null) => {
      if (pending !== '') onLine(pending);
      resolve({ code, output, aborts });
    });
  });
}

export async function hunt(p: Prepared, log: HuntLog, oracleCmd: string[] = defaultOracleCmd()): Promise<HuntResult> {
  const sessionPath = p.sessionPath;
  const wt = p.session.worktreeDir;
  const done = (
    status: HuntStatus,
    message: string,
    culprit: { commit: string; subject: string } | null = null,
    parent: string | null = null,
  ): HuntResult => ({
    status,
    message,
    culprit,
    parent,
    badValue: readSession(sessionPath).badValue,
    entries: readLedger(p.session.ledgerPath),
  });

  await checkoutDetached(wt, p.badSha);
  const bad = await probe(sessionPath, { phase: 'bracket', label: 'bad ref', cwd: wt, commit: p.badSha, subject: await subjectOf(wt, p.badSha) });
  log.entry(bad.entry);
  if (bad.entry.verdict === 'ABORT') return done('aborted', bad.entry.reason);
  if (bad.entry.verdict === 'PASS') return done('nothing-to-hunt', 'nothing to hunt: the bad ref passes the check');
  if (bad.entry.verdict === 'SKIP') {
    if (bad.emptyValue) return done('aborted', `your check looks mis-phrased: Kane could not store the value (${bad.entry.reason})`);
    return done('aborted', `the bad ref cannot be tested: ${bad.entry.reason}`);
  }
  const withBad = readSession(sessionPath);
  withBad.badValue = bad.entry.observed;
  writeSession(sessionPath, withBad);

  await checkoutDetached(wt, p.goodSha);
  const good = await probe(sessionPath, { phase: 'bracket', label: 'good ref', cwd: wt, commit: p.goodSha, subject: await subjectOf(wt, p.goodSha) });
  log.entry(good.entry);
  if (good.entry.verdict === 'ABORT') return done('aborted', good.entry.reason);
  if (good.entry.verdict !== 'PASS') return done('aborted', `the good ref does not pass the check: ${good.entry.reason}`);

  let firstBad: string | null = null;
  let candidates: string[] = [];
  let abortReason: string | null = null;
  let runCode: number | null = null;
  try {
    const started = await gitOut(wt, ['bisect', 'start', p.badSha, p.goodSha]);
    log.info(started.split(/\r?\n/)[0] ?? 'bisect started');
    const run = await runBisect(wt, [...oracleCmd, '--session', sessionPath], log);
    runCode = run.code;
    const parsed = parseBisectOutput(run.output);
    firstBad = parsed.firstBad;
    candidates = parsed.candidates;
    abortReason = run.aborts[0]?.reason ?? null;
  } finally {
    await git(wt, ['bisect', 'reset']);
  }
  if (abortReason !== null) return done('aborted', abortReason);
  if (firstBad === null) {
    if (candidates.length > 0) {
      return done(
        'unconfirmed',
        `bisect could not decide: the first bad commit is one of ${candidates.map((c) => c.slice(0, 7)).join(', ')} (untestable commits sit between them)`,
      );
    }
    return done('aborted', `git bisect run did not name a first bad commit (exit ${runCode === null ? 'none' : String(runCode)})`);
  }

  const culprit = { commit: firstBad, subject: await subjectOf(wt, firstBad) };
  const parentSha = await revParse(wt, `${firstBad}^1`);
  log.info(`first bad commit: ${firstBad.slice(0, 7)} ${culprit.subject}; re-testing it and its parent`);
  await checkoutDetached(wt, firstBad);
  const c1 = await probe(sessionPath, { phase: 'confirm', label: 'culprit', cwd: wt, commit: firstBad, subject: culprit.subject });
  log.entry(c1.entry);
  if (c1.entry.verdict === 'ABORT') return done('aborted', c1.entry.reason, culprit, parentSha);
  await checkoutDetached(wt, parentSha);
  const c2 = await probe(sessionPath, { phase: 'confirm', label: 'parent', cwd: wt, commit: parentSha, subject: await subjectOf(wt, parentSha) });
  log.entry(c2.entry);
  if (c2.entry.verdict === 'ABORT') return done('aborted', c2.entry.reason, culprit, parentSha);
  if (c1.entry.verdict === 'FAIL' && c2.entry.verdict === 'PASS') {
    return done('confirmed', `first bad commit: ${firstBad.slice(0, 7)} ${culprit.subject} (confirmed: culprit FAIL, parent PASS)`, culprit, parentSha);
  }
  return done(
    'unconfirmed',
    `bisect named ${firstBad.slice(0, 7)} ${culprit.subject}, but re-testing gave culprit ${c1.entry.verdict} and parent ${c2.entry.verdict}`,
    culprit,
    parentSha,
  );
}

export async function cleanupSession(sessionPath: string, keep = false): Promise<void> {
  let s: Session;
  try {
    s = readSession(sessionPath);
  } catch {
    return;
  }
  if (fs.existsSync(s.worktreeDir)) await git(s.worktreeDir, ['bisect', 'reset']);
  await removeWorktree(s.repoDir, s.worktreeDir);
  if (!keep) fs.rmSync(s.sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
