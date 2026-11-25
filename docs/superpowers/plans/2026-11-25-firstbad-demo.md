# firstbad Demo Fixture Implementation Plan

**Goal:** Build the deterministic "Corner Shop" demo: a zero-dependency shop, a 40-commit history with one planted checkout regression and one unrelated broken range, a shop-emulating stub Kane, and the `firstbad demo` command that runs hunt → confirm → fix end to end.
**Architecture:** `src/demo/shop-files.ts` holds the shop's files as strings; `src/demo/history.ts` describes 40 commits as file edits; `src/demo/generate.ts` replays them into a fresh git repo with a fixed identity, fixed dates and LF files so every machine gets the same SHAs; `src/demo/demo-config.ts` holds the demo check and folder handling; `src/demo/run-demo.ts` wires the generated repo into the core `runFlow`. Tasks 10–12 depend only on the scaffold (Task 1) and run alongside the core chain; Task 13 joins the two branches.
**Tech Stack:** Node >= 20, TypeScript 5.9.3, Vitest 3.2.7, git >= 2.40 (no extra dependencies; the shop itself uses only `node:http`).
**Source spec:** docs/superpowers/specs/2026-11-25-firstbad-design.md

Standing rules (same as the core plan): ESM, `.js` suffixes on relative imports in `src/`, never `as any`, the Vitest global setup compiles `src/` so any type error fails the gate, no git state operations on the repo you work in (tests make their own temporary repositories), no live Kane anywhere. Demo-branch tasks 10–12 must not import any core module from Tasks 3–9; they use `node:child_process`, `node:http` and `fetch` directly.

Demo facts (spec section 9): prices in cents — Tote bag 1250, Mug 750; code `SAVE10` = 10 %; correct total for Tote + Mug + SAVE10 is **$18.00**. Commit index 0 is tagged `v1.0` (good). Index 29 `refactor(cart): extract price helpers` lower-cases the code while `CODES` keys stay upper-case, so the discount is lost → **$20.00**. Indices 18–21 crash the server at boot (it reads a missing `shop.config.json`); index 22 repairs it. Bisect's first probe of the 40-commit linear history is index 19 or 20, so it lands in the broken range and shows a SKIP.

---

### Task 10: The Corner Shop files

**Files:**
- Create: `src/demo/shop-files.ts`
- Test: `test/demo-shop.test.ts`

**Depends on:** Task 1
**Effort:** medium
**Priority:** must-have
**Provides:** `baseShopFiles(): Record<string, string>`, `SHOP_FILE_ORDER: readonly string[]`
**Requires:** none

- [ ] **Step 1: Write the failing test `test/demo-shop.test.ts`**

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**
Run: `npx vitest run test/demo-shop.test.ts`
Expected: FAIL — `Failed to load url ../src/demo/shop-files.js`

- [ ] **Step 3: Write `src/demo/shop-files.ts`**

