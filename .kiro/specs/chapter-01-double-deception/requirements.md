# Requirements Document

## Introduction

This spec rebuilds the gameplay and narrative of Chapter 1, "The Urgent Call" (narrative subtitle "The False Victory"), as a psychological mystery of about 18 to 22 minutes. The player recognizes a first scam (a fake bank-security call), feels confident, and then becomes vulnerable to a second, more convincing scam that is disguised as the solution to the first. The intended emotional arc is: "I knew that was a scam", then "I made the right choice", then "Wait, who told me that choice was right?", then "I trusted the wrong source."

The chapter replaces the current street-and-Sam Chapter 1 scenario. It runs entirely inside the existing Room v2 apartment at 22:47 on a rainy night, after the existing neighborhood prologue. The flow becomes: main menu, loading, neighborhood prologue, Room v2 chapter, debrief. The deterministic narrative core (`apps/game/src/game/narrative/**`) keeps ownership of all state, rules, evidence, decisions, consequences and progression. The chapter reuses the Room v2 engine, the Chapter 1 call UI (`PhoneCallScreen`, `CallSubtitleOverlay`, `PlayerChoiceOverlay`), the voice system, subtitles, settings, the evidence journal and the saves system.

The story has five acts: I "The Obvious Trap", II "The Reassuring Choice" (working title "The Safe Choice"), III "The Contradiction", IV "The Third Voice" and V "The False Victory". The chapter has four endings and one secret variant. All people, organizations, domains and numbers are fictional.

This spec produces documents only. Implementation happens through `tasks.md`. Human playtesting (pacing, soft locks, 18 to 22 minute duration) is a manual step and is recorded as not executed unless the owner performs it.

## Glossary

- **Game_App**: The browser game in `apps/game`.
- **Chapter_Core**: The pure deterministic narrative core in `apps/game/src/game/narrative/**` (reducer, conditions, effects, evidence, selectors, outcome, debrief, validator, reachability analyzer). It imports only `@scammaze/shared-types`.
- **Scenario_Data**: The plain-data `ScenarioDefinition` of Chapter 1 that the Chapter_Core reads.
- **Chapter_State**: The single `ChapterState` object that only the Chapter_Core reducer changes.
- **Room_Engine**: The plain Three.js `Engine` class in `apps/game/src/features/roomv2/game/engine.ts`.
- **Story_Port**: The interface through which the Room_Engine reports player interactions to the Room_Host and receives presentation commands (phone mode, ringing, laptop screen state, captions). It holds no story state.
- **Room_Host**: The React layer that mounts the Room_Engine, owns the Chapter store, and renders all chapter overlays and HUD.
- **Prologue_Flow**: The neighborhood prologue (`ProloguePage`, `KhuphoStoryWorld`, `HomeCallOverlay`) that leads to house no. 59 and the Room v2 apartment.
- **Laptop_Overlay**: The accessible, localized HTML interface of the in-room laptop (notification center, saved bank app, comparison view, Review Security page).
- **Phone_Records_Overlay**: The HTML interface of the in-room phone while no call is active (call records, messages).
- **Call_Presentation**: The existing call UI made of `PhoneCallScreen`, `CallSubtitleOverlay` and `PlayerChoiceOverlay`, with the optional 3D phone model.
- **Voice_System**: The voice manifest, clip selection, `VoiceDialoguePlayer`, Web Audio engine and the generation script.
- **Save_System**: The saves modules in `apps/game/src/game/saves/**` and the Continue availability check.
- **Debrief_Builder**: The pure function that builds the forensic debrief from Scenario_Data and the event log.
- **Scenario_Validator**: `validateScenarioIssues` and `validateChapterContent`.
- **Reachability_Analyzer**: `analyzeReachability`, which explores the action graph for unreachable content, soft locks and unreachable outcomes.
- **Localization_Layer**: The i18next dictionaries under `apps/game/src/i18n/locales/{en,vi}` and the Vietnamese narrative overlay `apps/game/src/i18n/narrative/chapter1.vi*`.
- **Alex**: The fictional caller who impersonates Northgate Bank security in Act I.
- **Recovery_Caller**: The fictional "Northgate Incident Response" caller of Act IV (also called the third voice).
- **Notification**: The fictional security notification that appears on the laptop in Act II.
- **Provenance_Source**: A stable-ID record in Scenario_Data that describes where a statement or item came from (call, notification, document, saved app, official channel) and which identifiers it carries.
- **Evidence_Item**: An item in Scenario_Data that the player can discover through real interaction.
- **Deduction**: An authored conclusion that the player unlocks by combining Evidence_Items.
- **Combination**: One player attempt to combine two or more discovered Evidence_Items.
- **Deception_State**: The explicit set of story facts recorded as Chapter_State flags, evidence, deductions and the decision (first call rejected, notification opened, origin inspected, official channel verified, second caller trusted, evidence discovered, deductions unlocked, final decision).
- **Independent_Channel**: A contact route that existed before the chapter began (the number on the saved bank statement or in the saved bank app) and that no caller or notification supplied.
- **Ending**: One of A "The False Victory", B "The Perfect Chain", C "Break the Chain" or D "The Unfinished Case".
- **Reserved_Domain**: A domain ending in `.test`, `.example` or `.invalid`, or `example.com`.
- **Fictional_Number**: A phone number that starts with `+000` and is rendered as plain text.

