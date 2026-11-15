# Implementation Plan: Chapter 1 Double Deception (`chapter-01-double-deception`)

## Overview

This plan implements the approved design in TypeScript (React 19, Three.js, Vitest, Tailwind v4, `lucide-react`, `i18next`). The roadmap "TASK 00 to 12" was not part of the brief, so it is mapped by theme (open question Q5 in `design.md`):

| Roadmap | Theme | Top-level tasks here |
|---|---|---|
| TASK 00 | Baseline, triage, parking of the old street chapter | 1 |
| TASK 01 | Core contracts | 2 |
| TASK 02 | Core mechanics (pure) | 3 |
| TASK 03 | Acts I and II scenario data | 4 |
| TASK 04 | Act III evidence and deductions | 5 |
| TASK 05 | Act IV third caller | 6 |
| TASK 06 | Act V decisions, endings, debrief, scenario assembly, tests | 7 |
| TASK 07 | Room v2 integration | 8 |
| TASK 08 | Laptop, phone records and journal UI | 9 |
| TASK 09 | Chapter layer, call UI and voice integration | 10 |
| TASK 10 | Localization and voice clips | 11 |
| TASK 11 | Saves and flow | 12 |
| TASK 12 | Verification and delivery | 13, 14, 15 |

Order of work: park the old chapter, rewrite the contracts, build the core against a small fixture scenario, write the scenario data, assemble and validate it, integrate the room, build the UI and layer, localize and generate voice, then saves and flow, then verify and deliver. Content tests that need the assembled scenario live in task 7. Property tests sit next to the code they check, one sub-task per property.

Resolved assumptions (recorded in the design):

- The old street chapter is parked, not deleted, and excluded from the quality gates (Q1).
- The player-facing title of Act II is "The Reassuring Choice" (Q2). The 3D phone overlay canvas is optional, the 2D fallback comes first (Q3).
- Deductions set a claim to `inconclusive` only. `contradicted` needs the official line (D7).
- Calls ring from authored conditions, never from timers (D8).

### Rules for every task

- **Branch.** Work on `feat/chapter-01-double-deception` (already created from `main` @ `37eeedd`). Confirm with `git branch --show-current` before the first commit. Never switch branches, never merge, never force push, never push to `main`. Preserve unrelated working-tree changes.
- **Scope.** Edit only the files named in the task and their direct tests. If another file must change, state why in the task report. Do not edit `apps/game/src/features/chapter1/call/**` behavior, `PhoneModel3D.tsx`, the main menu scene or the loading screen, except where a task names them.
- **Tests are required.** No test sub-task is optional. Property tests use `apps/game/src/test/seededRandom.ts`, run at least 200 cases (`CORE_PROPERTY_RUNS`), set an explicit timeout, print the seed and case index on failure, and start with the comment `// Feature: chapter-01-double-deception, Property N: <title>`. Add no new dependencies and no second PBT library.
- **Running tests.** Run targeted tests with `pnpm --filter @scammaze/game exec vitest run <paths>`. Never run tests and typecheck in parallel. The full suite takes about 2 minutes: pass `timeout` 900000 to the shell.
- **PowerShell.** Do not chain commands with `&&`. Run each command as its own call. Write files as UTF-8 without BOM and LF line endings.
- **Commits.** Conventional Commits (`type(scope): summary`). Stage named files only, never `git add -A` or `git add .`. Add the trailer `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`. Keep the human as author. Never stage `.env` files, `apps/game/dist/`, `apps/game/.voice-cache/` or `node_modules/`. Commit tasks run alone in their wave.
- **Content.** Repository content in English. All user-facing text through i18n keys in `en` and `vi` or through the Scenario_Data and the Vietnamese overlay. No hard-coded UI text, no string concatenation of sentences. No emoji; icons from `lucide-react`. Never call a number, message, URL, website, caller or notification "safe" or "an toàn". Fictional organizations only; domains only `.test`, `.example`, `.invalid` or `example.com`; phone numbers only `+000 ...` rendered as plain text; no links, no fetches of scenario URLs. Scenario domains are never clickable.
- **Core purity.** The Chapter_Core (`game/narrative/**`) imports only `@scammaze/shared-types` and its own modules. No clock, no `Math.random`, no I/O, no React, no Three.js, no i18n. `boundaries.test.ts` must stay green.
- **Agents.** Core tasks: `gameplay-engineer`. Scenario data and text: `scenario-designer` (data and translations only). Room engine review: `world-architect` (read-only). Independent review: `qa-security-reviewer` (read-only). One writer per file at a time.
- **Honesty.** Do not write that something is implemented, measured or verified unless you verified it in the task. Human playtest, real GPU, real speakers and real devices are recorded as not executed.
- **Paths.** All paths are under `apps/game/src/` unless they start with `packages/`, `docs/`, `.kiro/`, `apps/game/scripts/` or `apps/game/public/`. `room/` means `features/chapter1/room/`, `call/` means `features/chapter1/call/`, `chapter1/` means `game/narrative/chapter1/`.

## Tasks

