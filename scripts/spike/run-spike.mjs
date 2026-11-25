#!/usr/bin/env node
// LIVE: spends Kane credits. The firstbad spike re-run, attempt 2 (spec section 12): store-only on both pages.
// Carries forward the day-1 evidence (git show af63046:docs/spike/spike-result.json) and the first re-run
// attempt (docs/spike/rerun-1-stop.json), runs store-only on the $18.00 page and then the $20.00 page (one
// retry per page on an empty value, at most 4 Kane runs), and writes docs/spike/spike-result.json
// (spikeVersion 2, attempt 2) and docs/spike/kane-spike.md. The objective, the value matching and the
// final_state parsing are firstbad's own, imported from dist/ (run npm run build first). It rewrites
// src/kane-profile.ts only when store-only returned the value on both pages. Run it once.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import spawn from 'cross-spawn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RESULT_JSON = path.join(ROOT, 'docs', 'spike', 'spike-result.json');
const RESULT_MD = path.join(ROOT, 'docs', 'spike', 'kane-spike.md');
const CARRIED_JSON = path.join(ROOT, 'docs', 'spike', 'rerun-1-stop.json');
const PROFILE_TS = path.join(ROOT, 'src', 'kane-profile.ts');
const DIST_CHECK = path.join(ROOT, 'dist', 'check.js');
const DIST_NDJSON = path.join(ROOT, 'dist', 'kane', 'ndjson.js');
const PORT = 4199;
const PAGE_URL = `http://127.0.0.1:${PORT}/`;
const MIN_BALANCE = numberEnv('FIRSTBAD_MIN_BALANCE', 500);
const RERUN_CAP = 4;
const RERUN_MAX_RUNS = Math.min(numberEnv('FIRSTBAD_SPIKE_RERUN_MAX_RUNS', RERUN_CAP), RERUN_CAP);
const TIMEOUT_SEC = numberEnv('FIRSTBAD_KANE_TIMEOUT_SEC', 300);
const KANE = splitCommand(process.env.FIRSTBAD_KANE ?? 'kane-cli');
const ASSERT_TEMPLATES = ['commas-assert', 'sentences-assert'];
const CANDIDATE = 'store-only';
const PASS_PAGE = '$18.00';
const FAIL_PAGE = '$20.00';
const NEEDED_RUNS = 2;
const ATTEMPT = 2;
const DAY1_COMMIT = 'af63046';
const CHECK = {
  url: PAGE_URL,
  do: 'look at the order summary',
  store: 'the total amount shown next to the word Total',
  expected: '$18.00',
};
// composeObjective(CHECK, 'store-only') from dist/check.js must return exactly this (spec section 3).
const EXPECTED_OBJECTIVE = "Go to http://127.0.0.1:4199/, look at the order summary, then store the total amount shown next to the word Total in a variable named 'observed'";
const PARSER_RULE = "final_state.observed if present; else the one key other than url; two or more candidate keys give an empty value (retried once), never a guess";

function numberEnv(name, fallback) {
  const raw = process.env[name];
  const n = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function splitCommand(command) {
  const out = [];
  let cur = '';
  let quote = null;
  let has = false;
  for (const ch of command) {
    if (quote !== null) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has) {
        out.push(cur);
        cur = '';
        has = false;
      }
      continue;
    }
    cur += ch;
    has = true;
  }
  if (quote !== null) throw new Error(`unterminated quote in command: ${command}`);
  if (has) out.push(cur);
  return out;
}

function scrub(text) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[redacted]')
    .replace(/\b(access[_-]?key|api[_-]?key|apikey|token|secret|password)(["']?\s*[:=]\s*["']?)[^\s"',;[\]]{8,}/gi, '$1$2[redacted]')
    .replace(/\S*\.evidence\b/g, '[evidence path removed]');
}

function text(v) {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function parseBalance(out) {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(out);
  if (m === null) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function killTree(pid) {
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

function runProcess(argv, { cwd, env, input, timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);
    const finish = (code, spawnError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: timedOut ? null : code, stdout, stderr, timedOut, spawnError, wallSec: Math.round((Date.now() - started) / 100) / 10 });
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => finish(null, err.code ?? err.message));
    child.on('close', (code) => finish(code, null));
    if (input !== undefined && child.stdin) {
      child.stdin.on('error', () => undefined);
      child.stdin.end(input);
    }
  });
}

