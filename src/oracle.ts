import { revParse, subjectOf } from './git.js';
import { probe } from './probe.js';
import { appendLedger, readSession, type LedgerEntry } from './session.js';
import { exitCodeFor } from './verdict.js';

export const ORACLE_MARK = '@@firstbad ';

function crashEntry(reason: string): LedgerEntry {
  return {
    phase: 'bisect',
    label: 'oracle error',
    commit: '',
    subject: '',
    verdict: 'ABORT',
    reason,
    observed: null,
    kaneRuns: 0,
    creditsConsumed: null,
    testUrl: null,
    resultCode: null,
    durationMs: 0,
    at: new Date().toISOString(),
  };
}

// The git-bisect-run script body. Never throws and never returns 1 for a crash.
export async function runOracle(
  sessionPath: string,
  cwd: string,
  write: (line: string) => void = (line) => {
    process.stdout.write(`${line}\n`);
  },
): Promise<number> {
  try {
    const commit = await revParse(cwd, 'HEAD');
    const subject = await subjectOf(cwd, 'HEAD');
    const { entry } = await probe(sessionPath, { phase: 'bisect', label: 'bisect', cwd, commit, subject });
    write(ORACLE_MARK + JSON.stringify(entry));
    return exitCodeFor(entry.verdict);
  } catch (err) {
    const entry = crashEntry(`oracle crashed: ${err instanceof Error ? err.message : String(err)}`);
    try {
      appendLedger(readSession(sessionPath).ledgerPath, entry);
    } catch {
      // the session file is unreadable; the marker line still reaches the hunt
    }
    write(ORACLE_MARK + JSON.stringify(entry));
    return 128;
  }
}