```ts
// The Corner Shop at v1.0. Every file ends with a newline and uses LF only.
const lines = (...l: string[]): string => `${l.join('\n')}\n`;

const CATALOG_JS = lines(
  '// Corner Shop catalog. Prices are in cents.',
  'export const CATALOG = [',
  "  { id: 'tote', name: 'Tote bag', price: 1250 },",
  "  { id: 'mug', name: 'Mug', price: 750 },",
  '  // new products go above this line',
  '];',
);

const PRICING_JS = lines(
  '// Pricing for the Corner Shop. All amounts are in cents.',
  'export const CODES = { SAVE10: 10 };',
  '',
  'export function subtotalCents(lines) {',
  '  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);',
  '}',
  '',
  'export function totalCents(lines, code) {',
  '  const subtotal = subtotalCents(lines);',
  "  const percent = CODES[String(code ?? '').trim().toUpperCase()] ?? 0;",
  '  return Math.round((subtotal * (100 - percent)) / 100);',
  '}',
  '',
  'export function formatCents(cents) {',
  "  return '$' + (cents / 100).toFixed(2);",
  '}',
);

const APP_JS = lines(
  "import { CATALOG } from './catalog.js';",
  "import { formatCents, totalCents } from './pricing.js';",
  '',
  'const cart = new Map();',
  "let appliedCode = '';",
  '',
  'function lines() {',
  '  return [...cart.entries()].map(([id, qty]) => {',
  '    const product = CATALOG.find((p) => p.id === id);',
  '    return { id, name: product.name, price: product.price, qty };',
  '  });',
  '}',
  '',
  'function renderCart() {',
  "  const list = document.getElementById('cart-lines');",
  "  list.innerHTML = '';",
  '  for (const line of lines()) {',
  "    const item = document.createElement('li');",
  "    item.textContent = line.qty + ' x ' + line.name + ' ' + formatCents(line.price * line.qty);",
  '    list.append(item);',
  '  }',
  '  if (cart.size === 0) {',
  "    const empty = document.createElement('li');",
  "    empty.textContent = 'Your cart is empty';",
  '    list.append(empty);',
  '  }',
  "  document.getElementById('discount-status').textContent = appliedCode ? 'Code ' + appliedCode + ' applied' : '';",
  "  document.getElementById('total').textContent = formatCents(totalCents(lines(), appliedCode));",
  '}',
  '',
  'function renderProducts() {',
  "  const list = document.getElementById('products');",
  "  list.innerHTML = '';",
  '  for (const product of CATALOG) {',
  "    const item = document.createElement('li');",
  "    item.className = 'product';",
  "    const label = document.createElement('span');",
  "    label.textContent = product.name + ' ' + formatCents(product.price);",
  "    const button = document.createElement('button');",
  "    button.type = 'button';",
  "    button.textContent = 'Add ' + product.name + ' to cart';",
  "    button.addEventListener('click', () => {",
  '      cart.set(product.id, (cart.get(product.id) ?? 0) + 1);',
  '      renderCart();',
  '    });',
  "    item.append(label, ' ', button);",
  '    list.append(item);',
  '  }',
  '}',
  '',
  "document.getElementById('apply').addEventListener('click', () => {",
  "  appliedCode = document.getElementById('code').value;",
  '  renderCart();',
  '});',
  '',
  'renderProducts();',
  'renderCart();',
);

const INDEX_HTML = lines(
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="utf-8">',
  '  <meta name="viewport" content="width=device-width, initial-scale=1">',
  '  <title>Corner Shop</title>',
  '  <link rel="stylesheet" href="/styles.css">',
  '</head>',
  '<body>',
  '  <header><h1>Corner Shop</h1><p>Small things, fair prices.</p></header>',
  '  <main>',
  '    <section aria-labelledby="products-heading">',
  '      <h2 id="products-heading">Products</h2>',
  '      <ul id="products"></ul>',
  '    </section>',
  '    <section aria-labelledby="cart-heading" id="cart">',
  '      <h2 id="cart-heading">Your cart</h2>',
  '      <ul id="cart-lines"></ul>',
  '      <label for="code">Discount code</label>',
  '      <input id="code" name="code" autocomplete="off">',
  '      <button id="apply" type="button">Apply</button>',
  '      <p id="discount-status"></p>',
  '      <p class="total">Total: <strong id="total">$0.00</strong></p>',
  '    </section>',
  '  </main>',
  '  <footer><p>Corner Shop demo for firstbad.</p></footer>',
  '  <script type="module" src="/app.js"></script>',
  '</body>',
  '</html>',
);

const STYLES_CSS = lines(
  'body { font-family: system-ui, sans-serif; margin: 0; color: #1f2933; background: #fafaf7; }',
  'header { background: #2f6f4f; color: #fff; padding: 1rem 2rem; }',
  'main { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; padding: 2rem; }',
  'ul { list-style: none; padding: 0; }',
  '.product { padding: 0.5rem 0; }',
  'button { cursor: pointer; }',
  '.total { font-size: 1.25rem; }',
  'footer { padding: 1rem 2rem; color: #52606d; }',
);

const SERVER_JS = lines(
  "import fs from 'node:fs';",
  "import http from 'node:http';",
  "import path from 'node:path';",
  "import { fileURLToPath } from 'node:url';",
  '',
  'const root = path.dirname(fileURLToPath(import.meta.url));',
  'const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);',
  'const types = {',
  "  '.html': 'text/html; charset=utf-8',",
  "  '.js': 'text/javascript; charset=utf-8',",
  "  '.css': 'text/css; charset=utf-8',",
  '};',
  '',
  'const server = http.createServer((req, res) => {',
  "  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;",
  "  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\\/+/, '');",
  '  const file = path.resolve(root, relative);',
  '  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {',
  "    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });",
  "    res.end('Not found');",
  '    return;',
  '  }',
  "  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });",
  '  fs.createReadStream(file).pipe(res);',
  '});',
  '',
  "server.listen(port, '127.0.0.1', () => {",
  "  console.log('Corner Shop on http://127.0.0.1:' + port + '/');",
  '});',
);

const PACKAGE_JSON = lines(
  '{',
  '  "name": "corner-shop",',
  '  "version": "1.0.0",',
  '  "private": true,',
  '  "type": "module",',
  '  "scripts": {',
  '    "start": "node server.js"',
  '  }',
  '}',
);

const README_MD = lines('# Corner Shop', '', 'A tiny zero-dependency shop used by the firstbad demo. Run it with `node server.js 4173`.');

const GITIGNORE = lines('.testmuai/', '*.evidence', 'node_modules/');

const GITATTRIBUTES = lines('* -text');

export const SHOP_FILE_ORDER: readonly string[] = [
  '.gitattributes',
  '.gitignore',
  'README.md',
  'package.json',
  'server.js',
  'index.html',
  'styles.css',
  'catalog.js',
  'pricing.js',
  'app.js',
];

export function baseShopFiles(): Record<string, string> {
  return {
    '.gitattributes': GITATTRIBUTES,
    '.gitignore': GITIGNORE,
    'README.md': README_MD,
    'package.json': PACKAGE_JSON,
    'server.js': SERVER_JS,
    'index.html': INDEX_HTML,
    'styles.css': STYLES_CSS,
    'catalog.js': CATALOG_JS,
    'pricing.js': PRICING_JS,
    'app.js': APP_JS,
  };
}
```

Note: in `SERVER_JS` the TypeScript string `"  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\\/+/, '');"` writes the JavaScript line `const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');` (the doubled backslash is the TS escape).

- [ ] **Step 4: Run the gate to confirm it passes**
Run: `npx vitest run test/demo-shop.test.ts`
Expected: PASS — output contains `Tests  3 passed`