## Requirements

### Requirement 1: Game flow and host

**User Story:** As a player, I want a new game to lead from the neighborhood into the apartment chapter, so that the whole story happens in one connected place.

#### Acceptance Criteria

1. WHEN the player starts a new game from the main menu, THE Game_App SHALL run the sequence menu, chapter loading, Prologue_Flow, Room v2 chapter, debrief.
2. WHEN the player enters house no. 59 in the Prologue_Flow, THE Room_Host SHALL start the Chapter_Core with `START_CHAPTER` and show the Room v2 apartment at 22:47.
3. WHEN the player continues a saved game or opens the game with the `skip-prologue` query parameter, THE Game_App SHALL mount the Room v2 chapter directly without the street.
4. THE Game_App SHALL remove the old street scene with Sam from the play flow and SHALL keep its source files in the repository.
5. THE Game_App SHALL keep the routes `/roomv2`, `/khupho`, `/testmove`, `/ueh`, `/hue` and `/mientay` working with their current behavior.
6. THE Game_App SHALL keep the main menu and the chapter loading screen unchanged except for chapter text keys.

### Requirement 2: One source of truth for story state

**User Story:** As a maintainer, I want the Room v2 engine driven by the narrative core, so that story state is never duplicated.

#### Acceptance Criteria

1. WHILE the Room_Engine runs with a Story_Port, THE Room_Engine SHALL hold no story state other than presentation values (phone screen mode, ringing sound, laptop screen frame, camera pose).
2. WHILE the Room_Engine runs with a Story_Port, THE Room_Engine SHALL suppress its own call timeline (`calm`, `presilence`, `ringing`, `call`, `declined`, `missed`, `done`) and its own ending overlay.
3. WHEN the player interacts with a story prop, THE Room_Engine SHALL report the prop ID to the Room_Host through the Story_Port and THE Room_Host SHALL dispatch the matching Core_Action to the Chapter_Core.
4. WHEN the Chapter_State changes, THE Room_Host SHALL send presentation commands to the Room_Engine derived only from Chapter_State selectors.
5. WHEN the Room_Engine runs without a Story_Port, THE Room_Engine SHALL behave as it does today on the `/roomv2` route.
6. THE Chapter_Core SHALL stay free of imports of React, Three.js, R3F, Drei, Rapier, Zustand, Dexie and i18n.

### Requirement 3: Scenario replacement and core extension

**User Story:** As a designer, I want a single Chapter 1 scenario with the double-deception story, so that the game has one authoritative script.

#### Acceptance Criteria

