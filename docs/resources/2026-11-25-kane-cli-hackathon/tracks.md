# Tracks — none. One prize pool, four "Need an idea?" starting points

Source: https://www.kaneclihack.sh/ §"NEED AN IDEA?", fetched 2026-11-25 (Chrome). Quoted text is verbatim.

**There are no prize tracks and no sponsor bounties.** All entries compete for the single 3-place pool (`event.md`). The page frames the four categories as "Starting points, not limits. Build anything that hits the brief. The weirder, the better."

**Minimum bar to qualify (every entry):** the three-bar gate (works end to end · Kane CLI caught or proved something · agent and Kane CLI talked to each other), plus the eligibility and submission requirements: repo initialised ≥ 12 Nov, public repo, YouTube demo of ~3–5 min, ≥ 2 public posts, signed up on testmuai.com with credits claimed on the same email, and Kane CLI actually run. **Required tech:** Kane CLI (the only requirement) plus "any agent" (Claude Code, Cursor, Copilot, Codex, Windsurf, Kiro, or your own MCP setup). OpenAI is a credit supporter only, with no OpenAI-specific requirement.

| # | Category | Tagline | Example ideas (verbatim) |
|---|---|---|---|
| 01 | WEB + MOBILE | "Apps that prove themselves" — "Your agent builds it. Kane checks it in a real browser or on a phone." | "An app that refuses to deploy until Kane signs off" · "A checkout that breaks itself on purpose, then heals" · "One prompt, two platforms: web and mobile, both verified" |
| 02 | WORKFLOW | "Workflows with a spine" — "Kane on save, on push, on a schedule." | "A PR bot that replies with the video of your bug" · "A README lie detector that runs your docs and reports what's false" · "Git bisect on autopilot: find the commit that broke the flow" |
| 03 | AGENT | "Agents with hands" — "Kane as your agent's hands on the real web. No APIs." | "A subscription killer for everything you forgot to cancel" · "An agent that beats a browser game on vision alone" · "A Wikipedia speedrun bot" |
| 04 | WILDCARD | "Pure chaos" — "The thing nobody asked for and everyone will share." | "Two agents: one builds, one breaks, Kane referees" · "An app written only by fixing failed Kane runs" · "An agent that ships a blog post about itself" |

## Notes for idea-forge

- **The page's own example ideas are already taken by entrants.** `prior-art.md` maps them: deploy gate → `ExJoyz/deploy-gate`; self-healing checkout → `yohunshadow/self-healing-checkout`; README lie detector → `good1uck/docproof`, `alfonsodg/claimcov`, `Queenxrypt/KaneVerity`; PR bot → `t1dem/proofed`; "agent can't say done until Kane passes" → `Shine-5705/proofline`, `rohanjain1648/zenloop`. A straight pick of a listed example runs head to head with existing entries.
- **Category 01 "two platforms":** local iOS/Android runs need **macOS Apple Silicon**. This machine is Windows x64, so mobile means the cloud grid (`testrun run --remote`, which needs a HyperExecute plan) or real devices (`--target android|ios`, which needs KaneAI Max or Real Device Plus). Either is an account or plan gate, not free-tier. See `sponsors/kane-cli.md` §Targets. **Web-only is the feasible scope.**
- **Category 03 "No APIs"** fits Kane's model: it drives a real Chrome by vision and DOM. Credentials for third-party sites must be handed to judges, and agents acting on real accounts may clash with S2's disqualification for "automated" entries only if they game the contest. Low risk, but keep demo targets judge-runnable.
- The guide's runsheet shortlist (03 primary, 02 secondary, 01 as demo vehicle) is consistent with these facts. The real deciding axis is how tight and novel the loop is, not the category.
