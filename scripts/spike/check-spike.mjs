#!/usr/bin/env node
// Offline gate for the spike (Tasks 2 and 2.1): validates what scripts/spike/run-spike.mjs wrote (re-run attempt 2). Never calls Kane.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RESULT_JSON = path.join(ROOT, 'docs', 'spike', 'spike-result.json');
const RESULT_MD = path.join(ROOT, 'docs', 'spike', 'kane-spike.md');
const CARRIED_JSON = path.join(ROOT, 'docs', 'spike', 'rerun-1-stop.json');
const PROFILE_TS = path.join(ROOT, 'src', 'kane-profile.ts');
const PASS_PAGE = '$18.00';
const FAIL_PAGE = '$20.00';
const RERUN_CAP = 4;
const DAY1_IDS = ['select-commas-assert', 'fail-page-commas-assert', 'replay-fail-page', 'replay-pass-page'];
const EXPECTED_OBJECTIVE = "Go to http://127.0.0.1:4199/, look at the order summary, then store the total amount shown next to the word Total in a variable named 'observed'";
const SECRET = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/,
  /\b(access[_-]?key|api[_-]?key|apikey|token|secret|password)["']?\s*[:=]\s*["']?[^\s"',;[\]]{8,}/i,
];

function normalizeValue(v) {
  let s = v.trim().replace(/\s+/g, ' ').toLowerCase();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) s = s.slice(1, -1).trim();
  return s;
}

function numberTokens(s) {
  const m = s.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/-?\d+(?:\.\d+)?/g);
  return m === null ? [] : m.map(Number);
}

function valuesMatch(a, b) {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  if (na === '' || nb === '') return false;
  if (na === nb) return true;
  const ta = numberTokens(na);
  const tb = numberTokens(nb);
  return ta.length === 1 && tb.length === 1 && ta[0] === tb[0];
}

function storingRun(runs, page) {
  return (
    runs.find(
      (run) =>
        run.kind === 'run' &&
        run.template === 'store-only' &&
        run.page === page &&
        typeof run.runEnd?.observed === 'string' &&
        valuesMatch(run.runEnd.observed, page),
    ) ?? null
  );
}

