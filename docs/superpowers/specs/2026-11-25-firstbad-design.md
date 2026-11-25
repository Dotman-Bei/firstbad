# firstbad — design spec

> Step 1 (architect) output. This file is the single source of truth for *what* is built. The plans in
> `docs/superpowers/plans/` say *how*. Source brief: `docs/idea-forge/2026-11-25-firstbad-brief.md`.
> Pack: `docs/resources/2026-11-25-kane-cli-hackathon/`. Tollgate: `docs/tollgate/2026-11-25-tollgate.md`.

## Header (constraints, verbatim from the kickoff)

- **Target platform:** web only — local desktop Chrome driven by kane-cli >= 0.10.9 (npm, not pnpm); no chain, no mobile, no --remote. Built on Windows 10 x64 but must also run on macOS/Linux (judges' machines are unknown).
- **Language/runtime:** TypeScript strict + ESM on Node >= 20 (machine: v22.23.4, npm 10.9.9), git 2.54 (git bisect run), Claude Code CLI 2.1.229 as the default agent (pluggable).
- **Hard deadline:** 2026-11-26 23:59 IST = 18:29 UTC = 19:29 WAT ("No pushes after this"; internal target: submission filed by 15:00 UTC). Team = solo + AI.
- **Category:** no prize tracks (one pool); category 02 WORKFLOW "Workflows with a spine" (the page's own "git bisect on autopilot" example) with an agent loop driven only by Kane's verdicts; 01 WEB only as the verified surface.
- **Kane rules:** every check ends in a terminal assertion with a "store as" value; always pass --timeout; serialize Kane runs; read run_end AND the exit code (upload-failed exits 1 even when the flow passed); never commit .evidence packs (bearer tokens); judges run it with their own TestMu login plus a recorded-run fallback; the name must not be confusable with Kane CLI / KaneAI / TestMu marks; keep re-verification cheap.
- **Out of scope:** mobile/real devices/--remote, any product web UI or dashboard (terminal + Markdown/JSON report only), GitHub Action/PR bot/CI, testrun/policies/cover/assurance/bugs memory, parallel runs, autonomous bug exploration, opening PRs or pushing to remotes, monorepo/build-cache work, non-git VCS, MCP server.
- **Guide-added:** task gates never call live Kane (stub kane-cli everywhere); only two LIVE tasks (day-1 spike first, end-to-end demo hunt last); store-first objective; a mis-phrased check is a SKIP/abort signal, never "bad"; budget by `kane-cli balance` before/after, not `credits_consumed` alone.

## 1. What firstbad is

A CLI that finds the commit that broke a user flow. You give it one plain-English check (what to do,
what value to store, what that value should be), a known-good ref, and how to serve your app. It
proves the check fails on the bad ref and passes on the good ref, then drives `git bisect run` with
Kane CLI as the oracle: one headless, time-limited, serialized Kane run per commit. A commit that
fails *for a different reason* is skipped, not blamed. It re-tests the first bad commit and its
parent, hands the culprit's diff and Kane's failing `run_end` to your coding agent, and re-runs Kane
on the patched tree until it passes (bounded attempts). A pass is committed on a new local branch
together with the hunt report.

| Judging bar / dimension | Where firstbad shows it |
|---|---|
| Works end to end · Ships | `firstbad demo` generates a 40-commit shop history and runs hunt → confirm → fix → proof |
| Kane caught or proved something · Verified | Kane fails HEAD, passes `v1.0`, names the first bad commit, confirms it against its parent, proves the fix |
| Agent and Kane talked · Closed loop | Kane's verdict is the bisect oracle with nothing in between; the failing `run_end` is the agent's brief; the patch goes back to Kane until it passes |
| Craft | one command against your own repo; your checkout is never touched (disposable worktree); a report that is safe to commit |

## 2. User-facing contract

### Commands

```
firstbad hunt --good <ref> [--bad <ref>] --url <url> --do "<steps>" --store "<what>" --expect "<value>"
              --serve "<cmd>" [--setup "<cmd>"] [--agent "<cmd>" | --agent none] [--no-fix]
              [--out <dir>] [--repo <path>]
firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" | --agent none] [--no-fix] [--force]
firstbad oracle --session <file>        # a git-bisect-run script: exit 0 good, 1 bad, 125 skip, 128 abort
firstbad clean [--repo <path>]          # droppable task: remove leftover firstbad worktrees/sessions
firstbad --version | --help
```

- `--bad` defaults to `HEAD`; `--repo` defaults to the current directory; `--out` defaults to
  `<git-common-dir>/firstbad/reports/<YYYYMMDD-HHMMSS>/` (inside `.git`, never tracked).
- `--agent` defaults to `claude -p --permission-mode acceptEdits --allowedTools Read,Edit,Write,Glob,Grep`.
  `--agent none` skips the agent and uses the revert fallback.
- `demo` defaults: `--dir ./firstbad-demo`, `--port 4173`; the demo repo is `<dir>/shop`, the report
  goes to `<dir>/report/`. It refuses a non-empty `<dir>` unless `--force`.

### Exit codes

| Command | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| `hunt`, `demo` | confirmed culprit found (and, unless `--no-fix`, fix verified by Kane) | hunt ran but no confirmed culprit, or fix not verified | usage / config error | preflight failed (kane-cli missing/too old, auth, balance below floor, repo/ref problem) |
| `oracle` | PASS (good) | FAIL (bad) | — | — (125 = SKIP, 128 = ABORT; any uncaught error → 128, **never 1**) |

### Environment variables

| Name | Default | Meaning |
|---|---|---|
| `FIRSTBAD_KANE` | `kane-cli` | Kane command (split shell-style into argv). Tests point it at a stub. |
| `FIRSTBAD_MIN_BALANCE` | `500` | Refuse to start (hunt, demo, spike, live demo) when `kane-cli balance` is below this. |
| `FIRSTBAD_MAX_RUNS` | `16` | Cap on Kane invocations per hunt (retries count). Reaching it aborts the bisect. The LIVE demo hunt task sets `24`. |
| `FIRSTBAD_SPIKE_MAX_RUNS` | `8` | Cap on credit-consuming Kane invocations in the day-1 spike (room to try template candidates). |
| `FIRSTBAD_MAX_FIX_ATTEMPTS` | `3` | Agent attempts before the fix is declared unverified. |
| `FIRSTBAD_KANE_TIMEOUT_SEC` | `300` | Passed as `--timeout`; the outer kill timer is this + 60 s. The LIVE demo hunt task sets it explicitly. |
| `FIRSTBAD_AGENT_TIMEOUT_SEC` | `900` | Kill timer for one agent attempt. |
| `FIRSTBAD_READY_TIMEOUT_SEC` | `30` | How long the served URL may take to answer. |
| `FIRSTBAD_SETUP_TIMEOUT_SEC` | `600` | Kill timer for the setup command. |
| `FIRSTBAD_KEEP_SESSION` | unset | `1` keeps the temp session dir (contains Kane evidence; never commit it). |
| `NO_COLOR` | unset | Disables ANSI color. |

firstbad sets for children: `KANE_CLI_USER_AGENT=firstbad` (Kane, unless already set),
`FIRSTBAD_LABEL=<what is being tested>` (Kane; read by the stub), `FIRSTBAD_PROMPT_FILE=<path>`
(agent). It **removes `CLAUDECODE`** from the agent's environment so a nested `claude -p` runs when
firstbad itself is launched from inside Claude Code.

## 3. The check and the objective templates (store-first, cookbook style)

```ts
interface Check { url: string; do: string; store: string; expected: string }
```

The Kane objective is always generated, never user-written (the raw `--objective` escape hatch is a
stretch task). **Why the wording matters (live facts, 2026-11-25):** the first live run (13:09 WAT)
asserted before storing and stored nothing. A second probe with this spec's original sentence-style
template ("… Then store … as 'observed'. Finally, verify that the stored value 'observed' is exactly
…") against https://example.com also failed: `final_state {}`, `result_code 750` ("analyzer found
no heading"). Kane **dropped the store clause** and ran one assert step reading
`The stored value {{observed}} is exactly "Example Domain"`. Kane's own cookbook
(`LambdaTest/kane-cli` `.claude/skills/kane-cli/references/objectives-cookbook.md` §4–5) says: chain
the clauses with commas, refer to a stored value in plain English ("the stored observed value"),
and never write `{{name}}` (that form is only for user variables). So "assert before store" was only
part of the cause; the clause structure and the stored-value reference matter too. firstbad never
emits `{{…}}`.

**Ordered template candidates** (`TemplateId`, tried in this order by the day-1 spike):

| id | Template (exact) | Kane asserts? |
|---|---|---|
| `commas-assert` | `Go to {url}, {do}, store {store} as 'observed', then assert the stored observed value is "{expected}"` | yes |
| `sentences-assert` | `Go to {url}. {do}. Store {store} as 'observed'. Then assert that the stored observed value is "{expected}".` | yes |
| `store-only` | `Go to {url}, {do}, then store {store} as 'observed'` | **no** — firstbad compares the value itself; Kane's status is only an error signal |

`{do}` and `{store}` are trimmed and lose trailing `.`/`,` characters before insertion. The stored
key is always `observed`. Validation: `url` must start with `http://` or `https://`; `do`, `store`,
`expected` non-empty after trim; none of them may contain `{{`; `expected` must not contain `"`.

**The Kane profile** (`src/kane-profile.ts`, a committed constant): `{ template: TemplateId;
verdictMode: 'status+value' | 'value-only'; agentPromptRoute: 'stdin' | 'arg'; source: string }`.
The scaffold creates it with `commas-assert` / `status+value` / `stdin` /
`default (spike not yet run)`. `agentPromptRoute` is how the fix loop hands the prompt to the agent
(on stdin, or as the last argv entry); the spike's nested-agent smoke sets it. The day-1 spike **rewrites it**
with the template it chose and the verdict mode it measured; the spike gate fails if the file and
`docs/spike/spike-result.json` disagree. Core code reads only this constant. `verdictMode` is
`value-only` when the chosen template is `store-only`, or when Kane's own assertion status disagreed
with the stored value in any spike run; otherwise `status+value`.

**Value matching** (`valuesMatch(a, b)`): normalize each (trim, collapse whitespace, lowercase,
strip one pair of wrapping quotes); equal → match. Otherwise, if each contains exactly one number
token (`-?\d+(?:\.\d+)?` after removing thousands commas), match when the numbers are equal. So
`$18.00`, `Total: $18.00`, `18.00` and `$18` all match `$18.00`; `$20.00` does not.

## 4. Verdict rule (`classify`) — the core

Verdicts: `PASS` (good), `FAIL` (bad), `SKIP` (untestable / different failure), `ABORT` (stop the
hunt). Exit codes for the oracle: PASS 0 · FAIL 1 · SKIP 125 · ABORT 128.

Evaluated in order, per probe:

1. Setup command exits non-zero or times out → **SKIP** `setup failed (<detail>)`.
2. The server process exits before the URL answers, or the URL does not answer within the ready
   timeout → **SKIP** `page never loaded (<detail>)` — no Kane run, no credits.
3. Kane could not be spawned (`ENOENT`) → **ABORT** `kane-cli not found`.
4. Kane auth failure (exit 2 with an error/stderr text matching
   `/auth|log ?in|credential|unauthori[sz]ed|forbidden|\b401\b|\b403\b/i`) → **ABORT**
   `Kane authentication failed — run kane-cli login`.
5. Transient Kane outcome — no `run_end`, or killed by the outer timer, or terminal mode (first
   stdout line not JSON), or exit 3 — the probe retries **once**; if still transient → **SKIP**
   `Kane error: <detail>` / `Kane timed out`.
6. A `run_end` is present: judge on the stored value (and, in `status+value` mode, on
   `run_end.status`), never on the exit code alone (exit 1 with `status: passed` is an upload
   failure, not a failed check). Let `observed = final_state.observed` (string, trimmed; non-string
   → JSON string; missing → empty).
   - `observed` empty → **retried once** like a transient (the retry counts against the run cap);
     still empty → **SKIP** `Kane could not read the value` (flag `misphrased` when the `run_end`
     blames the test: its raw JSON contains `automation_bug` or `config_issue`). In the bracket
     phase this is the "mis-phrased" abort.
   - `observed` matches `expected`: in `status+value` mode, status `passed` → **PASS**, otherwise
     **SKIP** `Kane and the stored value disagree`; in `value-only` mode → **PASS** whatever the
     status.
   - Bad signature known and `observed` matches it → **FAIL** (in `status+value` mode, if status
     was `passed`, the reason notes `Kane reported pass but stored <v>: false pass caught (#239)`).
   - Bad signature not yet known (bracket of the bad ref) → **FAIL**; this run establishes the bad
     signature.
   - Otherwise → **SKIP** `observed <v>, differs from the bad ref's <bad>: not this bug`.
7. Run cap: before each Kane invocation, if `runsUsed >= FIRSTBAD_MAX_RUNS` → **ABORT**
   `run cap reached (FIRSTBAD_MAX_RUNS=<n>)`.

Bracket rules: the bad ref must classify **FAIL** with a non-empty value (else: PASS → "nothing to
hunt: the bad ref passes the check"; empty/misphrased → abort "your check looks mis-phrased: Kane
could not store the value"; SKIP → abort "the bad ref cannot be tested: <reason>"). The good ref
must classify **PASS** (else abort "the good ref does not pass the check: <reason>").

## 5. Kane adapter

- Spawn via `cross-spawn` (handles the Windows npm `.cmd` shim and quoting) with argv
  `[...kaneCmd, 'run', <objective>, '--agent', '--headless', '--timeout', <t>, '--max-steps', '25', ('--name', <slug>)?]`,
  `stdin: 'ignore'` (non-TTY), `cwd` = the session's `kane/` dir (so `.testmuai/` and evidence
  never land in the user's repo), `windowsHide: true`, `detached` on POSIX (process-group kill).
- Outer kill timer `(timeout + 60) s` (issue #207); kill the whole tree (`taskkill /pid <p> /T /F`
  on Windows, `process.kill(-pid, 'SIGKILL')` elsewhere).
- Parse stdout as NDJSON leniently: skip non-JSON lines, ignore unknown types/fields. First line not
  JSON → terminal mode → kill. Keep `stream_start`, `run_end` (whitelisted fields only), the text of
  `type: error` events, and step counts. `credits_consumed` falls back to `credits`.
- stderr: keep a scrubbed tail (≤ 2000 chars) with every line containing `evidence` dropped.
- `kane-cli balance` → first decimal number in stdout (commas removed) or `null`; `kane-cli
  --version` → first `x.y.z`; preflight requires ≥ 0.10.9.
- Serialized by construction (one probe at a time); the run counter lives in the session file.

## 6. Hunt flow

1. **Preflight** (`PreflightError` → exit 3): repo is a git repo; `--good`/`--bad` resolve;
   good is an ancestor of bad; kane version ≥ 0.10.9; balance ≥ floor (a `null` balance warns and
   continues). Record `balanceBefore`.
2. **Session**: `<os.tmpdir()>/firstbad-<stamp>-<rand>/` holding `session.json`, `ledger.jsonl`,
   `kane/` (Kane's cwd) and `wt/` — a `git worktree add --detach` of the bad ref. The user's
   checkout is never touched.
3. **Bracket**: probe the bad ref (label `bad ref`), then the good ref (label `good ref`), each by
   `git checkout --detach` inside the worktree. Store the bad signature in the session.
4. **Bisect**: in the worktree, `git bisect start <bad> <good>`, then
   `git bisect run <node> <abs>/dist/oracle-bin.js --session <session.json>` (separate argv entries,
   so paths with spaces survive). The oracle probes `HEAD` of its cwd, appends a ledger entry, prints
   one line `@@firstbad <json entry>` to stdout, persists `runsUsed`, and exits 0/1/125/128. The
   parent streams git's stdout: `@@firstbad` lines become timeline lines, `Bisecting:` lines are shown
   dim, everything else is hidden. The first bad commit is parsed from `<sha> is the first bad
   commit`; "only 'skip'ped commits left" → status `unconfirmed` with the candidate list; an oracle
   ABORT → status `aborted` with its reason. Always `git bisect reset` afterwards.
5. **Confirm**: probe the culprit (label `culprit`, expect FAIL) and its first parent (label
   `parent`, expect PASS). Both hold → `confirmed`; otherwise `unconfirmed` and no fix attempt.
6. **Port hygiene**: before starting a server the probe checks the URL is *not* already answering —
   if it is, ABORT `port busy: something is already serving <url>; stop it or choose another port`.
   After killing a server it waits (≤ 5 s) for the URL to go quiet.
7. **Cleanup** (always, in `finally`): kill servers, `git bisect reset` if active, remove the
   worktree (`git worktree remove --force` + `git worktree prune`), delete the session dir unless
   `FIRSTBAD_KEEP_SESSION=1`. The fix branch survives.

## 7. Fix loop

- Only after `confirmed` and without `--no-fix`. Create branch `firstbad/fix-<culprit short sha>`
  (suffix `-2`, `-3` … if taken) from the bad ref in the worktree.
- **Agent route**: up to `FIRSTBAD_MAX_FIX_ATTEMPTS`. Each attempt writes the prompt to
  `<session>/prompt-<n>.md`, sets `FIRSTBAD_PROMPT_FILE`, hands the prompt over by the profile's
  `agentPromptRoute` (piped on stdin, or appended as the last argv entry), runs the agent argv in the
  worktree with `CLAUDECODE` removed from env, kill timer `FIRSTBAD_AGENT_TIMEOUT_SEC`.
  No file change (`git status --porcelain` empty) → attempt fails ("agent made no change"). Otherwise
  probe the working tree (phase `fix`, label `fix attempt <n>`). PASS → verified. Not PASS → the
  entry's reason is added to the next prompt. Edits accumulate across attempts.
- **Prompt** (exact sections): the check and expected value; the observed bad value and Kane's
  failing summary; the line `First bad commit: <40-hex sha> (<subject>)`; the parent's passing value;
  the culprit diff (`git show --format=fuller <sha>`, first 300 lines); previous attempt failures;
  rules: fix the code at the current HEAD with the smallest change, edit files only, do not run git,
  do not touch `firstbad-report.*`.
- **Revert route** (agent argv is `null`, or the agent command is not found): `git revert --no-commit
  <culprit>`; conflict → `git revert --abort`, unverified; else probe (label `revert`) → PASS =
  verified.
- **Commit**: on verified, write `firstbad-report.md` and `firstbad-report.json` into the worktree
  root, `git add -A`, commit `fix: restore "<store>" regression from <short sha> (verified by Kane via firstbad)`.
  If the repo has no `user.name`/`user.email`, commit with `-c user.name=firstbad -c
  user.email=firstbad@localhost.invalid`. Unverified → delete the fix branch.

## 8. Report

`report.json` + `report.md` written to `--out`, and (verified fix) into the fix commit.

```ts
interface Report {
  tool: 'firstbad'; version: string; generatedAt: string;
  check: Check; refs: { good: string; bad: string };
  hunt: { status: 'confirmed'|'unconfirmed'|'nothing-to-hunt'|'aborted'; message: string;
          culprit: { commit: string; subject: string } | null; parent: string | null; badValue: string | null };
  fix: { status: 'verified'|'unverified'|'skipped'; route: 'agent'|'revert'|null; branch: string | null;
         commit: string | null; attempts: number; message: string } | null;
  timeline: LedgerEntry[];
  cost: { kaneRuns: number; creditsConsumed: number; balanceBefore: number | null;
          balanceAfter: number | null; balanceDelta: number | null };
}
interface LedgerEntry {
  phase: 'bracket'|'bisect'|'confirm'|'fix'; label: string; commit: string; subject: string;
  verdict: 'PASS'|'FAIL'|'SKIP'|'ABORT'; reason: string; observed: string | null;
  kaneRuns: number; creditsConsumed: number | null; testUrl: string | null;
  resultCode: string | null; durationMs: number; at: string;
}
```

- **Allow-list only**: nothing else from Kane is kept — never `session_dir`, evidence paths, raw
  events, headers, context, or Kane stderr. Every string goes through `scrub()`.
- `scrub()` replaces with `[redacted]`: `Bearer <token>`, JWT-shaped strings
  (`eyJ…\.…\.…`), and `access_key|api_key|apikey|token|secret|password` followed by `:`/`=` and a
  value of ≥ 8 chars.
- Markdown: header (check, refs, verdict), first bad commit + confirmation, timeline table (phase,
  commit short, subject, verdict, observed, reason, credits), fix section, cost section
  (Kane runs, Σ credits_consumed, balance before/after/delta — the delta is the number to trust).

Terminal timeline line format (also used by the oracle relay):

```
  bracket  9f2c1ab  bad ref                         FAIL  $20.00   Expected "$18.00" but observed "$20.00"
  bisect   5d6e7f8  chore(server): read port from…  SKIP  —        page never loaded (server exited with code 1)
```

## 9. Demo fixture

- Zero-dependency "Corner Shop": `server.js` (node:http static server on `127.0.0.1:<argv[2]>`,
  default 4173), `index.html`, `app.js` (browser ES module), `pricing.js`, `catalog.js`,
  `styles.css`, `package.json` (`"type": "module"`), `README.md`, `.gitignore` (`.testmuai/`,
  `*.evidence`, `node_modules/`), `.gitattributes` (`* -text`).
- Prices in cents: Tote bag 1250, Mug 750. Code `SAVE10` = 10 %. Correct total for Tote + Mug +
  SAVE10 = **$18.00**.
- **Planted culprit** (commit index 29): `refactor(cart): extract price helpers` — extracts
  `normalizeCode()` that lower-cases the code while `CODES` keys stay upper-case, so the discount is
  lost → **$20.00**. The correct fix is upper-casing.
- **Unrelated breakage** (indices 18–21): index 18 `chore(server): read the port from shop.config.json`
  makes the server read a file that does not exist and crash at boot; index 22
  `fix(server): fall back to the default port when shop.config.json is missing` repairs it. Bisect's
  first probe (index 19 or 20 of a 40-commit linear history) lands in that range → SKIP
  "page never loaded".
- 40 commits, index 0 tagged `v1.0` (lightweight). Deterministic: identity
  `Corner Shop Dev <dev@corner-shop.invalid>`, author = committer date
  `2026-11-02T09:00:00Z + 3 h × index`, LF files, `core.autocrlf=false`, `commit.gpgsign=false`,
  `--no-verify`. The same history (same SHAs) on every machine.
- Demo check (comma-chainable): url `http://127.0.0.1:<port>/`; do `add the Tote bag to the cart,
  add the Mug to the cart, type SAVE10 into the discount code field and click Apply`; store `the
  total amount shown next to the word Total`; expected `$18.00`. Serve `node server.js <port>`. No
  setup command.

## 10. Safety

- `.gitignore` of this repo: `node_modules/`, `dist/`, `.testmuai/`, `*.evidence`, `coverage/`,
  `.env`, `.env.*`, `firstbad-demo/`.
- Kane always runs with cwd = the temp session's `kane/` dir; the session dir is deleted at the end.
- Reports, the spike results and the recorded run are allow-listed and scrubbed; their check
  scripts fail on any token pattern, on the text `.evidence`, or on `session_dir`.
- No secret is ever read, printed, or stored by firstbad; Kane's OAuth token stays inside kane-cli.
- The fix stays on a local branch; firstbad never pushes or opens PRs.

## 11. Testing and task gates

- **Vitest 3.2** with a global setup that compiles `src/` to `dist/` once (`tsc -p tsconfig.json`),
  so integration tests can run the real `dist/oracle-bin.js` under `git bisect run`.
- **Stub Kane** `test/fixtures/stub-kane.mjs` (plain Node): `--version` → `0.10.9`; `balance` →
  `Available credits: <STUB_KANE_BALANCE or 11178.5769>`; `run …` → scenario chosen from the JSON
  plan at `STUB_KANE_PLAN` by `FIRSTBAD_LABEL` substring rules (with per-rule call sequences counted
  in `<STUB_KANE_LOG>.state.json`), logging each invocation to `STUB_KANE_LOG`. Scenarios: `pass`,
  `fail`, `misphrased` (empty `final_state`, triage `automation_bug`/`config_issue`), `error`
  (transient exit 2), `auth` (exit 2 auth text), `timeout` (exit 3, no `run_end`), `hang` (never
  exits), `upload-failed` (exit 1, `run_end.status: passed`), `crash` (stack on stderr, exit 1, no
  stdout), `prose` (non-JSON first line, then hangs), `false-pass` (exit 0, passed, wrong value),
  `token-leak` (failed, reason contains a bearer JWT).
- **Stub shop Kane** `test/fixtures/stub-kane-shop.mjs`: emulates Kane against the demo shop by
  fetching `pricing.js` and `catalog.js` from the served URL and computing the real total.
- **Stub agent** `test/fixtures/stub-agent.mjs`: modes `write`, `noop`, `fail`,
  `restore-from-parent` (reads `First bad commit: <sha>` from the prompt and restores
  `STUB_AGENT_FILE` from `<sha>^`), optional `STUB_AGENT_NOOP_FIRST=1`.
- **No task gate calls live Kane.** The two LIVE tasks run one script once (the step that spends
  credits; it may run 5–40 min, so the orchestrator may run that single command itself in the
  background) and their gate only validates the written results offline.

## 12. LIVE tasks

**Day-1 spike** (first live task): `scripts/spike/run-spike.mjs` against a tiny local page
(`http://127.0.0.1:4199/`, `Total: $18.00` or `Total: $20.00`), do `look at the order summary`,
store `the total amount shown next to the word Total`, expected `$18.00`. The nested-agent smoke
runs first because it costs no credits:
1. **Nested-agent smoke** (no credits): in a temp dir with `hello.txt` = `old`, spawn the planned
   agent argv via `cross-spawn`, prompt on stdin, `CLAUDECODE` removed; pass when `hello.txt` is
   exactly `new`. If that route fails, try the prompt as a trailing argument and record which route
   worked.
2. Balance before (floor check); `kane-cli --version`; `kane-cli testmd --help` (free, recorded).
3. **Template selection** on the `$18.00` page: try the candidates in order (`commas-assert`,
   `sentences-assert`, `store-only`), each a full `run --name firstbad-spike-<id>`; the first whose
   `run_end` is well-formed and whose `final_state.observed` matches `$18.00` is chosen.
4. Chosen template on the `$20.00` page: full `run` → expect observed `$20.00` (and, for an assert
   template, status failed).
5. Replay the chosen recording with `testmd run <recording> --agent --headless --timeout 300` on
   the `$20.00` page (expect failed) and on the `$18.00` page (expect passed).
6. Balance after; delta. Every run records exit code, **wall-clock seconds**, whether
   `stream_start` was the first line, whitelisted `run_end` / `test_md_done` fields and
   `final_state.observed`.
Outputs `docs/spike/spike-result.json`, `docs/spike/kane-spike.md`, and the rewritten
`src/kane-profile.ts`. Decisions recorded: `chosenTemplate`, `verdictMode` (`value-only` when the
chosen template is `store-only` or any Kane status disagreed with its stored value),
`localRunEndWellFormed`, `replayFaithful`, `replayHasValues`, `nestedAgent.ok` + `route`. At most
`FIRSTBAD_SPIKE_MAX_RUNS` (8) credit-consuming runs. Gate `node scripts/spike/check-spike.mjs`
prints `PASS` only when a template was chosen with a well-formed local `run_end`, the nested agent
worked by some route, `src/kane-profile.ts` matches the result, and no token pattern appears; it
prints `FLAG:` lines for anything the orchestrator must surface (stdin route failed, replay
unfaithful, `value-only` mode).

**Live demo hunt** (last must-have): `scripts/live-demo.mjs` runs `node dist/cli.js demo` with
`FIRSTBAD_MAX_RUNS=24` and `FIRSTBAD_KANE_TIMEOUT_SEC=300` (unless set), real kane-cli and the default Claude Code agent, in a temp dir;
tees a scrubbed transcript and copies the report into `docs/demo/recorded-run/` (`report.md`,
`report.json`, `transcript.txt`). Gate `node scripts/check-recorded-run.mjs` → `PASS` when the hunt
is `confirmed` on `refactor(cart): extract price helpers`, the fix is `verified`, the timeline has a
SKIP, Kane runs ≤ 24, and no token/evidence pattern appears.

## 13. Task tiers and DAG shape

- **must-have** (the cut line never crosses these): scaffold, LIVE spike, Kane I/O, check+verdict,
  probe stack, oracle+hunt, agent+fix, report+CLI, the three demo-fixture tasks, demo wiring + e2e,
  README, LIVE demo hunt.
- **droppable**: `firstbad clean` + Ctrl+C cleanup + colored output.
- **stretch** (only after the LIVE demo hunt is green): replay re-verification (only if
  `replayFaithful` and `replayHasValues` are both true in the spike result), the `--objective`
  escape hatch.
- The demo-fixture branch (shop files → history generator → demo skeleton with the shop stub)
  depends only on the scaffold and runs alongside the core chain. The LIVE spike also depends only
  on the scaffold: it is the first task dispatched after it, and the core chain proceeds while it
  runs (core tests pass explicit template/mode values and never read the profile). The LIVE demo
  hunt depends on the spike. The LIVE demo hunt depends on
  every must-have task (and the droppable one unless it is cut).

## 14. Known limits (go into the README)

- Two bugs with different bad values in one range can make bisect skip the true culprit (the commit
  shows a third value and is skipped); the confirm step catches this and reports `unconfirmed`.
- A busy port aborts with a clear error instead of testing someone else's server.
- One stored value per check; serial Kane runs only; each Kane run takes real minutes and credits.
- Built and exercised on Windows 10; the macOS/Linux code paths (process-group kill, `sh` setup and
  serve commands) are implemented but were not run on those OSes during the event.

## 15. Design decisions (question → answer → source)

1. Check input shape → structured `--do/--store/--expect`, store-first objective always generated,
   value compared against both the expected value and the bad ref's value; `--objective` only as a
   stretch task → user, 2026-11-25.
2. Who runs the live Kane tasks → the orchestrator, budget-guarded (floor 500, caps 4 spike / 16
   hunt, env-configurable), results/report never contain tokens or evidence, `.testmuai/` and
   `*.evidence` git-ignored; spike first, live demo hunt only after every other task is green against
   the stub → user, 2026-11-25.
3. Bisect driver → real `git bisect run` with `firstbad oracle` in a disposable worktree → user
   approved approach 1.
4. Task count ~14–15 must-haves, demo-fixture branch parallel, priority tier per task, agent-fix loop
   must-have → user.
5. Spike adds a nested-agent smoke (no credits) and per-run wall-clock seconds → user.
6. Live demo hunt runs with `FIRSTBAD_MAX_RUNS=24`; the default stays 16 → user.
7. Exit codes, port 4173 on 127.0.0.1, judge path clone → `npm ci` → `npm run build` →
   `node dist/cli.js demo`, no npm publish → user approved section-8 defaults.
8. Pins: TypeScript 5.9.3, Vitest 3.2.7, @types/node 22.20.7, cross-spawn 7.0.6,
   @types/cross-spawn 6.0.6 (npm `latest` is TypeScript 7 / Vitest 5; pinned to the lines executors
   know) → architect, derived.
9. Kane cwd = temp session dir (evidence never in the repo); the agent env drops `CLAUDECODE` so a
   nested `claude -p` runs from inside Claude Code → architect, derived from the pack and the
   nested-agent requirement.
10. Objective wording → cookbook style (comma-chained, plain-English stored-value reference, never
    `{{…}}`), an ordered candidate list, the spike picks one and writes `src/kane-profile.ts`; the
    last candidate is store-only with firstbad comparing the value; `verdictMode` honored by
    `classify()` → user, after the 2026-11-25 example.com probe (result_code 750, store clause
    dropped).
11. Empty observed value retried once (counts against the cap) before SKIP / mis-phrased abort;
    Kane timeout default 300 s; spike cap 8 → user, same probe (one trivial 4-step run ≈ 160 s wall
    clock; balance fell 26.35 while `credits_consumed` said 15.2).

## 16. Resolved by the spike (not guessed in the core plan)

- Which objective template Kane actually follows (store, then judge), and whether its own
  assertion status can be trusted (`verdictMode`).
- Whether a local `http://` run returns a well-formed `run_end` (blocking if not).
- The exact `testmd` replay syntax and whether its output carries stored values (decides the
  replay stretch task).
- Real credit and wall-clock cost per run (budget numbers for the README and the demo edit).
- Whether `claude -p` with stdin and `CLAUDECODE` removed edits files when spawned from inside
  Claude Code (if not, the agent adapter's default route changes to the prompt-as-argument route).
