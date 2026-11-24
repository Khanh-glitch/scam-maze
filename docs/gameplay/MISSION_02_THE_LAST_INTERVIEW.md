# Mission 02 — THE LAST INTERVIEW

> **Status: `PROPOSAL` v3 (feasibility-audited).** Mission 02 of *LAST SUBMISSION: 72 GIỜ CUỐI*.
> Story source: tab "Thẻ 3" of the design document, *III. MISSION 02 — THE LAST INTERVIEW | THỨ TƯ 08:00*.
>
> **What v3 is:** v2 was a design. v3 is the same design after reading the runtime it has to live in.
> Every path, symbol and behaviour below was read from `main` (`86c211e`). Where v2 was wrong, §1 says so.
> Three findings in §5 change the design, not just its wording.

---

## 1. What v3 corrects (honesty first)

| v2 said | The code says | Consequence |
| --- | --- | --- |
| The interview runs through "`RoomChapterLayer`'s existing npc/dialogue path". | `TALK_TO_NPC` is **hard-rejected**: *"No NPC exists in this chapter"* (`reducer.ts:619`). `NPC_IDS` is `[]`. `Overlay` declares `kind: "dialogue"` but **nothing in `features/` renders it** for this chapter — the only panel is parked in `legacy/urgent-call-street/`. | A face-to-face core dialogue is **new engine work**, not reuse. §7.4 replaces it. |
| Event expiry field is `expiresAfterMinutes`. | `GameEventDef.deadlineAfterMinutes` (`types.ts`), applied from `firedAtMinute`. | Data name fixed. |
| Cô Ba "closes the shop at 12:00" and leaves. | `interviewee_q5` has no `worldAnchor`, so she is filtered out of `OPEN_WORLD_STORY_NPCS`; anchors are **static** — the director cannot hide or move an NPC by schedule. `resolveNpcSchedule` even falls back to `schedule[0]` when no slot matches. | She can be *spoken to* (fallback) but not *seen leaving*. §6 turns closing into dialogue, not disappearance. |
| The paper slip is "a new interactable like `obj.note`". | `RoomPropId` **and** `InteractableId` are closed unions; `CHAPTER_1_INTERACTABLES` is a total `Record<InteractableId, …>`, so a new id forces an entry into the *parked* story too. | The slip **reuses `obj.note`** (desk paper, already `HAND_INSPECT`, already plays `audio.paper`) — §5.3. |
| Battery needs "a state field and a save bump". | Saves store **only accepted actions** and replay them (`chapterProgress.ts`), so derived state needs no version bump. `state.events[].action` is already the action log. | Battery is a **pure selector**, zero new state. §7.2. |
| Times: 10:34 / 13:50 / 14:30 → 994 / 1230 / 1350. | `minutesFromStart(3,h,m) = 420 + 60h + m`. 10:34 = **1054**, 13:30 = **1230**, 14:30 = **1290**. | §6 table recomputed. |

---

## 2. The fantasy

Wednesday, 08:00. Alex has to be in a shop in District 5, in front of the one person in this story
who reads fake payment receipts for a living, and prove — with paper, not confidence — that he is not
the kind of person who gets led by the nose. The phone in his hand is both the tool and the tell.

**The one sentence the mission must earn:** *"I checked, I walked there, and she told me the truth
because she watched me do it."*

The mission never says that sentence. It arranges for it to be true.

---

## 3. Realness targets (each one testable)

| # | Target | Fails when |
| --- | --- | --- |
| R1 | Travelling to District 5 spends a body, a route and minutes | any travel that is a menu, a fade or an instant `moveTo` |
| R2 | The world keeps its own schedule, including while the player reads | any pause of the chapter clock that the fiction does not justify |
| R3 | The proof is an object Alex carries | any hint shown as HUD text the character could not see |
| R4 | An NPC reacts to what the player *does*, silently | any notice that says "she noticed you" |
| R5 | Missing the interview changes the week; it never restarts it | any retry prompt, refund, or "mission failed" screen |

R2 is where v3 strikes hardest — see §5.1.

---

## 4. What the code already gives us (cost-tagged)