1. THE Scenario_Data SHALL define one Chapter 1 scenario with the title "The Urgent Call" and the subtitle "The False Victory".
2. THE Chapter_Core SHALL accept the existing Core_Action kinds plus `DEVICE_ACTION` and `COMBINE_EVIDENCE`.
3. THE Chapter_Core SHALL read call ringing rules, objective rules, decision effects and ending selection rules from Scenario_Data instead of from chapter-specific code branches.
4. WHEN the Chapter_Core receives an unknown or malformed action, THE Chapter_Core SHALL return the same state object with a non-empty rejection reason.
5. WHEN the Chapter_Core accepts an action, THE Chapter_Core SHALL append exactly one event log entry whose `seq` equals the previous event count.
6. THE Scenario_Validator SHALL report an empty issue list for the shipped Scenario_Data.
7. THE Reachability_Analyzer SHALL report all four Endings reachable, no unreachable node or option, and no soft lock for the shipped Scenario_Data.

### Requirement 4: Explicit deception state

**User Story:** As a designer, I want every story-relevant player action recorded explicitly, so that later scenes react to what the player actually did.

#### Acceptance Criteria

1. THE Chapter_Core SHALL record each Deception_State fact (first call rejected, notification delivered, notification opened, notification origin inspected, saved bank app opened, official channel verified, second caller trusted, recovery followed, code shared, evidence discovered, deductions unlocked, final decision) as a flag, a discovered Evidence_Item, a recorded Deduction or the decision in Chapter_State.
2. THE Chapter_Core SHALL change a Deception_State fact only as the effect of an accepted Core_Action that the player caused.
3. THE Chapter_Core SHALL NOT keep a hidden trust score that overrides an explicit player action.
4. WHEN a selector reads the Deception_State, THE Chapter_Core SHALL return a typed summary derived only from Chapter_State.
5. THE Chapter_Core SHALL keep `pressure` within 0 to 3 and SHALL NOT use `pressure` to choose an Ending.

### Requirement 5: Act I, The Obvious Trap

**User Story:** As a player, I want the first call to be an obvious but pressuring scam, so that I can confidently reject it.

#### Acceptance Criteria

1. WHEN the introduction ends, THE Chapter_Core SHALL ring the first call from Alex with a caller ID that shows the player's own Fictional_Number.
2. WHEN the first call rings, THE Call_Presentation SHALL offer Answer and Decline.
3. WHILE the first call is active, THE Call_Presentation SHALL offer choices to ask questions, challenge the caller's identity, refuse a request, hang up, and (as a risky option) comply with a request.
4. WHEN the player declines the first call or hangs up, THE Chapter_Core SHALL record `first_call_rejected` and SHALL deliver a voicemail record that carries the same case identifier Alex uses in the call.
5. WHEN the player opens the call details of the first call in the Phone_Records_Overlay, THE Chapter_Core SHALL discover the caller ID anomaly Evidence_Item.
6. WHEN the first call has ended or been declined, THE Chapter_Core SHALL end Act I.
7. IF the player declines the first call, THEN THE Chapter_Core SHALL continue to Act II without a failure state and without a soft lock.
8. WHEN the player complies with a harmful request from Alex, THE Chapter_Core SHALL record `code_shared` as the result of that explicit choice.

### Requirement 6: Act II, the laptop notification

**User Story:** As a player, I want a security notification on my laptop that seems to confirm my instinct, so that I am tempted to trust it.

#### Acceptance Criteria

1. WHEN Act I has ended, THE Chapter_Core SHALL deliver the Notification to the laptop and THE Room_Engine SHALL wake the laptop screen with a visible notification badge and a notification sound.
2. WHEN the player uses the laptop, THE Room_Host SHALL open the Laptop_Overlay.
3. THE Laptop_Overlay SHALL let the player open the Notification, inspect its sender, its origin, its app and its case identifier, dismiss it, open a saved bank app, and compare the Notification with the saved bank records.
4. THE Notification SHALL state that a call impersonating Northgate Bank was detected, SHALL quote the case identifier that Alex used, SHALL offer "Review Security", and SHALL supply its own contact number.
5. THE Notification SHALL show these inconsistencies when inspected: an unverified sender domain, an unfamiliar app origin, a case identifier that matches Alex's unverified claim, a mismatch with the saved bank records, and a contact number supplied by the Notification itself.
6. WHEN the player chooses "Review Security", THE Laptop_Overlay SHALL show a page that asks for no password, no code and no personal data, and THE Chapter_Core SHALL record `review_security_opened`.
7. THE Laptop_Overlay SHALL show no real phishing page, SHALL make no network request, and SHALL render every address as plain text.
8. WHEN the player opens the Notification, THE Chapter_Core SHALL NOT reveal that it is part of the scam.

