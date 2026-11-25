<!-- readme-schema: R3-cli-tool v1 -->
# firstbad

git bisect with a real-browser oracle: Kane CLI tests each commit, names the first bad one, and proves your agent's fix.

## Demo

- Demo video: TBD-post-build:demo-video-url
- Terminal recording: TBD-post-build:terminal-gif
- Recorded live run (the fallback if you cannot run Kane yourself): [docs/demo/recorded-run/report.md](docs/demo/recorded-run/report.md) and the full terminal transcript in [docs/demo/recorded-run/transcript.txt](docs/demo/recorded-run/transcript.txt)

## What it does

A user flow breaks ("the checkout total is wrong"), and the fix is usually a few lines, but finding the commit that broke it means a manual `git bisect`: check out, rebuild, click through the flow, decide good or bad, repeat. Coding agents make this worse, because they land many small commits that nobody clicked through. firstbad automates the whole loop. You describe the check in plain English (what to do on the page, which value to store, what it should be), name a known-good ref and say how to serve your app. firstbad proves the check fails on the bad ref and passes on the good one, then lets `git bisect run` drive Kane CLI, one real headless Chrome run per commit, until it names the first bad commit, and confirms it against its parent. A commit that fails for a different reason (it does not build, the page never loads, it shows some other value) is skipped, not blamed. Then it hands the culprit's diff and Kane's failing result to your coding agent and re-runs Kane on the patched tree until it passes.

## Quickstart

```bash
npm install -g @testmuai/kane-cli
kane-cli login --oauth
git clone https://github.com/Dotman-Bei/firstbad
cd firstbad
npm ci
npm run build
node dist/cli.js demo
```

`demo` generates a 40-commit "Corner Shop" history in `./firstbad-demo/shop` (the same commit SHAs on every machine), hunts its planted checkout regression with Kane, skips an unrelated broken stretch of history, confirms the culprit, asks Claude Code to fix it and proves the fix with Kane. The report lands in `./firstbad-demo/report/`. No Claude Code? Run `node dist/cli.js demo --agent none` and firstbad reverts the culprit and proves the revert instead.

## Built at KaneCLI Online Hackathon 2026