- [ ] **Step 5: Commit (kernel-performed — no agent runs this)**
Message: `feat(demo): Corner Shop files (zero-dependency shop with a SAVE10 discount)`

---

### Task 11: The 40-commit demo history and its deterministic generator

**Files:**
- Create: `src/demo/history.ts`
- Create: `src/demo/generate.ts`
- Test: `test/demo-history.test.ts`

**Depends on:** Task 1, Task 10
**Effort:** high
**Priority:** must-have
**Provides:** `type Edit = { path: string; content: string } | { path: string; find: string; replace: string } | { path: string; append: string }`, `interface DemoCommit { subject: string; edits: Edit[] }`, `DEMO_GOOD_TAG = 'v1.0'`, `CULPRIT_INDEX = 29`, `CULPRIT_SUBJECT = 'refactor(cart): extract price helpers'`, `BROKEN_FIRST_INDEX = 18`, `BROKEN_LAST_INDEX = 21`, `demoHistory(): DemoCommit[]`, `DEMO_AUTHOR = { name: 'Corner Shop Dev', email: 'dev@corner-shop.invalid' }`, `interface GeneratedDemo { dir: string; head: string; goodRef: string; commits: number }`, `generateDemoRepo(dir: string): GeneratedDemo`
**Requires:** `baseShopFiles(): Record<string, string>`

Upstream code you build on: `src/demo/shop-files.ts` exports `baseShopFiles()`, whose files contain these exact lines that the edits below find (each appears exactly once): in `styles.css` — `header { background: #2f6f4f; color: #fff; padding: 1rem 2rem; }`, `.product { padding: 0.5rem 0; }`, `.total { font-size: 1.25rem; }`, `footer { padding: 1rem 2rem; color: #52606d; }`; in `catalog.js` — `  // new products go above this line`; in `index.html` — `  <header><h1>Corner Shop</h1><p>Small things, fair prices.</p></header>` and `  <footer><p>Corner Shop demo for firstbad.</p></footer>`; in `server.js` — `const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);`, `  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;` and `  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });`; in `pricing.js` — the first line `// Pricing for the Corner Shop. All amounts are in cents.`.

