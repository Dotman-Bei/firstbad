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
