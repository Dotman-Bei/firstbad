# Submission draft: KaneCLI Online Hackathon (TestMu AI)

> Pre-filled by the architect (Step 1), 2026-11-25. **Reshaped by the Step-3 closing pass on 2026-11-26 to the live form**
> at https://www.kaneclihack.sh/o/submit (labels and limits read logged in at 10:31 UTC; the diff is in
> `docs/gates/2026-11-26-gate-ledger.md`). Each fenced block is pasted as-is into the form field named in its heading.
> Deadline: 2026-11-26 23:59 IST = 18:29 UTC ("No pushes after this"). Internal target: filed by 15:00 UTC.

## 01 Your project

### Project name (required, max 80)

```text
firstbad
```

### One-liner (required, max 170)

```text
git bisect with a real-browser oracle: Kane CLI tests each commit, names the first bad one, and proves your agent's fix.
```

### Project details (required, max 1500)

```text
firstbad finds the commit that broke a user flow and gets it fixed. It is for teams whose coding agents land many small commits that nobody clicked through. You describe one check in plain English (what to do on the page, which value to store, what it should be), give a known-good ref and say how to serve your app. firstbad proves the check fails on the bad ref and passes on the good one, then drives git bisect run with Kane CLI as the oracle: one serialized, headless, time-limited Kane run per commit, in a disposable git worktree so your checkout is never touched. Commits that fail for a different reason (no build, no page, a different value) are skipped, not blamed, and the first bad commit is confirmed against its parent.

Which agent: Claude Code CLI in headless mode (claude -p, limited to file-editing tools); the agent command is pluggable. Kane's failing result and the culprit's diff are its brief, the patch goes back to Kane, and only a Kane pass is committed, on a new local branch with the report.

What Kane does: Kane is the referee at every step. Its stored value and verdict decide each bisect step with no human or LLM in between; it names the first bad commit, re-tests it and its parent, and proves the fix. firstbad cross-checks Kane's stored value against its verdict, so a false pass is caught instead of misleading the bisect.
```

### Anything else to add (optional, max 4000)

```text
How to run it: npm install -g @testmuai/kane-cli, kane-cli login --oauth, then clone the repo, npm ci, npm run build, node dist/cli.js demo. The demo generates a deterministic 40-commit shop history (the same SHAs on every machine) with one planted checkout regression and one unrelated broken stretch, then runs hunt, confirm, fix and proof end to end. Judges use their own TestMu AI login for Kane (kane-cli 0.10.9 or later, about a dozen runs per hunt). No Claude Code? node dist/cli.js demo --agent none reverts the culprit and proves the revert with Kane. Fallback if Kane cannot run: the committed recorded live run in docs/demo/recorded-run/ (report and full terminal transcript, scrubbed; no evidence packs).

What Kane caught in the recorded live run (25 Nov 2026): the bad ref stored $20.00 and failed, the good ref stored $18.00 and passed. Three commits were skipped because the page never loaded (0 Kane runs, 0 credits). Six bisect verdicts narrowed it to fc2879c "refactor(cart): extract price helpers", confirmed with the culprit FAIL ($20.00) and its parent PASS ($18.00). Claude Code's fix passed Kane on attempt 1 and was committed on branch firstbad/fix-fc2879c. 11 Kane runs, 188.77 credits as reported by Kane, 200.53 by the balance change. Every run links to its Kane Test Manager share page in the report. Whole project: 22 live Kane runs, 369.61 credits by balance.

How the agent and Kane talk: firstbad writes the Kane objective itself (store the value first, compare it in code), reads Kane's run_end line from --agent NDJSON and the stored value, and maps each run to git bisect's exit codes (0 good, 1 bad, 125 skip, 128 abort). The agent never decides pass or fail; Kane's verdict on the patched tree does.

Category: 02 WORKFLOW "Workflows with a spine" (the page's own "git bisect on autopilot" idea), with an agent loop driven only by Kane's verdicts.

Tech stack: TypeScript (strict, ESM) on Node.js 20+, git bisect run, Kane CLI 0.10.9 (--agent NDJSON run_end), Claude Code CLI (headless), cross-spawn, Vitest. Zero-dependency demo shop on node:http.

What's next: a raw --objective escape hatch for checks that do not fit store-and-compare, cheaper re-verification by replaying Kane's recorded test where replays prove faithful, and a GitHub Action that runs a hunt when a flow check starts failing.
```

### Agent used (required, max 80)

```text
Claude Code CLI (headless claude -p); the agent command is pluggable
```

### Attachments (optional)

None.

## 02 Show it

### YouTube demo video (required)

```text
https://youtu.be/YJ_J-Str4K4
```

### GitHub URL (required, must be public)

```text
https://github.com/Dotman-Bei/firstbad
```

Public since 2026-11-26; re-verified logged out at 10:31 UTC (repo page and raw README return 200). First commit 2026-11-25.

### Live URL (optional)

Left empty: firstbad is a command-line tool with no deployment. The README Quickstart and the recorded run stand in for it.

## 03 Launch buzz (required: at least 2 different public posts)

Fields: X posts, LinkedIn posts, Hacker News posts, Reddit posts (each takes several links, comma-separated), Posts anywhere else (max 1500).
The post links are pasted into the form only and are **never committed** to this repo.

## Sources for every claim above

| Claim | Source |
|---|---|
| Kane objective, skip rule, confirm, exit-code mapping, false-pass cross-check, worktree | README "How it works"; `src/oracle.ts`, `src/verdict.ts`, `src/kane/ndjson.ts` (`run_end`), `src/cli.ts` (exit codes), `src/hunt.ts` |
| Agent `claude -p` with Read, Edit, Write, Glob, Grep | `src/agent.ts` (`DEFAULT_AGENT`) |
| Fix branch `firstbad/fix-<sha>` | `src/fix.ts` |
| kane-cli 0.10.9 or later | `src/hunt.ts` (`MIN_KANE_VERSION`) |
| Recorded run values, skips, culprit, fix, 11 runs, 188.77 and 200.53 credits | `docs/demo/recorded-run/report.md` (§Timeline, §Cost), `report.json` (`cost`) |
| Whole project: 22 runs, 11152.22 → 10782.61 = 369.61 credits | runsheet `docs/guide/2026-11-25-kane-cli-hackathon-runsheet.md`, Step 2 row (the orchestrator's figures) |
| Demo video | `docs/demo/2026-11-26-demo-script.md` §7 and the runsheet "video final" note |
| Category | `docs/idea-forge/2026-11-25-firstbad-brief.md`, runsheet |
| Next steps | README "Roadmap" |

## Eligibility checklist (user-side, not form fields)

- Same email on kaneclihack.sh and TestMu AI, 10,000 credits claimed, Kane CLI actually run: done (tollgate row 19).
- Team created on kaneclihack.sh (solo): done; the form shows step 4 of 4.
- Repo public at submission: done (see 02).
