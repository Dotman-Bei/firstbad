# Gate ledger: firstbad (KaneCLI Online Hackathon)

> One ledger per campaign. Created 2026-11-26 by the Step-3 gate concierge, **closing pass** (no preflight pass ran:
> the runsheet decided the user would do the prerequisites by hand). Seat: `claude-opus-5-5`, tier top, effort high,
> equal to this campaign's `top` binding (`docs/tollgate/2026-11-25-tollgate.md` §4 Routing).
> Consent is per gate. Nothing below runs without the user's go for that gate. Filling the form (c) and pressing Submit (d)
> are two separate consents.

## Session card (tollgate rows 5-8, 15), 2026-11-26 10:31 UTC

| Row | Check | Result |
|---|---|---|
| 5 | claude-in-chrome responds in this session | PASS: tab context read; `/o/submit` loaded logged in (step 4 of 4, "Not submitted yet") |
| 6 | computer-use | N-A: not granted |
| 7 | email inbox | N-A: not granted (no signups this pass) |
| 8 | wallet extension / burner wallet | N-A: not a web3 project |
| 15 | cross-session env store | N-A: no secrets are issued in this pass |

Repo sync: `git pull --rebase` was already up to date at `0fcf00e`. The Ctrl+C cleanup fix had already landed in `8862e3a`.
Manifest (`docs/superpowers/manifest.json`): no `human_gate: true` tasks. Every gate below is an implicit campaign gate.

## Live form vs `docs/gates/submission-draft.md` (read 2026-11-26 10:31 UTC from the logged-in `/o/submit`)

| Live field (label, limit) | Needed | Draft today | Mismatch / action |
|---|---|---|---|
| Project name (80) | * | "firstbad" | Pre-filled on the platform with the team name. Overwrite with `firstbad` |
| One-liner (170) | * | 181 chars | **Over the limit by 11.** Use the README tagline (120 chars) |
| Project details (1500) | * | section 02 is 1,990 chars | **Over the limit.** Split it: what/who/which agent/what Kane does go here, "Try it" and the numbers go below |
| Anything else to add (4000) | optional | no such section | New: Try it, recorded-run numbers, category, tech stack |
| Attachments (8 files, 25 MB each) | optional | none | Not planned |
| Agent used (80) | * | inside the section 02 prose only | New short field: Claude Code CLI |
| YouTube demo video (link, youtu.be) | * | TBD | `https://youtu.be/YJ_J-Str4K4` (a link, not an upload) |
| GitHub URL ("Must be a public repo") | * | URL + TBD repo flip | Repo is public (re-verified logged out: 200) |
| Live URL | optional | "None" prose | Leave the field empty (it takes a URL) |
| Launch buzz: X / LinkedIn / Hacker News / Reddit posts (comma-separated each) + "Posts anywhere else" (1500) | * at least 2 different public posts, total | two slots, launch-post-1/2 | Five per-platform fields, not two slots, and more than two posts is allowed. Post links go **into the form only, never into the repo** |
| (no field) | n/a | Category, Team, Tech stack | No such form fields; category and stack move into "Anything else" |

Other notes: no input carries an HTML `required` attribute, so the `*` marks are what the platform enforces at Submit. "Save draft" exists.
Platform identity: the page names the logged-in team only by its solo team label, not by the GitHub handle. **The user must confirm it is their
account before gate (c).**

## Gates

