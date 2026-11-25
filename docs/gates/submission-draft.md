# Submission draft: KaneCLI Online Hackathon (TestMu AI)

> Pre-filled by the architect (Step 1), 2026-11-25. Form: https://www.kaneclihack.sh/o/submit (unlocks once the team exists).
> Field set from `docs/resources/2026-11-25-kane-cli-hackathon/event.md` ("Five things, One form."). The real input labels were
> hidden at extraction time; re-check them when the team step is done. Lines starting `TBD-post-build:` are filled after the
> build: demo-studio (Step 2.5) fills the video URL, and the Step-3 closing pass fills the rest and pastes this into the form.
> Deadline: 2026-11-26 23:59 IST = 18:29 UTC = 19:29 WAT ("No pushes after this"). Internal target: filed by 15:00 UTC.

## Project

- **Name:** firstbad
- **One-liner:** git bisect with a real-browser oracle: Kane CLI checks each commit against a plain-English test, names the first bad commit, and re-verifies your coding agent's fix until it passes.
- **Category (starting point, single prize pool):** 02 WORKFLOW "Workflows with a spine" (the page's own "Git bisect on autopilot: find the commit that broke the flow"), with an agent loop driven only by Kane's verdicts. 01 WEB is only the verified surface.
- **Team:** solo (Dotman-Bei), building with an AI pipeline.

## 01 GitHub URL ("Your repo, started on or after 12 Nov.")

https://github.com/Dotman-Bei/firstbad (first commit 2026-11-25)
TBD-post-build:repo-public-flip

## 02 About your app ("What you built, which agent, what Kane does.")

**What we built.** firstbad is a CLI that finds the commit that broke a user flow and gets it fixed. You describe one check in plain English (what to do on the page, which value to store, what it should be), give a known-good ref and say how to serve your app. firstbad proves the check fails on the bad ref and passes on the good one, then drives `git bisect run` with Kane CLI as the oracle: one serialized, headless, time-limited Kane run per commit, inside a disposable git worktree so your checkout is never touched. Commits that fail for a different reason (no build, the page never loads, a different value) are skipped, not blamed. The first bad commit is confirmed against its parent.

**Which agent.** Claude Code CLI in headless mode (`claude -p`, limited to file-editing tools) by default; the agent command is pluggable. Kane's failing result and the culprit's diff are the agent's brief, the patch goes back to Kane, and only a Kane pass is committed (on a new local branch, together with the hunt report). With no agent, firstbad reverts the culprit and proves the revert with Kane.

**What Kane does.** Kane is the referee at every step: its stored value and verdict decide each bisect step with no human or LLM in between, it names the first bad commit, re-tests it and its parent, and proves the fix. firstbad cross-checks Kane's stored value against its claim, so a false pass is caught instead of misleading the bisect.

**Try it.** `node dist/cli.js demo` generates a deterministic 40-commit shop history (same SHAs on every machine) with one planted checkout regression and one unrelated broken stretch, then runs hunt, confirm, fix and proof end to end. Judges use their own TestMu AI login for Kane (kane-cli 0.10.9+, about a dozen runs per hunt). Fallback if Kane cannot run: the committed recorded run in `docs/demo/recorded-run/` (report and full transcript, scrubbed; no evidence packs).

Kane runs in this demo: TBD-post-build:recorded-run-kane-runs-and-credits

## 03 Demo video ("Hosted on YouTube. About 3 to 5 minutes.")

TBD-post-build:demo-video-url

## 04 Live URL ("If your project is deployed. Optional.")

None: firstbad is a command-line tool with no deployment. The README Quickstart and the recorded run stand in for a live link.

## 05 Launch buzz (REQUIRED: at least two public posts on Hacker News, X, Reddit or LinkedIn)

TBD-post-build:launch-post-1-url
TBD-post-build:launch-post-2-url

## Tech stack (for the form's free-text fields, if any)

TypeScript (strict, ESM) on Node.js 20+, git bisect run, Kane CLI 0.10.9 (`--agent` NDJSON `run_end` contract), Claude Code CLI 2.1.229 (headless), cross-spawn, Vitest. Zero-dependency demo shop on `node:http`.

## Eligibility checklist (user-side, not form fields)

- Same email on kaneclihack.sh and TestMu AI, 10,000 credits claimed, Kane CLI actually run: done (tollgate row 19).
- Team created on kaneclihack.sh (solo is fine) so the submit form unlocks: pending, a user action before Step 3.
- Repo public at submission (consent-gated Step-3 flip): see 01.
