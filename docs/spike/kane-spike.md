# Kane day-1 spike

- Re-run attempt 2 at: 2026-11-25T17:54:14.155Z on win32 x64, node v22.23.4, kane-cli 0.10.9 (day-1 runs carried from 2026-11-25T16:25:46.676Z, commit af63046; attempt 1 carried from 2026-11-25T16:58:33.771Z)
- Selection rule: a template is accepted only if it stores the value on both the $18.00 page and the $20.00 page
- Parser rule: final_state.observed if present; else the one key other than url; two or more candidate keys give an empty value (retried once), never a guess
- store-only objective: `Go to http://127.0.0.1:4199/, look at the order summary, then store the total amount shown next to the word Total in a variable named 'observed'`
- Chosen objective template: `store-only` (verdict mode `value-only`)
- Stored key per page (attempt 2): $18.00 page `total`, $20.00 page `observed`
- Local http:// run_end well-formed: yes
- Replay faithful: no; replay carries stored values: no (carried from day 1; the replay stretch task is not authored)
- Nested agent (claude -p, CLAUDECODE removed): ok via stdin (carried from day 1, not re-run)
- Re-run attempt 2 balance: before 11091.7249, after 11060.0836, delta 31.6413 (sum of credits_consumed 29.23; 2 Kane runs, cap 4)
- Re-run attempt 1: STOP: store-only did not store $18.00 on the $18.00 page (select-store-only): run_end status=passed, reason="Objective completed", result_code=100, final_state keys=[url, total], observed=""; balance before 11110.4166, after 11091.7249, delta 18.6917
- Day-1 balance: before 11152.2235, after 11110.4166, delta 41.8069
- Mean wall-clock seconds per attempt-2 Kane run: 84.4

## Templates

| Template | Status | Why | Runs |
|---|---|---|---|
| `commas-assert` | eliminated | stored $18.00 on the $18.00 page (select-commas-assert), but on the $20.00 page (fail-page-commas-assert) run_end status=failed, reason="Final verification failed: \"The stored {{observed}} value is \"$18.00\".\"", result_code=710, final_state keys=[], observedKey=none, observed="": no stored value, so the bad ref's signature would be empty | select-commas-assert, fail-page-commas-assert |
| `sentences-assert` | eliminated | not run: an assertion-bearing template shares the cause recorded in fail-page-commas-assert (a failed assertion fails the page and loses the stored value) | fail-page-commas-assert |
| `store-only` | accepted | returned $18.00 on the $18.00 page (rerun2-pass-page, key 'total') and $20.00 on the $20.00 page (rerun2-fail-page, key 'observed') with the wording "in a variable named 'observed'"; attempt 1 (select-store-only, old wording and old parser) stored under 'total' | select-store-only, rerun2-pass-page, rerun2-fail-page |

## Runs

| Run | Phase | Kind | Template | Page | Exit | Wall s | Status | result_code | final_state keys | Stored key | Observed | credits_consumed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| select-commas-assert | day-1 | run | commas-assert | $18.00 | 0 | 159.5 | passed | 100 | [url, observed] | observed | $18.00 | 16.904564999999998 |
| fail-page-commas-assert | day-1 | run | commas-assert | $20.00 | 1 | 121 | failed | 710 | [] | - | - | 21.311905 |
| replay-fail-page | day-1 | testmd | - | $20.00 | 0 | 64.6 | passed | 100 | [] | - | - | - |
| replay-pass-page | day-1 | testmd | - | $18.00 | 0 | 36 | passed | 100 | [] | - | - | - |
| select-store-only | re-run-1 | run | store-only | $18.00 | 0 | 124.5 | passed | 100 | [url, total] | total | - | 16.676782499999998 |
| rerun2-pass-page | re-run-2 | run | store-only | $18.00 | 0 | 101 | passed | 100 | [url, total] | total | $18.00 | 16.3830425 |
| rerun2-fail-page | re-run-2 | run | store-only | $20.00 | 0 | 67.8 | passed | 100 | [url, observed] | observed | $20.00 | 12.851205 |

## Flags

- rerun2-pass-page: Kane stored the value under 'total', not 'observed' (read by the one-other-key rule; firstbad still compares it with the expected and the bad ref's value)
