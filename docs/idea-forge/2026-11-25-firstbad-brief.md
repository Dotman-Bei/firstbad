# Idea Forge Brief — firstbad: git bisect with a real-browser oracle

> Step 0 output (idea-forge). This brief is the single source of truth handed to the architect
> (Step 1). It fixes *what* and *why*, not *how*. The name comes from the line git prints when a
> bisect ends ("… is the first bad commit"). It is deliberately not confusable with the Kane CLI,
> KaneAI or TestMu AI marks (T&Cs §9). The project repo was renamed to `firstbad` when this brief
> landed.

## Event + constraints

- **Date written:** 2026-11-25, 11:27 UTC (31 h before the deadline).
- **Hackathon:** KaneCLI Online Hackathon by TestMu AI. https://www.kaneclihack.sh/ (rules, judging
  and submission are all on that page). Resource pack: `docs/resources/2026-11-25-kane-cli-hackathon/`.
  Tollgate: `docs/tollgate/2026-11-25-tollgate.md`.
- **Hard deadline:** **2026-11-26 23:59 IST = 18:29 UTC = 19:29 WAT**. The page says "No pushes after
  this." The runsheet's internal target is the submission filed by 2026-11-26 15:00 UTC. Calendar fit
  is the guide's call; the must-have list below is sized for one build session, not a multi-day build.
- **Team:** solo builder plus the autonomous pipeline (architect → executor pool → reviewer).
- **Skills in play:** TypeScript/React. Python/ML is not needed, and the event has no web3.
- **Risk posture:** `safe-feasible`. The novelty is in *what* Kane verifies (history: which commit
  broke a user flow) and in how tight the loop is, not in infrastructure.
- **Platform:** web only. The build machine is Windows 10 x64; local iOS/Android needs macOS Apple
  Silicon, and the cloud grid and real devices need paid plans. Judges' machines are unknown, so the
  tool must also run on macOS and Linux.
- **Submission ("Five things, One form"):** a public GitHub repo initialised on or after 12 Nov ·
  "About your app" (what you built, which agent, what Kane does) · a YouTube demo of about 3–5 min ·
  a live URL (optional) · at least two public posts (Hacker News, X, Reddit or LinkedIn). Judges must
  be able to run it: "Hand over working credentials for any login or paid service, and include a
  fallback (a recorded run or backup deploy) for third-party services."

## Problem

When a user flow breaks ("the checkout total is wrong"), the fix is usually a few lines, but finding
the commit that broke it is a manual `git bisect`: check out, rebuild, click through the flow, decide
good or bad, repeat. Unit tests rarely cover the integrated flow. Coding agents widen the gap: they
land many small commits fast, so "it worked last week" now spans dozens of commits that nobody clicked
through.

## Solution (one line)

git bisect with a real-browser oracle: Kane CLI checks each commit against a plain-English test, names
the first bad commit, and re-verifies your coding agent's fix until it passes.

## Must-have demo features (the minimum that makes the money shot land)

1. **Kane-oracle bisect.** Inputs: one plain-English check that ends in a terminal assertion and
   stores the observed value ("… store the cart total as 'cart_total' and verify it shows $18.00"),
   a known-good ref, and the app's setup and serve commands. It first proves the check **fails on the
   bad ref and passes on the good ref**. Then it drives `git bisect run` with Kane as the oracle: one
   serialized, headless, time-limited Kane run per commit, whose exit code and `run_end` map to good
   (0), bad (1) or skip (125). A commit that fails **for a different reason** than the bad ref is
   **skipped, not blamed**: it doesn't build, the page never loads, Kane errors or times out after one
   retry, or the observed value or failure differs. It ends by re-testing the first bad commit and its
   parent, and prints each tested commit's Kane verdict (commit, PASS/FAIL/SKIP, Kane's one-line
   reason).
2. **Agent fix, proven by Kane.** The culprit's diff, the failing `run_end` (`summary`, `reason`,
   `final_state`) and the check go to the user's coding agent. The default agent is the Claude Code
   CLI in headless mode; the agent command is pluggable. The agent patches the current HEAD on a new
   branch, and Kane re-runs the same check on the patched tree. A failing `run_end` goes straight back
   to the agent, for a bounded number of attempts; a pass commits the fix together with the hunt
   report. If no agent is available, the tool reverts the culprit and proves the revert with Kane.