if (!fs.existsSync(RESULT_JSON)) {
  console.log('FAIL: docs/spike/spike-result.json not found (npm run build, then node scripts/spike/run-spike.mjs, once)');
  process.exit(1);
}
const problems = [];
const flags = [];
const raw = fs.readFileSync(RESULT_JSON, 'utf8');
const md = fs.existsSync(RESULT_MD) ? fs.readFileSync(RESULT_MD, 'utf8') : '';
const carriedRaw = fs.existsSync(CARRIED_JSON) ? fs.readFileSync(CARRIED_JSON, 'utf8') : '';
let r = null;
try {
  r = JSON.parse(raw);
} catch {
  problems.push('spike-result.json is not valid JSON');
}
let carried = null;
try {
  carried = JSON.parse(carriedRaw);
} catch {
  problems.push('docs/spike/rerun-1-stop.json is missing or not valid JSON');
}
if (carried !== null && (carried.attempt !== 1 || !Array.isArray(carried.runs) || carried.runs[0]?.id !== 'select-store-only')) {
  problems.push('docs/spike/rerun-1-stop.json is not the first re-run attempt (attempt 1, run select-store-only)');
}
if (r !== null) {
  const d = r.decisions ?? {};
  const runs = Array.isArray(r.runs) ? r.runs : [];
  const rerun = runs.filter((run) => run.phase === 're-run-2');
  if (r.spikeVersion !== 2 || r.attempt !== 2) {
    problems.push(`spike-result.json is spikeVersion ${r.spikeVersion}, attempt ${r.attempt ?? 'none'}; the second store-only re-run has not run (npm run build, then node scripts/spike/run-spike.mjs, once)`);
  }
  if (d.chosenTemplate !== 'store-only') problems.push(`the chosen template is ${d.chosenTemplate ?? 'none'}, not store-only`);
  if (d.verdictMode !== 'value-only') problems.push(`verdictMode is ${d.verdictMode}, expected value-only`);
  for (const page of [PASS_PAGE, FAIL_PAGE]) {
    const run = storingRun(rerun, page);
    if (run === null) {
      problems.push(`no attempt-2 store-only run returned ${page} on the ${page} page`);
    } else if (typeof run.runEnd.observedKey !== 'string' || run.runEnd.observedKey === '') {
      problems.push(`run ${run.id} does not record the final_state key it read (observedKey)`);
    } else if (r.observedKeys?.[page] !== run.runEnd.observedKey) {
      problems.push(`observedKeys[${page}] is ${r.observedKeys?.[page] ?? 'missing'}, but run ${run.id} read '${run.runEnd.observedKey}'`);
    }
  }
  for (const run of rerun) {
    if (run.objective !== EXPECTED_OBJECTIVE) problems.push(`run ${run.id} sent ${JSON.stringify(run.objective)}, not the store-only objective ${JSON.stringify(EXPECTED_OBJECTIVE)}`);
    if (run.runEnd !== null && run.runEnd !== undefined && !('observedKey' in run.runEnd)) problems.push(`run ${run.id} has no observedKey field`);
    if (typeof run.wallSec !== 'number') problems.push(`run ${run.id} has no wallSec`);
  }
  if (r.objective !== EXPECTED_OBJECTIVE) problems.push('spike-result.json does not record the store-only objective it sent');
  const cap = Math.min(typeof r.limits?.rerunMaxRuns === 'number' ? r.limits.rerunMaxRuns : RERUN_CAP, RERUN_CAP);
  if (rerun.length > cap) problems.push(`${rerun.length} attempt-2 Kane runs recorded, more than the cap ${cap}`);
  if (r.kaneRuns !== rerun.length) problems.push(`kaneRuns is ${r.kaneRuns}, but ${rerun.length} attempt-2 runs are recorded`);
  for (const id of DAY1_IDS) {
    if (!runs.some((run) => run.id === id && run.phase === 'day-1')) problems.push(`the day-1 run ${id} was not carried forward`);
  }
  if (!runs.some((run) => run.id === 'select-store-only' && run.phase === 're-run-1')) problems.push('the attempt-1 run select-store-only was not carried forward');
  const templates = Array.isArray(r.templates) ? r.templates : [];
  const status = (id) => templates.find((t) => t.id === id)?.status;
  if (status('store-only') !== 'accepted') problems.push('templates[] does not mark store-only accepted');
  for (const id of ['commas-assert', 'sentences-assert']) if (status(id) !== 'eliminated') problems.push(`templates[] does not mark ${id} eliminated`);
  if (d.localRunEndWellFormed !== true) problems.push('the local http:// run did not return a well-formed run_end');
  if (!['stdin', 'arg'].includes(d.agentPromptRoute)) problems.push('agentPromptRoute is missing');
  if (r.nestedAgent?.ok !== true) problems.push('the nested claude -p smoke failed on every route');
  if (typeof r.balance?.before !== 'number') problems.push('the balance before the re-run was not recorded');
  if (!md.startsWith('# Kane day-1 spike')) problems.push('docs/spike/kane-spike.md is missing or malformed');
  if (!md.includes('- Chosen objective template: `store-only` (verdict mode `value-only`)')) problems.push('docs/spike/kane-spike.md does not name store-only (value-only) as the chosen template');
  if (md.includes('Chosen objective template: `commas-assert`')) problems.push('docs/spike/kane-spike.md still names commas-assert as the chosen template');
  const profile = fs.readFileSync(PROFILE_TS, 'utf8');
  for (const [key, value] of [
    ['template', 'store-only'],
    ['verdictMode', 'value-only'],
    ['agentPromptRoute', d.agentPromptRoute],
  ]) {
    if (!profile.includes(`  ${key}: '${value}',`)) problems.push(`src/kane-profile.ts does not record ${key}: '${value}'`);
  }
  flags.push(`FLAG: stored key per page (attempt 2): ${PASS_PAGE} ${r.observedKeys?.[PASS_PAGE] ?? 'none'}, ${FAIL_PAGE} ${r.observedKeys?.[FAIL_PAGE] ?? 'none'}; attempt 1 used total (old wording)`);
  if (r.nestedAgent?.ok === true && r.nestedAgent.route !== 'stdin') flags.push('FLAG: the nested agent works only with the prompt as an argument (agentPromptRoute=arg)');
  if (d.replayFaithful !== true) flags.push('FLAG: testmd replay is not faithful; re-verification stays on full runs and the replay stretch task is cut');
  if (d.replayHasValues !== true) flags.push('FLAG: testmd replay does not carry stored values');
  if (d.verdictMode === 'value-only') flags.push("FLAG: verdictMode is value-only (firstbad compares the stored value itself; Kane's status is only an error signal)");
  if (r.attempt === 2 && r.balance !== undefined) flags.push(`FLAG: re-run attempt 2 balance before ${r.balance.before ?? 'unknown'}, after ${r.balance.after ?? 'unknown'}, delta ${r.balance.delta ?? 'unknown'} (${r.kaneRuns ?? '?'} Kane runs)`);
  for (const f of r.flags ?? []) flags.push(`FLAG: ${f}`);
}
for (const [name, content] of [
  ['spike-result.json', raw],
  ['kane-spike.md', md],
  ['rerun-1-stop.json', carriedRaw],
]) {
  for (const re of SECRET) if (re.test(content)) problems.push(`${name} contains a token-like string`);
  if (content.includes('.evidence')) problems.push(`${name} mentions an evidence pack path`);
  if (content.includes('session_dir')) problems.push(`${name} contains session_dir`);
}
for (const f of flags) console.log(f);
if (problems.length > 0) {
  for (const p of problems) console.log(`FAIL: ${p}`);
  process.exit(1);
}
console.log('PASS');
