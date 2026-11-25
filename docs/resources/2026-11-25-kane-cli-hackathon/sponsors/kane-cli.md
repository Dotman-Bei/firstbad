# Kane CLI (TestMu AI) — the one required integration

Sources (all fetched 2026-11-25):
- **K1** https://github.com/LambdaTest/kane-cli. Public, Apache-2.0, created 2026-04-14, last push 2026-11-24, 269★. Files read via `gh api` (raw): `README.md`, `CHANGELOG.md`, `.claude/skills/kane-cli/SKILL.md` and `references/{agent-contract,parsing,policy,execution-controls,setup-and-config,first-run,ready-check,testmd,agent-config}.md`, `docs/user-guide/{installation,authentication,cicd,running-tests,agents,policies,troubleshooting}.md`, `integrations/CLAUDE.md`.
- **K2** Releases: `gh release list/view`. Latest **0.10.9 (2026-11-24)**; 0.10.8 (11-22), 0.10.7 (11-20), 0.10.6 (11-18), 0.10.5 (11-17), 0.10.4 (11-12). npm `@testmuai/kane-cli` version `0.10.9` (`npm view`, modified 2026-11-24T12:43Z). `CHANGELOG.md` in the repo stops at 0.10.3; the release bodies carry 0.10.4+.
- **K3** Issues: `gh issue list --state all --limit 40`.
- **K4** Docs intro https://www.testmuai.com/support/docs/kane-cli-introduction/, which redirects to https://www.testmuai.com/docs/kane-cli-introduction (Mintlify; Chrome). The docs pages mirror `docs/user-guide/` in K1, so the sub-pages were read from the repo source rather than crawled one by one.
- **K5** Cookbook https://www.testmuai.com/kane-cli-cookbook/ (Chrome).

**What TestMu rewards** (from the judging): Verified (25%) and Closed loop (25%) are half the score and the tie-breakers. Kane must *catch or prove something meaningful*, and its verdict must *feed back to the agent*, "tighter is better". Kane is the referee, and the agent integration is the product.

---

## 1. What it is (K4, K1 README)

An AI E2E testing CLI. You write a plain-English objective; Kane drives a **real Chrome** (default) or a mobile app and returns pass/fail backed by a sealed **evidence pack** (screenshots, per-step console and network, failures). The README names three pillars: **Generate** (requirements → use-cases → acceptance criteria → runnable `_test.md`, via the "assurance" commands), **Execute** (web; Android emulator / iOS simulator; real cloud devices), and **Prove** (evidence packs, `kane-cli cover` coverage, policy verdicts).

Three modes (K4 table):

| Mode | Command | For |
|---|---|---|
| Interactive TUI | `kane-cli --tui` | development, exploration |
| Non-interactive CLI | `kane-cli run "..." --headless --agent` | CI/CD, shell scripts |
| Agent mode | `kane-cli run "..." --agent` | AI coding agents (Claude, Codex, Gemini) |

**No first-party MCP server.** No `mcp` mention in any K1 file read. Agent integration goes through the shell (NDJSON on stdout) plus the packaged **skill**. "Your own MCP setup" on the hack page refers to the *agent's* side. (One entrant, `mso-docs/proofline`, wrapped Kane in its own MCP server; see prior-art.)

## 2. Install, auth, verify (exact commands)

```bash
npm install -g @testmuai/kane-cli          # Node >= 18 (K1 installation.md). Windows x64 is a supported platform.
kane-cli --version                          # expect 0.10.9+
kane-cli login --oauth                      # local: opens browser consent, stores tokens
kane-cli whoami                             # identity card: profile, env, auth method, token valid/expired/missing
kane-cli balance                            # available credits only
npx @testmuai/kane-cli-skill                # installs the official skill for Claude Code, Codex CLI, Gemini CLI
kane-cli install skill                      # later skill updates (matches the installed CLI)
```

