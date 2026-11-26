<!-- demo-script-schema: v1 -->
# firstbad — demo script

## 0 — Production card

| field | value |
|---|---|
| Project | firstbad |
| Event | KaneCLI Online Hackathon by TestMu AI |
| Target length | 3:45 |
| Resolution / fps | 1920×1080 @ 30 |
| Voice | Kokoro |
| Music | off |
| Wallet on camera | N/A (no wallet in this project) |
| Upload target | manual: the user uploads to YouTube (UPLOAD not authorized for this session) |
| Schema | v1 |

## 1 — Story & time budget

Prove: pointed at a 40-commit history, firstbad uses real-browser Kane CLI runs to name the first bad commit (fc2879c) after skipping three commits that failed for a different reason, and Claude Code's fix is accepted only after a Kane run reads the correct total.
Money shot: scene S8 (the payoff completes in S10, where the fix is proven).

| criterion | weight | seconds |
|---|---|---|
| Ships: "A real flow that runs end to end. Not slides." (S1, S3) | 25% | 38 |
| Verified: "Kane CLI caught or confirmed something meaningful." (S4, S5, S6, S8) | 25% | 86 |
| Closed loop: "Kane's result feeds back to the agent. Tighter is better." (S7, S9, S10) | 25% | 66 |
| Craft: "Would a developer want to install this tonight?" (S2, S11, S12) | 25% | 35 |

Total 225 s. The four weights are equal; seconds lean to Verified, then Closed loop, because ties break in that order. The gate bars are each on screen: works end to end (S3 to S10), Kane caught or proved something (S5, S8, S10), agent and Kane talked (S9, S10).

## 2 — Pre-flight — set up before recording

