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