### Requirement 7: Act III, evidence and provenance

**User Story:** As a player, I want to find clues by real interaction and judge where each claim came from, so that I can reason instead of guess.

#### Acceptance Criteria

1. THE Scenario_Data SHALL define Evidence_Items E01 caller ID anomaly, E02 notification metadata, E03 saved official bank contact, E04 transaction history and account notice, E05 shared case identifier, and E06 physical note, and SHALL define at least one more item that is an optional clue.
2. THE Scenario_Data SHALL assign each Evidence_Item a stable ID, a Provenance_Source ID, a location (room prop or device screen) and a discovery rule.
3. WHEN the player inspects an object or device screen that reveals an Evidence_Item, THE Chapter_Core SHALL discover the Evidence_Item once and SHALL record the discovery in the event log.
4. THE Scenario_Data SHALL make at least four Evidence_Items discoverable by interaction with a room prop or a laptop or phone screen.
5. THE Scenario_Data SHALL define at least two independent investigation paths to the same conclusion: a physical path (statement, note) and a digital path (saved bank app, notification metadata).
6. THE Scenario_Data SHALL describe a single suspicious detail as an Evidence_Item that needs interpretation and SHALL NOT mark a claim as false because of one detail.
7. WHEN the player places the room's calendar or another optional prop in view, THE Room_Engine SHALL report the interaction so that the Chapter_Core can discover an optional clue.
8. THE Scenario_Data SHALL need no pixel hunting: each interactable prop SHALL be reachable by the existing crosshair and prompt.

### Requirement 8: Deductions and combinations

**User Story:** As a player, I want to combine clues into conclusions, so that I understand why a source cannot be trusted.

#### Acceptance Criteria

1. THE Scenario_Data SHALL define at least three authored Deductions, including "Two Statements, One Source", each with its input Evidence_Items, its required conditions and its effects.
2. WHEN the player submits a Combination whose inputs match an authored Deduction, whose inputs are all discovered and whose required conditions hold, THE Chapter_Core SHALL record the Deduction and apply its effects.
3. WHEN the Deduction "Two Statements, One Source" is recorded, THE Chapter_Core SHALL set the claim "the two messages are independently verified" to `inconclusive` and SHALL show the statement "These claims are not independently verified."
4. IF a Combination matches no authored Deduction, THEN THE Chapter_Core SHALL reject the action with a reason code and SHALL leave Chapter_State unchanged.
5. IF a Combination contains an Evidence_Item that is not discovered, THEN THE Chapter_Core SHALL reject the action and SHALL leave Chapter_State unchanged.
6. WHEN the same Combination is submitted again, THE Chapter_Core SHALL reject it as already recorded and SHALL leave Chapter_State unchanged.
7. WHEN the player submits the same set of Evidence_Items in a different order, THE Chapter_Core SHALL produce the same result.
8. THE Chapter_Core SHALL set a claim to `contradicted` only after an Independent_Channel confirmation is discovered, and SHALL set a claim to `inconclusive` for any result that comes from deduction alone.
9. THE Scenario_Validator SHALL reject a Deduction whose input Evidence_Items share no identifier or provenance link, and SHALL reject a Deduction that needs an input Evidence_Item that can only be discovered after the Deduction.
10. THE Scenario_Data SHALL make at least two Deductions change later gameplay: one SHALL add or unlock dialogue options with the Recovery_Caller, and one SHALL enable a final decision.
11. THE Laptop_Overlay or journal SHALL let the player select Evidence_Items to combine without typing free text.

### Requirement 9: Act IV, the third voice

**User Story:** As a player, I want the next caller to react to what I actually did, so that my earlier choices matter.

#### Acceptance Criteria