| Capability | Where | Cost |
| --- | --- | --- |
| Chapter clock: 1 game minute per real second | `lastSubmission.ts` `gameplay: { clockRuns: true }`, `world.ts` `msPerGameMinute: 1000`, `useWorldClock.ts` | free |
| Scheduled consequences at exact minutes | `world.ts` `triggerFiresAt` + `collectSteps` (events, item arrival, missions) | free |
| Calendar entry `cal.interview` 11:30–12:30, District 5 | `mission01.ts:623` | free |
| Phone/laptop items with `timeCostMinutes`, `cashCost`, `transcript`, `effects` | `DeviceItemDef`, `DeviceItemActionDef` | free |
| A "conversation that is really a transcript" (used by `contact.training-office`) | `mission01.ts:316` | free |
| Postal/market street around Room 6.07 with crowd, traffic, rain | `outsideWorld.ts` → `OpenWorldEngine` composited into the room renderer | free |
| Route 06 physics, doors, validator, seats | `simulation/{transit,boarding,bus}.ts` | free (but see §5.2 — it is *not* connected) |
| Street Story NPCs: barks at 7.5 m, 3 reply options, moods, insight, flag-gated text | `storyNpcs.ts`, `storyCast.ts` | small (she needs an anchor) |
| Crowd reactions on bump / personal space | `simulation/humanPresence.ts` | free |
| `backupSecured` and 29 other persistent flags | `resources.ts` | free |
| Static virtual sites for the in-game browser | `desktop/browser/sites.ts` (`kind: "static"`) | small (one page + i18n) |

---

## 5. Three findings that change the design

### 5.1 The world stops whenever the phone is up

```ts
// RoomChapterLayer.tsx
const callOpen = state.call.status === "ringing" || state.call.status === "active";
const blocking = extensionBlocking || callOpen;
const free = engineReady && !introOpen && overlays.length === 0 && inspecting === null && !blocking;
useWorldClock({ store, scenario, running: free && !clockPaused && status === "playing" });
```

`overlays` contains `phone`, `journal`, `planner`, `tasks`, `laptop`, `inspection`… So:

- while the phone is open, **the chapter clock stops** — the player can read the fake page for ten
  real minutes and Cô Ba never closes the shop;
- while a call **rings**, time stops — the ring can wait for the player forever.

That is the exact "the world waits for you" anti-pattern R2 forbids, and it is the difference between
M02 feeling scripted and feeling alive. It also means the 11:41 ring cannot be delivered while the
player is inside an overlay, because the clock that would deliver it is frozen.

**Fix (Slice B, ~15 lines):** keep the clock running for `call.status === "ringing"` and for the
`phone` overlay when the phone is *carried in the street*; stop it only where the fiction stops
(the laptop is in the room, so the room-side laptop overlay may still pause).

```ts
const blocking = extensionBlocking || state.call.status === "active";
```

Ten seconds of ringing now cost ten game minutes — which is exactly what a real phone does to a
conversation, and what makes §7.5's "answer / decline / hand it to her" a decision with a price.

### 5.2 The bus runs on its own clock and its own wallet

```ts
// OpenWorldEngine.ts:872
this.route = new BusRouteController();   // no TransitHost
```

`BusRouteController` then falls back to `this.seconds = ROUTE.start` (08:00) and `this.cash =
ROUTE.initialCash` (50,000), and — worse — advances its own clock **at 12× while waiting** and
**at 5× otherwise** (`update`, `this.advance(dt * (phase === 'waiting' ? 12 : 5))`).

So today: riding Bus 06 costs **no chapter time and no chapter money**, and `onTime` measures a demo
stopwatch. The 11:30 deadline that the whole mission hangs on is not wired to anything.

**The hook already exists** (`TransitHost { clock: { read, advance }, wallet: { read, debit }, onEvent }`)
and `outsideWorld.ts` already passes `clockHours: () => room.storyClockSeconds / 3600` for the sky.
Slice B passes the same clock plus a wallet that debits `resources.cash`, and maps
`advance(seconds)` back into `ADVANCE_TIME { minutes }`. Concretely:

- `clock.read()` → `storyClockSeconds` (already published by `RoomChapterLayer` via
  `bridge.commands.setStoryClock`),
