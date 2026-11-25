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
    process.env.STUB_SHOP_FINAL_STATE = 'multikey';
    const env = { ...process.env, FIRSTBAD_KANE: `"${process.execPath}" "${STUB_SHOP}"` };
    const lines: string[] = [];
    const io: CliIO = { print: (l) => lines.push(l), env, cwd: work, color: false };
    const code = await main(['demo', '--dir', dir, '--port', '4381', '--agent', `"${process.execPath}" "${STUB_AGENT}"`], io);
    expect(code).toBe(0);
    const report = JSON.parse(fs.readFileSync(path.join(dir, 'report', 'report.json'), 'utf8')) as {
      hunt: { status: string; culprit: { subject: string } };
      fix: { status: string; branch: string };
      timeline: Array<{ phase: string; verdict: string; reason: string; observed: string | null; observedKey?: string }>;
      cost: { kaneRuns: number };
    };
    expect(report.hunt.status).toBe('confirmed');
    expect(report.hunt.culprit.subject).toBe(CULPRIT_SUBJECT);
    expect(report.timeline.some((e) => e.phase === 'bisect' && e.verdict === 'SKIP' && e.reason.includes('page never loaded'))).toBe(true);
    expect(report.fix.status).toBe('verified');
    const read = report.timeline.filter((e) => e.observed !== null);
    expect(read.length).toBeGreaterThanOrEqual(5);
    expect(read.every((e) => e.observedKey === 'cart_total')).toBe(true);
    expect(report.cost.kaneRuns).toBeLessThanOrEqual(16);
    expect(stubRuns(kaneLog)).toBe(report.cost.kaneRuns);
    expect(git(path.join(dir, 'shop'), 'show', `${report.fix.branch}:pricing.js`)).toContain('toUpperCase');
    expect(lines.join('\n')).toContain('first bad commit');
    expect(lines.join('\n')).toContain('generated the Corner Shop history (40 commits');
    expect(await main(['demo', '--dir', dir], io)).toBe(2);
    expect(await main(['demo', '--port', 'abc'], io)).toBe(2);
  });
});
