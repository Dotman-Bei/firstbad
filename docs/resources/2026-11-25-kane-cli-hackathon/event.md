# Event essentials — KaneCLI Online Hackathon (TestMu AI)

Primary source for everything below: **S1** https://www.kaneclihack.sh/ (rendered in Chrome, FAQ accordions expanded), fetched 2026-11-25. Quoted text is verbatim and sits in quotation marks or code spans. Terms: **S2** https://www.testmuai.com/testmuconf-2026/conference-terms-and-conditions/, fetched 2026-11-25.

## Identity and year

- **Name:** `KaneCLI Online Hackathon` (page `<title>`, hero, visible nav and footer: "KaneCLI Online Hackathon · by TestMu AI"). Organizer: TestMu AI (formerly LambdaTest; legal entity "LambdaTest, Inc., doing business as TestMu" per S2).
- **"Kane CLI Hack Day" / "SF", reconciled:** both strings appear only in a second, hidden nav and footer in the page source: "Kane CLI Hack Day", and "Kane CLI Hack Day SF · by TestMu AI · supported by OpenAI #KaneCLIHackDay". Its links (`/start /setup /help /judging /live /teams /match`) all **server-redirect to `/`** for every visitor, logged in or out (probed 2026-11-25). **Conclusion:** they are leftovers of an in-person SF "Hack Day" template the site was built from. The live event is online: hero "ANYWHERE IN THE WORLD", eligibility "Anyone 18 or older, anywhere in the world". The only trace of the OpenAI tie-in on the live page is the $250 OpenAI credits per podium place.
- **Year = 2026, confirmed:** (a) the page shows "Thu 12 Nov" and "Thu 26 Nov", and 12 Nov 2026 and 26 Nov 2026 are Thursdays; (b) the terms page linked from the rules is the `testmuconf-2026` edition, titled "Testμ Conference 2026"; (c) Kane CLI releases during the window are dated Nov 2026 (0.10.4 on 2026-11-12 through 0.10.9 on 2026-11-24); (d) public entrant repos describe it as "Kane CLI Online Hackathon 2026", one created 2026-11-12 and dated "12–19 Nov 2026", the original window.

## Deadline (verbatim + conversions)

- S1 schedule: "Thu 12 Nov" "Kickoff. Building starts" · "Thu 26 Nov" "11:59 PM IST" "Submission deadline" "10:29 AM PT. Extended from 19 Nov. No pushes after this." Marked `DUE`.
- S1 challenge: "Ship by 11:59 PM IST on 26 November."
- **Conversions (IST = UTC+5:30; WAT = UTC+1; PT = PST UTC−8 in late November):**

| Zone | Deadline |
|---|---|
| IST | **2026-11-26 23:59** |
| UTC | **2026-11-26 18:29** |
| WAT (Lagos) | **2026-11-26 19:29** |
| PT (PST) | 2026-11-26 10:29, matching the page's "10:29 AM PT" |

- "Submissions lock at the deadline": "You can update your submission as often as you like until then. One submission per team; the team captain receives the prize."
- **Implication:** the repo is checked for "No pushes after this", so the last commit must land before 18:29 UTC.

## Eligibility (verbatim)