- `clock.advance(s)` → dispatch `ADVANCE_TIME` for `round(s/60)` minutes (the room clock is the
  authority; the bus must not keep a second one),
- `wallet.read()` → `resources.cash`, `wallet.debit(7000)` → `recordTransaction` with the ledger
  label `ledger.bus-fare`.

Until this lands, **no M02 text may claim the bus takes 34 minutes**, and the doc's own numbers are
aspirational. This is the single highest-value piece of plumbing in the mission: it turns a prop into
a schedule.

### 5.3 What the desk actually shows (v3 corrects v2 twice here)

`LAST_SUBMISSION_SCENARIO.interactables` is `{}`, and `RoomChapterLayer.rebuildCache` only overrides
`phone / laptop / calendar` when `Object.keys(sc.deviceActions).length === 0` (true for this chapter).
`note` and `receipts` therefore fall through to the **room engine's own** captions from
`i18n/locales/{en,vi}/worlds/roomv2.ts`:

> *"A page torn from a notebook: interview questions and the supervisor's comments."*
> *"Canteen and print-shop receipts. Money is a little tight this month."*

So there is **no stale-bank bug** — v2's worry was wrong, and the desk is already neutral and
in-fiction (the notebook page even fits a student writing up interviews).

What *is* true, and it is the useful part:

- the `note` prop is a sheet of paper **already modelled**, already in `HAND_INSPECT`, already playing
  `audio.paper('desk')`, already with a pose and an inspect caption;
- but `PROP_TO_OBJECT` (`RoomChapterLayer.tsx:138`) maps it to `obj.note`, and the host dispatches
  `INTERACT_OBJECT` on `interact`. With no `obj.note` in the scenario the inspect **shows the room's
  caption and records nothing**;
- and `InteractableId` is a closed union with a total `Record`, so a brand-new `obj.slip` would force
  an entry into the parked story's `interactables.ts` as well.

**Decision:** the slip *is* `obj.note`. Add `"obj.note"` to the chapter's `interactables`, keep the
engine's paper and its sound, and let the authored `inspectionText` replace the generic caption in
this scenario only. The parked story keeps its own three entries; nothing is edited in it.

**Corrected in Slice A, after the code said no.** `INTERACT_OBJECT` appends to `state.interacted` and
discovers `reveals`; it cannot set a flag. So reading the slip is **text and a record**, and nothing
else — which is also the honest model: reading a paper does not change what the player will do, only
what they know. Every state move in the parcel thread lives on a device action instead. There is no
`trackingSlipOnPerson` flag: the slip's payoff is the 4-minute lookup in the courier app (the phone
number route costs 8), and that difference is created by what the app says, not by owning paper.

Cost as shipped: one `interactables` row, one long `inspectionText` per locale, and **zero** changes
to `roomv2`. The room's own caption remains the fallback if a save predates the row.

---

## 6. The loop, with the arithmetic that actually holds

`minutesFromStart(3, h, m) = 420 + 60h + m`.

| Elapsed | Clock | Happens | Who decides |
| --- | --- | --- | --- |
| 900 | Wed 08:00 | Mission opens. `msg.parcel-fee` arrives. The slip is on the desk. | — |
| 900–960 | 08:00–09:00 | Prep window: read the slip, start the recorder, open the courier app, or leave now | player |
| 960 | 09:00 | Cô Ba's schedule slot begins (`interviewee_q5`, 960–1260) | world |
| 960–1076 | 09:00–10:56 | Walk, wait 4, ride 34 (after §5.2: real minutes, real 7,000đ) | player |
| 1076 | 10:56 | **Last bus that can still arrive by 11:30** (34-minute ride, no wait) | world |
| 1110 | 11:30 | `cal.interview` window opens | world |
| **1121** | **11:41** | **The phone rings, mid-sentence** (§7.5) | player |
| 1140 | 12:00 | The window the shopkeeper keeps is over → her replies change, then stop (§6.1) | world |
| 1158 | 12:18 | If the call was missed: voicemail with a timestamp that stays | world |
| 1170 | 12:30 | `cal.interview` window closes | world |
| 1230 | 13:30 | Exit interview over; the video fallback is the only route left | player |
| 1290 | 14:30 | Back at the room. Mission closes on every path. | — |

