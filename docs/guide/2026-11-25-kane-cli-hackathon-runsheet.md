# Runsheet — KaneCLI Online Hackathon (TestMu AI)

Kit (doctrine, read-only): `C:\Users\bamig\Documents\VIBE CODE\Hackathons\build-system`
Guide seat: `claude-sonnet-5-5`, tier standard, effort high (session-stated), opened 2026-11-25 11:22 WAT.

## Event
- **Name / URL:** KaneCLI Online Hackathon (page also says "Kane CLI Hack Day"; "SF" appears once but the page says "Anywhere in the world" — 0a to resolve) — https://www.kaneclihack.sh/ — organizer TestMu AI, supported by OpenAI. Year is not stated on the page; the 12 Nov start is a Thursday in 2026, so this is the 2026 event.
- **Window:** 12–26 Nov. Repo must be initialized on or after 12 Nov (commit history checked).
- **Submission deadline:** **26 Nov 11:59 PM IST = 2026-11-26 18:29 UTC = 19:29 WAT** (page also says 10:29 AM PT). "Extended from 19 Nov." "No pushes after this." Do NOT plan on a second extension.
- **Internal target:** submission filed by 2026-11-26 15:00 UTC (16:00 WAT), 3.5 h buffer.
- **Time left at boot:** 32.1 h (2026-11-25 10:22 UTC).
- **Prizes (one pool, 3 winners):** 1st $1,500 + $250 OpenAI credits · 2nd $1,000 + $250 · 3rd $500 + $250. All winners: 1:1 with the founders, 3 months Kane CLI Pro, featured blog post. Every shipper: "Verified with Kane CLI" badge.
- **Judging (published):** GATE first — (1) works end to end, (2) Kane CLI caught or proved something, (3) agent and Kane CLI talked to each other; miss a bar and the rest is not scored. Then four dims at 25% each: Ships · Verified · Closed loop ("tighter is better") · Craft ("would a developer install this tonight?"). Averaged across 3 TestMu AI engineers; ties break on Verified, then Closed loop. Launch buzz is required, with bonus for reach.
- **Tracks:** NONE. Four "Need an idea?" starting points (01 Web+Mobile "Apps that prove themselves", 02 Workflow "Workflows with a spine", 03 Agent "Agents with hands", 04 Wildcard) — not prize tracks. There is no sponsor-specific track; OpenAI is a credit supporter only.
- **Eligibility prerequisites (user actions):** register at kaneclihack.sh (/o/register) AND register on TestMu AI + claim 10,000 free credits, **same email on both**; have actually run Kane CLI. Employees of TestMu AI / partners ineligible. Teams up to 4, one submission per team.
- **Submission form (/o/submit):** public GitHub URL (repo started ≥ 12 Nov) · about-your-app (what, which agent, what Kane does) · public YouTube demo ≈ 3–5 min · live URL (optional) · launch buzz (REQUIRED): ≥ 2 different public posts on Hacker News / X / Reddit / LinkedIn. Judges must be able to run it: working credentials for any login/paid service + a fallback (recorded run or backup deploy) for third-party services.
- **Links:** Docs https://www.testmuai.com/support/docs/kane-cli-introduction/ · Cookbook https://www.testmuai.com/kane-cli-cookbook/ · GitHub https://github.com/LambdaTest/kane-cli · Credits https://www.testmuai.com/kane-cli/#creditOffer · Slack (invite on the hack page) · Terms https://www.testmuai.com/testmuconf-2026/conference-terms-and-conditions/ · Contact conferences@testmuai.com · Site pages not yet read: /start /setup /help /judging /live /teams /match.
- **Kane CLI (per page):** `npm install -g @testmuai/kane-cli`; describe a flow in plain English, get pass/fail from a real browser, iOS simulator or Android emulator; works with Claude Code, Cursor, Copilot, Codex, Windsurf, Kiro or any MCP setup; can be wired into the agent loop as a hook, re-prompt or spec. Source: one homepage fetch by the guide (subagent, paraphrased); 0a re-verifies against the live pages.

## Project repo
- **Current: `Dotman-Bei/kane-cli-hackathon-2026`** — **private**, remote `https://github.com/Dotman-Bei/kane-cli-hackathon-2026.git`. Created by the guide on 2026-11-25 via the user's gh (repo-bootstrap.md), event-named. idea-forge Step 0 renames it to the project slug; update this line then and use the new name in every kickoff's REPO field.
- Local clone: `C:\Users\bamig\Documents\VIBE CODE\Hackathons\kane-cli-hackathon-2026` (sibling of the kit). Folder keeps this name after a rename.
- Public flip is a consent-gated Step-3 action and is REQUIRED for submission.