| # | item | how to verify | ✓ |
|---|---|---|---|
| 1 | App running — Corner Shop generated with `generateDemoRepo()` from `dist/demo/generate.js` into a temp folder, served at HEAD `6f9b864` with `node server.js 4173` | `http://127.0.0.1:4173/` responds; generated HEAD SHA starts `6f9b864` | |
| 2 | Demo data — `docs/demo/recorded-run/` (report.md, report.json, transcript.txt); the agent's diff from fix commit `617eb8f` of that run (kept in its local demo repo, not in the committed run files; copied to `demo/data/`); share pages for timeline rows 1, 12, 13, 14 | `node scripts/check-recorded-run.mjs` prints PASS; each share page shows its total on the last step with no login | |
| 3 | Wallet state — N/A: no wallet in this project | N/A | |
| 4 | Browser hygiene — fresh Playwright context in installed Chrome (no profile, logged out), 1920×1080, 100% zoom, no address bar in the captured frame | page text contains no email address; header reads "Someone updated this test case" | |
| 5 | Desktop hygiene — N/A for the desktop itself: nothing records the screen (headless browser capture and Remotion renders only). No token, `.evidence` folder, home path, email or access key in any frame | frame check at QC (§6, hard fail) | |
| 6 | Capture toolchain — tollgate card green; versions: Remotion 4.0.543, playwright-core 1.65.1, mediabunny 1.64.0, Kokoro 0.9.4 (already installed locally and proven on this machine; the kit's July pins are past their 60-day freshness window) | `docs/tollgate/2026-11-25-tollgate.md` §6 | |
| 7 | Assets — title card text (S2), outro URL `https://github.com/Dotman-Bei/firstbad` and QR (generated locally), no logo, no music | rendered in the storyboard stills | |

## 3 — Shot list

| id | seconds | visual (route/action/window) | narration cue | driver | wallet verbs | gate assertion | retakes | take |
|---|---|---|---|---|---|---|---|---|
| S1 | 16 | Corner Shop at HEAD: add Tote bag, add Mug, type SAVE10, Apply; push in on "Code SAVE10 applied" and "Total: $20.00". On-screen label: "Demo shop, driven by a script for this video. Not a Kane run." | S1 "This is the…" | screencast | N/A | final frame shows both "Code SAVE10 applied" and "Total: $20.00" | 3 | |
| S2 | 14 | Title card: "firstbad", "git bisect with a real-browser oracle", and the demo check as `--do` / `--store` / `--expect` | S2 "firstbad is a…" | N/A | N/A | all card text readable at 1080p | 3 | |
| S3 | 22 | README Quickstart commands verbatim; then the two steps highlighted: (1) `npm ci` and `npm run build`, (2) `node dist/cli.js demo`; then the first two transcript lines | S3 "Setup is the…" | N/A | N/A | commands match README.md character for character | 3 | |
| S4 | 20 | Terminal replay: bracket lines (bad ref FAIL $20.00, good ref PASS $18.00). Persistent banner: "Replay of the recorded live run, 25 Nov 2026. Time compressed." | S4 "What follows is…" | N/A | N/A | lines match transcript.txt; banner visible | 3 | |
| S5 | 22 | Kane Test Manager share page, run #1 (bad ref), logged out: Autoplay through the steps, end on "Reading the cart total amount", push in on "Total: $20.00". Label: "Real share page from the recorded run, opened logged out." | S5 "Every Kane run…" | screencast | N/A | "Total: $20.00" legible; no name or email on screen | 3 | |
| S6 | 22 | Terminal replay: three SKIP lines (c0eaa8b, 0b42566, 4bb7b51); callout "Different failure: 0 Kane runs, 0 credits" | S6 "Now git bisect…" | N/A | N/A | three SKIP lines with "page never loaded (server exited with code 1)" | 3 | |
| S7 | 18 | Terminal replay: six bisect verdicts beside a commit strip narrowing to one; label "Each Kane run took about 1.5 to 2.5 minutes. Waits cut." | S7 "From here, every…" | N/A | N/A | PASS, PASS, FAIL, PASS, FAIL, FAIL in transcript order | 3 | |
| S8 | 22 | "First bad commit: fc2879c refactor(cart): extract price helpers"; confirm lines; side by side from the real share pages: culprit run #12 "Total: $20.00", parent run #13 "Total: $18.00" | S8 "And there it…" | screencast | N/A | commit line plus both totals legible in one frame | 3 | |
| S9 | 24 | The culprit's diff (`.toLowerCase()`), the brief sections firstbad sends (check, what Kane saw, first bad commit, diff), the replay line "handing Kane's failure to the agent (claude)", then Claude's one-line diff to `.toUpperCase()` | S9 "Now the agent…" | N/A | N/A | both diffs legible; no author or email lines | 3 | |
| S10 | 24 | Kane share page, run #14 (fix), logged out: Autoplay, end on "Total: $18.00"; then replay lines "fix attempt 1 PASS $18.00" and "fix verified on branch firstbad/fix-fc2879c (commit 617eb8f)" | S10 "Kane runs the…" | screencast | N/A | "Total: $18.00" legible; fix-verified line on screen | 3 | |
| S11 | 12 | The committed report: timeline table with links, and "11 Kane runs · 22 minutes · 188.77 credits reported, 200.5 by balance" | S11 "The whole hunt…" | N/A | N/A | figures match report.md and the transcript header | 3 | |
| S12 | 9 | Outro: repo URL and QR, "Built at KaneCLI Online Hackathon 2026", "Recorded run: docs/demo/recorded-run/" | S12 "firstbad. git bisect…" | N/A | N/A | URL and QR readable | 3 | |

## 4 — Narration script

**S1** — This is the Corner Shop. Add a tote bag and a mug, then apply save ten. The page says the code was applied, but the total says twenty dollars. It should be eighteen. Somewhere in forty commits, checkout broke.
words: 39 · planned: 16s @ ~2.4 w/s · tone: calm, setting a puzzle · gloss: save ten → the code SAVE10 (captions show SAVE10)

**S2** — firstbad is a command-line tool that finds that commit. It is git bisect with a real browser as referee. You write one check in plain English, name a good release, and say how to serve your app.
words: 37 · planned: 14s @ ~2.4 w/s · tone: plain, confident · gloss: firstbad → "first bad"; bisect → "by-sect"

**S3** — Setup is the README quickstart: install Kane CLI, log in, clone and build. Then one command: demo. It generates a forty-commit shop history, the same commits on every machine, with one planted checkout bug and one unrelated broken stretch. Then it hunts the bug, asks Claude Code for a fix, and proves it.
words: 53 · planned: 22s @ ~2.4 w/s · tone: practical · gloss: README → "read me"; CLI → "C L I"; Kane → "cane"

**S4** — What follows is a replay of a recorded live run. First, firstbad proves the check can tell good from bad. Kane drives headless Chrome and reads the total. The latest commit shows twenty dollars: fail. Version one shows eighteen: pass. firstbad decides that from the value Kane stored.
words: 48 · planned: 20s @ ~2.4 w/s · tone: matter of fact · gloss: Version one → the tag v1.0

**S5** — Every Kane run leaves a Test Manager page. This is the first one, opened logged out. Kane adds both items, types the code, clicks Apply and reads the total. The steps are green because Kane's job here is to report what the page shows. firstbad compares that with what you expected.
words: 51 · planned: 22s @ ~2.4 w/s · tone: showing evidence · gloss: Test Manager → the TestMu share page

**S6** — Now git bisect takes over, inside a disposable worktree. The first three commits it picks never load: the server crashes on boot. That is a different failure, not this bug, so firstbad skips them. No Kane run, no credits, and no innocent commit blamed.
words: 44 · planned: 22s @ ~2.4 w/s · tone: deliberate, let the three skips land · gloss: worktree → "work tree"

**S7** — From here, every verdict narrows the search. Pass, pass, fail, pass, fail, fail. What Kane reads becomes the exit code git bisect expects, so nobody clicks anything between one commit and the next. Real runs take minutes. The waiting is cut.
words: 41 · planned: 18s @ ~2.4 w/s · tone: building pace · gloss: none

**S8** — And there it is. First bad commit: fc2879c, "refactor cart, extract price helpers". firstbad then tests it again, next to its parent. The culprit: twenty dollars, fail. The parent: eighteen dollars, pass. Confirmed. Kane never saw the code. It only used the shop.
words: 43 · planned: 22s @ ~2.4 w/s · tone: the reveal, slow on the commit · gloss: fc2879c → "F C two eight seven nine C"

**S9** — Now the agent. firstbad hands Claude Code, running headless, the check, the value Kane saw, Kane's report and the culprit's diff. Claude can only read and edit files. Its fix is one line: the refactor lower-cased the discount code, but the code table is upper case. A plausible patch is not proof, so it goes straight back to Kane.
words: 59 · planned: 24s @ ~2.4 w/s · tone: explanatory · gloss: Claude → "clawed"

**S10** — Kane runs the same check on the patched tree. Here is that run, logged out: both items, the code, Apply, and the total reads eighteen dollars. Pass, first attempt. Only then does firstbad commit the fix and its report on a new local branch. A fail would have gone back to Claude, up to three attempts.
words: 56 · planned: 24s @ ~2.4 w/s · tone: resolution · gloss: none

**S11** — The whole hunt: eleven Kane runs, twenty-two minutes, about two hundred credits, and a report that links every run and is safe to commit.
words: 24 · planned: 12s @ ~2.4 w/s · tone: summing up · gloss: none

**S12** — firstbad: git bisect, decided by a real browser. Run the demo, then point it at your own app.
words: 18 · planned: 9s @ ~2.4 w/s · tone: warm close · gloss: firstbad → "first bad"

## 5 — Assembly plan

Order: S1 → S2 → … → S12 (S1 is the cold open; S2 is the title card; S12 is the outro). Transitions: hard cuts. Captions: on, word-timed, one line pair at the bottom on a solid band, never covering a total or a verdict. Captions use the written forms (firstbad, SAVE10, fc2879c, $20.00); the spoken forms in the §4 gloss are for synthesis only.
Music: off. Loudness: −14 LUFS, two-pass. Export: 1080p h264. Mechanics: references/demo-stack.md.
Honesty labels, always on screen where they apply: terminal scenes are a rendered replay of `transcript.txt` lines (not a screen recording); the S1 shop is script-driven (not a Kane run); share pages are the real pages from the recorded run; waits are cut and the true duration (22 minutes) is stated. No live hunt is re-run and no Kane credits are spent.

## 6 — QC record

| check | scene(s) | pass/fail | note |
|---|---|---|---|
| money shot visible | | | |
| text legible at 1080p | | | |
| captions present + synced | | | |
| no capture yellow border | | | |
| no secret / no address that shouldn't be on screen | | | |
| per-scene duration within budget | | | |
| total duration within ±10% | | | |
| audio present, loudness sane | | | |

## 7 — Publish block

| field | value |
|---|---|
| Upload target + account | YouTube, uploaded by the user (not by this session) |
| Title | firstbad: git bisect with a real-browser oracle |
| Description | See the block below this table; music attribution: none (no music) |
| Tags | firstbad, git bisect, regression testing, browser testing, developer tools, command line, coding agents, Kane CLI, Claude Code, hackathon |
| Visibility | unlisted |
| URL | TBD |
| Verified logged-out | TBD |
| Resolves | submission-draft demo video URL |

Description text (chapter times are added after the render):

```text
firstbad finds the commit that broke a user flow and gets it fixed. You write one check in plain English; git bisect runs it, with Kane CLI driving a real headless Chrome at every step.

In the recorded run shown here: a 40-commit demo shop, three commits skipped because they failed for a different reason, first bad commit fc2879c confirmed against its parent, and Claude Code's one-line fix accepted only after a Kane run read the correct total. 11 Kane runs, 22 minutes, about 200 credits.

What you are seeing: terminal scenes are a rendered, time-compressed replay of the committed transcript of that live run. The Kane Test Manager pages are the real share pages from it, opened logged out. The opening shop scene is driven by a script for this video, not by Kane.

Code: https://github.com/Dotman-Bei/firstbad
Recorded run (report and transcript): docs/demo/recorded-run/ in the repo

Try it:
npm install -g @testmuai/kane-cli
kane-cli login --oauth
git clone https://github.com/Dotman-Bei/firstbad
cd firstbad
npm ci
npm run build
node dist/cli.js demo

Built at the KaneCLI Online Hackathon 2026 (TestMu AI), category 02 Workflow.
Narration is a synthetic voice (Kokoro). No music.
```

## 8 — Status ledger

| date | event | by |
|---|---|---|
| 2026-11-26 | scripted | demo-studio (claude-sonnet-5-5) |