### 6.1 What "closing at 12:00" can be, given static anchors

She cannot walk away (§1). So closing is **speech**, and it costs the player the thing that matters:

- `1121–1140`: full replies, 3 options, numbers and names.
- `>1140`: same NPC, **two** options, and every answer is one line ("Cô phải dọn hàng rồi"), no
  quotable data. The recorder keeps running and records nothing useful — which is the honest failure.
- `>1260`: `resolveNpcSchedule` still returns `schedule[0]`, so she is *reachable*; the dialogue
  reports that the shutters are down and she is only putting things away. No new data.

This is better than a vanishing NPC: the player watches a window close in real time.

---

## 7. Signature mechanics

### 7.1 The slip is an object

- Prop: `note` (the desk sheet, §5.3). The chapter gains `obj.note` with `actionLabel: "read"`.
- `inspectionText`: the real tracking code `TH24-4471-0925`, the `+000 90 4471 2210` hotline, and the
  line *"redelivery at the counter is free"* — the mission's only teacher, and it is on paper.
- Taking it sets `trackingSlipOnPerson`. Using the courier app **without** the slip is possible but
  costs 4 extra minutes and shows a masked code (`TH24-••••-0925`).
- The slip never enters the journal. It is a thing in a pocket, not a hint in a UI.

### 7.2 Battery is a derived counter, not a resource

No new state, no save version, no reducer change:

```ts
// selectors.ts (new, pure)
export const phoneBattery = (state: ChapterState, scenario: ScenarioDefinition): number => {
  const spend = state.events.filter((entry) => {
    const action = entry.action;
    if (action.type !== "USE_DEVICE_ITEM") return false;
    const item = (scenario.deviceItems ?? []).find((candidate) => candidate.id === action.itemId);
    return item !== undefined && DEFAULT_APP_DEVICES[item.app].includes("phone");
  }).length;
  return Math.max(0, 100 - 6 * spend);
};
```

- Every phone action costs 6. Below 20 the fake page's "verify" starts failing (a `requires` on the
  battery value is *not* available inside scenario data, so the throttle lives in the page's own
  action `visibleWhen`… which cannot read derived values either — so v3 keeps battery **out of the
  data layer** and lets it drive **presentation only**: the status bar, a dimmed phone, and the
  power bank's usefulness in the transcript). Honest scope: battery is felt, not enforced.
- `PhoneStatusBar.tsx` currently shows a PNG with **76 drawn in**. A live level needs a drawn
  (SVG/CSS) battery; the PNG cannot be reused. That is the whole cost.

### 7.3 The world does not announce

No arrival banner for the shop, no marker, no distance. The shop is found by the number on the slip
and the sign above the shutter. The bus stop is found because it is where people are standing.

### 7.4 The interview, built from what exists

Given §1 (no core face-to-face dialogue, and street replies cannot write state), v3 splits the scene
in two, each using a proven mechanism:

| Layer | Mechanism | Writes state? |
| --- | --- | --- |
| **Presence** | Cô Ba as a Story NPC with a `worldAnchor` at the Chợ Lớn stop: ambient bark at 7.5 m, staging cue, 3 reply options that branch on `ctx.flags` | no (presentation only) |
| **Record** | `contact.coba` in the phone's Contacts: 5 actions, each with `timeCostMinutes` and a `transcript`, exactly like `contact.training-office` | yes, through normal `effects` |

The player walks up, hears her, talks to her in the street — and the *record* of what was said is what
Mission 05 can use. In-fiction this reads as: the recorder is running, the phone is where the notes end
up. In-code it reads as: one scene, two proven subsystems, zero new engine.

Cost of the presence layer: one `worldAnchor` on `interviewee_q5` + staggering check. Note
`storyCast.test.ts` asserts `OPEN_WORLD_STORY_NPCS.length === 6` → becomes 7, and the 4 m separation
loop must still pass.

Cost of the record layer: one `DeviceItemDef` with `app: "contacts"`, five actions. Free.

### 7.5 The ring at 11:41