3. **One-command reproducible demo, with a report that's safe to commit.** A `demo` command generates
   a deterministic local git history (about 40 commits) of a tiny zero-dependency web shop. The
   history holds one planted checkout regression and one unrelated broken commit, so the skip path is
   visible. The command then runs the hunt and the fix end to end. Every hunt writes a report
   (commit, verdict, reason, observed value, `credits_consumed`, `test_url`) and **never** an
   `.evidence` pack. Judges run this command; the recorded run is the fallback.

**Cost rule (applies to all three):** a hunt over N commits costs about log₂(N) bisect runs plus a
handful of bracket, confirm and fix runs, so roughly a dozen Kane runs for 40 commits. Each check run
is recorded with `--name`. Re-verification can then replay the saved `_test.md` at no LLM cost,
wherever the day-1 spike shows replays are faithful (see the open `testmd` false-pass issues below).
Check `kane-cli balance` before a hunt, because the CLI does not stop at 0 credits (#174).

## Target sponsor track(s)

- **The event has no prize tracks or sponsor bounties; it is one pool.** The starting-point category
  is **02 WORKFLOW "Workflows with a spine"**. "Git bisect on autopilot: find the commit that broke the
  flow" is that category's own listed example, and no entrant in the pack's 29-repo sample builds it.
- **03 AGENT side:** the agent acts only on Kane's verdicts. Kane's failure is its brief, and its
  patch isn't accepted until Kane passes it. **01 WEB** is only the surface being verified (the demo
  shop).
- The kickoff ranked 03 first. The rubric picked this 02 idea because every scored 03 candidate either
  proved something shallow (Wikipedia speedrun, dark-pattern gauntlet) or depended, on its critical
  path, on Kane DevTools behaviour that is still unverified on Windows (the consent verifier).

## Judging criteria (published)

The entries are scored by three TestMu AI engineers. The **gate comes first** ("READY TO SHIP
MEANS"): "It works end to end" · "Kane CLI caught or proved something" · "Your agent and Kane CLI
talked to each other". "Miss a bar and the judges can't score the rest." Then come **four dimensions,
weighted equally at 25%**:

- **Ships:** "A real flow that runs end to end. Not slides."
- **Verified:** "Kane CLI caught or confirmed something meaningful."
- **Closed loop:** "Kane's result feeds back to the agent. Tighter is better."
- **Craft:** "Would a developer want to install this tonight?"

"Scores are averaged. Ties break on Verified, then Closed loop." Launch buzz (at least two public
posts) is required, and reach earns an unweighted bonus.

| Bar / dimension | Where firstbad shows it |
|---|---|
| Works end to end · Ships | `demo` runs hunt → fix → proof on a freshly generated repo, on any machine with Kane CLI and Chrome |
| Kane caught or proved something · Verified | Kane fails HEAD, passes the good ref, names the first bad commit (re-tested with its parent), then proves the fix |
| Agent and Kane talked · Closed loop | Kane's exit code drives every bisect step with no human in between. Kane's failing `run_end` is the agent's input, and the agent's patch goes back to Kane until it passes |
| Craft | one command against your own repo with a plain-English check: "git bisect, decided by a real browser" |

## Why it wins

Unlike the saturated Kane gates and repro→fix loops in the pack's sample (`Shine-5705/proofline`,
`rohanjain1648/zenloop`, `Alvinagustus/bugboing`, `Manas-Sehgxl/fixpoint`, `PhiBao/reenact`,
`vijaygopalbalasa/proven`), which verify the current tree or one before/after pair, firstbad points
Kane at **history**. Kane's exit code *is* git bisect's oracle, so Kane names the commit that broke a
user flow; this is the page's own "git bisect on autopilot" idea, and no entrant in the sample builds
it. Against those entries, firstbad wins the two tie-break dimensions and ties at worst on Ships and
Craft:

- **Verified:** Kane establishes a causal fact (the first bad commit, re-tested with its parent) and
  then proves the fix.
- **Closed loop:** every Kane verdict advances the search with no human or LLM step in between, and
  the failing `run_end` drives the agent's patch until Kane passes it.

*Caveat:* the sample covers only repos with "kane-cli" in their name or description, and bisect is a
listed page idea, so an unseen duplicate is possible. The edge that has to show in the demo is the
skip rule for commits that fail differently, the culprit confirmation, and the Kane-proven fix.

## Demo money shot (~15 seconds)

