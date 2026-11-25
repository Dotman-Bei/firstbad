import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version.js';
import { KANE_PROFILE, TEMPLATE_IDS } from '../src/kane-profile.js';

describe('scaffold', () => {
  it('VERSION matches package.json, the default Kane profile is valid, and dist/ was built', () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(VERSION).toBe(pkg.version);
    expect(TEMPLATE_IDS).toEqual(['commas-assert', 'sentences-assert', 'store-only']);
    expect(TEMPLATE_IDS).toContain(KANE_PROFILE.template);
    expect(['status+value', 'value-only']).toContain(KANE_PROFILE.verdictMode);
    expect(['stdin', 'arg']).toContain(KANE_PROFILE.agentPromptRoute);
    expect(fs.existsSync(new URL('../dist/version.js', import.meta.url))).toBe(true);
    expect(fs.existsSync(new URL('../dist/kane-profile.js', import.meta.url))).toBe(true);
  });
});