An event, not a call — because `call.ringWhen` needs a `CallDef` + a graph, and every incoming call
also freezes the clock (§5.1). The event is `channel: "call"`, `autoResolve: false`, with four
responses. Once §5.1 is fixed, leaving it ringing costs real minutes.

| Response | Minutes | What the transcript gains | What it costs |
| --- | --- | --- | --- |
| `answer` | 3 | nothing — and one of her numbers is said while he is not listening | the quote, and her patience |
| `decline` | 0 | one extra line: she waits, then continues | a voicemail at 12:18 that stays in the log |
| `show-her` | 2 | **+1 quotable line**: she names the tell on the fake receipt | the most useful datum in the chapter; she now knows he checks |
| `ignore` | 0 | nothing | the ringing, unresolved, in the event log for the rest of the week |

No option is scored. `show-her` sets `cobaTrustsAlex`, which is the only flag in the mission that
unlocks something *good* — and it costs time and exposure. That is the shape of every real decision
in the game.

---

## 8. The interview, as five phone actions

`contact.coba` — `app: "contacts"`, `title: "Cô Ba (interview)"`, `detail: "+000 90 1177 0420"`.

| Action | Time | Requires | Transcript yields | Effect |
| --- | --- | --- | --- | --- |
| `open` | 2 | — | she opens the shop, asks who he is | — |
| `ask-week` | 6 | `open` | the week she had: 3 payments, 2 receipts kept | `evidence +1` |
| `show-slip` | 2 | `open` | the slip is a real one; the 22k message is not | `parcelTrackingVerified` |
| `clarify-receipt` | 4 | `ask-week` | *"The date on the receipt and the date they told me are different. I kept both."* | `evidence +1`, `cobaTrustsAlex` |
| `check-times` (challenge) | 4 | `ask-week` | she answers in one line; the shop gets busier | `cobaGuarded` |
| `record-with-her` | 1 | `open`, item `app.recorder` | she agrees, once, and then speaks more slowly | `recordingConsented` |
| `leave` | 0 | — | she goes back to her receipts | `interviewDone` |

`cobaGuarded` is a *soft* fail: the later actions still exist, but their transcripts are one line and
give nothing. The player discovers that pressing too hard closes a person — no meter says so.

---

## 9. Consequences

| State | Set by | Pays off in |
| --- | --- | --- |
| `backupSecured` (exists) | locker pickup | M05: the 28-minute recovery branch exists at all |
| `parcelFeePaid` | paying the link | M05: the recovery offer quotes 22,000đ and the exact minute |
| `parcelCredentialsExposed` | typing into the fake page | M04/M05: the next call greets Alex by name and reads the last four digits — `call.alex` already displays the player's own number, so the mechanism is in place |
| `trackingSlipOnPerson` | taking the slip | the counter is 4 minutes cheaper; M03 can mention the paper in his pocket |
| `rideOffAppTaken` | taking the driver | M03: he is outside the boarding house and knows the address |
| `rideDisputed` | stopping the trip | M03: he is not |
| `cobaTrustsAlex` | `clarify-receipt` | M03: her shop is a reference Alex can physically check before paying a landlord |
| `cobaGuarded` | `check-times` | the interview's own later lines, and M05's debrief tone |
| `videoInterviewUnlocked` | asking for the fallback before 12:30 | a 19:00 call that costs the evening's thesis time |
| `interviewDone` | any exit | M05 debrief; `thesisProgress −4` only if no data was collected at all |

Every one of these is read by `storyCast.ts` through the existing
`StoryNpcRuntimeContext.flags` (`RoomChapterLayer.tsx:914` already passes `narrativeState.persistent`),
so the street's dialogue reacts to M02 **with no new plumbing**.

---

## 10. Data model

### 10.1 Flags (6 planned; 3 shipped in Slice A — `foundation.test.ts:78` asserts the exact object)

```ts
shipped:  "parcelCredentialsExposed", "parcelFeePaid", "parcelAtCounter",
later:    "recorderOnPerson" (Slice D), "cobaTrustsAlex" + "interviewDone" (Slice C),
```

