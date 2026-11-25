# firstbad Ship Implementation Plan

**Goal:** Ship firstbad for judging: the schema-locked README, the LIVE end-to-end demo hunt that becomes the committed recorded-run fallback, and the stretch tasks that only run once everything else is green.
**Architecture:** The README follows schema R3-cli-tool v1 (`references/readme-schemas.md` of the build kit) and is checked by a heading-conformance gate. The LIVE demo hunt runs the built CLI (`node dist/cli.js demo`) once against the real kane-cli and the real Claude Code agent and copies a scrubbed transcript plus the report into `docs/demo/recorded-run/`; its gate validates those files offline. Stretch tasks extend the core with small, exact edits.
**Tech Stack:** Node >= 20, TypeScript 5.9.3, Vitest 3.2.7, cross-spawn 7.0.6, kane-cli >= 0.10.9 (LIVE task only), Claude Code CLI 2.1.229 (LIVE task only), Windows PowerShell 5.1 (README gate).
**Source spec:** docs/superpowers/specs/2026-11-25-firstbad-design.md

Order: Task 14 (README) → Task 15 (LIVE demo hunt; runs only after every must-have task and the droppable Task 9, unless Task 9 was cut, is green against the stub) → stretch Task 16 (`--objective`), which runs only after Task 15 is green. A replay re-verification stretch task is authored after the day-1 spike, and only if `docs/spike/spike-result.json` shows `replayFaithful: true` and `replayHasValues: true`, so its `testmd` syntax comes from the spike instead of a guess. The spike recorded `replayFaithful: false` and `replayHasValues: false` (both replays passed on both pages and carried no values), so that task is not authored.

---

### Task 14: README (schema R3-cli-tool v1)

**Files:**
- Modify: `README.md`

**Depends on:** Task 2.1, Task 8, Task 13
**Effort:** medium
**Priority:** must-have
**Provides:** `README.md (R3-cli-tool v1)`
**Requires:** `dist/cli.js (bin firstbad: hunt, oracle, --version, --help)`, `firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" | --agent none] [--no-fix] [--force]`

