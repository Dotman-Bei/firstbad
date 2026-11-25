import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_PORT, DemoDirError, demoCheck, demoServeCommand, prepareDemoDir } from '../src/demo/demo-config.js';
import { generateDemoRepo } from '../src/demo/generate.js';
import { CULPRIT_INDEX, DEMO_GOOD_TAG } from '../src/demo/history.js';

const STUB_SHOP = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stub-kane-shop.mjs');
const tmp = (prefix: string): string => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();

let server: ChildProcess | null = null;
afterEach(() => {
  server?.kill();
  server = null;
});

async function serve(dir: string, port: number): Promise<void> {
  server = spawn(process.execPath, ['server.js', String(port)], { cwd: dir, stdio: 'ignore' });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('the shop did not start');
}

function stubRun(objective: string): { code: number | null; runEnd: { status: string; final_state: { observed?: string } } } {
  const r = spawnSync(process.execPath, [STUB_SHOP, 'run', objective, '--agent', '--headless', '--timeout', '60'], { encoding: 'utf8' });
  const lines = r.stdout.trim().split('\n').map((l) => JSON.parse(l) as { type?: string });
  const end = lines.find((l) => l.type === 'run_end') as unknown as { status: string; final_state: { observed?: string } };
  return { code: r.status, runEnd: end };
}

describe('demo config', () => {
  it('describes the demo check and serve command', () => {
    expect(DEMO_PORT).toBe(4173);
    expect(demoCheck(4173)).toEqual({
      url: 'http://127.0.0.1:4173/',
      do: 'add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply',
      store: 'the total amount shown next to the word Total',
      expected: '$18.00',
    });
    expect(demoServeCommand(4173)).toBe('node server.js 4173');
  });

  it('prepares demo folders and only force-deletes an earlier demo', () => {
    const root = path.join(tmp('firstbad-demodir-'), 'demo');
    const dirs = prepareDemoDir(root, false);
    expect(dirs).toEqual({ root: path.resolve(root), shopDir: path.join(path.resolve(root), 'shop'), reportDir: path.join(path.resolve(root), 'report') });
    fs.mkdirSync(dirs.shopDir);
    expect(() => prepareDemoDir(root, false)).toThrow(DemoDirError);
    expect(prepareDemoDir(root, true).shopDir).toBe(dirs.shopDir);
    expect(fs.existsSync(dirs.shopDir)).toBe(false);
    const precious = tmp('firstbad-precious-');
    fs.writeFileSync(path.join(precious, 'notes.txt'), 'keep me');
    expect(() => prepareDemoDir(precious, true)).toThrow(/refusing/);
    expect(fs.existsSync(path.join(precious, 'notes.txt'))).toBe(true);
  });

  it('the shop stub reads $18.00 at v1.0 and $20.00 at the culprit, like a browser would', async () => {
    const shop = generateDemoRepo(path.join(tmp('firstbad-demostub-'), 'shop')).dir;
    const check = demoCheck(4371);
    const objective = `Go to ${check.url}, ${check.do}, store ${check.store} as 'observed', then assert the stored observed value is "${check.expected}"`;
    git(shop, 'checkout', '-q', '--detach', DEMO_GOOD_TAG);
    await serve(shop, 4371);
    const good = stubRun(objective);
    expect(good.code).toBe(0);
    expect(good.runEnd).toMatchObject({ status: 'passed', final_state: { observed: '$18.00' } });
    server?.kill();
    await new Promise((r) => setTimeout(r, 500));
    const revs = git(shop, 'rev-list', '--reverse', 'main').split('\n');
    git(shop, 'checkout', '-q', '--detach', revs[CULPRIT_INDEX] ?? '');
    await serve(shop, 4372);
    const bad = stubRun(objective.replace('4371', '4372'));
    expect(bad.code).toBe(1);
    expect(bad.runEnd).toMatchObject({ status: 'failed', final_state: { observed: '$20.00' } });
  });
});
