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
| `FIRSTBAD_SPIKE_MAX_RUNS` | `8` | Cap on credit-consuming Kane invocations in the day-1 spike (room to try template candidates). Not read by the spike re-run. |
| `FIRSTBAD_SPIKE_RERUN_MAX_RUNS` | `4` | Cap on credit-consuming Kane invocations in spike re-run attempt 2 (core Task 2.1): one run plus at most one retry per page, independent of the day-1 count. Values above 4 are clamped to 4; below 2 the re-run refuses. |
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

**Ordered template candidates** (`TemplateId`, considered in this order by the day-1 spike). A
template is accepted only if it stores the value on **both** spike pages: `$18.00` on the passing
page and `$20.00` on the failing page. Storing on the passing page alone is not enough: the hunt
needs the bad ref's stored value to set the bad signature (section 4 bracket rules).

| id | Template (exact) | Kane asserts? | Day-1 spike evidence (2026-11-25) |
|---|---|---|---|
| `commas-assert` | `Go to {url}, {do}, store {store} as 'observed', then assert the stored observed value is "{expected}"` | yes | **eliminated** — stored `$18.00` on the `$18.00` page, but on the `$20.00` page (run `fail-page-commas-assert`) the failed assertion failed the run: `status failed`, `result_code 710`, `final_state {}`, no stored value |
| `sentences-assert` | `Go to {url}. {do}. Store {store} as 'observed'. Then assert that the stored observed value is "{expected}".` | yes | **eliminated without a run** — assertion-bearing, so it shares the cause recorded in `fail-page-commas-assert` |
| `store-only` | `Go to {url}, {do}, then store {store} in a variable named 'observed'` | **no** — firstbad compares the value itself; Kane's status is only an error signal | the only remaining candidate. Re-run attempt 1, with the old wording `Go to {url}, {do}, then store {store} as 'observed'`, on the `$18.00` page: status passed, result_code 100, Kane read `$18.00` but stored it under its own key (`final_state` keys `url, total`), so the parser of the time found no value and the re-run stopped. Attempt 2 (core Task 2.1, after core Task 3.1 changed the wording and the parser) runs it on the `$18.00` page and then the `$20.00` page and chooses it, with `value-only`, only if both pages return their own value |

`{do}` and `{store}` are trimmed and lose trailing `.`/`,` characters before insertion. Every
template asks Kane to store the value as `observed` (store-only: "in a variable named 'observed'");
Kane does not always obey, so firstbad reads the value back with the `final_state` rule in
section 4. Validation: `url` must start with `http://` or `https://`; `do`, `store`,
`expected` non-empty after trim; none of them may contain `{{`; `expected` must not contain `"`.