Determinism (spec section 9): identity `Corner Shop Dev <dev@corner-shop.invalid>`; author date = committer date = `2026-11-02T09:00:00Z` + 3 h × index; LF files; every git call passes `-c core.autocrlf=false -c core.safecrlf=false -c commit.gpgsign=false -c tag.gpgsign=false -c init.defaultBranch=main`; `--no-verify`; lightweight tag `v1.0` on index 0. This machine has a global `core.autocrlf=true`, which these flags (and the shop's `.gitattributes` `* -text`) neutralise.

- [ ] **Step 1: Write the failing test `test/demo-history.test.ts`**

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**
Run: `npx vitest run test/demo-history.test.ts`
Expected: FAIL — `Failed to load url ../src/demo/generate.js`

- [ ] **Step 3: Write `src/demo/history.ts`**

```ts
import { baseShopFiles } from './shop-files.js';

export type Edit = { path: string; content: string } | { path: string; find: string; replace: string } | { path: string; append: string };

export interface DemoCommit {
  subject: string;
  edits: Edit[];
}

export const DEMO_GOOD_TAG = 'v1.0';
export const CULPRIT_INDEX = 29;
export const CULPRIT_SUBJECT = 'refactor(cart): extract price helpers';
export const BROKEN_FIRST_INDEX = 18;
export const BROKEN_LAST_INDEX = 21;

const lines = (...l: string[]): string => `${l.join('\n')}\n`;
const MARKER = '  // new products go above this line';

function addProduct(id: string, name: string, price: number): Edit {
  return { path: 'catalog.js', find: MARKER, replace: `  { id: '${id}', name: '${name}', price: ${price} },\n${MARKER}` };
}

// The culprit: normalizeCode() lower-cases the code while CODES keys stay upper-case, so SAVE10 is lost.
const PRICING_CULPRIT = lines(
  '// Pricing for the Corner Shop. All amounts are in cents.',
  '// totalCents() applies at most one discount code; codes are case-insensitive.',
  'export const CODES = { SAVE10: 10 };',
  '',
  'export function normalizeCode(code) {',
  "  return String(code ?? '').trim().toLowerCase();",
  '}',
  '',
  'export function discountPercent(code) {',
  '  return CODES[normalizeCode(code)] ?? 0;',
  '}',
  '',
  'export function subtotalCents(lines) {',
  '  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);',
  '}',
  '',
  'export function totalCents(lines, code) {',
  '  const subtotal = subtotalCents(lines);',
  '  return Math.round((subtotal * (100 - discountPercent(code))) / 100);',
  '}',
  '',
  'export function formatCents(cents) {',
  "  return '$' + (cents / 100).toFixed(2);",
  '}',
);

export function demoHistory(): DemoCommit[] {
  const base = baseShopFiles();
  return [
    { subject: 'feat: Corner Shop v1.0', edits: Object.entries(base).map(([path, content]) => ({ path, content })) },
    { subject: 'docs: explain how to run the shop locally', edits: [{ path: 'README.md', append: '\n## Run it\n\nnode server.js 4173, then open http://127.0.0.1:4173/.\n' }] },
    {
      subject: 'style: soften the header colour',
      edits: [{ path: 'styles.css', find: 'header { background: #2f6f4f; color: #fff; padding: 1rem 2rem; }', replace: 'header { background: #3a7d5c; color: #fff; padding: 1rem 2rem; }' }],
    },
    { subject: 'feat(catalog): add the Notebook', edits: [addProduct('notebook', 'Notebook', 450)] },
    {
      subject: 'docs: show the opening hours in the footer',
      edits: [
        {
          path: 'index.html',
          find: '  <footer><p>Corner Shop demo for firstbad.</p></footer>',
          replace: '  <footer><p>Corner Shop demo for firstbad. Open every day, 9:00 to 18:00.</p></footer>',
        },
      ],
    },
    { subject: 'chore: add an editorconfig', edits: [{ path: '.editorconfig', content: lines('root = true', '', '[*]', 'indent_style = space', 'indent_size = 2', 'end_of_line = lf') }] },
    { subject: 'feat(catalog): add the Pencil set', edits: [addProduct('pencils', 'Pencil set', 600)] },
    { subject: 'style: give the cart a light border', edits: [{ path: 'styles.css', append: '#cart { border: 1px solid #d9e2ec; padding: 1rem; }\n' }] },
    { subject: 'docs(changelog): start a changelog', edits: [{ path: 'CHANGELOG.md', content: lines('# Changelog', '', '## 1.1 (unreleased)', '', '- Added the Notebook and the Pencil set.') }] },
    {
      subject: 'style: tidy the product list spacing',
      edits: [{ path: 'styles.css', find: '.product { padding: 0.5rem 0; }', replace: '.product { padding: 0.6rem 0; border-bottom: 1px solid #eef2f6; }' }],
    },
    { subject: 'feat(catalog): add the Water bottle', edits: [addProduct('bottle', 'Water bottle', 1500)] },
    { subject: 'docs: describe the SAVE10 code', edits: [{ path: 'README.md', append: '\n## Discount codes\n\nSAVE10 takes 10% off the whole cart.\n' }] },
    {
      subject: 'chore(server): log each request path',
      edits: [
        {
          path: 'server.js',
          find: "  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;",
          replace: "  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;\n  console.log(req.method + ' ' + urlPath);",
        },
      ],
    },
    { subject: 'style: make the Apply button larger', edits: [{ path: 'styles.css', append: '#apply { padding: 0.4rem 1rem; }\n' }] },
    { subject: 'feat(catalog): add the Sticker pack', edits: [addProduct('stickers', 'Sticker pack', 300)] },
    { subject: 'docs(changelog): note the new products', edits: [{ path: 'CHANGELOG.md', append: '- Added the Water bottle and the Sticker pack.\n' }] },
    {
      subject: 'style: footer typography',
      edits: [{ path: 'styles.css', find: 'footer { padding: 1rem 2rem; color: #52606d; }', replace: 'footer { padding: 1rem 2rem; color: #52606d; font-size: 0.9rem; }' }],
    },
    {
      subject: 'feat(ui): add a page subtitle',
      edits: [
        {
          path: 'index.html',
          find: '  <header><h1>Corner Shop</h1><p>Small things, fair prices.</p></header>',
          replace: '  <header><h1>Corner Shop</h1><p>Small things, fair prices, friendly people.</p></header>',
        },
      ],
    },
    {
      subject: 'chore(server): read the port from shop.config.json',
      edits: [
        {
          path: 'server.js',
          find: 'const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);',
          replace: "const config = JSON.parse(fs.readFileSync(path.join(root, 'shop.config.json'), 'utf8'));\nconst port = Number(process.argv[2] ?? config.port ?? 4173);",
        },
      ],
    },
    { subject: 'style: align the total to the right', edits: [{ path: 'styles.css', find: '.total { font-size: 1.25rem; }', replace: '.total { font-size: 1.25rem; text-align: right; }' }] },
    { subject: 'docs: add a contributing note', edits: [{ path: 'CONTRIBUTING.md', content: lines('# Contributing', '', 'Keep the shop dependency-free and run it with node server.js before you push.') }] },
    { subject: 'feat(catalog): add the Tea towel', edits: [addProduct('towel', 'Tea towel', 900)] },
    {
      subject: 'fix(server): fall back to the default port when shop.config.json is missing',
      edits: [
        {
          path: 'server.js',
          find: "const config = JSON.parse(fs.readFileSync(path.join(root, 'shop.config.json'), 'utf8'));",
          replace: "const configPath = path.join(root, 'shop.config.json');\nconst config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};",
        },
      ],
    },
    { subject: 'docs(changelog): note the server port change', edits: [{ path: 'CHANGELOG.md', append: '- The server reads its port from shop.config.json when the file exists.\n' }] },
    { subject: 'style: zebra stripes for the product list', edits: [{ path: 'styles.css', append: '.product:nth-child(even) { background: #f5f7fa; }\n' }] },
    { subject: 'feat(catalog): add the Postcard', edits: [addProduct('postcard', 'Postcard', 150)] },
    { subject: 'docs: add a FAQ to the README', edits: [{ path: 'README.md', append: '\n## FAQ\n\nIs this a real shop? No, it is a demo for firstbad.\n' }] },
    { subject: 'style: hover state for the Add buttons', edits: [{ path: 'styles.css', append: '.product button:hover { background: #e3f2ea; }\n' }] },
    {
      subject: 'chore(pricing): document the discount rules',
      edits: [
        {
          path: 'pricing.js',
          find: '// Pricing for the Corner Shop. All amounts are in cents.\n',
          replace: '// Pricing for the Corner Shop. All amounts are in cents.\n// totalCents() applies at most one discount code; codes are case-insensitive.\n',
        },
      ],
    },
    { subject: CULPRIT_SUBJECT, edits: [{ path: 'pricing.js', content: PRICING_CULPRIT }] },
    { subject: 'docs(changelog): note the pricing refactor', edits: [{ path: 'CHANGELOG.md', append: '- Pricing helpers were extracted into small functions.\n' }] },
    { subject: 'style: muted colour for the cart lines', edits: [{ path: 'styles.css', append: '#cart-lines li { color: #334e68; }\n' }] },
    { subject: 'feat(catalog): add the Keyring', edits: [addProduct('keyring', 'Keyring', 350)] },
    { subject: 'docs: link the changelog from the README', edits: [{ path: 'README.md', append: '\nSee CHANGELOG.md for what changed.\n' }] },
    {
      subject: 'style: rounded corners on the cart',
      edits: [{ path: 'styles.css', find: '#cart { border: 1px solid #d9e2ec; padding: 1rem; }', replace: '#cart { border: 1px solid #d9e2ec; padding: 1rem; border-radius: 8px; }' }],
    },
    {
      subject: 'chore(server): send a no-store cache header',
      edits: [
        {
          path: 'server.js',
          find: "  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });",
          replace: "  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });",
        },
      ],
    },
    { subject: 'feat(catalog): add the Canvas print', edits: [addProduct('canvas', 'Canvas print', 2400)] },
    { subject: 'docs: explain how to take a screenshot for the README', edits: [{ path: 'README.md', append: '\n## Screenshots\n\nOpen the shop, add two items and press Print Screen.\n' }] },
    { subject: 'style: focus ring on the discount code input', edits: [{ path: 'styles.css', append: '#code:focus { outline: 2px solid #3a7d5c; }\n' }] },
    { subject: 'docs(changelog): prepare the 1.1 notes', edits: [{ path: 'CHANGELOG.md', find: '## 1.1 (unreleased)', replace: '## 1.1 (2026-11-06)' }] },
  ];
}
```

- [ ] **Step 4: Write `src/demo/generate.ts`**

```ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_GOOD_TAG, demoHistory, type Edit } from './history.js';

export const DEMO_AUTHOR = { name: 'Corner Shop Dev', email: 'dev@corner-shop.invalid' };
const DEMO_START_MS = Date.UTC(2026, 10, 2, 9, 0, 0);
const GIT_FLAGS = ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'init.defaultBranch=main'];

export interface GeneratedDemo {
  dir: string;
  head: string;
  goodRef: string;
  commits: number;
}

function applyEdit(files: Map<string, string>, e: Edit): void {
  if ('content' in e) {
    files.set(e.path, e.content);
    return;
  }
  const current = files.get(e.path);
  if (current === undefined) throw new Error(`demo history: ${e.path} does not exist yet`);
  if ('append' in e) {
    files.set(e.path, current + e.append);
    return;
  }
  const at = current.indexOf(e.find);
  if (at < 0 || current.indexOf(e.find, at + 1) >= 0) throw new Error(`demo history: "${e.find}" must appear exactly once in ${e.path}`);
  files.set(e.path, current.slice(0, at) + e.replace + current.slice(at + e.find.length));
}

export function generateDemoRepo(dir: string): GeneratedDemo {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length > 0) throw new Error(`${dir} is not empty`);
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: DEMO_AUTHOR.name,
    GIT_AUTHOR_EMAIL: DEMO_AUTHOR.email,
    GIT_COMMITTER_NAME: DEMO_AUTHOR.name,
    GIT_COMMITTER_EMAIL: DEMO_AUTHOR.email,
  };
  const run = (args: string[], env: NodeJS.ProcessEnv = baseEnv): string =>
    execFileSync('git', [...GIT_FLAGS, ...args], { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  run(['init', '-q']);
  run(['config', 'core.autocrlf', 'false']);
  run(['config', 'commit.gpgsign', 'false']);
  run(['config', 'user.name', DEMO_AUTHOR.name]);
  run(['config', 'user.email', DEMO_AUTHOR.email]);
  const files = new Map<string, string>();
  const history = demoHistory();
  history.forEach((commit, index) => {
    const touched = new Set<string>();
    for (const e of commit.edits) {
      applyEdit(files, e);
      touched.add(e.path);
    }
    for (const file of touched) {
      const target = path.join(dir, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, files.get(file) ?? '');
    }
    run(['add', '-A']);
    const date = new Date(DEMO_START_MS + index * 3 * 3600 * 1000).toISOString().replace('.000Z', 'Z');
    run(['commit', '-q', '--no-verify', '-m', commit.subject], { ...baseEnv, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
    if (index === 0) run(['tag', DEMO_GOOD_TAG]);
  });
  return { dir, head: run(['rev-parse', 'HEAD']), goodRef: DEMO_GOOD_TAG, commits: history.length };
}
```

- [ ] **Step 5: Run the gate to confirm it passes**
Run: `npx vitest run test/demo-history.test.ts`
Expected: PASS — output contains `Tests  4 passed`

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**
Message: `feat(demo): deterministic 40-commit Corner Shop history with a planted regression`

---

### Task 12: Demo command skeleton — the demo check, demo folders and the shop-emulating stub Kane

**Files:**
- Create: `src/demo/demo-config.ts`
- Create: `test/fixtures/stub-kane-shop.mjs`
- Test: `test/demo-config.test.ts`

**Depends on:** Task 1, Task 10, Task 11
**Effort:** medium
**Priority:** must-have
**Provides:** `DEMO_PORT = 4173`, `interface DemoCheck { url: string; do: string; store: string; expected: string }`, `demoCheck(port: number): DemoCheck`, `demoServeCommand(port: number): string`, `class DemoDirError extends Error`, `interface DemoDirs { root: string; shopDir: string; reportDir: string }`, `prepareDemoDir(dir: string, force: boolean): DemoDirs`, `test/fixtures/stub-kane-shop.mjs (stub kane-cli that computes the Corner Shop total from the served pricing.js and catalog.js; logs to STUB_KANE_LOG)`
**Requires:** `generateDemoRepo(dir: string): GeneratedDemo`, `interface GeneratedDemo { dir: string; head: string; goodRef: string; commits: number }`, `DEMO_GOOD_TAG = 'v1.0'`, `CULPRIT_INDEX = 29`

Upstream code you build on: `src/demo/generate.ts` exports `generateDemoRepo(dir)` (creates the 40-commit shop repo in an empty `dir` and returns `{ dir, head, goodRef, commits }`); `src/demo/history.ts` exports `DEMO_GOOD_TAG` and `CULPRIT_INDEX`. The shop serves with `node server.js <port>` and computes totals in the browser from `pricing.js` (`totalCents(lines, code)`, `formatCents(cents)`) and `catalog.js` (`CATALOG` with ids `tote` and `mug`).

The stub must speak the same NDJSON contract as the real kane-cli under `--agent`: a `stream_start` line first, untyped step lines, then one `run_end` with `status`, `summary`, `one_liner`, `reason`, `duration`, `credits_consumed`, `final_state: { observed }`, `test_url`, `result_code`. It reads the URL from `Go to <url>` in the objective, the code from `type <CODE> into the discount code field`, and the expected value from a trailing `"..."` (absent for the store-only template, which then always reports `passed`). `DemoCheck` is structurally identical to the core `Check` (`{ url; do; store; expected }`), so Task 13 passes it straight to the core flow.

`--force` safety: `prepareDemoDir` only deletes a non-empty folder whose entries are all `shop` or `report` (a previous demo); anything else is refused.

- [ ] **Step 1: Write the stub `test/fixtures/stub-kane-shop.mjs`**

```js
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
```

- [ ] **Step 2: Write the failing test `test/demo-config.test.ts`**

```ts
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
```

- [ ] **Step 3: Run it to confirm it fails**
Run: `npx vitest run test/demo-config.test.ts`
Expected: FAIL — `Failed to load url ../src/demo/demo-config.js`

- [ ] **Step 4: Write `src/demo/demo-config.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';

export const DEMO_PORT = 4173;

export interface DemoCheck {
  url: string;
  do: string;
  store: string;
  expected: string;
}

export function demoCheck(port: number): DemoCheck {
  return {
    url: `http://127.0.0.1:${port}/`,
    do: 'add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply',
    store: 'the total amount shown next to the word Total',
    expected: '$18.00',
  };
}

