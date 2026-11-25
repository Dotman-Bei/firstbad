#!/usr/bin/env node
// Offline gate for Task 15: validates the recorded live run. Never calls Kane.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'demo', 'recorded-run');
const SECRET = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/,
  /\b(access[_-]?key|api[_-]?key|apikey|token|secret|password)["']?\s*[:=]\s*["']?[^\s"',;[\]]{8,}/i,
];
const problems = [];
const files = {};
for (const f of ['report.md', 'report.json', 'transcript.txt']) {
  const p = path.join(OUT, f);
  if (!fs.existsSync(p)) problems.push(`docs/demo/recorded-run/${f} is missing (run node scripts/live-demo.mjs once)`);
  else files[f] = fs.readFileSync(p, 'utf8');
}
if (files['report.json'] !== undefined) {
  let r = null;
  try {
    r = JSON.parse(files['report.json']);
  } catch {
    problems.push('report.json is not valid JSON');
  }
  if (r !== null) {
    if (r.hunt?.status !== 'confirmed') problems.push(`hunt status is ${r.hunt?.status}, expected confirmed`);
    if (r.hunt?.culprit?.subject !== 'refactor(cart): extract price helpers') problems.push(`culprit is ${r.hunt?.culprit?.subject}`);
    if (r.fix?.status !== 'verified') problems.push(`fix status is ${r.fix?.status}, expected verified`);
    if (!Array.isArray(r.timeline) || !r.timeline.some((e) => e.verdict === 'SKIP')) problems.push('the timeline has no SKIP');
    if (typeof r.cost?.kaneRuns !== 'number' || r.cost.kaneRuns > 24) problems.push(`Kane runs ${r.cost?.kaneRuns} exceed 24`);
  }
}
const home = os.homedir();
const homeForms = [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\')];
const user = os.userInfo().username.toLowerCase();
for (const [name, content] of Object.entries(files)) {
  for (const re of SECRET) if (re.test(content)) problems.push(`${name} contains a token-like string`);
  if (content.includes('.evidence')) problems.push(`${name} mentions an evidence pack path`);
  if (content.includes('session_dir')) problems.push(`${name} contains session_dir`);
  if (homeForms.some((h) => content.toLowerCase().includes(h.toLowerCase()))) problems.push(`${name} contains the home folder path`);
  if (new RegExp(`\\b${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(content)) problems.push(`${name} contains the local user name`);
}
if (problems.length > 0) {
  for (const p of problems) console.log(`FAIL: ${p}`);
  process.exit(1);
}
console.log('PASS');