One command on a 40-commit shop history. Kane fails HEAD ("total shows $20.00, expected $18.00") and
passes the release tag. Then the timeline narrows: FAIL · PASS · **SKIP** ("page never loaded — not
this bug") · PASS · FAIL · PASS → **"first bad commit: `refactor(cart): extract price helpers`"**,
confirmed by re-testing it and its parent. The agent reads the diff, moves the discount before the
rounding, and Kane turns green at **$18.00**. About a dozen Kane runs, zero human clicks. *(The commit
message, values and count are illustrative; the fixture defines the real ones.)*

## Out of scope (explicit)

- Mobile (iOS/Android emulators, real devices) and `--remote` grid runs.
- Any product web UI or dashboard. Output is the terminal plus a Markdown/JSON report; the demo shop
  is a deliberately plain fixture, not a product surface.
- A GitHub Action, PR bot or CI integration (a stretch goal only after everything is green).
- Multi-check suites, `testrun`, `--policy` verdicts, the `cover`/assurance commands and
  `kane-cli bugs` memory. None of them is on the critical path. `--bug-detection` (`result_code`
  "740") is an optional extra signal for telling failures apart, not a dependency.
- Parallel bisect or concurrent Kane runs (Windows issues #237 and #242: serialize).
- Autonomous exploratory bug discovery from a vague complaint. The agent may *draft* the check from
  a symptom, but Kane must still confirm that it fails on HEAD.
- Opening PRs or pushing to remotes. The fix stays on a local branch and commit.
- Monorepo or build-cache optimisation beyond a user-supplied setup command; non-git version control.
- Committing or uploading `.evidence` packs or HAR files anywhere public; an MCP server.

## Feasibility notes for the architect (primitives, not design)

These are transcribed from `docs/resources/2026-11-25-kane-cli-hackathon/sponsors/kane-cli.md`
(fetched 2026-11-25 against kane-cli 0.10.9) unless marked otherwise. That file is the full source.

### Kane CLI: install, auth, verify

```bash
npm install -g @testmuai/kane-cli          # Node >= 18. Windows x64 is a supported platform.
kane-cli --version                          # expect 0.10.9+
kane-cli login --oauth                      # local: opens browser consent, stores tokens
kane-cli whoami                             # identity card: profile, env, auth method, token valid/expired/missing
kane-cli balance                            # available credits only
npx @testmuai/kane-cli-skill                # installs the official skill for Claude Code, Codex CLI, Gemini CLI
```

- **pnpm is unsupported**: the runner binary isn't found, giving a silent exit 2 (issue #24).
  **Pin ≥ 0.10.9**, which fixed DevTools queries on Windows.
- **Chrome is required** on the machine. Env knobs: `KANE_CLI_CHROME_PATH`,
  `KANE_CLI_CDP_TIMEOUT_MS` (default 30000), `KANE_CLI_CDP_RETRIES` (default 2).
- Non-interactive auth: `--username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY"` on each command,
  or persist it with `kane-cli login --username … --access-key …`. Never call `kane-cli login` in CI
  (OAuth needs a browser). Credentials are stored at
  `~/.testmuai/kaneai/profiles/<profile>/<env>/credentials`. **Never put the access key in chat, the
  repo or a report. Use env-var names only.**
- Tag every call with `KANE_CLI_USER_AGENT=<runtime>`. PowerShell form:
  `$env:KANE_CLI_USER_AGENT='claude-code'; kane-cli run "…" --agent`.

### Kane CLI: one run (the oracle's primitive)

```bash
kane-cli run "Go to https://example.com and assert the page title contains 'Example'" --agent --headless --timeout 120
```

- The `run` subcommand is mandatory: `kane-cli "<objective>"` exits 2. **A start URL is mandatory in
  non-TTY:** start the objective with "Go to http…", pass `--url`, or set `kane-cli config set-url`.
- Flags: `--headless` · `--max-steps <n>` (default 50) · `--timeout <s>` (**no default, so always pass
  it**) · `--url` · `--variables-file <path>` / `{{name}}` · `--name <slug>` (records the run as
  `.testmuai/tests/<slug>_test.md`) · `--bug-detection off|stop|continue` ·
  `--assertion-mode dom|visual` · `--final-validation on|off` · `--code-language python|javascript`.
- **Objective rules:** (1) end every flow in a terminal assertion, and assert the outcome, not the
  trigger; (2) use "store as" to extract values, which come back in `run_end.final_state` ("read" and
  "tell me" don't reliably capture anything); (3) one objective is one task, so split anything over
  about 15 steps.
- **Exit codes (`run`):** `0` passed · `1` failed (an unrecoverable failure, **or upload failed**) ·
  `2` error (auth, TMS credential exchange, config, Chrome, unknown subcommand, unhandled exception) ·
  `3` cancelled or hit `--timeout`. `testmd` and `testrun` differ, and on assurance/context-sync
  commands run with `--mode agent`, exit 3 means *paused*.
- **NDJSON on stdout under `--agent`** (the progress UI goes to stderr), with `v: 1` and `ts` on every
  line. The first line is
  `{"type":"stream_start","cli_version":…,"surface":"run"|"testmd"|"testrun"|"explore",…}`. **Prose
  on the first line means terminal mode, which never exits:** kill it and re-run with `--agent` or a
  stdin redirect. Progress lines are untyped:
  `{"step":n,"status":"running"|"done"|"failed","remark":"…"}`. Typed events include `error`,
  `warning` (`code:"unresolved_variables"`, which doesn't change the exit code), `ask_user`,
  `bifurcation`, `project_folder_auto_defaulted` and `update_available`.
- **The terminal event is `run_end`.** Fields: `status` (`passed`/`failed`), `summary`, `one_liner`,
  `reason`, `duration`, `credits_consumed` (older builds call it `credits`), `final_state` (the stored
  values), `context`, `session_dir`, `test_url` (a Test Manager link), `result_code`. With
  `--bug-detection`, a confirmed product bug arrives as `result_code: "740"` plus a `verdict` object
  (`confirmed, family, category, severity, one_liner, confidence`).
- **Early refusals can end with an `error` and no `run_end`, so the exit code is authoritative when no
  `run_end` arrived.** The stream is also written to `<session_dir>/events.ndjson`. The evidence path
  is printed on **stderr** (`evidence: view locally with kane-cli evidence serve <path>`). Packs live
  in `.testmuai/evidence/*.evidence`; failing-step screenshots come out with
  `unzip <pack> "tests/*/steps/*/screenshot.png"`.
- The pack's minimal parser: skip non-JSON lines and ignore unknown types and fields. On `run_end`,
  the verdict is `status`, the why is `summary`/`reason`, the values are `final_state`, and a bug is
  `result_code=="740"`. Lines with `"step"` are progress only.
- **Uploads:** every run is saved as a Test Manager test case in an auto-defaulted project/folder
  (the `project_folder_auto_defaulted` event; pin it with `kane-cli config project|folder <id>`).
  **"Upload failed" exits 1 even when the flow passed**; tell the two apart with `run_end.status` and
  `reason`.

### Kane CLI: cheap re-verification and credits

- "Saved tests replay cheaply: `testmd` steps replay from a recording with no LLM cost and in seconds.
  Editing step N re-authors steps N onward. `kane-cli run "<objective>" --name <slug>` records a
  one-off as a `_test.md`." `testmd run` ends with `test_md_done`
  (`overall_status, duration_s, session_id, share_url?`); an intermediate `run_end` there does **not**
  finish the test. A designed test's first run "uses more credits than later runs".
- **Credits:** 10,000 free per new TestMu AI account, valid for one month; ask for more by Slack DM
  before the deadline. There is no price table: the docs' examples show `11.9` credits for a short run
  and "58 credits" for a 12-step run. **Measure `credits_consumed` on the first real runs.** Use
  `kane-cli balance` to check, because the CLI does not block at 0 credits (#174).

### Kane CLI: live gotchas that touch this build

- **False passes:** #239 (an assert marked passed although the stored value contradicted it), #254 (a
  text check on a counter rebuilds the label, so "1 items left" passes), #250 (a `testmd` heading-only
  step is never executed, yet the run passes), #252 (`testmd` "Reload the page" sends Ctrl+R, which
  never reloads), #253 (`testmd` "Open the page" can read the KaneAI Playground page instead of
  `--url`). The pack's mitigation: assert concrete outcomes with "store as" plus an explicit compare,
  and cross-check `final_state` against the claim.
- **Windows:** #237 (`testrun --parallel` gives "Chrome CDP not ready": avoid `--parallel` or raise
  `KANE_CLI_CDP_TIMEOUT_MS`) and #236 (`[lock] heartbeat failed` during suites). `testrun run` needs
  non-TTY stdin: `cmd /c "kane-cli testrun run … < NUL"` from PowerShell, `< /dev/null` in Git Bash.
