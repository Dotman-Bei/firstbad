#!/usr/bin/env node
// Stub coding agent for firstbad's tests. Reads the prompt from its arguments or stdin.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const env = process.env;
const argPrompt = process.argv.slice(2).join(' ');
let prompt = argPrompt;
let via = 'arg';
if (argPrompt === '') {
  via = 'stdin';
  try {
    prompt = fs.readFileSync(0, 'utf8');
  } catch {
    prompt = '';
  }
}
let call = 0;
if (env.STUB_AGENT_STATE) {
  try {
    call = JSON.parse(fs.readFileSync(env.STUB_AGENT_STATE, 'utf8')).calls ?? 0;
  } catch {
    call = 0;
  }
  fs.writeFileSync(env.STUB_AGENT_STATE, JSON.stringify({ calls: call + 1 }));
}
if (env.STUB_AGENT_LOG) {
  fs.appendFileSync(
    env.STUB_AGENT_LOG,
    JSON.stringify({
      via,
      call,
      cwd: process.cwd(),
      promptHasFirstBad: /First bad commit: [0-9a-f]{40}/.test(prompt),
      claudecode: env.CLAUDECODE ?? null,
      promptFile: env.FIRSTBAD_PROMPT_FILE ?? null,
    }) + '\n',
  );
}

function main() {
  if (env.STUB_AGENT_NOOP_FIRST === '1' && call === 0) {
    console.log('stub-agent: no change on the first attempt');
    return 0;
  }
  const mode = env.STUB_AGENT_MODE ?? 'noop';
  const file = env.STUB_AGENT_FILE ?? 'value.txt';
  if (mode === 'write') {
    fs.writeFileSync(path.resolve(file), env.STUB_AGENT_CONTENT ?? '');
    console.log(`stub-agent: wrote ${file}`);
    return 0;
  }
  if (mode === 'restore-from-parent') {
    const m = /First bad commit: ([0-9a-f]{40})/.exec(prompt);
    if (m === null) {
      console.log('stub-agent: no culprit in the prompt');
      return 1;
    }
    const content = execFileSync('git', ['show', `${m[1]}^:${file}`], { encoding: 'utf8' });
    fs.writeFileSync(path.resolve(file), content);
    console.log(`stub-agent: restored ${file} from the culprit's parent`);
    return 0;
  }
  if (mode === 'fail') {
    console.log('stub-agent: failing on purpose');
    return 1;
  }
  console.log('stub-agent: no change');
  return 0;
}

process.exitCode = main();