- Alternatives: Homebrew `brew install LambdaTest/kane/kane-cli` (macOS/Linux) and the shell installer `curl -fsSL https://raw.githubusercontent.com/LambdaTest/kane-cli/main/install.sh | sh`. **pnpm is unsupported**: the runner binary isn't found, giving a silent exit 2 (issue #24). yarn is unverified.
- **Chrome is required** on the machine; the first `run` checks it. Env knobs: `KANE_CLI_CHROME_PATH`, `KANE_CLI_CDP_TIMEOUT_MS` (default 30000), `KANE_CLI_CDP_RETRIES` (default 2).
- **CI / non-interactive auth:** basic auth with `--username "$LT_USERNAME" --access-key "$LT_ACCESS_KEY"` on each command, or persist it with `kane-cli login --username … --access-key …`. Do **not** call `kane-cli login` in CI (OAuth needs a browser). Credentials are stored at `~/.testmuai/kaneai/profiles/<profile>/<env>/credentials` (mode 0600). Profiles: `kane-cli profiles list|switch|delete`; `--profile` works on `login`, `whoami`, `balance`.
- **Never put the access key in chat, the repo or the pack.** Use env-var names only (`LT_USERNAME`, `LT_ACCESS_KEY`).
- Updates: the CLI checks npm every 24 h and prints a notice. Upgrade with `npm install -g @testmuai/kane-cli@latest`. The `--agent` stream also emits `update_available` and `skill_update_available` events.

## 3. Running a flow (the objective grammar)

```bash
kane-cli run "Go to https://example.com and assert the page title contains 'Example'" --agent --headless --timeout 120
```

- **The `run` subcommand is mandatory.** `kane-cli "<objective>"` exits 2 with a "did you mean" hint.
- **A start URL is mandatory in non-TTY.** Start the objective with "Go to https://…", or pass `--url`, or set `kane-cli config set-url`. Otherwise the run fails fast (`--allow-missing-url` starts from the current page).
- Key flags (K1 SKILL.md §3): `--headless` (default off) · `--max-steps <n>` (default 50) · `--timeout <s>` (default: none) · `--url` · `--variables-file <path>` / `{{name}}` variables · `--name <slug>` (records the run as `.testmuai/tests/<slug>_test.md`) · `--bug-detection off|stop|continue` · `--assertion-mode dom|visual` · `--final-validation on|off` · `--code-language python|javascript` (code export, on by default).
- **Objective-writing rules that decide Verified scores:**
  1. **End every flow in a terminal assertion** ("verify the cart shows 1 item"). A pure-action objective earns no replayable pass/fail. Assert the *outcome*, not the trigger: "verify the Submit button is visible" fails exactly when the action worked.
  2. **Use "store as" to extract values** ("store the page title as 'page_title'"). "Read" and "tell me" don't reliably capture anything. Stored values come back in `run_end.final_state`.
  3. **One objective = one task.** Split anything over about 15 steps into several runs; they can run in parallel.
- Assertion types (K1 cookbook refs, K5): visual, textual/DOM, URL, title, and **DevTools checkpoints**: network (status, response shape, "no 5xx"), console errors, performance, cookies (including HttpOnly and the Secure flag), localStorage, clipboard. Kane can also make **direct API calls** ("POST …, save the response as X, assert the status is 200"). K5 cookbook use-cases cover exactly these: catch a server/console error behind a green page, assert an HttpOnly session cookie, fail on a cookie missing Secure, catch a staging/localhost endpoint leak in prod, keep secrets out of localStorage, "X-ray any page" for perf numbers, and generate positive/negative/edge cases from one sentence.
- **Current-page check without an objective:** `kane-cli run --analyzer-only --condition "<c>" [--condition …] --agent` returns `condition_results: (boolean|null)[]`. **Exit 0 means every condition was judged, not that every condition is true.** Read the array.

## 4. How the verdict comes back to the calling agent (the closed-loop contract)