- **#242: two runs started at the same moment write each other's traffic into their evidence packs,
  so serialize runs.** Bisect is serial by construction.
- **#207: `testmd run` can hang on a login page and `--timeout` doesn't stop it, so add an outer kill
  timer.** #211: network failures crash as `TypeError: fetch failed` and hide the cause.
- **#247: evidence HARs keep bearer tokens, and since 0.10.2 packs are sealed without redaction. Treat
  `.evidence` files as secrets and never commit them to the public repo.**

### git bisect run (verbatim, from the local Git for Windows 2.54.0 docs, `git-doc/git-bisect.html`)

> "the script … should exit with code 0 if the current source code is good/old, and exit with a code
> between 1 and 127 (inclusive), except 125, if the current source code is bad/new. Any other exit
> code will abort the bisect process. … The special exit code 125 should be used when the current
> source code cannot be tested. If the script exits with this code, the current revision will be
> skipped."

- A consequence (fact, not design): Node exits with **1** on an uncaught exception, and
  `git bisect run` reads that as **bad**. An oracle crash must never reach git as exit code 1.
- `git bisect run` checks each commit out into the working tree. Uncommitted changes and untracked
  files persist across those checkouts, including Kane's `.testmuai/` output (the pack gives its paths
  as relative).

### Machine and agent runtime (probed 2026-11-25)

