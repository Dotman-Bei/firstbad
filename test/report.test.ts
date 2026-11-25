import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FixResult } from '../src/fix.js';
import type { HuntResult } from '../src/hunt.js';
import { buildReport, formatTimelineLine, renderMarkdown, writeReport } from '../src/report.js';
import { findSecrets } from '../src/scrub.js';
import type { LedgerEntry } from '../src/session.js';
import { tempDir } from './helpers.js';

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  phase: 'bisect',
  label: 'bisect',
  commit: 'a'.repeat(40),
  subject: 'refactor(cart): extract price helpers',
  verdict: 'FAIL',
  reason: 'Expected "$18.00" but observed "$20.00"',
  observed: '$20.00',
  kaneRuns: 1,
  creditsConsumed: 15.2,
  testUrl: 'https://tm.example.invalid/t/1',
  resultCode: '720',
  durationMs: 1000,
  at: '2026-11-25T12:00:00.000Z',
  ...over,
});

const timeline: LedgerEntry[] = [
  entry({ phase: 'bracket', label: 'bad ref', commit: 'b'.repeat(40), subject: 'docs: x | y' }),
  entry({ phase: 'bracket', label: 'good ref', verdict: 'PASS', observed: '$18.00', reason: 'ok' }),
  entry({ verdict: 'SKIP', observed: null, kaneRuns: 0, creditsConsumed: null, testUrl: null, reason: 'page never loaded (server exited with code 1)' }),
  entry({ phase: 'fix', label: 'fix attempt 1', verdict: 'PASS', observed: '$18.00', reason: 'Authorization: Bearer abcdefgh12345678' }),
];

const huntResult: HuntResult = {
  status: 'confirmed',
  message: 'first bad commit: aaaaaaa refactor(cart): extract price helpers (confirmed: culprit FAIL, parent PASS)',
  culprit: { commit: 'a'.repeat(40), subject: 'refactor(cart): extract price helpers' },
  parent: 'c'.repeat(40),
  badValue: '$20.00',
  entries: timeline,
};

const fixResult: FixResult = {
  status: 'verified',
  route: 'agent',
  branch: 'firstbad/fix-aaaaaaa',
  attempts: 1,
  message: 'Kane passed the patched tree on attempt 1',
  entries: [],
};

const report = buildReport({
  check: { url: 'http://127.0.0.1:4173/', do: 'add the Tote bag', store: 'the total', expected: '$18.00' },
  refs: { good: 'v1.0', bad: 'HEAD' },
  hunt: huntResult,
  fix: fixResult,
  fixCommit: 'd'.repeat(40),
  timeline,
  runsUsed: 4,
  balanceBefore: 11178.5769,
  balanceAfter: 11100.0769,
  now: new Date('2026-11-25T12:00:00Z'),
});

describe('report', () => {
  it('is scrubbed and takes its cost from the balance delta', () => {
    expect(report.cost).toEqual({ kaneRuns: 4, creditsConsumed: 45.6, balanceBefore: 11178.5769, balanceAfter: 11100.0769, balanceDelta: 78.5 });
    expect(report.fix).toMatchObject({ status: 'verified', commit: 'd'.repeat(40), branch: 'firstbad/fix-aaaaaaa' });
    expect(findSecrets(JSON.stringify(report))).toEqual([]);
    expect(JSON.stringify(report)).toContain('Bearer [redacted]');
  });

  it('renders the markdown timeline with escaped cells and Kane links', () => {
    const md = renderMarkdown(report);
    expect(md.startsWith('# firstbad report')).toBe(true);
    expect(md).toContain('- **First bad commit:** `aaaaaaa` refactor(cart): extract price helpers (confirmed: culprit FAIL, parent PASS)');
    expect(md).toContain('| 1 | bracket | `bbbbbbb` | bad ref: docs: x \\| y | FAIL | $20.00 | 1 | 15.2 |');
    expect(md).toContain('## Kane Test Manager links');
    expect(md).toContain('the delta is the number to trust');
    expect(md).not.toContain('.evidence');
  });

  it('writes both files and formats terminal lines with and without color', () => {
    const paths = writeReport(tempDir('firstbad-report-'), report, 'report');
    expect(fs.readFileSync(paths.md, 'utf8').startsWith('# firstbad report')).toBe(true);
    expect(JSON.parse(fs.readFileSync(paths.json, 'utf8'))).toMatchObject({ tool: 'firstbad' });
    const plain = formatTimelineLine(timeline[2], false);
    expect(plain).toContain('SKIP');
    expect(plain).toContain('aaaaaaa');
    expect(plain).toContain('page never loaded');
    expect(plain).not.toContain('\u001b[');
    expect(formatTimelineLine(timeline[0], true)).toContain('\u001b[31mFAIL');
  });
});
