---
inclusion: fileMatch
fileMatchPattern: ["**/apps/game/src/game/narrative/**", "**/apps/game/src/game/saves/**", "**/apps/game/src/features/chapter1/**", "**/apps/game/src/i18n/locales/*/chapter1/**"]
---

# Gameplay rules (deterministic narrative core)

Updated 2026-11-16 for the double-deception rebuild of Chapter 1 (spec
`chapter-01-double-deception`). The street chapter that older text described is parked under
`apps/game/src/legacy/urgent-call-street/` and is not maintained.

## State and transitions

- All gameplay state is one `ChapterState` (`game/narrative/types.ts`). It changes only through
  `chapterReducer(state, action, scenario)` with a `CoreAction` (16 kinds: the 14 earlier kinds
  plus `DEVICE_ACTION` and `COMBINE_EVIDENCE`), via `ChapterStore`. UI, audio, voice and the 3D
  scene read state through selectors; they never write it. The Room v2 engine holds no story
  state; it talks to the layer through `RoomStoryPort`.
- The reducer is pure: no clock, randomness, I/O, React, Three.js or i18n. A rejected action
  returns the SAME state object with a `reason` from `REASONS`; an accepted one appends exactly
  one `EventLogEntry` with `seq === events.length`.
- Unknown or malformed actions are rejected, never thrown (`isCoreAction` whitelists ids).
- Lifecycle: `not-started` -> `START_CHAPTER` -> `playing` -> decision recorded ->
  `selectOutcome` sets `outcome` and `status: "ended"` -> only `FINISH_CHAPTER` is accepted ->
  `finished` accepts nothing.

## Rules live in data, not in code

- Which incoming call rings is `ringWhen` on the call (a list of condition lists: any list whose
  conditions all hold). Calls never ring from a timer. Each incoming call rings at most once:
  once it has a record in the call log (answered, declined, missed or ended) `RING_CALL` is
  rejected with `callAlreadyRang`, and the selectors never offer it again. A call rings only while
  no call, conversation, overlay or decision is open.
- Objectives complete from `completeWhen`, decisions apply their own effects, and an ending is
  chosen by `selectWhen`. Do not add chapter-specific `if` branches to the reducer for these.
- Endings are tried by `order`; the first whose `selectWhen` holds wins and the last one is
  unconditional, so selection is total. A, `false-victory`, needs `follow-recovery` without
  `code_shared`; B, `perfect-chain`, needs `money_moved`; C, `break-the-chain`, needs
  `official_channel_verified` whatever the decision (requirement 10.7), with a `case-report`
  variant when both deductions `ded.same-source` and `ded.third-caller-not-independent` are
  recorded; D, `unfinished-case`, takes everything else. Pressure, timers and random numbers never
  choose an ending.
- Deductions: `COMBINE_EVIDENCE` takes 2 or 3 distinct discovered evidence ids; order does not
  matter. The set must equal a deduction's evidence set exactly (`matchDeduction`). A deduction
  is recorded only when its inputs are discovered (and its `requires` hold).
  Its effects may set flags and move a claim to `inconclusive`; only the official confirmation
  (`ev.official-confirmation`) can make a claim `contradicted`. A deduction never adds pressure.
- Device actions (`DEVICE_ACTION`) are the laptop and phone-records steps (open the notification,
  bank app, compare view, call details, Review Security). They are data (`DeviceActionDef`) with
  `requires`, `effects` and `reveals`.
- Beats are state-triggered effects (for example the voicemail or the laptop notification after
  the first call closes). They settle within `MAX_BEAT_PASSES`.

## Branching and scenarios

- Scenario data is plain JSON-compatible data (`ScenarioDefinition`). Branches are dialogue
  options with `conditions`, `effects` and `next` (a node id or `{ end: "hang-up" }`).
- Every scenario change must keep `validateScenario` empty (references and schema across
  sources, deductions, device actions, beats, ring rules, objectives, decisions and endings;
  every node reaches an end, pressure nodes end within 3 steps, at most 4 unconditional options;
  no impossible conditions; no dialogue needs a harmful option to reach an end; at least one
  decision is harmless; endings are total over decisions; every incoming call has a `ringWhen`
  that can hold; evidence is never reachable only through a deduction that needs it) and
  `analyzeReachability` clean (all 4 endings reachable, no unreachable node or option, no soft
  lock). Narration graphs are sequences of terminal nodes played by the presentation layer; the
  validator exempts these playback-only graphs.
- No harmful action may be the only way to advance a layer. Every layer has an exit.
- Earlier choices may change later dialogue only through flags, evidence, deductions, claims and
  the call log.

## Valid states (checked by `assertInvariants` in `src/test/chapterRuns.ts`)

No duplicate or unknown discovered evidence, recorded deductions or interacted objects; every
recorded deduction has its inputs discovered; a deduction's claim effects leave the claim
`inconclusive` or `contradicted`; objectives known and never both active and completed; the
conversation's graph and node exist; call status matches the current call and an active call has
a linked conversation; a decision exists if and only if an outcome exists; a contradicted claim
only with `ev.official-confirmation`; `official_channel_verified` only with that evidence; the
laptop notification is delivered only after the first call is closed; `pressure` is a whole
number in 0..3; event `seq` is contiguous; `finished` only with an outcome; the deception
projection (`selectDeception`) equals the projection of flags, evidence, deductions and decision.

## Progression, decisions, scoring

- There is no numeric score. Results are categorical outcomes; `pressure` (0..3) is the only
  number and is clamped by `applyEffect`. Pressure never selects an ending.
- Five decisions: `follow-recovery`, `follow-both`, `refuse-and-stop`, `verify-independently`
  and `report-deception` (needs the `ded.same-source` deduction). `refuse-and-stop` is always
  available. `verify-independently` has a pre-step (`VERIFY_CLAIM` with the saved-contact method)
  and needs the saved contact to be known. Never reward a dangerous action: harm
  (`code_shared`, `second_caller_trusted`, `money_moved`) comes from an explicit player choice,
  never from a timer or a forced step.
- The debrief is derived only from scenario data and the event log. It never calls a number,
  message, caller, website or notification "safe".

## Saves (format v3)

A save (`scammaze_save_v3`, with a `contentVersion`) stores the action log; restore replays it
through the reducer, so a save is valid exactly when every action is accepted. A save with an
older `formatVersion` or another `contentVersion` is `incompatible`: report it, do not migrate it
and do not delete it. Lenient restore trims to the last accepted action and shows a notice.
Changing reducer behavior or scenario data can invalidate saves: keep the save and replay tests
green, or bump `SAVE_CONTENT_VERSION` (and the format version when the envelope changes).

## AI

AI may later propose wording only. It never chooses outcomes, evidence, flags or state, and the
game must play identically with AI unavailable. The game has no AI setting today, so "AI off" is
the only mode; `aiOff.test.ts` completes every ending with `fetch` stubbed to throw.