export function demoServeCommand(port: number): string {
  return `node server.js ${port}`;
}

export class DemoDirError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoDirError';
  }
}

export interface DemoDirs {
  root: string;
  shopDir: string;
  reportDir: string;
}

export function prepareDemoDir(dir: string, force: boolean): DemoDirs {
  const root = path.resolve(dir);
  if (fs.existsSync(root)) {
    const entries = fs.readdirSync(root);
    if (entries.length > 0) {
      if (!force) throw new DemoDirError(`${root} is not empty (use --force to replace an earlier demo)`);
      if (!entries.every((e) => e === 'shop' || e === 'report')) {
        throw new DemoDirError(`refusing to delete ${root}: it does not look like an earlier firstbad demo (only shop/ and report/ are expected)`);
      }
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  }
  fs.mkdirSync(root, { recursive: true });
  return { root, shopDir: path.join(root, 'shop'), reportDir: path.join(root, 'report') };
}
```

- [ ] **Step 5: Run the gate to confirm it passes**
Run: `npx vitest run test/demo-config.test.ts`
Expected: PASS — output contains `Tests  3 passed`

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**
Message: `feat(demo): demo check, demo folders and the shop-emulating stub kane-cli`

---

### Task 13: `firstbad demo` — wire the generated shop into the core flow, with an end-to-end stub test

**Files:**
- Create: `src/demo/run-demo.ts`
- Modify: `src/cli.ts`
- Test: `test/demo-e2e.test.ts`

**Depends on:** Task 1, Task 5, Task 7, Task 8, Task 10, Task 11, Task 12
**Effort:** high
**Priority:** must-have
**Provides:** `interface DemoOptions { dir: string; port: number; agentArgv: string[] | null; noFix: boolean; force: boolean; kaneCmd: string[]; env: NodeJS.ProcessEnv; print: (line: string) => void; color: boolean; template?: TemplateId; verdictMode?: VerdictMode; promptRoute?: AgentPromptRoute }`, `runDemo(o: DemoOptions): Promise<FlowResult>`, `firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" | --agent none] [--no-fix] [--force]`
**Requires:** `type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only'`, `type VerdictMode = 'status+value' | 'value-only'`, `type AgentPromptRoute = 'stdin' | 'arg'`, `runFlow(o: FlowOptions): Promise<FlowResult>`, `interface FlowResult { exitCode: 0 | 1 | 3; report: Report | null; reportPaths: { md: string; json: string } | null; message: string }`, `interface CliIO { print(line: string): void; env: NodeJS.ProcessEnv; cwd: string; color: boolean }`, `kaneCommand(env: NodeJS.ProcessEnv): string[]`, `COMMANDS: Record<string, Command>`, `main(argv: string[], io: CliIO): Promise<number>`, `parseAgent(value: string | undefined): string[] | null`, `generateDemoRepo(dir: string): GeneratedDemo`, `DEMO_GOOD_TAG = 'v1.0'`, `CULPRIT_SUBJECT = 'refactor(cart): extract price helpers'`, `DEMO_PORT = 4173`, `demoCheck(port: number): DemoCheck`, `demoServeCommand(port: number): string`, `class DemoDirError extends Error`, `prepareDemoDir(dir: string, force: boolean): DemoDirs`, `test/fixtures/stub-kane-shop.mjs (stub kane-cli that computes the Corner Shop total from the served pricing.js and catalog.js; logs to STUB_KANE_LOG)`, `test/fixtures/stub-agent.mjs (modes write, noop, fail, restore-from-parent via STUB_AGENT_MODE, STUB_AGENT_FILE, STUB_AGENT_CONTENT; STUB_AGENT_NOOP_FIRST with STUB_AGENT_STATE; logs to STUB_AGENT_LOG)`, `test/helpers.ts (ROOT, STUB_KANE, STUB_AGENT, TINY_SERVER, KANE_CMD, VALUE_SERVER, CRASH_SERVER, tempDir, git, makeRepo, bisectRepo, setStubPlan, clearStubEnv, stubRuns)`

Upstream facts: `runFlow` (src/run.ts) takes `FlowOptions { repoDir; good; bad; check; serve; setup; agentArgv; noFix; outDir; kaneCmd; env; print; color; template?; verdictMode?; promptRoute?; oracleCmd? }`, prints the timeline, writes `report.md` / `report.json` into `outDir`, commits a verified fix on `firstbad/fix-<sha>` and returns `{ exitCode, report, reportPaths, message }`. `src/cli.ts` (Task 8) has a `COMMANDS` table containing the line `  oracle: oracleCommand,`, a `HELP` array containing the line `  '  firstbad --version | --help',`, the import line `import { runFlow } from './run.js';` and the line `export const COMMANDS: Record<string, Command> = {`. Task 9 (droppable) may already have added a `clean` entry; the replacements below still match. The stub agent's `restore-from-parent` mode reads `First bad commit: <sha>` from the prompt and restores `STUB_AGENT_FILE` from `<sha>^`, which is the correct fix for the demo (it puts back the upper-casing `pricing.js`).

- [ ] **Step 1: Write the failing test `test/demo-e2e.test.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main, type CliIO } from '../src/cli.js';
import { CULPRIT_SUBJECT } from '../src/demo/history.js';
import { ROOT, STUB_AGENT, clearStubEnv, git, stubRuns, tempDir } from './helpers.js';

const STUB_SHOP = path.join(ROOT, 'test', 'fixtures', 'stub-kane-shop.mjs');

afterEach(() => clearStubEnv());

describe('firstbad demo (stub Kane)', () => {
  it('generates the shop, finds the culprit around the broken range, and lets the agent fix it', async () => {
    const work = tempDir('firstbad-e2e-');
    const dir = path.join(work, 'demo');
    const kaneLog = path.join(work, 'kane-log.jsonl');
    process.env.STUB_KANE_LOG = kaneLog;
    process.env.STUB_AGENT_MODE = 'restore-from-parent';
    process.env.STUB_AGENT_FILE = 'pricing.js';
    const env = { ...process.env, FIRSTBAD_KANE: `"${process.execPath}" "${STUB_SHOP}"` };
    const lines: string[] = [];
    const io: CliIO = { print: (l) => lines.push(l), env, cwd: work, color: false };
    const code = await main(['demo', '--dir', dir, '--port', '4381', '--agent', `"${process.execPath}" "${STUB_AGENT}"`], io);
    expect(code).toBe(0);
    const report = JSON.parse(fs.readFileSync(path.join(dir, 'report', 'report.json'), 'utf8')) as {
      hunt: { status: string; culprit: { subject: string } };
      fix: { status: string; branch: string };
      timeline: Array<{ phase: string; verdict: string; reason: string }>;
      cost: { kaneRuns: number };
    };
    expect(report.hunt.status).toBe('confirmed');
    expect(report.hunt.culprit.subject).toBe(CULPRIT_SUBJECT);
    expect(report.timeline.some((e) => e.phase === 'bisect' && e.verdict === 'SKIP' && e.reason.includes('page never loaded'))).toBe(true);
    expect(report.fix.status).toBe('verified');
    expect(report.cost.kaneRuns).toBeLessThanOrEqual(16);
    expect(stubRuns(kaneLog)).toBe(report.cost.kaneRuns);
    expect(git(path.join(dir, 'shop'), 'show', `${report.fix.branch}:pricing.js`)).toContain('toUpperCase');
    expect(lines.join('\n')).toContain('first bad commit');
    expect(lines.join('\n')).toContain('generated the Corner Shop history (40 commits');
    expect(await main(['demo', '--dir', dir], io)).toBe(2);
    expect(await main(['demo', '--port', 'abc'], io)).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**
Run: `npx vitest run test/demo-e2e.test.ts`
Expected: FAIL — `firstbad: unknown command "demo"` (main returns 2, so `expect(code).toBe(0)` fails)

- [ ] **Step 3: Write `src/demo/run-demo.ts`**

```ts
import type { AgentPromptRoute, TemplateId, VerdictMode } from '../kane-profile.js';
import { runFlow, type FlowResult } from '../run.js';
import { demoCheck, demoServeCommand, prepareDemoDir } from './demo-config.js';
import { generateDemoRepo } from './generate.js';
import { DEMO_GOOD_TAG } from './history.js';

export interface DemoOptions {
  dir: string;
  port: number;
  agentArgv: string[] | null;
  noFix: boolean;
  force: boolean;
  kaneCmd: string[];
  env: NodeJS.ProcessEnv;
  print: (line: string) => void;
  color: boolean;
  template?: TemplateId;
  verdictMode?: VerdictMode;
  promptRoute?: AgentPromptRoute;
}

export async function runDemo(o: DemoOptions): Promise<FlowResult> {
  const dirs = prepareDemoDir(o.dir, o.force);
  const demo = generateDemoRepo(dirs.shopDir);
  const check = demoCheck(o.port);
  o.print(`firstbad demo: generated the Corner Shop history (${demo.commits} commits, good ref ${demo.goodRef}, HEAD ${demo.head.slice(0, 7)}) in ${dirs.shopDir}`);
  o.print(`firstbad demo: the check: at ${check.url} ${check.do}, store ${check.store}, expect ${check.expected}`);
  return runFlow({
    repoDir: dirs.shopDir,
    good: DEMO_GOOD_TAG,
    bad: 'HEAD',
    check,
    serve: demoServeCommand(o.port),
    setup: null,
    agentArgv: o.agentArgv,
    noFix: o.noFix,
    outDir: dirs.reportDir,
    kaneCmd: o.kaneCmd,
    env: o.env,
    print: o.print,
    color: o.color,
    template: o.template,
    verdictMode: o.verdictMode,
    promptRoute: o.promptRoute,
  });
}
```

- [ ] **Step 4: Add the `demo` command to `src/cli.ts` (four exact replacements)**

Replace `import { runFlow } from './run.js';` with:

```ts
import { DEMO_PORT, DemoDirError } from './demo/demo-config.js';
import { runDemo } from './demo/run-demo.js';
import { runFlow } from './run.js';
```

Replace `  '  firstbad --version | --help',` with:

```ts
  '  firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" | --agent none] [--no-fix] [--force]',
  '                                      generate the 40-commit Corner Shop and hunt + fix its planted bug',
  '  firstbad --version | --help',
```

Replace `export const COMMANDS: Record<string, Command> = {` with:

```ts
const DEMO_OPTIONS = {
  dir: { type: 'string' },
  port: { type: 'string' },
  agent: { type: 'string' },
  'no-fix': { type: 'boolean' },
  force: { type: 'boolean' },
} as const;

function parseDemo(args: string[]) {
  return parseArgs({ args, options: DEMO_OPTIONS, allowPositionals: false, strict: true }).values;
}

async function demoCommand(args: string[], io: CliIO): Promise<number> {
  let values: ReturnType<typeof parseDemo>;
  try {
    values = parseDemo(args);
  } catch (err) {
    io.print(`firstbad demo: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const port = values.port === undefined ? DEMO_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    io.print('firstbad demo: --port must be an integer between 1 and 65535');
    return 2;
  }
  try {
    const r = await runDemo({
      dir: path.resolve(io.cwd, values.dir ?? 'firstbad-demo'),
      port,
      agentArgv: parseAgent(values.agent),
      noFix: values['no-fix'] === true,
      force: values.force === true,
      kaneCmd: kaneCommand(io.env),
      env: io.env,
      print: (l) => io.print(l),
      color: io.color,
    });
    return r.exitCode;
  } catch (err) {
    if (err instanceof DemoDirError) {
      io.print(`firstbad demo: ${err.message}`);
      return 2;
    }
    throw err;
  }
}

export const COMMANDS: Record<string, Command> = {
```

Replace `  oracle: oracleCommand,` with:

```ts
  oracle: oracleCommand,
  demo: demoCommand,
```

- [ ] **Step 5: Run the gate to confirm it passes**
Run: `npx vitest run test/demo-e2e.test.ts test/cli.test.ts`
Expected: PASS — output contains `Test Files  2 passed`

- [ ] **Step 6: Commit (kernel-performed — no agent runs this)**
Message: `feat(demo): firstbad demo runs hunt, confirm and agent fix on the generated shop`
