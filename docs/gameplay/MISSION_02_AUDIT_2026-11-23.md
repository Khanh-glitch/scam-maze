# Mission 02 — audit against the build plan, 2026-11-23

**Verdict: the foundation is NOT complete.** One unit is done (W0). Ten are not started or barely
started. This audit was asked for directly ("has mission 2 enough asset, npc, map foundation?") and
the honest answer is no, with the exact inventory below.

Every line was checked against the code on this branch, not against the plan's claims. `grep`
commands are quoted so the check can be repeated.

## Unit by unit

| Unit | Plan gate | Actual state | Evidence |
| --- | --- | --- | --- |
| **W0** correct the numbers | No `105k`, no "forty minutes", no verdict in `insight` | **DONE** | `grep 105k storyCast.ts` → empty; `grep "forty minutes"` → only a *test* asserting absence; the two "Red flag" hits at `:643`/`:744` belong to `linh`, not the rider |
| **W1** backup drive pickup | A flag flips, Files app shows it | **NOT DONE — the flag has no writer** | `grep backupSecured` → `resources.ts:37,141` (declare/default), `device.ts:166,302` (read), `DeviceApp.tsx:110` (render). **Zero writers.** Exactly R5, unchanged. |
| **W2** booked ride is a real option | A ride-app item, ledger line, clock respects it | **NOT DONE** | `grep "app.ride\|bookRide\|đặt xe" chapter1/*.ts` → empty |
| **W3** taking the driver does something | Reducer test for accepted path | **NOT DONE** | `grep "riderTaken\|tookRider\|driverAccepted" src/` → empty |
| **W4** arriving late is a state | Two playthroughs differ in transcript | **NOT DONE** | `interviewee_q5.schedule` is authored 960–1260 but no post-1260 reply branch exists |
| **W5** Cô Ba has a body | `worldAnchor` + joins `OPEN_WORLD_STORY_NPCS` (7 not 6) | **NOT DONE** | `storyCast.ts:298-312` — no `worldAnchor`, `inOpenWorld: false`; `storyCast.test.ts:14` still asserts `length === 6` |
| **W6** parcel thread earns its minutes | Debrief derives spend from event log | Partial — the page/app path works (`mission02.test.ts`, 18 green) | but see W9 |
| **W9** parcel flags stop being decoration | No write-only flag | **NOT DONE** | `parcelAtCounter`: 2 writers (`mission02.ts:191,218`), 2 declarations, **the only reader is its own `when:` at `:247`.** `parcelCredentialsExposed` and `parcelFeePaid` are 3 hits each — writer + declaration + read inside mission02 only. R11 unchanged. |

## Assets (§10), the part most often assumed done

| # | Asset | State |
| --- | --- | --- |
| **A1** Chợ Lớn market block | **BUILT** — this is real work from earlier rounds, not in §10 order: `saigonDistricts.ts:1802` builds CHUNK 5; `choLon.ts` holds the block, colonnade, tower, gates |
| **A2** vendor canopy field | **NOT DONE** — `grep canopy\|umbrella` in `choLon.ts` returns only prose describing *shophouse awnings*, not the instanced vendor canopy field of §1b.6 |
| **A3** Cô Ba's shopfront | **PARTIAL** — the counter exists and `receiptNail` is a real handle (`choLon.ts:1331`, y 1.6) with a test on its bounds. But nothing hangs on it, and there is no half-lowered shutter or glass case at 0.9 m attributed to her. |
| **A4** bus stop at Chợ Lớn | **NOT DONE** — `grep shelter\|busStop` in `world/*.ts` → empty |
| **A5** bus stop at Lý Thái Tổ | **NOT DONE** — same |
| **C1** Cô Ba's model | **REUSED, NOT REBUILT** — `npc-nguoigia.optimized.glb` exists (also in `testbus/ow/models/`), but §10.3 says explicitly this file is "currently a **crowd extra**, not her" and needs idle + hands-busy loops |
| **D3** ATM on the route | **NOT DONE** — `grep -i atm world/*.ts` → empty, so the rider's offer to stop at one is fiction with nothing behind it |
| B1–B5, C2, D1, D2, D4 | B* 2D stills not built; the rider (C2) and Minh (C3) exist | |

## What this means for "mission 2 is excellent"

The parts that exist are genuinely good: the scenario is authored, validates, and 18 tests cover the
parcel path end to end. The market at the end of the line is real geometry, built and audited.

But of the six questions §0 says a player must be able to answer from memory, **four cannot be
asked yet**, because the systems behind them are not built:

- Q1 *what was in my hand* — W1; the drive cannot be picked up (no writer for the flag).
- Q2 *how did I get there and what did it cost* — W2/W3; neither the app nor the rider can be chosen.
- Q3 *was I on time* — W4; late is not a state.
- Q4 *what did Cô Ba say* — W5; she has no body, so she cannot say anything in the world.

Q5 (what do I have now) and Q6 (which of my decisions came back) depend on W9, which is not done.

## The honest ordering

`§10.6` says build A4 → A5 → A1 → A2 → A3 → C1, then B*. A1 is done out of order (it was needed
for the gate work). The next asset that actually unblocks a work unit is **A4/A5** — the bus shelters
— because W4 ("arriving late means something") needs the bus to arrive *somewhere*, and today there
is no shelter at either end. Then **C1** is the only character that cannot be faked.

**Do not read this document as a criticism of what shipped.** Read it as the inventory it is: the
plan's own gate for "done enough to build against" (§10.6) is "the bus can arrive, the doors open
onto a shelter, and a person can walk 20 m under canopies to a stall." Two of those three are false.