`parcelAtCounter` replaces the v3 `trackingSlipOnPerson`: it records *what the player learned*, which
is what the game can actually write, and it is the flag the 13:30 closing event reads. Adding a flag
before anything writes it makes the validator's new producer check pass on nothing and leaves dead
state in the save — the three "later" flags land with the slice that first sets them.

Deliberately dropped from v2: `rideOffAppTaken` / `rideDisputed` live in the **open world**, not the
core, until Slice B wires a host; `cobaGuarded` is derived from `interviewDone` + a `check-times`
`itemActionDone` condition, so it needs no flag; `videoInterviewUnlocked` becomes a mission path
condition on `itemActionDone`.

`storyCast.ts` can only read flags that exist in `PersistentFlags`, so all six are genuine additions to
`PERSISTENT_FLAG_IDS` + `CHAPTER_1_INITIAL_STATE.persistent` + the `foundation.test.ts` literal.

### 10.2 Mission (no steps, on purpose)

```ts
{
  id: "m02.last-interview",
  title: "THE LAST INTERVIEW",
  optional: false,
  opensWhen: { atMinute: 900 },                    // Wed 08:00
  deadlineAtMinute: 1290,                          // Wed 14:30
  completeWhen: [{ kind: "persistent", flag: "interviewDone", value: true }],
  onFail: [{ kind: "adjustResource", resource: "thesisProgress", delta: -4 }],
  paths: [
    { id: "in-person", when: [done("contact.coba", "clarify-receipt")], objective: "…" },
    { id: "guarded",   when: [done("contact.coba", "check-times")],      objective: "…" },
    { id: "fallback",  when: [],                                        objective: "…" },
  ],
}
```

**Why no `steps`:** `taskMode` is scenario-wide, but a mission whose paths have no steps has
`current === null`, so the HUD marker (`laptopTaskAppId`) never points anywhere. M02 gets "no
waypoints" for free, by omission. Mission 01 keeps its steps and still drives the tracker.

**One gap the source shows, and its fix.** `collectProducers` (`validateScenario.ts:369`) counts what
can set a **flag**; it does not count anything for `persistent` flags. So a `completeWhen` on
`interviewDone` is not proven reachable by the validator — it is only true at runtime because an
action sets it. Two honest options:

1. give the mission `paths` whose last required step is the action that sets the flag, so the tracker
   itself names the way (but that reintroduces a waypoint, which §7.3 forbids);
2. add one `checkConditions`-style guard for `persistent` in `collectProducers` — a 6-line change to a
   file every other mission depends on.

v3 takes **(2) as a precondition of Slice C**, not a nice-to-have: without it, a typo in a flag name
deletes M02 from every playthrough and the validator stays silent. The parked story is unaffected —
it has no `persistent` conditions.

### 10.3 The events (3 planned; `m02.counter-closes` shipped)

```ts
{ id: "m02.ring", channel: "call", optional: false, autoResolve: false,
  trigger: { atMinute: 1121, when: [done("contact.coba", "open")] },
  deadlineAfterMinutes: 2,
  responses: [answer(3) | decline(0) | show-her(2) | ignore(0)] }

{ id: "m02.voicemail", channel: "notification", optional: true, autoResolve: true,
  trigger: { atMinute: 1158, when: [{ kind: "eventResponse", eventId: "m02.ring", response: "decline" }] },
  // A record, not a prompt: it costs nothing and cannot be undone.
  onFire: [{ kind: "deliverItem", itemId: "msg.coba-voicemail" }], responses: [] }

{ id: "m02.parcel-closes", channel: "notification", optional: true, autoResolve: true,
  trigger: { atMinute: 1230, when: [flag("parcelFeePaid", false)] },
  onFire: [{ kind: "deliverItem", itemId: "msg.parcel-closed" }], responses: [] }
```

### 10.4 The content (5 items)

`msg.parcel-fee` (messages, arrives at 900), `page.parcel` (mail, `detail: "tochhanh24.example"`,
`arrives: { when: [{ kind: "itemActionDone", itemId: "msg.parcel-fee", actionId: "open-link" }] }`,
actions `enter-code` / `pay-fee` 22,000 / `close`), `app.courier` (files, lookup with/without the slip),
`contact.coba` (§8), `msg.coba-voicemail` (messages, `arrives` by `deliverItem` only).