1. WHEN Act III has ended according to its authored exit conditions, THE Chapter_Core SHALL ring the Recovery_Caller.
2. WHEN the Recovery_Caller call starts, THE Chapter_Core SHALL select the first dialogue node whose authored conditions hold, for these five situations: the player followed the Notification, the player investigated the Notification origin, the player verified through the Independent_Channel, the player identified the shared case identifier, and the player inspected nothing.
3. THE Recovery_Caller SHALL confirm that Alex was suspicious, SHALL recommend a "security recovery procedure", and SHALL cite the same case identifier.
4. THE Call_Presentation SHALL show the player's choices in the external overlay, and the phone screen SHALL show only caller information and call controls.
5. WHILE the Recovery_Caller call is active, THE Call_Presentation SHALL let the player inspect prior evidence, interrupt, refuse, ask to verify independently, and hang up.
6. WHEN the player trusts the Recovery_Caller through an explicit option, THE Chapter_Core SHALL record `second_caller_trusted`.
7. THE Scenario_Data SHALL place at least one discoverable clue in Acts I to III that foreshadows the third caller.
8. WHEN the player hangs up the Recovery_Caller call, THE Chapter_Core SHALL end the call and SHALL continue to Act V without a failure state.

### Requirement 10: Act V, decisions and Endings

**User Story:** As a player, I want a final decision whose consequence follows from what I did and learned, so that the ending feels earned.

#### Acceptance Criteria

1. WHEN Act V starts, THE Chapter_Core SHALL offer these final decisions when their conditions hold: follow the recovery instruction, follow both callers, refuse and stop, verify independently through the Independent_Channel, and report the connected deception.
2. THE Chapter_Core SHALL make "refuse and stop" and "verify independently" available to the player in every state of Act V, where "verify independently" needs only a discovered Independent_Channel contact (Evidence_Item E03 or its saved-app twin).
3. THE Chapter_Core SHALL make "report the connected deception" available only after the Deduction "Two Statements, One Source" is recorded.
4. WHEN a decision is made, THE Chapter_Core SHALL select exactly one Ending with the authored ordered rules and SHALL set the outcome only as a pure function of the decision, flags, deductions and claim statuses.
5. THE Chapter_Core SHALL produce Ending A "The False Victory" WHEN the player followed the recovery instruction after rejecting Alex and without `code_shared`.
6. THE Chapter_Core SHALL produce Ending B "The Perfect Chain" WHEN the player trusted both layers (`code_shared` and a recovery decision, or the decision "follow both callers").
7. THE Chapter_Core SHALL produce Ending C "Break the Chain" WHEN the player verified through the Independent_Channel and no money moved, without requiring all optional evidence.
8. THE Chapter_Core SHALL produce Ending D "The Unfinished Case" WHEN the player refused contact and did not verify, including the case where the player built the evidence chain but did not verify.
9. WHEN Ending C is produced and the Deductions "Two Statements, One Source" and "The Third Caller Is Not Independent" are recorded, THE Chapter_Core SHALL select the secret variant "detailed case report".
10. THE Scenario_Data SHALL give each Ending a different narrative consequence, a different phone and laptop aftermath, an evidence summary, a case report and its own closing dialogue.
11. THE Chapter_Core SHALL NOT use timers, random numbers or forced harmful actions to select an Ending.

### Requirement 11: Layered deception model

**User Story:** As a designer, I want each deception layer defined with triggers, choices, clues, consequences and exits, so that the player can always leave without harm.

#### Acceptance Criteria

1. THE Scenario_Data SHALL define Layer 1 as the impersonation call, Layer 2 as the fake protection and recovery workflow, and Layer 3 as the third caller who reinforces Layer 2.
2. THE Scenario_Data SHALL define for each layer its trigger, its player choices, its discoverable clues, its consequences and at least one exit that keeps the player out of harm.
3. THE Chapter_Core SHALL make the hang-up, refuse and verify-independently exits available at every point of each layer.
4. THE Scenario_Data SHALL NOT include a harmful action as the only way to advance a layer.

### Requirement 12: Agency and fairness

**User Story:** As a careful player, I want to avoid harm without being punished, so that the story does not force a twist on me.

