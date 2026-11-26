// Browser scenes, headless installed Chrome, fresh context (no profile, so logged out). Read-only.
//   S1: the Corner Shop at HEAD, driven by this script (not a Kane run).
//   S5 / S10: the real share pages of runs #1 and #14, Autoplay then the last step.
//   S8: final-step stills of runs #12 and #13.
// Every scene has a gate; a failed gate is retaken up to 3 times, then reported BLOCKED. Nothing is staged.
//   node scripts/capture.mjs [S1 S5 S8 S10]
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const demo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(demo, '..');
const clips = path.join(demo, 'public/clips');
const stills = path.join(demo, 'public/preview');
const work = path.join(demo, 'capture');
for (const d of [clips, stills, work]) fs.mkdirSync(d, { recursive: true });
const report = JSON.parse(fs.readFileSync(path.join(root, 'docs/demo/recorded-run/report.json'), 'utf8'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const wanted = process.argv.slice(2);

const jpegWidth = (b) => {
  for (let i = 2; i < b.length - 9; ) {
    if (b[i + 1] >= 0xc0 && b[i + 1] <= 0xc3) return b.readUInt16BE(i + 7);
    i += 2 + b.readUInt16BE(i + 2);
  }
  return 0;
};

// Screencast to constant-fps H.264: keep only full-size frames, each shown until the next one arrived.
async function record(page, name, size, action) {
  const dir = path.join(work, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir);
  const frames = [];
  await page.screencast.start({
    quality: 95,
    size,
    onFrame: ({ data }) => {
      if (jpegWidth(data) !== size.width) return;
      const file = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, data);
      frames.push({ file, at: Date.now() });
    },
  });
  await action();
  const end = Date.now();
  await page.screencast.stop();
  if (frames.length === 0) throw new Error('no frames captured');
  const list = frames.map((f, i) => `file '${f.file.replace(/\\/g, '/')}'\nduration ${(((frames[i + 1]?.at ?? end) - f.at) / 1000).toFixed(3)}`).join('\n');
  const listFile = path.join(dir, 'list.txt');
  fs.writeFileSync(listFile, `${list}\nfile '${frames.at(-1).file.replace(/\\/g, '/')}'\n`);
  const out = path.join(clips, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', out]);
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }));
  fs.rmSync(dir, { recursive: true, force: true });
  return { out: path.basename(out), frames: frames.length, duration };
}

// Any email address, or this machine's user name, on a captured page fails the scene.
const privateText = new RegExp(`[\\w.+-]+@[\\w-]+\\.\\w+|${os.userInfo().username}`, 'i');

