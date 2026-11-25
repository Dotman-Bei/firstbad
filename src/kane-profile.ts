// Written by the day-1 spike (scripts/spike/run-spike.mjs). Core code reads only KANE_PROFILE.
export type TemplateId = 'commas-assert' | 'sentences-assert' | 'store-only';
export type VerdictMode = 'status+value' | 'value-only';
export type AgentPromptRoute = 'stdin' | 'arg';

export interface KaneProfile {
  template: TemplateId;
  verdictMode: VerdictMode;
  agentPromptRoute: AgentPromptRoute;
  source: string;
}

export const TEMPLATE_IDS: readonly TemplateId[] = ['commas-assert', 'sentences-assert', 'store-only'];

export const KANE_PROFILE: KaneProfile = {
  template: 'commas-assert',
  verdictMode: 'status+value',
  agentPromptRoute: 'stdin',
  source: 'day-1 spike 2026-11-25',
};