#### Acceptance Criteria

1. THE Chapter_Core SHALL accept `END_CALL` whenever a call is ringing or active.
2. WHEN a careful player hangs up, declines, refuses or verifies independently, THE Chapter_Core SHALL continue the chapter without a failure state, a penalty or a forced harmful action.
3. THE Chapter_Core SHALL NOT start a countdown, a fake timer or a time-limited choice.
4. THE Scenario_Data SHALL foreshadow each twist with at least one discoverable clue, SHALL keep each twist consistent with earlier facts, and SHALL explain each twist in the debrief without rewriting earlier events.
5. THE Room_Host SHALL show no jump scare and SHALL apply no hidden random penalty.
6. WHEN a call is triggered by a Chapter_State condition, THE Room_Host SHALL ring the call only while no overlay, call or inspection is open.

### Requirement 13: Call UI reuse

**User Story:** As a player, I want calls to look and work like the rest of the game, so that the phone stays a realistic device.

#### Acceptance Criteria

1. WHILE a call is ringing or active, THE Room_Host SHALL render the existing Call_Presentation over the Room v2 view.
2. THE Call_Presentation SHALL show only caller information and call controls on the phone screen, the caller line in the subtitle overlay, and the player choices in the choice overlay outside the phone.
3. WHERE the 3D phone model can be drawn over the Room v2 view, THE Room_Host SHALL draw it through an overlay canvas that publishes the screen rectangle to the existing `PhoneScreenSink`.
4. IF the 3D phone model cannot be drawn, THEN THE Call_Presentation SHALL use its 2D fallback mode.
5. THE Room_Host SHALL keep the keyboard order, focus handling and dispatch guard of the Call_Presentation unchanged.
6. THE Phone_Records_Overlay SHALL show call records and messages while no call is active, and SHALL open call details that can reveal an Evidence_Item.

### Requirement 14: Voice, subtitles and audio

**User Story:** As a player, I want voiced calls with subtitles and clean audio behavior, so that the story is clear in English and Vietnamese.

#### Acceptance Criteria

1. THE Voice_System SHALL play one pre-generated clip per spoken node for Alex, the Recovery_Caller, the official line agent and the introduction narration, in English and Vietnamese.
2. THE Voice_System SHALL use stable clip IDs that equal the dialogue node IDs and SHALL list every clip in the voice manifest with its status.
3. IF a clip is missing, THEN THE Voice_System SHALL show the subtitle without audio, SHALL report the missing clip in the voice report, and SHALL NOT present English audio as Vietnamese unless the English voice fallback setting is on.
4. THE Call_Presentation SHALL show the subtitle for each spoken line outside the phone, in the selected language.
5. WHEN a node changes, THE Voice_System SHALL stop the previous clip before it starts the next clip, so that two clips never play at once.
6. WHEN the player hangs up, THE Voice_System SHALL stop the playing clip within the same user action.
7. WHEN the player presses Replay, THE Voice_System SHALL replay only the current node.
8. WHEN the player turns Mute on, THE Voice_System SHALL silence the voice and SHALL keep the subtitles.
9. THE Recovery_Caller dialogue SHALL change its spoken lines with the player's earlier choices through the node selected at call start and through conditional options.

### Requirement 15: Investigation UX

**User Story:** As a player, I want investigation that feels natural, so that I stay in the room instead of in a menu.

#### Acceptance Criteria

1. THE Room_Host SHALL show a short prompt for each interactable prop and SHALL show an inspect caption for each inspect pose.
2. THE Evidence_Journal SHALL list discovered Evidence_Items with their source, their stance toward each claim and the related Deductions, and SHALL list the Combination controls.
3. WHERE the player turns hints on, THE Evidence_Journal SHALL show an optional hint for the current objective.
4. THE Room_Host SHALL NOT draw glowing markers on props, SHALL NOT use unskippable exposition, and SHALL NOT show a fake countdown.
5. THE Room_Host SHALL let the player skip or advance every narration and every dialogue line.
6. THE Room_Host SHALL show the current objective in the objective tracker and SHALL update it only from Chapter_State.