**Exit codes** (`run`, K1 running-tests.md): `0` passed · `1` failed (unrecoverable failure, or upload failed) · `2` error (auth, TMS credential exchange, config, Chrome, unknown subcommand, unhandled exception) · `3` cancelled or hit `--timeout`. For `testrun run`: `0` all passed · `1` any failure · `2` invalid plan · `3` cancelled. **Careful:** on assurance and context-sync commands (`--mode agent`), exit 3 means *paused, a decision is needed*, not timeout.

**NDJSON on stdout with `--agent`** (progress UI goes to stderr). Contract version field `v: 1`, plus `ts`, on every line (0.8.17+):
- The first line is `{"type":"stream_start","cli_version":…,"surface":"run"|"testmd"|"testrun"|"explore",…}`. **Prose on the first line means terminal mode**, which after a real run waits on an evidence table for `q`/Esc and **never exits**. Kill it and re-run with `--agent` or a stdin redirect.
- **Progress lines are untyped:** `{"step":n,"status":"running"|"done"|"failed","remark":"…"}`. Don't key on `type` for steps. Count `done`/`failed` lines to get steps taken.
- Typed events: `bifurcation`, `ask_user`, `error`, `warning` (`code:"unresolved_variables"`, which doesn't change the exit code), `coverage`, `project_folder_auto_defaulted`, `update_available`, `skill_update_available`, and the `testrun_*` family.
- **Terminal event for one-shot `run`: `run_end`.** Fields: `status` (`passed`/`failed`), `summary`, `one_liner`, `reason`, `duration`, `credits_consumed` (decimal; older builds call it `credits`), `final_state` (stored values), `context`, `session_dir`, `test_url` (Test Manager link), and `result_code`. **With `--bug-detection`, a confirmed product bug arrives as `result_code: "740"` plus a `verdict` object** (`confirmed, family, category, severity, one_liner, confidence`). That is a ready-made machine signal for "Kane caught something".
- Other surfaces: `testmd run` ends with `test_md_done` (`overall_status, duration_s, session_id, share_url?`). An intermediate `run_end` there does **not** finish the test. `testrun run` ends with `testrun_done` (then `remote_done` for `--remote`).
- **Early refusals can end with an `error` and no completion event.** Always read the process exit code too.
- The same stream is written to `<session_dir>/events.ndjson`. While a run is live, a pointer file sits at `~/.testmuai/kaneai/sessions/active/<pid>.json`, which a watcher can tail.
- `ask_user` can be answered on stdin with `{"type":"user_response","answer":"…"}` (only if stdin is a TTY); cancel with `{"type":"cancel"}`.
- The evidence path is printed on **stderr** (`evidence: view locally with kane-cli evidence serve <path>`), not in `run_end`. Packs live in `.testmuai/evidence/*.evidence`; `kane-cli evidence serve <pack>` serves a local-only viewer.

**Minimal loop parser** (pseudocode, from parsing.md):
```
for line in stdout: skip non-JSON; ignore unknown types/fields
  if type=="run_end" → verdict = status, why = summary/reason, values = final_state, bug = result_code=="740"
  elif "step" in obj → live progress only
exit code is authoritative when no run_end arrived
```

## 5. Wiring Kane into the agent loop: hook, re-prompt, spec

The hack page says to wire it in as "a hook, a re-prompt, a spec". Kane has **no hook system of its own**. You wire its exit code and `run_end` into the *agent's* hook points:
- **Hook (Claude Code):** a `Stop` (or `PostToolUse`) hook runs `kane-cli run … --agent --headless --timeout N`, parses `run_end`, and blocks the stop with the failing `summary`/`reason` fed back as the next instruction. Entrant `rohanjain1648/zenloop` describes exactly this ("Claude Code Stop hook + Kane CLI"). Kiro packages a sample hook in K1 `integrations/kiro-powers/`.
- **Re-prompt:** an outer loop (script or agent SDK) that calls Kane, turns a `failed` `run_end` (plus the failing step's screenshot from the evidence pack, extractable with `unzip <pack> "tests/*/steps/*/screenshot.png"`) into a repair prompt, and re-runs until it passes or a budget runs out. The loop exits on exit code 0.
- **Spec:** write requirements to a file → `kane-cli context ingest <file> --mode agent` → `kane-cli design tests` → runnable `_test.md` with an `assurance:` block → `kane-cli cover` for coverage against acceptance criteria. The skill forbids hand-writing Kane test cases; they come from the assurance commands.
- **Gate (CI):** `kane-cli testrun run --tags smoke --headless --on-failure fail-fast < /dev/null` → one exit code and one evidence pack. Add `--policy gate.yaml` for verdicts beyond pass/fail (`totals.failed equals 0`, `pass_rate min 0.95`, `metrics.tests_without_checks equals 0`, `metrics.heal.healed_tests max 0`, CEL `expr` gates). The verdict JSON lands at `<pack>.verdicts/<policy-id>.verdict.json`; `kane-cli evidence verdict latest --policy gate.yaml` judges after the fact. Policies need a build after 0.10.0-rc.3 (0.10.9 qualifies).
- **Official GitHub Actions** in K1: `integrations/github-action/kane-cli-pr` (PR check) and `kane-cli-browser-run` (examples: nightly-smoke, on-demand, pr-check-objective, pr-check-test-suite, preview-deployment).
- **Tag every call** with `KANE_CLI_USER_AGENT=<runtime>` (e.g. `claude-code`). PowerShell form: `$env:KANE_CLI_USER_AGENT='claude-code'; kane-cli run "…" --agent`.
- **Saved tests replay cheaply:** `testmd` steps replay from a recording with no LLM cost and in seconds. Editing step N re-authors steps N onward. `kane-cli run "<objective>" --name <slug>` records a one-off as a `_test.md`. This is the lever for fast, cheap re-verification inside a tight loop.
- `kane-cli bugs` (0.10.7+): mark known bugs against a test so the next RCA reads them back. That is an agent-memory hook for repeat failures.

## 6. Targets: browser vs iOS/Android

- **Desktop Chrome (default):** runs locally on every supported OS, Windows x64 included. **This is the feasible target here.**
- **Android Emulator / iOS Simulator, locally:** **macOS Apple Silicon only** (K1 installation.md, K4). On other OSes mobile suites must run on the cloud grid with `kane-cli plugin install remote-execution` and `testrun run --remote …`, which **needs a LambdaTest plan with HyperExecute macOS runners** (allow ~10 min). Windows `--remote` was fixed in 0.10.7.
- **Real devices** (`--target android|ios`) run from any machine but **need KaneAI Max or KaneAI credits + Real Device Plus Automation Cloud**. A hub refusal is a plan problem; never retry it. Private backends go through `--tunnel-name` (0.10.3+; 0.10.9 says the tunnel is for real devices only).
- **Verdict for this campaign (machine: Windows 10):** web-only. Mobile is a plan or credit gate the free 10,000 credits may not cover (**gap:** not verified whether free credits unlock the remote grid).

## 7. Credits and limits

- Hack offer: 10,000 free credits per new TestMu AI account, **valid one month**, claimed at https://www.testmuai.com/kane-cli/#creditOffer (claim page not opened: extraction only). Running low means a Slack DM before the deadline (S1 FAQ).
- Per-run cost is reported in `run_end.credits_consumed`. Doc examples show `11.9` for a short Amazon run and "58 credits" for a 12-step run in the status-strip example. **Gap:** no published price table. Measure it on the first real runs and budget. A designed test's first run "uses more credits than later runs"; replays mostly avoid authoring cost.
- `kane-cli balance` reports credits. **Issue #174 (open): the CLI does not block at 0 credits.** Check `balance` in the loop yourself.
- No published rate limits were found (**gap**). Concurrency caveats are listed below.

## 8. Gotchas (live issues as of 2026-11-25, K3, plus doc rules)

**False passes and false negatives (they threaten "Verified"; design assertions defensively):**
- #239 (open) an assert was marked passed although Kane's stored value contradicted it (0.10.8).
- #254 (open) a text check on a counter rebuilds the label, so "1 items left" passes.
- #250 (open) a `testmd` heading-only step is never executed yet the run reports passed.
- #252 (open) `testmd` "Reload the page" sends Ctrl+R, which never reloads, and the step passes.
- #253 (open) `testmd` "Open the page" can read the KaneAI Playground page instead of `--url`.
- #255 (open) a localStorage verify on a local page times out reading storage.
- #245 (open) triage text is misleading on a wrong-address read.
- Closed and fixed: #233 (blank-line strip false pass), #232 (real bugs labelled automation_bug), #240 (`--analyzer-only` inverted "contains").
- **Mitigation:** assert concrete outcomes with "store as" plus an explicit compare, prefer DOM/network/console checkpoints for the "caught something" moment, and cross-check `final_state` against the claim.

**Windows-specific:**
- #237 (open) `testrun --parallel` "Chrome CDP not ready after 30000ms". Raise `KANE_CLI_CDP_TIMEOUT_MS` or avoid `--parallel`.
- #236 (open) `[lock] heartbeat failed` during suites.
- 0.10.9 fixed DevTools queries on Windows, so **pin ≥ 0.10.9**.
- `testrun run` on Windows: **stdin must be non-TTY**. From PowerShell use `cmd /c "kane-cli testrun run … < NUL"`; in Git Bash use `< /dev/null`.

**Other:**
- #242 (open) two runs started at the same moment on one machine write each other's traffic into their evidence packs. **Serialize runs** when evidence matters.
- #207 (open) `testmd run` can hang on a login page and `--timeout` doesn't stop it. Add an outer kill timer.
- #211 (open) network failures crash as `TypeError: fetch failed` and hide the cause.
- #247 (open) the evidence HAR keeps bearer tokens in headers, and since 0.10.2 packs are sealed **without** secret redaction. **Treat `.evidence` files as secrets: don't commit them to a public repo unscrubbed.**
- #216 / #215 (open) API steps are non-deterministic with variables-file bearer tokens and can print secrets in clear.
- Uploads: each run is saved as a Test Manager test case in an auto-defaulted project/folder (`project_folder_auto_defaulted` event); `kane-cli config project|folder <id>` pins it. An "upload failed" yields exit 1 even if the flow passed. Distinguish it via `run_end.status`/`reason`.
- `--max-steps` defaults to 50 and there is no default timeout: **always pass `--timeout`** in loops.

## 9. Doc links (for the architect)

- Docs home / intro: https://www.testmuai.com/docs/kane-cli-introduction. Sub-pages (installation, quick start, authentication, writing objectives, configuration, mobile, Test Manager, agent mode, CI/CD, skills) mirror https://github.com/LambdaTest/kane-cli/tree/main/docs/user-guide.
- Agent skill (canonical facts): https://github.com/LambdaTest/kane-cli/blob/main/.claude/skills/kane-cli/SKILL.md, plus `references/parsing.md` (NDJSON schema), `references/policy.md`, `references/testmd.md`, `references/objectives-cookbook.md`.
- Agent guide: https://testmuai.com/kane-cli/agents.md (linked from the README; not fetched).
- Cookbook: https://www.testmuai.com/kane-cli-cookbook/ (11 use-cases: console, performance, cookies, network ×2, click-only console error, Secure-flag cookie, env leak, localStorage secrets, generate cases, memory reuse).
- GitHub Actions: `integrations/github-action/kane-cli-pr`, `integrations/github-action/kane-cli-browser-run`.

## Gaps

- Individual Mintlify sub-pages were not crawled page by page; the repo's `docs/user-guide/*.md` (the same content) was read instead. Not read: `objectives-cookbook.md`, `mobile/*`, `remote-execution.md`, `evidence.md`, `testrun.md`, `explore.md`, `assurance/*`.
- No published credit price per run, no rate limits. Unknown whether the free credits cover `--remote` grid or real-device runs.
- The credit-claim page and the TestMu AI dashboard were not opened (account-gated, extraction only).