All numbers `+000 …`. Domains: `tochhanh24.example` only; the fake page reuses the **existing**
`kind: "clearance"` machinery only if it is generalised — otherwise it ships as a plain static page
plus a `pay-fee` action on the mail item, which is the cheaper and already-validated pattern
(`validateDeviceContent` checks domains and costs).

---

## 11. Content rules

Inherits §13 of the chapter document. Adds:

- Courier "Tốc Hành 24" is fictional; no real tracking format.
- No line says a choice is safe, smart or a mistake. The debrief describes what the scammer did.
- No violence, no chase, no "fight back"; stopping a ride is speech and a door.
- **Three existing lines must be rewritten before M02 ships** (`storyCast.ts`), because they are the
  game answering its own question:
  1. `driver_ask_app` insight — *"Mission 02 warning: Off-app cash drivers have no GPS log…"*
  2. `driver_ask_plate` insight — *"Red flag: Offering 'unmonitored back-alleys'…"*
  3. `minh_m02_route` — *"…off-app cash rides aren't worth the risk."*
  Replace with what a person can observe in the moment (no plate light, a route that does not reach
  District 5, cash asked for before the ride), and let Minh talk about his own past, in the past tense.

---

## 12. Feel spec — five questions, asked with no context

1. When the phone rang in the shop, did you stop breathing for a second?
2. How did you know the driver was going the wrong way — or did you?
3. After you missed her, did you think about a moment or about a button?
4. What was written on the paper on your desk?
5. Would you go back to that shop tomorrow with nothing to do there?

Four of five answering *yes / a landmark / a moment / the tracking code / yes* means the mission is
real in the only sense that matters.

---

## 13. Test plan

- **Data** (`chapter1/mission02.test.ts`): `validateWorldContent`/`validateDeviceContent` on the real
  scenario stay `[]`; every new flag is set by some effect the validator can see; the ring fires at
  1121 only when `contact.coba.open` is done, and not otherwise; `deadlineAfterMinutes` expires the
  pending ring at 1123; no action has a negative time cost.
- **Playthroughs**: four runs through the real reducer — paid the link / verified and collected /
  late with the fallback / late with nothing. Assert `interviewDone`, `thesisProgress`, `evidence`,
  `cash`, and that the last run is the only one with `onFail` applied.
- **Determinism of the derived battery**: same action log ⇒ same level; a laptop-only action costs
  nothing.
- **jsdom layer** (`RoomChapterLayer.*.test.tsx` rig): the slip prompt appears on the `note` prop; the
  phone thread shows the fake sender; the mission list contains `m02.last-interview` with no current
  step.
- **Lint**: `content.vi.test.ts` already enforces reserved domains, `+000` numbers, no "safe", no
  blaming phrase, and domain/number parity between en and vi — the new keys must satisfy it. The
  `mission01.test.ts` overlay-coverage test compares `narrativeTextEntries(S)` with the vi overlay
  **exactly**, so every new field needs a vi key or the suite fails.

---

## 14. Slices, with the real cost

| Slice | Contents | Cost | Risk |
| --- | --- | --- | --- |
| **A — the paper** ✅ | `obj.note` interactable + 6 flags; `msg.parcel-fee`; `page.parcel`; `app.courier`; one event | shipped in `1a8d95a`: 8 files, 1,029 lines, no engine change | none |
| **B — the schedule** ✅ | `clockRule.ts` (the world no longer waits for the phone or the ring); `PAY_FARE` core action with a ledger line; Route 06 on the chapter clock and wallet | shipped: 4 core files, 5 host files, 3 test files | the one place a bug costs real minutes of play |
| **C — the woman** | `worldAnchor` for `interviewee_q5`; `contact.coba` (5 actions); `m02.last-interview` + 3 events; `cobaTrustsAlex`; street barks gated on the new flags; the 3 rewritten lines | medium: `storyCast.ts` + tests that count NPCs | 7th street NPC: separation test, staging cues, plus one more skinned model on the street |
| **D — the tell** | derived battery selector + drawn status bar; phone dims below 20 | medium-low: presentation only | must not become a HUD meter |

Slices A→B→C are the mission. D is the mission's texture and ships only if A–C are green.