### Requirement 16: Forensic debrief

**User Story:** As a learner, I want a debrief based on what I actually did, so that I can learn how to verify similar claims.

#### Acceptance Criteria

1. WHEN the chapter ends, THE Debrief_Builder SHALL build a reconstructed timeline of the player's decisions in event log order.
2. THE Debrief_Builder SHALL explain how Alex built pressure, why the warning looked trustworthy, which clues showed an unverified source, whether the Recovery_Caller gave independent evidence, which action entered or avoided the second trap, and how to verify similar claims.
3. THE Debrief_Builder SHALL list only Evidence_Items the player encountered as found, and SHALL list missed clues in a separate section that is clearly marked as missed.
4. THE Debrief_Builder SHALL derive every statement only from Scenario_Data and the event log.
5. WHEN the player chooses Replay, THE Game_App SHALL restart the chapter from the chapter start, or from a checkpoint when the Save_System can restore it.
6. THE Debrief_Builder SHALL NOT call any number, message, caller, website or notification "safe".

### Requirement 17: Saves, replay and restart

**User Story:** As a player, I want to continue where I stopped, and to be told clearly when an old save cannot be used.

#### Acceptance Criteria

1. THE Save_System SHALL store accepted Core_Actions and a checkpoint ID in a new save format version.
2. WHEN the Save_System reads a save of an older format version, THE Save_System SHALL return an invalid result with an `incompatible` reason code and SHALL NOT throw.
3. WHEN the main menu shows an incompatible save, THE Game_App SHALL tell the player in the selected language that the old save cannot be continued and SHALL let the player start a new game.
4. WHEN the Save_System restores a valid save, THE Chapter_Core SHALL rebuild the same Chapter_State by replaying the saved actions.
5. IF a saved action is rejected during replay, THEN THE Save_System SHALL restore the state before that action and SHALL show the save-trimmed notice.
6. THE Room_Host SHALL write a checkpoint at the start of each act and after each decision.
7. IF storage is unavailable, THEN THE Room_Host SHALL continue the chapter and SHALL show the save-failure notice.

### Requirement 18: Localization

**User Story:** As a Vietnamese or English player, I want all text in my language, so that I understand every clue.

#### Acceptance Criteria

1. THE Localization_Layer SHALL provide every new UI string through i18n keys in both `en` and `vi`.
2. THE Scenario_Data SHALL be authored in English, and THE Localization_Layer SHALL provide the Vietnamese text through the narrative overlay keyed by stable IDs.
3. THE Localization_Layer SHALL NOT change IDs, conditions, effects, evidence, decisions, outcomes or game state.
4. WHEN a Vietnamese overlay entry is missing, THE Localization_Layer SHALL fall back to the English text.
5. THE Room_Host SHALL build user-facing sentences as one complete string per sentence with interpolation variables, without string concatenation.
6. THE Room_Engine SHALL read all new prompts, labels, inspect captions and screen text through the room translator.

### Requirement 19: Safety and content rules

**User Story:** As a maintainer, I want the content to be safe to ship, so that it teaches without harming.

#### Acceptance Criteria

1. THE Scenario_Data and UI text SHALL NOT call any number, message, URL, website, caller or notification "safe", "an toàn" or equivalent.
2. THE Scenario_Data SHALL use fictional organizations, Reserved_Domains and Fictional_Numbers only, and THE Laptop_Overlay and Call_Presentation SHALL render them as plain text without links.
3. THE Game_App SHALL NOT fetch, load, embed or redirect to a URL that appears in Scenario_Data or that the player enters.
4. THE Laptop_Overlay SHALL NOT collect a credential, a code, a payment detail or personal data.
5. THE Scenario_Data SHALL contain no instruction usable for real fraud, and the scammer dialogue SHALL stay fictional and defensive.
6. THE Scenario_Validator SHALL fail the build of the content test when a text field contains the forbidden wording of criterion 1, a non-reserved domain, or a number that does not start with `+000`.

### Requirement 20: Offline and AI-off operation

**User Story:** As a player, I want the chapter to work without AI and without a network, so that it never depends on a service.

