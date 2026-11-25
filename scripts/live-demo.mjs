#!/usr/bin/env node
// LIVE: spends Kane credits and runs the real coding agent. Records the judges' fallback run once.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'demo', 'recorded-run');
const CLI = path.join(ROOT, 'dist', 'cli.js');

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const forms = (p) => [p.replace(/\\/g, '\\\\'), p, p.replace(/\\/g, '/')];
const HOME_RES = forms(os.homedir()).map((h) => new RegExp(escapeRe(h), 'gi'));
const TMP_RES = forms(os.tmpdir()).map((t) => new RegExp(escapeRe(t), 'gi'));
const USER_RE = new RegExp(`\\b${escapeRe(os.userInfo().username)}\\b`, 'gi');

function scrub(text) {
  let out = text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, '[redacted]')
    .replace(/\b(access[_-]?key|api[_-]?key|apikey|token|secret|password)(["']?\s*[:=]\s*["']?)[^\s"',;[\]]{8,}/gi, '$1$2[redacted]')
    .replace(/\S*\.evidence\b/g, '[evidence path removed]');
  for (const re of TMP_RES) out = out.replace(re, '<tmp>');
  for (const re of HOME_RES) out = out.replace(re, '~');
  return out.replace(USER_RE, '<user>');
}

function scrubDeep(value) {
  if (typeof value === 'string') return scrub(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDeep(v)]));
  return value;
}

if (!fs.existsSync(CLI)) {
  console.error('live-demo: dist/cli.js is missing; run npm run build first');
  process.exit(2);
}
const env = { ...process.env, NO_COLOR: '1' };
if (!env.FIRSTBAD_MAX_RUNS) env.FIRSTBAD_MAX_RUNS = '24';
if (!env.FIRSTBAD_KANE_TIMEOUT_SEC) env.FIRSTBAD_KANE_TIMEOUT_SEC = '300';
const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-live-')), 'demo');
fs.mkdirSync(OUT, { recursive: true });
const chunks = [];
const started = Date.now();
console.log(`live-demo: firstbad demo with FIRSTBAD_MAX_RUNS=${env.FIRSTBAD_MAX_RUNS}, FIRSTBAD_KANE_TIMEOUT_SEC=${env.FIRSTBAD_KANE_TIMEOUT_SEC}`);
const child = spawn(process.execPath, [CLI, 'demo', '--dir', dir], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
const onData = (chunk) => {
  const text = chunk.toString('utf8');
  process.stdout.write(text);
  chunks.push(text);
};
child.stdout.on('data', onData);
child.stderr.on('data', onData);
child.on('close', (code) => {
  const seconds = Math.round((Date.now() - started) / 1000);
  const header =
    `# firstbad demo, recorded live ${new Date().toISOString()} on ${process.platform} ${process.arch}, node ${process.version}\n` +
    `# exit code ${code}, wall clock ${seconds} s\n\n`;
  fs.writeFileSync(path.join(OUT, 'transcript.txt'), scrub(header + chunks.join('')));
  const md = path.join(dir, 'report', 'report.md');
  if (fs.existsSync(md)) fs.writeFileSync(path.join(OUT, 'report.md'), scrub(fs.readFileSync(md, 'utf8')));
  const json = path.join(dir, 'report', 'report.json');
  if (fs.existsSync(json)) {
    const data = scrubDeep(JSON.parse(fs.readFileSync(json, 'utf8')));
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(data, null, 2) + '\n');
  }
  console.log(`live-demo: wrote docs/demo/recorded-run (exit ${code}, ${seconds} s)`);
  process.exitCode = code ?? 1;
});
