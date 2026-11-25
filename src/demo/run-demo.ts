import type { AgentPromptRoute, TemplateId, VerdictMode } from '../kane-profile.js';
import { runFlow, type FlowResult } from '../run.js';
import { demoCheck, demoServeCommand, prepareDemoDir } from './demo-config.js';
import { generateDemoRepo } from './generate.js';
import { DEMO_GOOD_TAG } from './history.js';

export interface DemoOptions {
  dir: string;
  port: number;
  agentArgv: string[] | null;
  noFix: boolean;
  force: boolean;
  kaneCmd: string[];
  env: NodeJS.ProcessEnv;
  print: (line: string) => void;
  color: boolean;
  template?: TemplateId;
  verdictMode?: VerdictMode;
  promptRoute?: AgentPromptRoute;
}

export async function runDemo(o: DemoOptions): Promise<FlowResult> {
  const dirs = prepareDemoDir(o.dir, o.force);
  const demo = generateDemoRepo(dirs.shopDir);
  const check = demoCheck(o.port);
  o.print(`firstbad demo: generated the Corner Shop history (${demo.commits} commits, good ref ${demo.goodRef}, HEAD ${demo.head.slice(0, 7)}) in ${dirs.shopDir}`);
  o.print(`firstbad demo: the check: at ${check.url} ${check.do}, store ${check.store}, expect ${check.expected}`);
  return runFlow({
    repoDir: dirs.shopDir,
    good: DEMO_GOOD_TAG,
    bad: 'HEAD',
    check,
    serve: demoServeCommand(o.port),
    setup: null,
    agentArgv: o.agentArgv,
    noFix: o.noFix,
    outDir: dirs.reportDir,
    kaneCmd: o.kaneCmd,
    env: o.env,
    print: o.print,
    color: o.color,
    template: o.template,
    verdictMode: o.verdictMode,
    promptRoute: o.promptRoute,
  });
}