- Windows 10 Home x64 (10.0.21996), PowerShell 5.1 + Git Bash · Node v22.23.4 · npm 10.9.9 ·
  git 2.54.0.windows.1 · Python 3.12 (not needed).
- **Agent:** Claude Code CLI **2.1.229** is on PATH (`~/.local/bin/claude`). Its non-interactive mode
  is `-p/--print`, and `--output-format stream-json` and `--allowedTools` are available (per
  `claude --help`). The event allows any agent: "Use any agent, framework or stack."
- **kane-cli is NOT installed yet.** Tollgate row 19 is FAIL and blocks Steps 1–2.
- The local clone sits under a path with a space (`…\VIBE CODE\…`), so every spawned command and path
  must be quoted.

### Submission and safety constraints

- Judges run it with **their own TestMu login** (for Kane) and their own agent. The fallback is the
  recorded YouTube run plus the committed hunt report (verdicts, reasons, `test_url`s), never evidence
  packs.
- The name must not be confusable with "Kane CLI", "KaneAI", "TestMu AI" or "LambdaTest", which are
  company marks (T&Cs §9). The "Verified with Kane CLI" badge is granted, not self-applied.
- The repo must be public at submission (a consent-gated Step-3 flip) and initialised on or after
  12 Nov (the first commit is 07ea954, 2026-11-25 ✓).
- **The demo must show a real "Kane caught something, the agent reacted" moment inside a 3–5 min
  video.**

### The one external dependency to clear on day 1

Clear tollgate row 19 (a user action): `npm install -g @testmuai/kane-cli` (not pnpm), then
`kane-cli login --oauth`, then claim the 10,000 credits at
https://www.testmuai.com/kane-cli/#creditOffer with the **same email** as kaneclihack.sh, then run one
flow. Next, measure `credits_consumed` for the demo check on its first real run. Then confirm on
Windows that (a) a `run` against a local `http://` URL returns a well-formed `run_end`, and (b) a
`--name` recording replayed with `testmd run` reproduces the same verdict (#250/#252/#253). That spike
decides whether re-verification uses replays or full runs. Also create the team on kaneclihack.sh
(solo is fine) so the submit form unlocks.

## Rubric mapping (why this won, for the record)

The weights were re-mapped to the published rubric, keeping intrinsic buildability highest:

- **Intrinsic buildability / Ships: 35.** Gate bar 1, judge-runnable, cheap in credits; includes the
  `safe-feasible` +5.
- **Kane depth (Verified + Closed loop + category fit): 30.** Half the published score and both
  tie-breakers; gate bars 2–3.
- **Demo WOW + Craft: 20.**
- **Novelty: 15.** Includes the `safe-feasible` −5; scored against the pack's 29-repo prior art.

The field had 24 candidates plus 9 bolder rewrites. Two (both subscription-killer variants, which
need real third-party accounts) were knocked out at the gate. Top of the table, scored as
buildability · Kane depth · WOW · novelty:

| Candidate | Scores | Total | Note |
|---|---|---|---|
| **firstbad** | 5 · 5 · 5 · 4 | **485** | the winner |
| Plain "git bisect on autopilot" | | 465 | the version before the bolder-pass rewrite |
| Consent-gate verifier | | 410 | its critical path rests on Kane cookie/network checkpoints only fixed on Windows in 0.10.9 |
| E2E mutation score | | 400 → 385 | dropped after the head-to-head: close to `NemesisDevX/nemesis-gauntlet`, and the bugs it "catches" are planted |
| Bisect-in-the-PR | | 395 | needs CI and secrets set up for judges |

The pressure test found no external blocker. The hidden risks all have an in-build mitigation or are
day-1 user actions: a single false verdict misdirecting the bisect, the upload-failed exit 1, a Node
crash exiting 1, the unknown credit price, and kane-cli not yet installed.
