# firstbad report

- **Check:** at `http://127.0.0.1:4173/`: add the Tote bag to the cart, add the Mug to the cart, type SAVE10 into the discount code field and click Apply; store the total amount shown next to the word Total; expect **$18.00**
- **Refs:** good `v1.0`, bad `HEAD`
- **Result:** confirmed: first bad commit: fc2879c refactor(cart): extract price helpers (confirmed: culprit FAIL, parent PASS)
- **First bad commit:** `fc2879c` refactor(cart): extract price helpers (confirmed: culprit FAIL, parent PASS)
- **Fix:** verified via agent on branch `firstbad/fix-fc2879c` (commit `617eb8f`): Kane passed the patched tree on attempt 1

## Timeline

| # | Phase | Commit | Subject | Verdict | Observed | Kane runs | Credits | Reason |
|---|---|---|---|---|---|---|---|---|
| 1 | bracket | `6f9b864` | bad ref: docs(changelog): prepare the 1.1 notes | FAIL | $20.00 | 1 | 22.2 | stored $20.00, expected $18.00 |
| 2 | bracket | `da74bfb` | good ref: feat: Corner Shop v1.0 | PASS | $18.00 | 1 | 17.13 | stored $18.00 |
| 3 | bisect | `c0eaa8b` | style: align the total to the right | SKIP | - | 0 | - | page never loaded (server exited with code 1) |
| 4 | bisect | `0b42566` | docs: add a contributing note | SKIP | - | 0 | - | page never loaded (server exited with code 1) |
| 5 | bisect | `4bb7b51` | feat(catalog): add the Tea towel | SKIP | - | 0 | - | page never loaded (server exited with code 1) |
| 6 | bisect | `11b41c0` | chore(server): log each request path | PASS | $18.00 | 1 | 18.1 | stored $18.00 |
| 7 | bisect | `cc47753` | feat(catalog): add the Postcard | PASS | $18.00 | 1 | 14.36 | stored $18.00 |
| 8 | bisect | `b13a801` | feat(catalog): add the Keyring | FAIL | $20.00 | 1 | 16.89 | stored $20.00, expected $18.00 |
| 9 | bisect | `df01b19` | chore(pricing): document the discount rules | PASS | $18.00 | 1 | 19.44 | stored $18.00 |
| 10 | bisect | `1ef4620` | docs(changelog): note the pricing refactor | FAIL | $20.00 | 1 | 18.32 | stored $20.00, expected $18.00 |
| 11 | bisect | `fc2879c` | refactor(cart): extract price helpers | FAIL | $20.00 | 1 | 15.26 | stored $20.00, expected $18.00 |
| 12 | confirm | `fc2879c` | culprit: refactor(cart): extract price helpers | FAIL | $20.00 | 1 | 15.56 | stored $20.00, expected $18.00 |
| 13 | confirm | `df01b19` | parent: chore(pricing): document the discount rules | PASS | $18.00 | 1 | 17.7 | stored $18.00 |
| 14 | fix | `6f9b864` | fix attempt 1: docs(changelog): prepare the 1.1 notes | PASS | $18.00 | 1 | 13.81 | stored $18.00 |

## Kane Test Manager links

- #1: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8ADFGA48G2V8YKDFXYF4GXJ/dashboard/share/US_NV5QX9I7T7T7KQK9QVNLNX6ON4GJI65Y1TZFUP5Z5RNU74OCZZE2CHL4QX5NRVFB?type=summary&agentView=true&fqdn=summary-page
- #2: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8ADK9CV0HZEPZTD39CHYPBD/dashboard/share/US_GKXSQ675NL2AV22DEIUS7MUGKQSRHKLYT8SKVI6FV8N8I45PT0CLYU1BGSE5W9TL?type=summary&agentView=true&fqdn=summary-page
- #6: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8ADP62QBK7G4A347877G1B6/dashboard/share/US_AR5HEWQZUMNSYST14G5FGUM7XWSBFKG42VHO0DE4RRL1C43TFMRJIY4M2MOUI49U?type=summary&agentView=true&fqdn=summary-page
- #7: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8ADT9VMZPGH5GVE09FQ3486/dashboard/share/US_EK2LCRHYZNBJ6XNLASJBL2KMN89J3O7WADWZQAXVFV5JPQURDGZ2RUREXWQYHRKK?type=summary&agentView=true&fqdn=summary-page
- #8: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8ADXX8H69AR8W4G6C3M5XHT/dashboard/share/US_7D0S4MIL60I6S4A6FM2W0MJHSK9HPZYTQZNAUNNDI9X7IT8LDY2NYY391NGTG8XD?type=summary&agentView=true&fqdn=summary-page
- #9: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8AE2TPF2TMZPJV4BS5VHA5D/dashboard/share/US_J17MT7Z703ZZRMI61HE386KY9I9VFUAUM1WGJM3FIQ2OBIFM182URZWXRZU3JPDQ?type=summary&agentView=true&fqdn=summary-page
- #10: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8AE6XPZZDS47HZW0ENZSQR7/dashboard/share/US_Q7IEQZP9UDMOJURSV7RM4W95780DXN981K1I0OPDWX63RWBORB3996UMFISAL1U1?type=summary&agentView=true&fqdn=summary-page
- #11: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8AEA951FKR7CF44D9K4JVEF/dashboard/share/US_087F2CA9AQ3ZYPQLMOGPWHE106RENFAA9YNNBILYOYFN38HEWT9V5A9TJRTVWQ2F?type=summary&agentView=true&fqdn=summary-page
- #12: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8AEDANKEW0KD6PRRV8A21KF/dashboard/share/US_W4OHC845S8BD6IFJJUDXEDAZ8ZHWKS5I03Z1OEBDKVY887DTKYRNLN45H273LZDA?type=summary&agentView=true&fqdn=summary-page
- #13: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8AEGT5R4SM1E1GZC67H3VAT/dashboard/share/US_KHMKVXADLMJWG7IW5QZLLWDYHL4FEVKH7HO6NWRHO8NM1KN43LTVZBNKBD03BFB7?type=summary&agentView=true&fqdn=summary-page
- #14: https://test-manager.lambdatest.com/projects/01M899H8F9DARJYGYYYP58JYTY/test-cases/01M8AEM1XFKCRNT5YEHECSPT1C/dashboard/share/US_R6CXXZM0OWXK7T842LYYSKD5LEQLA3EUDNEMERRE0TNXRMSRU8CXMM8BQT21T1MD?type=summary&agentView=true&fqdn=summary-page

## Cost

- Kane runs: 11
- Sum of credits_consumed reported by Kane: 188.77
- Balance before / after: 10983.139 / 10782.6135 (delta 200.5255; the delta is the number to trust)

_Generated by firstbad 0.1.0 at 2026-11-25T22:55:07.296Z._