Schema: **R3-cli-tool v1**, no event overlay (the event's `event.md` mandates no README sections). Stamp on line 1: `<!-- readme-schema: R3-cli-tool v1 -->`. Resolved heading list, in this order, verbatim: `# firstbad`, `## Demo`, `## What it does`, `## Quickstart`, `## Built at KaneCLI Online Hackathon 2026`, `## Install`, `## Usage`, `## Commands / API reference`, `## How it works`, `## Roadmap`, `## License`. Only `#`/`##` are locked; `###` sub-headings are free. TBD lines (resolved after the build by demo-studio and the closing pass): `TBD-post-build:demo-video-url`, `TBD-post-build:terminal-gif`. Never write a secret, an access key or a local path into the README; env-var names only. The repo URL is `https://github.com/Dotman-Bei/firstbad`.

- [ ] **Step 1: Run the gate to confirm the stub README fails it**
Run: `$want = @('# firstbad','## Demo','## What it does','## Quickstart','## Built at KaneCLI Online Hackathon 2026','## Install','## Usage','## Commands / API reference','## How it works','## Roadmap','## License'); $stamp = '<!-- readme-schema: R3-cli-tool v1 -->'; $lines = Get-Content README.md -Encoding UTF8; $inFence = $false; $got = foreach ($l in $lines) { if ($l -match '^\x60{3}') { $inFence = -not $inFence } elseif (-not $inFence -and $l -cmatch '^#{1,2} ') { $l } }; $ok = ($got.Count -eq $want.Count); if ($ok) { for ($i = 0; $i -lt $want.Count; $i++) { if ($got[$i] -cne $want[$i]) { $ok = $false } } }; if ($ok -and ($lines[0] -ceq $stamp)) { 'PASS' } else { 'FAIL' }`
Expected: FAIL — prints `FAIL` (the stub README has the old title and no stamp)

- [ ] **Step 2: Replace `README.md` with exactly this content**

Write only what is inside the outer four-backtick fence: line 1 of `README.md` must be the `<!-- readme-schema: R3-cli-tool v1 -->` stamp. If `src/cli.ts` has no `clean:` entry in its `COMMANDS` table (the droppable Task 9 was cut), delete the `firstbad clean` row from the commands table; change nothing else.

````markdown
<!-- readme-schema: R3-cli-tool v1 -->
# firstbad

git bisect with a real-browser oracle: Kane CLI tests each commit, names the first bad one, and proves your agent's fix.

## Demo

- Demo video: TBD-post-build:demo-video-url
- Terminal recording: TBD-post-build:terminal-gif
- Recorded live run (the fallback if you cannot run Kane yourself): [docs/demo/recorded-run/report.md](docs/demo/recorded-run/report.md) and the full terminal transcript in [docs/demo/recorded-run/transcript.txt](docs/demo/recorded-run/transcript.txt)

## What it does

A user flow breaks ("the checkout total is wrong"), and the fix is usually a few lines, but finding the commit that broke it means a manual `git bisect`: check out, rebuild, click through the flow, decide good or bad, repeat. Coding agents make this worse, because they land many small commits that nobody clicked through. firstbad automates the whole loop. You describe the check in plain English (what to do on the page, which value to store, what it should be), name a known-good ref and say how to serve your app. firstbad proves the check fails on the bad ref and passes on the good one, then lets `git bisect run` drive Kane CLI, one real headless Chrome run per commit, until it names the first bad commit, and confirms it against its parent. A commit that fails for a different reason (it does not build, the page never loads, it shows some other value) is skipped, not blamed. Then it hands the culprit's diff and Kane's failing result to your coding agent and re-runs Kane on the patched tree until it passes.

## Quickstart

```bash
npm install -g @testmuai/kane-cli
kane-cli login --oauth
git clone https://github.com/Dotman-Bei/firstbad
cd firstbad
npm ci
npm run build
node dist/cli.js demo
```

`demo` generates a 40-commit "Corner Shop" history in `./firstbad-demo/shop` (the same commit SHAs on every machine), hunts its planted checkout regression with Kane, skips an unrelated broken stretch of history, confirms the culprit, asks Claude Code to fix it and proves the fix with Kane. The report lands in `./firstbad-demo/report/`. No Claude Code? Run `node dist/cli.js demo --agent none` and firstbad reverts the culprit and proves the revert instead.

## Built at KaneCLI Online Hackathon 2026

- Event: KaneCLI Online Hackathon by TestMu AI (https://www.kaneclihack.sh/), 12 to 26 November 2026.
- Category: 02 WORKFLOW "Workflows with a spine", the page's own "git bisect on autopilot" idea, with the agent loop driven only by Kane's verdicts.
- Team: solo builder (Dotman-Bei) with an AI build pipeline.
- Built during the event: everything in this repository. The first commit is from 25 November 2026.
- Kane CLI is the oracle: its verdict and stored value decide every bisect step, and its failing result is the agent's brief.

## Install

Requirements: Node.js 20 or later, git 2.40 or later, Google Chrome, and kane-cli 0.10.9 or later installed with npm (not pnpm) and logged in. The default agent is the Claude Code CLI (`claude`); any agent that edits files when given a prompt on stdin works.

```bash
npm install -g @testmuai/kane-cli
kane-cli login --oauth
kane-cli balance
git clone https://github.com/Dotman-Bei/firstbad
cd firstbad
npm ci
npm run build
npm link
firstbad --help
```

Every Kane run spends real TestMu AI credits and takes real time: in our runs one short check took about 160 seconds and about 26 credits by the balance (Kane's own `credits_consumed` reported less, so firstbad reports the balance change). A 40-commit hunt with a fix needs about a dozen runs. firstbad refuses to start below `FIRSTBAD_MIN_BALANCE` credits.

## Usage

Hunt the commit that broke your checkout total:

```bash
firstbad hunt --good v1.0 \
  --serve "npm start" --setup "npm ci" \
  --url http://127.0.0.1:3000/ \
  --do "add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply" \
  --store "the total amount shown next to the word Total" \
  --expect "\$18.00"
```

firstbad prints one line per Kane verdict (bracket, bisect, confirm, fix), names the first bad commit, commits the verified fix on a new local branch `firstbad/fix-<sha>` together with `firstbad-report.md` and `firstbad-report.json`, and writes the report to `.git/firstbad/reports/<time>/` (or `--out <dir>`). It never pushes and never touches your checkout: the hunt runs in a disposable git worktree.

Use only the oracle inside your own bisect:

```bash
firstbad oracle --session <session.json>
```

## Commands / API reference

| Command | What it does |
|---|---|
| `firstbad hunt --good <ref> --url <url> --do "<steps>" --store "<what>" --expect "<value>" --serve "<cmd>"` | Bracket, bisect, confirm and fix. Options: `--bad <ref>` (default `HEAD`), `--setup "<cmd>"` (run per commit), `--agent "<cmd>"` or `--agent none`, `--no-fix`, `--out <dir>`, `--repo <path>` |
| `firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" \| --agent none] [--no-fix] [--force]` | Generate the Corner Shop history and run the whole loop on it |
| `firstbad oracle --session <file>` | A `git bisect run` script: exit 0 good, 1 bad, 125 skip, 128 abort |
| `firstbad clean [--repo <path>]` | Remove leftover firstbad worktrees and session folders |
| `firstbad --version`, `firstbad --help` | Version and usage |

Exit codes of `hunt` and `demo`: 0 = confirmed culprit and a fix Kane verified (or `--no-fix`), 1 = the hunt ran without that, 2 = usage error, 3 = preflight failed (kane-cli missing or older than 0.10.9, not logged in, balance below the floor, bad refs).

| Environment variable | Default | Purpose |
|---|---|---|
| `FIRSTBAD_KANE` | `kane-cli` | The Kane command |
| `FIRSTBAD_MIN_BALANCE` | `500` | Refuse to start below this many credits |
| `FIRSTBAD_MAX_RUNS` | `16` | Cap on Kane runs per hunt (retries count) |
| `FIRSTBAD_MAX_FIX_ATTEMPTS` | `3` | Agent attempts before giving up |
| `FIRSTBAD_KANE_TIMEOUT_SEC` | `300` | Kane `--timeout`; firstbad kills Kane 60 s later |
| `FIRSTBAD_AGENT_TIMEOUT_SEC` | `900` | Kill timer for one agent attempt |
| `FIRSTBAD_READY_TIMEOUT_SEC` | `30` | How long the served URL may take to answer |
| `FIRSTBAD_SETUP_TIMEOUT_SEC` | `600` | Kill timer for the setup command |
| `FIRSTBAD_KEEP_SESSION` | unset | `1` keeps the temporary session folder (it holds Kane evidence packs: never commit it) |
| `NO_COLOR` | unset | Plain output |

## How it works

1. **The check becomes a Kane objective.** firstbad writes the objective itself, in the comma-chained, store-first style Kane's own cookbook recommends ("go to the URL, do the steps, then store the value as 'observed'"), and compares the stored value itself; Kane's own pass or fail is only an error signal. A live spike against Kane CLI 0.10.9 chose this wording: when the objective also asked Kane to assert the expected value, Kane failed the run on the page with the wrong total and kept no stored value, so the bad commit would have had no value to recognize it by.
2. **Bracket.** Kane must fail the bad ref with a stored value (that value becomes the bad signature) and pass the good ref. A run where Kane cannot store anything is retried once and then reported as a mis-phrased check, never as a bug.
3. **Bisect.** `git bisect run` calls `firstbad oracle` for each commit inside a disposable worktree. The oracle runs your setup, starts your server, waits for the URL, runs one serialized, headless, time-limited Kane check and maps the result: PASS (exit 0) when the stored value matches what you expect, FAIL (exit 1) when it matches the bad signature, SKIP (exit 125) when the commit fails differently (no build, no page, a Kane error after one retry, a third value), ABORT (128) on auth errors or the run cap. It reads both Kane's `run_end` and the stored value, so an upload failure (exit 1 with a passing `run_end`) is not a failure, and a Kane "pass" that stored the wrong value is caught.
4. **Confirm.** The first bad commit is re-tested together with its parent: culprit FAIL and parent PASS, or the hunt reports it as unconfirmed.
5. **Fix.** The culprit's diff, Kane's failing summary and the check go to your agent (default: `claude -p` limited to the Read, Edit, Write, Glob and Grep tools) on a new branch. Kane re-runs the same check on the patched tree; a failure goes back to the agent, up to three attempts. A pass is committed with the report.
6. **Safe to commit.** Kane runs in a temporary folder, so its `.testmuai/` output and evidence packs (which can hold bearer tokens) never enter your repository. Reports keep an allow-list of fields and are scrubbed of anything token-shaped.

## Roadmap

Known limits:

- Two bugs with different bad values in one range can make bisect skip the true culprit, because that commit shows a third value. The confirm step catches this and reports the hunt as unconfirmed.
- A busy port aborts the hunt with a clear error instead of testing someone else's server.
- One stored value per check, and Kane runs are serial: each one takes real minutes and credits.
- Built and exercised on Windows 10. The macOS and Linux code paths (process-group kill, `sh` setup and serve commands) are implemented but were not run on those systems during the event.

Next: a raw `--objective` escape hatch for checks that do not fit the store-and-compare shape, cheaper re-verification by replaying Kane's recorded test where replays prove faithful, and a GitHub Action that runs a hunt when a flow check starts failing.

## License

MIT, see [LICENSE](LICENSE).
````

- [ ] **Step 3: Run the gate to confirm it passes**
Run: `$want = @('# firstbad','## Demo','## What it does','## Quickstart','## Built at KaneCLI Online Hackathon 2026','## Install','## Usage','## Commands / API reference','## How it works','## Roadmap','## License'); $stamp = '<!-- readme-schema: R3-cli-tool v1 -->'; $lines = Get-Content README.md -Encoding UTF8; $inFence = $false; $got = foreach ($l in $lines) { if ($l -match '^\x60{3}') { $inFence = -not $inFence } elseif (-not $inFence -and $l -cmatch '^#{1,2} ') { $l } }; $ok = ($got.Count -eq $want.Count); if ($ok) { for ($i = 0; $i -lt $want.Count; $i++) { if ($got[$i] -cne $want[$i]) { $ok = $false } } }; if ($ok -and ($lines[0] -ceq $stamp)) { 'PASS' } else { 'FAIL' }`
Expected: PASS — prints `PASS`

- [ ] **Step 4: Commit (kernel-performed — no agent runs this)**
Message: `docs: README (R3-cli-tool v1) with quickstart, usage and known limits`

---

### Task 15: LIVE end-to-end demo hunt (the judges' recorded-run fallback)

**Files:**
- Create: `scripts/live-demo.mjs`
- Create: `scripts/check-recorded-run.mjs`
- Create: `docs/demo/recorded-run/report.md`
- Create: `docs/demo/recorded-run/report.json`
- Create: `docs/demo/recorded-run/transcript.txt`

**Depends on:** Task 1, Task 2, Task 2.1, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9, Task 10, Task 11, Task 12, Task 13, Task 14
**Effort:** medium
**Model tier:** top
**Priority:** must-have
**Provides:** `docs/demo/recorded-run/ (report.md, report.json, transcript.txt from one live run)`, `scripts/live-demo.mjs`, `scripts/check-recorded-run.mjs`
**Requires:** `dist/cli.js (bin firstbad: hunt, oracle, --version, --help)`, `firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" | --agent none] [--no-fix] [--force]`, `docs/spike/spike-result.json decisions { chosenTemplate, verdictMode, agentPromptRoute, localRunEndWellFormed, replayFaithful, replayHasValues }`, `src/kane-profile.ts rewritten by the re-run (template 'store-only', verdictMode 'value-only')`

The last LIVE task. Dispatch it only after every must-have task and Task 9 are green against the stub. If the orchestrator cuts the droppable Task 9, it marks Task 9 cut (counted as done for this edge) and Task 15 may run. Step 4 spends real Kane credits (about a dozen runs of about 26 credits and 2–3 minutes each, capped by `FIRSTBAD_MAX_RUNS=24`) and runs the real Claude Code agent; it takes 20–60 minutes, so run it in the background and wait for it to exit (the orchestrator may run that single command itself). Run it **once**. The gate never calls Kane. The transcript and reports are committed to a public repo, so the script scrubs token-shaped strings and evidence paths, replaces the temp folder, the home folder and the local user name (raw, forward-slash and JSON-escaped forms) with `<tmp>`, `~` and `<user>`, and scrubs `report.json` value by value after parsing it so the JSON stays valid.

`node dist/cli.js demo --dir <dir>` (Task 13) generates the shop in `<dir>/shop`, writes `report.md` and `report.json` to `<dir>/report/`, prints the timeline and exits 0 when the culprit is confirmed and the fix is verified. The expected culprit subject is `refactor(cart): extract price helpers`. `firstbad demo` passes no template or verdict mode, so the hunt takes both from `KANE_PROFILE` in `src/kane-profile.ts`, which the spike re-run (Task 2.1) set to `store-only` / `value-only` after store-only stored the value on both spike pages; nothing in this task names a template.

- [ ] **Step 1: Write `scripts/live-demo.mjs`**

```js
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
```

- [ ] **Step 2: Write the gate `scripts/check-recorded-run.mjs`**

```js
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
```

- [ ] **Step 3: Run the gate to confirm it fails before the live run**
Run: `node scripts/check-recorded-run.mjs`
Expected: FAIL — lines starting `FAIL: docs/demo/recorded-run/report.md is missing`

- [ ] **Step 4: LIVE — build, then record the demo exactly once (spends Kane credits; 20–60 min; run it in the background and wait for it to exit)**
Run: `npm run build; node scripts/live-demo.mjs`
Expected: the demo timeline streams (bracket FAIL then PASS, bisect lines including a SKIP "page never loaded", the first bad commit `refactor(cart): extract price helpers`, confirm FAIL/PASS, the agent's fix attempt and a Kane PASS), then `live-demo: wrote docs/demo/recorded-run (exit 0, ...)`. A non-zero exit means the live run did not end green: do not re-run; report `RESULT: BLOCKED` with the last 20 transcript lines so the orchestrator can decide with the user.

- [ ] **Step 5: Run the gate to confirm it passes**
Run: `node scripts/check-recorded-run.mjs`
Expected: PASS — prints `PASS`

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**
Message: `docs(demo): LIVE recorded demo run (hunt, confirm, agent fix, Kane proof)`

---

### Task 16: Stretch — the raw `--objective` escape hatch

**Files:**
- Modify: `src/check.ts`
- Modify: `src/session.ts`
- Modify: `src/probe.ts`
- Modify: `src/hunt.ts`
- Modify: `src/run.ts`
- Modify: `src/cli.ts`
- Test: `test/objective.test.ts`

**Depends on:** Task 4, Task 5, Task 6, Task 8, Task 15
**Effort:** medium
**Priority:** stretch
**Provides:** `validateObjective(objective: string): string[]`, `firstbad hunt --objective "<raw Kane objective>"`
**Requires:** `interface Check { url: string; do: string; store: string; expected: string }`, `validateCheck(c: Check): string[]`, `interface Session { version: 1; repoDir: string; sessionDir: string; worktreeDir: string; kaneCwd: string; ledgerPath: string; check: Check; template: TemplateId; verdictMode: VerdictMode; serve: string; setup: string | null; kaneCmd: string[]; kaneTimeoutSec: number; readyTimeoutSec: number; setupTimeoutSec: number; maxRuns: number; runsUsed: number; badValue: string | null }`, `prepareSession(o: PrepareOptions, log: HuntLog): Promise<Prepared>`, `runFlow(o: FlowOptions): Promise<FlowResult>`, `main(argv: string[], io: CliIO): Promise<number>`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`

Stretch: dispatch only after Task 15 is green. With `--objective`, firstbad sends the user's objective to Kane unchanged instead of composing one; `--do` and `--store` become optional, `--expect` stays required (the stored `observed` value is still compared). The raw objective must start with `Go to http://` or `Go to https://`, must contain `'observed'` (it has to store the value under that name), and must not contain `{{`. Every edit below is an exact-string replacement in a file earlier tasks wrote; each `find` string appears exactly once in its file.

- [ ] **Step 1: Write the failing test `test/objective.test.ts`**

```ts
import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { validateObjective } from '../src/check.js';
import { main } from '../src/cli.js';
import { STUB_KANE, bisectRepo, clearStubEnv, setStubPlan, tempDir } from './helpers.js';

afterEach(() => clearStubEnv());

describe('--objective', () => {
  it('validates a raw objective', () => {
    expect(validateObjective(`Go to http://127.0.0.1:4391/, read the page, store the page text as 'observed'`)).toEqual([]);
    expect(validateObjective('read the page')).toEqual([
      '--objective must start with "Go to http://" or "Go to https://"',
      "--objective must store the value as 'observed'",
    ]);
    expect(validateObjective(`Go to http://x/, store {{a}} as 'observed'`)).toEqual(['--objective must not contain {{']);
  });

  it('sends the raw objective to Kane unchanged', async () => {
    const repo = bisectRepo();
    const stub = setStubPlan(tempDir('firstbad-objective-'), { default: { scenario: 'fetch' } });
    const objective = `Go to http://127.0.0.1:4391/, read the page, store the page text as 'observed', then assert the stored observed value is "$18.00"`;
    const lines: string[] = [];
    const code = await main(
      ['hunt', '--repo', repo, '--good', 'v1', '--url', 'http://127.0.0.1:4391/', '--expect', '$18.00', '--serve', 'node server.mjs 4391', '--objective', objective, '--no-fix'],
      { print: (l) => lines.push(l), env: { ...process.env, FIRSTBAD_KANE: `"${process.execPath}" "${STUB_KANE}"` }, cwd: process.cwd(), color: false },
    );
    expect(code).toBe(0);
    const first = JSON.parse(fs.readFileSync(stub.log, 'utf8').trim().split('\n')[0] ?? '{}') as { argv: string[] };
    expect(first.argv[1]).toBe(objective);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**
Run: `npx vitest run test/objective.test.ts`
Expected: FAIL — `validateObjective is not a function` (or a missing export error)

- [ ] **Step 3: `src/check.ts` — append at the end of the file**

```ts

export function validateObjective(objective: string): string[] {
  const problems: string[] = [];
  if (!/^go to https?:\/\//i.test(objective.trim())) problems.push('--objective must start with "Go to http://" or "Go to https://"');
  if (!objective.includes("'observed'")) problems.push("--objective must store the value as 'observed'");
  if (objective.includes('{{')) problems.push('--objective must not contain {{');
  return problems;
}
```

- [ ] **Step 4: `src/session.ts` — replace `  badValue: string | null;\n}` (the end of `interface Session`) with:**

```ts
  badValue: string | null;
  objective?: string | null;
}
```

- [ ] **Step 5: `src/probe.ts` — replace `        objective: composeObjective(s.check, s.template),` with:**

```ts
        objective: s.objective ?? composeObjective(s.check, s.template),
```

- [ ] **Step 6: `src/hunt.ts` — four replacements**

Replace `import { validateCheck, type Check } from './check.js';` with:

```ts
import { validateCheck, validateObjective, type Check } from './check.js';
```

Replace `  verdictMode?: VerdictMode;\n}` (the end of `interface PrepareOptions`) with:

```ts
  verdictMode?: VerdictMode;
  objective?: string | null;
}
```

Replace `  if (problems.length > 0) throw new PreflightError(problems.join('; '));` with:

```ts
  const objectiveProblems = o.objective === undefined || o.objective === null ? [] : validateObjective(o.objective);
  if (problems.length + objectiveProblems.length > 0) throw new PreflightError([...problems, ...objectiveProblems].join('; '));
```

Replace `    badValue: null,\n  };` (the end of the `session` object in `prepareSession`) with:

```ts
    badValue: null,
    objective: o.objective ?? null,
  };
```

- [ ] **Step 7: `src/run.ts` — two replacements**

Replace `  oracleCmd?: string[];\n}` (the end of `interface FlowOptions`) with:

```ts
  oracleCmd?: string[];
  objective?: string | null;
}
```

Replace `env: o.env, template: o.template, verdictMode: o.verdictMode },` with:

```ts
env: o.env, template: o.template, verdictMode: o.verdictMode, objective: o.objective },
```

- [ ] **Step 8: `src/cli.ts` — five replacements**

Replace `  repo: { type: 'string' },\n} as const;` with:

```ts
  repo: { type: 'string' },
  objective: { type: 'string' },
} as const;
```

Replace `  const { good, url, store, serve } = values;\n  const steps = values.do;` with:

```ts
  const { good, url, serve } = values;
  const raw = values.objective;
  const store = values.store ?? (raw !== undefined ? 'the observed value' : undefined);
  const steps = values.do ?? (raw !== undefined ? '(raw objective)' : undefined);
```

Replace `    const missing = (['good', 'url', 'do', 'store', 'expect', 'serve'] as const).filter((k) => values[k] === undefined);` with:

```ts
    const given: Record<string, string | undefined> = { good, url, do: steps, store, expect: expected, serve };
    const missing = Object.keys(given).filter((k) => given[k] === undefined);
```

Replace `    color: io.color,\n  });\n  return r.exitCode;\n}` (the end of `huntCommand`, 4-space indent) with:

```ts
    color: io.color,
    objective: raw ?? null,
  });
  return r.exitCode;
}
```

Replace `  '                [--bad <ref>] [--setup "<cmd>"] [--agent "<cmd>" | --agent none] [--no-fix] [--out <dir>] [--repo <path>]',` with:

```ts
  '                [--bad <ref>] [--setup "<cmd>"] [--agent "<cmd>" | --agent none] [--no-fix] [--out <dir>] [--repo <path>]',
  "                [--objective \"<raw Kane objective that stores the value as 'observed'>\"]",
```

- [ ] **Step 9: Run the gate to confirm it passes**
Run: `npx vitest run test/objective.test.ts test/cli.test.ts test/probe.test.ts`
Expected: PASS — output contains `Test Files  3 passed`

- [ ] **Step 10: Commit (kernel-performed — no agent runs this)**
Message: `feat(cli): stretch --objective escape hatch for raw Kane objectives`
