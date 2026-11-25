# Kane day-1 spike

- Ran at: 2026-11-25T16:25:46.676Z on win32 x64, node v22.23.4, kane-cli 0.10.9
- Chosen objective template: `commas-assert` (verdict mode `status+value`)
- Local http:// run_end well-formed: yes
- Replay faithful: no; replay carries stored values: no
- Nested agent (claude -p, CLAUDECODE removed): ok via stdin
- Balance: before 11152.2235, after 11110.4166, delta 41.8069 (sum of credits_consumed 38.22)
- Mean wall-clock seconds per Kane run: 95.3

## Runs

| Run | Kind | Page | Exit | Wall s | Status | Observed | credits_consumed |
|---|---|---|---|---|---|---|---|
| select-commas-assert | run | $18.00 | 0 | 159.5 | passed | $18.00 | 16.904564999999998 |
| fail-page-commas-assert | run | $20.00 | 1 | 121 | failed | - | 21.311905 |
| replay-fail-page | testmd | $20.00 | 0 | 64.6 | passed | - | - |
| replay-pass-page | testmd | $18.00 | 0 | 36 | passed | - | - |

## Flags

- the $20.00 page run did not store $20.00
