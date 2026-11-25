import fs from 'node:fs';
import type { Check } from './check.js';
import type { TemplateId, VerdictMode } from './kane-profile.js';
import type { Phase, VerdictKind } from './verdict.js';

export interface LedgerEntry {
  phase: Phase;
  label: string;
  commit: string;
  subject: string;
  verdict: VerdictKind;
  reason: string;
  observed: string | null;
  kaneRuns: number;
  creditsConsumed: number | null;
  testUrl: string | null;
  resultCode: string | null;
  durationMs: number;
  at: string;
}

export interface Session {
  version: 1;
  repoDir: string;
  sessionDir: string;
  worktreeDir: string;
  kaneCwd: string;
  ledgerPath: string;
  check: Check;
  template: TemplateId;
  verdictMode: VerdictMode;
  serve: string;
  setup: string | null;
  kaneCmd: string[];
  kaneTimeoutSec: number;
  readyTimeoutSec: number;
  setupTimeoutSec: number;
  maxRuns: number;
  runsUsed: number;
  badValue: string | null;
}

export interface HuntLog {
  entry(e: LedgerEntry): void;
  info(line: string): void;
}

export interface Limits {
  minBalance: number;
  maxRuns: number;
  maxFixAttempts: number;
  kaneTimeoutSec: number;
  agentTimeoutSec: number;
  readyTimeoutSec: number;
  setupTimeoutSec: number;
  keepSession: boolean;
}

function envNumber(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export function readLimits(env: NodeJS.ProcessEnv): Limits {
  return {
    minBalance: envNumber(env, 'FIRSTBAD_MIN_BALANCE', 500, 0),
    maxRuns: envNumber(env, 'FIRSTBAD_MAX_RUNS', 16, 0),
    maxFixAttempts: envNumber(env, 'FIRSTBAD_MAX_FIX_ATTEMPTS', 3, 1),
    kaneTimeoutSec: envNumber(env, 'FIRSTBAD_KANE_TIMEOUT_SEC', 300, 1),
    agentTimeoutSec: envNumber(env, 'FIRSTBAD_AGENT_TIMEOUT_SEC', 900, 1),
    readyTimeoutSec: envNumber(env, 'FIRSTBAD_READY_TIMEOUT_SEC', 30, 1),
    setupTimeoutSec: envNumber(env, 'FIRSTBAD_SETUP_TIMEOUT_SEC', 600, 1),
    keepSession: env.FIRSTBAD_KEEP_SESSION === '1',
  };
}

export function writeSession(file: string, s: Session): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, file);
}

export function readSession(file: string): Session {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Session;
}

export function appendLedger(file: string, e: LedgerEntry): void {
  fs.appendFileSync(file, JSON.stringify(e) + '\n');
}

export function readLedger(file: string): LedgerEntry[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as LedgerEntry);
}

export function stamp(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
