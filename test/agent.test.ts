import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_AGENT, agentEnv, buildFixPrompt, parseAgent, runAgent } from '../src/agent.js';
import { STUB_AGENT, clearStubEnv, tempDir } from './helpers.js';

afterEach(() => {
  clearStubEnv();
  delete process.env.CLAUDECODE;
});

describe('agent adapter', () => {
  it('parses the --agent option', () => {
    expect(parseAgent(undefined)).toEqual(['claude', '-p', '--permission-mode', 'acceptEdits', '--allowedTools', 'Read,Edit,Write,Glob,Grep']);
    expect(parseAgent('none')).toBeNull();
    expect(parseAgent(' NONE ')).toBeNull();
    expect(parseAgent('codex exec --full-auto')).toEqual(['codex', 'exec', '--full-auto']);
    expect(DEFAULT_AGENT).toContain('--allowedTools Read,Edit,Write,Glob,Grep');
  });

  it('removes CLAUDECODE and names the prompt file', () => {
    const env = agentEnv({ CLAUDECODE: '1', PATH: 'x' }, '/tmp/p.md');
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.FIRSTBAD_PROMPT_FILE).toBe('/tmp/p.md');
    expect(env.PATH).toBe('x');
  });

  it('builds a prompt with the culprit line, the diff and earlier failures', () => {
    const p = buildFixPrompt({
      check: { url: 'http://127.0.0.1:4173/', do: 'add things', store: 'the total', expected: '$18.00' },
      badValue: '$20.00',
      culprit: { commit: 'a'.repeat(40), subject: 'refactor(cart): extract price helpers' },
      parentValue: '$18.00',
      kaneSummary: 'Expected "$18.00" but observed "$20.00"',
      culpritDiff: '-old\n+new',
      attempt: 2,
      previousFailures: ['attempt 1: the agent made no change'],
    });
    expect(p).toContain(`First bad commit: ${'a'.repeat(40)} (refactor(cart): extract price helpers)`);
    expect(p).toContain('```diff\n-old\n+new\n```');
    expect(p).toContain('- attempt 1: the agent made no change');
    expect(p).toContain('## Your task (attempt 2)');
    expect(p).toContain('Do not run git');
  });

  it('runs the agent with the prompt on stdin or as an argument, without CLAUDECODE', async () => {
    const dir = tempDir('firstbad-agent-');
    const logPath = path.join(dir, 'agent-log.jsonl');
    process.env.STUB_AGENT_MODE = 'write';
    process.env.STUB_AGENT_FILE = 'out.txt';
    process.env.STUB_AGENT_CONTENT = 'patched';
    process.env.STUB_AGENT_LOG = logPath;
    process.env.CLAUDECODE = '1';
    const viaStdin = await runAgent([process.execPath, STUB_AGENT], `First bad commit: ${'b'.repeat(40)} (x)`, {
      cwd: dir,
      promptFile: path.join(dir, 'prompt-1.md'),
      timeoutMs: 30_000,
      route: 'stdin',
    });
    expect(viaStdin.ok).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'out.txt'), 'utf8')).toBe('patched');
    expect(fs.readFileSync(path.join(dir, 'prompt-1.md'), 'utf8')).toContain('First bad commit');
    const viaArg = await runAgent([process.execPath, STUB_AGENT], `First bad commit: ${'c'.repeat(40)} (y)`, {
      cwd: dir,
      promptFile: path.join(dir, 'prompt-2.md'),
      timeoutMs: 30_000,
      route: 'arg',
    });
    expect(viaArg.ok).toBe(true);
    const logged = fs
      .readFileSync(logPath, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { via: string; promptHasFirstBad: boolean; claudecode: string | null });
    expect(logged.map((l) => l.via)).toEqual(['stdin', 'arg']);
    expect(logged.every((l) => l.promptHasFirstBad && l.claudecode === null)).toBe(true);
    const missing = await runAgent(['firstbad-no-such-agent-xyz'], 'x', {
      cwd: dir,
      promptFile: path.join(dir, 'prompt-3.md'),
      timeoutMs: 30_000,
      route: 'stdin',
    });
    expect(missing.notFound).toBe(true);
  });
});