// observedFrom is firstbad's own final_state rule (src/kane/ndjson.ts), imported from dist/kane/ndjson.js.
function parseStream(stdout, observedFrom) {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  const out = { lines: lines.length, firstLineIsJson: false, streamStart: false, runEnd: null, testMdDone: null, errors: [] };
  lines.forEach((line, index) => {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof o !== 'object' || o === null || Array.isArray(o)) return;
    if (index === 0) out.firstLineIsJson = true;
    if (o.type === 'stream_start') {
      out.streamStart = true;
    } else if (o.type === 'run_end') {
      const finalState = o.final_state !== null && typeof o.final_state === 'object' && !Array.isArray(o.final_state) ? o.final_state : {};
      const found = observedFrom(o.final_state);
      out.runEnd = {
        status: text(o.status),
        summary: scrub(text(o.summary)).slice(0, 500),
        oneLiner: scrub(text(o.one_liner)).slice(0, 300),
        reason: scrub(text(o.reason)).slice(0, 500),
        resultCode: o.result_code === undefined || o.result_code === null ? null : text(o.result_code),
        creditsConsumed: typeof o.credits_consumed === 'number' ? o.credits_consumed : typeof o.credits === 'number' ? o.credits : null,
        durationSec: typeof o.duration === 'number' ? o.duration : null,
        finalStateKeys: Object.keys(finalState).slice(0, 10).map((k) => scrub(k)),
        observed: scrub(found.value).slice(0, 200),
        observedKey: found.key === null ? null : scrub(found.key).slice(0, 100),
        blamesTest: /automation_bug|config_issue/.test(line),
      };
    } else if (o.type === 'test_md_done') {
      out.testMdDone = { overallStatus: text(o.overall_status), durationSec: typeof o.duration_s === 'number' ? o.duration_s : null };
    } else if (o.type === 'error') {
      out.errors.push(scrub(text(o.message ?? o)).slice(0, 300));
    }
  });
  return out;
}

let pageTotal = PASS_PAGE;

function startPage() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Spike Shop</title></head>' +
          '<body><h1>Spike Shop</h1><section><h2>Order summary</h2>' +
          `<p>Total: <strong id="total">${pageTotal}</strong></p></section></body></html>`,
      );
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

// The key a run's value came from: the recorded observedKey, else the same rule applied to the recorded key names.
function keyOf(run) {
  const e = run.runEnd;
  if (e === null || e === undefined) return null;
  if (typeof e.observedKey === 'string') return e.observedKey;
  const keys = Array.isArray(e.finalStateKeys) ? e.finalStateKeys : [];
  if (keys.includes('observed')) return 'observed';
  const others = keys.filter((k) => k !== 'url');
  return others.length === 1 ? others[0] : null;
}

// The raw run_end fields the user asked to see when a run does not return the value.
function rawFields(rec) {
  if (rec.runEnd === null) {
    return `no run_end (exit ${rec.exitCode ?? 'killed'}, timedOut ${rec.timedOut}, spawnError ${rec.spawnError ?? 'none'}, errors ${JSON.stringify(rec.errors)})`;
  }
  const e = rec.runEnd;
  return (
    `run_end status=${e.status || '(empty)'}, reason=${JSON.stringify(e.reason)}, result_code=${e.resultCode ?? 'null'}, ` +
    `final_state keys=[${e.finalStateKeys.join(', ')}], observedKey=${e.observedKey ?? 'none'}, observed=${JSON.stringify(e.observed)}`
  );
}

function findRun(runs, template, page) {
  return runs.find((r) => r.kind === 'run' && r.template === template && r.page === page) ?? null;
}

function profileSource(p) {
  return [
    '// Written by the day-1 spike (scripts/spike/run-spike.mjs). Core code reads only KANE_PROFILE.',
    "export type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only';",
    "export type VerdictMode = 'status+value' | 'value-only';",
    "export type AgentPromptRoute = 'stdin' | 'arg';",
    '',
    'export interface KaneProfile {',
    '  template: TemplateId;',
    '  verdictMode: VerdictMode;',
    '  agentPromptRoute: AgentPromptRoute;',
    '  source: string;',
    '}',
    '',
    "export const TEMPLATE_IDS: readonly TemplateId[] = ['commas-assert', 'sentences-assert', 'store-only'];",
    '',
    'export const KANE_PROFILE: KaneProfile = {',
    `  template: '${p.template}',`,
    `  verdictMode: '${p.verdictMode}',`,
    `  agentPromptRoute: '${p.agentPromptRoute}',`,
    `  source: '${p.source}',`,
    '};',
    '',
  ].join('\n');
}