#### Acceptance Criteria

1. THE Game_App SHALL complete the chapter with AI disabled and with no backend call.
2. THE Game_App SHALL complete the chapter offline after the chapter assets have loaded.
3. THE Chapter_Core SHALL stay free of live LLM calls, microphone input and network access.

### Requirement 21: Room integration and asset limits

**User Story:** As a maintainer, I want to reuse the existing room, so that the chapter adds no new world to maintain.

#### Acceptance Criteria

1. THE Room_Host SHALL use the existing Room v2 apartment, phone model and props, and SHALL NOT add a room, a map, furniture, a lighting rebuild or a large asset.
2. THE Room_Engine SHALL map the phone to calls and call records, the laptop to the Notification and the bank app simulation, desk documents and receipts to physical evidence, the note and notebook to case notes, and other props to optional clues.
3. IF a prop that an Evidence_Item needs does not exist in the apartment, THEN THE Room_Host SHALL use the smallest safe integration (an existing prop with a new inspect caption) and the design document SHALL list the limitation.
4. THE Room_Host SHALL keep the settings, controls, pause menu and graphics quality choices that the Prologue_Flow already provides.

### Requirement 22: Accessibility

**User Story:** As a player who uses a keyboard or assistive technology, I want every overlay to be operable, so that the chapter is playable for me.

#### Acceptance Criteria

1. THE Laptop_Overlay and Phone_Records_Overlay SHALL be keyboard-operable dialogs with a focus trap, an accessible name and a close control.
2. THE Room_Host SHALL announce a new Notification, a new Evidence_Item, a recorded Deduction and an objective change through a polite live region.
3. THE Room_Host SHALL respect the reduced motion and reduced stress settings for the Notification animation, the fade effects and the tense sound design.
4. THE Room_Host SHALL show status through text as well as color or icon.

### Requirement 23: Tests and validation

**User Story:** As a maintainer, I want automated tests for the chapter logic, so that regressions are caught.

#### Acceptance Criteria

1. THE test suite SHALL cover all five acts, accept and decline of the first call, rejecting Alex then following the fake workflow, rejecting both, trusting both, independent verification, provenance, valid and invalid Deductions, the reactive third caller, all four Endings, early exits, English and Vietnamese text, audio cleanup and replay, save and restart, and completion with AI disabled.
2. THE test suite SHALL include an integration test for the path "reject Alex, open the fake security workflow, trust the third caller" that ends in Ending A.
3. THE test suite SHALL include an integration test for the path "reject Alex, inspect the origin, verify through the Independent_Channel" that ends in Ending C.
4. THE test suite SHALL include an integration test for the path "reject all suspicious instructions" that ends in Ending D.
5. THE property tests SHALL use `apps/game/src/test/seededRandom.ts`, run at least 200 cases by default, and print the seed and case index on failure.
6. WHEN the checkpoint task runs, THE team SHALL run `pnpm test`, then `pnpm typecheck`, then `pnpm build`, one after the other.

### Requirement 24: Documentation, delivery and Definition of Done

**User Story:** As the owner, I want honest records and a reviewable branch, so that I can decide what to merge.

#### Acceptance Criteria

1. THE team SHALL add a "Task history" entry to `docs/PROJECT_PROGRESS.md` with the nine items of AGENTS.md section 6, and SHALL update the architecture documents that the work makes inaccurate.
2. THE team SHALL put the Phase 0 audit in `design.md` and SHALL NOT create a redundant Markdown audit file.
3. THE team SHALL commit in small coherent commits with Conventional Commit messages and the trailer `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`, stage files by name, push without force, and not merge.
4. THE team SHALL record the human playtest (pacing, soft locks, duration of 18 to 22 minutes), real GPU rendering, real speaker audio and real devices as not executed unless the owner performs them.
5. THE team SHALL NOT state that a feature is implemented, measured or verified unless the team verified it in the same task.
6. THE chapter SHALL be complete only when all five acts are playable, all four Endings and the secret variant are reachable, the validators are clean, and `pnpm test`, `pnpm typecheck` and `pnpm build` pass.