## Tollgate
- Report: `docs/tollgate/<date>-tollgate.md` — not yet created; Step 0a's Stage 0 writes it (we are not skipping 0a).
- Guide-side preflight 2026-11-25: git PASS (email set) · gh PASS (Dotman-Bei; scopes include repo, workflow) · kit PASS (not behind origin/main; 1 local commit ahead, 1 untracked faucet file — not touched) · Node v22.23.4 / npm 10.9.9 · 64 GB free · routing env knobs unset (`CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, `CLAUDE_CODE_SUBAGENT_MODEL` all empty) · `kane-cli` NOT installed yet · taste skill present at `~/.claude/skills/design-taste-frontend/` (gate.mjs found).
- Campaign-specific row to add at 0a: **row 19 — `kane-cli` installed, authenticated, credits claimed** (hard for Steps 1 and 2).
- Verdicts: none yet.

## Goal
Win — top-3 finish (1st $1,500 + $250 OpenAI credits). The user framed it as "win the sponsor track": there is no separate sponsor track. The sponsor-aligned axes (Verified 25% + Closed loop 25%, which also break ties) are half the score, so "win the sponsor's heart" = the deepest, tightest Kane CLI integration.

## Strategy decisions
- **Steps:** 0a RUN, narrow and time-boxed (~30 min): Kane CLI is the single hard dependency and the gate and half the score hinge on integrating it correctly (flags, exit codes, output format, hook/MCP wiring, auth, credit use); the pack's facts are the feasibility fuel, and Stage 0 also creates the tollgate. · 0 RUN, constrained (no idea chosen; `safe-feasible`, one track). · 1 RUN. · 2 RUN. · 2.5 RUN but cut-able: a 3–5 min public YouTube demo is a submission requirement; if the clock is short the user self-records and demo-studio is skipped (decide at green). · 3 closing pass RUN (public flip, YouTube upload if not already done, launch-buzz posts, form). Preflight pass: the user does the three prerequisites by hand now (below); a concierge preflight session is NOT worth its overhead unless the architect adds keys.
- **Calendar fit (the guide's call):** FITS ONLY IF SCOPED SMALL. 32 h total; budget (WAT): 0a 11:30–12:15 · Step 0 12:15–13:15 · Step 1 13:15–14:45 · Step 2 build 14:45 → ~01:00 on the 26th (≈10 h) · verify 26th morning · 2.5 demo 08:00–11:00 · buzz + upload + gates 11:00–14:00 · submit by 16:00 · hard stop 19:29. Must-haves must be small and demo-able; no multi-platform (iOS/Android) scope.
- **Track shortlist (≤3; starting points of one pool):** 1) **03 Agent "Agents with hands"** (primary) — the closed loop is its native shape: an agent acts, Kane verifies in a real browser, the result re-prompts the agent; maps straight onto the gate's bar 3 and the 25% Closed-loop axis, and the user's TS + Python skills fit. 2) **02 Workflow "Workflows with a spine"** (secondary angle) — a pipeline/hook where each step is gated by a Kane verdict; same loop, more structure, helps Ships. 3) **01 Web + Mobile "Apps that prove themselves"** (only as the demo vehicle) — a web app is the easiest surface for Kane to verify in a browser, so pick it only as the thing being verified, not as the product. Wildcard skipped: the gate punishes anything the judges cannot score.
- **Risk appetite: `safe-feasible`.** The gate is binary (miss a bar, unscored), 32 h remain, and Ships + Closed loop reward a working loop over novelty. Put novelty in what gets verified and how tight the loop is, not in infrastructure. (The user decides; this is the recommendation.)
- **Sponsor depth for 0a:** DEEP — Kane CLI docs (intro, quickstart, install, auth, config), the Cookbook, `LambdaTest/kane-cli` repo (README, examples, releases, open issues, hook/MCP/agent-integration docs, output formats and exit codes, flow-description syntax, browser vs simulator targets), and the hack site's unread pages (/start, /setup "Set up Codex", /help, /judging, /live for prior art). SHALLOW — TestMu AI main site, credit/billing terms, OpenAI. SKIP — Slack (invite-gated), image credit links.
- **Mode:** guided (the user approves each baton). Autopilot is available on the user's explicit ask; not recommended, since the track/idea choice benefits from a human look.
- **Web UI:** undecided until the brief. If the brief or spec has any web UI, insert the user's three FRONTEND SOURCE OF TRUTH lines verbatim at the top of the architect and Step 2 orchestrator kickoffs; the taste skill is never copied into the repo. The distinct-brand rule applies (do not reuse nightcrew/stigi palettes).
- **Web3:** none expected. No wallet, faucet, or chain gates; Solidity/DeFi skill is not in play.
- **Demo/buzz:** YouTube upload and ≥ 2 public posts are required deliverables, not extras. Both are user-consent actions in Step 3 / 2.5.

## User prerequisites (do now, in parallel with 0a — not pipeline steps)
1. Register on https://www.kaneclihack.sh/o/register and on TestMu AI, **same email**; claim the 10,000 credits via https://www.testmuai.com/kane-cli/#creditOffer.
2. `npm install -g @testmuai/kane-cli`, authenticate it, run one trivial flow (eligibility requires having run it).
3. Join the Slack from the hack page (low credits → DM there before the deadline).

## Step status
| Step | Status | Artifact | Verification | Seat settings |
|---|---|---|---|---|
| Prereqs (user) | pending | — | user confirms in guide chat | — |
| 0a | pending | `docs/resources/2026-11-25-kane-cli-hackathon/` + `docs/tollgate/2026-11-25-tollgate.md` | — | |
| 0 | pending | brief | — | |
| 1 | pending | spec + plans + manifest | — | |
| 2 | pending | commits | — | |
| 2.5 | pending (cut-able) | demo script + video | — | |
| 3 | pending | gate ledger + submission | — | |

## Next action
User opens a NEW chat tab on this repo, sets model `opus` + effort `high`, pastes the Step 0a kickoff (the user does the prerequisites above while it runs).

## Open blockers
- `kane-cli` not installed / user not yet registered (user prerequisites above). Blocks Step 1 and Step 2, not 0a/0.
- Rules/judging pages beyond the homepage unread; year, "SF" vs online and the full terms to be settled in 0a.
