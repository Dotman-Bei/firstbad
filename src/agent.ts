import fs from 'node:fs';
import type { Check } from './check.js';
import type { AgentPromptRoute } from './kane-profile.js';
import { scrub } from './scrub.js';
import { execArgv, splitCommand } from './util/proc.js';

export const DEFAULT_AGENT = 'claude -p --permission-mode acceptEdits --allowedTools Read,Edit,Write,Glob,Grep';

export function parseAgent(value: string | undefined): string[] | null {
  if (value === undefined || value.trim() === '') return splitCommand(DEFAULT_AGENT);
  if (value.trim().toLowerCase() === 'none') return null;
  return splitCommand(value);
}

export interface AgentRun {
  ok: boolean;
  notFound: boolean;
  exitCode: number | null;
  timedOut: boolean;
  outputTail: string;
  durationMs: number;
}

export interface AgentRunOptions {
  cwd: string;
  promptFile: string;
  timeoutMs: number;
  route: AgentPromptRoute;
  env?: NodeJS.ProcessEnv;
}

// CLAUDECODE is removed so a nested `claude -p` runs when firstbad itself runs inside Claude Code.
export function agentEnv(base: NodeJS.ProcessEnv, promptFile: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  delete env.CLAUDECODE;
  env.FIRSTBAD_PROMPT_FILE = promptFile;
  return env;
}

export async function runAgent(argv: string[], prompt: string, o: AgentRunOptions): Promise<AgentRun> {
  fs.writeFileSync(o.promptFile, prompt);
  const full = o.route === 'arg' ? [...argv, prompt] : argv;
  const r = await execArgv(full, {
    cwd: o.cwd,
    env: agentEnv(o.env ?? process.env, o.promptFile),
    timeoutMs: o.timeoutMs,
    input: o.route === 'stdin' ? prompt : undefined,
  });
  return {
    ok: r.spawnError === null && !r.timedOut && r.code === 0,
    notFound: r.spawnError === 'ENOENT',
    exitCode: r.code,
    timedOut: r.timedOut,
    outputTail: scrub(`${r.stdout}\n${r.stderr}`.trim()).slice(-600),
    durationMs: r.durationMs,
  };
}

export interface FixPromptContext {
  check: Check;
  badValue: string;
  culprit: { commit: string; subject: string };
  parentValue: string | null;
  kaneSummary: string;
  culpritDiff: string;
  attempt: number;
  previousFailures: string[];
}

export function buildFixPrompt(c: FixPromptContext): string {
  const previous = c.previousFailures.length === 0 ? '- none' : c.previousFailures.map((f) => `- ${f}`).join('\n');
  return [
    'You are fixing a regression that firstbad found with git bisect and Kane CLI (a real-browser test).',
    '',
    '## The check',
    `- URL: ${c.check.url}`,
    `- Steps: ${c.check.do}`,
    `- Stored value: ${c.check.store}`,
    `- Expected value: ${c.check.expected}`,
    '',
    '## What Kane saw',
    `- On the current HEAD the stored value is ${c.badValue} instead of ${c.check.expected}.`,
    `- Kane's report: ${c.kaneSummary === '' ? '(no summary)' : c.kaneSummary}`,
    `- First bad commit: ${c.culprit.commit} (${c.culprit.subject})`,
    `- On its parent the check passes${c.parentValue === null ? '' : ` (stored ${c.parentValue})`}.`,
    '',
    '## The diff of the first bad commit (first 300 lines)',
    '',
    '```diff',
    c.culpritDiff,
    '```',
    '',
    '## Previous attempts',
    previous,
    '',
    `## Your task (attempt ${c.attempt})`,
    `Fix the code at the current HEAD so the check passes again: the stored value must be ${c.check.expected}.`,
    "- Make the smallest change that restores the behaviour, and keep the rest of the commit's intent.",
    '- Edit files only. Do not run git or any other command, and do not create commits.',
    '- Do not create or edit firstbad-report.md or firstbad-report.json.',
    'When you are done, reply with one sentence that describes the change.',
    '',
  ].join('\n');
}