- Event: KaneCLI Online Hackathon by TestMu AI (https://www.kaneclihack.sh/), 12 to 26 November 2026.
- Category: 02 WORKFLOW "Workflows with a spine", the page's own "git bisect on autopilot" idea, with the agent loop driven only by Kane's verdicts.
- Team: solo builder (Dotman-Bei) with an AI build pipeline.
- Built during the event: everything in this repository. The first commit is from 25 November 2026.
- Kane CLI is the oracle: its verdict and stored value decide every bisect step, and its failing result is the agent's brief.

## Install

Requirements: Node.js 20 or later, git 2.40 or later, Google Chrome, and kane-cli 0.10.9 or later installed with npm (not pnpm) and logged in. The default agent is the Claude Code CLI (`claude`); any agent that edits files when given a prompt on stdin works.

```bash
npm install -g @testmuai/kane-cli
kane-cli login --oauth
kane-cli balance
git clone https://github.com/Dotman-Bei/firstbad
cd firstbad
npm ci
npm run build
npm link
firstbad --help
```

Every Kane run spends real TestMu AI credits and takes real time: in our runs one short check took about 160 seconds and about 26 credits by the balance (Kane's own `credits_consumed` reported less, so firstbad reports the balance change). A 40-commit hunt with a fix needs about a dozen runs. firstbad refuses to start below `FIRSTBAD_MIN_BALANCE` credits.

## Usage

Hunt the commit that broke your checkout total:

```bash
firstbad hunt --good v1.0 \
  --serve "npm start" --setup "npm ci" \
  --url http://127.0.0.1:3000/ \
  --do "add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply" \
  --store "the total amount shown next to the word Total" \
  --expect "\$18.00"
```

firstbad prints one line per Kane verdict (bracket, bisect, confirm, fix), names the first bad commit, commits the verified fix on a new local branch `firstbad/fix-<sha>` together with `firstbad-report.md` and `firstbad-report.json`, and writes the report to `.git/firstbad/reports/<time>/` (or `--out <dir>`). It never pushes and never touches your checkout: the hunt runs in a disposable git worktree.

Use only the oracle inside your own bisect:

```bash
firstbad oracle --session <session.json>
```

## Commands / API reference

| Command | What it does |
|---|---|
| `firstbad hunt --good <ref> --url <url> --do "<steps>" --store "<what>" --expect "<value>" --serve "<cmd>"` | Bracket, bisect, confirm and fix. Options: `--bad <ref>` (default `HEAD`), `--setup "<cmd>"` (run per commit), `--agent "<cmd>"` or `--agent none`, `--no-fix`, `--out <dir>`, `--repo <path>` |
| `firstbad demo [--dir <path>] [--port <n>] [--agent "<cmd>" \| --agent none] [--no-fix] [--force]` | Generate the Corner Shop history and run the whole loop on it |
| `firstbad oracle --session <file>` | A `git bisect run` script: exit 0 good, 1 bad, 125 skip, 128 abort |
| `firstbad clean [--repo <path>]` | Remove leftover firstbad worktrees and session folders |
| `firstbad --version`, `firstbad --help` | Version and usage |

Exit codes of `hunt` and `demo`: 0 = confirmed culprit and a fix Kane verified (or `--no-fix`), 1 = the hunt ran without that, 2 = usage error, 3 = preflight failed (kane-cli missing or older than 0.10.9, not logged in, balance below the floor, bad refs).

| Environment variable | Default | Purpose |
|---|---|---|
| `FIRSTBAD_KANE` | `kane-cli` | The Kane command |
| `FIRSTBAD_MIN_BALANCE` | `500` | Refuse to start below this many credits |
| `FIRSTBAD_MAX_RUNS` | `16` | Cap on Kane runs per hunt (retries count) |
| `FIRSTBAD_MAX_FIX_ATTEMPTS` | `3` | Agent attempts before giving up |
| `FIRSTBAD_KANE_TIMEOUT_SEC` | `300` | Kane `--timeout`; firstbad kills Kane 60 s later |
| `FIRSTBAD_AGENT_TIMEOUT_SEC` | `900` | Kill timer for one agent attempt |
| `FIRSTBAD_READY_TIMEOUT_SEC` | `30` | How long the served URL may take to answer |
| `FIRSTBAD_SETUP_TIMEOUT_SEC` | `600` | Kill timer for the setup command |
| `FIRSTBAD_KEEP_SESSION` | unset | `1` keeps the temporary session folder (it holds Kane evidence packs: never commit it) |
| `NO_COLOR` | unset | Plain output |

## How it works

1. **The check becomes a Kane objective.** firstbad writes the objective itself, in the comma-chained, store-first style Kane's own cookbook recommends ("go to the URL, do the steps, then store the value in a variable named 'observed'"), and compares the stored value itself; Kane's own pass or fail is only an error signal. A live spike against Kane CLI 0.10.9 chose this wording: when the objective also asked Kane to assert the expected value, Kane failed the run on the page with the wrong total and kept no stored value, so the bad commit would have had no value to recognize it by. Kane sometimes stores the value under names of its own (the spike saw `total`; the first live demo run saw `cart_total` next to `discount_code`): firstbad reads `observed` when it is there, otherwise the single stored key other than the page URL, otherwise the one stored key whose name shares a word with your `--store` phrase (`cart_total` shares "total" with "the total amount shown next to the word Total"). No match, or more than one, counts as no value, and firstbad never picks a key by its value; when it reads no value, the report lists the key names Kane returned (names only, never values). Whichever key it came from, the value is still compared with the expected value and with the bad commit's value.
2. **Bracket.** Kane must fail the bad ref with a stored value (that value becomes the bad signature) and pass the good ref. A run where Kane cannot store anything is retried once and then reported as a mis-phrased check, never as a bug.
3. **Bisect.** `git bisect run` calls `firstbad oracle` for each commit inside a disposable worktree. The oracle runs your setup, starts your server, waits for the URL, runs one serialized, headless, time-limited Kane check and maps the result: PASS (exit 0) when the stored value matches what you expect, FAIL (exit 1) when it matches the bad signature, SKIP (exit 125) when the commit fails differently (no build, no page, a Kane error after one retry, a third value), ABORT (128) on auth errors or the run cap. It reads both Kane's `run_end` and the stored value, so an upload failure (exit 1 with a passing `run_end`) is not a failure, and a Kane "pass" that stored the wrong value is caught.
4. **Confirm.** The first bad commit is re-tested together with its parent: culprit FAIL and parent PASS, or the hunt reports it as unconfirmed.
5. **Fix.** The culprit's diff, Kane's failing summary and the check go to your agent (default: `claude -p` limited to the Read, Edit, Write, Glob and Grep tools) on a new branch. Kane re-runs the same check on the patched tree; a failure goes back to the agent, up to three attempts. A pass is committed with the report.
6. **Safe to commit.** Kane runs in a temporary folder, so its `.testmuai/` output and evidence packs (which can hold bearer tokens) never enter your repository. Reports keep an allow-list of fields and are scrubbed of anything token-shaped.

## Roadmap

Known limits:

- Two bugs with different bad values in one range can make bisect skip the true culprit, because that commit shows a third value. The confirm step catches this and reports the hunt as unconfirmed.
- A busy port aborts the hunt with a clear error instead of testing someone else's server.
- One stored value per check, and Kane runs are serial: each one takes real minutes and credits.
- Built and exercised on Windows 10. The macOS and Linux code paths (process-group kill, `sh` setup and serve commands) are implemented but were not run on those systems during the event.

Next: a raw `--objective` escape hatch for checks that do not fit the store-and-compare shape, cheaper re-verification by replaying Kane's recorded test where replays prove faithful, and a GitHub Action that runs a hunt when a flow check starts failing.

## License

MIT, see [LICENSE](LICENSE).