- "Anyone 18 or older, anywhere in the world" · "Solo or teams of up to four" · "No application, no cap".
- **Built during the event:** "Your repo must be initialized on or after 12 November. We check commit history. An old idea is fine; an old codebase is not." (This repo's first commit is 07ea954 of 2026-11-25. OK.)
- **Any agent. Kane CLI is the only requirement:** "Use any agent, framework or stack. You must be signed up on testmuai.com and have run Kane CLI."
- **Before you start** (scoring prerequisite): "Register on TestMu AI, then claim 10,000 free credits" "Required to be scored. Use the same email on both." Then "Install Kane CLI and run one flow" `npm install -g @testmuai/kane-cli`.
- **Paid plan?** "No. Every new TestMu AI account gets 10,000 free credits, valid for one month. Running low? DM us on Slack before the deadline."
- Contest guidelines (S1): "Employees of TestMu AI and participating partners are not eligible to win." S2 §6 widens the default to employees, contractors and immediate family of the Company, partners and sponsors. Contest-specific rules control where they conflict.
- S2 §6 default eligibility also says "You must be a registered Attendee of the conference". The contest page overrides this ("No application, no cap"; sign-up on testmuai.com is the stated requirement). **Low-risk flag:** the kaneclihack.sh registration (/o/register) is the event registration, and the user has done it (see Gaps).

## Submission ("Five things, One form.", verbatim from S1)

| # | Field | S1 text |
|---|---|---|
| 01 | GitHub URL | "Your repo, started on or after 12 Nov." |
| 02 | About your app | "What you built, which agent, what Kane does." |
| 03 | Demo video | "Hosted on YouTube. About 3 to 5 minutes." |
| 04 | Live URL | "If your project is deployed. Optional." |
| 05 | Launch buzz (REQUIRED + BONUS) | "At least two public posts about your project (Hacker News, X, Reddit or LinkedIn). More posts and engagement earn brownie points." |

FAQ rules that bind the submission:
- **Public repo, YouTube demo, two posts:** "Your GitHub repo must be public and your demo video on YouTube. At least two different public posts about your project are part of the submission."
- **Judges must be able to run it:** "Hand over working credentials for any login or paid service, and include a fallback (a recorded run or backup deploy) for third-party services."
- **Do the demos have to be live?** "No. Everything is a recorded YouTube video, about 3 to 5 minutes."
- Form URL: https://www.kaneclihack.sh/o/submit. It is the 4th step of a wizard: `01 YOU` → `02 YOUR TEAM` → `03 GET SET UP` → `04 SUBMIT`. Each team gets a showcase page at `/o/p/<team>`; the team can be renamed until submission.
- **Gap:** the form's actual input fields and labels were not viewable. `/o/submit` redirects to `/o/team` until a team is registered, and I did not create one. The five-item list above is the published field set. Confirm the real inputs when the team step is done.

## Judging (verbatim, S1 "HOW WE'LL JUDGE IT")

"Scored by three TestMu AI engineers. Clear the three bars first, then four dimensions, weighted equally."

**Gate: "READY TO SHIP MEANS"**
1. "It works end to end"
2. "Kane CLI caught or proved something"
3. "Your agent and Kane CLI talked to each other"

"Miss a bar and the judges can't score the rest."

**Dimensions:**

| # | Dimension | Weight | Text |
|---|---|---|---|
| 01 | Ships | 25% | "A real flow that runs end to end. Not slides." |
| 02 | Verified | 25% | "Kane CLI caught or confirmed something meaningful." |
| 03 | Closed loop | 25% | "Kane's result feeds back to the agent. Tighter is better." |
| 04 | Craft | 25% | "Would a developer want to install this tonight?" |

"Scores are averaged. Ties break on Verified, then Closed loop."
"Launch buzz is required: post about your project at least twice on Hacker News, X, Reddit or LinkedIn. More posts, reach and engagement earn brownie points." (Buzz is a requirement plus an unweighted bonus, not a scored dimension.)

## Prizes (verbatim, S1)

"$3,000 USD in cash, split across 3 winners."

| Place | Cash | Plus |
|---|---|---|
| 1st | "$1,500 cash" | "+$250 OpenAI credits" |
| 2nd | "$1,000 cash" | "+$250 OpenAI credits" |
| 3rd | "$500 cash" | "+$250 OpenAI credits" |

- "WINNERS ALSO GET" "A 1:1 with the founders, 3 months of Kane CLI Pro, a featured blog post"
- "EVERY TEAM THAT SHIPS" "The Verified with Kane CLI badge"
- "EVERY TEAM THAT SUBMITS" "A participation certificate"
- **No tracks and no sponsor bounties.** It is one pool (see `tracks.md`).

## Contest guidelines and terms (S1 verbatim bullets, S2 summarised)

S1 "Contest guidelines" (the page says the full terms apply):
- "All contest decisions rest with the TestMu AI team." Judging, scoring, eligibility and winners are at the team's sole discretion and final; no correspondence on individual results.
- "TestMu AI reserves the right to verify entries and to disqualify any entry it judges to be fraudulent, automated, duplicated, or otherwise gaming the mechanics."
- TestMu AI may modify, suspend or cancel the hackathon, or substitute a prize of equivalent value.
- Winners may need to supply details before a prize is issued; TestMu AI handles delivery, timing, tax and regional restrictions.
- "Code stays yours. By submitting, you grant TestMu AI permission to feature your project in marketing materials with attribution."
- The Code of Conduct applies in Slack and every event channel. Contact: conferences@testmuai.com.

S2 (Testμ Conference 2026 T&Cs, LambdaTest, Inc. d/b/a TestMu). Load-bearing points, paraphrased:
- §6: contest-specific rules control where they conflict with the T&Cs. Disqualification covers "plagiarised" entries and multiple accounts. The submitter warrants original work and must not disclose an employer's or third party's confidential information.
- §6 prizes: non-transferable. Winners bear taxes and may need to give identity, tax and payment info. The contest page states cash prizes, which overrides the default "no cash alternative".
- §5 license: perpetual, worldwide, royalty-free license to Company over submitted Content; the attendee keeps ownership. §6 publicity: winners' name, employer, likeness and submission may be announced.
- §9: "Kane CLI", "KaneAI", "TestMu AI" and "LambdaTest" are Company marks. **Implication:** don't name the project in a way confusable with Kane CLI or KaneAI. The "Verified with Kane CLI" badge is granted, not self-applied.
- §12: Delaware law, binding arbitration, no class action.
- **Testnet/mainnet:** not applicable (no chain).

## Help channels

- Slack: invite-gated ("Join Slack →" on S1). **Skipped by instruction.** S1 says it is for questions, help from Kane CLI engineers, "extra credits and updates".
- Email: conferences@testmuai.com (S1); support@testmuai.com (S2 conduct and cancellation).

## Gaps

- The submit-form inputs are hidden until a team exists (`/o/team`). The user's account shows step 1 done and the team step pending (observed 2026-11-25). **User action:** create the team (solo is fine) before the form can be inspected or filled.
- `/start /setup /help /judging /live /teams /match`: redirect to `/` for everyone. They hold no content (template leftovers), so this is not a gated-content gap. The footer label "Set up Codex" (from `/setup`) suggests Codex setup help was planned for the SF day; it is not available online.
- Slack content is not extracted (invite-gated, skipped by instruction).