**The Kane profile** (`src/kane-profile.ts`, a committed constant): `{ template: TemplateId;
verdictMode: 'status+value' | 'value-only'; agentPromptRoute: 'stdin' | 'arg'; source: string }`.
The scaffold creates it with `commas-assert` / `status+value` / `stdin` /
`default (spike not yet run)`. `agentPromptRoute` is how the fix loop hands the prompt to the agent
(on stdin, or as the last argv entry); the spike's nested-agent smoke sets it. The day-1 spike **rewrites it**
with the template it chose and the verdict mode it measured; the spike gate fails if the file and
`docs/spike/spike-result.json` disagree. Core code reads only this constant. `verdictMode` is
`value-only` when the chosen template is `store-only`, or when Kane's own assertion status disagreed
with the stored value in any spike run; otherwise `status+value`. Task 2 first wrote
`commas-assert` / `status+value`; that choice was wrong (it lost the value on the `$20.00` page), so
the spike re-run (Task 2.1, attempt 2) is the only writer that may set the final profile, and it
writes `store-only` / `value-only` only when store-only returned its own value on both pages. If
store-only fails on either page the re-run stops, leaves the profile unchanged and the user decides.
The spike gate fails while any spike artifact still names `commas-assert` as the chosen template.

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
   failure, not a failed check). Let `observed` be the value `observedFrom()` (`src/kane/ndjson.ts`)
   reads from `final_state` (string, trimmed; non-string → JSON string), in this order (decision 14):
   1. `final_state.observed` if that key is present;
   2. otherwise, if exactly one key other than `url` exists, that key's value (it needs no name
      match: Task 3.1's rule, kept);
   3. otherwise, of the two or more candidate keys (every key except `url`), the **one** whose name
      shares a word with the check's `store` phrase. Words: a key name is split at camelCase
      boundaries (`cartTotal` → `cart Total`, `HTMLTotal` → `HTML Total`), then on every run of
      characters that are not letters or digits, and lowercased; the store phrase is split on every
      run of non-letters/non-digits and lowercased; empty pieces are dropped; "shares a word" = the
      two word sets intersect (whole words: `subtotal` does not match `total`; no stop-words are
      removed). `cart_total` shares `total` with "the total amount shown next to the word Total",
      `discount_code` shares nothing, so `cart_total` is chosen;
   4. otherwise — no match, two or more matches, no candidate, or no store phrase passed (callers
      such as the spike script that call `observedFrom(finalState)` with one argument keep rules 1–2
      only) — empty, retried once like any empty value.

   A key is never chosen by its value. A value read from a key other than `observed` gets no
   shortcut: it is judged by exactly the rules below (compared with `expected` and with the bad
   signature; in `status+value` mode a status/value disagreement is still SKIP), so a wrong key
   cannot pass a commit.
   - `observed` empty → **retried once** like a transient (the retry counts against the run cap);
     still empty → **SKIP** `Kane could not read the value (final_state keys: <names, or none>; <n>
     non-url key(s))` followed by `: <Kane's summary>` when there is one, e.g. `Kane could not read
     the value (final_state keys: url, cart_total, discount_code; 2 non-url keys): …` — key names
     only, never values (flag `misphrased` when the `run_end` blames the test: its raw JSON contains
     `automation_bug` or `config_issue`). In the bracket phase this is the "mis-phrased" abort.
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
  JSON → terminal mode → kill. Keep `stream_start`, `run_end` (whitelisted fields only; `final_state` is reduced to the one stored value by the
  section-4 rule, plus the key it was read from (`observedKey`) and the `final_state` key names
  (`finalStateKeys`: names only, never values; at most 30, each scrubbed and cut to 64 chars)), the text of
  `type: error` events, and step counts. `credits_consumed` falls back to `credits`.
