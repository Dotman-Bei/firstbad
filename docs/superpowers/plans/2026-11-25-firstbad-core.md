# firstbad Core Implementation Plan

**Goal:** Build the firstbad CLI core: the Kane adapter, the verdict rule, per-commit probing, the `git bisect run` oracle and hunt, the agent fix loop, the report and the `hunt`/`oracle` commands, plus the day-1 LIVE spike.
**Architecture:** TypeScript strict ESM compiled with `tsc` to `dist/`. Every Kane run goes through `src/kane/runner.ts` (cross-spawn, NDJSON parse, outer kill timer); `src/verdict.ts` turns a run into PASS/FAIL/SKIP/ABORT; `src/probe.ts` serves one commit and runs Kane; `src/hunt.ts` brackets, drives `git bisect run dist/oracle-bin.js` inside a disposable worktree and confirms; `src/fix.ts` hands the culprit to the coding agent and re-verifies with Kane; `src/run.ts` + `src/cli.ts` wire it together. All gates run against `test/fixtures/stub-kane.mjs`; only Task 2 and its re-run Task 2.1 spend Kane credits.
**Tech Stack:** Node >= 20 (built on v22.23.4), npm 10, TypeScript 5.9.3, Vitest 3.2.7, @types/node 22.20.7, cross-spawn 7.0.6, @types/cross-spawn 6.0.6, git >= 2.40 (built on 2.54), kane-cli >= 0.10.9 (npm global), Claude Code CLI 2.1.229 (default agent).
**Source spec:** docs/superpowers/specs/2026-11-25-firstbad-design.md

Task ids are global across the three plans (core 1–9 plus 2.1, 3.1 and 3.2, demo 10–13, ship 14–17). Task 2.1 is the spike re-run added after Task 2 chose a template that loses the value on the $20.00 page. Its first attempt stopped because Kane stored the value under its own key (`total`), so Task 3.1 (observed-key parsing and the store-only wording, no live calls) was added, and Task 2.1 was rewritten as attempt 2, which depends on it. Task 3.2 (not live) was added after the first LIVE run of Task 15 aborted at the bracket: on the good ref Kane stored the total under `cart_total` next to `discount_code`, so Task 3.2 chooses among several keys by the store phrase's words and records the key names on every empty value; Task 15 depends on it. Every task carries a `**Priority:**` line (`must-have` / `droppable` / `stretch`); the manifest copies it.

Standing rules for every task in this plan (the orchestrator also pastes `conventions.md`):
- ESM everywhere. Relative imports in `src/` end in `.js` (for example `import { scrub } from './scrub.js';`); tests import `../src/<file>.js` and Vitest resolves the `.ts` source.
- Never `as any`. Use `as unknown as T` only where a cast is unavoidable.
- Vitest's global setup (`test/global-setup.ts`) compiles `src/` with `tsc` before any test runs, so a type error anywhere in `src/` fails every gate. Fix type errors, never weaken the gate.
- Never run git state operations yourself (commit, push, checkout of the repo you work in). Tests create their own temporary repositories; that is product test code, not repo state.
- No live Kane call in any gate. Only Task 2 and Task 2.1 call the real kane-cli, each once, in its LIVE step.

---

### Task 1: Scaffold the package, compiler, test runner and Kane profile

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `src/version.ts`
- Create: `src/kane-profile.ts`
- Test: `test/global-setup.ts`
- Test: `test/version.test.ts`

**Effort:** low
**Model tier:** fast
**Priority:** must-have
**Provides:** `VERSION: string (src/version.ts)`, `type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only'`, `type VerdictMode = 'status+value' | 'value-only'`, `type AgentPromptRoute = 'stdin' | 'arg'`, `interface KaneProfile { template: TemplateId; verdictMode: VerdictMode; agentPromptRoute: AgentPromptRoute; source: string }`, `TEMPLATE_IDS: readonly TemplateId[]`, `KANE_PROFILE: KaneProfile (src/kane-profile.ts)`
**Requires:** none

- [ ] **Step 1: Write `package.json`**
      ```json
      {
        "name": "firstbad",
        "version": "0.1.0",
        "description": "git bisect with a real-browser oracle: Kane CLI checks each commit against a plain-English test, names the first bad commit, and re-verifies your coding agent's fix until it passes.",
        "type": "module",
        "license": "MIT",
        "bin": {
          "firstbad": "dist/cli.js"
        },
        "files": [
          "dist",
          "README.md",
          "LICENSE"
        ],
        "engines": {
          "node": ">=20"
        },
        "scripts": {
          "build": "tsc -p tsconfig.json",
          "typecheck": "tsc -p tsconfig.json --noEmit",
          "test": "vitest run"
        },
        "dependencies": {
          "cross-spawn": "7.0.6"
        },
        "devDependencies": {
          "@types/cross-spawn": "6.0.6",
          "@types/node": "22.20.7",
          "typescript": "5.9.3",
          "vitest": "3.2.7"
        }
      }
      ```

- [ ] **Step 2: Install to create the lockfile**
      Run: `npm install`
      Expected: exits 0 and creates `package-lock.json` and `node_modules/` (node_modules is git-ignored in Step 4).

- [ ] **Step 3: Write `tsconfig.json`**
      ```json
      {
        "compilerOptions": {
          "target": "ES2022",
          "module": "NodeNext",
          "moduleResolution": "NodeNext",
          "lib": ["ES2022"],
          "types": ["node"],
          "strict": true,
          "esModuleInterop": true,
          "skipLibCheck": true,
          "forceConsistentCasingInFileNames": true,
          "outDir": "dist",
          "rootDir": "src",
          "declaration": false,
          "sourceMap": false
        },
        "include": ["src/**/*.ts"]
      }
      ```

- [ ] **Step 4: Write `.gitignore`**
      ```gitignore
      node_modules/
      dist/
      coverage/
      .testmuai/
      *.evidence
      .env
      .env.*
      firstbad-demo/
      ```

- [ ] **Step 5: Write `LICENSE`**
      ```text
      MIT License

      Copyright (c) 2026 Dotman-Bei

      Permission is hereby granted, free of charge, to any person obtaining a copy
      of this software and associated documentation files (the "Software"), to deal
      in the Software without restriction, including without limitation the rights
      to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
      copies of the Software, and to permit persons to whom the Software is
      furnished to do so, subject to the following conditions:

      The above copyright notice and this permission notice shall be included in all
      copies or substantial portions of the Software.

      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
      OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
      SOFTWARE.
      ```

- [ ] **Step 6: Write `vitest.config.ts`**
      ```ts
      import { defineConfig } from 'vitest/config';

      export default defineConfig({
        test: {
          include: ['test/**/*.test.ts'],
          globalSetup: ['test/global-setup.ts'],
          testTimeout: 120_000,
          hookTimeout: 120_000,
          pool: 'forks',
          fileParallelism: false,
        },
      });
      ```

- [ ] **Step 7: Write `test/global-setup.ts` (compiles `src/` to `dist/` once per test run)**
      ```ts
      import { execFileSync } from 'node:child_process';
      import path from 'node:path';
      import { fileURLToPath } from 'node:url';

      export default function setup(): void {
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
        const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
        execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.json')], {
          cwd: root,
          stdio: 'inherit',
        });
      }
      ```

- [ ] **Step 8: Write the failing test `test/version.test.ts`**
      ```ts
      import fs from 'node:fs';
      import { describe, expect, it } from 'vitest';
      import { VERSION } from '../src/version.js';
      import { KANE_PROFILE, TEMPLATE_IDS } from '../src/kane-profile.js';

      describe('scaffold', () => {
        it('VERSION matches package.json, the default Kane profile is valid, and dist/ was built', () => {
          const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
          expect(VERSION).toBe(pkg.version);
          expect(TEMPLATE_IDS).toEqual(['commas-assert', 'sentences-assert', 'store-only']);
          expect(TEMPLATE_IDS).toContain(KANE_PROFILE.template);
          expect(['status+value', 'value-only']).toContain(KANE_PROFILE.verdictMode);
          expect(['stdin', 'arg']).toContain(KANE_PROFILE.agentPromptRoute);
          expect(fs.existsSync(new URL('../dist/version.js', import.meta.url))).toBe(true);
          expect(fs.existsSync(new URL('../dist/kane-profile.js', import.meta.url))).toBe(true);
        });
      });
      ```

- [ ] **Step 9: Run it to confirm it fails**
      Run: `npx vitest run test/version.test.ts`
      Expected: FAIL — `Failed to load url ../src/version.js` (or a tsc error that `src` has no inputs).

- [ ] **Step 10: Write `src/version.ts`**
      ```ts
      export const VERSION = '0.1.0';
      ```

- [ ] **Step 11: Write `src/kane-profile.ts` (byte-exact; the day-1 spike in Task 2 rewrites this file in the same format)**
      ```ts
      // Written by the day-1 spike (scripts/spike/run-spike.mjs). Core code reads only KANE_PROFILE.
      export type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only';
      export type VerdictMode = 'status+value' | 'value-only';
      export type AgentPromptRoute = 'stdin' | 'arg';

      export interface KaneProfile {
        template: TemplateId;
        verdictMode: VerdictMode;
        agentPromptRoute: AgentPromptRoute;
        source: string;
      }

      export const TEMPLATE_IDS: readonly TemplateId[] = ['commas-assert', 'sentences-assert', 'store-only'];

      export const KANE_PROFILE: KaneProfile = {
        template: 'commas-assert',
        verdictMode: 'status+value',
        agentPromptRoute: 'stdin',
        source: 'default (spike not yet run)',
      };
      ```

- [ ] **Step 12: Run the gate to confirm it passes**
      Run: `npx vitest run test/version.test.ts`
      Expected: PASS — output contains `Tests  1 passed`

- [ ] **Step 13: Commit (kernel-performed — no agent runs this)**
      Message: `chore: scaffold firstbad (TypeScript, Vitest, Kane profile)`

---

### Task 2: LIVE day-1 spike (objective template, verdict mode, replay, nested agent)

**Files:**
- Create: `scripts/spike/run-spike.mjs`
- Create: `scripts/spike/check-spike.mjs`
- Create: `docs/spike/spike-result.json`
- Create: `docs/spike/kane-spike.md`
- Modify: `src/kane-profile.ts`

**Depends on:** Task 1
**Effort:** medium
**Model tier:** top
**Priority:** must-have
**Provides:** `docs/spike/spike-result.json decisions { chosenTemplate, verdictMode, agentPromptRoute, localRunEndWellFormed, replayFaithful, replayHasValues }`, `src/kane-profile.ts rewritten with the spike's choices`
**Requires:** `KANE_PROFILE: KaneProfile (src/kane-profile.ts)`

This is one of the two LIVE tasks. Step 4 spends real Kane credits (at most `FIRSTBAD_SPIKE_MAX_RUNS`, default 8 runs, roughly 26 credits and 160 s each) and runs one real `claude -p`. Run Step 4 **exactly once**. It takes 5–30 minutes, so run it in the background and wait for it to exit (the orchestrator may run that one command itself). The gate (Step 5) only reads the files Step 4 wrote; it never calls Kane. The current `src/kane-profile.ts` (from Task 1) ends with:

```ts
export const KANE_PROFILE: KaneProfile = {
  template: 'commas-assert',
  verdictMode: 'status+value',
  agentPromptRoute: 'stdin',
  source: 'default (spike not yet run)',
};
```

Step 4 rewrites the whole file in exactly the Task 1 format with the chosen values; never hand-edit it.

- [ ] **Step 1: Write `scripts/spike/run-spike.mjs`**

```js
#!/usr/bin/env node
// LIVE: spends Kane credits. The firstbad day-1 spike (spec section 12). Run it once.
// Writes docs/spike/spike-result.json, docs/spike/kane-spike.md and src/kane-profile.ts.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RESULT_JSON = path.join(ROOT, 'docs', 'spike', 'spike-result.json');
const RESULT_MD = path.join(ROOT, 'docs', 'spike', 'kane-spike.md');
const PROFILE_TS = path.join(ROOT, 'src', 'kane-profile.ts');
const PORT = 4199;
const PAGE_URL = `http://127.0.0.1:${PORT}/`;
const MIN_BALANCE = numberEnv('FIRSTBAD_MIN_BALANCE', 500);
const MAX_RUNS = numberEnv('FIRSTBAD_SPIKE_MAX_RUNS', 8);
const TIMEOUT_SEC = numberEnv('FIRSTBAD_KANE_TIMEOUT_SEC', 300);
const KANE = splitCommand(process.env.FIRSTBAD_KANE ?? 'kane-cli');
const AGENT = ['claude', '-p', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Glob,Grep'];
const TEMPLATES = ['commas-assert', 'sentences-assert', 'store-only'];
const CHECK = {
  url: PAGE_URL,
  do: 'look at the order summary',
  store: 'the total amount shown next to the word Total',
  expected: '$18.00',
};

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

function clean(s) {
  return s.trim().replace(/[.,\s]+$/u, '');
}

function capitalize(s) {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// Must stay identical to composeObjective() in src/check.ts (spec section 3).
function compose(template, c) {
  const url = c.url.trim();
  const d = clean(c.do);
  const st = clean(c.store);
  const ex = c.expected.trim();
  if (template === 'commas-assert') return `Go to ${url}, ${d}, store ${st} as 'observed', then assert the stored observed value is "${ex}"`;
  if (template === 'sentences-assert') return `Go to ${url}. ${capitalize(d)}. Store ${st} as 'observed'. Then assert that the stored observed value is "${ex}".`;
  return `Go to ${url}, ${d}, then store ${st} as 'observed'`;
}

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

function parseStream(stdout) {
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
      const keys = Object.keys(finalState);
      const rawObserved = 'observed' in finalState ? finalState.observed : keys.length === 1 ? finalState[keys[0]] : undefined;
      out.runEnd = {
        status: text(o.status),
        summary: scrub(text(o.summary)).slice(0, 500),
        oneLiner: scrub(text(o.one_liner)).slice(0, 300),
        reason: scrub(text(o.reason)).slice(0, 500),
        resultCode: o.result_code === undefined || o.result_code === null ? null : text(o.result_code),
        creditsConsumed: typeof o.credits_consumed === 'number' ? o.credits_consumed : typeof o.credits === 'number' ? o.credits : null,
        durationSec: typeof o.duration === 'number' ? o.duration : null,
        finalStateKeys: keys.slice(0, 10).map((k) => scrub(k)),
        observed: scrub(text(rawObserved)).trim().slice(0, 200),
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

function walk(dir, depth) {
  if (depth < 0 || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), depth - 1) : [path.join(dir, e.name)]));
}

function findRecording(kaneCwd, slug) {
  const files = walk(path.join(kaneCwd, '.testmuai'), 4).filter((f) => f.endsWith('_test.md'));
  const exact = files.find((f) => path.basename(f) === `${slug}_test.md`);
  return exact ?? files.find((f) => path.basename(f).includes(slug)) ?? null;
}

let pageTotal = '$18.00';

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

async function nestedAgentSmoke() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-agent-smoke-'));
  const file = path.join(dir, 'hello.txt');
  const prompt =
    'Edit the file hello.txt in the current directory so that its entire content is exactly the word new ' +
    '(no quotes, nothing else). Do not create, rename or delete any other file. Do not run any shell commands.';
  const env = { ...process.env };
  delete env.CLAUDECODE;
  const tries = [];
  for (const route of ['stdin', 'arg']) {
    fs.writeFileSync(file, 'old\n');
    console.log(`spike: nested agent smoke via ${route} ...`);
    const r = await runProcess(route === 'arg' ? [...AGENT, prompt] : AGENT, {
      cwd: dir,
      env,
      input: route === 'stdin' ? prompt : undefined,
      timeoutMs: 300_000,
    });
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
    const ok = content === 'new';
    tries.push({
      route,
      ok,
      exitCode: r.code,
      wallSec: r.wallSec,
      timedOut: r.timedOut,
      spawnError: r.spawnError,
      outputTail: scrub(`${r.stdout}\n${r.stderr}`.trim()).slice(-300),
    });
    console.log(`spike: nested agent via ${route} -> ${ok ? 'edited the file' : 'did not edit the file'} (${r.wallSec} s)`);
    if (ok) return { ok: true, route, tries };
  }
  return { ok: false, route: null, tries };
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
  const rows = r.runs.map(
    (run) =>
      `| ${run.id} | ${run.kind} | ${run.page} | ${run.exitCode ?? 'killed'} | ${run.wallSec} | ` +
      `${run.testMdDone?.overallStatus || run.runEnd?.status || 'none'} | ${run.runEnd?.observed || '-'} | ` +
      `${run.runEnd?.creditsConsumed ?? '-'} |`,
  );
  return [
    '# Kane day-1 spike',
    '',
    `- Ran at: ${r.ranAt} on ${r.platform}, node ${r.node}, kane-cli ${r.kaneVersion ?? 'unknown'}`,
    `- Chosen objective template: \`${d.chosenTemplate ?? 'none'}\` (verdict mode \`${d.verdictMode}\`)`,
    `- Local http:// run_end well-formed: ${yes(d.localRunEndWellFormed)}`,
    `- Replay faithful: ${yes(d.replayFaithful)}; replay carries stored values: ${yes(d.replayHasValues)}`,
    `- Nested agent (claude -p, CLAUDECODE removed): ${r.nestedAgent.ok ? `ok via ${r.nestedAgent.route}` : 'failed on every route'}`,
    `- Balance: before ${r.balance.before ?? 'unknown'}, after ${r.balance.after ?? 'unknown'}, delta ${r.balance.delta ?? 'unknown'} (sum of credits_consumed ${r.creditsConsumedSum})`,
    `- Mean wall-clock seconds per Kane run: ${r.meanWallSec ?? 'n/a'}`,
    '',
    '## Runs',
    '',
    '| Run | Kind | Page | Exit | Wall s | Status | Observed | credits_consumed |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Flags',
    '',
    ...(r.flags.length === 0 ? ['- none'] : r.flags.map((f) => `- ${f}`)),
    '',
  ].join('\n');
}