### What Slice B changed on contact with the code

1. **"The phone stops the clock" was only half the bug.** §5.1 proposed unpausing while *ringing*;
   in practice `free` also excludes every overlay, so the phone and the laptop froze the day too.
   The fix is a named rule (`clockRule.ts`) with two answers, not one line: **devices in the world
   let time pass** (phone, laptop), **the game's own screens do not** (planner, journal, tasks,
   inspection, pause, ending), and **a ringing call does not, an answered call does**. The parked
   story keeps its old rule because its opening call is scripted, not scheduled — a branch in the
   rule, tested, rather than a regression hidden in M01.
2. **A fare must be a transaction.** The bus had a private `cash` field, so a ticket could not
   reach the ledger. `PAY_FARE {amount,label,counterparty}` is now a core action: it refuses
   without the cash, writes one ledger line through `recordTransaction`, and touches nothing
   else. The alternative — letting the UI subtract money — would have put a second wallet in the
   game, which is the exact failure mode the chapter is about.
3. **The demo accelerators had to go, but only on the story clock.** `BusRouteController` runs at
   12× while waiting and 5× otherwise so `/testbus` is a 40-second loop, and it *fast-forwards the
   wait* on `wait()`. On the chapter clock all three are wrong: four minutes of waiting is four
   minutes, and a ride is exactly 34 (`transit.storyclock.test.ts` asserts it lands 34 minutes after
   departure). The demo path is untouched and tested from the other side.
4. **The bus was already the right bus.** Route 06 runs Lý Thái Tổ (Quận 10) → Chợ Lớn (Quận 5),
   which is where the parcel counter is. No new route, no new geometry: wiring the existing one was
   the whole job.
5. **The core cannot import `features/`** (a boundary test enforces it), so the fare constant is
   duplicated with a cross-check from the `features` side instead of a shared import.

### What Slice A changed on contact with the code

Three things could not be shipped as written, and the reasons are worth keeping:

1. **No per-chapter prompt table.** `CHAPTER_1_INTERACTION_PROMPTS` is a total
   `Record<InteractableId, string>`, and the overlay-key test compares the scenario's keys with the
   Vietnamese file exactly. A `prompts/obj.note` key is therefore an error until the parked story
   and the table grow a per-chapter seam. Slice A uses the room engine's own hover label
   (`label.note` in `worlds/roomv2.ts`) and authors the *content* in `inspectionText`, which is what
   the player actually reads. Revisit only if the chapter needs two different labels for one prop.
2. **`INTERACT_OBJECT` still cannot write state** — confirmed at runtime, not just by reading: the
   reducer appends to `interacted` and discovers `reveals`, nothing else. Every state move in the
   parcel thread therefore lives on a device action, and the slip itself is text.
3. **The validator gap is now closed, not just documented** (`validateScenario.ts`): persistent flags
   are collected from `initial.persistent`, event `onFire`/`onExpire`/responses, mission
   `onOpen`/`onComplete`/`onFail`/`path.onEnter`, thesis-task effects and device-item
   `onOpen`/actions, and every `persistent` condition is checked against that set (V4,
   "is never set by any effect"). `cond.value === false` is accepted for a known flag, because
   "not set yet" is the default the initial state produces. Costs ~50 lines, not the ~6 the earlier
   draft guessed; the widening is the four extra effect sites, not the check itself.

---

## 15. Open questions

1. **Battery**: keep it presentational (v3) or promote it to a resource in Chapter 2, with the
   `RESOURCE_IDS` + `RESOURCE_LIMITS` + balance-table cost that implies?
2. **Fake page**: generalise `kind: "clearance"` into a `kind: "payment"` component, or ship the
   parcel page as a static page + a mail action (cheaper, less vivid)?
3. **The bus**: does Route 06 keep its 12× demo pacing for players who already know it, once it is
   wired to the chapter clock? A 34-minute ride is 34 real seconds — long enough to matter, short
   enough to be fair. Recommendation: keep it, and let the rain on the window do the work.
4. Do we promote the gate-left-open detail (a neighbour mentions it on Thursday) from texture to an
   M03 consequence, or is that one consequence too many for one mission?
