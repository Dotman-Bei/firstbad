# Prior art — shipped and in-flight Kane CLI projects

**There is no public showcase or /live page.** `/live` server-redirects to `/` (template leftover). `/o/p`, `/o/projects`, `/o/gallery` and `/o/showcase` return 404. Per-team showcase pages (`/o/p/<team>`) exist only after a team submits, and there is no index. This is the first edition of the event, so there are no past winners.

**Source used instead:** a public GitHub search, `gh search repos "kane-cli" --created ">=2026-11-12"`, run 2026-11-25. It found 29 repos created inside the event window (this campaign's own repo excluded). The one-liners are each repo's own GitHub description, trimmed. Repos were **not** opened or verified: treat these as claims, not working projects. Coverage is partial. Repos without "kane-cli" in the name or description are missed, and the field is surely larger.

| Repo | Created | One-liner (own description, trimmed) | Pattern |
|---|---|---|---|
| Shine-5705/proofline | 11-16 | Your coding agent doesn't get to say "done" until Kane CLI says "pass"; agent ↔ Kane loop | agent-done gate |
| rohanjain1648/zenloop | 11-18 | Same claim, via a Claude Code Stop hook + Kane browser verify | agent-done gate (hook) |
| Alvinagustus/bugboing | 11-24 | Strict fail→fix→rerun CLI; "No Kane run_end pass = no green" | agent-done gate |
| barood-labs/satr-verify | 11-14 | Coding agent + Kane closed loop; failures feed back to the agent | re-prompt loop |
| vaibhav4046/shipcheck | 11-14 | Paste a URL, say what should work; Kane verifies, reads the failure, loops until green | re-prompt loop |
| dunoil/greenlight-kane-loop | 11-19 | Invoicing app verified by Kane in a closed agent loop | re-prompt loop (demo app) |
| Mzee04/stillhere | 11-18 | Real Chrome checkout journey; Codex repairs the bug, Kane confirms | re-prompt loop (checkout) |
| yohunshadow/self-healing-checkout | 11-16 | Kane catches a broken checkout, an LLM patches it, Kane re-verifies | page idea "checkout heals" |
| ExJoyz/deploy-gate | 11-19 | Launch board that refuses to deploy until Kane approves | page idea "refuses to deploy" |
| kcc920926-droid/release-review-kane | 11-25 | Kane release gate for an equipment reservation desk | deploy/release gate |
| Maheswar-Sah00/bumpgatedemo | 11-22 | Real Dependabot PRs gated by Kane | dependency PR gate |
| t1dem/proofed | 11-12 | Watches every PR in a real browser with Kane and fixes what breaks (2★) | PR bot |
| vijaygopalbalasa/proven | 11-13 | A ticket closes only when Kane saw its frozen test fail before and pass after the change | fail-then-pass proof |
| Manas-Sehgxl/fixpoint | 11-12 | Bug reports that close themselves: Kane reproduces, Claude Code patches, Kane proves | bug-report repro→fix |
| PhiBao/reenact | 11-12 | Bug report in, browser reproduction and proof out | bug-report repro |
| good1uck/docproof | 11-14 | Your README makes promises; Kane checks them; failures go back to the agent | page idea "README lie detector" |
| alfonsodg/claimcov | 11-23 | Prove your documentation claims in a real browser | README/docs claims |
| Queenxrypt/KaneVerity | 11-17 | Documentation verification with Kane + Claude Code | README/docs claims |
| RuiCodex-dev/kane-claim-check | 11-19 | Proves what a web page promises about its store listings | page-claims check |
| tomcode1000/zelkaro | 11-15 | Kane proves an AI-built app leaks one user's data to another; agent fixes; Kane re-proves | security (IDOR) loop |
| NemesisDevX/nemesis-gauntlet-public | 11-19 | Autonomous adversarial verification powered by Kane | builder-vs-breaker |
| 221h0lmes/falsegreen-kane-cli | 11-17 | (no description; the name suggests catching false-green tests) | false-green |
| mso-docs/proofline | 11-17 | Live Kane evidence dashboard, drift detection, hashed manifests, **MCP server** | evidence/MCP tooling |
| coral-fox-12/flowdeck-kane-studio | 11-17 | Author, organise and export Kane browser-test flows | authoring UI |
| igoreduardoai/payoutfit | 11-13 | "PayoutFit — Kane CLI Online Hackathon 2026" | unknown |
| mukilanmuthuvalathan/flowpatch | 11-20 | (generic description) | unknown |
| dear-aseif/kane-hackathon-2026 | 11-12 | Web app built with an AI coding agent, verified with Kane | generic |
| abidkidwai786/kane-cli-exploration-walkthrough | 11-12 | (no description) | exploration demo |
| RishabhLambdaTest/orbtslot-kane-cli-tests | 11-16 | API tests generated with kane-cli (account name suggests a LambdaTest staffer; employees are ineligible) | not an entry |

## Crowded vs open (for idea-forge's white-space step)

- **Saturated (≥3 entries each):** the agent "done" gate / Stop-hook loop · the generic fix→rerun loop on a demo app · deploy, release or PR gates · README/docs claim checking · bug-report reproduce→fix. Four of the page's twelve example ideas already have direct entrants.
- **Thin or absent in this sample:** the AGENT category ("Kane as your agent's hands": subscription killer, browser game on vision, Wikipedia speedrun) has **zero** matches. Also empty: git-bisect-on-autopilot, video-of-your-bug PR replies, Cookbook-style DevTools assertions as the core product (env-leak, Secure-cookie and localStorage-secret checks), `--bug-detection` / `result_code 740` as a first-class signal, policy-gated evidence verdicts, `bugs`-memory RCA loops, and an "app written only by fixing failed Kane runs".
- **Implication:** a head-to-head with the saturated patterns has to win on Craft (install-tonight polish) and loop tightness. Novelty is more available in *what* Kane verifies and in the *agent's hands* category.
