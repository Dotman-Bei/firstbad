#!/usr/bin/env node
// Stub kane-cli for the firstbad demo: emulates a browser run of the demo check against the Corner Shop.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const env = process.env;

function emit(obj) {
  process.stdout.write(JSON.stringify({ v: 1, ts: new Date().toISOString(), ...obj }) + '\n');
}

function get(url) {
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

async function importSource(name, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-shopsim-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, source);
  return import(pathToFileURL(file).href);
}

function runEnd(status, observed, summary, extra) {
  emit({
    type: 'run_end',
    status,
    summary,
    one_liner: status === 'passed' ? 'Check passed' : 'Check failed',
    reason: status === 'passed' ? '' : 'assertion_error.checkpoint_failed',
    duration: 2,
    credits_consumed: 12.5,
    final_state: observed === '' ? {} : { observed },
    test_url: 'https://kane.example.invalid/test-manager/shop',
    result_code: status === 'passed' ? '700' : '720',
    ...(extra ?? {}),
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
  if (args[0] !== 'run') {
    process.stderr.write(`stub-kane-shop: unsupported command: ${args.join(' ')}\n`);
    return 2;
  }
  const objective = args[1] ?? '';
  if (env.STUB_KANE_LOG) {
    fs.appendFileSync(env.STUB_KANE_LOG, JSON.stringify({ argv: args, label: env.FIRSTBAD_LABEL ?? '' }) + '\n');
  }
  const expectedMatch = /"([^"]*)"\.?\s*$/.exec(objective);
  const expected = expectedMatch ? expectedMatch[1] : '';
  const urlMatch = /Go to (https?:\/\/[^\s,]+)/.exec(objective);
  const url = urlMatch ? urlMatch[1].replace(/\.$/, '') : '';
  const codeMatch = /type (\S+) into the discount code field/i.exec(objective);
  const code = codeMatch ? codeMatch[1] : '';
  emit({ type: 'stream_start', cli_version: '0.10.9', surface: 'run' });
  emit({ step: 1, status: 'running', remark: 'Opening the shop' });
  let observed = '';
  try {
    const origin = new URL(url).origin;
    const page = await get(url);
    if (page.status !== 200 || !page.body.includes('id="total"')) throw new Error('the page shows no total');
    const pricing = await importSource('pricing.mjs', (await get(`${origin}/pricing.js`)).body);
    const catalog = await importSource('catalog.mjs', (await get(`${origin}/catalog.js`)).body);
    const pick = (id) => {
      const p = catalog.CATALOG.find((x) => x.id === id);
      if (!p) throw new Error(`no product ${id}`);
      return { price: p.price, qty: 1 };
    };
    observed = pricing.formatCents(pricing.totalCents([pick('tote'), pick('mug')], code));
  } catch (err) {
    emit({ step: 1, status: 'failed', remark: 'Could not read the total' });
    runEnd('failed', '', `Could not read the total: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  emit({ step: 1, status: 'done', remark: 'Opened the shop' });
  emit({ step: 2, status: 'done', remark: `Stored observed = ${observed}` });
  const passed = expected === '' || observed === expected;
  runEnd(passed ? 'passed' : 'failed', observed, passed ? `Verified the stored observed value is "${observed}"` : `Expected "${expected}" but observed "${observed}"`);
  return passed ? 0 : 1;
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
