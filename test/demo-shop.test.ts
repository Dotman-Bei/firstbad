import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { SHOP_FILE_ORDER, baseShopFiles } from '../src/demo/shop-files.js';

let server: ChildProcess | null = null;
afterEach(() => {
  server?.kill();
  server = null;
});

function writeShop(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstbad-shop-'));
  for (const [file, content] of Object.entries(baseShopFiles())) fs.writeFileSync(path.join(dir, file), content);
  return dir;
}

async function waitFor(url: string): Promise<Response> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      return await fetch(url);
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`no answer from ${url}`);
}

describe('Corner Shop files', () => {
  it('has every file, LF line endings and no template placeholders', () => {
    const files = baseShopFiles();
    expect(Object.keys(files).sort()).toEqual([...SHOP_FILE_ORDER].sort());
    for (const [name, content] of Object.entries(files)) {
      expect(content.includes('\r'), name).toBe(false);
      expect(content.endsWith('\n'), name).toBe(true);
    }
    expect(files['index.html']).toContain('<strong id="total">$0.00</strong>');
    expect(files['catalog.js']).toContain('  // new products go above this line');
    expect(files['server.js']).toContain('const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);');
  });

  it('prices Tote bag + Mug with SAVE10 at $18.00, codes case-insensitive', async () => {
    const dir = writeShop();
    const pricing = (await import(pathToFileURL(path.join(dir, 'pricing.js')).href)) as {
      totalCents(lines: Array<{ price: number; qty: number }>, code: string): number;
      formatCents(cents: number): string;
    };
    const catalog = (await import(pathToFileURL(path.join(dir, 'catalog.js')).href)) as { CATALOG: Array<{ id: string; price: number }> };
    const pick = (id: string) => ({ price: catalog.CATALOG.find((p) => p.id === id)?.price ?? 0, qty: 1 });
    expect(pricing.formatCents(pricing.totalCents([pick('tote'), pick('mug')], 'SAVE10'))).toBe('$18.00');
    expect(pricing.formatCents(pricing.totalCents([pick('tote'), pick('mug')], 'save10'))).toBe('$18.00');
    expect(pricing.formatCents(pricing.totalCents([pick('tote'), pick('mug')], ''))).toBe('$20.00');
  });

  it('serves the page, the modules and a 404 with node server.js <port>', async () => {
    const dir = writeShop();
    server = spawn(process.execPath, ['server.js', '4361'], { cwd: dir, stdio: 'ignore' });
    const home = await waitFor('http://127.0.0.1:4361/');
    expect(home.status).toBe(200);
    expect(await home.text()).toContain('Corner Shop');
    const js = await fetch('http://127.0.0.1:4361/pricing.js');
    expect(js.headers.get('content-type')).toContain('javascript');
    expect((await fetch('http://127.0.0.1:4361/nope.js')).status).toBe(404);
  });
});