async function main() {
  const flags = [];
  const runs = [];
  let kaneRuns = 0;
  const kaneCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-spike-'));
  const kaneEnv = { ...process.env, KANE_CLI_USER_AGENT: process.env.KANE_CLI_USER_AGENT || 'firstbad' };

  const nestedAgent = await nestedAgentSmoke();
  if (!nestedAgent.ok) flags.push('nested agent: neither the stdin nor the argument route edited the file; the fix loop needs another spawn route');
  else if (nestedAgent.route !== 'stdin') flags.push('nested agent: the stdin route failed and the argument route worked (agentPromptRoute=arg)');

  const before = await runProcess([...KANE, 'balance'], { cwd: kaneCwd, env: kaneEnv, timeoutMs: 60_000 });
  const balanceBefore = before.code === 0 ? parseBalance(before.stdout) : null;
  if (balanceBefore !== null && balanceBefore < MIN_BALANCE) {
    console.error(`spike: balance ${balanceBefore} is below FIRSTBAD_MIN_BALANCE=${MIN_BALANCE}; not spending credits`);
    return 3;
  }
  if (balanceBefore === null) flags.push('could not read kane-cli balance before the spike');
  const versionRun = await runProcess([...KANE, '--version'], { cwd: kaneCwd, env: kaneEnv, timeoutMs: 60_000 });
  const versionMatch = /(\d+\.\d+\.\d+)/.exec(versionRun.stdout);
  const kaneVersion = versionMatch === null ? null : versionMatch[1];
  const help = await runProcess([...KANE, 'testmd', '--help'], { cwd: kaneCwd, env: kaneEnv, timeoutMs: 60_000 });
  const testmdHelp = scrub(`${help.stdout}\n${help.stderr}`.trim()).slice(0, 1500);

  const kaneRun = async (id, argv, page) => {
    if (kaneRuns >= MAX_RUNS) {
      flags.push(`run cap reached before ${id} (FIRSTBAD_SPIKE_MAX_RUNS=${MAX_RUNS})`);
      return null;
    }
    kaneRuns += 1;
    pageTotal = page;
    console.log(`spike: ${id} (run ${kaneRuns}/${MAX_RUNS}, page shows ${page}) ...`);
    const r = await runProcess(argv, { cwd: kaneCwd, env: kaneEnv, timeoutMs: (TIMEOUT_SEC + 60) * 1000 });
    const stream = parseStream(r.stdout);
    const record = {
      id,
      kind: argv.includes('testmd') ? 'testmd' : 'run',
      template: null,
      page,
      exitCode: r.code,
      timedOut: r.timedOut,
      spawnError: r.spawnError,
      wallSec: r.wallSec,
      ...stream,
      stderrTail: scrub(r.stderr.split(/\r?\n/).filter((l) => !/evidence/i.test(l)).join('\n')).slice(-600),
    };
    if (!stream.firstLineIsJson && stream.lines > 0) flags.push(`${id}: the first stdout line was not JSON (terminal mode)`);
    runs.push(record);
    console.log(
      `spike: ${id} -> exit ${r.code}, ${r.wallSec} s, status ${stream.testMdDone?.overallStatus || stream.runEnd?.status || 'none'}, ` +
        `observed ${stream.runEnd?.observed || '(none)'}`,
    );
    return record;
  };

  const server = await startPage();
  let chosen = null;
  let chosenPass = null;
  let recording = null;
  let failRun = null;
  let replayFail = null;
  let replayPass = null;
  try {
    for (const template of TEMPLATES) {
      const slug = `firstbad-spike-${template}`;
      const rec = await kaneRun(
        `select-${template}`,
        [...KANE, 'run', compose(template, CHECK), '--agent', '--headless', '--timeout', String(TIMEOUT_SEC), '--max-steps', '25', '--name', slug],
        '$18.00',
      );
      if (rec === null) break;
      rec.template = template;
      if (rec.runEnd !== null && valuesMatch(rec.runEnd.observed, CHECK.expected)) {
        chosen = template;
        chosenPass = rec;
        recording = findRecording(kaneCwd, slug);
        break;
      }
    }
    if (chosen !== null) {
      failRun = await kaneRun(
        `fail-page-${chosen}`,
        [...KANE, 'run', compose(chosen, CHECK), '--agent', '--headless', '--timeout', String(TIMEOUT_SEC), '--max-steps', '25'],
        '$20.00',
      );
      if (failRun !== null) failRun.template = chosen;
      if (failRun !== null && !(failRun.runEnd !== null && valuesMatch(failRun.runEnd.observed, '$20.00'))) {
        flags.push('the $20.00 page run did not store $20.00');
      }
      if (recording !== null) {
        const replayArgv = [...KANE, 'testmd', 'run', recording, '--agent', '--headless', '--timeout', String(TIMEOUT_SEC)];
        replayFail = await kaneRun('replay-fail-page', replayArgv, '$20.00');
        replayPass = await kaneRun('replay-pass-page', replayArgv, '$18.00');
      } else {
        flags.push('no --name recording was found under the Kane working directory; replay was not tried');
      }
    } else {
      flags.push('no template candidate stored $18.00 on the pass page');
    }
  } finally {
    server.close();
  }

  const after = await runProcess([...KANE, 'balance'], { cwd: kaneCwd, env: kaneEnv, timeoutMs: 60_000 });
  const balanceAfter = after.code === 0 ? parseBalance(after.stdout) : null;
  const statusOf = (rec) => (rec === null ? null : rec.testMdDone?.overallStatus || rec.runEnd?.status || null);
  const isPass = (s) => s !== null && /^pass/i.test(s);
  const isFail = (s) => s !== null && /^fail/i.test(s);

  let verdictMode = 'status+value';
  if (chosen === 'store-only') {
    verdictMode = 'value-only';
  } else if (chosen !== null && chosenPass !== null && chosenPass.runEnd !== null) {
    const passDisagrees = chosenPass.runEnd.status !== 'passed';
    const failDisagrees =
      failRun !== null && failRun.runEnd !== null && valuesMatch(failRun.runEnd.observed, '$20.00') && failRun.runEnd.status === 'passed';
    if (passDisagrees || failDisagrees) verdictMode = 'value-only';
  }
  const replayHasValues = Boolean(
    replayFail?.runEnd?.observed &&
      valuesMatch(replayFail.runEnd.observed, '$20.00') &&
      replayPass?.runEnd?.observed &&
      valuesMatch(replayPass.runEnd.observed, '$18.00'),
  );
  const decisions = {
    chosenTemplate: chosen,
    verdictMode,
    agentPromptRoute: nestedAgent.ok ? nestedAgent.route : 'stdin',
    localRunEndWellFormed: chosenPass !== null && chosenPass.firstLineIsJson && chosenPass.streamStart && chosenPass.runEnd !== null,
    replayFaithful: isFail(statusOf(replayFail)) && isPass(statusOf(replayPass)),
    replayHasValues,
  };
  const wall = runs.map((r) => r.wallSec);
  const result = {
    spikeVersion: 1,
    ranAt: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
    node: process.version,
    kaneVersion,
    limits: { minBalance: MIN_BALANCE, maxRuns: MAX_RUNS, timeoutSec: TIMEOUT_SEC },
    check: CHECK,
    balance: {
      before: balanceBefore,
      after: balanceAfter,
      delta: balanceBefore !== null && balanceAfter !== null ? Math.round((balanceBefore - balanceAfter) * 10000) / 10000 : null,
      beforeRaw: scrub(before.stdout.trim().split(/\r?\n/)[0] ?? '').slice(0, 200),
    },
    creditsConsumedSum: Math.round(runs.reduce((s, r) => s + (r.runEnd?.creditsConsumed ?? 0), 0) * 100) / 100,
    meanWallSec: wall.length === 0 ? null : Math.round((wall.reduce((a, b) => a + b, 0) / wall.length) * 10) / 10,
    recording: recording === null ? null : path.basename(recording),
    testmdHelp,
    nestedAgent,
    runs,
    decisions,
    flags,
  };
  fs.mkdirSync(path.dirname(RESULT_JSON), { recursive: true });
  fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(RESULT_MD, renderMarkdown(result));
  if (chosen !== null) {
    fs.writeFileSync(
      PROFILE_TS,
      profileSource({
        template: chosen,
        verdictMode,
        agentPromptRoute: decisions.agentPromptRoute,
        source: `day-1 spike ${result.ranAt.slice(0, 10)}`,
      }),
    );
  }
  fs.rmSync(kaneCwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  console.log(`spike: wrote ${path.relative(ROOT, RESULT_JSON)} and ${path.relative(ROOT, RESULT_MD)}`);
  for (const f of flags) console.log(`spike flag: ${f}`);
  return chosen === null ? 1 : 0;
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
```

- [ ] **Step 2: Write the gate script `scripts/spike/check-spike.mjs`**

```js
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
```

- [ ] **Step 3: Run the gate to confirm it fails before the spike has run**
Run: `node scripts/spike/check-spike.mjs`
Expected: FAIL — `FAIL: docs/spike/spike-result.json not found (run node scripts/spike/run-spike.mjs once)`

- [ ] **Step 4: LIVE — run the spike exactly once (spends Kane credits; 5–30 min; run it in the background and wait for it to exit)**
Run: `node scripts/spike/run-spike.mjs`
Expected: progress lines starting `spike:`, then `spike: wrote docs/spike/spike-result.json and docs/spike/kane-spike.md`, exit code 0. Exit 3 means the balance is below `FIRSTBAD_MIN_BALANCE`: report `RESULT: BLOCKED` with that line. Exit 1 means no template stored the value: do not re-run; report `RESULT: BLOCKED` and paste the `spike flag:` lines (the orchestrator surfaces them to the user). Never run it a second time without the orchestrator's say-so.

- [ ] **Step 5: Run the gate to confirm it passes**
Run: `node scripts/spike/check-spike.mjs`
Expected: PASS — the last line is `PASS` (copy any `FLAG:` lines above it into your RESULT report so the orchestrator surfaces them)

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**
Message: `feat(spike): LIVE day-1 Kane spike picks the objective template and verdict mode`

---

### Task 2.1: LIVE spike re-run (attempt 2): store-only on both pages, new wording and key parsing

**Files:**
- Create: `docs/spike/rerun-1-stop.json`
- Modify: `scripts/spike/run-spike.mjs`
- Modify: `scripts/spike/check-spike.mjs`
- Modify: `docs/spike/spike-result.json`
- Modify: `docs/spike/kane-spike.md`
- Modify: `src/kane-profile.ts`

**Depends on:** Task 2, Task 3.1, Task 4
**Effort:** medium
**Model tier:** top
**Priority:** must-have
**Provides:** `docs/spike/spike-result.json spikeVersion 2 attempt 2 { templates[], runs[] (day-1 and attempt-1 runs carried; attempt-2 runs with objective and runEnd.observedKey), observedKeys, decisions { chosenTemplate: 'store-only', verdictMode: 'value-only', agentPromptRoute, localRunEndWellFormed, replayFaithful, replayHasValues } }`, `src/kane-profile.ts rewritten by the re-run (template 'store-only', verdictMode 'value-only')`, `docs/spike/rerun-1-stop.json (attempt-1 evidence, whitelisted fields)`
**Requires:** `docs/spike/spike-result.json decisions { chosenTemplate, verdictMode, agentPromptRoute, localRunEndWellFormed, replayFaithful, replayHasValues }`, `src/kane-profile.ts rewritten with the spike's choices`, `interface ObservedValue { key: string | null; value: string }`, `observedFrom(finalState: unknown): ObservedValue`, `composeObjective(c, 'store-only') returns "Go to {url}, {do}, then store {store} in a variable named 'observed'"`, `composeObjective(c: Check, template: TemplateId): string`, `valuesMatch(a: string, b: string): boolean`

This is a LIVE task: Step 6 spends real Kane credits (2 to 4 runs, roughly 17–22 credits and 2–3 minutes each). It replaces Task 2's template choice (`commas-assert`), which lost the value on the `$20.00` page. Rule (the user's decision, 2026-11-25): **a template is accepted only if it returns the value on both the `$18.00` page and the `$20.00` page.**

**History, carried as evidence and never re-bought:**
- Day 1 (Task 2, commit `af63046`, `docs/spike/spike-result.json` `"spikeVersion": 1`): `select-commas-assert` stored `$18.00` (final_state keys `url, observed`); `fail-page-commas-assert` failed with result_code `710` and `final_state {}`; both `testmd` replays passed with no values (`replayFaithful: false`, `replayHasValues: false`); nested agent ok via `stdin`. So `commas-assert` is eliminated by its recorded `$20.00` run and `sentences-assert` by the same cause, without runs.
- Re-run attempt 1 (the first version of this task, 2026-11-25T16:58Z, never committed): `select-store-only` on the `$18.00` page with the old wording `... then store the total amount shown next to the word Total as 'observed'`: exit 0, `run_end` status `passed`, reason "Objective completed", result_code `100`, final_state keys `url, total`, parsed value empty (the old parser read only `observed` or a one-key `final_state`). Kane's summary: "Read the amount shown next to “Total”: $18.00." It stopped there by design (the `$20.00` page was not run). Balance 11110.4166 → 11091.7249 (delta 18.6917).

Task 3.1 (done before this task) fixed both causes: firstbad now reads `final_state.observed`, else the one key other than `url` (two or more candidate keys give an empty value, never a guess), and the store-only objective now reads `Go to {url}, {do}, then store {store} in a variable named 'observed'`. The upstream signatures this task uses, pasted: `interface ObservedValue { key: string | null; value: string }` and `observedFrom(finalState: unknown): ObservedValue` (Task 3.1, `dist/kane/ndjson.js`); `composeObjective(c: Check, template: TemplateId): string` and `valuesMatch(a: string, b: string): boolean` (Task 4, `dist/check.js`; Task 3.1 changed only the store-only wording). The re-run script **imports these three from `dist/`** instead of keeping copies, so the spike sends exactly firstbad's objective and parses `final_state` with exactly firstbad's rule. That is why `npm run build` (Step 5) must run right before the LIVE step; the script also refuses (exit 4, no credits) when `dist/` is missing or still composes the old wording.

**What the re-run does** (`scripts/spike/run-spike.mjs`, Step 2): refuses with exit 4 (no credits) when `docs/spike/spike-result.json` is already attempt 2 (it accepts the day-1 file and the attempt-1 STOP file), when `dist/` is missing or stale, when the day-1 evidence cannot be read with `git show af63046:docs/spike/spike-result.json`, or when `docs/spike/rerun-1-stop.json` is missing. It refuses with exit 3 (no credits) when `kane-cli balance` cannot be read or is below `FIRSTBAD_MIN_BALANCE` (default 500; about 11,091 now). Budget: **its own cap of 4 credit-consuming runs** (`FIRSTBAD_SPIKE_RERUN_MAX_RUNS`, default 4, values above 4 are clamped to 4, below 2 refuse with exit 3), independent of the day-1 count; `FIRSTBAD_SPIKE_MAX_RUNS` is not read by the re-run. It runs store-only on the `$18.00` page, then on the `$20.00` page, with the probe's argv (`run <objective> --agent --headless --timeout 300 --max-steps 25`). A page whose run returns an empty value (no `run_end`, or no usable `final_state` key) is retried **once**; a non-empty wrong value is not retried. It records for every run the objective, the whitelisted `run_end` fields, the `final_state` key names and `observedKey` (which key the value came from, or `null`), and per page in `observedKeys`. Both pages return their own value (`$18.00`, then `$20.00`) → it chooses `store-only` with verdictMode `value-only` and rewrites `src/kane-profile.ts`, exit 0. Otherwise it **stops** (the `$20.00` page is not run after an `$18.00` failure), prints and records the raw `run_end` fields (status, reason, result_code, final_state keys, observedKey, observed), leaves `src/kane-profile.ts` unchanged and exits 1. It prints the balance before and after either way. It writes `docs/spike/spike-result.json` (`spikeVersion` 2, `attempt` 2, every day-1 run, the attempt-1 run and the attempt-2 runs) and `docs/spike/kane-spike.md`.

**Working-tree state you will find (main checkout) and what you overwrite:** `scripts/spike/run-spike.mjs` and `scripts/spike/check-spike.mjs` may hold uncommitted copies of this task's first version; replace both whole files (Steps 2 and 3). `docs/spike/spike-result.json` and `docs/spike/kane-spike.md` may hold attempt 1's uncommitted STOP output (`spikeVersion` 2 with no `attempt` field); leave them as they are: do not restore, delete or hand-edit them; Step 6 overwrites both, and the script's second-run guard accepts that file (it refuses only `attempt` 2 or later). `src/kane-profile.ts` still holds Task 2's profile:

```ts
export const KANE_PROFILE: KaneProfile = {
  template: 'commas-assert',
  verdictMode: 'status+value',
  agentPromptRoute: 'stdin',
  source: 'day-1 spike 2026-11-25',
};
```

Only Step 6 rewrites it (whole file, same format, only on success). Never hand-edit `src/kane-profile.ts`, `docs/spike/spike-result.json` or `docs/spike/kane-spike.md`. Core code reads only `KANE_PROFILE`; `prepareSession` (Task 6) already forces `value-only` for `store-only`, `classify()` (Task 4) supports `value-only`, and the stub-Kane suites pass under either profile, so no other `src/` file changes.

- [ ] **Step 1: Create `docs/spike/rerun-1-stop.json` with exactly this content (attempt 1's evidence, whitelisted fields only)**

```json
{
  "attempt": 1,
  "ranAt": "2026-11-25T16:58:33.771Z",
  "platform": "win32 x64",
  "node": "v22.23.4",
  "kaneVersion": "0.10.9",
  "objective": "Go to http://127.0.0.1:4199/, look at the order summary, then store the total amount shown next to the word Total as 'observed'",
  "parser": "old rule: final_state.observed, else a final_state with exactly one key; final_state had the keys url and total, so the parsed value was empty (the value of total was not recorded)",
  "balance": {
    "before": 11110.4166,
    "after": 11091.7249,
    "delta": 18.6917
  },
  "creditsConsumedSum": 16.68,
  "stop": "STOP: store-only did not store $18.00 on the $18.00 page (select-store-only): run_end status=passed, reason=\"Objective completed\", result_code=100, final_state keys=[url, total], observed=\"\"",
  "runs": [
    {
      "id": "select-store-only",
      "kind": "run",
      "template": "store-only",
      "page": "$18.00",
      "objective": "Go to http://127.0.0.1:4199/, look at the order summary, then store the total amount shown next to the word Total as 'observed'",
      "exitCode": 0,
      "timedOut": false,
      "spawnError": null,
      "wallSec": 124.5,
      "lines": 14,
      "firstLineIsJson": true,
      "streamStart": true,
      "runEnd": {
        "status": "passed",
        "summary": "Reviewed the order summary as requested.\nRead the amount shown next to “Total”: $18.00.",
        "oneLiner": "reviewed the order summary on the checkout page",
        "reason": "Objective completed",
        "resultCode": "100",
        "creditsConsumed": 16.676782499999998,
        "durationSec": 83,
        "finalStateKeys": [
          "url",
          "total"
        ],
        "observed": "",
        "observedKey": null,
        "blamesTest": false
      },
      "testMdDone": null,
      "errors": []
    }
  ]
}
```

- [ ] **Step 2: Replace `scripts/spike/run-spike.mjs` with the re-run script (whole file)**

```js
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
```

- [ ] **Step 3: Replace the gate `scripts/spike/check-spike.mjs` (whole file)**

```js
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
```

- [ ] **Step 4: Run the gate to confirm it fails before the re-run**
Run: `node scripts/spike/check-spike.mjs`
Expected: FAIL — exit 1; the output contains `the second store-only re-run has not run (npm run build, then node scripts/spike/run-spike.mjs, once)` and `FAIL: the chosen template is` (`commas-assert` with the day-1 file, `none` with attempt 1's STOP file)

- [ ] **Step 5: Build `dist/` so the re-run imports Task 3.1's parser and wording (no credits)**
Run: `npm run build`
Expected: exits 0 with no compiler errors

- [ ] **Step 6: LIVE — run the re-run exactly once (spends Kane credits: 2 to 4 runs, about 5–12 minutes; the orchestrator runs this one command itself, in the background, right after Step 5, and waits for it to exit)**
Run: `node scripts/spike/run-spike.mjs`
Expected: two `spike: ... eliminated without a run: ...` lines, `spike: attempt 1 carried: STOP: ...`, `spike: balance before <n> (floor 500)`, then `rerun2-pass-page` (and `rerun2-pass-page-retry` only if the first returned no value) and `rerun2-fail-page` (and `rerun2-fail-page-retry` likewise), each followed by a `-> exit ..., run_end status=..., reason=..., result_code=..., final_state keys=[...], observedKey=..., observed="..."` line, `spike: stored key per page: $18.00 <key>, $20.00 <key>`, `spike: balance before <n>, after <n>, delta <n> (<k> Kane runs)`, `spike: wrote docs/spike/spike-result.json and docs/spike/kane-spike.md`, `spike: chose store-only (verdict mode value-only); rewrote src/kane-profile.ts`, exit code 0. Copy the stored-key line and the balance line into your RESULT report. Exit 1 means store-only did not return its own value on a page: do not re-run and do not edit any file by hand; report `RESULT: BLOCKED` and paste the `spike flag: STOP: ...` line (it carries the raw run_end status, reason, result_code, final_state keys, observedKey and observed) plus the stored-key and balance lines — the orchestrator takes it to the user. Exit 3 (balance unreadable or below `FIRSTBAD_MIN_BALANCE`, or `FIRSTBAD_SPIKE_RERUN_MAX_RUNS` below 2) or exit 4 (attempt 2 already ran, `dist/` missing or stale — run Step 5 — or the carried evidence is missing): no credits were spent; report `RESULT: BLOCKED` with the `spike:` line it printed. Never run it a second time without the orchestrator's say-so.

- [ ] **Step 7: Type-check the rewritten profile**
Run: `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0 with no output

- [ ] **Step 8: Run the gate to confirm it passes**
Run: `node scripts/spike/check-spike.mjs`
Expected: PASS — the last line is `PASS` (copy the `FLAG:` lines above it, including the stored-key line and the re-run balance line, into your RESULT report so the orchestrator surfaces them)

- [ ] **Step 9: Commit (kernel-performed — no agent runs this)**
Message: `feat(spike): re-run attempt 2 picks store-only (value returned on both pages), value-only verdicts`

---

### Task 3: Kane I/O — scrubber, process helpers, NDJSON parser, runner and the stub kane-cli

**Files:**
- Create: `src/scrub.ts`
- Create: `src/util/proc.ts`
- Create: `src/kane/ndjson.ts`
- Create: `src/kane/runner.ts`
- Create: `test/fixtures/stub-kane.mjs`
- Test: `test/scrub.test.ts`
- Test: `test/ndjson.test.ts`
- Test: `test/runner.test.ts`

**Depends on:** Task 1
**Effort:** high
**Priority:** must-have
**Provides:** `scrub(text: string): string`, `scrubDeep<T>(value: T): T`, `findSecrets(text: string): string[]`, `splitCommand(command: string): string[]`, `killTree(pid: number | undefined): void`, `interface ExecOptions { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs: number; input?: string }`, `interface ExecResult { code: number | null; stdout: string; stderr: string; timedOut: boolean; spawnError: string | null; durationMs: number }`, `execArgv(argv: string[], opts: ExecOptions): Promise<ExecResult>`, `execShell(command: string, opts: ExecOptions): Promise<ExecResult>`, `spawnShell(command: string, opts: { cwd: string; env?: NodeJS.ProcessEnv }): ChildProcess`, `interface KaneRunEnd { status: string; summary: string; oneLiner: string; reason: string; creditsConsumed: number | null; observed: string; testUrl: string | null; resultCode: string | null; durationSec: number | null; blamesTest: boolean }`, `interface KaneTestMdDone { overallStatus: string; durationSec: number | null }`, `interface KaneStream { lines: number; firstLineIsJson: boolean; streamStart: boolean; cliVersion: string | null; runEnd: KaneRunEnd | null; testMdDone: KaneTestMdDone | null; errors: string[]; stepsDone: number; stepsFailed: number }`, `parseKaneStream(stdout: string): KaneStream`, `interface RunKaneOptions { kaneCmd: string[]; objective: string; timeoutSec: number; maxSteps: number; cwd: string; name?: string; label?: string; env?: NodeJS.ProcessEnv; killAfterMs?: number }`, `interface KaneRunResult { exitCode: number | null; killed: boolean; terminalMode: boolean; spawnError: string | null; stream: KaneStream; stderrTail: string; durationMs: number }`, `runKane(o: RunKaneOptions): Promise<KaneRunResult>`, `kaneBalance(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<number | null>`, `kaneVersion(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<string | null>`, `versionAtLeast(version: string, min: string): boolean`, `parseBalance(text: string): number | null`, `test/fixtures/stub-kane.mjs (STUB_KANE_PLAN rules matched on FIRSTBAD_LABEL; scenarios pass, fail, misphrased, error, auth, timeout, hang, upload-failed, crash, prose, false-pass, token-leak, fetch; logs to STUB_KANE_LOG)`
**Requires:** none

Background the code relies on (from the spec): Kane is spawned with `cross-spawn` (it handles the Windows npm `.cmd` shim); stdin is closed so Kane sees a non-TTY; stdout is NDJSON under `--agent`; the first line must be JSON (`stream_start`), otherwise Kane is in terminal mode and never exits, so the runner kills it; `run_end` is the terminal event and only allow-listed fields are kept (never `session_dir`, `context`, raw events or evidence paths); stderr lines that mention `evidence` are dropped; an outer kill timer of `(timeoutSec + 60) s` kills the whole process tree.

- [ ] **Step 1: Write the failing tests**

`test/scrub.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findSecrets, scrub, scrubDeep } from '../src/scrub.js';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdHViIn0.c2lnbmF0dXJlLXN0dWI';

describe('scrub', () => {
  it('redacts bearer tokens, JWT-shaped strings and key=value secrets', () => {
    expect(scrub(`Authorization: Bearer ${JWT}`)).toBe('Authorization: Bearer [redacted]');
    expect(scrub(`token ${JWT} end`)).toBe('token [redacted] end');
    expect(scrub('access_key=abcd1234efgh5678')).toBe('access_key=[redacted]');
    expect(scrub('{"password": "hunter2hunter2"}')).toBe('{"password": "[redacted]"}');
    expect(scrub('total $18.00')).toBe('total $18.00');
  });

  it('scrubs nested strings and finds nothing afterwards', () => {
    const out = scrubDeep({ a: ['Bearer abcdefgh12345678'], b: { c: 'secret: s3cr3tvalue99' }, n: 3, z: null });
    expect(out).toEqual({ a: ['Bearer [redacted]'], b: { c: 'secret: [redacted]' }, n: 3, z: null });
    expect(findSecrets(JSON.stringify(out))).toEqual([]);
    expect(findSecrets('Bearer abcdefgh12345678')).toEqual(['bearer']);
    expect(findSecrets(JWT)).toEqual(['jwt']);
    expect(findSecrets('api_key: zzzzzzzzzzzz')).toEqual(['key-value']);
  });
});
```

`test/ndjson.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { observedOf, parseKaneStream } from '../src/kane/ndjson.js';

const line = (o: Record<string, unknown>): string => JSON.stringify({ v: 1, ts: '2026-11-25T12:00:00Z', ...o });

describe('parseKaneStream', () => {
  it('keeps only allow-listed run_end fields and counts steps', () => {
    const stdout = [
      line({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' }),
      'not json at all',
      line({ step: 1, status: 'running', remark: 'open' }),
      line({ step: 1, status: 'done', remark: 'open' }),
      line({ step: 2, status: 'failed', remark: 'assert' }),
      line({ type: 'warning', code: 'unresolved_variables' }),
      line({ type: 'error', message: 'Chrome CDP not ready' }),
      line({
        type: 'run_end',
        status: 'failed',
        summary: 'Expected "$18.00" but observed "$20.00"',
        one_liner: 'Total wrong',
        reason: { code: 'assertion_error.checkpoint_failed' },
        duration: '12.5',
        credits: 15.2,
        final_state: { observed: '$20.00', other: 'x' },
        context: { header: 'Authorization: Bearer stubsecret1234567890' },
        session_dir: '/tmp/stub-session-dir',
        test_url: 'https://tm.example.invalid/t/1',
        result_code: 720,
        triage: { category: 'automation_bug' },
      }),
    ].join('\n');
    const s = parseKaneStream(stdout);
    expect(s.firstLineIsJson).toBe(true);
    expect(s.streamStart).toBe(true);
    expect(s.cliVersion).toBe('0.10.9');
    expect(s.stepsDone).toBe(1);
    expect(s.stepsFailed).toBe(1);
    expect(s.errors).toEqual(['Chrome CDP not ready']);
    expect(s.runEnd).not.toBeNull();
    expect(s.runEnd?.status).toBe('failed');
    expect(s.runEnd?.observed).toBe('$20.00');
    expect(s.runEnd?.creditsConsumed).toBe(15.2);
    expect(s.runEnd?.durationSec).toBe(12.5);
    expect(s.runEnd?.resultCode).toBe('720');
    expect(s.runEnd?.reason).toContain('assertion_error.checkpoint_failed');
    expect(s.runEnd?.blamesTest).toBe(true);
    expect(s.runEnd?.testUrl).toBe('https://tm.example.invalid/t/1');
    const json = JSON.stringify(s);
    expect(json).not.toContain('stubsecret');
    expect(json).not.toContain('session_dir');
    expect(json).not.toContain('stub-session-dir');
  });

  it('reads test_md_done and reports prose or empty output', () => {
    const s = parseKaneStream(line({ type: 'test_md_done', overall_status: 'passed', duration_s: 4.2 }));
    expect(s.testMdDone).toEqual({ overallStatus: 'passed', durationSec: 4.2 });
    expect(parseKaneStream('Welcome to KaneAI\n' + line({ type: 'stream_start' })).firstLineIsJson).toBe(false);
    expect(parseKaneStream('').lines).toBe(0);
  });

  it('falls back to a single stored key and ignores ambiguous final states', () => {
    expect(observedOf({ observed: ' $18.00 ' })).toBe('$18.00');
    expect(observedOf({ total: 18 })).toBe('18');
    expect(observedOf({ a: 1, b: 2 })).toBe('');
    expect(observedOf({})).toBe('');
    expect(observedOf(null)).toBe('');
    expect(observedOf('x')).toBe('');
  });
});
```

`test/runner.test.ts`:

```ts
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { kaneArgs, kaneBalance, kaneVersion, parseBalance, runKane, versionAtLeast, type RunKaneOptions } from '../src/kane/runner.js';
import { execArgv, splitCommand } from '../src/util/proc.js';

const STUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stub-kane.mjs');
const KANE = [process.execPath, STUB];
const OBJECTIVE = `Go to http://127.0.0.1:1/, look, store the total as 'observed', then assert the stored observed value is "$18.00"`;
let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-runner-'));
});

function stubEnv(plan: unknown, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const planPath = path.join(dir, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(plan));
  const env: NodeJS.ProcessEnv = { ...process.env, STUB_KANE_PLAN: planPath, STUB_KANE_LOG: path.join(dir, 'log.jsonl'), ...extra };
  delete env.KANE_CLI_USER_AGENT;
  return env;
}

function run(scenario: string, value?: string, extra: Partial<RunKaneOptions> = {}) {
  return runKane({
    kaneCmd: KANE,
    objective: OBJECTIVE,
    timeoutSec: 30,
    maxSteps: 25,
    cwd: dir,
    label: 'bracket|bad ref|c9',
    env: stubEnv({ default: { scenario, value } }),
    ...extra,
  });
}

describe('runKane against the stub', () => {
  it('parses a passing run and keeps secrets and evidence paths out', async () => {
    const r = await run('pass');
    expect(r.exitCode).toBe(0);
    expect(r.stream.runEnd?.status).toBe('passed');
    expect(r.stream.runEnd?.observed).toBe('$18.00');
    expect(r.stderrTail).not.toContain('evidence');
    const json = JSON.stringify(r);
    expect(json).not.toContain('session_dir');
    expect(json).not.toContain('stubsecret');
  });

  it('passes the agent flags, the label and the user agent', async () => {
    await run('pass', undefined, { name: 'firstbad-probe' });
    const logged = JSON.parse(fs.readFileSync(path.join(dir, 'log.jsonl'), 'utf8').trim().split('\n')[0] ?? '{}') as {
      argv: string[];
      label: string;
      userAgent: string | null;
    };
    expect(logged.argv).toEqual(['run', OBJECTIVE, '--agent', '--headless', '--timeout', '30', '--max-steps', '25', '--name', 'firstbad-probe']);
    expect(logged.label).toBe('bracket|bad ref|c9');
    expect(logged.userAgent).toBe('firstbad');
    expect(kaneArgs({ kaneCmd: KANE, objective: 'o', timeoutSec: 5, maxSteps: 3, cwd: dir })).toEqual([
      'run', 'o', '--agent', '--headless', '--timeout', '5', '--max-steps', '3',
    ]);
  });

  it('treats an upload failure as exit 1 with a passed run_end', async () => {
    const r = await run('upload-failed');
    expect(r.exitCode).toBe(1);
    expect(r.stream.runEnd?.status).toBe('passed');
  });

  it('reports a failing value and scrubs leaked tokens', async () => {
    const fail = await run('fail', '$20.00');
    expect(fail.exitCode).toBe(1);
    expect(fail.stream.runEnd?.observed).toBe('$20.00');
    expect(fail.stream.runEnd?.summary).toContain('Expected "$18.00"');
    const leak = await run('token-leak', '$20.00');
    expect(leak.stream.runEnd?.reason).toContain('[redacted]');
    expect(JSON.stringify(leak)).not.toContain('eyJ');
  });

  it('handles crash, error, hang, prose and a missing binary', async () => {
    const crash = await run('crash');
    expect(crash.stream.runEnd).toBeNull();
    expect(crash.exitCode).toBe(1);
    expect(crash.stderrTail).toContain('fetch failed');
    const error = await run('error');
    expect(error.exitCode).toBe(2);
    expect(error.stream.errors[0]).toContain('CDP');
    const hang = await run('hang', undefined, { killAfterMs: 1500 });
    expect(hang.killed).toBe(true);
    expect(hang.exitCode).toBeNull();
    const prose = await run('prose');
    expect(prose.terminalMode).toBe(true);
    expect(prose.killed).toBe(true);
    const missing = await run('pass', undefined, { kaneCmd: ['firstbad-no-such-kane-cli-xyz'] });
    expect(missing.spawnError).toBe('ENOENT');
  });

  it('reads a served page in fetch mode', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('$18.00\n');
    });
    await new Promise<void>((resolve) => server.listen(4305, '127.0.0.1', () => resolve()));
    try {
      const r = await runKane({
        kaneCmd: KANE,
        objective: OBJECTIVE.replace('http://127.0.0.1:1/', 'http://127.0.0.1:4305/'),
        timeoutSec: 30,
        maxSteps: 25,
        cwd: dir,
        env: stubEnv({ default: { scenario: 'fetch' } }),
      });
      expect(r.exitCode).toBe(0);
      expect(r.stream.runEnd?.observed).toBe('$18.00');
    } finally {
      server.close();
    }
  });
});

describe('balance, version and process helpers', () => {
  it('parses balance and version', async () => {
    expect(await kaneBalance(KANE, stubEnv({}, { STUB_KANE_BALANCE: '1,234.5' }))).toBe(1234.5);
    expect(await kaneVersion(KANE, stubEnv({}))).toBe('0.10.9');
    expect(parseBalance('Available credits: 11178.5769')).toBe(11178.5769);
    expect(parseBalance('no digits here')).toBeNull();
    expect(versionAtLeast('0.10.9', '0.10.9')).toBe(true);
    expect(versionAtLeast('0.11.0', '0.10.9')).toBe(true);
    expect(versionAtLeast('0.10.8', '0.10.9')).toBe(false);
    expect(versionAtLeast('1.0.0', '0.10.9')).toBe(true);
  });

  it('splits commands and pipes stdin', async () => {
    expect(splitCommand('claude -p --allowedTools Read,Edit')).toEqual(['claude', '-p', '--allowedTools', 'Read,Edit']);
    expect(splitCommand('"C:\\Program Files\\node.exe" "C:\\a b\\stub.mjs"')).toEqual(['C:\\Program Files\\node.exe', 'C:\\a b\\stub.mjs']);
    expect(splitCommand("node 'x y.js'")).toEqual(['node', 'x y.js']);
    expect(() => splitCommand('node "unterminated')).toThrow(/unterminated/);
    const echo = await execArgv([process.execPath, '-e', 'process.stdin.pipe(process.stdout)'], { cwd: dir, timeoutMs: 20_000, input: 'hi' });
    expect(echo.code).toBe(0);
    expect(echo.stdout).toBe('hi');
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**
Run: `npx vitest run test/scrub.test.ts test/ndjson.test.ts test/runner.test.ts`
Expected: FAIL — `Failed to load url ../src/scrub.js` (the modules do not exist yet)

- [ ] **Step 3: Write `src/scrub.ts`**

```ts
interface SecretPattern {
  name: string;
  re: RegExp;
}

const PATTERNS: SecretPattern[] = [
  { name: 'bearer', re: /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  { name: 'jwt', re: /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g },
  { name: 'key-value', re: /\b(access[_-]?key|api[_-]?key|apikey|token|secret|password)(["']?\s*[:=]\s*["']?)[^\s"',;[\]]{8,}/gi },
];

export function scrub(text: string): string {
  return text
    .replace(PATTERNS[0]!.re, 'Bearer [redacted]')
    .replace(PATTERNS[1]!.re, '[redacted]')
    .replace(PATTERNS[2]!.re, (_match: string, key: string, sep: string) => `${key}${sep}[redacted]`);
}

export function scrubDeep<T>(value: T): T {
  if (typeof value === 'string') return scrub(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item: unknown) => scrubDeep(item)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = scrubDeep(item);
    return out as unknown as T;
  }
  return value;
}

export function findSecrets(text: string): string[] {
  return PATTERNS.filter((p) => new RegExp(p.re.source, p.re.flags.replace('g', '')).test(text)).map((p) => p.name);
}
```

- [ ] **Step 4: Write `src/util/proc.ts`**

```ts
import { spawn as nodeSpawn, spawnSync, type ChildProcess } from 'node:child_process';
import spawn from 'cross-spawn';

export interface ExecOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  input?: string;
}

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError: string | null;
  durationMs: number;
}

// Shell-style split: whitespace separates, "double" and 'single' quotes group; backslashes are literal
// (so Windows paths survive).
export function splitCommand(command: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
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

// Kills a process and everything it started. POSIX children are spawned detached (own process group).
export function killTree(pid: number | undefined): void {
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
      // the process is already gone
    }
  }
}

function collect(child: ChildProcess, opts: ExecOptions, started: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, opts.timeoutMs);
    const finish = (code: number | null, spawnError: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: timedOut ? null : code, stdout, stderr, timedOut, spawnError, durationMs: Date.now() - started });
    };
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err: NodeJS.ErrnoException) => finish(null, err.code ?? err.message));
    child.on('close', (code: number | null) => finish(code, null));
    if (child.stdin) {
      child.stdin.on('error', () => undefined);
      child.stdin.end(opts.input ?? '');
    }
  });
}

export function execArgv(argv: string[], opts: ExecOptions): Promise<ExecResult> {
  const [command, ...args] = argv;
  if (command === undefined) return Promise.reject(new Error('execArgv: empty argv'));
  const started = Date.now();
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  return collect(child, opts, started);
}

export function execShell(command: string, opts: ExecOptions): Promise<ExecResult> {
  const started = Date.now();
  const child = nodeSpawn(command, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    shell: true,
    stdio: [opts.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  return collect(child, opts, started);
}

export function spawnShell(command: string, opts: { cwd: string; env?: NodeJS.ProcessEnv }): ChildProcess {
  return nodeSpawn(command, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
}
```

- [ ] **Step 5: Write `src/kane/ndjson.ts`**

```ts
import { scrub } from '../scrub.js';

export interface KaneRunEnd {
  status: string;
  summary: string;
  oneLiner: string;
  reason: string;
  creditsConsumed: number | null;
  observed: string;
  testUrl: string | null;
  resultCode: string | null;
  durationSec: number | null;
  blamesTest: boolean;
}

export interface KaneTestMdDone {
  overallStatus: string;
  durationSec: number | null;
}

export interface KaneStream {
  lines: number;
  firstLineIsJson: boolean;
  streamStart: boolean;
  cliVersion: string | null;
  runEnd: KaneRunEnd | null;
  testMdDone: KaneTestMdDone | null;
  errors: string[];
  stepsDone: number;
  stepsFailed: number;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

// The stored value lives under final_state.observed; a final_state with exactly one key is accepted too.
export function observedOf(finalState: unknown): string {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return '';
  const record = finalState as Record<string, unknown>;
  if ('observed' in record) return text(record.observed).trim();
  const keys = Object.keys(record);
  if (keys.length === 1) {
    const only = keys[0];
    return only === undefined ? '' : text(record[only]).trim();
  }
  return '';
}

function toRunEnd(o: Record<string, unknown>, line: string): KaneRunEnd {
  return {
    status: text(o.status),
    summary: scrub(text(o.summary)).slice(0, 500),
    oneLiner: scrub(text(o.one_liner)).slice(0, 300),
    reason: scrub(text(o.reason)).slice(0, 500),
    creditsConsumed: num(o.credits_consumed) ?? num(o.credits),
    observed: scrub(observedOf(o.final_state)).slice(0, 200),
    testUrl: typeof o.test_url === 'string' && o.test_url !== '' ? scrub(o.test_url) : null,
    resultCode: o.result_code === undefined || o.result_code === null ? null : text(o.result_code),
    durationSec: num(o.duration),
    blamesTest: /automation_bug|config_issue/.test(line),
  };
}

export function parseKaneStream(stdout: string): KaneStream {
  const stream: KaneStream = {
    lines: 0,
    firstLineIsJson: false,
    streamStart: false,
    cliVersion: null,
    runEnd: null,
    testMdDone: null,
    errors: [],
    stepsDone: 0,
    stepsFailed: 0,
  };
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim() !== '');
  stream.lines = lines.length;
  lines.forEach((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
    const o = parsed as Record<string, unknown>;
    if (index === 0) stream.firstLineIsJson = true;
    const type = typeof o.type === 'string' ? o.type : undefined;
    if (type === 'stream_start') {
      stream.streamStart = true;
      stream.cliVersion = typeof o.cli_version === 'string' ? o.cli_version : null;
    } else if (type === 'run_end') {
      stream.runEnd = toRunEnd(o, line);
    } else if (type === 'test_md_done') {
      stream.testMdDone = { overallStatus: text(o.overall_status), durationSec: num(o.duration_s) };
    } else if (type === 'error') {
      stream.errors.push(scrub(text(o.message ?? o.error ?? o)).slice(0, 500));
    } else if (type === undefined && 'step' in o) {
      if (o.status === 'done') stream.stepsDone += 1;
      else if (o.status === 'failed') stream.stepsFailed += 1;
    }
  });
  return stream;
}
```

- [ ] **Step 6: Write `src/kane/runner.ts`**

```ts
import os from 'node:os';
import spawn from 'cross-spawn';
import { scrub } from '../scrub.js';
import { execArgv, killTree } from '../util/proc.js';
import { parseKaneStream, type KaneStream } from './ndjson.js';

export interface RunKaneOptions {
  kaneCmd: string[];
  objective: string;
  timeoutSec: number;
  maxSteps: number;
  cwd: string;
  name?: string;
  label?: string;
  env?: NodeJS.ProcessEnv;
  killAfterMs?: number;
}

export interface KaneRunResult {
  exitCode: number | null;
  killed: boolean;
  terminalMode: boolean;
  spawnError: string | null;
  stream: KaneStream;
  stderrTail: string;
  durationMs: number;
}

export function kaneArgs(o: RunKaneOptions): string[] {
  const args = ['run', o.objective, '--agent', '--headless', '--timeout', String(o.timeoutSec), '--max-steps', String(o.maxSteps)];
  if (o.name !== undefined) args.push('--name', o.name);
  return args;
}

export function kaneEnv(base: NodeJS.ProcessEnv, label: string | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  if (env.KANE_CLI_USER_AGENT === undefined || env.KANE_CLI_USER_AGENT === '') env.KANE_CLI_USER_AGENT = 'firstbad';
  if (label !== undefined) env.FIRSTBAD_LABEL = label;
  return env;
}

export function stderrTail(stderr: string): string {
  const kept = stderr
    .split(/\r?\n/)
    .filter((l) => !/evidence/i.test(l))
    .join('\n');
  return scrub(kept).slice(-2000);
}

function isJsonObject(line: string): boolean {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null;
  } catch {
    return false;
  }
}

export function runKane(o: RunKaneOptions): Promise<KaneRunResult> {
  const [command, ...prefix] = o.kaneCmd;
  if (command === undefined) return Promise.reject(new Error('runKane: empty kaneCmd'));
  const started = Date.now();
  const killAfterMs = o.killAfterMs ?? (o.timeoutSec + 60) * 1000;
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let terminalMode = false;
    let firstLineChecked = false;
    let settled = false;
    const child = spawn(command, [...prefix, ...kaneArgs(o)], {
      cwd: o.cwd,
      env: kaneEnv(o.env ?? process.env, o.label),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    const timer = setTimeout(() => {
      killed = true;
      killTree(child.pid);
    }, killAfterMs);
    const finish = (exitCode: number | null, spawnError: string | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        killed,
        terminalMode,
        spawnError,
        stream: parseKaneStream(stdout),
        stderrTail: stderrTail(stderr),
        durationMs: Date.now() - started,
      });
    };
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      if (firstLineChecked) return;
      const complete = stdout.split(/\r?\n/).slice(0, -1);
      const first = complete.find((l) => l.trim() !== '');
      if (first === undefined) return;
      firstLineChecked = true;
      if (!isJsonObject(first.trim())) {
        terminalMode = true;
        killed = true;
        killTree(child.pid);
      }
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err: NodeJS.ErrnoException) => finish(null, err.code ?? err.message));
    child.on('close', (code: number | null) => finish(killed ? null : code, null));
  });
}

export function parseBalance(text: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(text);
  if (m === null || m[1] === undefined) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export async function kaneBalance(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<number | null> {
  const r = await execArgv([...kaneCmd, 'balance'], { cwd: os.tmpdir(), env: kaneEnv(env ?? process.env, undefined), timeoutMs: 60_000 });
  return r.code === 0 ? parseBalance(r.stdout) : null;
}

export async function kaneVersion(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<string | null> {
  const r = await execArgv([...kaneCmd, '--version'], { cwd: os.tmpdir(), env: kaneEnv(env ?? process.env, undefined), timeoutMs: 60_000 });
  if (r.code !== 0) return null;
  const m = /(\d+\.\d+\.\d+)/.exec(r.stdout);
  return m === null || m[1] === undefined ? null : m[1];
}

export function versionAtLeast(version: string, min: string): boolean {
  const a = version.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const b = min.split('.').map((p) => Number.parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}
```

- [ ] **Step 7: Write the stub kane-cli `test/fixtures/stub-kane.mjs`**

Plan file format (`STUB_KANE_PLAN` points at it): `{ "default": { "scenario": "<name>", "value": "<optional>" }, "rules": [ { "labelIncludes": "<substring of FIRSTBAD_LABEL>", "steps": [ { "scenario": "...", "value": "..." } ] } ] }`. The n-th call that matches a rule uses `steps[n]` (the last step repeats); call counts live in `<STUB_KANE_LOG>.state.json`. With no plan the stub passes.

```js
#!/usr/bin/env node
// Stub kane-cli for firstbad's tests. Never contacts TestMu. Emits the documented --agent NDJSON contract.
import fs from 'node:fs';
import http from 'node:http';

const args = process.argv.slice(2);
const env = process.env;

function emit(obj) {
  process.stdout.write(JSON.stringify({ v: 1, ts: new Date().toISOString(), ...obj }) + '\n');
}

function readPlan() {
  if (!env.STUB_KANE_PLAN) return { default: { scenario: 'pass' } };
  return JSON.parse(fs.readFileSync(env.STUB_KANE_PLAN, 'utf8'));
}

function nextCall(ruleKey) {
  if (!env.STUB_KANE_LOG) return 0;
  const stateFile = env.STUB_KANE_LOG + '.state.json';
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    state = {};
  }
  const n = typeof state[ruleKey] === 'number' ? state[ruleKey] : 0;
  state[ruleKey] = n + 1;
  fs.writeFileSync(stateFile, JSON.stringify(state));
  return n;
}

function pickStep(label) {
  const plan = readPlan();
  const rules = Array.isArray(plan.rules) ? plan.rules : [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (typeof rule.labelIncludes === 'string' && label.includes(rule.labelIncludes)) {
      const steps = Array.isArray(rule.steps) && rule.steps.length > 0 ? rule.steps : [{ scenario: 'pass' }];
      const n = nextCall('rule' + i);
      return steps[Math.min(n, steps.length - 1)];
    }
  }
  return plan.default ?? { scenario: 'pass' };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { agent: false, timeout: 5000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => {
        body += d;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function start() {
  emit({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' });
  emit({ step: 1, status: 'running', remark: 'Opening the page' });
  emit({ step: 1, status: 'done', remark: 'Opened the page' });
}

function runEnd(status, value, extra) {
  emit({
    type: 'run_end',
    status,
    summary: status === 'passed' ? `Verified the stored observed value is "${value}"` : `Stored "${value}"`,
    one_liner: status === 'passed' ? 'Check passed' : 'Check failed',
    reason: '',
    duration: 1.5,
    credits_consumed: 12.5,
    final_state: value === undefined ? {} : { observed: value },
    context: { note: 'Authorization: Bearer stubsecret1234567890' },
    session_dir: '/tmp/stub-session-dir',
    test_url: 'https://kane.example.invalid/test-manager/stub',
    result_code: status === 'passed' ? '700' : '720',
    ...(extra ?? {}),
  });
}

function hangForever() {
  return new Promise(() => {
    setInterval(() => undefined, 1000);
  });
}

async function main() {
  if (args[0] === '--version') {
    process.stdout.write('0.10.9\n');
    return 0;
  }
  if (args[0] === 'balance') {
    process.stdout.write(`Available credits: ${env.STUB_KANE_BALANCE ?? '11178.5769'}\n`);
    return 0;
  }
  if (args[0] === 'whoami') {
    process.stdout.write('Authenticated (stub profile)\n');
    return 0;
  }
  if (args[0] !== 'run') {
    process.stderr.write(`stub-kane: unsupported command: ${args.join(' ')}\n`);
    return 2;
  }
  const objective = args[1] ?? '';
  const label = env.FIRSTBAD_LABEL ?? '';
  const expectedMatch = /"([^"]*)"\.?\s*$/.exec(objective);
  const expected = expectedMatch ? expectedMatch[1] : '';
  if (env.STUB_KANE_LOG) {
    fs.appendFileSync(
      env.STUB_KANE_LOG,
      JSON.stringify({ argv: args, label, cwd: process.cwd(), userAgent: env.KANE_CLI_USER_AGENT ?? null }) + '\n',
    );
  }
  const step = pickStep(label);
  const scenario = step.scenario ?? 'pass';
  const value = step.value;
  process.stderr.write('evidence: view locally with kane-cli evidence serve /tmp/stub/run.evidence\n');
  switch (scenario) {
    case 'pass':
      start();
      runEnd('passed', value ?? expected);
      return 0;
    case 'fail': {
      const v = value ?? '$20.00';
      start();
      emit({ step: 2, status: 'failed', remark: 'Assertion failed' });
      runEnd('failed', v, { summary: `Expected "${expected}" but observed "${v}"`, reason: 'assertion_error.checkpoint_failed' });
      return 1;
    }
    case 'misphrased':
      start();
      runEnd('failed', undefined, {
        summary: 'The stored observed value was not found',
        reason: 'assertion_error.checkpoint_failed',
        triage: { category: 'automation_bug', sub_category: 'config_issue', confidence: 0.96 },
      });
      return 1;
    case 'error':
      emit({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' });
      emit({ type: 'error', message: 'Chrome CDP not ready after 30000ms' });
      return 2;
    case 'auth':
      emit({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' });
      emit({ type: 'error', message: 'Authentication failed: token expired. Run kane-cli login.' });
      return 2;
    case 'timeout':
      start();
      process.stderr.write('Run cancelled: --timeout reached\n');
      return 3;
    case 'hang':
      emit({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' });
      await hangForever();
      return 0;
    case 'upload-failed':
      start();
      runEnd('passed', value ?? expected, { reason: 'Upload failed: Test Manager unreachable' });
      return 1;
    case 'crash':
      process.stderr.write('TypeError: fetch failed\n    at stub (stub-kane.mjs:1:1)\n');
      return 1;
    case 'prose':
      process.stdout.write('Welcome to KaneAI - press q to quit\n');
      await hangForever();
      return 0;
    case 'false-pass':
      start();
      runEnd('passed', value ?? '$20.00');
      return 0;
    case 'token-leak': {
      const v = value ?? '$20.00';
      start();
      runEnd('failed', v, {
        summary: `Expected "${expected}" but observed "${v}"`,
        reason: 'Request failed with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdHViIn0.c2lnbmF0dXJlLXN0dWI',
      });
      return 1;
    }
    case 'fetch': {
      const m = /Go to (https?:\/\/[^\s,]+)/.exec(objective);
      const url = m ? m[1].replace(/\.$/, '') : '';
      let observed = '';
      try {
        const r = await fetchText(url);
        observed = r.body.trim();
      } catch (err) {
        emit({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' });
        emit({ type: 'error', message: `page unreachable: ${err instanceof Error ? err.message : String(err)}` });
        return 2;
      }
      start();
      if (observed === '') {
        runEnd('failed', undefined, { summary: 'Nothing to store on the page' });
        return 1;
      }
      const passed = expected === '' || observed === expected;
      runEnd(
        passed ? 'passed' : 'failed',
        observed,
        passed ? {} : { summary: `Expected "${expected}" but observed "${observed}"`, reason: 'assertion_error.checkpoint_failed' },
      );
      return passed ? 0 : 1;
    }
    default:
      process.stderr.write(`stub-kane: unknown scenario ${scenario}\n`);
      return 2;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    process.exitCode = 2;
  },
);
```

- [ ] **Step 8: Run the gate to confirm it passes**
Run: `npx vitest run test/scrub.test.ts test/ndjson.test.ts test/runner.test.ts`
Expected: PASS — output contains `Test Files  3 passed`

- [ ] **Step 9: Commit (kernel-performed — no agent runs this)**
Message: `feat(kane): scrubber, process helpers, NDJSON parser, Kane runner and stub kane-cli`

---

### Task 3.1: Observed-key parsing and the store-only wording

**Files:**
- Modify: `src/kane/ndjson.ts`
- Modify: `src/check.ts`
- Modify: `test/check.test.ts`
- Test: `test/observed.test.ts`

**Depends on:** Task 3, Task 4, Task 5, Task 6, Task 12
**Effort:** medium
**Priority:** must-have
**Provides:** `interface ObservedValue { key: string | null; value: string }`, `observedFrom(finalState: unknown): ObservedValue`, `observedOf(finalState: unknown): string`, `composeObjective(c, 'store-only') returns "Go to {url}, {do}, then store {store} in a variable named 'observed'"`
**Requires:** `parseKaneStream(stdout: string): KaneStream`, `interface KaneRunResult { exitCode: number | null; killed: boolean; terminalMode: boolean; spawnError: string | null; stream: KaneStream; stderrTail: string; durationMs: number }`, `composeObjective(c: Check, template: TemplateId): string`, `classify(i: ClassifyInput): Classification`, `interface ClassifyInput { setup?: StepOutcome; ready?: StepOutcome; kane?: KaneRunResult; expected: string; badValue: string | null; mode: VerdictMode }`

Why (the user's decision, 2026-11-25, after the first spike re-run attempt): with the objective `Go to http://127.0.0.1:4199/, look at the order summary, then store the total amount shown next to the word Total as 'observed'`, Kane read the right value (summary "Read the amount shown next to “Total”: $18.00.", status `passed`, result_code `100`) but stored it under its own key: `final_state` had the keys `url` and `total`. firstbad's `observedOf()` accepted only `final_state.observed` or a `final_state` with exactly one key, so it returned an empty value and the re-run stopped. This task changes two things and nothing else:

1. **Parser rule** (`src/kane/ndjson.ts`): use `final_state.observed` if that key is present; otherwise, if exactly **one** key other than `url` exists, use that key's value; if two or more candidate keys exist (or none), the value is empty — it is then retried once like any empty value (Task 4's `classify()` already does that) — and firstbad never guesses between keys. The new `observedFrom()` also returns which key it read, so the spike re-run (Task 2.1) can record it. `observedOf()` keeps its signature and now delegates to `observedFrom()`.
2. **store-only wording** (`src/check.ts`): `Go to {url}, {do}, then store {store} in a variable named 'observed'` (still comma-chained, still no `{{…}}`). `commas-assert` and `sentences-assert` are unchanged.

The safeguards stay exactly as they are: `toRunEnd()` still puts the value into `KaneRunEnd.observed`, and `classify()` (Task 4, not touched) still compares it with the expected value and with the bad ref's value, and in `status+value` mode a status/value disagreement is still SKIP. A value read from a key other than `observed` gets no shortcut; the new test proves it goes through the same rule.

No interface changes: `interface KaneRunEnd { status: string; summary: string; oneLiner: string; reason: string; creditsConsumed: number | null; observed: string; testUrl: string | null; resultCode: string | null; durationSec: number | null; blamesTest: boolean }` and `parseKaneStream(stdout: string): KaneStream` keep their exact signatures, so no consumer (Tasks 4–9, 12, 13) changes. The upstream signatures this task's test uses, pasted for reference: `parseKaneStream(stdout: string): KaneStream` and `interface KaneRunResult { exitCode: number | null; killed: boolean; terminalMode: boolean; spawnError: string | null; stream: KaneStream; stderrTail: string; durationMs: number }` (Task 3); `classify(i: ClassifyInput): Classification` with `interface ClassifyInput { setup?: StepOutcome; ready?: StepOutcome; kane?: KaneRunResult; expected: string; badValue: string | null; mode: VerdictMode }` and `composeObjective(c: Check, template: TemplateId): string` (Task 4).

What else was checked, so you do not need to touch it:
- `test/ndjson.test.ts` stays as it is: its `observedOf` cases (`{ observed: ' $18.00 ' }` → `$18.00`, `{ total: 18 }` → `18`, `{ a: 1, b: 2 }` → empty, `{}`, `null`, `'x'` → empty) all hold under the new rule. The only behaviour that changes is a `final_state` whose keys include `url`: `{ url, total }` now gives `total`'s value, and `{ url }` alone now gives an empty value (before, it returned the URL itself).
- `test/fixtures/stub-kane.mjs` and `test/fixtures/stub-kane-shop.mjs` emit `final_state: { observed }` (or `{}`) and only read `Go to <url>`, the discount code and a trailing double-quoted expected value from the objective. The store-only objective has no trailing double-quoted value with either wording, so both stubs behave exactly as before. No stub changes.
- `test/runner.test.ts` and `test/demo-config.test.ts` hard-code `commas-assert`-style objectives, which do not change.
- `scripts/spike/run-spike.mjs` (Task 2.1) imports `composeObjective`, `valuesMatch` and `observedFrom` from `dist/` after `npm run build`, so the spike and firstbad share one implementation; that is why the comment above `composeObjective` changes.

Every edit below is an exact-string replacement (the `find` text appears exactly once in its file) or a new file. The repo's working tree may use CRLF line endings; match line by line.

- [ ] **Step 1: Write the failing test `test/observed.test.ts` (new file)**

```ts
import { describe, expect, it } from 'vitest';
import { observedFrom, observedOf, parseKaneStream } from '../src/kane/ndjson.js';
import type { KaneRunResult } from '../src/kane/runner.js';
import { classify } from '../src/verdict.js';

function stdoutWith(finalState: unknown, status: string): string {
  return [
    JSON.stringify({ v: 1, type: 'stream_start', cli_version: '0.10.9' }),
    JSON.stringify({
      v: 1,
      type: 'run_end',
      status,
      summary: 'Read the amount shown next to Total',
      reason: 'Objective completed',
      result_code: 100,
      final_state: finalState,
    }),
  ].join('\n');
}

function kaneResult(finalState: unknown, status = 'passed'): KaneRunResult {
  return {
    exitCode: 0,
    killed: false,
    terminalMode: false,
    spawnError: null,
    stream: parseKaneStream(stdoutWith(finalState, status)),
    stderrTail: '',
    durationMs: 10,
  };
}

const URL = 'http://127.0.0.1:4173/';

describe('observedFrom: which final_state key holds the stored value', () => {
  it('uses final_state.observed when it is present, even next to other keys', () => {
    expect(observedFrom({ url: URL, observed: ' $18.00 ' })).toEqual({ key: 'observed', value: '$18.00' });
    expect(observedFrom({ observed: '$20.00', total: '$18.00' })).toEqual({ key: 'observed', value: '$20.00' });
  });

  it('uses the one key other than url when observed is missing', () => {
    expect(observedFrom({ url: URL, total: '$18.00' })).toEqual({ key: 'total', value: '$18.00' });
    expect(observedFrom({ total: 18 })).toEqual({ key: 'total', value: '18' });
    expect(observedOf({ url: URL, total: '$18.00' })).toBe('$18.00');
  });

  it('treats several candidate keys, or none, as an empty value and never guesses', () => {
    expect(observedFrom({ url: URL, total: '$18.00', subtotal: '$20.00' })).toEqual({ key: null, value: '' });
    expect(observedFrom({ url: URL })).toEqual({ key: null, value: '' });
    expect(observedFrom({})).toEqual({ key: null, value: '' });
    expect(observedFrom(null)).toEqual({ key: null, value: '' });
    expect(observedFrom(['$18.00'])).toEqual({ key: null, value: '' });
    expect(observedOf({ a: '$18.00', b: '$20.00' })).toBe('');
  });
});

describe('a value read from another key still goes through the verdict rule', () => {
  it('parses run_end.observed from the single other key', () => {
    expect(parseKaneStream(stdoutWith({ url: URL, total: '$20.00' }, 'passed')).runEnd?.observed).toBe('$20.00');
  });

  it('compares it with the expected value and with the bad ref value', () => {
    const total = (v: string): KaneRunResult => kaneResult({ url: URL, total: v });
    expect(classify({ kane: total('$18.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('PASS');
    expect(classify({ kane: total('$20.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('FAIL');
    const third = classify({ kane: total('$7.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' });
    expect(third.verdict).toBe('SKIP');
    expect(third.reason).toContain("differs from the bad ref's $20.00");
  });

  it('keeps a status/value disagreement a SKIP', () => {
    const c = classify({ kane: kaneResult({ url: URL, total: '$18.00' }, 'failed'), expected: '$18.00', badValue: '$20.00', mode: 'status+value' });
    expect(c.verdict).toBe('SKIP');
    expect(c.reason).toContain('Kane and the stored value disagree');
  });

  it('retries several candidate keys like any empty value', () => {
    const c = classify({ kane: kaneResult({ url: URL, total: '$18.00', subtotal: '$20.00' }), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(c.verdict).toBe('SKIP');
    expect(c.emptyValue).toBe(true);
    expect(c.retryable).toBe(true);
  });
});
```

- [ ] **Step 2: `test/check.test.ts` — update the store-only expectation**

Replace this line (inside the `builds the three cookbook-style candidates exactly and never emits {{` test):

```ts
      "Go to http://127.0.0.1:4173/, add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply, then store the total amount shown next to the word Total as 'observed'",
```

with:

```ts
      "Go to http://127.0.0.1:4173/, add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply, then store the total amount shown next to the word Total in a variable named 'observed'",
```

- [ ] **Step 3: Run them to confirm they fail**
Run: `npx vitest run test/observed.test.ts test/check.test.ts`
Expected: FAIL — `test/observed.test.ts` fails with `TypeError: (0 , observedFrom) is not a function`, and `test/check.test.ts` fails on the store-only expectation (`... as 'observed'` received, `... in a variable named 'observed'` expected)

- [ ] **Step 4: `src/kane/ndjson.ts` — replace `observedOf` with the new rule**

Replace this block (it sits between `function num(...)` and `function toRunEnd(...)`):

```ts
// The stored value lives under final_state.observed; a final_state with exactly one key is accepted too.
export function observedOf(finalState: unknown): string {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return '';
  const record = finalState as Record<string, unknown>;
  if ('observed' in record) return text(record.observed).trim();
  const keys = Object.keys(record);
  if (keys.length === 1) {
    const only = keys[0];
    return only === undefined ? '' : text(record[only]).trim();
  }
  return '';
}
```

with:

```ts
// Which final_state key holds the stored value (spec section 4): 'observed' when present; otherwise the only
// key other than 'url'; two or more candidate keys give an empty value (retried once), never a guess between keys.
export interface ObservedValue {
  key: string | null;
  value: string;
}

export function observedFrom(finalState: unknown): ObservedValue {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return { key: null, value: '' };
  const record = finalState as Record<string, unknown>;
  if ('observed' in record) return { key: 'observed', value: text(record.observed).trim() };
  const candidates = Object.keys(record).filter((k) => k !== 'url');
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only === undefined) return { key: null, value: '' };
  return { key: only, value: text(record[only]).trim() };
}

export function observedOf(finalState: unknown): string {
  return observedFrom(finalState).value;
}
```

Leave everything else in the file as it is (`toRunEnd()` keeps calling `observedOf(o.final_state)`).

- [ ] **Step 5: `src/check.ts` — two replacements**

Replace:

```ts
// Spec section 3. Must stay identical to compose() in scripts/spike/run-spike.mjs.
```

with:

```ts
// Spec section 3. scripts/spike/run-spike.mjs imports this from dist/check.js, so the spike sends exactly these objectives.
```

Replace:

```ts
      return `Go to ${url}, ${d}, then store ${st} as 'observed'`;
```

with:

```ts
      return `Go to ${url}, ${d}, then store ${st} in a variable named 'observed'`;
```

- [ ] **Step 6: Run the parser, objective and verdict suites end to end (this is the gate)**
Run: `npx vitest run test/observed.test.ts test/ndjson.test.ts test/check.test.ts test/verdict.test.ts test/runner.test.ts test/probe.test.ts test/hunt.test.ts test/demo-config.test.ts`
Expected: PASS — output contains `Test Files  8 passed` (about 45 s; the global setup compiles `src/` with `tsc` first, so a type error fails it)

- [ ] **Step 7: Commit (kernel-performed — no agent runs this)**
Message: `feat(kane): read the value from the one non-url final_state key; store-only asks for a variable named 'observed'`

---

### Task 3.2: Choose the final_state key by the store phrase's words, and record the key names

**Files:**
- Modify: `src/kane/ndjson.ts`
- Modify: `src/kane/runner.ts`
- Modify: `src/session.ts`
- Modify: `src/probe.ts`
- Modify: `src/verdict.ts`
- Modify: `test/fixtures/stub-kane.mjs`
- Modify: `test/fixtures/stub-kane-shop.mjs`
- Modify: `test/helpers.ts`
- Modify: `test/verdict.test.ts`
- Modify: `test/probe.test.ts`
- Modify: `test/demo-e2e.test.ts`
- Modify: `README.md`
- Test: `test/observed.test.ts`

**Depends on:** Task 3, Task 3.1, Task 4, Task 5, Task 6, Task 8, Task 12, Task 13, Task 14
**Effort:** medium
**Priority:** must-have
**Provides:** `observedFrom(finalState: unknown, store?: string): ObservedValue`, `parseKaneStream(stdout: string, store?: string): KaneStream`, `interface KaneRunEnd { status: string; summary: string; oneLiner: string; reason: string; creditsConsumed: number | null; observed: string; observedKey: string | null; finalStateKeys: string[]; testUrl: string | null; resultCode: string | null; durationSec: number | null; blamesTest: boolean }`, `interface RunKaneOptions { kaneCmd: string[]; objective: string; timeoutSec: number; maxSteps: number; cwd: string; name?: string; label?: string; env?: NodeJS.ProcessEnv; killAfterMs?: number; store?: string }`, `interface LedgerEntry { phase: Phase; label: string; commit: string; subject: string; verdict: VerdictKind; reason: string; observed: string | null; kaneRuns: number; creditsConsumed: number | null; testUrl: string | null; resultCode: string | null; durationMs: number; at: string; observedKey?: string; finalStateKeys?: string[] }`, `classify() empty-value reason "Kane could not read the value (final_state keys: <names, or none>; <n> non-url key(s))[: <Kane's summary>]"`, `test/fixtures/stub-kane.mjs scenario multikey (fetches the page; final_state { url, cart_total: <page text>, discount_code: 'SAVE10' }, status passed)`, `test/fixtures/stub-kane-shop.mjs STUB_SHOP_FINAL_STATE=multikey (final_state { url, cart_total, discount_code })`
**Requires:** `parseKaneStream(stdout: string): KaneStream`, `interface KaneRunEnd { status: string; summary: string; oneLiner: string; reason: string; creditsConsumed: number | null; observed: string; testUrl: string | null; resultCode: string | null; durationSec: number | null; blamesTest: boolean }`, `interface RunKaneOptions { kaneCmd: string[]; objective: string; timeoutSec: number; maxSteps: number; cwd: string; name?: string; label?: string; env?: NodeJS.ProcessEnv; killAfterMs?: number }`, `interface KaneRunResult { exitCode: number | null; killed: boolean; terminalMode: boolean; spawnError: string | null; stream: KaneStream; stderrTail: string; durationMs: number }`, `interface ObservedValue { key: string | null; value: string }`, `observedFrom(finalState: unknown): ObservedValue`, `observedOf(finalState: unknown): string`, `classify(i: ClassifyInput): Classification`, `interface ClassifyInput { setup?: StepOutcome; ready?: StepOutcome; kane?: KaneRunResult; expected: string; badValue: string | null; mode: VerdictMode }`, `interface LedgerEntry { phase: Phase; label: string; commit: string; subject: string; verdict: VerdictKind; reason: string; observed: string | null; kaneRuns: number; creditsConsumed: number | null; testUrl: string | null; resultCode: string | null; durationMs: number; at: string }`, `probe(sessionPath: string, t: ProbeTarget): Promise<ProbeResult>`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`, `test/fixtures/stub-kane.mjs (STUB_KANE_PLAN rules matched on FIRSTBAD_LABEL; scenarios pass, fail, misphrased, error, auth, timeout, hang, upload-failed, crash, prose, false-pass, token-leak, fetch; logs to STUB_KANE_LOG)`, `test/fixtures/stub-kane-shop.mjs (stub kane-cli that computes the Corner Shop total from the served pricing.js and catalog.js; logs to STUB_KANE_LOG)`, `main(argv: string[], io: CliIO): Promise<number>`, `firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" | --agent none] [--no-fix] [--force]`, `README.md (R3-cli-tool v1)`

Why (the user's decision, 2026-11-25, spec section 15 decision 14, after the first LIVE run of Task 15 aborted at the bracket): the bad ref (`HEAD`) stored `$20.00` and classified FAIL, but on the good ref (`v1.0`) Kane's summary said the total was `$18.00` while firstbad read an empty value twice, so the hunt stopped with "the good ref does not pass the check". One diagnostic LIVE run of the same store-only objective on `v1.0` (`Go to http://127.0.0.1:4173/, add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply, then store the total amount shown next to the word Total in a variable named 'observed'`) ended `status passed`, `result_code 100`, with `final_state` keys `url`, `cart_total` (`$18.00`) and `discount_code` (a 6-character non-money string): Kane ignored the requested name and stored two non-url keys, and Task 3.1's rule (two or more candidates give an empty value) refused to guess. This task changes two things:

1. **Key rule** (`observedFrom` in `src/kane/ndjson.ts`), in this order: `final_state.observed` if that key is present; otherwise, if exactly **one** key other than `url` exists, that key (unchanged from Task 3.1: this single key needs no name match); otherwise, if the caller passes the check's store phrase, the **one** candidate key whose name shares a word with it; no match, two or more matches, no candidates, or no store phrase give an empty value, which is retried once as before. A key is never chosen by its value. Words: a key name is split at camelCase boundaries (`cartTotal` → `cart Total`, `HTMLTotal` → `HTML Total`) and then on every run of characters that are not letters or digits, and lowercased; the store phrase is split on every run of characters that are not letters or digits, and lowercased; empty pieces are dropped; "shares a word" means the two word sets intersect. Whole words only: `subtotal` does not share a word with `total`, and no stop-words are removed. Example: `cart_total` → {cart, total} shares `total` with "the total amount shown next to the word Total"; `discount_code` → {discount, code} shares nothing, so `cart_total` is the one match.
2. **Diagnostics, permanent**: every Kane run records the `final_state` key names (names only, never values; at most 30, each scrubbed and cut to 64 characters) and the key it read. An empty-value outcome now says which keys Kane returned and how many were not `url`, in the reason (so it reaches `report.md`, `report.json`, the terminal timeline and the hunt's abort message) and in the new optional ledger field `finalStateKeys`; a value-bearing outcome records the key it was read from in the new optional ledger field `observedKey`. The reason becomes `Kane could not read the value (final_state keys: url, cart_total, discount_code; 2 non-url keys)` followed by `: <Kane's summary>` when Kane gave one (`final_state keys: none; 0 non-url keys` for an empty or missing `final_state`; `1 non-url key` in the singular).

The safeguards stay exactly as they are: the chosen value still goes into `KaneRunEnd.observed`, and `classify()` still compares it with the expected value and with the bad ref's value, so a wrong key cannot pass a commit (`discount_code`'s value would match neither `$18.00` nor `$20.00`).

Signatures this task extends (every change is backward compatible; existing callers compile and behave as before):
- `observedFrom(finalState: unknown): ObservedValue` (Task 3.1) → `observedFrom(finalState: unknown, store?: string): ObservedValue`. Without `store` the rule is Task 3.1's. Consumers: `toRunEnd()` in `src/kane/ndjson.ts` (now passes the store) and `scripts/spike/run-spike.mjs` (Task 2.1, done; calls it with one argument from `dist/`, so it keeps Task 3.1's rule; not touched). `observedOf(finalState: unknown): string` keeps its signature and rule (no store); `test/ndjson.test.ts` and `test/observed.test.ts` use it.
- `parseKaneStream(stdout: string): KaneStream` (Task 3) → `parseKaneStream(stdout: string, store?: string): KaneStream`. Consumers: `runKane()` (now passes `o.store`), `test/ndjson.test.ts` and `test/observed.test.ts` (one argument; unchanged).
- `interface KaneRunEnd` (Task 3) gains `observedKey: string | null` and `finalStateKeys: string[]` after `observed`. Only `toRunEnd()` builds one in `src/`; `test/verdict.test.ts` builds one in its `kane()` helper, so its defaults gain the two fields. Readers (`classify()` in `src/verdict.ts`, `probe()` in `src/probe.ts`) are updated here.
- `interface RunKaneOptions` (Task 3) gains optional `store?: string`. Consumers: `probe()` (now passes `s.check.store`) and `test/runner.test.ts` (does not pass it; unchanged). `kaneArgs()` ignores it, so Kane's argv does not change.
- `interface LedgerEntry` (Task 5) gains optional `observedKey?: string` and `finalStateKeys?: string[]`. Only `probe()` sets them. `src/oracle.ts` (`crashEntry`), `src/fix.ts`, `src/hunt.ts`, `src/report.ts` and `test/report.test.ts` build or pass entries without them and need no change: the ledger is JSON lines read back by `readLedger()`, the oracle relays the whole entry, and `buildReport()` copies `timeline` through `scrubDeep()`, so both fields reach `report.json` allow-listed (they are fields of `LedgerEntry`) and scrubbed. `renderMarkdown()` and `formatTimelineLine()` are not changed: the key names reach `report.md` and the terminal through the reason (the terminal line cuts the reason at 100 characters, and the key list comes first).
- `classify(i: ClassifyInput): Classification` keeps its signature; only the empty-value reason text changes. The one exact assertion on that text, in `test/verdict.test.ts`, is updated. `test/hunt.test.ts` only checks that the abort message contains `mis-phrased`, which still holds.

What else was checked, so you do not need to touch it:
- `src/hunt.ts`, `src/fix.ts`, `src/oracle.ts`, `src/report.ts`, `src/run.ts`, `src/cli.ts` and `src/demo/*` do not change. Every Kane run goes through `probe()` (bracket, bisect via the oracle, confirm, fix), and `probe()` is the only caller of `runKane()`, so passing the store there covers every phase.
- Task 16 (stretch, not built) replaces the line `        objective: composeObjective(s.check, s.template),` in `src/probe.ts` and the end of `interface Session` in `src/session.ts`; this task leaves both strings exactly as they are.
- `scripts/live-demo.mjs` and `scripts/check-recorded-run.mjs` (Task 15) need no change: `report.json` gains only the two optional timeline fields, and key names hold no token, evidence path, home folder or user name.
- The existing `test/observed.test.ts` cases call `observedFrom` without a store, so they keep Task 3.1's rule and stay as they are; the new cases below pass the demo's store phrase.
- `test/demo-e2e.test.ts` now runs the shop stub with `STUB_SHOP_FINAL_STATE=multikey`, the shape live Kane returned, so the one end-to-end hunt (bracket, bisect, confirm, agent fix) runs through the name match. The `final_state.observed` path stays covered by every other stub test (the stub-kane `fetch` scenario emits `{ observed }`).

Every edit below is an exact-string replacement (the text to find appears exactly once in its file) or a whole-file write. The repo's working tree may use CRLF line endings; match line by line.

- [ ] **Step 1: Write the failing test `test/observed.test.ts` (whole file)**

```ts
import { describe, expect, it } from 'vitest';
import { observedFrom, observedOf, parseKaneStream } from '../src/kane/ndjson.js';
import type { KaneRunResult } from '../src/kane/runner.js';
import { classify } from '../src/verdict.js';

function stdoutWith(finalState: unknown, status: string): string {
  return [
    JSON.stringify({ v: 1, type: 'stream_start', cli_version: '0.10.9' }),
    JSON.stringify({
      v: 1,
      type: 'run_end',
      status,
      summary: 'Read the amount shown next to Total',
      reason: 'Objective completed',
      result_code: 100,
      final_state: finalState,
    }),
  ].join('\n');
}

function kaneResult(finalState: unknown, status = 'passed', store?: string): KaneRunResult {
  return {
    exitCode: 0,
    killed: false,
    terminalMode: false,
    spawnError: null,
    stream: parseKaneStream(stdoutWith(finalState, status), store),
    stderrTail: '',
    durationMs: 10,
  };
}

const URL = 'http://127.0.0.1:4173/';
const STORE = 'the total amount shown next to the word Total';
const LIVE = { url: URL, cart_total: '$18.00', discount_code: 'SAVE10' };

describe('observedFrom: which final_state key holds the stored value', () => {
  it('uses final_state.observed when it is present, even next to other keys', () => {
    expect(observedFrom({ url: URL, observed: ' $18.00 ' })).toEqual({ key: 'observed', value: '$18.00' });
    expect(observedFrom({ observed: '$20.00', total: '$18.00' })).toEqual({ key: 'observed', value: '$20.00' });
  });

  it('uses the one key other than url when observed is missing', () => {
    expect(observedFrom({ url: URL, total: '$18.00' })).toEqual({ key: 'total', value: '$18.00' });
    expect(observedFrom({ total: 18 })).toEqual({ key: 'total', value: '18' });
    expect(observedOf({ url: URL, total: '$18.00' })).toBe('$18.00');
  });

  it('treats several candidate keys, or none, as an empty value and never guesses', () => {
    expect(observedFrom({ url: URL, total: '$18.00', subtotal: '$20.00' })).toEqual({ key: null, value: '' });
    expect(observedFrom({ url: URL })).toEqual({ key: null, value: '' });
    expect(observedFrom({})).toEqual({ key: null, value: '' });
    expect(observedFrom(null)).toEqual({ key: null, value: '' });
    expect(observedFrom(['$18.00'])).toEqual({ key: null, value: '' });
    expect(observedOf({ a: '$18.00', b: '$20.00' })).toBe('');
  });
});

describe('observedFrom with the store phrase: several keys are chosen by name, never by value (decision 14)', () => {
  it('case 1: observed present wins over every other key', () => {
    expect(observedFrom({ ...LIVE, observed: '$20.00' }, STORE)).toEqual({ key: 'observed', value: '$20.00' });
  });

  it('case 2: one other key is used without a name match, as before', () => {
    expect(observedFrom({ url: URL, discount_code: 'SAVE10' }, STORE)).toEqual({ key: 'discount_code', value: 'SAVE10' });
    expect(observedFrom({ url: URL, total: '$18.00' }, STORE)).toEqual({ key: 'total', value: '$18.00' });
  });

  it('case 3: several keys, exactly one shares a word with the store phrase', () => {
    expect(observedFrom(LIVE, STORE)).toEqual({ key: 'cart_total', value: '$18.00' });
    expect(observedFrom({ url: URL, cartTotal: '$18.00', discountCode: 'SAVE10' }, STORE)).toEqual({ key: 'cartTotal', value: '$18.00' });
    expect(observedFrom({ 'CART-TOTAL': '$18.00', 'promo code': 'SAVE10' }, STORE)).toEqual({ key: 'CART-TOTAL', value: '$18.00' });
    expect(observedFrom({ subtotal: '$20.00', grand_total: '$18.00' }, STORE)).toEqual({ key: 'grand_total', value: '$18.00' });
  });

  it('case 4: several keys with no match, or several matches, give an empty value', () => {
    expect(observedFrom({ url: URL, price: '$18.00', discount_code: 'SAVE10' }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom({ url: URL, cart_total: '$18.00', total_amount: '$20.00' }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom({ url: URL, subtotal: '$20.00', discount: '$2.00' }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom(LIVE)).toEqual({ key: null, value: '' });
    expect(observedFrom(LIVE, '')).toEqual({ key: null, value: '' });
  });

  it('case 5: only url, or nothing, gives an empty value', () => {
    expect(observedFrom({ url: URL }, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom({}, STORE)).toEqual({ key: null, value: '' });
    expect(observedFrom(null, STORE)).toEqual({ key: null, value: '' });
  });
});

describe('a value read from another key still goes through the verdict rule', () => {
  it('parses run_end.observed from the single other key', () => {
    expect(parseKaneStream(stdoutWith({ url: URL, total: '$20.00' }, 'passed')).runEnd?.observed).toBe('$20.00');
  });

  it('compares it with the expected value and with the bad ref value', () => {
    const total = (v: string): KaneRunResult => kaneResult({ url: URL, total: v });
    expect(classify({ kane: total('$18.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('PASS');
    expect(classify({ kane: total('$20.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('FAIL');
    const third = classify({ kane: total('$7.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' });
    expect(third.verdict).toBe('SKIP');
    expect(third.reason).toContain("differs from the bad ref's $20.00");
  });

  it('keeps a status/value disagreement a SKIP', () => {
    const c = classify({ kane: kaneResult({ url: URL, total: '$18.00' }, 'failed'), expected: '$18.00', badValue: '$20.00', mode: 'status+value' });
    expect(c.verdict).toBe('SKIP');
    expect(c.reason).toContain('Kane and the stored value disagree');
  });

  it('retries several candidate keys like any empty value', () => {
    const c = classify({ kane: kaneResult({ url: URL, total: '$18.00', subtotal: '$20.00' }), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(c.verdict).toBe('SKIP');
    expect(c.emptyValue).toBe(true);
    expect(c.retryable).toBe(true);
  });
});

describe('the name-matched key in a run_end, and the key names on an empty value', () => {
  it('reads cart_total from the live final_state and records the key names only', () => {
    const end = parseKaneStream(stdoutWith(LIVE, 'passed'), STORE).runEnd;
    expect(end?.observed).toBe('$18.00');
    expect(end?.observedKey).toBe('cart_total');
    expect(end?.finalStateKeys).toEqual(['url', 'cart_total', 'discount_code']);
    expect(JSON.stringify(end?.finalStateKeys)).not.toContain('SAVE10');
  });

  it('judges the name-matched value against the expected and the bad value', () => {
    const live = (v: string): KaneRunResult => kaneResult({ ...LIVE, cart_total: v }, 'passed', STORE);
    expect(classify({ kane: live('$18.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' })).toMatchObject({ verdict: 'PASS', observed: '$18.00' });
    expect(classify({ kane: live('$20.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('FAIL');
    expect(classify({ kane: live('$7.00'), expected: '$18.00', badValue: '$20.00', mode: 'value-only' }).verdict).toBe('SKIP');
  });

  it('names the keys and counts the non-url ones when no value is read', () => {
    const c = classify({ kane: kaneResult(LIVE), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(c).toMatchObject({ verdict: 'SKIP', emptyValue: true, retryable: true, observed: null });
    expect(c.reason).toBe('Kane could not read the value (final_state keys: url, cart_total, discount_code; 2 non-url keys): Read the amount shown next to Total');
    expect(c.reason).not.toContain('SAVE10');
    const none = classify({ kane: kaneResult({}), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(none.reason).toBe('Kane could not read the value (final_state keys: none; 0 non-url keys): Read the amount shown next to Total');
    const blank = classify({ kane: kaneResult({ url: URL, total: '' }), expected: '$18.00', badValue: null, mode: 'value-only' });
    expect(blank.reason).toContain('(final_state keys: url, total; 1 non-url key)');
  });
});
```

- [ ] **Step 2: `test/probe.test.ts` — add two probe tests (one replacement)**

Replace (the end of the last test and of the file):

```ts
    expect(r.misphrased).toBe(true);
    expect(r.emptyValue).toBe(true);
  });
});
```

with:

```ts
    expect(r.misphrased).toBe(true);
    expect(r.emptyValue).toBe(true);
  });

  it('reads the one final_state key whose name shares a word with the store phrase', async () => {
    const check = { url: 'http://127.0.0.1:4329/', do: 'read the page', store: 'the total amount shown next to the word Total', expected: '$18.00' };
    const { sessionPath, app } = makeSession(4329, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, { check });
    setStubPlan(work, { default: { scenario: 'multikey' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({ verdict: 'PASS', observed: '$18.00', observedKey: 'cart_total', kaneRuns: 1 });
    expect(r.entry.finalStateKeys).toBeUndefined();
  });

  it('records the final_state key names, never their values, when no key name matches', async () => {
    const { sessionPath, app } = makeSession(4330, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'multikey' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({ verdict: 'SKIP', observed: null, kaneRuns: 2, finalStateKeys: ['url', 'cart_total', 'discount_code'] });
    expect(r.entry.observedKey).toBeUndefined();
    expect(r.emptyValue).toBe(true);
    expect(r.entry.reason).toContain('Kane could not read the value (final_state keys: url, cart_total, discount_code; 2 non-url keys)');
    expect(JSON.stringify(readLedger(readSession(sessionPath).ledgerPath))).not.toContain('SAVE10');
  });
});
```

- [ ] **Step 3: `test/verdict.test.ts` — two replacements**

Replace (inside the `kane()` helper's default `runEnd`):

```ts
          observed: '',
          testUrl: null,
```

with:

```ts
          observed: '',
          observedKey: null,
          finalStateKeys: [],
          testUrl: null,
```

Replace:

```ts
    expect(c.reason).toBe('Kane could not read the value: not found');
```

with:

```ts
    expect(c.reason).toBe('Kane could not read the value (final_state keys: none; 0 non-url keys): not found');
```

- [ ] **Step 4: `test/demo-e2e.test.ts` — three replacements**

Replace:

```ts
    process.env.STUB_AGENT_FILE = 'pricing.js';
```

with:

```ts
    process.env.STUB_AGENT_FILE = 'pricing.js';
    process.env.STUB_SHOP_FINAL_STATE = 'multikey';
```

Replace:

```ts
      timeline: Array<{ phase: string; verdict: string; reason: string }>;
```

with:

```ts
      timeline: Array<{ phase: string; verdict: string; reason: string; observed: string | null; observedKey?: string }>;
```

Replace:

```ts
    expect(report.fix.status).toBe('verified');
```

with:

```ts
    expect(report.fix.status).toBe('verified');
    const read = report.timeline.filter((e) => e.observed !== null);
    expect(read.length).toBeGreaterThanOrEqual(5);
    expect(read.every((e) => e.observedKey === 'cart_total')).toBe(true);
```

- [ ] **Step 5: `test/helpers.ts` — one replacement (clear the new stub variable between tests)**

Replace:

```ts
    'STUB_AGENT_LOG',
  ]) {
```

with:

```ts
    'STUB_AGENT_LOG',
    'STUB_SHOP_FINAL_STATE',
  ]) {
```

- [ ] **Step 6: Run the tests to confirm they fail**
Run: `npx vitest run test/observed.test.ts test/verdict.test.ts test/probe.test.ts`
Expected: FAIL — `test/observed.test.ts` fails the new store-phrase cases (`observedFrom(LIVE, STORE)` returns `{ key: null, value: '' }`, `runEnd.observedKey` is undefined), `test/verdict.test.ts` fails on the reason text (`Kane could not read the value: not found` received), and the two new `test/probe.test.ts` tests fail (the stub has no `multikey` scenario yet, so Kane errors and the probe skips)

- [ ] **Step 7: `test/fixtures/stub-kane.mjs` — add the `multikey` scenario (one replacement)**

Replace:

```js
    default:
      process.stderr.write(`stub-kane: unknown scenario ${scenario}\n`);
```

with:

```js
    case 'multikey': {
      // What live Kane 0.10.9 returned for the store-only demo check (2026-11-25): it ignored the name 'observed'
      // and stored several keys. The page text stands in for the total.
      const m = /Go to (https?:\/\/[^\s,]+)/.exec(objective);
      const url = m ? m[1].replace(/\.$/, '') : '';
      let body = '';
      try {
        body = (await fetchText(url)).body.trim();
      } catch (err) {
        emit({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' });
        emit({ type: 'error', message: `page unreachable: ${err instanceof Error ? err.message : String(err)}` });
        return 2;
      }
      start();
      runEnd('passed', body, { reason: 'Objective completed', result_code: '100', final_state: { url, cart_total: body, discount_code: 'SAVE10' } });
      return 0;
    }
    default:
      process.stderr.write(`stub-kane: unknown scenario ${scenario}\n`);
```

- [ ] **Step 8: `test/fixtures/stub-kane-shop.mjs` — two replacements**

Replace:

```js
function runEnd(status, observed, summary, extra) {
```

with:

```js
// STUB_SHOP_FINAL_STATE=multikey emits the final_state live Kane 0.10.9 returned for the demo check (2026-11-25):
// { url, cart_total, discount_code } instead of { observed }.
function finalState(observed) {
  if (observed === '') return {};
  if (env.STUB_SHOP_FINAL_STATE !== 'multikey') return { observed };
  const m = /Go to (https?:\/\/[^\s,]+)/.exec(args[1] ?? '');
  return { url: m ? m[1].replace(/\.$/, '') : '', cart_total: observed, discount_code: 'SAVE10' };
}

function runEnd(status, observed, summary, extra) {
```

Replace:

```js
    final_state: observed === '' ? {} : { observed },
```

with:

```js
    final_state: finalState(observed),
```

- [ ] **Step 9: `src/kane/ndjson.ts` — six replacements**

Replace (inside `interface KaneRunEnd`):

```ts
  observed: string;
  testUrl: string | null;
```

with:

```ts
  observed: string;
  observedKey: string | null;
  finalStateKeys: string[];
  testUrl: string | null;
```

Replace (the comment, `interface ObservedValue` and `observedFrom`; `observedOf` below it stays as it is):

```ts
// Which final_state key holds the stored value (spec section 4): 'observed' when present; otherwise the only
// key other than 'url'; two or more candidate keys give an empty value (retried once), never a guess between keys.
export interface ObservedValue {
  key: string | null;
  value: string;
}

export function observedFrom(finalState: unknown): ObservedValue {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return { key: null, value: '' };
  const record = finalState as Record<string, unknown>;
  if ('observed' in record) return { key: 'observed', value: text(record.observed).trim() };
  const candidates = Object.keys(record).filter((k) => k !== 'url');
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only === undefined) return { key: null, value: '' };
  return { key: only, value: text(record[only]).trim() };
}
```

with:

```ts
// Which final_state key holds the stored value (spec section 4): 'observed' when present; otherwise the only
// key other than 'url'; with two or more candidate keys, the one candidate whose name shares a word with the
// store phrase. No match, several matches or no store phrase give an empty value (retried once). A key is
// never chosen by its value.
export interface ObservedValue {
  key: string | null;
  value: string;
}

// Lowercase words of letters and digits: "the total amount shown next to the word Total" gives the, total, amount, ...
function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w !== '');
}

// A key name is first split at camelCase boundaries: cart_total, cartTotal and CART-TOTAL all give cart, total.
function keyWords(key: string): string[] {
  return words(key.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2').replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2'));
}

export function observedFrom(finalState: unknown, store?: string): ObservedValue {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return { key: null, value: '' };
  const record = finalState as Record<string, unknown>;
  const read = (key: string): ObservedValue => ({ key, value: text(record[key]).trim() });
  if ('observed' in record) return read('observed');
  const candidates = Object.keys(record).filter((k) => k !== 'url');
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only !== undefined) return read(only);
  if (candidates.length === 0 || store === undefined) return { key: null, value: '' };
  const phrase = new Set(words(store));
  const named = candidates.filter((k) => keyWords(k).some((w) => phrase.has(w)));
  const match = named.length === 1 ? named[0] : undefined;
  return match === undefined ? { key: null, value: '' } : read(match);
}
```

Replace:

```ts
function toRunEnd(o: Record<string, unknown>, line: string): KaneRunEnd {
  return {
```

with:

```ts
// The final_state key names only, never their values (spec section 8): at most 30, each scrubbed and cut to 64 chars.
function keysOf(finalState: unknown): string[] {
  if (typeof finalState !== 'object' || finalState === null || Array.isArray(finalState)) return [];
  return Object.keys(finalState)
    .slice(0, 30)
    .map((k) => scrub(k).slice(0, 64));
}

function toRunEnd(o: Record<string, unknown>, line: string, store: string | undefined): KaneRunEnd {
  const found = observedFrom(o.final_state, store);
  return {
```

Replace:

```ts
    observed: scrub(observedOf(o.final_state)).slice(0, 200),
```

with:

```ts
    observed: scrub(found.value).slice(0, 200),
    observedKey: found.key === null ? null : scrub(found.key).slice(0, 64),
    finalStateKeys: keysOf(o.final_state),
```

Replace:

```ts
export function parseKaneStream(stdout: string): KaneStream {
```

with:

```ts
export function parseKaneStream(stdout: string, store?: string): KaneStream {
```

Then replace:

```ts
      stream.runEnd = toRunEnd(o, line);
```

with:

```ts
      stream.runEnd = toRunEnd(o, line, store);
```

- [ ] **Step 10: `src/kane/runner.ts` — two replacements**

Replace (the end of `interface RunKaneOptions`):

```ts
  killAfterMs?: number;
}
```

with:

```ts
  killAfterMs?: number;
  // The check's store phrase; picks the final_state key by name when Kane returns several (spec section 4).
  store?: string;
}
```

Replace:

```ts
        stream: parseKaneStream(stdout),
```

with:

```ts
        stream: parseKaneStream(stdout, o.store),
```

- [ ] **Step 11: `src/session.ts` — one replacement (the end of `interface LedgerEntry`)**

Replace:

```ts
  at: string;
}
```

with:

```ts
  at: string;
  // Spec section 8, set only when they apply: the final_state key the value was read from, and, for an empty
  // value, every final_state key name Kane returned (names only, never values).
  observedKey?: string;
  finalStateKeys?: string[];
}
```

- [ ] **Step 12: `src/probe.ts` — two replacements**

Replace:

```ts
        label: `${t.phase}|${t.label}|${t.subject}`,
```

with:

```ts
        label: `${t.phase}|${t.label}|${t.subject}`,
        store: s.check.store,
```

Replace:

```ts
      at: new Date().toISOString(),
    };
    appendLedger(first.ledgerPath, entry);
```

with:

```ts
      at: new Date().toISOString(),
    };
    // Spec section 8: the key a value was read from, and for an empty value every final_state key name (names only).
    if (end !== null && c.observed !== null && end.observedKey !== null) entry.observedKey = end.observedKey;
    if (end !== null && c.emptyValue === true) entry.finalStateKeys = end.finalStateKeys;
    appendLedger(first.ledgerPath, entry);
```

- [ ] **Step 13: `src/verdict.ts` — two replacements**

Replace:

```ts
export function classify(i: ClassifyInput): Classification {
```

with:

```ts
// Names only, never values (spec section 4): "final_state keys: url, cart_total, discount_code; 2 non-url keys".
function keysNote(keys: string[]): string {
  const nonUrl = keys.filter((k) => k !== 'url').length;
  return `final_state keys: ${keys.length === 0 ? 'none' : keys.join(', ')}; ${nonUrl} non-url key${nonUrl === 1 ? '' : 's'}`;
}

export function classify(i: ClassifyInput): Classification {
```

Replace:

```ts
    return out('SKIP', `Kane could not read the value${why ? `: ${why}` : ''}`, {
```

with:

```ts
    return out('SKIP', `Kane could not read the value (${keysNote(end.finalStateKeys)})${why ? `: ${why}` : ''}`, {
```

- [ ] **Step 14: `README.md` — one replacement (the "How it works" sentence about Kane's own key names; no heading changes)**

Replace:

```text
Kane sometimes stores the value under a name of its own (the spike saw `total`): firstbad reads `observed` when it is there, otherwise the single stored key other than the page URL, and treats two or more candidate keys as no value rather than guess.
```

with:

```text
Kane sometimes stores the value under names of its own (the spike saw `total`; the first live demo run saw `cart_total` next to `discount_code`): firstbad reads `observed` when it is there, otherwise the single stored key other than the page URL, otherwise the one stored key whose name shares a word with your `--store` phrase (`cart_total` shares "total" with "the total amount shown next to the word Total"). No match, or more than one, counts as no value, and firstbad never picks a key by its value; when it reads no value, the report lists the key names Kane returned (names only, never values).
```

- [ ] **Step 15: Check that the README headings still match schema R3-cli-tool v1 (Task 14's check, unchanged)**
Run (PowerShell): `$want = @('# firstbad','## Demo','## What it does','## Quickstart','## Built at KaneCLI Online Hackathon 2026','## Install','## Usage','## Commands / API reference','## How it works','## Roadmap','## License'); $stamp = '<!-- readme-schema: R3-cli-tool v1 -->'; $lines = Get-Content README.md -Encoding UTF8; $inFence = $false; $got = foreach ($l in $lines) { if ($l -match '^\x60{3}') { $inFence = -not $inFence } elseif (-not $inFence -and $l -cmatch '^#{1,2} ') { $l } }; $ok = ($got.Count -eq $want.Count); if ($ok) { for ($i = 0; $i -lt $want.Count; $i++) { if ($got[$i] -cne $want[$i]) { $ok = $false } } }; if ($ok -and ($lines[0] -ceq $stamp)) { 'PASS' } else { 'FAIL' }`
Expected: prints `PASS`

- [ ] **Step 16: Run the whole offline suite (this is the gate)**
Run: `npx vitest run`
Expected: PASS — output contains `Test Files  20 passed` (about 4 minutes; the global setup compiles `src/` with `tsc` first, so a type error fails it; no test calls the real kane-cli or claude)

- [ ] **Step 17: Commit (kernel-performed — no agent runs this)**
Message: `feat(kane): choose the final_state key whose name shares a word with the store phrase; record key names on empty values`

---

### Task 4: The check, the objective templates and the verdict rule

**Files:**
- Create: `src/check.ts`
- Create: `src/verdict.ts`
- Test: `test/check.test.ts`
- Test: `test/verdict.test.ts`

**Depends on:** Task 1, Task 3
**Effort:** high
**Priority:** must-have
**Provides:** `interface Check { url: string; do: string; store: string; expected: string }`, `validateCheck(c: Check): string[]`, `composeObjective(c: Check, template: TemplateId): string`, `normalizeValue(v: string): string`, `valuesMatch(a: string, b: string): boolean`, `type VerdictKind = 'PASS' | 'FAIL' | 'SKIP' | 'ABORT'`, `type Phase = 'bracket' | 'bisect' | 'confirm' | 'fix'`, `interface StepOutcome { ok: boolean; detail: string }`, `interface ClassifyInput { setup?: StepOutcome; ready?: StepOutcome; kane?: KaneRunResult; expected: string; badValue: string | null; mode: VerdictMode }`, `interface Classification { verdict: VerdictKind; reason: string; observed: string | null; misphrased: boolean; emptyValue: boolean; retryable: boolean }`, `classify(i: ClassifyInput): Classification`, `isAuthFailure(r: KaneRunResult): boolean`, `isTransient(r: KaneRunResult): boolean`, `exitCodeFor(v: VerdictKind): 0 | 1 | 125 | 128`
**Requires:** `type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only'`, `type VerdictMode = 'status+value' | 'value-only'`, `interface KaneRunEnd { status: string; summary: string; oneLiner: string; reason: string; creditsConsumed: number | null; observed: string; testUrl: string | null; resultCode: string | null; durationSec: number | null; blamesTest: boolean }`, `interface KaneStream { lines: number; firstLineIsJson: boolean; streamStart: boolean; cliVersion: string | null; runEnd: KaneRunEnd | null; testMdDone: KaneTestMdDone | null; errors: string[]; stepsDone: number; stepsFailed: number }`, `interface KaneRunResult { exitCode: number | null; killed: boolean; terminalMode: boolean; spawnError: string | null; stream: KaneStream; stderrTail: string; durationMs: number }`

Upstream code you build on (already in the repo): `src/kane-profile.ts` exports `TemplateId` and `VerdictMode`; `src/kane/ndjson.ts` exports `KaneRunEnd`, `KaneTestMdDone` (`{ overallStatus: string; durationSec: number | null }`) and `KaneStream`; `src/kane/runner.ts` exports `KaneRunResult` (all signatures above).

The verdict rule (spec section 4), in order: setup failed → SKIP; page never loaded → SKIP; Kane could not be spawned → ABORT; auth failure (exit 2 plus auth-looking text) → ABORT; transient (no `run_end`, killed, terminal mode, exit 3) → SKIP and `retryable`; empty stored value → SKIP, `emptyValue`, `retryable`, `misphrased` when Kane blames the test; value matches expected → PASS (in `status+value` mode only when `run_end.status` is `passed`, else SKIP "disagree"); value matches the bad signature, or the bad signature is still unknown → FAIL (a Kane "pass" with that value is the #239 false pass); any other value → SKIP "not this bug". The exit code alone never decides (an upload failure exits 1 with `status: passed`).

- [ ] **Step 1: Write the failing tests**

`test/check.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { composeObjective, normalizeValue, validateCheck, valuesMatch, type Check } from '../src/check.js';

const CHECK: Check = {
  url: 'http://127.0.0.1:4173/',
  do: 'add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply.',
  store: 'the total amount shown next to the word Total',
  expected: '$18.00',
};

describe('composeObjective', () => {
  it('builds the three cookbook-style candidates exactly and never emits {{', () => {
    expect(composeObjective(CHECK, 'commas-assert')).toBe(
      "Go to http://127.0.0.1:4173/, add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply, store the total amount shown next to the word Total as 'observed', then assert the stored observed value is \"$18.00\"",
    );
    expect(composeObjective(CHECK, 'sentences-assert')).toBe(
      "Go to http://127.0.0.1:4173/. Add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply. Store the total amount shown next to the word Total as 'observed'. Then assert that the stored observed value is \"$18.00\".",
    );
    expect(composeObjective(CHECK, 'store-only')).toBe(
      "Go to http://127.0.0.1:4173/, add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply, then store the total amount shown next to the word Total as 'observed'",
    );
    for (const t of ['commas-assert', 'sentences-assert', 'store-only'] as const) {
      expect(composeObjective(CHECK, t)).not.toContain('{{');
    }
  });
});

describe('validateCheck', () => {
  it('accepts a good check and lists every problem of a bad one', () => {
    expect(validateCheck(CHECK)).toEqual([]);
    const problems = validateCheck({ url: 'localhost:4173', do: ' ', store: 'the {{total}}', expected: 'say "hi"' });
    expect(problems).toEqual([
      '--url must start with http:// or https://',
      '--do must not be empty',
      '--store must not contain {{',
      '--expect must not contain a double quote',
    ]);
    expect(validateCheck({ ...CHECK, expected: '' })).toEqual(['--expect must not be empty']);
  });
});

describe('valuesMatch', () => {
  it('matches equal text and equal single numbers only', () => {
    expect(normalizeValue('  "$18.00"  ')).toBe('$18.00');
    expect(valuesMatch('$18.00', '$18.00')).toBe(true);
    expect(valuesMatch('Total: $18.00', '$18.00')).toBe(true);
    expect(valuesMatch('18.00', '$18.00')).toBe(true);
    expect(valuesMatch('$18', '$18.00')).toBe(true);
    expect(valuesMatch('$1,250.00', '1250')).toBe(true);
    expect(valuesMatch('$20.00', '$18.00')).toBe(false);
    expect(valuesMatch('2 items for $18.00', '$18.00')).toBe(false);
    expect(valuesMatch('', '$18.00')).toBe(false);
    expect(valuesMatch('Example Domain', 'example   domain')).toBe(true);
  });
});
```

`test/verdict.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { KaneRunEnd } from '../src/kane/ndjson.js';
import type { KaneRunResult } from '../src/kane/runner.js';
import { classify, exitCodeFor, isAuthFailure, isTransient, type ClassifyInput } from '../src/verdict.js';

interface KaneShape {
  exitCode?: number | null;
  killed?: boolean;
  terminalMode?: boolean;
  spawnError?: string | null;
  stderrTail?: string;
  errors?: string[];
  end?: Partial<KaneRunEnd> | null;
}

function kane(p: KaneShape): KaneRunResult {
  const runEnd: KaneRunEnd | null =
    p.end === null
      ? null
      : {
          status: 'failed',
          summary: '',
          oneLiner: '',
          reason: '',
          creditsConsumed: 12,
          observed: '',
          testUrl: null,
          resultCode: '720',
          durationSec: 1,
          blamesTest: false,
          ...(p.end ?? {}),
        };
  return {
    exitCode: p.exitCode === undefined ? 1 : p.exitCode,
    killed: p.killed ?? false,
    terminalMode: p.terminalMode ?? false,
    spawnError: p.spawnError ?? null,
    stderrTail: p.stderrTail ?? '',
    durationMs: 10,
    stream: {
      lines: 3,
      firstLineIsJson: true,
      streamStart: true,
      cliVersion: '0.10.9',
      runEnd,
      testMdDone: null,
      errors: p.errors ?? [],
      stepsDone: 1,
      stepsFailed: 0,
    },
  };
}

const base: Omit<ClassifyInput, 'kane'> = { expected: '$18.00', badValue: '$20.00', mode: 'status+value' };

describe('classify', () => {
  it('skips setup and serve failures without Kane', () => {
    expect(classify({ ...base, setup: { ok: false, detail: 'exit 3' } })).toMatchObject({ verdict: 'SKIP', reason: 'setup failed (exit 3)' });
    expect(classify({ ...base, ready: { ok: false, detail: 'server exited with code 1' } })).toMatchObject({
      verdict: 'SKIP',
      reason: 'page never loaded (server exited with code 1)',
    });
  });

  it('aborts when Kane is missing or not logged in', () => {
    expect(classify({ ...base, kane: kane({ spawnError: 'ENOENT', end: null }) }).verdict).toBe('ABORT');
    const auth = kane({ exitCode: 2, errors: ['Authentication failed: token expired'], end: null });
    expect(isAuthFailure(auth)).toBe(true);
    expect(classify({ ...base, kane: auth })).toMatchObject({ verdict: 'ABORT', reason: 'Kane authentication failed — run kane-cli login' });
  });

  it('marks transient outcomes as retryable skips', () => {
    const cdp = kane({ exitCode: 2, errors: ['Chrome CDP not ready after 30000ms'], end: null });
    expect(isTransient(cdp)).toBe(true);
    expect(classify({ ...base, kane: cdp })).toMatchObject({ verdict: 'SKIP', retryable: true });
    expect(classify({ ...base, kane: cdp }).reason).toContain('Chrome CDP');
    expect(classify({ ...base, kane: kane({ exitCode: null, killed: true, end: null }) }).reason).toContain('timed out');
    expect(classify({ ...base, kane: kane({ exitCode: null, killed: true, terminalMode: true, end: null }) }).reason).toContain('terminal mode');
    expect(classify({ ...base, kane: kane({ exitCode: 3, end: null }) }).reason).toContain('exit 3');
  });

  it('retries an empty value and flags a mis-phrased check', () => {
    const c = classify({ ...base, kane: kane({ end: { observed: '', blamesTest: true, summary: 'not found' } }) });
    expect(c).toMatchObject({ verdict: 'SKIP', misphrased: true, emptyValue: true, retryable: true, observed: null });
    expect(c.reason).toBe('Kane could not read the value: not found');
  });

  it('passes on the expected value and treats an upload failure as a pass', () => {
    expect(classify({ ...base, kane: kane({ exitCode: 0, end: { status: 'passed', observed: '$18.00', summary: 'ok' } }) })).toMatchObject({
      verdict: 'PASS',
      observed: '$18.00',
      reason: 'ok',
    });
    expect(classify({ ...base, kane: kane({ exitCode: 1, end: { status: 'passed', observed: '$18.00' } }) }).verdict).toBe('PASS');
  });

  it('honours the verdict mode when Kane and the value disagree', () => {
    const disagree = kane({ end: { status: 'failed', observed: '$18.00' } });
    expect(classify({ ...base, kane: disagree }).verdict).toBe('SKIP');
    expect(classify({ ...base, kane: disagree }).reason).toContain('disagree');
    expect(classify({ ...base, mode: 'value-only', kane: disagree })).toMatchObject({ verdict: 'PASS', reason: 'stored $18.00' });
  });

  it('fails on the bad signature, establishes it in the bracket, and catches false passes', () => {
    expect(classify({ ...base, badValue: null, kane: kane({ end: { status: 'failed', observed: '$20.00', summary: 'Expected "$18.00" but observed "$20.00"' } }) })).toMatchObject({
      verdict: 'FAIL',
      observed: '$20.00',
      reason: 'Expected "$18.00" but observed "$20.00"',
    });
    expect(classify({ ...base, kane: kane({ end: { status: 'failed', observed: 'Total: $20.00' } }) }).verdict).toBe('FAIL');
    expect(classify({ ...base, kane: kane({ exitCode: 0, end: { status: 'passed', observed: '$20.00' } }) })).toMatchObject({
      verdict: 'FAIL',
      reason: 'Kane reported pass but stored $20.00: false pass caught (#239)',
    });
    expect(classify({ ...base, mode: 'value-only', kane: kane({ exitCode: 0, end: { status: 'passed', observed: '$20.00' } }) })).toMatchObject({
      verdict: 'FAIL',
      reason: 'stored $20.00, expected $18.00',
    });
  });

  it('skips a commit that shows a third value', () => {
    expect(classify({ ...base, kane: kane({ end: { status: 'failed', observed: '$19.00' } }) })).toMatchObject({
      verdict: 'SKIP',
      reason: "observed $19.00, differs from the bad ref's $20.00: not this bug",
      observed: '$19.00',
    });
  });

  it('maps verdicts to git bisect run exit codes', () => {
    expect([exitCodeFor('PASS'), exitCodeFor('FAIL'), exitCodeFor('SKIP'), exitCodeFor('ABORT')]).toEqual([0, 1, 125, 128]);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**
Run: `npx vitest run test/check.test.ts test/verdict.test.ts`
Expected: FAIL — `Failed to load url ../src/check.js`

- [ ] **Step 3: Write `src/check.ts`**

```ts
import type { TemplateId } from './kane-profile.js';

export interface Check {
  url: string;
  do: string;
  store: string;
  expected: string;
}

function clean(s: string): string {
  return s.trim().replace(/[.,\s]+$/u, '');
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// Spec section 3. Must stay identical to compose() in scripts/spike/run-spike.mjs.
export function composeObjective(c: Check, template: TemplateId): string {
  const url = c.url.trim();
  const d = clean(c.do);
  const st = clean(c.store);
  const ex = c.expected.trim();
  switch (template) {
    case 'commas-assert':
      return `Go to ${url}, ${d}, store ${st} as 'observed', then assert the stored observed value is "${ex}"`;
    case 'sentences-assert':
      return `Go to ${url}. ${capitalize(d)}. Store ${st} as 'observed'. Then assert that the stored observed value is "${ex}".`;
    case 'store-only':
      return `Go to ${url}, ${d}, then store ${st} as 'observed'`;
    default: {
      const unknown: never = template;
      throw new Error(`unknown template ${String(unknown)}`);
    }
  }
}

export function validateCheck(c: Check): string[] {
  const problems: string[] = [];
  if (!/^https?:\/\//i.test(c.url.trim())) problems.push('--url must start with http:// or https://');
  if (c.do.trim() === '') problems.push('--do must not be empty');
  if (c.store.trim() === '') problems.push('--store must not be empty');
  if (c.expected.trim() === '') problems.push('--expect must not be empty');
  const fields: Array<[string, string]> = [
    ['--url', c.url],
    ['--do', c.do],
    ['--store', c.store],
    ['--expect', c.expected],
  ];
  for (const [flag, value] of fields) if (value.includes('{{')) problems.push(`${flag} must not contain {{`);
  if (c.expected.includes('"')) problems.push('--expect must not contain a double quote');
  return problems;
}

export function normalizeValue(v: string): string {
  let s = v.trim().replace(/\s+/g, ' ').toLowerCase();
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function numberTokens(s: string): number[] {
  const m = s.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/-?\d+(?:\.\d+)?/g);
  return m === null ? [] : m.map(Number);
}

export function valuesMatch(a: string, b: string): boolean {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  if (na === '' || nb === '') return false;
  if (na === nb) return true;
  const ta = numberTokens(na);
  const tb = numberTokens(nb);
  return ta.length === 1 && tb.length === 1 && ta[0] === tb[0];
}
```

- [ ] **Step 4: Write `src/verdict.ts`**

```ts
import { valuesMatch } from './check.js';
import type { VerdictMode } from './kane-profile.js';
import type { KaneRunResult } from './kane/runner.js';

export type VerdictKind = 'PASS' | 'FAIL' | 'SKIP' | 'ABORT';
export type Phase = 'bracket' | 'bisect' | 'confirm' | 'fix';

export interface StepOutcome {
  ok: boolean;
  detail: string;
}

export interface ClassifyInput {
  setup?: StepOutcome;
  ready?: StepOutcome;
  kane?: KaneRunResult;
  expected: string;
  badValue: string | null;
  mode: VerdictMode;
}

export interface Classification {
  verdict: VerdictKind;
  reason: string;
  observed: string | null;
  misphrased: boolean;
  emptyValue: boolean;
  retryable: boolean;
}

const AUTH_RE = /auth|log ?in|credential|unauthori[sz]ed|forbidden|\b401\b|\b403\b/i;

export function isAuthFailure(r: KaneRunResult): boolean {
  return r.exitCode === 2 && AUTH_RE.test([...r.stream.errors, r.stderrTail].join('\n'));
}

export function isTransient(r: KaneRunResult): boolean {
  return r.killed || r.terminalMode || r.stream.runEnd === null || r.exitCode === 3;
}

function transientReason(r: KaneRunResult): string {
  if (r.terminalMode) return 'Kane started in terminal mode (the first stdout line was not JSON)';
  if (r.killed) return 'Kane timed out (killed by the outer timer)';
  if (r.exitCode === 3) return 'Kane timed out or was cancelled (exit 3)';
  const detail = r.stream.errors[0] ?? r.stderrTail.split(/\r?\n/).find((l) => l.trim() !== '') ?? 'no run_end';
  return `Kane error (exit ${r.exitCode === null ? 'none' : String(r.exitCode)}): ${detail}`;
}

export function classify(i: ClassifyInput): Classification {
  const out = (verdict: VerdictKind, reason: string, extra: Partial<Classification> = {}): Classification => ({
    verdict,
    reason,
    observed: null,
    misphrased: false,
    emptyValue: false,
    retryable: false,
    ...extra,
  });
  if (i.setup !== undefined && !i.setup.ok) return out('SKIP', `setup failed (${i.setup.detail})`);
  if (i.ready !== undefined && !i.ready.ok) return out('SKIP', `page never loaded (${i.ready.detail})`);
  const k = i.kane;
  if (k === undefined) return out('SKIP', 'Kane did not run');
  if (k.spawnError !== null) {
    return out(
      'ABORT',
      k.spawnError === 'ENOENT' ? 'kane-cli not found (install it with npm install -g @testmuai/kane-cli)' : `could not start Kane (${k.spawnError})`,
    );
  }
  if (isAuthFailure(k)) return out('ABORT', 'Kane authentication failed — run kane-cli login');
  const end = k.stream.runEnd;
  if (end === null || isTransient(k)) return out('SKIP', transientReason(k), { retryable: true });
  const observed = end.observed.trim();
  const why = end.summary || end.oneLiner || end.reason;
  if (observed === '') {
    return out('SKIP', `Kane could not read the value${why ? `: ${why}` : ''}`, {
      misphrased: end.blamesTest,
      emptyValue: true,
      retryable: true,
    });
  }
  if (valuesMatch(observed, i.expected)) {
    if (i.mode === 'value-only') return out('PASS', `stored ${observed}`, { observed });
    if (end.status === 'passed') return out('PASS', why || `stored ${observed}`, { observed });
    return out('SKIP', `Kane and the stored value disagree (stored ${observed}, Kane said ${end.status || 'failed'}${why ? `: ${why}` : ''})`, {
      observed,
    });
  }
  if (i.badValue === null || valuesMatch(observed, i.badValue)) {
    if (i.mode === 'status+value' && end.status === 'passed') {
      return out('FAIL', `Kane reported pass but stored ${observed}: false pass caught (#239)`, { observed });
    }
    const fallback = `stored ${observed}, expected ${i.expected}`;
    return out('FAIL', i.mode === 'value-only' ? fallback : why || fallback, { observed });
  }
  return out('SKIP', `observed ${observed}, differs from the bad ref's ${i.badValue}: not this bug`, { observed });
}

export function exitCodeFor(v: VerdictKind): 0 | 1 | 125 | 128 {
  switch (v) {
    case 'PASS':
      return 0;
    case 'FAIL':
      return 1;
    case 'SKIP':
      return 125;
    case 'ABORT':
      return 128;
  }
}
```

- [ ] **Step 5: Run the gate to confirm it passes**
Run: `npx vitest run test/check.test.ts test/verdict.test.ts`
Expected: PASS — output contains `Test Files  2 passed`

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**
Message: `feat(verdict): store-first objective templates, value matching and the verdict rule`

---

### Task 5: Probe stack — serve the app, session file and ledger, git helpers, one-commit probe

**Files:**
- Create: `src/app/serve.ts`
- Create: `src/session.ts`
- Create: `src/git.ts`
- Create: `src/probe.ts`
- Create: `test/helpers.ts`
- Create: `test/fixtures/tiny-server.mjs`
- Test: `test/serve.test.ts`
- Test: `test/git.test.ts`
- Test: `test/probe.test.ts`

**Depends on:** Task 1, Task 3, Task 4
**Effort:** high
**Priority:** must-have
**Provides:** `sleep(ms: number): Promise<void>`, `urlResponds(url: string, timeoutMs?: number): Promise<boolean>`, `interface ServerHandle { child: ChildProcess; exited(): number | null | undefined; output(): string; stop(): Promise<void> }`, `startServer(command: string, cwd: string, env?: NodeJS.ProcessEnv): ServerHandle`, `waitReady(url: string, server: ServerHandle, timeoutMs: number): Promise<StepOutcome>`, `waitDown(url: string, timeoutMs: number): Promise<boolean>`, `runSetup(command: string, cwd: string, timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<StepOutcome>`, `interface LedgerEntry { phase: Phase; label: string; commit: string; subject: string; verdict: VerdictKind; reason: string; observed: string | null; kaneRuns: number; creditsConsumed: number | null; testUrl: string | null; resultCode: string | null; durationMs: number; at: string }`, `interface Session { version: 1; repoDir: string; sessionDir: string; worktreeDir: string; kaneCwd: string; ledgerPath: string; check: Check; template: TemplateId; verdictMode: VerdictMode; serve: string; setup: string | null; kaneCmd: string[]; kaneTimeoutSec: number; readyTimeoutSec: number; setupTimeoutSec: number; maxRuns: number; runsUsed: number; badValue: string | null }`, `interface HuntLog { entry(e: LedgerEntry): void; info(line: string): void }`, `interface Limits { minBalance: number; maxRuns: number; maxFixAttempts: number; kaneTimeoutSec: number; agentTimeoutSec: number; readyTimeoutSec: number; setupTimeoutSec: number; keepSession: boolean }`, `readLimits(env: NodeJS.ProcessEnv): Limits`, `writeSession(file: string, s: Session): void`, `readSession(file: string): Session`, `appendLedger(file: string, e: LedgerEntry): void`, `readLedger(file: string): LedgerEntry[]`, `stamp(d?: Date): string`, `class GitError extends Error`, `git(cwd: string, args: string[], timeoutMs?: number): Promise<ExecResult>`, `gitOut(cwd: string, args: string[], timeoutMs?: number): Promise<string>`, `revParse(cwd: string, ref: string): Promise<string>`, `subjectOf(cwd: string, ref: string): Promise<string>`, `isAncestor(cwd: string, a: string, b: string): Promise<boolean>`, `topLevel(cwd: string): Promise<string>`, `commonDir(cwd: string): Promise<string>`, `addWorktree(repoDir: string, dir: string, ref: string): Promise<void>`, `removeWorktree(repoDir: string, dir: string): Promise<void>`, `checkoutDetached(cwd: string, ref: string): Promise<void>`, `statusPorcelain(cwd: string): Promise<string>`, `branchExists(cwd: string, name: string): Promise<boolean>`, `KANE_MAX_STEPS = 25`, `interface ProbeTarget { phase: Phase; label: string; cwd: string; commit: string; subject: string }`, `interface ProbeResult { entry: LedgerEntry; misphrased: boolean; emptyValue: boolean }`, `probe(sessionPath: string, t: ProbeTarget): Promise<ProbeResult>`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`, `test/fixtures/tiny-server.mjs (node tiny-server.mjs <port> [--crash])`
**Requires:** `interface ExecResult { code: number | null; stdout: string; stderr: string; timedOut: boolean; spawnError: string | null; durationMs: number }`, `execArgv(argv: string[], opts: ExecOptions): Promise<ExecResult>`, `execShell(command: string, opts: ExecOptions): Promise<ExecResult>`, `spawnShell(command: string, opts: { cwd: string; env?: NodeJS.ProcessEnv }): ChildProcess`, `killTree(pid: number | undefined): void`, `runKane(o: RunKaneOptions): Promise<KaneRunResult>`, `interface Check { url: string; do: string; store: string; expected: string }`, `composeObjective(c: Check, template: TemplateId): string`, `classify(i: ClassifyInput): Classification`, `interface Classification { verdict: VerdictKind; reason: string; observed: string | null; misphrased: boolean; emptyValue: boolean; retryable: boolean }`, `interface StepOutcome { ok: boolean; detail: string }`, `type VerdictKind = 'PASS' | 'FAIL' | 'SKIP' | 'ABORT'`, `type Phase = 'bracket' | 'bisect' | 'confirm' | 'fix'`, `type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only'`, `type VerdictMode = 'status+value' | 'value-only'`, `test/fixtures/stub-kane.mjs (STUB_KANE_PLAN rules matched on FIRSTBAD_LABEL; scenarios pass, fail, misphrased, error, auth, timeout, hang, upload-failed, crash, prose, false-pass, token-leak, fetch; logs to STUB_KANE_LOG)`

Upstream modules you import (already in the repo): `src/util/proc.ts` (`execArgv`, `execShell`, `spawnShell`, `killTree`, `ExecResult`, `ExecOptions` with `{ cwd: string; env?: NodeJS.ProcessEnv; timeoutMs: number; input?: string }`), `src/kane/runner.ts` (`runKane` with `RunKaneOptions { kaneCmd: string[]; objective: string; timeoutSec: number; maxSteps: number; cwd: string; name?: string; label?: string; env?: NodeJS.ProcessEnv; killAfterMs?: number }`, `KaneRunResult` whose `stream.runEnd` has `creditsConsumed`, `testUrl`, `resultCode`), `src/check.ts`, `src/verdict.ts`, `src/kane-profile.ts`. The stub's `fetch` scenario GETs the URL in the objective and stores the trimmed body as `observed`; it passes when the body equals the expected value. `FIRSTBAD_LABEL` is set by the probe to `<phase>|<label>|<subject>`.

Probe order (spec sections 4 and 6): optional setup → port must be free (else ABORT "port busy") → start the server with the shell in the commit's directory → wait for the URL (else SKIP "page never loaded", no Kane run) → up to two Kane runs (the second only when the first is `retryable`; each run first checks and increments `runsUsed` in the session file against `maxRuns`, else ABORT "run cap reached") → classify → append the ledger entry → stop the server and wait for the URL to go quiet.

- [ ] **Step 1: Write the test helpers `test/helpers.ts`**

```ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STUB_KANE = path.join(ROOT, 'test', 'fixtures', 'stub-kane.mjs');
export const STUB_AGENT = path.join(ROOT, 'test', 'fixtures', 'stub-agent.mjs');
export const TINY_SERVER = path.join(ROOT, 'test', 'fixtures', 'tiny-server.mjs');
export const KANE_CMD = [process.execPath, STUB_KANE];

// A server that answers every request with the content of value.txt in its working directory.
export const VALUE_SERVER = [
  "import fs from 'node:fs';",
  "import http from 'node:http';",
  'const port = Number(process.argv[2]);',
  'http',
  '  .createServer((req, res) => {',
  "    res.writeHead(200, { 'content-type': 'text/plain' });",
  "    res.end(fs.readFileSync('value.txt', 'utf8'));",
  '  })',
  "  .listen(port, '127.0.0.1');",
  '',
].join('\n');

export const CRASH_SERVER = "throw new Error('server crashed on purpose');\n";

export function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

export function git(dir: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: dir, env: GIT_ENV, encoding: 'utf8' }).trim();
}

export interface FakeCommit {
  subject: string;
  files: Record<string, string>;
  tag?: string;
}

export function makeRepo(commits: FakeCommit[]): string {
  const dir = tempDir('firstbad-repo-');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'core.autocrlf', 'false');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  for (const c of commits) {
    for (const [file, content] of Object.entries(c.files)) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '--no-verify', '-m', c.subject);
    if (c.tag !== undefined) git(dir, 'tag', c.tag);
  }
  return dir;
}

// Nine commits: good from c1 (tag v1); the server crashes in c4-c5 (bisect's first probe lands on c5);
// the culprit c7 changes the value from $18.00 to $20.00.
export function bisectRepo(): string {
  return makeRepo([
    { subject: 'good: init', files: { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00', '.gitignore': 'node_modules/\n' }, tag: 'v1' },
    { subject: 'good: docs', files: { 'README.md': 'docs 1\n' } },
    { subject: 'good: more docs', files: { 'README.md': 'docs 2\n' } },
    { subject: 'broken: server crash', files: { 'server.mjs': CRASH_SERVER } },
    { subject: 'broken: still down', files: { 'README.md': 'docs 3\n' } },
    { subject: 'good: restore server', files: { 'server.mjs': VALUE_SERVER } },
    { subject: 'bad: culprit', files: { 'value.txt': '$20.00' } },
    { subject: 'bad: after one', files: { 'README.md': 'docs 4\n' } },
    { subject: 'bad: after two', files: { 'README.md': 'docs 5\n' } },
  ]);
}

// The stub kane-cli and anything it spawns inherit process.env, so tests steer the stub through it.
export function setStubPlan(dir: string, plan: unknown): { plan: string; log: string } {
  const planPath = path.join(dir, 'stub-plan.json');
  const logPath = path.join(dir, 'stub-log.jsonl');
  fs.writeFileSync(planPath, JSON.stringify(plan));
  process.env.STUB_KANE_PLAN = planPath;
  process.env.STUB_KANE_LOG = logPath;
  return { plan: planPath, log: logPath };
}

export function clearStubEnv(): void {
  for (const key of [
    'STUB_KANE_PLAN',
    'STUB_KANE_LOG',
    'STUB_KANE_BALANCE',
    'STUB_AGENT_MODE',
    'STUB_AGENT_FILE',
    'STUB_AGENT_CONTENT',
    'STUB_AGENT_NOOP_FIRST',
    'STUB_AGENT_STATE',
    'STUB_AGENT_LOG',
  ]) {
    delete process.env[key];
  }
}

export function stubRuns(logPath: string): number {
  if (!fs.existsSync(logPath)) return 0;
  return fs
    .readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '').length;
}
```

- [ ] **Step 2: Write `test/fixtures/tiny-server.mjs`**

```js
#!/usr/bin/env node
// A tiny HTTP server for tests: node tiny-server.mjs <port> [--crash]
import http from 'node:http';

const port = Number(process.argv[2] ?? '4300');
if (process.argv.includes('--crash')) {
  console.error('tiny-server: crashing on purpose');
  process.exit(1);
}
http
  .createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  })
  .listen(port, '127.0.0.1', () => console.log(`tiny-server on ${port}`));
```

- [ ] **Step 3: Write the failing tests**

`test/serve.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { runSetup, startServer, urlResponds, waitDown, waitReady, type ServerHandle } from '../src/app/serve.js';
import { TINY_SERVER, tempDir } from './helpers.js';

const started: ServerHandle[] = [];
afterEach(async () => {
  for (const s of started.splice(0)) await s.stop();
});

describe('serve', () => {
  it('starts a server, sees it ready, stops it and sees it go quiet', async () => {
    const dir = tempDir('firstbad-serve-');
    expect(await urlResponds('http://127.0.0.1:4319/')).toBe(false);
    const s = startServer(`node "${TINY_SERVER}" 4311`, dir);
    started.push(s);
    expect(await waitReady('http://127.0.0.1:4311/', s, 10_000)).toEqual({ ok: true, detail: 'ready' });
    expect(await urlResponds('http://127.0.0.1:4311/')).toBe(true);
    await s.stop();
    expect(await waitDown('http://127.0.0.1:4311/', 5000)).toBe(true);
  });

  it('reports a crashing server and a server that never answers', async () => {
    const dir = tempDir('firstbad-serve-');
    const crash = startServer(`node "${TINY_SERVER}" 4312 --crash`, dir);
    started.push(crash);
    expect(await waitReady('http://127.0.0.1:4312/', crash, 10_000)).toEqual({ ok: false, detail: 'server exited with code 1' });
    const silent = startServer('node -e "setTimeout(() => {}, 60000)"', dir);
    started.push(silent);
    expect(await waitReady('http://127.0.0.1:4313/', silent, 1500)).toEqual({
      ok: false,
      detail: 'no answer from http://127.0.0.1:4313/ within 2 s',
    });
    await silent.stop();
    expect(silent.exited()).not.toBeUndefined();
  });

  it('runs setup commands with exit codes and a timeout', async () => {
    const dir = tempDir('firstbad-setup-');
    expect(await runSetup('node -e "process.exit(0)"', dir, 20_000)).toEqual({ ok: true, detail: 'ok' });
    expect(await runSetup('node -e "process.exit(3)"', dir, 20_000)).toEqual({ ok: false, detail: 'exit 3' });
    expect(await runSetup('node -e "setTimeout(() => {}, 60000)"', dir, 1000)).toEqual({ ok: false, detail: 'timed out after 1 s' });
  });
});
```

`test/git.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GitError,
  addWorktree,
  branchExists,
  checkoutDetached,
  commonDir,
  isAncestor,
  removeWorktree,
  revParse,
  statusPorcelain,
  subjectOf,
  topLevel,
} from '../src/git.js';
import { git, makeRepo, tempDir } from './helpers.js';

describe('git helpers', () => {
  it('resolves refs, subjects and ancestry', async () => {
    const repo = makeRepo([
      { subject: 'one', files: { 'a.txt': '1' }, tag: 'v1' },
      { subject: 'two', files: { 'a.txt': '2' } },
      { subject: 'three', files: { 'a.txt': '3' } },
    ]);
    expect(await revParse(repo, 'HEAD')).toMatch(/^[0-9a-f]{40}$/);
    expect(await subjectOf(repo, 'HEAD')).toBe('three');
    expect(await isAncestor(repo, 'v1', 'HEAD')).toBe(true);
    expect(await isAncestor(repo, 'HEAD', 'v1')).toBe(false);
    await expect(revParse(repo, 'no-such-ref')).rejects.toBeInstanceOf(GitError);
    expect(fs.realpathSync(await topLevel(repo))).toBe(fs.realpathSync(repo));
    expect(fs.realpathSync(await commonDir(repo))).toBe(fs.realpathSync(path.join(repo, '.git')));
    expect(await branchExists(repo, 'main')).toBe(true);
    expect(await branchExists(repo, 'nope')).toBe(false);
  });

  it('adds, uses and removes a detached worktree without touching the checkout', async () => {
    const repo = makeRepo([
      { subject: 'one', files: { 'a.txt': '1' }, tag: 'v1' },
      { subject: 'two', files: { 'a.txt': '2' } },
    ]);
    const head = await revParse(repo, 'HEAD');
    const wt = path.join(tempDir('firstbad-wt-'), 'wt');
    await addWorktree(repo, wt, 'v1');
    expect(await subjectOf(wt, 'HEAD')).toBe('one');
    await checkoutDetached(wt, head);
    expect(await subjectOf(wt, 'HEAD')).toBe('two');
    fs.writeFileSync(path.join(wt, 'a.txt'), 'changed');
    expect(await statusPorcelain(wt)).toContain('a.txt');
    await removeWorktree(repo, wt);
    expect(fs.existsSync(wt)).toBe(false);
    expect(git(repo, 'worktree', 'list')).not.toContain('firstbad-wt-');
    expect(git(repo, 'status', '--porcelain')).toBe('');
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(head);
  });
});
```

`test/probe.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startServer, waitReady } from '../src/app/serve.js';
import { probe, type ProbeTarget } from '../src/probe.js';
import { readLedger, readSession, writeSession, type Session } from '../src/session.js';
import { CRASH_SERVER, KANE_CMD, TINY_SERVER, VALUE_SERVER, clearStubEnv, setStubPlan, tempDir } from './helpers.js';

let work = '';

function makeSession(port: number, files: Record<string, string>, over: Partial<Session> = {}): { sessionPath: string; app: string } {
  work = tempDir('firstbad-probe-');
  const app = path.join(work, 'app');
  fs.mkdirSync(app);
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(app, file), content);
  const kaneCwd = path.join(work, 'kane');
  fs.mkdirSync(kaneCwd);
  const session: Session = {
    version: 1,
    repoDir: app,
    sessionDir: work,
    worktreeDir: app,
    kaneCwd,
    ledgerPath: path.join(work, 'ledger.jsonl'),
    check: { url: `http://127.0.0.1:${port}/`, do: 'read the page', store: 'the page text', expected: '$18.00' },
    template: 'commas-assert',
    verdictMode: 'status+value',
    serve: `node server.mjs ${port}`,
    setup: null,
    kaneCmd: KANE_CMD,
    kaneTimeoutSec: 30,
    readyTimeoutSec: 10,
    setupTimeoutSec: 30,
    maxRuns: 16,
    runsUsed: 0,
    badValue: null,
    ...over,
  };
  const sessionPath = path.join(work, 'session.json');
  writeSession(sessionPath, session);
  fs.writeFileSync(session.ledgerPath, '');
  return { sessionPath, app };
}

const target = (app: string, label = 'probe'): ProbeTarget => ({ phase: 'bisect', label, cwd: app, commit: 'c'.repeat(40), subject: 'test commit' });

afterEach(() => clearStubEnv());

describe('probe', () => {
  it('passes a commit whose page shows the expected value and records the run', async () => {
    const { sessionPath, app } = makeSession(4321, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({
      phase: 'bisect',
      verdict: 'PASS',
      observed: '$18.00',
      kaneRuns: 1,
      creditsConsumed: 12.5,
      testUrl: 'https://kane.example.invalid/test-manager/stub',
    });
    const s = readSession(sessionPath);
    expect(s.runsUsed).toBe(1);
    expect(readLedger(s.ledgerPath)).toHaveLength(1);
  });

  it('fails a commit that shows the bad signature', async () => {
    const { sessionPath, app } = makeSession(4322, { 'server.mjs': VALUE_SERVER, 'value.txt': '$20.00' }, { badValue: '$20.00' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    expect((await probe(sessionPath, target(app))).entry).toMatchObject({ verdict: 'FAIL', observed: '$20.00' });
  });

  it('skips a failed setup and a server that never loads, without Kane', async () => {
    const a = makeSession(4323, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, { setup: 'node -e "process.exit(3)"' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    expect((await probe(a.sessionPath, target(a.app))).entry).toMatchObject({ verdict: 'SKIP', reason: 'setup failed (exit 3)', kaneRuns: 0 });
    const b = makeSession(4324, { 'server.mjs': CRASH_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    const r = await probe(b.sessionPath, target(b.app));
    expect(r.entry.verdict).toBe('SKIP');
    expect(r.entry.reason).toContain('page never loaded');
    expect(readSession(b.sessionPath).runsUsed).toBe(0);
  });

  it('aborts on a busy port and on the run cap', async () => {
    const busy = startServer(`node "${TINY_SERVER}" 4325`, os.tmpdir());
    try {
      expect((await waitReady('http://127.0.0.1:4325/', busy, 10_000)).ok).toBe(true);
      const a = makeSession(4325, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
      setStubPlan(work, { default: { scenario: 'fetch' } });
      const r = await probe(a.sessionPath, target(a.app));
      expect(r.entry.verdict).toBe('ABORT');
      expect(r.entry.reason).toContain('port busy');
    } finally {
      await busy.stop();
    }
    const b = makeSession(4326, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, { maxRuns: 0 });
    setStubPlan(work, { default: { scenario: 'fetch' } });
    expect((await probe(b.sessionPath, target(b.app))).entry).toMatchObject({ verdict: 'ABORT', reason: 'run cap reached (FIRSTBAD_MAX_RUNS=0)' });
  });

  it('retries a transient Kane error once and counts both runs', async () => {
    const { sessionPath, app } = makeSession(4327, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'fetch' }, rules: [{ labelIncludes: 'retry-me', steps: [{ scenario: 'error' }, { scenario: 'fetch' }] }] });
    const r = await probe(sessionPath, target(app, 'retry-me'));
    expect(r.entry).toMatchObject({ verdict: 'PASS', kaneRuns: 2, creditsConsumed: 12.5 });
    expect(readSession(sessionPath).runsUsed).toBe(2);
  });

  it('retries an empty stored value once, then reports it as mis-phrased', async () => {
    const { sessionPath, app } = makeSession(4328, { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' });
    setStubPlan(work, { default: { scenario: 'misphrased' } });
    const r = await probe(sessionPath, target(app));
    expect(r.entry).toMatchObject({ verdict: 'SKIP', kaneRuns: 2, observed: null });
    expect(r.misphrased).toBe(true);
    expect(r.emptyValue).toBe(true);
  });
});
```

- [ ] **Step 4: Run them to confirm they fail**
Run: `npx vitest run test/serve.test.ts test/git.test.ts test/probe.test.ts`
Expected: FAIL — `Failed to load url ../src/app/serve.js`

- [ ] **Step 5: Write `src/app/serve.ts`**

```ts
import type { ChildProcess } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { execShell, killTree, spawnShell } from '../util/proc.js';
import type { StepOutcome } from '../verdict.js';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Any HTTP answer below 500 counts. agent:false so no keep-alive socket holds the process open.
export function urlResponds(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean): void => {
      if (done) return;
      done = true;
      resolve(value);
    };
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      finish(false);
      return;
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(parsed, { agent: false, timeout: timeoutMs }, (res) => {
      res.resume();
      finish((res.statusCode ?? 500) < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      finish(false);
    });
    req.on('error', () => finish(false));
  });
}

export interface ServerHandle {
  child: ChildProcess;
  exited(): number | null | undefined;
  output(): string;
  stop(): Promise<void>;
}

export function startServer(command: string, cwd: string, env?: NodeJS.ProcessEnv): ServerHandle {
  const child = spawnShell(command, { cwd, env });
  let out = '';
  let exitCode: number | null | undefined;
  const keep = (chunk: string): void => {
    out = (out + chunk).slice(-4000);
  };
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', keep);
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', keep);
  const exited = new Promise<void>((resolve) => {
    child.on('exit', (code: number | null) => {
      exitCode = code;
      resolve();
    });
    child.on('error', () => {
      exitCode = -1;
      resolve();
    });
  });
  return {
    child,
    exited: () => exitCode,
    output: () => out,
    stop: async () => {
      if (exitCode !== undefined) return;
      killTree(child.pid);
      await Promise.race([exited, sleep(5000)]);
    },
  };
}

export async function waitReady(url: string, server: ServerHandle, timeoutMs: number): Promise<StepOutcome> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const code = server.exited();
    if (code !== undefined) return { ok: false, detail: `server exited with code ${code === null ? 'none' : String(code)}` };
    if (await urlResponds(url, 1500)) return { ok: true, detail: 'ready' };
    await sleep(250);
  }
  const code = server.exited();
  if (code !== undefined) return { ok: false, detail: `server exited with code ${code === null ? 'none' : String(code)}` };
  return { ok: false, detail: `no answer from ${url} within ${Math.round(timeoutMs / 1000)} s` };
}

export async function waitDown(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await urlResponds(url, 1000))) return true;
    await sleep(200);
  }
  return false;
}

export async function runSetup(command: string, cwd: string, timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<StepOutcome> {
  const r = await execShell(command, { cwd, env, timeoutMs });
  if (r.timedOut) return { ok: false, detail: `timed out after ${Math.round(timeoutMs / 1000)} s` };
  if (r.spawnError !== null) return { ok: false, detail: `could not start (${r.spawnError})` };
  if (r.code !== 0) return { ok: false, detail: `exit ${r.code === null ? 'none' : String(r.code)}` };
  return { ok: true, detail: 'ok' };
}
```

- [ ] **Step 6: Write `src/session.ts`**

```ts
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
```

- [ ] **Step 7: Write `src/git.ts`**

```ts
import path from 'node:path';
import { execArgv, type ExecResult } from './util/proc.js';

export class GitError extends Error {
  constructor(args: string[], r: ExecResult) {
    super(`git ${args.join(' ')} failed (exit ${r.code === null ? 'none' : String(r.code)}): ${(r.stderr || r.stdout).trim().slice(0, 500)}`);
    this.name = 'GitError';
  }
}

export function git(cwd: string, args: string[], timeoutMs = 120_000): Promise<ExecResult> {
  return execArgv(['git', ...args], { cwd, timeoutMs });
}

export async function gitOut(cwd: string, args: string[], timeoutMs?: number): Promise<string> {
  const r = await git(cwd, args, timeoutMs);
  if (r.code !== 0) throw new GitError(args, r);
  return r.stdout.trim();
}

export function revParse(cwd: string, ref: string): Promise<string> {
  return gitOut(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
}

export function subjectOf(cwd: string, ref: string): Promise<string> {
  return gitOut(cwd, ['log', '-1', '--format=%s', ref]);
}

export async function isAncestor(cwd: string, a: string, b: string): Promise<boolean> {
  const args = ['merge-base', '--is-ancestor', a, b];
  const r = await git(cwd, args);
  if (r.code === 0) return true;
  if (r.code === 1) return false;
  throw new GitError(args, r);
}

export function topLevel(cwd: string): Promise<string> {
  return gitOut(cwd, ['rev-parse', '--show-toplevel']);
}

export async function commonDir(cwd: string): Promise<string> {
  return path.resolve(cwd, await gitOut(cwd, ['rev-parse', '--git-common-dir']));
}

export async function addWorktree(repoDir: string, dir: string, ref: string): Promise<void> {
  await gitOut(repoDir, ['worktree', 'add', '--detach', dir, ref]);
}

export async function removeWorktree(repoDir: string, dir: string): Promise<void> {
  await git(repoDir, ['worktree', 'remove', '--force', dir]);
  await git(repoDir, ['worktree', 'prune']);
}

export async function checkoutDetached(cwd: string, ref: string): Promise<void> {
  await gitOut(cwd, ['checkout', '--detach', '--force', '--quiet', ref]);
}

export function statusPorcelain(cwd: string): Promise<string> {
  return gitOut(cwd, ['status', '--porcelain']);
}

export async function branchExists(cwd: string, name: string): Promise<boolean> {
  const r = await git(cwd, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]);
  return r.code === 0;
}
```

- [ ] **Step 8: Write `src/probe.ts`**

```ts
import { runSetup, startServer, urlResponds, waitDown, waitReady } from './app/serve.js';
import { composeObjective } from './check.js';
import { runKane, type KaneRunResult } from './kane/runner.js';
import { appendLedger, readSession, writeSession, type LedgerEntry } from './session.js';
import { classify, type Classification, type Phase, type VerdictKind } from './verdict.js';

export const KANE_MAX_STEPS = 25;

export interface ProbeTarget {
  phase: Phase;
  label: string;
  cwd: string;
  commit: string;
  subject: string;
}

export interface ProbeResult {
  entry: LedgerEntry;
  misphrased: boolean;
  emptyValue: boolean;
}

interface Outcome {
  verdict: VerdictKind;
  reason: string;
  observed: string | null;
  misphrased?: boolean;
  emptyValue?: boolean;
}

export async function probe(sessionPath: string, t: ProbeTarget): Promise<ProbeResult> {
  const started = Date.now();
  const first = readSession(sessionPath);
  let kaneRuns = 0;
  let credits: number | null = null;
  let last: KaneRunResult | undefined;
  const finish = (c: Outcome): ProbeResult => {
    const end = last?.stream.runEnd ?? null;
    const entry: LedgerEntry = {
      phase: t.phase,
      label: t.label,
      commit: t.commit,
      subject: t.subject,
      verdict: c.verdict,
      reason: c.reason,
      observed: c.observed,
      kaneRuns,
      creditsConsumed: credits,
      testUrl: end?.testUrl ?? null,
      resultCode: end?.resultCode ?? null,
      durationMs: Date.now() - started,
      at: new Date().toISOString(),
    };
    appendLedger(first.ledgerPath, entry);
    return { entry, misphrased: c.misphrased ?? false, emptyValue: c.emptyValue ?? false };
  };
  const common = { expected: first.check.expected, badValue: first.badValue, mode: first.verdictMode };

  if (first.setup !== null) {
    const setup = await runSetup(first.setup, t.cwd, first.setupTimeoutSec * 1000);
    if (!setup.ok) return finish(classify({ ...common, setup }));
  }
  if (await urlResponds(first.check.url)) {
    return finish({ verdict: 'ABORT', reason: `port busy: something is already serving ${first.check.url}; stop it or choose another port`, observed: null });
  }
  const server = startServer(first.serve, t.cwd);
  try {
    const ready = await waitReady(first.check.url, server, first.readyTimeoutSec * 1000);
    if (!ready.ok) return finish(classify({ ...common, ready }));
    let c: Classification | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const s = readSession(sessionPath);
      if (s.runsUsed >= s.maxRuns) return finish({ verdict: 'ABORT', reason: `run cap reached (FIRSTBAD_MAX_RUNS=${s.maxRuns})`, observed: null });
      s.runsUsed += 1;
      writeSession(sessionPath, s);
      kaneRuns += 1;
      last = await runKane({
        kaneCmd: s.kaneCmd,
        objective: composeObjective(s.check, s.template),
        timeoutSec: s.kaneTimeoutSec,
        maxSteps: KANE_MAX_STEPS,
        cwd: s.kaneCwd,
        label: `${t.phase}|${t.label}|${t.subject}`,
      });
      const spent = last.stream.runEnd?.creditsConsumed;
      if (typeof spent === 'number') credits = Math.round(((credits ?? 0) + spent) * 100) / 100;
      c = classify({ ...common, kane: last });
      if (!c.retryable) break;
    }
    if (c === undefined) return finish({ verdict: 'SKIP', reason: 'Kane did not run', observed: null });
    return finish(c);
  } finally {
    await server.stop();
    await waitDown(first.check.url, 5000);
  }
}
```

- [ ] **Step 9: Run the gate to confirm it passes**
Run: `npx vitest run test/serve.test.ts test/git.test.ts test/probe.test.ts`
Expected: PASS — output contains `Test Files  3 passed`

- [ ] **Step 10: Commit (kernel-performed — no agent runs this)**
Message: `feat(probe): serve each commit, session ledger, git helpers and the one-commit probe`

---

### Task 6: The `git bisect run` oracle and the hunt (preflight, worktree, bracket, bisect, confirm, cleanup)

**Files:**
- Create: `src/oracle.ts`
- Create: `src/oracle-bin.ts`
- Create: `src/hunt.ts`
- Test: `test/hunt.test.ts`

**Depends on:** Task 1, Task 3, Task 4, Task 5
**Effort:** high
**Priority:** must-have
**Provides:** `ORACLE_MARK = '@@firstbad '`, `runOracle(sessionPath: string, cwd: string, write?: (line: string) => void): Promise<number>`, `dist/oracle-bin.js (git bisect run script: --session <file>; exit 0 good, 1 bad, 125 skip, 128 abort)`, `MIN_KANE_VERSION = '0.10.9'`, `class PreflightError extends Error`, `interface PrepareOptions { repoDir: string; good: string; bad: string; check: Check; serve: string; setup: string | null; kaneCmd: string[]; env: NodeJS.ProcessEnv; template?: TemplateId; verdictMode?: VerdictMode }`, `interface Prepared { sessionPath: string; session: Session; balanceBefore: number | null; goodSha: string; badSha: string }`, `type HuntStatus = 'confirmed' | 'unconfirmed' | 'nothing-to-hunt' | 'aborted'`, `interface HuntResult { status: HuntStatus; message: string; culprit: { commit: string; subject: string } | null; parent: string | null; badValue: string | null; entries: LedgerEntry[] }`, `defaultOracleCmd(): string[]`, `prepareSession(o: PrepareOptions, log: HuntLog): Promise<Prepared>`, `parseBisectOutput(output: string): { firstBad: string | null; candidates: string[] }`, `hunt(p: Prepared, log: HuntLog, oracleCmd?: string[]): Promise<HuntResult>`, `cleanupSession(sessionPath: string, keep?: boolean): Promise<void>`
**Requires:** `KANE_PROFILE: KaneProfile (src/kane-profile.ts)`, `type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only'`, `type VerdictMode = 'status+value' | 'value-only'`, `kaneBalance(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<number | null>`, `kaneVersion(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<string | null>`, `versionAtLeast(version: string, min: string): boolean`, `interface Check { url: string; do: string; store: string; expected: string }`, `validateCheck(c: Check): string[]`, `exitCodeFor(v: VerdictKind): 0 | 1 | 125 | 128`, `interface LedgerEntry { phase: Phase; label: string; commit: string; subject: string; verdict: VerdictKind; reason: string; observed: string | null; kaneRuns: number; creditsConsumed: number | null; testUrl: string | null; resultCode: string | null; durationMs: number; at: string }`, `interface Session { version: 1; repoDir: string; sessionDir: string; worktreeDir: string; kaneCwd: string; ledgerPath: string; check: Check; template: TemplateId; verdictMode: VerdictMode; serve: string; setup: string | null; kaneCmd: string[]; kaneTimeoutSec: number; readyTimeoutSec: number; setupTimeoutSec: number; maxRuns: number; runsUsed: number; badValue: string | null }`, `interface HuntLog { entry(e: LedgerEntry): void; info(line: string): void }`, `readLimits(env: NodeJS.ProcessEnv): Limits`, `writeSession(file: string, s: Session): void`, `readSession(file: string): Session`, `appendLedger(file: string, e: LedgerEntry): void`, `readLedger(file: string): LedgerEntry[]`, `stamp(d?: Date): string`, `git(cwd: string, args: string[], timeoutMs?: number): Promise<ExecResult>`, `gitOut(cwd: string, args: string[], timeoutMs?: number): Promise<string>`, `revParse(cwd: string, ref: string): Promise<string>`, `subjectOf(cwd: string, ref: string): Promise<string>`, `isAncestor(cwd: string, a: string, b: string): Promise<boolean>`, `topLevel(cwd: string): Promise<string>`, `addWorktree(repoDir: string, dir: string, ref: string): Promise<void>`, `removeWorktree(repoDir: string, dir: string): Promise<void>`, `checkoutDetached(cwd: string, ref: string): Promise<void>`, `probe(sessionPath: string, t: ProbeTarget): Promise<ProbeResult>`, `interface ProbeResult { entry: LedgerEntry; misphrased: boolean; emptyValue: boolean }`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`

Upstream facts you build on: `probe()` (src/probe.ts) serves `t.cwd`, runs Kane, appends the ledger entry to the session's `ledgerPath` and returns it; its `ProbeTarget` is `{ phase: Phase; label: string; cwd: string; commit: string; subject: string }`. `revParse(cwd, ref)` resolves `ref^{commit}` and throws `GitError` on a bad ref. `bisectRepo()` (test/helpers.ts) builds 9 commits — `good: init` (tag `v1`, value `$18.00`), `good: docs`, `good: more docs`, `broken: server crash`, `broken: still down`, `good: restore server`, `bad: culprit` (value `$20.00`), `bad: after one`, `bad: after two` — whose `server.mjs <port>` serves `value.txt`; with the stub plan `{ default: { scenario: 'fetch' } }` the stub kane reads that value. Bisect's first probe is `broken: still down`, which cannot be served, so the timeline shows a SKIP.

`git bisect run` (Git docs): the script exits 0 for good, 1–127 except 125 for bad, 125 to skip, anything else aborts. Node exits 1 on an uncaught exception, which git would read as bad, so `runOracle` must catch everything and return 128. The oracle prints exactly one line `@@firstbad <ledger entry JSON>`; the hunt relays those lines and `Bisecting:` lines and hides the rest.

- [ ] **Step 1: Write the failing test `test/hunt.test.ts`**

```ts
import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { PreflightError, cleanupSession, hunt, parseBisectOutput, prepareSession, type PrepareOptions } from '../src/hunt.js';
import { runOracle } from '../src/oracle.js';
import { readSession, type HuntLog, type LedgerEntry } from '../src/session.js';
import { KANE_CMD, VALUE_SERVER, bisectRepo, clearStubEnv, git, makeRepo, setStubPlan, stubRuns, tempDir } from './helpers.js';

const lines: string[] = [];
const log: HuntLog = {
  entry: (e: LedgerEntry) => lines.push(`${e.phase} ${e.verdict} ${e.subject}`),
  info: (l: string) => lines.push(l),
};

function options(repo: string, port: number, over: Partial<PrepareOptions> = {}): PrepareOptions {
  return {
    repoDir: repo,
    good: 'v1',
    bad: 'HEAD',
    check: { url: `http://127.0.0.1:${port}/`, do: 'read the page', store: 'the page text', expected: '$18.00' },
    serve: `node server.mjs ${port}`,
    setup: null,
    kaneCmd: KANE_CMD,
    env: { ...process.env },
    template: 'commas-assert',
    verdictMode: 'status+value',
    ...over,
  };
}

afterEach(() => {
  clearStubEnv();
  lines.length = 0;
});

describe('hunt', () => {
  it('brackets, bisects around the broken commits and confirms the culprit without touching the checkout', async () => {
    const repo = bisectRepo();
    const head = git(repo, 'rev-parse', 'HEAD');
    const stub = setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'fetch' } });
    const prepared = await prepareSession(options(repo, 4331), log);
    try {
      const h = await hunt(prepared, log);
      expect(h.status).toBe('confirmed');
      expect(h.culprit?.subject).toBe('bad: culprit');
      expect(h.badValue).toBe('$20.00');
      expect(h.entries.filter((e) => e.phase === 'bracket').map((e) => e.verdict)).toEqual(['FAIL', 'PASS']);
      expect(h.entries.some((e) => e.phase === 'bisect' && e.verdict === 'SKIP' && e.reason.includes('page never loaded'))).toBe(true);
      expect(h.entries.filter((e) => e.phase === 'confirm').map((e) => e.verdict)).toEqual(['FAIL', 'PASS']);
      expect(stubRuns(stub.log)).toBeLessThanOrEqual(10);
      expect(readSession(prepared.sessionPath).runsUsed).toBe(stubRuns(stub.log));
      expect(lines.some((l) => l.startsWith('Bisecting:'))).toBe(true);
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
    expect(fs.existsSync(prepared.session.sessionDir)).toBe(false);
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
    expect(git(repo, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(repo, 'status', '--porcelain')).toBe('');
  });

  it('reports nothing to hunt when the bad ref passes', async () => {
    const repo = makeRepo([
      { subject: 'good: a', files: { 'server.mjs': VALUE_SERVER, 'value.txt': '$18.00' }, tag: 'v1' },
      { subject: 'good: b', files: { 'README.md': 'x\n' } },
    ]);
    setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'fetch' } });
    const prepared = await prepareSession(options(repo, 4332), log);
    try {
      expect((await hunt(prepared, log)).status).toBe('nothing-to-hunt');
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('aborts with a mis-phrased message after retrying an empty value once', async () => {
    const repo = bisectRepo();
    setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'misphrased' } });
    const prepared = await prepareSession(options(repo, 4333), log);
    try {
      const h = await hunt(prepared, log);
      expect(h.status).toBe('aborted');
      expect(h.message).toContain('mis-phrased');
      expect(readSession(prepared.sessionPath).runsUsed).toBe(2);
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('refuses to start below the balance floor, with unrelated refs or with a bad check', async () => {
    const repo = bisectRepo();
    setStubPlan(tempDir('firstbad-hunt-'), { default: { scenario: 'fetch' } });
    await expect(
      prepareSession(options(repo, 4334, { env: { ...process.env, STUB_KANE_BALANCE: '100', FIRSTBAD_MIN_BALANCE: '500' } }), log),
    ).rejects.toBeInstanceOf(PreflightError);
    await expect(prepareSession(options(repo, 4334, { good: 'HEAD', bad: 'v1' }), log)).rejects.toThrow(/not an ancestor/);
    await expect(
      prepareSession(options(repo, 4334, { check: { url: 'nope', do: 'x', store: 'y', expected: 'z' } }), log),
    ).rejects.toThrow(/--url/);
  });
});

describe('oracle and bisect output', () => {
  it('parses git bisect run output', () => {
    const a = 'a'.repeat(40);
    const b = 'b'.repeat(40);
    const c = 'c'.repeat(40);
    expect(parseBisectOutput(`running x\n${a} is the first bad commit\ncommit ${a}\n`)).toEqual({ firstBad: a, candidates: [] });
    expect(
      parseBisectOutput(`There are only 'skip'ped commits left to test.\nThe first bad commit could be any of:\n${b}\n${c}\nWe cannot bisect more!\n`),
    ).toEqual({ firstBad: null, candidates: [b, c] });
    expect(parseBisectOutput('nothing useful')).toEqual({ firstBad: null, candidates: [] });
  });

  it('never exits 1 when it crashes', async () => {
    const out: string[] = [];
    const code = await runOracle('/no/such/session.json', tempDir('firstbad-oracle-'), (l) => out.push(l));
    expect(code).toBe(128);
    expect(out[0]).toMatch(/^@@firstbad /);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**
Run: `npx vitest run test/hunt.test.ts`
Expected: FAIL — `Failed to load url ../src/hunt.js`

- [ ] **Step 3: Write `src/oracle.ts`**

```ts
import { revParse, subjectOf } from './git.js';
import { probe } from './probe.js';
import { appendLedger, readSession, type LedgerEntry } from './session.js';
import { exitCodeFor } from './verdict.js';

export const ORACLE_MARK = '@@firstbad ';

function crashEntry(reason: string): LedgerEntry {
  return {
    phase: 'bisect',
    label: 'oracle error',
    commit: '',
    subject: '',
    verdict: 'ABORT',
    reason,
    observed: null,
    kaneRuns: 0,
    creditsConsumed: null,
    testUrl: null,
    resultCode: null,
    durationMs: 0,
    at: new Date().toISOString(),
  };
}

// The git-bisect-run script body. Never throws and never returns 1 for a crash.
export async function runOracle(
  sessionPath: string,
  cwd: string,
  write: (line: string) => void = (line) => {
    process.stdout.write(`${line}\n`);
  },
): Promise<number> {
  try {
    const commit = await revParse(cwd, 'HEAD');
    const subject = await subjectOf(cwd, 'HEAD');
    const { entry } = await probe(sessionPath, { phase: 'bisect', label: 'bisect', cwd, commit, subject });
    write(ORACLE_MARK + JSON.stringify(entry));
    return exitCodeFor(entry.verdict);
  } catch (err) {
    const entry = crashEntry(`oracle crashed: ${err instanceof Error ? err.message : String(err)}`);
    try {
      appendLedger(readSession(sessionPath).ledgerPath, entry);
    } catch {
      // the session file is unreadable; the marker line still reaches the hunt
    }
    write(ORACLE_MARK + JSON.stringify(entry));
    return 128;
  }
}
```

- [ ] **Step 4: Write `src/oracle-bin.ts`**

```ts
#!/usr/bin/env node
import { runOracle } from './oracle.js';

const at = process.argv.indexOf('--session');
const sessionPath = at >= 0 ? process.argv[at + 1] : undefined;
if (sessionPath === undefined) {
  process.stdout.write('firstbad oracle: --session <file> is required\n');
  process.exitCode = 128;
} else {
  runOracle(sessionPath, process.cwd()).then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.exitCode = 128;
    },
  );
}
```

- [ ] **Step 5: Write `src/hunt.ts`**

```ts
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
```

- [ ] **Step 6: Run the gate to confirm it passes**
Run: `npx vitest run test/hunt.test.ts`
Expected: PASS — output contains `Test Files  1 passed`

- [ ] **Step 7: Commit (kernel-performed — no agent runs this)**
Message: `feat(hunt): git bisect run oracle, bracket, bisect and confirm in a disposable worktree`

---

### Task 7: The agent fix loop (agent adapter, prompt, Kane re-verification, revert fallback, fix commit)

**Files:**
- Create: `src/agent.ts`
- Create: `src/fix.ts`
- Create: `test/fixtures/stub-agent.mjs`
- Test: `test/agent.test.ts`
- Test: `test/fix.test.ts`

**Depends on:** Task 1, Task 3, Task 4, Task 5, Task 6
**Effort:** high
**Priority:** must-have
**Provides:** `DEFAULT_AGENT = 'claude -p --permission-mode acceptEdits --allowedTools Read,Edit,Write,Glob,Grep'`, `parseAgent(value: string | undefined): string[] | null`, `agentEnv(base: NodeJS.ProcessEnv, promptFile: string): NodeJS.ProcessEnv`, `interface AgentRun { ok: boolean; notFound: boolean; exitCode: number | null; timedOut: boolean; outputTail: string; durationMs: number }`, `interface AgentRunOptions { cwd: string; promptFile: string; timeoutMs: number; route: AgentPromptRoute; env?: NodeJS.ProcessEnv }`, `runAgent(argv: string[], prompt: string, o: AgentRunOptions): Promise<AgentRun>`, `interface FixPromptContext { check: Check; badValue: string; culprit: { commit: string; subject: string }; parentValue: string | null; kaneSummary: string; culpritDiff: string; attempt: number; previousFailures: string[] }`, `buildFixPrompt(c: FixPromptContext): string`, `type FixStatus = 'verified' | 'unverified' | 'skipped'`, `interface FixResult { status: FixStatus; route: 'agent' | 'revert' | null; branch: string | null; attempts: number; message: string; entries: LedgerEntry[] }`, `interface FixOptions { agentArgv: string[] | null; env: NodeJS.ProcessEnv; route?: AgentPromptRoute }`, `fixCommitMessage(store: string, culpritSha: string): string`, `fix(sessionPath: string, h: HuntResult, badSha: string, o: FixOptions, log: HuntLog): Promise<FixResult>`, `commitFix(sessionPath: string, message: string): Promise<string>`, `test/fixtures/stub-agent.mjs (modes write, noop, fail, restore-from-parent via STUB_AGENT_MODE, STUB_AGENT_FILE, STUB_AGENT_CONTENT; STUB_AGENT_NOOP_FIRST with STUB_AGENT_STATE; logs to STUB_AGENT_LOG)`
**Requires:** `KANE_PROFILE: KaneProfile (src/kane-profile.ts)`, `type AgentPromptRoute = 'stdin' | 'arg'`, `scrub(text: string): string`, `splitCommand(command: string): string[]`, `execArgv(argv: string[], opts: ExecOptions): Promise<ExecResult>`, `interface Check { url: string; do: string; store: string; expected: string }`, `interface LedgerEntry { phase: Phase; label: string; commit: string; subject: string; verdict: VerdictKind; reason: string; observed: string | null; kaneRuns: number; creditsConsumed: number | null; testUrl: string | null; resultCode: string | null; durationMs: number; at: string }`, `interface HuntLog { entry(e: LedgerEntry): void; info(line: string): void }`, `readLimits(env: NodeJS.ProcessEnv): Limits`, `readSession(file: string): Session`, `git(cwd: string, args: string[], timeoutMs?: number): Promise<ExecResult>`, `gitOut(cwd: string, args: string[], timeoutMs?: number): Promise<string>`, `subjectOf(cwd: string, ref: string): Promise<string>`, `statusPorcelain(cwd: string): Promise<string>`, `branchExists(cwd: string, name: string): Promise<boolean>`, `probe(sessionPath: string, t: ProbeTarget): Promise<ProbeResult>`, `interface HuntResult { status: HuntStatus; message: string; culprit: { commit: string; subject: string } | null; parent: string | null; badValue: string | null; entries: LedgerEntry[] }`, `prepareSession(o: PrepareOptions, log: HuntLog): Promise<Prepared>`, `hunt(p: Prepared, log: HuntLog, oracleCmd?: string[]): Promise<HuntResult>`, `cleanupSession(sessionPath: string, keep?: boolean): Promise<void>`, `interface Prepared { sessionPath: string; session: Session; balanceBefore: number | null; goodSha: string; badSha: string }`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`

Upstream facts: the session (`readSession`) carries `worktreeDir` (the disposable worktree), `sessionDir` and `check`; `readLimits(env)` gives `maxFixAttempts` (default 3) and `agentTimeoutSec` (default 900); `probe(sessionPath, { phase: 'fix', label, cwd: worktreeDir, commit, subject })` serves the working tree and runs Kane; `HuntResult.entries` holds the ledger, where the `confirm` entry labelled `culprit` carries Kane's failing summary in `reason` and the one labelled `parent` carries the passing `observed` value. `execArgv` (src/util/proc.ts) pipes `input` to stdin when given and reports `spawnError: 'ENOENT'` for a missing command.

Rules (spec section 7): branch `firstbad/fix-<culprit short sha>` (suffix `-2`, `-3` … when taken) from the bad ref; each attempt writes the prompt to `<sessionDir>/prompt-<n>.md`, sets `FIRSTBAD_PROMPT_FILE`, removes `CLAUDECODE`, hands the prompt over on stdin (`route: 'stdin'`) or as the last argv entry (`route: 'arg'`, the spike's fallback); no change → the attempt fails without a Kane run; a Kane PASS → verified (the caller writes the report and calls `commitFix`); otherwise the failure goes into the next prompt; edits accumulate. No agent (`agentArgv === null`) or an agent that is not installed → `git revert --no-commit <culprit>` proved by Kane. Unverified → the branch is deleted.

- [ ] **Step 1: Write the stub agent `test/fixtures/stub-agent.mjs`**

```js
#!/usr/bin/env node
// Stub coding agent for firstbad's tests. Reads the prompt from its arguments or stdin.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const env = process.env;
const argPrompt = process.argv.slice(2).join(' ');
let prompt = argPrompt;
let via = 'arg';
if (argPrompt === '') {
  via = 'stdin';
  try {
    prompt = fs.readFileSync(0, 'utf8');
  } catch {
    prompt = '';
  }
}
let call = 0;
if (env.STUB_AGENT_STATE) {
  try {
    call = JSON.parse(fs.readFileSync(env.STUB_AGENT_STATE, 'utf8')).calls ?? 0;
  } catch {
    call = 0;
  }
  fs.writeFileSync(env.STUB_AGENT_STATE, JSON.stringify({ calls: call + 1 }));
}
if (env.STUB_AGENT_LOG) {
  fs.appendFileSync(
    env.STUB_AGENT_LOG,
    JSON.stringify({
      via,
      call,
      cwd: process.cwd(),
      promptHasFirstBad: /First bad commit: [0-9a-f]{40}/.test(prompt),
      claudecode: env.CLAUDECODE ?? null,
      promptFile: env.FIRSTBAD_PROMPT_FILE ?? null,
    }) + '\n',
  );
}

function main() {
  if (env.STUB_AGENT_NOOP_FIRST === '1' && call === 0) {
    console.log('stub-agent: no change on the first attempt');
    return 0;
  }
  const mode = env.STUB_AGENT_MODE ?? 'noop';
  const file = env.STUB_AGENT_FILE ?? 'value.txt';
  if (mode === 'write') {
    fs.writeFileSync(path.resolve(file), env.STUB_AGENT_CONTENT ?? '');
    console.log(`stub-agent: wrote ${file}`);
    return 0;
  }
  if (mode === 'restore-from-parent') {
    const m = /First bad commit: ([0-9a-f]{40})/.exec(prompt);
    if (m === null) {
      console.log('stub-agent: no culprit in the prompt');
      return 1;
    }
    const content = execFileSync('git', ['show', `${m[1]}^:${file}`], { encoding: 'utf8' });
    fs.writeFileSync(path.resolve(file), content);
    console.log(`stub-agent: restored ${file} from the culprit's parent`);
    return 0;
  }
  if (mode === 'fail') {
    console.log('stub-agent: failing on purpose');
    return 1;
  }
  console.log('stub-agent: no change');
  return 0;
}

process.exitCode = main();
```

- [ ] **Step 2: Write the failing tests**

`test/agent.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AGENT, agentEnv, buildFixPrompt, parseAgent, runAgent } from '../src/agent.js';
import { STUB_AGENT, clearStubEnv, tempDir } from './helpers.js';

afterEach(() => {
  clearStubEnv();
  delete process.env.CLAUDECODE;
});

describe('agent adapter', () => {
  it('parses the --agent option', () => {
    expect(parseAgent(undefined)).toEqual(['claude', '-p', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Glob,Grep']);
    expect(parseAgent('none')).toBeNull();
    expect(parseAgent(' NONE ')).toBeNull();
    expect(parseAgent('codex exec --full-auto')).toEqual(['codex', 'exec', '--full-auto']);
    expect(DEFAULT_AGENT).toContain('--allowedTools Read,Edit,Write,Glob,Grep');
  });

  it('removes CLAUDECODE and names the prompt file', () => {
    const env = agentEnv({ CLAUDECODE: '1', PATH: 'x' }, '/tmp/p.md');
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.FIRSTBAD_PROMPT_FILE).toBe('/tmp/p.md');
    expect(env.PATH).toBe('x');
  });

  it('builds a prompt with the culprit line, the diff and earlier failures', () => {
    const p = buildFixPrompt({
      check: { url: 'http://127.0.0.1:4173/', do: 'add things', store: 'the total', expected: '$18.00' },
      badValue: '$20.00',
      culprit: { commit: 'a'.repeat(40), subject: 'refactor(cart): extract price helpers' },
      parentValue: '$18.00',
      kaneSummary: 'Expected "$18.00" but observed "$20.00"',
      culpritDiff: '-old\n+new',
      attempt: 2,
      previousFailures: ['attempt 1: the agent made no change'],
    });
    expect(p).toContain(`First bad commit: ${'a'.repeat(40)} (refactor(cart): extract price helpers)`);
    expect(p).toContain('```diff\n-old\n+new\n```');
    expect(p).toContain('- attempt 1: the agent made no change');
    expect(p).toContain('## Your task (attempt 2)');
    expect(p).toContain('Do not run git');
  });

  it('runs the agent with the prompt on stdin or as an argument, without CLAUDECODE', async () => {
    const dir = tempDir('firstbad-agent-');
    const logPath = path.join(dir, 'agent-log.jsonl');
    process.env.STUB_AGENT_MODE = 'write';
    process.env.STUB_AGENT_FILE = 'out.txt';
    process.env.STUB_AGENT_CONTENT = 'patched';
    process.env.STUB_AGENT_LOG = logPath;
    process.env.CLAUDECODE = '1';
    const viaStdin = await runAgent([process.execPath, STUB_AGENT], `First bad commit: ${'b'.repeat(40)} (x)`, {
      cwd: dir,
      promptFile: path.join(dir, 'prompt-1.md'),
      timeoutMs: 30_000,
      route: 'stdin',
    });
    expect(viaStdin.ok).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'out.txt'), 'utf8')).toBe('patched');
    expect(fs.readFileSync(path.join(dir, 'prompt-1.md'), 'utf8')).toContain('First bad commit');
    const viaArg = await runAgent([process.execPath, STUB_AGENT], `First bad commit: ${'c'.repeat(40)} (y)`, {
      cwd: dir,
      promptFile: path.join(dir, 'prompt-2.md'),
      timeoutMs: 30_000,
      route: 'arg',
    });
    expect(viaArg.ok).toBe(true);
    const logged = fs
      .readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { via: string; promptHasFirstBad: boolean; claudecode: string | null });
    expect(logged.map((l) => l.via)).toEqual(['stdin', 'arg']);
    expect(logged.every((l) => l.promptHasFirstBad && l.claudecode === null)).toBe(true);
    const missing = await runAgent(['firstbad-no-such-agent-xyz'], 'x', {
      cwd: dir,
      promptFile: path.join(dir, 'prompt-3.md'),
      timeoutMs: 30_000,
      route: 'stdin',
    });
    expect(missing.notFound).toBe(true);
  });
});
```

`test/fix.test.ts`:

```ts
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { commitFix, fix, fixCommitMessage } from '../src/fix.js';
import { cleanupSession, hunt, prepareSession, type HuntResult, type Prepared } from '../src/hunt.js';
import type { HuntLog } from '../src/session.js';
import { KANE_CMD, STUB_AGENT, bisectRepo, clearStubEnv, git, setStubPlan, tempDir } from './helpers.js';

const log: HuntLog = { entry: () => undefined, info: () => undefined };
const AGENT = [process.execPath, STUB_AGENT];

async function huntRepo(port: number): Promise<{ repo: string; prepared: Prepared; h: HuntResult; work: string }> {
  const repo = bisectRepo();
  const work = tempDir('firstbad-fix-');
  setStubPlan(work, { default: { scenario: 'fetch' } });
  const prepared = await prepareSession(
    {
      repoDir: repo,
      good: 'v1',
      bad: 'HEAD',
      check: { url: `http://127.0.0.1:${port}/`, do: 'read the page', store: 'the page text', expected: '$18.00' },
      serve: `node server.mjs ${port}`,
      setup: null,
      kaneCmd: KANE_CMD,
      env: { ...process.env },
      template: 'commas-assert',
      verdictMode: 'status+value',
    },
    log,
  );
  const h = await hunt(prepared, log);
  expect(h.status).toBe('confirmed');
  return { repo, prepared, h, work };
}

afterEach(() => clearStubEnv());

describe('fix', () => {
  it('lets the agent patch the tree on its second attempt, proves it with Kane and commits on a new branch', async () => {
    const { repo, prepared, h, work } = await huntRepo(4341);
    try {
      process.env.STUB_AGENT_MODE = 'write';
      process.env.STUB_AGENT_FILE = 'value.txt';
      process.env.STUB_AGENT_CONTENT = '$18.00';
      process.env.STUB_AGENT_STATE = path.join(work, 'agent-state.json');
      process.env.STUB_AGENT_NOOP_FIRST = '1';
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: AGENT, env: { ...process.env } }, log);
      const short = (h.culprit?.commit ?? '').slice(0, 7);
      expect(r).toMatchObject({ status: 'verified', route: 'agent', attempts: 2, branch: `firstbad/fix-${short}` });
      expect(r.entries.map((e) => e.verdict)).toEqual(['PASS']);
      const sha = await commitFix(prepared.sessionPath, fixCommitMessage('the page text', h.culprit?.commit ?? ''));
      expect(git(repo, 'rev-parse', `firstbad/fix-${short}`)).toBe(sha);
      expect(git(repo, 'show', `firstbad/fix-${short}:value.txt`)).toBe('$18.00');
      expect(git(repo, 'log', '-1', '--format=%s', `firstbad/fix-${short}`)).toBe(
        `fix: restore "the page text" regression from ${short} (verified by Kane via firstbad)`,
      );
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('reverts the culprit when there is no agent', async () => {
    const { repo, prepared, h } = await huntRepo(4342);
    try {
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: null, env: { ...process.env } }, log);
      expect(r).toMatchObject({ status: 'verified', route: 'revert' });
      await commitFix(prepared.sessionPath, fixCommitMessage('the page text', h.culprit?.commit ?? ''));
      expect(git(repo, 'show', `${r.branch ?? ''}:value.txt`)).toBe('$18.00');
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('falls back to the revert when the agent command is not installed', async () => {
    const { prepared, h } = await huntRepo(4343);
    try {
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: ['firstbad-no-such-agent-xyz'], env: { ...process.env } }, log);
      expect(r).toMatchObject({ status: 'verified', route: 'revert' });
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });

  it('gives up after the attempt cap, deletes the branch, and skips an unconfirmed hunt', async () => {
    const { repo, prepared, h } = await huntRepo(4344);
    try {
      process.env.STUB_AGENT_MODE = 'noop';
      const r = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: AGENT, env: { ...process.env, FIRSTBAD_MAX_FIX_ATTEMPTS: '2' } }, log);
      expect(r).toMatchObject({ status: 'unverified', route: 'agent', branch: null, attempts: 2 });
      expect(r.entries).toHaveLength(0);
      expect(git(repo, 'branch', '--list', 'firstbad/*')).toBe('');
      const skipped = await fix(prepared.sessionPath, { ...h, status: 'unconfirmed' }, prepared.badSha, { agentArgv: AGENT, env: { ...process.env } }, log);
      expect(skipped.status).toBe('skipped');
    } finally {
      await cleanupSession(prepared.sessionPath);
    }
  });
});
```

- [ ] **Step 3: Run them to confirm they fail**
Run: `npx vitest run test/agent.test.ts test/fix.test.ts`
Expected: FAIL — `Failed to load url ../src/agent.js`

- [ ] **Step 4: Write `src/agent.ts`**

```ts
import fs from 'node:fs';
import type { Check } from './check.js';
import type { AgentPromptRoute } from './kane-profile.js';
import { scrub } from './scrub.js';
import { execArgv, splitCommand } from './util/proc.js';

export const DEFAULT_AGENT = 'claude -p --permission-mode acceptEdits --allowedTools Read,Edit,Write,Glob,Grep';

export function parseAgent(value: string | undefined): string[] | null {
  if (value === undefined || value.trim() === '') return splitCommand(DEFAULT_AGENT);
  if (value.trim().toLowerCase() === 'none') return null;
  return splitCommand(value);
}

export interface AgentRun {
  ok: boolean;
  notFound: boolean;
  exitCode: number | null;
  timedOut: boolean;
  outputTail: string;
  durationMs: number;
}

export interface AgentRunOptions {
  cwd: string;
  promptFile: string;
  timeoutMs: number;
  route: AgentPromptRoute;
  env?: NodeJS.ProcessEnv;
}

// CLAUDECODE is removed so a nested `claude -p` runs when firstbad itself runs inside Claude Code.
export function agentEnv(base: NodeJS.ProcessEnv, promptFile: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  delete env.CLAUDECODE;
  env.FIRSTBAD_PROMPT_FILE = promptFile;
  return env;
}

export async function runAgent(argv: string[], prompt: string, o: AgentRunOptions): Promise<AgentRun> {
  fs.writeFileSync(o.promptFile, prompt);
  const full = o.route === 'arg' ? [...argv, prompt] : argv;
  const r = await execArgv(full, {
    cwd: o.cwd,
    env: agentEnv(o.env ?? process.env, o.promptFile),
    timeoutMs: o.timeoutMs,
    input: o.route === 'stdin' ? prompt : undefined,
  });
  return {
    ok: r.spawnError === null && !r.timedOut && r.code === 0,
    notFound: r.spawnError === 'ENOENT',
    exitCode: r.code,
    timedOut: r.timedOut,
    outputTail: scrub(`${r.stdout}\n${r.stderr}`.trim()).slice(-600),
    durationMs: r.durationMs,
  };
}

export interface FixPromptContext {
  check: Check;
  badValue: string;
  culprit: { commit: string; subject: string };
  parentValue: string | null;
  kaneSummary: string;
  culpritDiff: string;
  attempt: number;
  previousFailures: string[];
}

export function buildFixPrompt(c: FixPromptContext): string {
  const previous = c.previousFailures.length === 0 ? '- none' : c.previousFailures.map((f) => `- ${f}`).join('\n');
  return [
    'You are fixing a regression that firstbad found with git bisect and Kane CLI (a real-browser test).',
    '',
    '## The check',
    `- URL: ${c.check.url}`,
    `- Steps: ${c.check.do}`,
    `- Stored value: ${c.check.store}`,
    `- Expected value: ${c.check.expected}`,
    '',
    '## What Kane saw',
    `- On the current HEAD the stored value is ${c.badValue} instead of ${c.check.expected}.`,
    `- Kane's report: ${c.kaneSummary === '' ? '(no summary)' : c.kaneSummary}`,
    `- First bad commit: ${c.culprit.commit} (${c.culprit.subject})`,
    `- On its parent the check passes${c.parentValue === null ? '' : ` (stored ${c.parentValue})`}.`,
    '',
    '## The diff of the first bad commit (first 300 lines)',
    '',
    '```diff',
    c.culpritDiff,
    '```',
    '',
    '## Previous attempts',
    previous,
    '',
    `## Your task (attempt ${c.attempt})`,
    `Fix the code at the current HEAD so the check passes again: the stored value must be ${c.check.expected}.`,
    "- Make the smallest change that restores the behaviour, and keep the rest of the commit's intent.",
    '- Edit files only. Do not run git or any other command, and do not create commits.',
    '- Do not create or edit firstbad-report.md or firstbad-report.json.',
    'When you are done, reply with one sentence that describes the change.',
    '',
  ].join('\n');
}
```

- [ ] **Step 5: Write `src/fix.ts`**

```ts
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
```

- [ ] **Step 6: Run the gate to confirm it passes**
Run: `npx vitest run test/agent.test.ts test/fix.test.ts`
Expected: PASS — output contains `Test Files  2 passed`

- [ ] **Step 7: Commit (kernel-performed — no agent runs this)**
Message: `feat(fix): agent fix loop re-verified by Kane, revert fallback and the fix commit`

---

### Task 8: The report, the end-to-end flow and the `hunt` / `oracle` CLI

**Files:**
- Create: `src/report.ts`
- Create: `src/run.ts`
- Create: `src/cli.ts`
- Test: `test/report.test.ts`
- Test: `test/cli.test.ts`

**Depends on:** Task 1, Task 3, Task 4, Task 5, Task 6, Task 7
**Effort:** medium
**Priority:** must-have
**Provides:** `interface Report { tool: 'firstbad'; version: string; generatedAt: string; check: Check; refs: { good: string; bad: string }; hunt: { status: HuntStatus; message: string; culprit: { commit: string; subject: string } | null; parent: string | null; badValue: string | null }; fix: { status: FixStatus; route: 'agent' | 'revert' | null; branch: string | null; commit: string | null; attempts: number; message: string } | null; timeline: LedgerEntry[]; cost: { kaneRuns: number; creditsConsumed: number; balanceBefore: number | null; balanceAfter: number | null; balanceDelta: number | null } }`, `interface ReportInput { check: Check; refs: { good: string; bad: string }; hunt: HuntResult; fix: FixResult | null; fixCommit: string | null; timeline: LedgerEntry[]; runsUsed: number; balanceBefore: number | null; balanceAfter: number | null; now?: Date }`, `buildReport(i: ReportInput): Report`, `renderMarkdown(r: Report): string`, `writeReport(dir: string, r: Report, base: string): { md: string; json: string }`, `formatTimelineLine(e: LedgerEntry, color: boolean): string`, `interface FlowOptions { repoDir: string; good: string; bad: string; check: Check; serve: string; setup: string | null; agentArgv: string[] | null; noFix: boolean; outDir: string | null; kaneCmd: string[]; env: NodeJS.ProcessEnv; print: (line: string) => void; color: boolean; template?: TemplateId; verdictMode?: VerdictMode; promptRoute?: AgentPromptRoute; oracleCmd?: string[] }`, `interface FlowResult { exitCode: 0 | 1 | 3; report: Report | null; reportPaths: { md: string; json: string } | null; message: string }`, `runFlow(o: FlowOptions): Promise<FlowResult>`, `interface CliIO { print(line: string): void; env: NodeJS.ProcessEnv; cwd: string; color: boolean }`, `type Command = (args: string[], io: CliIO) => Promise<number>`, `HELP: string`, `kaneCommand(env: NodeJS.ProcessEnv): string[]`, `COMMANDS: Record<string, Command>`, `main(argv: string[], io: CliIO): Promise<number>`, `dist/cli.js (bin firstbad: hunt, oracle, --version, --help)`
**Requires:** `VERSION: string (src/version.ts)`, `type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only'`, `type VerdictMode = 'status+value' | 'value-only'`, `type AgentPromptRoute = 'stdin' | 'arg'`, `scrubDeep<T>(value: T): T`, `findSecrets(text: string): string[]`, `splitCommand(command: string): string[]`, `kaneBalance(kaneCmd: string[], env?: NodeJS.ProcessEnv): Promise<number | null>`, `interface Check { url: string; do: string; store: string; expected: string }`, `validateCheck(c: Check): string[]`, `type VerdictKind = 'PASS' | 'FAIL' | 'SKIP' | 'ABORT'`, `interface LedgerEntry { phase: Phase; label: string; commit: string; subject: string; verdict: VerdictKind; reason: string; observed: string | null; kaneRuns: number; creditsConsumed: number | null; testUrl: string | null; resultCode: string | null; durationMs: number; at: string }`, `interface HuntLog { entry(e: LedgerEntry): void; info(line: string): void }`, `readLimits(env: NodeJS.ProcessEnv): Limits`, `readSession(file: string): Session`, `readLedger(file: string): LedgerEntry[]`, `stamp(d?: Date): string`, `commonDir(cwd: string): Promise<string>`, `runOracle(sessionPath: string, cwd: string, write?: (line: string) => void): Promise<number>`, `class PreflightError extends Error`, `type HuntStatus = 'confirmed' | 'unconfirmed' | 'nothing-to-hunt' | 'aborted'`, `interface HuntResult { status: HuntStatus; message: string; culprit: { commit: string; subject: string } | null; parent: string | null; badValue: string | null; entries: LedgerEntry[] }`, `interface Prepared { sessionPath: string; session: Session; balanceBefore: number | null; goodSha: string; badSha: string }`, `prepareSession(o: PrepareOptions, log: HuntLog): Promise<Prepared>`, `hunt(p: Prepared, log: HuntLog, oracleCmd?: string[]): Promise<HuntResult>`, `cleanupSession(sessionPath: string, keep?: boolean): Promise<void>`, `parseAgent(value: string | undefined): string[] | null`, `type FixStatus = 'verified' | 'unverified' | 'skipped'`, `interface FixResult { status: FixStatus; route: 'agent' | 'revert' | null; branch: string | null; attempts: number; message: string; entries: LedgerEntry[] }`, `fix(sessionPath: string, h: HuntResult, badSha: string, o: FixOptions, log: HuntLog): Promise<FixResult>`, `fixCommitMessage(store: string, culpritSha: string): string`, `commitFix(sessionPath: string, message: string): Promise<string>`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`

Upstream facts: `prepareSession` throws `PreflightError` for every preflight problem (bad repo/refs, kane-cli missing or older than 0.10.9, balance below `FIRSTBAD_MIN_BALANCE`) and takes `{ repoDir, good, bad, check, serve, setup, kaneCmd, env, template?, verdictMode? }`; `fix` takes `FixOptions { agentArgv: string[] | null; env: NodeJS.ProcessEnv; route?: AgentPromptRoute }` and, when verified, leaves the patched tree on the fix branch in `session.worktreeDir` for `commitFix` to commit (it stages everything with `git add -A`). The report written into the worktree before that commit carries `fix.commit: null`; the copy written to `--out` carries the commit sha.

Exit codes (spec section 2): 0 = confirmed culprit and (unless `--no-fix`) a fix Kane verified; 1 = the hunt ran without that; 2 = usage error; 3 = preflight failed. Default `--out` is `<git-common-dir>/firstbad/reports/<stamp>/`. `FIRSTBAD_KANE` overrides the Kane command (split shell-style).

- [ ] **Step 1: Write the failing tests**

`test/report.test.ts`:

```ts
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FixResult } from '../src/fix.js';
import type { HuntResult } from '../src/hunt.js';
import { buildReport, formatTimelineLine, renderMarkdown, writeReport } from '../src/report.js';
import { findSecrets } from '../src/scrub.js';
import type { LedgerEntry } from '../src/session.js';
import { tempDir } from './helpers.js';

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  phase: 'bisect',
  label: 'bisect',
  commit: 'a'.repeat(40),
  subject: 'refactor(cart): extract price helpers',
  verdict: 'FAIL',
  reason: 'Expected "$18.00" but observed "$20.00"',
  observed: '$20.00',
  kaneRuns: 1,
  creditsConsumed: 15.2,
  testUrl: 'https://tm.example.invalid/t/1',
  resultCode: '720',
  durationMs: 1000,
  at: '2026-11-25T12:00:00.000Z',
  ...over,
});

const timeline: LedgerEntry[] = [
  entry({ phase: 'bracket', label: 'bad ref', commit: 'b'.repeat(40), subject: 'docs: x | y' }),
  entry({ phase: 'bracket', label: 'good ref', verdict: 'PASS', observed: '$18.00', reason: 'ok' }),
  entry({ verdict: 'SKIP', observed: null, kaneRuns: 0, creditsConsumed: null, testUrl: null, reason: 'page never loaded (server exited with code 1)' }),
  entry({ phase: 'fix', label: 'fix attempt 1', verdict: 'PASS', observed: '$18.00', reason: 'Authorization: Bearer abcdefgh12345678' }),
];

const huntResult: HuntResult = {
  status: 'confirmed',
  message: 'first bad commit: aaaaaaa refactor(cart): extract price helpers (confirmed: culprit FAIL, parent PASS)',
  culprit: { commit: 'a'.repeat(40), subject: 'refactor(cart): extract price helpers' },
  parent: 'c'.repeat(40),
  badValue: '$20.00',
  entries: timeline,
};

const fixResult: FixResult = {
  status: 'verified',
  route: 'agent',
  branch: 'firstbad/fix-aaaaaaa',
  attempts: 1,
  message: 'Kane passed the patched tree on attempt 1',
  entries: [],
};

const report = buildReport({
  check: { url: 'http://127.0.0.1:4173/', do: 'add the Tote bag', store: 'the total', expected: '$18.00' },
  refs: { good: 'v1.0', bad: 'HEAD' },
  hunt: huntResult,
  fix: fixResult,
  fixCommit: 'd'.repeat(40),
  timeline,
  runsUsed: 4,
  balanceBefore: 11178.5769,
  balanceAfter: 11100.0769,
  now: new Date('2026-11-25T12:00:00Z'),
});

describe('report', () => {
  it('is scrubbed and takes its cost from the balance delta', () => {
    expect(report.cost).toEqual({ kaneRuns: 4, creditsConsumed: 45.6, balanceBefore: 11178.5769, balanceAfter: 11100.0769, balanceDelta: 78.5 });
    expect(report.fix).toMatchObject({ status: 'verified', commit: 'd'.repeat(40), branch: 'firstbad/fix-aaaaaaa' });
    expect(findSecrets(JSON.stringify(report))).toEqual([]);
    expect(JSON.stringify(report)).toContain('Bearer [redacted]');
  });

  it('renders the markdown timeline with escaped cells and Kane links', () => {
    const md = renderMarkdown(report);
    expect(md.startsWith('# firstbad report')).toBe(true);
    expect(md).toContain('- **First bad commit:** `aaaaaaa` refactor(cart): extract price helpers (confirmed: culprit FAIL, parent PASS)');
    expect(md).toContain('| 1 | bracket | `bbbbbbb` | bad ref: docs: x \\| y | FAIL | $20.00 | 1 | 15.2 |');
    expect(md).toContain('## Kane Test Manager links');
    expect(md).toContain('the delta is the number to trust');
    expect(md).not.toContain('.evidence');
  });

  it('writes both files and formats terminal lines with and without color', () => {
    const paths = writeReport(tempDir('firstbad-report-'), report, 'report');
    expect(fs.readFileSync(paths.md, 'utf8').startsWith('# firstbad report')).toBe(true);
    expect(JSON.parse(fs.readFileSync(paths.json, 'utf8'))).toMatchObject({ tool: 'firstbad' });
    const plain = formatTimelineLine(timeline[2], false);
    expect(plain).toContain('SKIP');
    expect(plain).toContain('aaaaaaa');
    expect(plain).toContain('page never loaded');
    expect(plain).not.toContain('\u001b[');
    expect(formatTimelineLine(timeline[0], true)).toContain('\u001b[31mFAIL');
  });
});
```

`test/cli.test.ts`:

```ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HELP, kaneCommand, main, type CliIO } from '../src/cli.js';
import { VERSION } from '../src/version.js';
import { ROOT, STUB_AGENT, STUB_KANE, bisectRepo, clearStubEnv, git, setStubPlan, tempDir } from './helpers.js';

function io(lines: string[], env: NodeJS.ProcessEnv = process.env): CliIO {
  return { print: (l) => lines.push(l), env, cwd: process.cwd(), color: false };
}

afterEach(() => clearStubEnv());

describe('cli', () => {
  it('prints the version from the built binary and has help', () => {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'dist', 'cli.js'), '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe(VERSION);
    expect(HELP).toContain('firstbad hunt');
    expect(HELP).toContain('firstbad oracle');
  });

  it('rejects missing, invalid and unknown options with exit 2', async () => {
    const lines: string[] = [];
    expect(await main(['hunt', '--good', 'v1'], io(lines))).toBe(2);
    expect(lines.join('\n')).toContain('missing --url');
    expect(await main(['hunt', '--good', 'v1', '--url', 'nope', '--do', 'x', '--store', 'y', '--expect', 'z', '--serve', 's'], io(lines))).toBe(2);
    expect(await main(['hunt', '--bogus'], io(lines))).toBe(2);
    expect(await main(['nope'], io(lines))).toBe(2);
    expect(kaneCommand({ FIRSTBAD_KANE: '"node" "x y.mjs"' })).toEqual(['node', 'x y.mjs']);
    expect(kaneCommand({})).toEqual(['kane-cli']);
  });

  it('runs a whole hunt, fixes it with the agent, commits the report and writes it to --out', async () => {
    const repo = bisectRepo();
    const work = tempDir('firstbad-cli-');
    setStubPlan(work, { default: { scenario: 'fetch' } });
    process.env.STUB_AGENT_MODE = 'write';
    process.env.STUB_AGENT_FILE = 'value.txt';
    process.env.STUB_AGENT_CONTENT = '$18.00';
    const env = { ...process.env, FIRSTBAD_KANE: `"${process.execPath}" "${STUB_KANE}"` };
    const out = path.join(work, 'out');
    const lines: string[] = [];
    const code = await main(
      [
        'hunt',
        '--repo', repo,
        '--good', 'v1',
        '--url', 'http://127.0.0.1:4351/',
        '--do', 'read the page',
        '--store', 'the page text',
        '--expect', '$18.00',
        '--serve', 'node server.mjs 4351',
        '--agent', `"${process.execPath}" "${STUB_AGENT}"`,
        '--out', out,
      ],
      io(lines, env),
    );
    expect(code).toBe(0);
    const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')) as {
      hunt: { status: string; culprit: { subject: string } };
      fix: { status: string; branch: string; commit: string };
    };
    expect(report.hunt.status).toBe('confirmed');
    expect(report.hunt.culprit.subject).toBe('bad: culprit');
    expect(report.fix.status).toBe('verified');
    expect(git(repo, 'rev-parse', report.fix.branch)).toBe(report.fix.commit);
    expect(git(repo, 'show', `${report.fix.branch}:firstbad-report.md`)).toContain('# firstbad report');
    expect(git(repo, 'show', `${report.fix.branch}:value.txt`)).toBe('$18.00');
    expect(lines.some((l) => l.includes('bracket') && l.includes('FAIL'))).toBe(true);
    expect(fs.readFileSync(path.join(out, 'report.md'), 'utf8')).toContain('## Timeline');
  });

  it('exits 3 when the preflight fails', async () => {
    const repo = bisectRepo();
    const lines: string[] = [];
    const env = { ...process.env, FIRSTBAD_KANE: 'firstbad-no-such-kane-cli-xyz' };
    const code = await main(
      ['hunt', '--repo', repo, '--good', 'v1', '--url', 'http://127.0.0.1:4352/', '--do', 'x', '--store', 'y', '--expect', 'z', '--serve', 'node server.mjs 4352'],
      io(lines, env),
    );
    expect(code).toBe(3);
    expect(lines.join('\n')).toContain('kane-cli was not found');
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**
Run: `npx vitest run test/report.test.ts test/cli.test.ts`
Expected: FAIL — `Failed to load url ../src/report.js`

- [ ] **Step 3: Write `src/report.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import type { Check } from './check.js';
import type { FixResult, FixStatus } from './fix.js';
import type { HuntResult, HuntStatus } from './hunt.js';
import { scrubDeep } from './scrub.js';
import type { LedgerEntry } from './session.js';
import type { VerdictKind } from './verdict.js';
import { VERSION } from './version.js';

export interface Report {
  tool: 'firstbad';
  version: string;
  generatedAt: string;
  check: Check;
  refs: { good: string; bad: string };
  hunt: {
    status: HuntStatus;
    message: string;
    culprit: { commit: string; subject: string } | null;
    parent: string | null;
    badValue: string | null;
  };
  fix: {
    status: FixStatus;
    route: 'agent' | 'revert' | null;
    branch: string | null;
    commit: string | null;
    attempts: number;
    message: string;
  } | null;
  timeline: LedgerEntry[];
  cost: {
    kaneRuns: number;
    creditsConsumed: number;
    balanceBefore: number | null;
    balanceAfter: number | null;
    balanceDelta: number | null;
  };
}

export interface ReportInput {
  check: Check;
  refs: { good: string; bad: string };
  hunt: HuntResult;
  fix: FixResult | null;
  fixCommit: string | null;
  timeline: LedgerEntry[];
  runsUsed: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  now?: Date;
}

// Allow-listed fields only, every string scrubbed.
export function buildReport(i: ReportInput): Report {
  const credits = Math.round(i.timeline.reduce((sum, e) => sum + (e.creditsConsumed ?? 0), 0) * 100) / 100;
  const delta = i.balanceBefore !== null && i.balanceAfter !== null ? Math.round((i.balanceBefore - i.balanceAfter) * 10000) / 10000 : null;
  const report: Report = {
    tool: 'firstbad',
    version: VERSION,
    generatedAt: (i.now ?? new Date()).toISOString(),
    check: i.check,
    refs: i.refs,
    hunt: { status: i.hunt.status, message: i.hunt.message, culprit: i.hunt.culprit, parent: i.hunt.parent, badValue: i.hunt.badValue },
    fix:
      i.fix === null
        ? null
        : { status: i.fix.status, route: i.fix.route, branch: i.fix.branch, commit: i.fixCommit, attempts: i.fix.attempts, message: i.fix.message },
    timeline: i.timeline,
    cost: { kaneRuns: i.runsUsed, creditsConsumed: credits, balanceBefore: i.balanceBefore, balanceAfter: i.balanceAfter, balanceDelta: delta },
  };
  return scrubDeep(report);
}

function cell(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function short(sha: string): string {
  return sha === '' ? '-' : sha.slice(0, 7);
}

export function renderMarkdown(r: Report): string {
  const lines: string[] = [
    '# firstbad report',
    '',
    `- **Check:** at \`${r.check.url}\`: ${r.check.do}; store ${r.check.store}; expect **${r.check.expected}**`,
    `- **Refs:** good \`${r.refs.good}\`, bad \`${r.refs.bad}\``,
    `- **Result:** ${r.hunt.status}: ${r.hunt.message}`,
  ];
  if (r.hunt.culprit !== null) {
    const confirmed = r.hunt.status === 'confirmed' ? ' (confirmed: culprit FAIL, parent PASS)' : '';
    lines.push(`- **First bad commit:** \`${short(r.hunt.culprit.commit)}\` ${r.hunt.culprit.subject}${confirmed}`);
  }
  if (r.fix !== null) {
    const route = r.fix.route === null ? '' : ` via ${r.fix.route}`;
    const branch = r.fix.branch === null ? '' : ` on branch \`${r.fix.branch}\``;
    const commit = r.fix.commit === null ? '' : ` (commit \`${short(r.fix.commit)}\`)`;
    lines.push(`- **Fix:** ${r.fix.status}${route}${branch}${commit}: ${r.fix.message}`);
  }
  lines.push('', '## Timeline', '', '| # | Phase | Commit | Subject | Verdict | Observed | Kane runs | Credits | Reason |', '|---|---|---|---|---|---|---|---|---|');
  r.timeline.forEach((e, n) => {
    const what = e.label === 'bisect' ? e.subject : `${e.label}: ${e.subject}`;
    lines.push(
      `| ${n + 1} | ${e.phase} | \`${short(e.commit)}\` | ${cell(what)} | ${e.verdict} | ${cell(e.observed ?? '-')} | ${e.kaneRuns} | ${e.creditsConsumed ?? '-'} | ${cell(e.reason)} |`,
    );
  });
  const links = r.timeline.map((e, n) => (e.testUrl === null ? null : `- #${n + 1}: ${e.testUrl}`)).filter((l): l is string => l !== null);
  if (links.length > 0) lines.push('', '## Kane Test Manager links', '', ...links);
  lines.push(
    '',
    '## Cost',
    '',
    `- Kane runs: ${r.cost.kaneRuns}`,
    `- Sum of credits_consumed reported by Kane: ${r.cost.creditsConsumed}`,
    `- Balance before / after: ${r.cost.balanceBefore ?? 'unknown'} / ${r.cost.balanceAfter ?? 'unknown'} (delta ${r.cost.balanceDelta ?? 'unknown'}; the delta is the number to trust)`,
    '',
    `_Generated by firstbad ${r.version} at ${r.generatedAt}._`,
    '',
  );
  return lines.join('\n');
}

export function writeReport(dir: string, r: Report, base: string): { md: string; json: string } {
  fs.mkdirSync(dir, { recursive: true });
  const md = path.join(dir, `${base}.md`);
  const json = path.join(dir, `${base}.json`);
  fs.writeFileSync(md, renderMarkdown(r));
  fs.writeFileSync(json, JSON.stringify(r, null, 2) + '\n');
  return { md, json };
}

const COLORS: Record<VerdictKind, string> = { PASS: '\u001b[32m', FAIL: '\u001b[31m', SKIP: '\u001b[33m', ABORT: '\u001b[35m' };

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function trunc(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 3)}...`;
}

export function formatTimelineLine(e: LedgerEntry, color: boolean): string {
  const what = e.label === 'bisect' ? e.subject : e.label;
  const verdict = color ? `${COLORS[e.verdict]}${pad(e.verdict, 5)}\u001b[0m` : pad(e.verdict, 5);
  return `  ${pad(e.phase, 7)}  ${pad(short(e.commit), 7)}  ${pad(trunc(what, 34), 34)}  ${verdict}  ${pad(e.observed ?? '-', 9)}  ${trunc(e.reason, 100)}`;
}
```

- [ ] **Step 4: Write `src/run.ts`**

```ts
import path from 'node:path';
import type { Check } from './check.js';
import { commitFix, fix, fixCommitMessage, type FixResult } from './fix.js';
import { commonDir } from './git.js';
import { PreflightError, cleanupSession, hunt, prepareSession, type Prepared } from './hunt.js';
import type { AgentPromptRoute, TemplateId, VerdictMode } from './kane-profile.js';
import { kaneBalance } from './kane/runner.js';
import { buildReport, formatTimelineLine, writeReport, type Report, type ReportInput } from './report.js';
import { readLedger, readLimits, readSession, stamp, type HuntLog } from './session.js';

export interface FlowOptions {
  repoDir: string;
  good: string;
  bad: string;
  check: Check;
  serve: string;
  setup: string | null;
  agentArgv: string[] | null;
  noFix: boolean;
  outDir: string | null;
  kaneCmd: string[];
  env: NodeJS.ProcessEnv;
  print: (line: string) => void;
  color: boolean;
  template?: TemplateId;
  verdictMode?: VerdictMode;
  promptRoute?: AgentPromptRoute;
  oracleCmd?: string[];
}

export interface FlowResult {
  exitCode: 0 | 1 | 3;
  report: Report | null;
  reportPaths: { md: string; json: string } | null;
  message: string;
}

export async function runFlow(o: FlowOptions): Promise<FlowResult> {
  const log: HuntLog = {
    entry: (e) => o.print(formatTimelineLine(e, o.color)),
    info: (line) => o.print(`  ${line}`),
  };
  let prepared: Prepared;
  try {
    prepared = await prepareSession(
      { repoDir: o.repoDir, good: o.good, bad: o.bad, check: o.check, serve: o.serve, setup: o.setup, kaneCmd: o.kaneCmd, env: o.env, template: o.template, verdictMode: o.verdictMode },
      log,
    );
  } catch (err) {
    if (err instanceof PreflightError) {
      o.print(`firstbad: ${err.message}`);
      return { exitCode: 3, report: null, reportPaths: null, message: err.message };
    }
    throw err;
  }
  const limits = readLimits(o.env);
  const balance = prepared.balanceBefore === null ? 'unknown' : prepared.balanceBefore.toFixed(2);
  o.print(`firstbad: hunting "${o.check.store}" (expect ${o.check.expected}) from ${o.good} to ${o.bad}, balance ${balance} credits, cap ${limits.maxRuns} Kane runs`);
  try {
    const h = await hunt(prepared, log, o.oracleCmd);
    o.print(`firstbad: ${h.message}`);
    let fixResult: FixResult | null = null;
    let fixCommit: string | null = null;
    if (h.status === 'confirmed' && !o.noFix) {
      fixResult = await fix(prepared.sessionPath, h, prepared.badSha, { agentArgv: o.agentArgv, env: o.env, route: o.promptRoute }, log);
    }
    const balanceAfter = await kaneBalance(o.kaneCmd, o.env);
    const session = readSession(prepared.sessionPath);
    const input: ReportInput = {
      check: o.check,
      refs: { good: o.good, bad: o.bad },
      hunt: h,
      fix: fixResult,
      fixCommit: null,
      timeline: readLedger(session.ledgerPath),
      runsUsed: session.runsUsed,
      balanceBefore: prepared.balanceBefore,
      balanceAfter,
    };
    if (fixResult !== null && fixResult.status === 'verified') {
      writeReport(session.worktreeDir, buildReport(input), 'firstbad-report');
      fixCommit = await commitFix(prepared.sessionPath, fixCommitMessage(o.check.store, h.culprit === null ? prepared.badSha : h.culprit.commit));
    }
    const report = buildReport({ ...input, fixCommit });
    const outDir = o.outDir ?? path.join(await commonDir(session.repoDir), 'firstbad', 'reports', stamp());
    const reportPaths = writeReport(outDir, report, 'report');
    if (fixResult !== null) {
      const branch = fixResult.branch === null ? '' : ` on branch ${fixResult.branch}`;
      const commit = fixCommit === null ? '' : ` (commit ${fixCommit.slice(0, 7)})`;
      o.print(`firstbad: fix ${fixResult.status}${branch}${commit}: ${fixResult.message}`);
    }
    o.print(`firstbad: ${report.cost.kaneRuns} Kane runs, ${report.cost.creditsConsumed} credits reported by Kane, balance delta ${report.cost.balanceDelta ?? 'unknown'}`);
    o.print(`firstbad: report ${reportPaths.md}`);
    const ok = h.status === 'confirmed' && (o.noFix || fixResult?.status === 'verified');
    return { exitCode: ok ? 0 : 1, report, reportPaths, message: h.message };
  } finally {
    await cleanupSession(prepared.sessionPath, limits.keepSession);
  }
}
```

- [ ] **Step 5: Write `src/cli.ts` (keep the `COMMANDS` table and the `HELP` array exactly as shown: Task 13 and Task 9 edit them by exact-string replacement)**

```ts
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseAgent } from './agent.js';
import { validateCheck, type Check } from './check.js';
import { runOracle } from './oracle.js';
import { runFlow } from './run.js';
import { splitCommand } from './util/proc.js';
import { VERSION } from './version.js';

export interface CliIO {
  print(line: string): void;
  env: NodeJS.ProcessEnv;
  cwd: string;
  color: boolean;
}

export type Command = (args: string[], io: CliIO) => Promise<number>;

export const HELP = [
  'firstbad - git bisect with a real-browser oracle (Kane CLI)',
  '',
  'Usage:',
  '  firstbad hunt --good <ref> --url <url> --do "<steps>" --store "<what>" --expect "<value>" --serve "<cmd>"',
  '                [--bad <ref>] [--setup "<cmd>"] [--agent "<cmd>" | --agent none] [--no-fix] [--out <dir>] [--repo <path>]',
  '  firstbad oracle --session <file>    a git-bisect-run script (exit 0 good, 1 bad, 125 skip, 128 abort)',
  '  firstbad --version | --help',
  '',
  'Environment: FIRSTBAD_KANE, FIRSTBAD_MIN_BALANCE (500), FIRSTBAD_MAX_RUNS (16), FIRSTBAD_MAX_FIX_ATTEMPTS (3),',
  '  FIRSTBAD_KANE_TIMEOUT_SEC (300), FIRSTBAD_AGENT_TIMEOUT_SEC (900), FIRSTBAD_READY_TIMEOUT_SEC (30),',
  '  FIRSTBAD_SETUP_TIMEOUT_SEC (600), FIRSTBAD_KEEP_SESSION, NO_COLOR',
].join('\n');

export function kaneCommand(env: NodeJS.ProcessEnv): string[] {
  const raw = env.FIRSTBAD_KANE;
  return splitCommand(raw === undefined || raw.trim() === '' ? 'kane-cli' : raw);
}

const HUNT_OPTIONS = {
  good: { type: 'string' },
  bad: { type: 'string' },
  url: { type: 'string' },
  do: { type: 'string' },
  store: { type: 'string' },
  expect: { type: 'string' },
  serve: { type: 'string' },
  setup: { type: 'string' },
  agent: { type: 'string' },
  'no-fix': { type: 'boolean' },
  out: { type: 'string' },
  repo: { type: 'string' },
} as const;

function parseHunt(args: string[]) {
  return parseArgs({ args, options: HUNT_OPTIONS, allowPositionals: false, strict: true }).values;
}

async function huntCommand(args: string[], io: CliIO): Promise<number> {
  let values: ReturnType<typeof parseHunt>;
  try {
    values = parseHunt(args);
  } catch (err) {
    io.print(`firstbad hunt: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const { good, url, store, serve } = values;
  const steps = values.do;
  const expected = values.expect;
  if (good === undefined || url === undefined || steps === undefined || store === undefined || expected === undefined || serve === undefined) {
    const missing = (['good', 'url', 'do', 'store', 'expect', 'serve'] as const).filter((k) => values[k] === undefined);
    io.print(`firstbad hunt: missing ${missing.map((k) => `--${k}`).join(', ')}`);
    return 2;
  }
  const check: Check = { url, do: steps, store, expected };
  const problems = validateCheck(check);
  if (problems.length > 0) {
    io.print(`firstbad hunt: ${problems.join('; ')}`);
    return 2;
  }
  const r = await runFlow({
    repoDir: path.resolve(io.cwd, values.repo ?? '.'),
    good,
    bad: values.bad ?? 'HEAD',
    check,
    serve,
    setup: values.setup ?? null,
    agentArgv: parseAgent(values.agent),
    noFix: values['no-fix'] === true,
    outDir: values.out === undefined ? null : path.resolve(io.cwd, values.out),
    kaneCmd: kaneCommand(io.env),
    env: io.env,
    print: (l) => io.print(l),
    color: io.color,
  });
  return r.exitCode;
}

async function oracleCommand(args: string[], io: CliIO): Promise<number> {
  const at = args.indexOf('--session');
  const sessionPath = at >= 0 ? args[at + 1] : undefined;
  if (sessionPath === undefined) {
    io.print('firstbad oracle: --session <file> is required');
    return 128;
  }
  return runOracle(path.resolve(io.cwd, sessionPath), io.cwd, (l) => io.print(l));
}

export const COMMANDS: Record<string, Command> = {
  hunt: huntCommand,
  oracle: oracleCommand,
};

export async function main(argv: string[], io: CliIO): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined) {
    io.print(HELP);
    return 2;
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    io.print(HELP);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    io.print(VERSION);
    return 0;
  }
  const handler = COMMANDS[command];
  if (handler === undefined) {
    io.print(`firstbad: unknown command "${command}"\n\n${HELP}`);
    return 2;
  }
  return handler(rest, io);
}

function isEntry(): boolean {
  const script = process.argv[1];
  if (script === undefined) return false;
  try {
    return pathToFileURL(fs.realpathSync(script)).href === pathToFileURL(fs.realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
}

if (isEntry()) {
  main(process.argv.slice(2), {
    print: (l) => process.stdout.write(`${l}\n`),
    env: process.env,
    cwd: process.cwd(),
    color: process.stdout.isTTY === true && (process.env.NO_COLOR ?? '') === '',
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.stderr.write(`firstbad: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
      process.exitCode = 1;
    },
  );
}
```

- [ ] **Step 6: Run the gate to confirm it passes**
Run: `npx vitest run test/report.test.ts test/cli.test.ts`
Expected: PASS — output contains `Test Files  2 passed`

- [ ] **Step 7: Commit (kernel-performed — no agent runs this)**
Message: `feat(cli): report, end-to-end hunt flow and the hunt/oracle commands`

---

### Task 9: `firstbad clean` and Ctrl+C cleanup (droppable)

**Files:**
- Create: `src/clean.ts`
- Modify: `src/run.ts`
- Modify: `src/cli.ts`
- Test: `test/clean.test.ts`

**Depends on:** Task 5, Task 6, Task 8
**Effort:** low
**Priority:** droppable
**Provides:** `interface CleanResult { removedWorktrees: string[]; removedSessions: string[] }`, `cleanLeftovers(repoDir: string, tmpRoot?: string): Promise<CleanResult>`, `firstbad clean [--repo <path>]`, `SIGINT handler in runFlow (cleans the session, exits 130)`
**Requires:** `git(cwd: string, args: string[], timeoutMs?: number): Promise<ExecResult>`, `topLevel(cwd: string): Promise<string>`, `runFlow(o: FlowOptions): Promise<FlowResult>`, `interface CliIO { print(line: string): void; env: NodeJS.ProcessEnv; cwd: string; color: boolean }`, `COMMANDS: Record<string, Command>`, `main(argv: string[], io: CliIO): Promise<number>`, `cleanupSession(sessionPath: string, keep?: boolean): Promise<void>`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`

Cut line: if the build is behind, the orchestrator may cut this task. Only the LIVE demo hunt (Task 15) waits for it, so that the recorded run uses the final CLI; a cut Task 9 counts as done for that edge. Session folders are named `firstbad-<YYYYMMDD>-<HHMMSS>-<random>` under `os.tmpdir()`, each holding `session.json`, and the hunt's worktree is `<session folder>/wt`. The two `Modify:` edits below are exact-string replacements in files Task 8 wrote (Task 13 may already have added a `demo` entry; these replacements still match).

- [ ] **Step 1: Write the failing test `test/clean.test.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanLeftovers } from '../src/clean.js';
import { main } from '../src/cli.js';
import { git, makeRepo, tempDir } from './helpers.js';

describe('clean', () => {
  it('removes leftover firstbad worktrees and session folders only', async () => {
    const repo = makeRepo([{ subject: 'one', files: { 'a.txt': '1' } }]);
    const tmpRoot = tempDir('firstbad-cleanroot-');
    const session = path.join(tmpRoot, 'firstbad-20261125-120000-abcdef');
    fs.mkdirSync(session);
    fs.writeFileSync(path.join(session, 'session.json'), '{}');
    git(repo, 'worktree', 'add', '--detach', path.join(session, 'wt'), 'HEAD');
    const unrelated = path.join(tmpRoot, 'firstbad-notes');
    fs.mkdirSync(unrelated);
    const r = await cleanLeftovers(repo, tmpRoot);
    expect(r.removedWorktrees).toHaveLength(1);
    expect(r.removedSessions).toEqual([session]);
    expect(fs.existsSync(unrelated)).toBe(true);
    expect(git(repo, 'worktree', 'list').split('\n')).toHaveLength(1);
    const lines: string[] = [];
    const code = await main(['clean', '--repo', repo], { print: (l) => lines.push(l), env: process.env, cwd: process.cwd(), color: false });
    expect(code).toBe(0);
    expect(lines.join('\n')).toContain('removed 0 worktrees');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**
Run: `npx vitest run test/clean.test.ts`
Expected: FAIL — `Failed to load url ../src/clean.js`

- [ ] **Step 3: Write `src/clean.ts`**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, topLevel } from './git.js';

export interface CleanResult {
  removedWorktrees: string[];
  removedSessions: string[];
}

export async function cleanLeftovers(repoDir: string, tmpRoot: string = os.tmpdir()): Promise<CleanResult> {
  const top = await topLevel(repoDir);
  const list = await git(top, ['worktree', 'list', '--porcelain']);
  const removedWorktrees: string[] = [];
  for (const line of list.stdout.split(/\r?\n/)) {
    if (!line.startsWith('worktree ')) continue;
    const wt = line.slice('worktree '.length).trim();
    if (path.basename(wt) === 'wt' && path.basename(path.dirname(wt)).startsWith('firstbad-')) {
      await git(top, ['worktree', 'remove', '--force', wt]);
      removedWorktrees.push(wt);
    }
  }
  await git(top, ['worktree', 'prune']);
  const removedSessions: string[] = [];
  for (const name of fs.readdirSync(tmpRoot)) {
    if (!/^firstbad-\d{8}-\d{6}-/.test(name)) continue;
    const dir = path.join(tmpRoot, name);
    if (fs.existsSync(path.join(dir, 'session.json'))) {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      removedSessions.push(dir);
    }
  }
  return { removedWorktrees, removedSessions };
}
```

- [ ] **Step 4: Add the Ctrl+C handler to `src/run.ts` (two exact replacements)**

Replace this line (it appears once):

```ts
  const limits = readLimits(o.env);
```

with:

```ts
  const limits = readLimits(o.env);
  const onSigint = (): void => {
    o.print('firstbad: interrupted, cleaning up the worktree and session');
    void cleanupSession(prepared.sessionPath, limits.keepSession).finally(() => process.exit(130));
  };
  process.once('SIGINT', onSigint);
```

Replace:

```ts
  } finally {
    await cleanupSession(prepared.sessionPath, limits.keepSession);
  }
```

with:

```ts
  } finally {
    process.removeListener('SIGINT', onSigint);
    await cleanupSession(prepared.sessionPath, limits.keepSession);
  }
```

- [ ] **Step 5: Add the `clean` command to `src/cli.ts` (four exact replacements)**

Replace `import { validateCheck, type Check } from './check.js';` with:

```ts
import { validateCheck, type Check } from './check.js';
import { cleanLeftovers } from './clean.js';
```

Replace `  '  firstbad --version | --help',` with:

```ts
  '  firstbad clean [--repo <path>]      remove leftover firstbad worktrees and session folders',
  '  firstbad --version | --help',
```

Replace `export const COMMANDS: Record<string, Command> = {` with:

```ts
async function cleanCommand(args: string[], io: CliIO): Promise<number> {
  const at = args.indexOf('--repo');
  const repo = path.resolve(io.cwd, at >= 0 ? (args[at + 1] ?? '.') : '.');
  try {
    const r = await cleanLeftovers(repo);
    io.print(`firstbad: removed ${r.removedWorktrees.length} worktrees and ${r.removedSessions.length} session folders`);
    return 0;
  } catch (err) {
    io.print(`firstbad clean: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

export const COMMANDS: Record<string, Command> = {
```

Replace `  oracle: oracleCommand,` with:

```ts
  oracle: oracleCommand,
  clean: cleanCommand,
```

- [ ] **Step 6: Run the gate to confirm it passes**
Run: `npx vitest run test/clean.test.ts test/cli.test.ts`
Expected: PASS — output contains `Test Files  2 passed`

- [ ] **Step 7: Commit (kernel-performed — no agent runs this)**
Message: `feat(cli): firstbad clean and Ctrl+C cleanup`