function renderMarkdown(r) {
  const d = r.decisions;
  const yes = (b) => (b ? 'yes' : 'no');
  const templateRows = r.templates.map((t) => `| \`${t.id}\` | ${t.status} | ${t.reason.replace(/\|/g, '/')} | ${t.evidence.join(', ') || '-'} |`);
  const runRows = r.runs.map(
    (run) =>
      `| ${run.id} | ${run.phase} | ${run.kind} | ${run.template ?? '-'} | ${run.page} | ${run.exitCode ?? 'killed'} | ${run.wallSec} | ` +
      `${run.testMdDone?.overallStatus || run.runEnd?.status || 'none'} | ${run.runEnd?.resultCode ?? '-'} | ` +
      `${run.runEnd ? `[${run.runEnd.finalStateKeys.join(', ')}]` : '-'} | ${keyOf(run) ?? '-'} | ${run.runEnd?.observed || '-'} | ` +
      `${run.runEnd?.creditsConsumed ?? '-'} |`,
  );
  const key = (page) => (r.observedKeys[page] === null ? 'none' : `\`${r.observedKeys[page]}\``);
  return [
    '# Kane day-1 spike',
    '',
    `- Re-run attempt ${r.attempt} at: ${r.ranAt} on ${r.platform}, node ${r.node}, kane-cli ${r.kaneVersion ?? 'unknown'} (day-1 runs carried from ${r.day1.ranAt}, commit ${DAY1_COMMIT}; attempt 1 carried from ${r.rerun1.ranAt})`,
    `- Selection rule: a template is accepted only if it stores the value on both the ${PASS_PAGE} page and the ${FAIL_PAGE} page`,
    `- Parser rule: ${r.parserRule}`,
    `- store-only objective: \`${r.objective}\``,
    `- Chosen objective template: ${d.chosenTemplate === null ? `none (${CANDIDATE} did not return the value on both pages; see Flags)` : `\`${d.chosenTemplate}\` (verdict mode \`${d.verdictMode}\`)`}`,
    `- Stored key per page (attempt ${r.attempt}): ${PASS_PAGE} page ${key(PASS_PAGE)}, ${FAIL_PAGE} page ${key(FAIL_PAGE)}`,
    `- Local http:// run_end well-formed: ${yes(d.localRunEndWellFormed)}`,
    `- Replay faithful: ${yes(d.replayFaithful)}; replay carries stored values: ${yes(d.replayHasValues)} (carried from day 1; the replay stretch task is not authored)`,
    `- Nested agent (claude -p, CLAUDECODE removed): ${r.nestedAgent.ok ? `ok via ${r.nestedAgent.route}` : 'failed on every route'} (carried from day 1, not re-run)`,
    `- Re-run attempt ${r.attempt} balance: before ${r.balance.before ?? 'unknown'}, after ${r.balance.after ?? 'unknown'}, delta ${r.balance.delta ?? 'unknown'} (sum of credits_consumed ${r.creditsConsumedSum}; ${r.kaneRuns} Kane runs, cap ${r.limits.rerunMaxRuns})`,
    `- Re-run attempt 1: ${r.rerun1.stop}; balance before ${r.rerun1.balance?.before ?? 'unknown'}, after ${r.rerun1.balance?.after ?? 'unknown'}, delta ${r.rerun1.balance?.delta ?? 'unknown'}`,
    `- Day-1 balance: before ${r.day1.balance?.before ?? 'unknown'}, after ${r.day1.balance?.after ?? 'unknown'}, delta ${r.day1.balance?.delta ?? 'unknown'}`,
    `- Mean wall-clock seconds per attempt-${r.attempt} Kane run: ${r.meanWallSec ?? 'n/a'}`,
    '',
    '## Templates',
    '',
    '| Template | Status | Why | Runs |',
    '|---|---|---|---|',
    ...templateRows,
    '',
    '## Runs',
    '',
    '| Run | Phase | Kind | Template | Page | Exit | Wall s | Status | result_code | final_state keys | Stored key | Observed | credits_consumed |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...runRows,
    '',
    '## Flags',
    '',
    ...(r.flags.length === 0 ? ['- none'] : r.flags.map((f) => `- ${f}`)),
    '',
  ].join('\n');
}

