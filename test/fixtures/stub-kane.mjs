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
