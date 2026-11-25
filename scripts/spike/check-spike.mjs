#!/usr/bin/env node
// Offline gate for Task 2: validates what scripts/spike/run-spike.mjs wrote. Never calls Kane.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RESULT_JSON = path.join(ROOT, 'docs', 'spike', 'spike-result.json');
const RESULT_MD = path.join(ROOT, 'docs', 'spike', 'kane-spike.md');
const PROFILE_TS = path.join(ROOT, 'src', 'kane-profile.ts');
const TEMPLATES = ['commas-assert', 'sentences-assert', 'store-only'];
const SECRET = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/,
  /\b(access[_-]?key|api[_-]?key|apikey|token|secret|password)["']?\s*[:=]\s*["']?[^\s"',;[\]]{8,}/i,
];

if (!fs.existsSync(RESULT_JSON)) {
  console.log('FAIL: docs/spike/spike-result.json not found (run node scripts/spike/run-spike.mjs once)');
  process.exit(1);
}
const problems = [];
const flags = [];
const raw = fs.readFileSync(RESULT_JSON, 'utf8');
const md = fs.existsSync(RESULT_MD) ? fs.readFileSync(RESULT_MD, 'utf8') : '';
let r = null;
try {
  r = JSON.parse(raw);
} catch {
  problems.push('spike-result.json is not valid JSON');
}
if (r !== null) {
  const d = r.decisions ?? {};
  if (!TEMPLATES.includes(d.chosenTemplate)) problems.push('no objective template was chosen');
  if (d.localRunEndWellFormed !== true) problems.push('the local http:// run did not return a well-formed run_end');
  if (!['status+value', 'value-only'].includes(d.verdictMode)) problems.push('verdictMode is missing');
  if (!['stdin', 'arg'].includes(d.agentPromptRoute)) problems.push('agentPromptRoute is missing');
  if (r.nestedAgent?.ok !== true) problems.push('the nested claude -p smoke failed on every route');
  if (!Array.isArray(r.runs) || r.runs.length === 0) {
    problems.push('no Kane runs were recorded');
  } else {
    if (r.runs.length > (r.limits?.maxRuns ?? 8)) problems.push('more Kane runs than the cap');
    for (const run of r.runs) if (typeof run.wallSec !== 'number') problems.push(`run ${run.id} has no wallSec`);
  }
  if (!md.startsWith('# Kane day-1 spike')) problems.push('docs/spike/kane-spike.md is missing or malformed');
  const profile = fs.readFileSync(PROFILE_TS, 'utf8');
  for (const [key, value] of [
    ['template', d.chosenTemplate],
    ['verdictMode', d.verdictMode],
    ['agentPromptRoute', d.agentPromptRoute],
  ]) {
    if (!profile.includes(`  ${key}: '${value}',`)) problems.push(`src/kane-profile.ts does not record ${key}: '${value}'`);
  }
  if (r.nestedAgent?.ok === true && r.nestedAgent.route !== 'stdin') flags.push('FLAG: the nested agent works only with the prompt as an argument (agentPromptRoute=arg)');
  if (d.replayFaithful !== true) flags.push('FLAG: testmd replay is not faithful; re-verification stays on full runs and the replay stretch task is cut');
  if (d.replayHasValues !== true) flags.push('FLAG: testmd replay does not carry stored values');
  if (d.verdictMode === 'value-only') flags.push('FLAG: verdictMode is value-only (Kane status disagreed with the stored value, or the store-only template won)');
  for (const f of r.flags ?? []) flags.push(`FLAG: ${f}`);
}
for (const [name, content] of [
  ['spike-result.json', raw],
  ['kane-spike.md', md],
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