- [x] 1. Baseline, triage and parking (TASK 00)
  - [x] 1.1 Record the baseline and triage the affected files
    - Run `git status --short` and note unrelated changes. Confirm the branch.
    - Run `pnpm test` (expected from the design audit: 134 files, 1211 tests pass) and `pnpm typecheck`, each on its own, and record the real results in the task report.
    - List every file that references `CHAPTER_1_SCENARIO`, the old IDs (`call.scam-1`, `npc.sam`, `obj.wallet`), or street-only modules, and classify each as keep (shared UI, voice, saves), rewrite (core tests, harness, i18n), or park (street page, canvas, world props, Sam dialogue, old scenario tests). Put the list in the task report; it becomes the body of the commit in 1.3 and part of the progress entry in 15.1.
    - Check that `apps/game/tsconfig*.json` and the Vitest config can take an `exclude` list for `src/legacy/**`.
    - _Requirements: 1.4, 24.5_
  - [x] 1.2 Park the old street chapter
    - Copy the old scenario data modules `chapter1/*.ts` and `chapter1/dialogues/*.ts` to `legacy/urgent-call-street/narrative/chapter1/` (a copy, so the new files keep history at the original path).
    - `git mv` the street-only UI to `legacy/urgent-call-street/features/chapter1/`: `ChapterOnePage.tsx`, `ChapterOneCanvas.tsx`, `useCallTriggers.ts`, `world/*`, `interaction/*`, `dialogue/*`, and the tests that only exercise them (for example `ChapterOnePage*.test.tsx`, `noNewWorldObjects.test.ts`, `call/ChapterOnePage.call.test.tsx`). Move the old-scenario core tests that cannot work with the new scenario (`chapter1/playthroughs.test.ts`, `content.test.ts`, `evidenceCoverage.test.ts`, `savedPathsStillReplay.test.ts`, `acts.test.ts`) the same way. Keep the shared modules in place.
    - Add `src/legacy/**` to the `exclude` lists of the app `tsconfig` and the Vitest config. Add `legacy/urgent-call-street/README.md` (3 lines: what it is, why it is excluded, that it is not maintained). This is the only new Markdown file.
    - In `app/App.tsx`, replace the `ChapterOnePage` import and render with the existing `ChapterPlaceholder` for the `chapter` screen until task 12.4. Adjust `app/App.chapter.test.tsx` accordingly.
    - Run `pnpm typecheck`, then the tests that still exist.
    - _Requirements: 1.4, 3.1_
  - [x] 1.3 Commit the parking
    - Stage the moved and edited files by name. Commit `chore(game): park the street chapter for the double-deception rebuild` with the triage list from 1.1 in the body and the Co-authored-by trailer.
    - _Requirements: 24.3_

- [x] 2. Core contracts (TASK 01)
  - [x] 2.1 Rewrite `chapter1/ids.ts`, add shared types, and replace the old data modules with typed placeholders
    - Rewrite the `as const` ID arrays exactly as listed in the design ("IDs"): objectives, interactables, evidence (E01 to E11), claims, calls, graphs, messages, flags, decisions, outcomes, warning signs, verify methods (`saved-official-contact`, `bank-app`), speakers, tones, acts (five), sources, deductions, device actions. Keep `NPC_IDS` as an empty tuple so `TALK_TO_NPC` still type-checks.
    - In `packages/shared-types/src/index.ts` add only the chapter-agnostic `ProvenanceTrust` and `DebriefTimelineKind`.
    - Replace the contents of the old `chapter1/*.ts` data modules with minimal typed placeholders (empty records) so `pnpm typecheck` stays green until the content tasks fill them. The old content is already in `legacy/` from 1.2.
    - Add `chapter1/ids.test.ts`: IDs unique, prefix conventions (`ev.`, `dev.`, `src.`, `ded.`), `IncomingCallId` excludes `call.official`.
    - _Requirements: 3.1, 3.2, 4.1, 7.1, 8.1_
  - [x] 2.2 Extend `game/narrative/types.ts`
    - Add `DEVICE_ACTION` and `COMBINE_EVIDENCE` to `CoreAction` and the new reason codes plan; add conditions `callClosed`, `deductionRecorded`, `decisionIs`; add `ChapterState.deductions`; add discovery route `{ via: "device"; deviceActionId }`.
    - Add `SourceDef`, `DeductionDef`, `DeductionBasis`, `DeviceActionDef`, `BeatDef`, `Aftermath`; add `ringWhen` to `CallDef`, `activateWhen` and `completeWhen` and `hint` to `Objective`, `effects` to `DecisionDef`, `selectWhen`, `order` and `aftermath` to `EndingDef`, `sourceId` to `EvidenceItem`; extend `ScenarioDefinition` with `sources`, `deductions`, `deviceActions`, `beats`.
    - Document each addition with a short comment. Do not change existing field names that the call UI reads (`DialogueNode`, `DialogueOption`, `CallDef.displayName`, `number`).
    - _Requirements: 3.2, 3.3, 4.1, 8.1, 10.4_
  - [x] 2.3 Create the fixture scenario for core tests
    - Create `test/fixtureScenario.ts`: a small, valid `ScenarioDefinition` that uses every mechanism once (two calls with `ringWhen`, one device action, one beat, four evidence items across three sources, two deductions, three decisions, four endings with selection rules, one independent-channel graph, objectives, five acts). It must pass `validateScenario` once 3.7 is done.
    - Export builders: `withFlags`, `withEvidence`, `fixtureState(partial)` for tests. Pure, no React.
    - _Requirements: 3.3, 23.1_