async function shop(browser) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fbvid-shop-'));
  const { generateDemoRepo } = await import(pathToFileURL(path.join(root, 'dist/demo/generate.js')).href);
  const dir = path.join(tmp, 'shop');
  const made = generateDemoRepo(dir);
  if (!made.head.startsWith('6f9b864')) throw new Error(`unexpected demo HEAD ${made.head}`);
  const server = spawn(process.execPath, ['server.js', '4173'], { cwd: dir, stdio: 'ignore' });
  try {
    await wait(800);
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/');
    // A visible pointer for viewers: headless capture draws none.
    await page.evaluate(() => {
      const dot = document.createElement('div');
      dot.id = 'ptr';
      dot.style.cssText = 'position:fixed;left:480px;top:420px;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(240,140,0,.85);border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.5);z-index:99;pointer-events:none;transition:left .35s ease,top .35s ease,transform .15s';
      document.body.append(dot);
    });
    const point = async (locator) => {
      const box = await locator.boundingBox();
      await page.evaluate(({ x, y }) => Object.assign(document.getElementById('ptr').style, { left: `${x}px`, top: `${y}px` }), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await wait(450);
    };
    const press = async (locator) => {
      await point(locator);
      await page.evaluate(() => (document.getElementById('ptr').style.transform = 'scale(.6)'));
      await locator.click();
      await wait(160);
      await page.evaluate(() => (document.getElementById('ptr').style.transform = 'none'));
      await wait(350);
    };
    const info = await record(page, 's1-shop', { width: 1920, height: 1080 }, async () => {
      await wait(700);
      await press(page.getByRole('button', { name: 'Add Tote bag to cart' }));
      await press(page.getByRole('button', { name: 'Add Mug to cart' }));
      await press(page.locator('#code'));
      await page.locator('#code').pressSequentially('SAVE10', { delay: 90 });
      await wait(500);
      await press(page.getByRole('button', { name: 'Apply' }));
      await wait(11000);
    });
    const status = await page.locator('#discount-status').innerText();
    const total = await page.locator('#total').innerText();
    if (status !== 'Code SAVE10 applied' || total !== '$20.00') throw new Error(`gate: "${status}" / ${total}`);
    const box = await page.locator('#cart').boundingBox();
    await context.close();
    return { ...info, status, total, cart: box };
  } finally {
    server.kill();
    await wait(500);
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function sharePage(browser, row) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(report.timeline[row - 1].testUrl, { waitUntil: 'networkidle', timeout: 90000 });
  const last = page.getByText(/^Reading the cart total/).first();
  await last.waitFor({ timeout: 45000 });
  await wait(2500);
  return { context, page, last };
}

async function finalStill(page, last, row, expected) {
  await last.click();
  await wait(4000);
  const text = await page.innerText('body');
  if (privateText.test(text)) throw new Error('gate: a name or email is on the page');
  if (!/Someone\s+updated\s+this\s+test\s+case/.test(text)) throw new Error('gate: page is not the anonymous view');
  const file = `share-${row}.png`;
  await page.screenshot({ path: path.join(stills, file) });
  return { still: file, expected };
}

const autoplay = (row, name, expected) => async (browser) => {
  const { context, page, last } = await sharePage(browser, row);
  const info = await record(page, name, { width: 2560, height: 1440 }, async () => {
    await wait(700);
    await page.getByText('Autoplay', { exact: true }).click();
    await page.getByText('Stop', { exact: true }).waitFor({ timeout: 10000 });
    await page.getByText('Autoplay', { exact: true }).waitFor({ timeout: 40000 });
  });
  // Autoplay leaves a tooltip over the cart; reload so the final-step still shows the whole screenshot.
  await page.reload({ waitUntil: 'networkidle', timeout: 90000 });
  await last.waitFor({ timeout: 45000 });
  await wait(2500);
  const result = { ...info, ...(await finalStill(page, last, row, expected)) };
  await context.close();
  return result;
};

const stillsOnly = async (browser) => {
  const out = [];
  for (const [row, expected] of [[12, '$20.00'], [13, '$18.00']]) {
    const { context, page, last } = await sharePage(browser, row);
    out.push(await finalStill(page, last, row, expected));
    await context.close();
  }
  return { stills: out };
};

const scenes = { S1: shop, S5: autoplay(1, 's5-share', '$20.00'), S8: stillsOnly, S10: autoplay(14, 's10-share', '$18.00') };
const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=2'] });
const resultFile = path.join(work, 'capture-report.json');
const results = fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, 'utf8')) : {};
for (const [id, run] of Object.entries(scenes)) {
  if (wanted.length > 0 && !wanted.includes(id)) continue;
  for (let take = 1; take <= 3; take++) {
    try {
      results[id] = { take, ...(await run(browser)) };
      console.log(id, JSON.stringify(results[id]));
      break;
    } catch (err) {
      console.log(`${id} take ${take} failed: ${err.message.split('\n')[0]}`);
      results[id] = { take: 'BLOCKED', error: err.message.split('\n')[0] };
      await wait(3000);
    }
  }
}
await browser.close();
fs.writeFileSync(resultFile, JSON.stringify(results, null, 1));
