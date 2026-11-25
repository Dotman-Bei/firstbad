import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateDemoRepo } from '../src/demo/generate.js';
import { BROKEN_FIRST_INDEX, BROKEN_LAST_INDEX, CULPRIT_INDEX, CULPRIT_SUBJECT, DEMO_GOOD_TAG, demoHistory } from '../src/demo/history.js';

const tmp = (prefix: string): string => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const git = (dir: string, ...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();

async function totalAt(dir: string, rev: string): Promise<string> {
  const out = tmp('firstbad-price-');
  for (const f of ['pricing.js', 'catalog.js']) fs.writeFileSync(path.join(out, f), `${git(dir, 'show', `${rev}:${f}`)}\n`);
  const pricing = (await import(pathToFileURL(path.join(out, 'pricing.js')).href)) as {
    totalCents(lines: Array<{ price: number; qty: number }>, code: string): number;
    formatCents(cents: number): string;
  };
  const catalog = (await import(pathToFileURL(path.join(out, 'catalog.js')).href)) as { CATALOG: Array<{ id: string; price: number }> };
  const pick = (id: string) => ({ price: catalog.CATALOG.find((p) => p.id === id)?.price ?? 0, qty: 1 });
  return pricing.formatCents(pricing.totalCents([pick('tote'), pick('mug')], 'SAVE10'));
}

function serverExit(dir: string, rev: string, port: number): Promise<number | null | 'running'> {
  const out = tmp('firstbad-server-');
  fs.writeFileSync(path.join(out, 'server.js'), `${git(dir, 'show', `${rev}:server.js`)}\n`);
  fs.writeFileSync(path.join(out, 'package.json'), '{ "type": "module" }\n');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['server.js', String(port)], { cwd: out, stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill();
      resolve('running');
    }, 2500);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

describe('demo history', () => {
  it('has 40 commits with the culprit and the broken range where the spec puts them', () => {
    const h = demoHistory();
    expect(h).toHaveLength(40);
    expect(h[CULPRIT_INDEX]?.subject).toBe(CULPRIT_SUBJECT);
    expect(h[BROKEN_FIRST_INDEX]?.subject).toBe('chore(server): read the port from shop.config.json');
    expect(h[BROKEN_LAST_INDEX + 1]?.subject).toBe('fix(server): fall back to the default port when shop.config.json is missing');
    expect(new Set(h.map((c) => c.subject)).size).toBe(40);
  });

  it('generates the same SHAs twice, tags v1.0 on the root and keeps LF files', () => {
    const a = generateDemoRepo(path.join(tmp('firstbad-demo-a-'), 'shop'));
    const b = generateDemoRepo(path.join(tmp('firstbad-demo-b-'), 'shop'));
    expect(a.head).toBe(b.head);
    expect(a.commits).toBe(40);
    expect(git(a.dir, 'rev-list', '--count', 'HEAD')).toBe('40');
    expect(git(a.dir, 'rev-parse', DEMO_GOOD_TAG)).toBe(git(a.dir, 'rev-list', '--max-parents=0', 'HEAD'));
    expect(git(a.dir, 'log', '--reverse', '--format=%s').split('\n')).toEqual(demoHistory().map((c) => c.subject));
    expect(fs.readFileSync(path.join(a.dir, 'pricing.js'), 'utf8').includes('\r')).toBe(false);
    expect(git(a.dir, 'status', '--porcelain')).toBe('');
    expect(() => generateDemoRepo(a.dir)).toThrow(/not empty/);
  });

  it('computes $18.00 before the culprit and $20.00 from it on', async () => {
    const dir = generateDemoRepo(path.join(tmp('firstbad-demo-c-'), 'shop')).dir;
    const revs = git(dir, 'rev-list', '--reverse', 'HEAD').split('\n');
    expect(await totalAt(dir, DEMO_GOOD_TAG)).toBe('$18.00');
    expect(await totalAt(dir, revs[CULPRIT_INDEX - 1] ?? '')).toBe('$18.00');
    expect(await totalAt(dir, revs[CULPRIT_INDEX] ?? '')).toBe('$20.00');
    expect(await totalAt(dir, 'HEAD')).toBe('$20.00');
  });

  it('crashes the server only inside the broken range', async () => {
    const dir = generateDemoRepo(path.join(tmp('firstbad-demo-d-'), 'shop')).dir;
    const revs = git(dir, 'rev-list', '--reverse', 'HEAD').split('\n');
    expect(await serverExit(dir, revs[BROKEN_FIRST_INDEX - 1] ?? '', 4365)).toBe('running');
    expect(await serverExit(dir, revs[BROKEN_FIRST_INDEX] ?? '', 4366)).toBe(1);
    expect(await serverExit(dir, revs[BROKEN_LAST_INDEX] ?? '', 4367)).toBe(1);
    expect(await serverExit(dir, revs[BROKEN_LAST_INDEX + 1] ?? '', 4368)).toBe('running');
  });
});