- [x] 3. Core mechanics (TASK 02)
  - [x] 3.1 Extend conditions and evidence discovery
    - In `game/narrative/conditions.ts` implement the three new conditions and keep `applyEffect` pure. Keep the rule that `setClaimStatus` is applied as given (validation is in 3.7).
    - In `game/narrative/evidence.ts` add the `device` discovery route to `canDiscover`.
    - Update `conditions.test.ts` and `evidence.test.ts` using the fixture scenario.
    - _Requirements: 3.3, 7.3, 8.1_
  - [x] 3.2 Add the pure deduction and beat helpers
    - Create `game/narrative/deductions.ts`: `matchDeduction(evidenceIds, scenario)` (set equality with `inputs` plus exactly one `inputsAnyOf` member, order independent), `canRecordDeduction(state, deduction, scenario)`.
    - Create `game/narrative/beats.ts`: `applyBeats(state, scenario)` to a fixed point, at most 8 passes, each beat once (tracked by a flag set by the beat's own effect list, or by a `beats` marker that is derived from the event log; choose the derived approach so no new state field is needed).
    - Tests: matching, permutation, extra and missing members, beat order and the 8-pass limit.
    - _Requirements: 3.3, 8.2, 8.7_
  - [x] 3.3 Generalize the reducer
    - In `game/narrative/reducer.ts`: build `createInitialState` from the ID arrays (flags, claims, `deductions: []`); update `isCoreAction` for 16 kinds; implement `RING_CALL` through `CallDef.ringWhen`; implement `DEVICE_ACTION` (guard `requires`, `once`, effects, `reveals`); implement `COMBINE_EVIDENCE` (reason codes `combinationInvalid`, `evidenceNotAvailable`, `deductionAlreadyRecorded`; record the deduction; apply effects); implement `VERIFY_CLAIM` with `saved-official-contact` (outgoing call to `call.official`, requires E03 or E03b); apply `DecisionDef.effects` in `MAKE_DECISION`; run `applyBeats` after every accepted action; keep the outcome lock and the one-event-per-accepted-action rule.
    - Remove every hard-coded old call, flag and decision branch. Add the new reason strings to `REASONS`.
    - Rewrite `reducer.test.ts` and delete `reducer.followup.test.ts` content that targeted the old chapter (use the fixture scenario).
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 8.2, 8.4, 8.5, 8.6_
  - [x] 3.4 Make objectives and the outcome function data-driven
    - In `game/narrative/objectives.ts` evaluate `activateWhen` and `completeWhen` conditions from Scenario_Data; keep the neutral-action list and the manager result shape.
    - In `game/narrative/outcome.ts` select the ending by ordered `EndingDef.selectWhen`; keep `selectConsequenceVariant`.
    - Update `objectives.test.ts` and `outcome.test.ts` with the fixture scenario.
    - _Requirements: 3.3, 10.4_
  - [x] 3.5 Update the selectors
    - In `game/narrative/selectors.ts` add `selectDeception`, `selectLaptopView` (notification state, bank app screens, compare rows, available device actions), `selectPhoneRecords` (call history, summaries, voicemail, call-saved-contact availability), `selectRingableCall`, `selectCombinationOptions` (discovered evidence and whether a pair or triple matches only when the player submits, never previews the answer), an updated `selectDecisionPanel` for five decisions with the pre-step, and an updated `enumerateCandidateActions` for the new action kinds. Remove `CALL_LOG_EVIDENCE`.
    - Tests with the fixture scenario.
    - _Requirements: 4.4, 5.5, 6.3, 8.11, 9.1, 10.1_
  - [x] 3.6 Extend the debrief builder
    - In `game/narrative/debrief.ts` add `timeline` (one entry per accepted action that has a tag, in `seq` order, with `DebriefTimelineKind`), `analysis` (pressure built, why the warning looked trustworthy, unverified signals, third caller independent flag, trap entered, verify next time), and keep `cluesMissed` separate. Strings come from `scenario.debrief`.
    - Tests with the fixture scenario.
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  - [x] 3.7 Extend the validator and the reachability analyzer
    - In `game/narrative/validateScenario.ts` add rules: every reference in sources, deductions, device actions, beats and ring rules exists; deduction basis holds against source identifiers; no evidence discoverable only after a deduction that needs it; `setClaimStatus` only in `independentChannel` graphs or deduction effects with `inconclusive`; beats settle within 8 passes; at most one harmful option is the only way forward (no layer needs harm to advance); ending rules are total over decisions; every `ringWhen` can hold.
    - In `game/narrative/reachability.ts` update `ENGINE_READ_FLAGS` and `relevantFlags`, add the new actions to the explored graph, and keep the state budget. Report unreachable outcomes, unreachable nodes and options, and soft locks.
    - Tests: shipped fixture is clean; one fault per rule produces an issue.
    - _Requirements: 3.6, 3.7, 8.9, 11.4_
  - [x] 3.8 Teach `localize.ts` the new text fields
    - Add `sources[*].label`, `claimedOrigin`, `deductions[*].statement`, `deviceActions[*].label`, `objectives[*].hint`, `endings[*].aftermath.*`, `debrief.*` to `narrativeTextEntries` and the walker. Keep IDs, conditions and effects unchanged.
    - Update `properties/localize.property.test.ts` expectations that name old fields.
    - _Requirements: 18.2, 18.3, 18.4_
  - [x] 3.9 Commit the contracts and the core
    - Run `pnpm typecheck`, then the core tests (`pnpm --filter @scammaze/game exec vitest run src/game/narrative src/test`), each on its own. Fix failures.
    - Stage the changed core, contract and fixture files by name. Commit `feat(core): add deductions, device actions and data-driven rules for the double-deception chapter`.
    - _Requirements: 3.2, 3.5, 24.3_

- [x] 4. Acts I and II scenario data (TASK 03)
  - [x] 4.1 Sources, claims and phone data
    - Write `chapter1/sources.ts` (nine sources with trust, claimed origin and identifiers: case `NG-4471-X`, contacts `+000 0100 2200`, `+000 0100 7771`, `+000 0100 0800`, domains `northgate-alerts.invalid` and `northgate-bank.example`, app names), `chapter1/claims.ts` (four claims), `chapter1/phone.ts` (calls `call.alex`, `call.recovery`, `call.official` with display names, `+000` numbers and `ringWhen` as in the design; messages `msg.alex-voicemail`, `msg.alex-summary`; phone content for records; the saved bank app screens).
    - Plain English, fictional data only, no "safe" wording.
    - _Requirements: 5.1, 6.4, 6.5, 7.2, 19.2_
  - [x] 4.2 Write the Alex dialogue graph `chapter1/dialogues/alex.ts`
    - About 14 nodes as in the design table: `alex.open`, `alex.who`, `alex.defend`, `alex.details`, `alex.pressure`, `alex.refused`, `alex.code-taken`, plus end nodes. Every spoken node has tone and speaker `spk.alex`; at most 4 options per node; every path ends within 6 steps; hang up is available at every node; the only harmful option is `alex.share-code`. Lines name the case ID and announce the notification and the follow-up team (foreshadowing). No timers or countdown wording ("in minutes" is replaced by "soon").
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.8, 9.7, 11.2, 12.3_
  - [x] 4.3 Device actions and beats data
    - Write `chapter1/deviceActions.ts` (all `dev.*` actions with device, label, requires, effects, reveals, once, debrief tag) and `chapter1/beats.ts` (`beat.voicemail`, `beat.call-summary`, `beat.notification`). Device actions that reveal evidence use `reveals`. The Review Security action sets `review_security_opened` and `recovery_instruction_known` and asks for no input.
    - _Requirements: 5.4, 5.5, 6.1, 6.3, 6.6, 7.3_
  - [x] 4.4 Acts and objectives data
    - Write `chapter1/acts.ts` (five acts with the enter and exit conditions of the design; each exit equals the next enter) and `chapter1/objectives.ts` (six objectives with `activateWhen`, `completeWhen` and optional `hint`).
    - _Requirements: 5.6, 6.1, 15.3, 15.6_

- [x] 5. Act III evidence and deductions (TASK 04)
  - [x] 5.1 Interactables, evidence, warning signs and journal notes
    - Write `chapter1/interactables.ts` (`obj.note`, `obj.receipts`, `obj.calendar` with prompts and inspection text that carry the evidence text) and `chapter1/evidence.ts` (E01 to E11 with source, location, discovery, relations and stances, warning signs, debrief hints; `ev.official-confirmation` only through the official-line node). At least four items are discoverable by prop or screen interaction; two independent paths exist (physical and digital). A single suspicious detail is described as needing interpretation.
    - Add the warning signs and journal notes (for example a note when E02 and E05 are both found).
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.7, 12.4_
  - [x] 5.2 Deduction data
    - Write `chapter1/deductions.ts`: `ded.same-source`, `ded.notification-mismatch`, `ded.third-caller-not-independent` as in the design (inputs, `inputsAnyOf`, requires, basis, statement "These claims are not independently verified.", effects with `inconclusive` only, debrief tags).
    - _Requirements: 8.1, 8.3, 8.10_
  - [x] 5.3 Official line dialogue `chapter1/dialogues/officialLine.ts`
    - About 8 nodes, `independentChannel: true`, speaker `spk.northgate-agent`, honesty `trusted`: greeting, ask case, `off.confirm` (discovers E09: no such case, no such notification, no recovery procedure by phone), advice, basic report guidance, end. Effects set the four claims to `contradicted` and the flag `official_channel_verified`. No claim of safety about any number.
    - _Requirements: 8.8, 10.7, 11.3_

- [x] 6. Act IV third caller (TASK 05)
  - [x] 6.1 Recovery dialogue graph `chapter1/dialogues/recovery.ts`
    - About 26 nodes: five start nodes with `startNodeWhen` in the priority order of the design (verified, confronted, inspected, followed, blank), then the shared body (`rec.cites-case` discovers E08, `rec.confirms-alex`, `rec.procedure` sets `recovery_instruction_known`, `rec.pressure`), options to trust (`rec.trust` sets `second_caller_trusted`), ask to verify, challenge the case number (needs `ded.same-source`), challenge the number (needs `ded.notification-mismatch`), and hang up at every node. Deflection lines react to what the player knows; no line is evidence for itself. The procedure text stays fictional and defensive (remote assist session and a holding account, no usable real-world instructions).
    - _Requirements: 9.2, 9.3, 9.5, 9.6, 9.8, 9.9, 19.5_

- [x] 7. Act V content, scenario assembly and tests (TASK 06)
  - [x] 7.1 Decisions, endings and debrief data
    - Write `chapter1/decisions.ts` (five decisions with `requires`, `effects`, pre-step for verify, hints), `chapter1/endings.ts` (A, B, C, D with `selectWhen`, `order`, variants including `case-report`, `contained-late`, `evidence-built`, simulation label, aftermath for phone and laptop, evidence summary, case report text) and `chapter1/debrief.ts` (mechanism, analysis strings by flag and outcome, safer alternatives, decision notes). Each ending has a different consequence and aftermath.
    - _Requirements: 10.1, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 16.2_
  - [x] 7.2 Aftermath and intro narration graphs
    - Write `chapter1/dialogues/aftermath.ts` (nodes `after.a.1..3`, `after.b.1..3`, `after.c.1..3`, `after.c.secret.1..2`, `after.d.1..3`, speaker `spk.narrator`, no options) and `chapter1/dialogues/intro.ts` (nodes `intro.1..3` for the 22:47 rainy-night introduction).
    - _Requirements: 10.10, 14.1_
  - [x] 7.3 Assemble the scenario and update the content validator
    - Write `chapter1/scenario.ts` with the title "The Urgent Call" and subtitle "The False Victory". Update `game/content/validateChapterContent.ts` for the new collections. Run `validateScenarioIssues` and `analyzeReachability`; fix every issue in the data modules (not by weakening the validator).
    - _Requirements: 3.1, 3.6, 3.7_
  - [x] 7.4 Rewrite the test harness
    - Rewrite `test/chapterRuns.ts` (action generators for 16 kinds, malformed values, `assertInvariants` with the new invariants of Property 4, guided policies `reachEndingA`, `reachEndingB`, `reachEndingC` with and without the secret variant, `reachEndingD`, a careful policy and a harmful-option policy) and `test/callStates.ts` for the new graphs. Keep the seeded LCG API unchanged.
    - _Requirements: 23.1, 23.5_
  - [x] 7.5 Content tests for the five acts and the paths
    - Add `chapter1/content.test.ts`, `chapter1/acts.test.ts`, `chapter1/playthroughs.test.ts`, `chapter1/evidenceCoverage.test.ts`, `chapter1/contentSafety.property.test.ts` covering: each act (enter, exit, objectives); accept and decline of the first call; hang-up; voicemail and call summary carry the case ID; E01 to E06 discoverable, at least four by interaction, two paths; foreshadowing clue exists for the notification and the third call; reject Alex then follow trap 2; reject both; trust both; independent verification; the five reactive third-call starts; all four endings, the secret variant, and early exits; a data lint over every text field (no "safe", reserved domains only, `+000` numbers only, no `scam` or `fake` word in the notification text before the debrief).
    - _Requirements: 5.1, 5.4, 5.5, 5.7, 6.4, 6.5, 6.8, 7.4, 7.5, 9.2, 9.7, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 12.4, 19.1, 19.2, 23.1_
  - [x] 7.6 Write property test for reducer purity and event log shape
    - **Property 1: Reducer purity and event log shape**
    - File `game/narrative/properties/reducer.property.test.ts` (adapt `dispatch`, `determinism`, `store` tests).
    - **Validates: Requirements 3.4, 3.5, 10.11**
  - [x] 7.7 Write property test for state invariants
    - **Property 4: State invariants hold in every reachable state**
    - File `game/narrative/properties/invariants.property.test.ts`.
    - **Validates: Requirements 4.1, 4.4, 4.5, 7.6, 8.3, 8.8, 6.1**
  - [x] 7.8 Write property test for harm causality and the careful policy
    - **Property 5: Harm requires an explicit player choice**
    - File `game/narrative/properties/harmCausality.property.test.ts`.
    - **Validates: Requirements 4.2, 5.8, 9.6, 12.2**
  - [x] 7.9 Write property test for combination validity
    - **Property 6: Combination validity**
    - File `game/narrative/properties/combine.property.test.ts`.
    - **Validates: Requirements 8.2, 8.4, 8.5**
  - [x] 7.10 Write property test for combination idempotence and order independence
    - **Property 7: Combination idempotence and order independence**
    - File `game/narrative/properties/combineOrder.property.test.ts`.
    - **Validates: Requirements 8.6, 8.7**
  - [x] 7.11 Write property test for deduction provenance
    - **Property 8: Deductions are grounded in provenance**
    - Extend `game/narrative/properties/scenarioValidation.property.test.ts` with fault injection (mutate a source identifier, add a discovery that requires the deduction).
    - **Validates: Requirements 8.9, 7.2**
  - [x] 7.12 Write property test for deductions changing gameplay
    - **Property 9: Deductions change later gameplay**
    - File `game/narrative/properties/deductionEffects.property.test.ts`.
    - **Validates: Requirements 8.10, 9.2, 10.3**
  - [x] 7.13 Write property test for third call gating and reactive start
    - **Property 10: Third call gating and reactive start**
    - File `game/narrative/properties/reactiveCall.property.test.ts`.
    - **Validates: Requirements 9.1, 9.2, 9.9, 12.6**
  - [x] 7.14 Write property test for always-available exits
    - **Property 11: Exits are always available**
    - File `game/narrative/properties/exits.property.test.ts`.
    - **Validates: Requirements 10.1, 10.2, 11.3, 12.1**
  - [x] 7.15 Write property test for ending selection
    - **Property 12: Ending selection is a deterministic total function**
    - Adapt `outcome.property.test.ts` and `terminal.property.test.ts`; remove `outcome.investigator.property.test.ts` content that targets the old chapter.
    - **Validates: Requirements 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 4.5**
  - [x] 7.16 Write property test for no soft lock
    - **Property 13: No soft lock**
    - Adapt `noSoftLock.property.test.ts` and `reachability.test.ts`.
    - **Validates: Requirements 3.7, 5.7, 9.8, 11.3, 12.2**
  - [x] 7.17 Write property test for the debrief
    - **Property 14: Debrief is derived and honest**
    - Adapt `debrief.property.test.ts`.
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4**
  - [x] 7.18 Commit the scenario and its tests
    - Run `pnpm typecheck`, then `pnpm --filter @scammaze/game exec vitest run src/game src/test`, each on its own. Stage the scenario data, harness and test files by name. Commit `feat(chapter1): author the double-deception scenario and its tests`.
    - _Requirements: 3.6, 3.7, 24.3_

- [x] 8. Room v2 integration (TASK 07)
  - [x] 8.1 Add the Story_Port and the engine commands
    - In `features/roomv2/game/outside.ts` add `RoomPropId`, `RoomStoryPort`, `RoomOptions.story`. In `engine.ts` add `story = 'external'`, early return in `updateStory`, port calls in `interact`, `startInspect` (phase `inspect-ready` when the pose is reached), `endInspect` (`canLeaveInspect`), `label`, `inspectLines`, `actionsFor`, `inspectAction`, door lock; add the commands `setPhoneMode`, `ring`, `setLaptopFrame`, `chime`, `setMood`, `closeInspect`. In `screens.ts` add the optional laptop `frame` argument (badge and headline replace the old corner card). Keep every change behind `options.story` so `/roomv2` is unchanged.
    - Run `pnpm typecheck`. No engine tests exist; document that in the task report.
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 6.1, 21.1, 21.2_
  - [x] 8.2 Show the layer from `RoomV2Page`
    - In `RoomV2Page.tsx` add the optional `overlay` prop (rendered inside the root), hide the engine's ending block and the title card when a story port is present, and keep all other behavior.
    - _Requirements: 2.2, 2.5, 21.4_
  - [x] 8.3 Write `room/roomStoryBridge.ts`
    - Pure TypeScript class implementing `RoomStoryPort`: `attach`, `detach`, defaults before attach (`label` null, `canLeaveInspect` true, `onProp` no-op), `commands`, `doorLocked`, `overlayOpen()`. No React, no Three.js.
    - Tests: defaults, attach and detach order, forwarding, door lock, import-boundary check for this file.
    - _Requirements: 2.3, 2.6_
  - [x] 8.4 Write `room/roomPresentation.ts`
    - Pure function from `ChapterState` and scenario to engine commands (ring, phone mode, laptop frame, mood).
    - _Requirements: 2.4, 6.1_
  - [x] 8.5 Write property test for presentation commands
    - **Property 17: Presentation commands depend only on state**
    - File `room/roomPresentation.property.test.ts`.
    - **Validates: Requirements 2.4, 6.1**
  - [x] 8.6 Review the engine changes and fix findings
    - Invoke `world-architect` (read-only) on the diff of 8.1 and 8.2: resource cleanup, no new per-frame allocation, standalone `/roomv2` unchanged, no extra WebGL context. Fix the findings that are in scope; record the rest.
    - _Requirements: 2.5, 21.1_
  - [x] 8.7 Commit the room integration
    - Run `pnpm typecheck`, then the tests of 8.3 to 8.5. Stage the room files by name. Commit `feat(roomv2): add a story port so the chapter core can drive the apartment`.
    - _Requirements: 24.3_

- [x] 9. Laptop, phone records and journal UI (TASK 08)
  - [x] 9.1 English UI dictionaries
    - Add `i18n/locales/en/chapter1/{laptop,room,journalCombine,debriefForensic}.ts` with every key used by the new UI (laptop apps, notification text labels, Review Security page, compare view, phone records, combine controls, hints, forensic debrief headings, ending transition, objective toast text), typed `LocaleShape`, and register them in `chapter1/index.ts`. Add the matching `worlds/roomv2.ts` English labels for the door, phone and laptop prompts.
    - One complete string per sentence; interpolation variables for names and numbers.
    - _Requirements: 18.1, 18.5, 18.6_
  - [x] 9.2 Laptop overlay shell and notification apps
    - Create `room/laptop/laptopView.ts` (view model from `selectLaptopView`), `LaptopOverlay.tsx` (dialog, focus trap, close, tabs), `NotificationApp.tsx` (toast, details, dismiss, history). All text through `chapter1:laptop.*`; addresses and numbers as plain text spans.
    - Tests (Testing Library): opens, shows the notification, details reveal sender, app, origin, case reference and contact; dismiss keeps history; Escape closes; focus returns; no anchor, input or form.
    - _Requirements: 6.2, 6.3, 6.5, 6.7, 22.1_
  - [x] 9.3 Bank app, compare view and Review Security page
    - Create `room/laptop/BankApp.tsx`, `CompareView.tsx`, `ReviewSecurityPage.tsx`. The Review Security page has no input, no link and no navigation; it shows the queued case and the fictional procedure text. The compare view shows the notification and the saved records side by side.
    - Tests: contacts and activity screens dispatch the right device actions, the page has no inputs or anchors, `fetch` is never called.
    - _Requirements: 6.3, 6.6, 6.7, 19.3, 19.4_
  - [x] 9.4 Phone records overlay
    - Adapt `features/chapter1/phone/PhoneOverlay.tsx` and its apps: call history with call details (E01), Alex's record (voicemail text or call summary, E07), recovery call details (E11), "Call saved contact" when an Independent_Channel contact is known. Remove the street bank-app verify button. Update `PhoneOverlay.test.tsx`.
    - _Requirements: 5.5, 13.6_
  - [x] 9.5 Journal combination and hints
    - Extend `features/chapter1/journal/EvidenceJournal.tsx`: list evidence with source, stance and related deductions; a Combine control (select two or three discovered items, submit); neutral messages for rejected combinations; recorded deductions with their statement; optional hint toggle. No free text.
    - Tests: select and submit, rejected message, recorded deduction shown, hint toggle, keyboard operation.
    - _Requirements: 8.11, 15.2, 15.3, 22.1_
  - [x] 9.6 Commit the UI
    - Run `pnpm typecheck`, then the UI tests of 9.2 to 9.5. Stage the files by name. Commit `feat(chapter1): add the laptop overlay, phone records and evidence combination UI`.
    - _Requirements: 24.3_

- [x] 10. Chapter layer, call UI and voice integration (TASK 09)
  - [x] 10.1 Create `room/RoomChapterLayer.tsx` (base)
    - Create the store from `session.restored?.state ?? createInitialState()`; intro overlay and `START_CHAPTER`; the dispatch table of the design; the overlay stack; `engine.setCursorMode` while an overlay is open; Escape in the capture phase; ring dispatch only while free (`selectRingableCall`, no overlay, no inspect); presentation commands from `roomPresentation`; HUD (objective tracker, toast, evidence notice, journal and hint buttons); live-region announcements; checkpoint saves through `useCheckpointSaver` at each act start and after each decision.
    - _Requirements: 1.2, 2.3, 2.4, 12.6, 15.5, 15.6, 17.6, 22.2_
  - [x] 10.2 Call, voice and narration integration
    - Mount the unchanged `CallPresentation` (2D mode, `modelAllowed` from a prop) with `useVoicePlayback`, `useCallAudio`, `useCallDuration`, the Speaker toggle, and a Notes control that opens the journal during a call without ending it (voice pauses while the journal is open). Add `room/useNarrationPlayback.ts` to play `dlg.intro` and `dlg.aftermath` nodes through the voice player with explicit targets and cleanup.
    - _Requirements: 9.4, 9.5, 13.1, 13.2, 13.5, 14.4, 14.5, 14.6_
  - [x] 10.3 Decision, ending and debrief wiring
    - Adapt `decision/DecisionPanel.tsx` for the five decisions and the verify pre-step; wire `ending/EndingTransition.tsx` with the ending aftermath (phone and laptop screens and narration); extend `debrief/DebriefScreen.tsx` with the timeline, the trust analysis, found versus missed clues, the secret case report, and Replay (restart from the chapter start).
    - Update `DecisionPanel.test.tsx` and `DebriefScreen.test.tsx`.
    - _Requirements: 10.1, 10.10, 16.1, 16.2, 16.3, 16.5_
  - [x] 10.4 Optional 3D phone overlay canvas
    - Create `room/RoomPhoneModelLayer.tsx`: a transparent R3F canvas (`frameloop="demand"`) mounted only while a call is shown, rendering the unchanged `PhoneModel3D` and publishing to the existing `PhoneScreenSink`; `CallPresentation` keeps its 200 ms fallback. Gate it by a prop so it can be switched off. Dispose on unmount. Do not claim a performance result.
    - Tests: mounts only during a call, unmounts after, fallback when the model fails.
    - _Requirements: 13.3, 13.4_
  - [x] 10.5 Integration tests for the three required paths and accessibility
    - Add `room/RoomChapterLayer.paths.test.tsx` with a fake bridge, fake audio port and jsdom: (1) decline Alex, open the Notification, open Review Security, answer the third caller, trust, `follow-recovery` gives `false-victory`; (2) decline Alex, inspect the origin, open receipts, call the saved contact, finish the third call, `verify-independently` gives `break-the-chain`; (3) dismiss the Notification, hang up the third call, `refuse-and-stop` gives `unfinished-case`. Add `room/RoomChapterLayer.a11y.test.tsx` (dialog names, focus trap, live region announcements, reduced motion).
    - _Requirements: 22.1, 22.2, 22.3, 23.2, 23.3, 23.4_
  - [x] 10.6 Commit the layer
    - Run `pnpm typecheck`, then the tests of 10.1 to 10.5. Stage by name. Commit `feat(chapter1): add the room chapter layer with call, voice and decision wiring`.
    - _Requirements: 24.3_

- [x] 11. Localization and voice clips (TASK 10)
  - [x] 11.1 Vietnamese UI dictionaries
    - Add `i18n/locales/vi/chapter1/{laptop,room,journalCombine,debriefForensic}.ts` and the `vi` `worlds/roomv2.ts` labels, typed against English. Add `continueReasons.incompatible` to `locales/{en,vi}/menu.ts`.
    - _Requirements: 17.3, 18.1_
  - [x] 11.2 Vietnamese overlay for Alex, the official line, intro and aftermath
    - Add `i18n/narrative/chapter1.vi/{alex,official,intro,aftermath}.ts` with keys `dialogues/<graphId>/lines/<lineId>`. Short sentences, one string per sentence, no concatenation.
    - _Requirements: 18.2, 18.4_
  - [x] 11.3 Vietnamese overlay for the third caller
    - Add `i18n/narrative/chapter1.vi/recovery.ts` with every line and option of `dlg.recovery`.
    - _Requirements: 18.2, 9.9_
  - [x] 11.4 Vietnamese overlay for data text and the index
    - Add `chapter1.vi/{core,evidence,decisions,phone,sources,deductions,deviceActions,endings}.ts`, rebuild `chapter1.vi.ts` to merge all parts, and update `i18n/narrative.ts` to the new prompts and scenario. Remove the old overlay parts that name removed IDs.
    - _Requirements: 18.2, 18.4_
  - [x] 11.5 Locale completeness and independence tests
    - **Property 16: Localization is display-only and content is safe**
    - Update `i18n/content.vi.test.ts`, `narrative.test.ts` and `localeIndependence.property.test.ts`: every English key has a Vietnamese entry, structure equals the canonical scenario, missing entries fall back, the safety lint runs on both locales.
    - **Validates: Requirements 18.2, 18.3, 18.4, 19.1, 19.2, 19.6, 16.6**
  - [x] 11.6 Voice cast, jobs, manifest types and generator
    - Update `game/voice/buildVoiceJobs.ts` (cast: add `spk.recovery`, `spk.narrator`; remove `spk.sam`, `spk.case-officer`), `manifestTypes.ts` (chapter content version field), and `scripts/generate-chapter1-voice.mjs` (iterate the new graphs, `--prune` stale clips with `--dry-run`, report missing voices). Keep the Honesty rule (`present` only when the MP3 exists and passed the checks).
    - Update `buildVoiceJobs.test.ts`.
    - _Requirements: 14.1, 14.2, 14.3_
  - [x] 11.7 Write property test for voice playback cleanup
    - **Property 15: Voice playback never overlaps and always cleans up**
    - Extend `game/voice/VoiceDialoguePlayer.property.test.ts` with node transitions, hang-ups, replays and mute using `test/fakeAudioPort.ts`.
    - **Validates: Requirements 14.5, 14.6, 14.7, 14.8**
  - [x] 11.8 Generate and verify the clips
    - Run `pnpm --filter @scammaze/game voice:chapter1 -- --dry-run`, then the real run (Windows speech voices required; if a voice is missing, report it and keep the clips `missing`). Run `pnpm --filter @scammaze/game voice:report`. Regenerate `game/voice/chapter1.manifest.ts`. List the stale old clips and remove them with `git rm` by name. Report the counts (present, missing) as measured. Do not claim audio quality.
    - _Requirements: 14.1, 14.2, 14.3, 24.5_
  - [x] 11.9 Commit localization and voice
    - Run `pnpm typecheck`, then the locale and voice tests. Stage files by name (clips and manifest included, `.voice-cache` excluded). Commit `feat(i18n): add the Vietnamese overlay and voice clips for the double-deception chapter`.
    - _Requirements: 24.3_

- [x] 12. Saves and flow (TASK 11)
  - [x] 12.1 Save format version 3 and the incompatible reason
    - In `game/saves/saveGame.ts` add `SAVE_STORAGE_KEY_V3`, `SAVE_FORMAT_VERSION_V3`, `parseSaveEnvelopeV3` with `contentVersion`, `code` on invalid results, `read()` order (v3 first; v2 or v1 present gives `incompatible`, no migration, no deletion), `clear()` removing all keys. In `game/saves/chapterProgress.ts` use the v3 types and null pose. In `game/chapters/chapterSession.ts` keep the trimmed flag. In `app/continueAvailability.ts` add `reasonCode: "incompatible"`; update `features/menu/MainMenuOverlay.tsx` only to show the new reason text.
    - Update `saveGame.test.ts`, `chapterProgress.test.ts`, `continueAvailability.test.ts`.
    - _Requirements: 17.1, 17.2, 17.3_
  - [x] 12.2 Write property test for the save round trip and tamper handling
    - **Property 2: Save v3 round trip and tamper handling**
    - Adapt `game/saves/chapterProgress.property.test.ts`, `.lenient.property.test.ts` and `.tamper.property.test.ts`.
    - **Validates: Requirements 17.4, 17.5**
  - [x] 12.3 Write property test for total save parsing
    - **Property 3: Save parsing is total and old versions are incompatible**
    - File `game/saves/saveGame.v3.property.test.ts`.
    - **Validates: Requirements 17.1, 17.2**
  - [x] 12.4 Wire the flow
    - Create `room/RoomChapterPage.tsx` (embedded `RoomV2Page`, no standby, same layer, session restore, trimmed and failure notices). Update `features/prologue/ProloguePage.tsx` (`story` prop, stable bridge ref, mount the layer in the room stage, skip its Escape handling while `bridge.overlayOpen()`, no engine ending overlay). Update `app/App.tsx` to render `RoomChapterPage` for saved games and `skip-prologue`, and `ProloguePage` with the story prop for new games; update `game/chapters/chapterRegistry.ts` only if the scene IDs need it. Keep `/roomv2`, `/khupho` and the other routes unchanged.
    - Update `app/App.chapter.test.tsx`, `features/prologue/prologue.test.ts`; add a test that a new game reaches the layer and that `/roomv2` still renders the standalone page.
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 17.6, 17.7_
  - [x] 12.5 Commit saves and flow
    - Run `pnpm typecheck`, then the tests of 12.1 to 12.4. Stage by name. Commit `feat(game): save format v3 and the room chapter flow`.
    - _Requirements: 24.3_

- [x] 13. Remaining tests and independent review (TASK 12, part 1)
  - [x] 13.1 Cross-cutting tests
    - Add `room/RoomChapterLayer.exits.test.tsx` and `game/narrative/chapter1/aiOff.test.ts`: early exits (hang up during each call, close overlays, quit and continue), audio cleanup on hang-up and unmount, replay and mute, save and restart (v3 round trip through the layer, incompatible v2 save message in EN and VI, Replay from the start), completion of every ending with the AI setting off and `fetch` stubbed to throw, EN and VI text of the laptop overlay, no network import in the core.
    - _Requirements: 14.5, 14.6, 14.7, 14.8, 16.5, 17.2, 17.3, 20.1, 20.2, 20.3, 23.1_
  - [x] 13.2 Independent review and fixes
    - Invoke `qa-security-reviewer` (read-only) on the full diff against `main`: scenario graph integrity, safety wording, URL handling, save handling, regressions. Invoke `world-architect` once more if the engine changed after 8.6. Fix the findings in scope with small commits (stage by name) and record the rest as known limitations.
    - _Requirements: 19.1, 19.3, 19.4, 24.5_

- [x] 14. Checkpoint - full verification
  - Run each command on its own, in this order, and record the real output: `pnpm test` (timeout 900000), then `pnpm typecheck`, then `pnpm build`. Never run them in parallel.
  - Run `pnpm --filter @scammaze/game voice:report` and record the clip counts.
  - Fix failures at the cause. Ensure all tests pass, ask the user if questions arise.

- [x] 15. Documentation and delivery (TASK 12, part 2)
  - [x] 15.1 Update the documentation
    - Add the `docs/PROJECT_PROGRESS.md` entry (newest first) with the nine items of AGENTS.md section 6: date and title, objective, completed work, files created, modified, moved or deleted, validation commands executed, exact build and test results from task 14, unresolved issues and limitations (human playtest, pacing and the 18 to 22 minute duration, real GPU, real speakers, real devices, 3D phone overlay on a real GPU, clip quality: not executed), deviations (parked street chapter, save v3, Act II title), and follow-ups. Update "Project status", "In progress" and "Completed" only for what was verified.
    - Update `docs/architecture/OVERVIEW.md` (flow, Room v2 as chapter host, Story_Port), `.kiro/steering/architecture.md` and `.kiro/steering/gameplay-rules.md` (16 actions, data-driven rules, deductions, new invariants, save v3), and `ACCESSIBILITY.md` (laptop and phone overlays, live regions). Do not create a separate audit file: the audit stays in `design.md`.
    - _Requirements: 24.1, 24.2, 24.4, 24.5_
  - [x] 15.2 Commit the documentation and the spec
    - Stage `docs/PROJECT_PROGRESS.md`, `docs/architecture/OVERVIEW.md`, `ACCESSIBILITY.md`, `.kiro/steering/architecture.md`, `.kiro/steering/gameplay-rules.md` and `.kiro/specs/chapter-01-double-deception/*` by name. Commit `docs(game): record the double-deception chapter rebuild` with the trailer.
    - _Requirements: 24.1, 24.3_
  - [x] 15.3 Push without force
    - Run `git push -u origin feat/chapter-01-double-deception` with no force option. Do not merge and do not open a merge action. Report the commit hashes and the real results of task 14.
    - _Requirements: 24.3, 24.6_

## Notes

- All test sub-tasks are required; none is marked optional.
- Property sub-tasks 7.6 to 7.17, 8.5, 11.5, 11.7, 12.2 and 12.3 cover Properties 1 to 17 (Property 16 in 11.5 and the data lint in 7.5, Property 15 in 11.7, Property 17 in 8.5).
- Task 14 runs between waves 26 and 27 of the dependency graph (it is a checkpoint and is not part of the graph).
- Manual checks (human playtest of pacing and soft locks, the 18 to 22 minute duration, real GPU rendering of Room v2 and the phone overlay, real speaker audio, real devices) are not coding tasks. Task 15.1 records them as not executed unless the owner performs them.
- The roadmap labels TASK 00 to 12 are a mapping by theme; see open question Q5 in `design.md`.
- Each task references requirements for traceability; property sub-tasks reference their design property number.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3", "8.1"] },
    { "id": 6, "tasks": ["3.1", "3.8", "8.2"] },
    { "id": 7, "tasks": ["3.2", "3.4", "8.3"] },
    { "id": 8, "tasks": ["3.3"] },
    { "id": 9, "tasks": ["3.5", "3.6"] },
    { "id": 10, "tasks": ["3.7", "8.4"] },
    { "id": 11, "tasks": ["3.9", "8.5", "8.6"] },
    { "id": 12, "tasks": ["4.1", "4.2", "4.3", "4.4", "8.7"] },
    { "id": 13, "tasks": ["5.1", "5.2", "5.3", "6.1", "9.1"] },
    { "id": 14, "tasks": ["7.1", "7.2", "9.2", "9.4"] },
    { "id": 15, "tasks": ["7.3", "9.3", "9.5"] },
    { "id": 16, "tasks": ["7.4", "9.6"] },
    { "id": 17, "tasks": ["7.5", "7.6", "7.7", "7.8", "7.9", "7.10"] },
    { "id": 18, "tasks": ["7.11", "7.12", "7.13", "7.14", "7.15", "7.16", "7.17"] },
    { "id": 19, "tasks": ["7.18", "10.1"] },
    { "id": 20, "tasks": ["10.2", "12.1", "11.1", "11.6"] },
    { "id": 21, "tasks": ["10.3", "12.2", "12.3", "11.2", "11.3", "11.4", "11.7"] },
    { "id": 22, "tasks": ["10.4", "12.4", "11.5", "11.8"] },
    { "id": 23, "tasks": ["10.5", "12.5"] },
    { "id": 24, "tasks": ["10.6", "13.1"] },
    { "id": 25, "tasks": ["11.9"] },
    { "id": 26, "tasks": ["13.2"] },
    { "id": 27, "tasks": ["15.1"] },
    { "id": 28, "tasks": ["15.2"] },
    { "id": 29, "tasks": ["15.3"] }
  ]
}
```
