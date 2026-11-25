import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { validateObjective } from '../src/check.js';
import { main } from '../src/cli.js';
import { STUB_KANE, bisectRepo, clearStubEnv, setStubPlan, tempDir } from './helpers.js';

afterEach(() => clearStubEnv());

describe('--objective', () => {
  it('validates a raw objective', () => {
    expect(validateObjective(`Go to http://127.0.0.1:4391/, read the page, store the page text as 'observed'`)).toEqual([]);
    expect(validateObjective('read the page')).toEqual([
      '--objective must start with "Go to http://" or "Go to https://"',
      "--objective must store the value as 'observed'",
    ]);
    expect(validateObjective(`Go to http://x/, store {{a}} as 'observed'`)).toEqual(['--objective must not contain {{']);
  });

  it('sends the raw objective to Kane unchanged', async () => {
    const repo = bisectRepo();
    const stub = setStubPlan(tempDir('firstbad-objective-'), { default: { scenario: 'fetch' } });
    const objective = `Go to http://127.0.0.1:4391/, read the page, store the page text as 'observed', then assert the stored observed value is "$18.00"`;
    const lines: string[] = [];
    const code = await main(
      ['hunt', '--repo', repo, '--good', 'v1', '--url', 'http://127.0.0.1:4391/', '--expect', '$18.00', '--serve', 'node server.mjs 4391', '--objective', objective, '--no-fix'],
      { print: (l) => lines.push(l), env: { ...process.env, FIRSTBAD_KANE: `"${process.execPath}" "${STUB_KANE}"` }, cwd: process.cwd(), color: false },
    );
    expect(code).toBe(0);
    const first = JSON.parse(fs.readFileSync(stub.log, 'utf8').trim().split('\n')[0] ?? '{}') as { argv: string[] };
    expect(first.argv[1]).toBe(objective);
  });
});
