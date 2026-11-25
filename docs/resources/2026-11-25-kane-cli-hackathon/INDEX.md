# Resource pack — KaneCLI Online Hackathon (TestMu AI), 2026

Step 0a (resource-extractor), 2026-11-25. Seat: `claude-opus-5-5`, tier top, effort high. Time-boxed to about 30 min per the campaign (32 h to deadline). Companion: `docs/tollgate/2026-11-25-tollgate.md`.

**Deadline: 2026-11-26 23:59 IST = 18:29 UTC = 19:29 WAT** ("No pushes after this").

## Contents

| File | What it holds |
|---|---|
| [event.md](event.md) | Name and year reconciliation, deadline (IST/UTC/WAT/PT), eligibility, the five submission items, judging gate + 4×25% dimensions + tie-break, prizes, contest guidelines, T&Cs summary, gaps |
| [tracks.md](tracks.md) | No tracks: one pool; the four "Need an idea?" categories with their verbatim example ideas; which ones are already taken |
| [sponsors/kane-cli.md](sponsors/kane-cli.md) | **Feasibility fuel.** Install/auth/verify commands, objective grammar, exit codes, the NDJSON `run_end` contract, hook/re-prompt/spec/CI wiring, browser vs mobile targets, credits, live gotchas (open issues) |
| [prior-art.md](prior-art.md) | 29 in-window Kane hackathon repos from a GitHub search, pattern-tagged; crowded vs open white space |
| seeds.md | Not written (optional). Kane's own recent releases (0.10.4 to 0.10.9) are in `sponsors/kane-cli.md` §Sources |

## Top facts for idea-forge (each one sourced in the files above)

1. **The gate comes first:** it works end to end, Kane caught or proved something, and the agent and Kane talked to each other. Miss one and nothing else is scored. Then Ships, Verified, Closed loop and Craft at 25% each. Ties break on Verified, then Closed loop.
2. **Submission needs** a public GitHub repo initialised on or after 12 Nov, a YouTube demo of about 3–5 min, at least 2 public posts (HN, X, Reddit or LinkedIn), judge-usable credentials plus a fallback for third-party services, and the same email on kaneclihack.sh and TestMu AI with credits claimed and Kane actually run.
3. **Kane's verdict reaches the agent through** the exit code (0 pass, 1 fail, 2 error, 3 timeout) and the `run_end` NDJSON line (`status`, `summary`, `reason`, `final_state`, `credits_consumed`, plus `result_code:"740"` for a confirmed product bug under `--bug-detection`). Kane has no MCP server and no hooks of its own; you wire it into the agent's hooks.
4. **Web only on this machine.** Local mobile testing needs macOS Apple Silicon. The cloud grid and real devices need paid plans.
5. **Prior art is crowded** around "the agent can't say done until Kane passes", deploy/PR gates, README claim checks and self-healing checkout. The AGENT category ("Kane as your agent's hands") is untouched in the sample.

## Provenance

| # | Source | URL | Fetched | Tool | Primary? | Confidence / gap |
|---|---|---|---|---|---|---|
| S1 | Hack site home (all sections: challenge, schedule, before-you-start, submit, prizes, judging, ideas, rules and FAQ) | https://www.kaneclihack.sh/ | 2026-11-25 | Chrome (`get_page_text`; FAQ accordions expanded via DOM) | primary | High. Read in full. Text is verbatim in event.md and tracks.md |
| S1a | Hidden legacy nav and footer ("Kane CLI Hack Day SF … supported by OpenAI") | https://www.kaneclihack.sh/ | 2026-11-25 | Chrome (JS `innerText` of header, nav and footer) | primary | High. Explains the "SF" and "Hack Day" strings |
| S1b | /start /setup /help /judging /live /teams /match | https://www.kaneclihack.sh/{page} | 2026-11-25 | Chrome `fetch(redirect:'manual')` + navigate | primary | Every one is an opaque redirect to `/`, logged in or out. No content exists, so this is not a gated gap |
| S1c | Submission wizard | https://www.kaneclihack.sh/o/submit → /o/team | 2026-11-25 | Chrome (read-only) | primary | **Gap:** the form inputs are hidden until a team exists. Wizard steps and the `/o/p/<team>` showcase were captured. Nothing was clicked or submitted |
| S1d | Showcase index probes | /o/p, /o/projects, /o/gallery, /o/showcase, /o/live, /o/judging, /o/help, /o/setup | 2026-11-25 | Chrome fetch | primary | All 404. There is no public showcase |
| S2 | Testμ Conference 2026 Terms and Conditions | https://www.testmuai.com/testmuconf-2026/conference-terms-and-conditions/ | 2026-11-25 | Chrome | primary | High. Read in full and summarised (§5, 6, 7, 9, 12) in event.md. Confirms the 2026 edition |
| K1 | kane-cli GitHub repo: README, CHANGELOG, Claude skill + 10 references, 7 user-guide pages, integrations/CLAUDE.md | https://github.com/LambdaTest/kane-cli | 2026-11-25 | `gh api` raw contents (public repo) | primary | High. Some user-guide pages were not read (listed in kane-cli.md Gaps). Copies are in the session scratchpad only; none are committed |
| K2 | Releases 0.8.21–0.10.9 (notes for 0.10.7, 0.10.8 and 0.10.9) + npm metadata | https://github.com/LambdaTest/kane-cli/releases · npm `@testmuai/kane-cli` | 2026-11-25 | `gh release list/view`, `npm view` | primary | High. The repo CHANGELOG lags the releases (stops at 0.10.3) |
| K3 | Issues (40 most recent, open and closed) | https://github.com/LambdaTest/kane-cli/issues | 2026-11-25 | `gh issue list` | primary | Titles and states only. Issue bodies were not read |
| K4 | Kane CLI docs intro | https://www.testmuai.com/support/docs/kane-cli-introduction/ → https://www.testmuai.com/docs/kane-cli-introduction | 2026-11-25 | Chrome | primary | High. Sub-pages mirror K1 `docs/user-guide/` and were read from there, not crawled page by page |
| K5 | Kane CLI Cookbook | https://www.testmuai.com/kane-cli-cookbook/ | 2026-11-25 | Chrome | primary | Medium. Card titles and blurbs for the 11 use-cases. Individual recipe pages were not opened |
| P1 | GitHub search for in-window Kane repos | `gh search repos "kane-cli" --created ">=2026-11-12"` | 2026-11-25 | `gh` | secondary | Medium. Self-descriptions only, unverified, partial coverage |
| — | Runsheet (guide's earlier homepage read) | docs/guide/2026-11-25-kane-cli-hackathon-runsheet.md | 2026-11-25 | repo | secondary | Cross-checked against S1. All of its event facts match |

**Cross-checks:** the deadline appears three times on S1 (challenge, schedule, submit section) and all three agree. The PT conversion ("10:29 AM PT") matches IST−13:30 (PST). The runsheet's prize, judging and submission summary matches S1.

**Skipped by instruction:** Slack (invite-gated). Shallow by instruction: the TestMu AI main site, credit and billing terms (the claim page was not opened), and OpenAI (credit supporter only, with no integration requirement).

**Gaps (honest unknowns):**
- The submit form's actual inputs: create the team first.
- The per-run credit price and any rate limits.
- Whether the free credits cover `--remote` grid or real-device runs.
- The bodies of the open false-pass issues.
- Unread Kane user-guide pages (objectives cookbook, mobile, evidence, testrun, assurance).
- No past winners: this is the first edition.
- **Observed account state (user's own):** kaneclihack.sh shows the user logged in, with wizard step 1 "You" done and "Your team" pending.