- The section-4 key rule needs the check's store phrase: `probe()` passes `store: check.store` in
  `RunKaneOptions`, `runKane()` hands it to `parseKaneStream(stdout, store?)`, which hands it to
  `observedFrom(finalState, store?)`. All three parameters are optional, so a caller without a
  store keeps the one-key rule. The store phrase is never sent to Kane as an argument of its own
  (argv is unchanged).
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
  observedKey?: string;        // the final_state key the value was read from (value-bearing outcomes)
  finalStateKeys?: string[];   // every final_state key NAME Kane returned, on an empty-value outcome
}
```

- **Key names, permanently (decision 14)**: every empty-value outcome records the `final_state`
  key names (never their values) in `finalStateKeys` and, with the count of non-`url` keys, in
  the reason (`Kane could not read the value (final_state keys: url, cart_total, discount_code;
  2 non-url keys): …`), so the names reach `report.json`, the `report.md` timeline's Reason
  column, the terminal timeline and the hunt's abort message. A value-bearing outcome records
  `observedKey`. Both fields are optional, set only by `probe()`, and travel through the ledger,
  the oracle relay and `buildReport()`'s `scrubDeep()` unchanged; `report.md` has no new column.
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
  `token-leak` (failed, reason contains a bearer JWT), `fetch` (stores the page text as
  `observed`), `multikey` (the live shape of decision 14: fetches the page, status passed,
  result_code 100, `final_state { url, cart_total: <page text>, discount_code: 'SAVE10' }`).
- **Stub shop Kane** `test/fixtures/stub-kane-shop.mjs`: emulates Kane against the demo shop by
  fetching `pricing.js` and `catalog.js` from the served URL and computing the real total. With
  `STUB_SHOP_FINAL_STATE=multikey` it returns `final_state { url, cart_total, discount_code }`
  (what live Kane returned) instead of `{ observed }`; the demo end-to-end test runs that way, so
  its full hunt and fix go through the store-phrase name match. `clearStubEnv()` clears the variable.
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
   `sentences-assert`, `store-only`), each a full `run --name firstbad-spike-<id>`, until one has a
   well-formed `run_end` whose `final_state.observed` matches `$18.00`.
4. That template on the `$20.00` page: full `run` → it must store `$20.00` (and, for an assert
   template, report status failed). **A template is chosen only if it stored the value on both
   pages**; passing the `$18.00` page alone is not enough.
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
(rewritten by Task 2.1; never calls Kane) prints `PASS` only when the result is re-run attempt 2's
(`spikeVersion` 2, `attempt` 2), the chosen template is `store-only` with verdict mode
`value-only`, attempt-2 store-only runs returned `$18.00` on the `$18.00` page **and** `$20.00` on
the `$20.00` page, each of those runs records the `final_state` key it was read from
(`observedKey`, mirrored per page in `observedKeys`) and every attempt-2 run records the exact
store-only objective it sent, the attempt-2 runs stay within the cap of 4, the day-1 runs and
attempt 1's run are carried, `templates[]` marks `store-only` accepted and both assert templates
eliminated, the local `run_end` was well-formed, the nested agent worked by some route,
`src/kane-profile.ts` records `store-only` / `value-only`, `docs/spike/kane-spike.md` names
`store-only` as chosen (and never `commas-assert`), and no token, evidence-path or `session_dir`
text appears in `spike-result.json`, `kane-spike.md` or `rerun-1-stop.json`; it prints `FLAG:`
lines for anything the orchestrator must surface (the stored key per page, a key other than
`observed`, stdin route failed, replay unfaithful, `value-only` mode, the re-run balance).

**Day-1 spike evidence (2026-11-25, kane-cli 0.10.9, commit `af63046`).** Nested agent ok via stdin.
`commas-assert` stored `$18.00` on the `$18.00` page (status passed, result_code 100), but on the
`$20.00` page Kane's assertion failed and the run kept nothing: `status failed`, `result_code 710`,
`final_state {}`, summary "the agent's read step did not store that amount in {{observed}}". With
that template the hunt's bracket of the bad ref would get an empty value and abort "your check looks
mis-phrased". Both `testmd` replays passed on both pages with no values (`replayFaithful: false`,
`replayHasValues: false`): re-verification stays on full runs and the replay stretch task is not
authored. Balance 11152.2235 → 11110.4166 (delta 41.8069; `credits_consumed` sum 38.22); mean
95.3 s per Kane invocation.

**Spike re-run, attempt 1** (the first version of core Task 2.1, LIVE, 2026-11-25T16:58Z, user
decision 2026-11-25; its output was never committed): it carried the day-1 runs, eliminated
`commas-assert` and `sentences-assert` without runs, and ran `store-only` with the old wording
(`Go to {url}, {do}, then store {store} as 'observed'`) on the `$18.00` page: exit 0, `run_end`
status `passed`, reason "Objective completed", result_code 100, `final_state` keys `url, total`,
summary "Read the amount shown next to “Total”: $18.00." Kane read the right value but stored it
under its own key, and the parser of the time (only `observed`, or a one-key `final_state`)
returned an empty value, so the re-run stopped as designed and skipped the `$20.00` page. Balance
11110.4166 → 11091.7249 (delta 18.6917). Its run is kept, whitelisted, in
`docs/spike/rerun-1-stop.json`.

**Spike re-run, attempt 2** (core Task 2.1 as rewritten, LIVE, user decision 2026-11-25 after
attempt 1; it runs after core Task 3.1, which changed the parser to the section-4 `final_state`
rule and the store-only wording to "in a variable named 'observed'"): `npm run build`, then the
rewritten `scripts/spike/run-spike.mjs`, once. The script imports `composeObjective`,
`valuesMatch` and `observedFrom` from `dist/`, so it sends firstbad's exact objective and parses
`final_state` with firstbad's exact rule; it refuses, without spending, when `dist/` is missing or
still composes the old wording. It reads the day-1 evidence with
`git show af63046:docs/spike/spike-result.json` and attempt 1 from `docs/spike/rerun-1-stop.json`,
then runs only `store-only` on the `$18.00` page and then the `$20.00` page with the probe's argv
(`run <objective> --agent --headless --timeout 300 --max-steps 25`); a page whose run returns an
empty value is retried once (a wrong non-empty value is not). Budget: its own cap of 4
credit-consuming runs (`FIRSTBAD_SPIKE_RERUN_MAX_RUNS`), independent of the day-1 count. Both
pages return their own value (`$18.00`, `$20.00`) → choose `store-only` with `value-only` and
rewrite `src/kane-profile.ts`. Either page still without its value → stop, print and record the
raw `run_end` fields (status, reason, result_code, `final_state` keys, `observedKey`, observed),
leave the profile unchanged, exit 1; the task reports BLOCKED and the user decides — nothing is
built on a guess. Every run records `observedKey` (the key its value came from) so the user can see
how Kane's key choice varies. Credit guard: balance readable and at least `FIRSTBAD_MIN_BALANCE`
before, measured before and after and reported. It writes `spikeVersion: 2`, `attempt: 2` with a
`templates[]` verdict per candidate, the carried `day1` and `rerun1` summaries, `observedKeys` and
every run record, and refuses a second attempt-2 run.

**Live demo hunt** (last must-have): `scripts/live-demo.mjs` runs `node dist/cli.js demo` with
`FIRSTBAD_MAX_RUNS=24` and `FIRSTBAD_KANE_TIMEOUT_SEC=300` (unless set), real kane-cli and the default Claude Code agent, in a temp dir;
tees a scrubbed transcript and copies the report into `docs/demo/recorded-run/` (`report.md`,
`report.json`, `transcript.txt`). Gate `node scripts/check-recorded-run.mjs` → `PASS` when the hunt
is `confirmed` on `refactor(cart): extract price helpers`, the fix is `verified`, the timeline has a
SKIP, Kane runs ≤ 24, and no token/evidence pattern appears.

## 13. Task tiers and DAG shape

- **must-have** (the cut line never crosses these): scaffold, LIVE spike and its re-run, Kane I/O,
  observed-key parsing + store-only wording, check+verdict,
  probe stack, oracle+hunt, agent+fix, report+CLI, the three demo-fixture tasks, demo wiring + e2e,
  README, LIVE demo hunt.
- **droppable**: `firstbad clean` + Ctrl+C cleanup + colored output.
- **stretch** (only after the LIVE demo hunt is green): replay re-verification (only if
  `replayFaithful` and `replayHasValues` are both true in the spike result), the `--objective`
  escape hatch.
- The demo-fixture branch (shop files → history generator → demo skeleton with the shop stub)
  depends only on the scaffold and runs alongside the core chain. The LIVE spike also depends only
  on the scaffold: it is the first task dispatched after it, and the core chain proceeds while it
  runs (core tests pass explicit template/mode values, or use stub Kane scenarios whose verdicts
  do not depend on the template, so they pass under any profile). The spike re-run (Task 2.1)
  depends on the spike and on Task 3.1 (observed-key parsing and the store-only wording, built and
  tested against the stubs first, no credits). The README and the LIVE demo hunt depend on the re-run, and the LIVE demo
  hunt depends on every must-have task (and the droppable one unless it is cut).

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
12. Template selection needs the stored value on both spike pages; the recorded day-1 evidence is
    reused (`commas-assert` proven to lose the value on the `$20.00` page, `sentences-assert`
    eliminated by the same cause without a run); only `store-only` is re-run, on `$18.00` then
    `$20.00` (about 2 runs); both stored → `store-only` + `value-only`; otherwise stop and report the
    raw `run_end` fields; the profile is still written only by the spike; the credit guard stays →
    user, 2026-11-25, after the day-1 spike's `fail-page-commas-assert` run.
13. Observed-key parsing and the store-only wording → read `final_state.observed` if present; else,
    if exactly one key other than `url` exists, its value; two or more candidate keys → empty value
    (retried once like any empty value), never a guess between keys; the key used is recorded per
    spike run (`observedKey`) so the variance is visible; the existing safeguards stay unchanged
    (the value is still compared with the expected value and with the bad ref's value, and a
    status/value disagreement is still SKIP; a value from a non-`observed` key is never accepted
    without that check); the store-only objective becomes
    `Go to {url}, {do}, then store {store} in a variable named 'observed'` (comma-chained, no
    `{{…}}`); re-run the spike, store-only on `$18.00` then `$20.00`, at most 4 credit-consuming
    runs so each page can be retried once; choose `store-only` / `value-only` only if both pages
    return their own value, otherwise stop and report the raw `run_end` fields and the
    `final_state` keys; the spike gate, `docs/spike/kane-spike.md` and this spec no longer say
    `commas-assert` is chosen; unit tests cover the three parser cases → user, 2026-11-25, after
    re-run attempt 1 (`select-store-only`: passed, result_code 100, `final_state` keys
    `url, total`, observed empty; balance 11110.4166 → 11091.7249).
14. Several non-url `final_state` keys → choose the key by name only: `observed` if present; else
    the single non-url key (kept from decision 13, no name match needed); else the one key whose
    name shares a word with the store phrase (tokenisation in section 4); none or several match →
    empty value, retried once; never choose by value; the value is still compared with the
    expected value and the bad ref's value, so a wrong key cannot pass a commit. Permanently
    record, for every empty-value outcome, the `final_state` key names (names only) and the count
    of non-url keys in the ledger and the report (section 8). Unit-test the rule (observed
    present; one other key; several keys, one name match; several keys, no match; only url), keep
    the offline gates green, then re-run the LIVE demo hunt (ship Task 15) once with
    `FIRSTBAD_MAX_RUNS=24` and balance ≥ 500 → user, 2026-11-25 (pre-approved fix "3a" plus
    permanent diagnostics), after ship Task 15's first LIVE run aborted at the bracket: the bad ref
    stored `$20.00` (FAIL), but on the good ref `v1.0` Kane's summary said the total was `$18.00`
    while firstbad read an empty value twice ("the good ref does not pass the check"). One
    diagnostic LIVE run of the same store-only objective on `v1.0`: status passed, result_code 100,
    `final_state` keys `url`, `cart_total` (`$18.00`), `discount_code` (a 6-character non-money
    string), 2 non-url keys, so the decision-13 rule correctly refused to guess (balance
    11002.9217 → 10983.139). Implemented by core Task 3.2.

## 16. Resolved by the spike (not guessed in the core plan)

- Which objective template Kane actually follows (store, then judge), and whether its own
  assertion status can be trusted (`verdictMode`). Day 1: an assertion-bearing objective loses the
  stored value when the assertion fails, so the assert templates are out. Re-run attempt 1:
  `store-only` read the value, but Kane stored it under its own key (`total`), which the parser of
  the time missed. Attempt 2 (Task 2.1, after Task 3.1's parser and wording change) decides whether
  `store-only` (with `value-only`) returns the value on both pages, and records which key Kane used
  on each. The first LIVE demo hunt (ship Task 15) then showed a third shape on the full demo check:
  several keys (`url`, `cart_total`, `discount_code`) for one stored value, resolved by the
  store-phrase name match of decision 14 (core Task 3.2) instead of a guess.
- Whether a local `http://` run returns a well-formed `run_end` (blocking if not).
- The exact `testmd` replay syntax and whether its output carries stored values (decides the
  replay stretch task). Day 1: `testmd run <recording> --agent --headless --timeout 300` passed on
  both pages and carried no values, so the replay stretch task is not authored.
- Real credit and wall-clock cost per run (budget numbers for the README and the demo edit).
- Whether `claude -p` with stdin and `CLAUDECODE` removed edits files when spawned from inside
  Claude Code (if not, the agent adapter's default route changes to the prompt-as-argument route).
