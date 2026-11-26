// Builds src/generated/data.json from committed sources only: the demo script (§3 seconds, §4 narration), the recorded
// run (transcript, report), README quickstart, the two diffs saved from the run's demo repo, and the demo history.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(demo, '..');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8').replace(/\r\n/g, '\n');

const script = read(root, 'docs/demo/2026-11-26-demo-script.md');
const seconds = Object.fromEntries([...script.matchAll(/^\| (S\d+) \| (\d+) \|/gm)].map((m) => [m[1], Number(m[2])]));
const scenes = [...script.matchAll(/^\*\*(S\d+)\*\* — (.*)$/gm)].map((m) => ({ id: m[1], seconds: seconds[m[1]], narration: m[2].trim() }));
if (scenes.length !== 12) throw new Error(`expected 12 narration blocks, found ${scenes.length}`);

const transcript = read(root, 'docs/demo/recorded-run/transcript.txt').split('\n').filter((l) => !l.startsWith('#') && l !== '');
const line = (re) => {
  const hit = transcript.find((l) => re.test(l));
  if (hit === undefined) throw new Error(`transcript line not found: ${re}`);
  return hit;
};
const wallSeconds = Number(/wall clock (\d+) s/.exec(read(root, 'docs/demo/recorded-run/transcript.txt'))[1]);
const report = JSON.parse(read(root, 'docs/demo/recorded-run/report.json'));

const readme = read(root, 'README.md');
const quickstart = /## Quickstart\n\n```bash\n([\s\S]*?)```/.exec(readme)[1].trimEnd().split('\n');

const diffBody = (name) => {
  const all = read(demo, 'data', name).split('\n');
  return all.slice(all.findIndex((l) => l.startsWith('@@'))).filter((l) => l !== '');
};

// The demo history is deterministic: generate it again to know every commit's position.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fbvid-'));
const { generateDemoRepo } = await import(pathToFileURL(path.join(root, 'dist/demo/generate.js')).href);
const shop = path.join(tmp, 'shop');
generateDemoRepo(shop);
const commits = execFileSync('git', ['-C', shop, 'log', '--reverse', '--format=%h'], { encoding: 'utf8' }).trim().split('\n');
fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
const indexOf = (sha) => {
  const i = commits.findIndex((c) => sha.startsWith(c));
  if (i < 0) throw new Error(`commit ${sha} not in the demo history`);
  return i;
};

const timeline = report.timeline.map((e, i) => ({
  n: i + 1,
  phase: e.phase,
  label: e.label,
  sha: e.commit.slice(0, 7),
  index: indexOf(e.commit),
  subject: e.subject,
  verdict: e.verdict,
  observed: e.observed,
  seconds: Math.round(e.durationMs / 1000),
  hasLink: e.testUrl !== null,
}));

const data = {
  scenes,
  commitCount: commits.length,
  quickstart,
  qrSvg: read(demo, 'data/repo-qr.svg'),
  replay: {
    hunting: line(/^firstbad: hunting/),
    bracket: transcript.filter((l) => /^ {2}bracket /.test(l)),
    skips: transcript.filter((l) => /^ {2}bisect .* SKIP /.test(l)),
    bisect: transcript.filter((l) => /^ {2}bisect .* (PASS|FAIL) /.test(l)),
    named: line(/^ {2}first bad commit:/),
    confirm: transcript.filter((l) => /^ {2}confirm /.test(l)),
    result: line(/^firstbad: first bad commit:/),
    handoff: line(/handing Kane's failure/),
    fixRun: line(/^ {2}fix {6}/),
    verified: line(/^firstbad: fix verified/),
    cost: line(/^firstbad: \d+ Kane runs/),
  },
  culpritDiff: diffBody('culprit-fc2879c.diff'),
  fixDiff: diffBody('fix-617eb8f.diff'),
  check: report.check,
  timeline,
  cost: report.cost,
  wallMinutes: Math.round(wallSeconds / 60),
};
fs.mkdirSync(path.join(demo, 'src/generated'), { recursive: true });
fs.writeFileSync(path.join(demo, 'src/generated/data.json'), JSON.stringify(data, null, 1));
console.log(`data: ${scenes.length} scenes, ${commits.length} commits, ${timeline.length} timeline rows, ${data.wallMinutes} min`);