| # | Gate | Tier | Pass | Tool plan | Human moment | Risk note | Status |
|---|---|---|---|---|---|---|---|
| 0 | Repo public flip | A | closing | `gh` (done earlier by the user's go) | none | none left | **done** 2026-11-26 (runsheet "Repo flipped PUBLIC"); re-verified 10:31 UTC logged out: repo page and raw README return 200 |
| 0b | Demo video made and uploaded | n/a (demo-studio, Step 2.5) | 2.5 | n/a | n/a | n/a | **done**: final cut 3:58 approved (runsheet); public on YouTube, oEmbed returns 200 |
| a | README video link near the top; remove the `Terminal recording` TBD line (no recording exists) | A | closing | Edit + `git commit <README.md>` + push with the gh credential helper | none | public text only; check Known limits against `8862e3a` | **done** 2026-11-26 (user go "run a and b"): video link under the tagline and in Demo, described as a live start plus a time-compressed replay (demo script §3); terminal-recording line removed; Known limits unchanged (the Ctrl+C fix in `8862e3a` is already described as fixed) |
| b | Resolve the draft's TBD-post-build lines; reshape the draft to the live form's fields and limits; check every claim against a repo file | A | closing | Edit + `git commit <docs/gates/submission-draft.md>` + push | none | post URLs, handles and email stay out of the repo | **done** 2026-11-26 (user go "run a and b"): one block per live field, all under their limits (one-liner 120/170, details 1360/1500, anything else 2336/4000, agent 68/80); sources table added; launch-buzz links form-only. **Revised** 2026-11-26 after the README rework: contradicted claims corrected (see the evidence log); now one-liner 112/170, details 1426/1500, anything else 2492/4000, agent 61/80 |
| L | Launch posts: at least 2 public posts (X thread, LinkedIn) | C (user-only: posting from the user's own accounts) | closing | none: the user posts, then pastes the links into this chat | user posts and pastes links | without 2 posts the form cannot be submitted | **done** by the user: 3 public X posts, each verified at 11:12 UTC through X's public embed endpoint without login (status 200, top-level posts, same account). Links in the form only, never in this repo |
| c | Fill the submission form, unsubmitted, then read every field back | A | closing | claude-in-chrome `form_input` on `/o/submit`, values from the resolved draft, post links from chat | confirm the platform account first; "Save draft" only on the user's word | values are editable until Submit | **done, unsubmitted** 2026-11-26 (user go "run c", Save draft approved): identity re-read (the solo team label the user confirmed as theirs); 7 text fields filled from this draft, X field holds the 3 posts; Save draft pressed, draft version 0 → 1; after a reload every saved value hashes equal to the committed draft blocks; status still "Not submitted yet" |
| d | Press Submit, then verify the confirmation screen | A (on the explicit word "submit") | closing | claude-in-chrome click `Submit`, then read the status | the user says "submit" | effectively one-way at the deadline | pending, needs c |

Recommended order: a → b (one commit each, both now) → L (user, in parallel) → identity check → c → read-back → d.
Hard stop: nothing is pushed after 2026-11-26 18:29 UTC.

## Number sources (for gates a and b)

- Recorded run, `docs/demo/recorded-run/report.md` §Cost and `report.json` `cost`: 11 Kane runs; Kane's `credits_consumed` sum 188.77
  (equal to the timeline column); balance 10983.139 → 10782.6135, delta 200.5255.
- Whole project, runsheet Step 2 row (the orchestrator's figures; no separate credit-log file is committed): 22 live Kane runs, balance
  11152.22 → 10782.61, 369.61 credits. **Removed from the draft** 2026-11-26: it predates the live Kane run started
  for the video, so it is not a whole-project total.
- Test count: runsheet "video final, Ctrl+C fix verified" says 22 files / 93 tests after `8862e3a` (the Step 2 row said 21 / 89 before it).

## Evidence log

- 2026-11-26 10:31 UTC: ledger created; no gate executed.
- 2026-11-26 ~11:20 UTC: gate c done, form saved as a platform draft (version 1), not submitted. Gate d awaits the user's word "submit".
- 2026-11-26 11:47 UTC: submission draft corrected against the reworked README: Kane's pass or fail does not decide (value-only mode), no per-commit claim, shipped `--objective` dropped from next steps, revert marked stub-tested only, Windows only stated, SHA claim narrowed, whole-project credit total removed. The saved platform draft (version 1) still holds the old text until gate c is re-run.
- 2026-11-26 11:48 UTC: gate c re-run after the draft correction. One-liner, project details, anything else and agent replaced; Save draft pressed, draft version 1 → 2; after a reload all 13 text fields match (7 filled fields equal the committed draft blocks, the 3 X links unchanged, the rest empty). Form counters: one-liner 112/170, details 1430/1500 (line breaks count double). Not submitted. Gate d awaits the user's word "submit".