async function loadShared() {
  try {
    const check = await import(pathToFileURL(DIST_CHECK).href);
    const ndjson = await import(pathToFileURL(DIST_NDJSON).href);
    if (typeof check.composeObjective !== 'function' || typeof check.valuesMatch !== 'function' || typeof ndjson.observedFrom !== 'function') return null;
    return { composeObjective: check.composeObjective, valuesMatch: check.valuesMatch, observedFrom: ndjson.observedFrom };
  } catch {
    return null;
  }
}

function readDay1() {
  const r = spawnSync('git', ['show', `${DAY1_COMMIT}:docs/spike/spike-result.json`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

async function main() {
  if (fs.existsSync(RESULT_JSON)) {
    let current = null;
    try {
      current = JSON.parse(fs.readFileSync(RESULT_JSON, 'utf8'));
    } catch {
      console.error('spike: docs/spike/spike-result.json is not valid JSON; restore it from HEAD first; not spending credits');
      return 4;
    }
    if (current.spikeVersion === 2 && typeof current.attempt === 'number' && current.attempt >= ATTEMPT) {
      console.error(
        `spike: docs/spike/spike-result.json is already re-run attempt ${current.attempt}; another re-run needs the user's say-so and ` +
          'docs/spike/spike-result.json restored from HEAD first; not spending credits',
      );
      return 4;
    }
  }
  const shared = await loadShared();
  if (shared === null) {
    console.error('spike: dist/check.js or dist/kane/ndjson.js is missing or lacks composeObjective, valuesMatch or observedFrom; run npm run build first; not spending credits');
    return 4;
  }
  const { composeObjective, valuesMatch, observedFrom } = shared;
  const objective = composeObjective(CHECK, CANDIDATE);
  if (objective !== EXPECTED_OBJECTIVE) {
    console.error(`spike: dist/check.js composes ${JSON.stringify(objective)} for store-only, expected ${JSON.stringify(EXPECTED_OBJECTIVE)}; run npm run build first; not spending credits`);
    return 4;
  }
  const day1 = readDay1();
  if (day1 === null || day1.spikeVersion !== 1 || !Array.isArray(day1.runs)) {
    console.error(`spike: could not read the day-1 evidence (git show ${DAY1_COMMIT}:docs/spike/spike-result.json, spikeVersion 1); not spending credits`);
    return 4;
  }
  if (day1.nestedAgent?.ok !== true) {
    console.error('spike: the day-1 nested-agent smoke did not pass; it cannot be carried forward; not spending credits');
    return 4;
  }
  let rerun1 = null;
  try {
    rerun1 = JSON.parse(fs.readFileSync(CARRIED_JSON, 'utf8'));
  } catch {
    rerun1 = null;
  }
  if (rerun1 === null || rerun1.attempt !== 1 || !Array.isArray(rerun1.runs) || rerun1.runs.length !== 1 || rerun1.runs[0].id !== `select-${CANDIDATE}`) {
    console.error('spike: docs/spike/rerun-1-stop.json (the first re-run attempt) is missing or malformed; not spending credits');
    return 4;
  }
  const stored = (rec, value) => rec !== null && rec !== undefined && rec.runEnd !== null && rec.runEnd !== undefined && valuesMatch(rec.runEnd.observed, value);
  const day1Runs = day1.runs.map((run) => ({ ...run, phase: 'day-1' }));
  const rerun1Runs = rerun1.runs.map((run) => ({ ...run, phase: 're-run-1' }));

  // Template verdicts from the carried day-1 runs (no credits): an assertion-bearing template that lost the value
  // on the $20.00 page is eliminated, and so is any assertion-bearing template that shares that cause.
  const lost = ASSERT_TEMPLATES.map((t) => findRun(day1Runs, t, FAIL_PAGE)).find((rec) => rec !== null && !stored(rec, FAIL_PAGE)) ?? null;
  if (lost === null) {
    console.error(`spike: the day-1 evidence shows no assertion-bearing template losing the value on the ${FAIL_PAGE} page; the shared-cause elimination is unsupported; not spending credits`);
    return 4;
  }
  const eliminated = ASSERT_TEMPLATES.map((id) => {
    const pass = findRun(day1Runs, id, PASS_PAGE);
    const fail = findRun(day1Runs, id, FAIL_PAGE);
    if (fail !== null && !stored(fail, FAIL_PAGE)) {
      return {
        id,
        status: 'eliminated',
        reason:
          `${pass !== null && stored(pass, PASS_PAGE) ? `stored ${PASS_PAGE} on the ${PASS_PAGE} page (${pass.id}), but ` : ''}` +
          `on the ${FAIL_PAGE} page (${fail.id}) ${rawFields(fail)}: no stored value, so the bad ref's signature would be empty`,
        evidence: [pass?.id, fail.id].filter((x) => typeof x === 'string'),
      };
    }
    return {
      id,
      status: 'eliminated',
      reason: `not run: an assertion-bearing template shares the cause recorded in ${lost.id} (a failed assertion fails the page and loses the stored value)`,
      evidence: [lost.id],
    };
  });
  for (const t of eliminated) console.log(`spike: ${t.id} eliminated without a run: ${t.reason}`);
  console.log(`spike: attempt 1 carried: ${rerun1.stop}`);
  if (RERUN_MAX_RUNS < NEEDED_RUNS) {
    console.error(`spike: FIRSTBAD_SPIKE_RERUN_MAX_RUNS=${RERUN_MAX_RUNS} allows fewer than the ${NEEDED_RUNS} runs this re-run needs; not spending credits`);
    return 3;
  }

  const flags = [];
  const runs = [];
  const kaneCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-spike-'));
  const kaneEnv = { ...process.env, KANE_CLI_USER_AGENT: process.env.KANE_CLI_USER_AGENT || 'firstbad' };
  const before = await runProcess([...KANE, 'balance'], { cwd: kaneCwd, env: kaneEnv, timeoutMs: 60_000 });
  const balanceBefore = before.code === 0 ? parseBalance(before.stdout) : null;
  if (balanceBefore === null) {
    console.error('spike: could not read kane-cli balance; not spending credits');
    fs.rmSync(kaneCwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    return 3;
  }
  if (balanceBefore < MIN_BALANCE) {
    console.error(`spike: balance ${balanceBefore} is below FIRSTBAD_MIN_BALANCE=${MIN_BALANCE}; not spending credits`);
    fs.rmSync(kaneCwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    return 3;
  }
  console.log(`spike: balance before ${balanceBefore} (floor ${MIN_BALANCE})`);
  const versionRun = await runProcess([...KANE, '--version'], { cwd: kaneCwd, env: kaneEnv, timeoutMs: 60_000 });
  const versionMatch = /(\d+\.\d+\.\d+)/.exec(versionRun.stdout);
  const kaneVersion = versionMatch === null ? null : versionMatch[1];

  let kaneRuns = 0;
  const kaneRun = async (id, page) => {
    if (kaneRuns >= RERUN_MAX_RUNS) {
      flags.push(`run cap reached before ${id} (${RERUN_MAX_RUNS} Kane runs for this re-run)`);
      return null;
    }
    kaneRuns += 1;
    pageTotal = page;
    console.log(`spike: ${id} (run ${kaneRuns}/${RERUN_MAX_RUNS} of this re-run, page shows ${page}) ...`);
    const argv = [...KANE, 'run', objective, '--agent', '--headless', '--timeout', String(TIMEOUT_SEC), '--max-steps', '25'];
    const r = await runProcess(argv, { cwd: kaneCwd, env: kaneEnv, timeoutMs: (TIMEOUT_SEC + 60) * 1000 });
    const stream = parseStream(r.stdout, observedFrom);
    const record = {
      id,
      phase: `re-run-${ATTEMPT}`,
      kind: 'run',
      template: CANDIDATE,
      page,
      objective,
      exitCode: r.code,
      timedOut: r.timedOut,
      spawnError: r.spawnError,
      wallSec: r.wallSec,
      ...stream,
      stderrTail: scrub(r.stderr.split(/\r?\n/).filter((l) => !/evidence/i.test(l)).join('\n')).slice(-600),
    };
    if (!stream.firstLineIsJson && stream.lines > 0) flags.push(`${id}: the first stdout line was not JSON (terminal mode)`);
    runs.push(record);
    console.log(`spike: ${id} -> exit ${r.code}, ${r.wallSec} s, ${rawFields(record)}`);
    return record;
  };
  const empty = (rec) => rec.runEnd === null || rec.runEnd.observed === '';
  // One page: a run, and one retry only when the value came back empty (no run_end, or no usable final_state key).
  const runPage = async (base, page) => {
    const first = await kaneRun(base, page);
    if (first === null) return { rec: null, stop: `${CANDIDATE} was not run on the ${page} page (run cap)` };
    let rec = first;
    if (empty(first)) {
      console.log(`spike: ${base} returned no value; retrying once`);
      const retry = await kaneRun(`${base}-retry`, page);
      if (retry === null) return { rec, stop: `STOP: ${CANDIDATE} returned no value on the ${page} page (${base}) and the run cap left no retry: ${rawFields(first)}` };
      rec = retry;
    }
    if (empty(rec)) return { rec, stop: `STOP: ${CANDIDATE} returned no value on the ${page} page (${first.id}, then ${rec.id}): ${rawFields(rec)}` };
    if (!stored(rec, page)) return { rec, stop: `STOP: ${CANDIDATE} returned ${JSON.stringify(rec.runEnd.observed)} on the ${page} page (${rec.id}), not ${page}: ${rawFields(rec)}` };
    return { rec, stop: null };
  };

  const server = await startPage();
  let passRun = null;
  let failRun = null;
  let stopLine = null;
  try {
    const pass = await runPage(`rerun${ATTEMPT}-pass-page`, PASS_PAGE);
    passRun = pass.rec;
    stopLine = pass.stop;
    if (stopLine === null) {
      const fail = await runPage(`rerun${ATTEMPT}-fail-page`, FAIL_PAGE);
      failRun = fail.rec;
      stopLine = fail.stop;
    }
  } finally {
    server.close();
  }

  const after = await runProcess([...KANE, 'balance'], { cwd: kaneCwd, env: kaneEnv, timeoutMs: 60_000 });
  const balanceAfter = after.code === 0 ? parseBalance(after.stdout) : null;
  const wellFormed = passRun !== null && passRun.firstLineIsJson && passRun.streamStart && passRun.runEnd !== null;
  if (stopLine === null && !wellFormed) stopLine = `STOP: ${CANDIDATE} returned the values but the ${PASS_PAGE} page run_end was not well-formed: ${rawFields(passRun)}`;
  const accepted = stopLine === null;
  if (!accepted) flags.push(stopLine);
  const observedKeys = {
    [PASS_PAGE]: passRun?.runEnd?.observedKey ?? null,
    [FAIL_PAGE]: failRun?.runEnd?.observedKey ?? null,
  };
  for (const rec of [passRun, failRun]) {
    if (rec === null || rec.runEnd === null) continue;
    if (rec.runEnd.observedKey !== null && rec.runEnd.observedKey !== 'observed') {
      flags.push(`${rec.id}: Kane stored the value under '${rec.runEnd.observedKey}', not 'observed' (read by the one-other-key rule; firstbad still compares it with the expected and the bad ref's value)`);
    }
    if (rec.runEnd.status !== 'passed') {
      flags.push(`${rec.id}: Kane status was ${rec.runEnd.status || '(empty)'} with a store-only objective (value-only mode uses Kane's status only as an error signal)`);
    }
  }
  if (balanceAfter === null) flags.push('could not read kane-cli balance after the re-run');
  const templates = [
    ...eliminated,
    {
      id: CANDIDATE,
      status: accepted ? 'accepted' : 'rejected',
      reason: accepted
        ? `returned ${passRun.runEnd.observed} on the ${PASS_PAGE} page (${passRun.id}, key '${passRun.runEnd.observedKey}') and ${failRun.runEnd.observed} on the ${FAIL_PAGE} page (${failRun.id}, key '${failRun.runEnd.observedKey}') with the wording "in a variable named 'observed'"; attempt 1 (${rerun1Runs[0].id}, old wording and old parser) stored under '${keyOf(rerun1Runs[0]) ?? 'none'}'`
        : stopLine,
      evidence: [rerun1Runs[0].id, ...runs.map((r) => r.id)],
    },
  ];
  const decisions = {
    chosenTemplate: accepted ? CANDIDATE : null,
    verdictMode: 'value-only',
    agentPromptRoute: day1.decisions?.agentPromptRoute === 'arg' ? 'arg' : 'stdin',
    localRunEndWellFormed: wellFormed,
    replayFaithful: day1.decisions?.replayFaithful === true,
    replayHasValues: day1.decisions?.replayHasValues === true,
  };
  const wall = runs.map((r) => r.wallSec);
  const result = {
    spikeVersion: 2,
    attempt: ATTEMPT,
    ranAt: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
    node: process.version,
    kaneVersion,
    selectionRule: `a template is accepted only if it stores the value on both the ${PASS_PAGE} page and the ${FAIL_PAGE} page`,
    parserRule: PARSER_RULE,
    limits: { minBalance: MIN_BALANCE, rerunMaxRuns: RERUN_MAX_RUNS, timeoutSec: TIMEOUT_SEC },
    check: CHECK,
    objective,
    balance: {
      before: balanceBefore,
      after: balanceAfter,
      delta: balanceAfter !== null ? Math.round((balanceBefore - balanceAfter) * 10000) / 10000 : null,
      beforeRaw: scrub(before.stdout.trim().split(/\r?\n/)[0] ?? '').slice(0, 200),
    },
    kaneRuns,
    creditsConsumedSum: Math.round(runs.reduce((s, r) => s + (r.runEnd?.creditsConsumed ?? 0), 0) * 100) / 100,
    meanWallSec: wall.length === 0 ? null : Math.round((wall.reduce((a, b) => a + b, 0) / wall.length) * 10) / 10,
    observedKeys,
    day1: {
      commit: DAY1_COMMIT,
      ranAt: day1.ranAt ?? null,
      kaneVersion: day1.kaneVersion ?? null,
      limits: day1.limits ?? null,
      balance: day1.balance ?? null,
      creditsConsumedSum: day1.creditsConsumedSum ?? null,
      meanWallSec: day1.meanWallSec ?? null,
      recording: day1.recording ?? null,
      testmdHelp: day1.testmdHelp ?? '',
      decisions: day1.decisions ?? null,
      flags: Array.isArray(day1.flags) ? day1.flags : [],
    },
    rerun1: {
      ranAt: rerun1.ranAt ?? null,
      kaneVersion: rerun1.kaneVersion ?? null,
      objective: rerun1.objective ?? null,
      parser: rerun1.parser ?? null,
      balance: rerun1.balance ?? null,
      creditsConsumedSum: rerun1.creditsConsumedSum ?? null,
      stop: rerun1.stop ?? null,
    },
    nestedAgent: { ...day1.nestedAgent, carriedFrom: 'day-1' },
    templates,
    runs: [...day1Runs, ...rerun1Runs, ...runs],
    decisions,
    flags,
  };
  fs.mkdirSync(path.dirname(RESULT_JSON), { recursive: true });
  fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(RESULT_MD, renderMarkdown(result));
  if (accepted) {
    fs.writeFileSync(
      PROFILE_TS,
      profileSource({
        template: CANDIDATE,
        verdictMode: 'value-only',
        agentPromptRoute: decisions.agentPromptRoute,
        source: `day-1 spike re-run ${result.ranAt.slice(0, 10)}`,
      }),
    );
  }
  fs.rmSync(kaneCwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  console.log(`spike: stored key per page: ${PASS_PAGE} ${observedKeys[PASS_PAGE] ?? 'none'}, ${FAIL_PAGE} ${observedKeys[FAIL_PAGE] ?? 'none'}`);
  console.log(`spike: balance before ${balanceBefore}, after ${balanceAfter ?? 'unknown'}, delta ${result.balance.delta ?? 'unknown'} (${kaneRuns} Kane runs)`);
  console.log('spike: wrote docs/spike/spike-result.json and docs/spike/kane-spike.md');
  for (const f of flags) console.log(`spike flag: ${f}`);
  if (!accepted) {
    console.log('spike: src/kane-profile.ts left unchanged');
    return 1;
  }
  console.log(`spike: chose ${CANDIDATE} (verdict mode value-only); rewrote src/kane-profile.ts`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`spike: crashed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 2;
  },
);
