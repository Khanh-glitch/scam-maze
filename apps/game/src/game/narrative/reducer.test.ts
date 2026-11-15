// Unit tests for the chapter reducer, run against the fixture scenario (spec
// chapter-01-double-deception, task 3.3). One transition test per Core_Action kind and the
// rejection reasons of the guard table.

import { describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO, fixtureState, withEvidence, withFlags } from "../../test/fixtureScenario";
import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { beatTag } from "./beats";
import { OBJECTIVE_CONDITION_NOT_MET } from "./objectives";
import { chapterReducer, createInitialState, isCoreAction, REASONS } from "./reducer";
import type { ChapterState, CoreAction, ScenarioDefinition } from "./types";

/** Applies the actions in order and fails the test on the first rejection. */
function play(
  state: ChapterState,
  actions: readonly CoreAction[],
  scenario: ScenarioDefinition = FIXTURE_SCENARIO,
): ChapterState {
  let current = state;
  for (const action of actions) {
    const result = chapterReducer(current, action, scenario);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    current = result.state;
  }
  return current;
}

/** Dispatches one action and expects a rejection with `reason` that leaves the state unchanged. */
function expectRejected(state: ChapterState, action: unknown, reason: string): void {
  const snapshot = JSON.stringify(state);
  const result = chapterReducer(state, action, FIXTURE_SCENARIO);
  expect(result.accepted).toBe(false);
  expect(result.reason).toBe(reason);
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(snapshot);
}

const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const RING_RECOVERY: CoreAction = { type: "RING_CALL", callId: "call.recovery", reason: "callback" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const RECEIPTS: CoreAction = { type: "INTERACT_OBJECT", objectId: "obj.receipts" };
const INSPECT_ORIGIN: CoreAction = { type: "DEVICE_ACTION", deviceActionId: "dev.inspect-notification-origin" };
const INSPECT_SHARED: CoreAction = { type: "INSPECT_EVIDENCE", evidenceId: "ev.shared-case-id" };
const OFFICIAL: CoreAction = {
  type: "VERIFY_CLAIM",
  claimId: "claim.recovery-needed",
  method: "saved-official-contact",
};
const BANK_APP: CoreAction = { type: "VERIFY_CLAIM", claimId: "claim.recovery-needed", method: "bank-app" };
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
const decide = (decision: "follow-recovery" | "refuse-and-stop" | "verify-independently"): CoreAction => ({
  type: "MAKE_DECISION",
  decision,
});

const started = (): ChapterState => play(createInitialState(FIXTURE_SCENARIO), [START]);
/** First call answered and refused: it ended, so the notification beat fired. */
const afterAlex = (): ChapterState => play(started(), [RING_ALEX, ANSWER, option("alex.refuse")]);
/** Notification origin inspected: the notification is handled and the second call may ring. */
const afterOrigin = (): ChapterState => play(afterAlex(), [INSPECT_ORIGIN]);
/** Second call answered and trusted: it ended. */
const afterRecovery = (): ChapterState => play(afterOrigin(), [RING_RECOVERY, ANSWER, option("rec.trust")]);

describe("isCoreAction", () => {
  it("accepts a well-formed action of each of the 16 kinds", () => {
    const actions: unknown[] = [
      START,
      RECEIPTS,
      INSPECT_SHARED,
      { type: "OPEN_PHONE" },
      { type: "CLOSE_PHONE" },
      RING_ALEX,
      RING_RECOVERY,
      ANSWER,
      END_CALL,
      { type: "TALK_TO_NPC", npcId: "npc.anyone" },
      option("alex.refuse"),
      OFFICIAL,
      decide("refuse-and-stop"),
      { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.decide" },
      { type: "FINISH_CHAPTER" },
      INSPECT_ORIGIN,
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.shared-case-id"] },
    ];
    const kinds = new Set(actions.map((a) => (a as { type: string }).type));
    expect(kinds.size).toBe(16);
    for (const action of actions) expect(isCoreAction(action)).toBe(true);
  });

  it("rejects unknown shapes and unknown IDs", () => {
    for (const value of [
      null,
      undefined,
      "START_CHAPTER",
      42,
      [],
      {},
      { type: "JUMP" },
      { type: "INTERACT_OBJECT", objectId: "obj.car" },
      { type: "INSPECT_EVIDENCE" },
      { type: "RING_CALL", callId: "call.official", reason: "callback" },
      { type: "RING_CALL", callId: "call.alex", reason: "because" },
      { type: "TALK_TO_NPC" },
      { type: "SELECT_DIALOGUE_OPTION", optionId: "" },
      { type: "VERIFY_CLAIM", claimId: "claim.recovery-needed", method: "guess" },
      { type: "MAKE_DECISION", decision: "panic" },
      { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.nothing" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.nothing" },
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement"] },
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.alex-statement"] },
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.nothing"] },
      { type: "COMBINE_EVIDENCE", evidenceIds: Array(4).fill("ev.alex-statement") },
    ]) {
      expect(isCoreAction(value)).toBe(false);
    }
  });
});

describe("chapterReducer transitions", () => {
  it("creates an initial state from the ID arrays", () => {
    const state = createInitialState(FIXTURE_SCENARIO);
    expect(state.status).toBe("not-started");
    expect(Object.values(state.claims).every((status) => status === "unverified")).toBe(true);
    expect(Object.values(state.flags).every((flag) => flag === false)).toBe(true);
    expect(state.deductions).toEqual([]);
    expect(state.pressure).toBe(0);
    expect(state.events).toEqual([]);
  });

  it("START_CHAPTER starts play, activates objectives and logs one event", () => {
    const state = started();
    expect(state.status).toBe("playing");
    expect(state.objectives.active).toEqual(["obj.answer-or-decline"]);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ seq: 0, action: START });
  });

  it("does not mutate the input state", () => {
    const before = started();
    const snapshot = JSON.stringify(before);
    const result = chapterReducer(before, RECEIPTS, FIXTURE_SCENARIO);
    expect(result.accepted).toBe(true);
    expect(result.state).not.toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("INTERACT_OBJECT records the object and its evidence once", () => {
    const once = play(started(), [RECEIPTS]);
    expect(once.interacted).toEqual(["obj.receipts"]);
    expect(once.discovered).toEqual(["ev.account-activity"]);
    expect(once.events[1].derived.evidence).toEqual(["ev.account-activity"]);
    const twice = play(once, [RECEIPTS]);
    expect(twice.discovered).toEqual(["ev.account-activity"]);
    expect(twice.events).toHaveLength(3);
    expect(twice.events[2].derived.evidence).toEqual([]);
  });

  it("INSPECT_EVIDENCE rejects unavailable and already recorded evidence, and discovers when available", () => {
    expectRejected(started(), INSPECT_SHARED, REASONS.evidenceNotAvailable);
    const state = play(afterAlex(), [INSPECT_ORIGIN, INSPECT_SHARED]);
    expect(state.discovered).toContain("ev.shared-case-id");
    expectRejected(state, INSPECT_SHARED, REASONS.evidenceAlreadyRecorded);
  });

  it("OPEN_PHONE and CLOSE_PHONE toggle the phone", () => {
    const open = play(started(), [{ type: "OPEN_PHONE" }]);
    expect(open.phone.open).toBe(true);
    expectRejected(open, { type: "OPEN_PHONE" }, REASONS.phoneAlreadyOpen);
    const closed = play(open, [{ type: "CLOSE_PHONE" }]);
    expect(closed.phone.open).toBe(false);
    expectRejected(closed, { type: "CLOSE_PHONE" }, REASONS.phoneAlreadyClosed);
  });

  it("RING_CALL rings a call whose ringWhen holds and logs it", () => {
    const state = play(started(), [RING_ALEX]);
    expect(state.call.current).toBe("call.alex");
    expect(state.call.status).toBe("ringing");
    expect(state.call.log).toEqual([
      {
        callId: "call.alex",
        direction: "incoming",
        displayName: "Unknown caller",
        number: "+000 0100 2200",
        status: "ringing",
        ringCount: 1,
      },
    ]);
    expectRejected(state, RING_ALEX, REASONS.callAlreadyRinging);
  });

  it("ANSWER_CALL starts the conversation and discovers dialogue evidence", () => {
    const state = play(started(), [RING_ALEX, ANSWER]);
    expect(state.call.status).toBe("active");
    expect(state.conversation?.nodeId).toBe("alex.open");
    expect(state.discovered).toEqual(["ev.alex-statement"]);
    expectRejected(started(), ANSWER, REASONS.noCallRinging);
  });

  it("END_CALL declines a ringing call and records first_call_rejected", () => {
    const state = play(started(), [RING_ALEX, END_CALL]);
    expect(state.call.current).toBeNull();
    expect(state.call.status).toBe("declined");
    expect(state.call.log[0].status).toBe("declined");
    expect(state.flags.first_call_rejected).toBe(true);
    expectRejected(state, RING_ALEX, REASONS.callAlreadyRang);
  });

  it("END_CALL hangs up an active call, archives the conversation and records hung-up", () => {
    const state = play(started(), [RING_ALEX, ANSWER, END_CALL]);
    expect(state.call.current).toBeNull();
    expect(state.call.status).toBe("ended");
    expect(state.conversation).toBeNull();
    expect(state.conversationHistory).toEqual([{ graphId: "dlg.alex", history: [], endNodeId: null }]);
    expect(state.events.at(-1)?.derived.debriefTags).toContain("hung-up");
    expect(state.flags.first_call_rejected).toBe(true);
    expectRejected(started(), END_CALL, REASONS.noCallToEnd);
  });

  it("TALK_TO_NPC is a valid action that is rejected when no NPC exists", () => {
    const action = { type: "TALK_TO_NPC", npcId: "npc.nobody" };
    expect(isCoreAction(action)).toBe(true);
    expectRejected(started(), action, REASONS.unknownNpc);
  });

  it("SELECT_DIALOGUE_OPTION applies option effects and debrief tags", () => {
    const state = play(started(), [RING_ALEX, ANSWER, option("alex.share-code")]);
    expect(state.flags.code_shared).toBe(true);
    expect(state.events.at(-1)?.derived.debriefTags).toContain("shared-code");
  });

  it("MAKE_DECISION applies the decision effects and selects the ending", () => {
    const state = play(afterRecovery(), [decide("follow-recovery")]);
    expect(state.decision).toBe("follow-recovery");
    expect(state.flags.money_moved).toBe(true);
    expect(state.outcome).toBe("false-victory");
    expect(state.status).toBe("ended");
    expect(state.events.at(-1)?.derived.debriefTags).toContain("followed-recovery");

    const refused = play(afterAlex(), [decide("refuse-and-stop")]);
    expect(refused.flags.money_moved).toBe(false);
    expect(refused.outcome).toBe("break-the-chain");
  });

  it("MAKE_DECISION rejects unavailable decisions, busy states and a second decision", () => {
    expectRejected(started(), decide("follow-recovery"), "The second caller has not called yet.");
    expectRejected(started(), decide("verify-independently"), "Finish the first call first.");
    expectRejected(play(started(), [RING_ALEX, ANSWER]), decide("refuse-and-stop"), REASONS.conversationInProgress);
    expectRejected(play(started(), [RING_ALEX]), decide("refuse-and-stop"), REASONS.callInProgress);
    const decided: ChapterState = { ...afterAlex(), decision: "refuse-and-stop" };
    expectRejected(decided, decide("refuse-and-stop"), REASONS.decisionAlreadyMade);
  });

  it("COMPLETE_OBJECTIVE is rejected unless the objective is active and its condition holds", () => {
    expectRejected(
      started(),
      { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.decide" },
      OBJECTIVE_CONDITION_NOT_MET,
    );
  });

  it("FINISH_CHAPTER needs an outcome and then finishes once", () => {
    expectRejected(started(), { type: "FINISH_CHAPTER" }, REASONS.chapterNotEnded);
    const ended = play(afterAlex(), [decide("refuse-and-stop")]);
    const finished = play(ended, [{ type: "FINISH_CHAPTER" }]);
    expect(finished.status).toBe("finished");
    expectRejected(finished, { type: "FINISH_CHAPTER" }, REASONS.chapterAlreadyFinished);
  });

  it("locks every action but FINISH_CHAPTER once an outcome is set", () => {
    const ended = play(afterAlex(), [decide("refuse-and-stop")]);
    expectRejected(ended, { type: "OPEN_PHONE" }, REASONS.chapterEnded);
    expectRejected(ended, RECEIPTS, REASONS.chapterEnded);
  });

  it("rejects unknown actions and actions before START_CHAPTER", () => {
    expectRejected(started(), { type: "JUMP" }, REASONS.unknownAction);
    expectRejected(createInitialState(FIXTURE_SCENARIO), RECEIPTS, REASONS.notStarted);
    expectRejected(started(), START, REASONS.alreadyStarted);
  });

  it("appends exactly one event per accepted action and none for a rejection", () => {
    const state = afterRecovery();
    expect(state.events.map((e) => e.seq)).toEqual(state.events.map((_, i) => i));
    const rejected = chapterReducer(state, { type: "OPEN_PHONE" }, FIXTURE_SCENARIO);
    expect(rejected.accepted).toBe(true);
    const again = chapterReducer(rejected.state, { type: "OPEN_PHONE" }, FIXTURE_SCENARIO);
    expect(again.accepted).toBe(false);
    expect(again.state.events).toHaveLength(rejected.state.events.length);
  });
});

describe("beats", () => {
  it("fires the notification beat on the action that ends the first call and tags the event", () => {
    const state = afterAlex();
    expect(state.flags.notification_delivered).toBe(true);
    const last = state.events.at(-1);
    expect(last?.derived.debriefTags).toContain(beatTag("beat.notification"));
    expect(last?.derived.flags).toContain("notification_delivered");
  });

  it("fires a beat without its own guard only once", () => {
    const scenario: ScenarioDefinition = {
      ...FIXTURE_SCENARIO,
      beats: [{ id: "beat.always", when: [], effects: [{ kind: "addPressure" }] }],
    };
    const state = play(
      createInitialState(scenario),
      [START, { type: "OPEN_PHONE" }, { type: "CLOSE_PHONE" }, { type: "OPEN_PHONE" }],
      scenario,
    );
    expect(state.pressure).toBe(1);
    const tagged = state.events.filter((e) => e.derived.debriefTags.includes(beatTag("beat.always")));
    expect(tagged).toHaveLength(1);
    expect(tagged[0].seq).toBe(0);
  });
});

describe("DEVICE_ACTION", () => {
  it("is rejected when unknown to the scenario, unavailable, or already done", () => {
    expectRejected(started(), { type: "DEVICE_ACTION", deviceActionId: "dev.open-bank-app" }, REASONS.unknownDeviceAction);
    expectRejected(started(), INSPECT_ORIGIN, REASONS.deviceActionUnavailable);
    expectRejected(afterOrigin(), INSPECT_ORIGIN, REASONS.deviceActionAlreadyDone);
  });

  it("applies effects, reveals evidence and records the debrief tag", () => {
    const state = afterOrigin();
    expect(state.flags.notification_origin_inspected).toBe(true);
    expect(state.flags.notification_handled).toBe(true);
    expect(state.discovered).toContain("ev.notification-metadata");
    const last = state.events.at(-1);
    expect(last?.derived.evidence).toEqual(["ev.notification-metadata"]);
    expect(last?.derived.debriefTags).toContain("inspected-origin");
  });

  it("can repeat an action that is not marked once", () => {
    const scenario: ScenarioDefinition = {
      ...FIXTURE_SCENARIO,
      deviceActions: {
        ...FIXTURE_SCENARIO.deviceActions,
        "dev.inspect-notification-origin": {
          ...FIXTURE_SCENARIO.deviceActions["dev.inspect-notification-origin"],
          requires: [],
          once: false,
        },
      },
    };
    const state = play(createInitialState(scenario), [START, INSPECT_ORIGIN, INSPECT_ORIGIN], scenario);
    expect(state.events).toHaveLength(3);
  });
});

describe("COMBINE_EVIDENCE", () => {
  const sameSource: CoreAction = { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.shared-case-id"] };
  const sameSourceReversed: CoreAction = {
    type: "COMBINE_EVIDENCE",
    evidenceIds: ["ev.shared-case-id", "ev.alex-statement"],
  };
  const mismatch: CoreAction = {
    type: "COMBINE_EVIDENCE",
    evidenceIds: ["ev.notification-metadata", "ev.account-activity"],
  };
  const ready = (): ChapterState => play(afterAlex(), [INSPECT_ORIGIN, INSPECT_SHARED, RECEIPTS]);

  it("records the deduction, applies its effects and tags the event", () => {
    const state = play(ready(), [sameSource]);
    expect(state.deductions).toEqual(["ded.same-source"]);
    expect(state.flags.shared_origin_established).toBe(true);
    expect(state.events.at(-1)?.derived.debriefTags).toContain("same-source");
    expect(state.events.at(-1)?.derived.flags).toContain("shared_origin_established");
  });

  it("sets a claim to inconclusive through a deduction effect", () => {
    const state = play(ready(), [mismatch]);
    expect(state.deductions).toEqual(["ded.notification-mismatch"]);
    expect(state.claims["claim.notification-genuine"]).toBe("inconclusive");
  });

  it("rejects a combination that matches no deduction", () => {
    expectRejected(
      ready(),
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.account-activity"] },
      REASONS.combinationInvalid,
    );
    expectRejected(
      ready(),
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.shared-case-id", "ev.account-activity"] },
      REASONS.combinationInvalid,
    );
  });

  it("rejects evidence that is not discovered", () => {
    expectRejected(afterAlex(), sameSource, REASONS.evidenceNotAvailable);
  });

  it("rejects a duplicate submission and leaves the state untouched", () => {
    const once = play(ready(), [sameSource]);
    expectRejected(once, sameSource, REASONS.deductionAlreadyRecorded);
    expectRejected(once, sameSourceReversed, REASONS.deductionAlreadyRecorded);
  });

  it("gives the same result for any order of the evidence", () => {
    const a = play(ready(), [sameSource]);
    const b = play(ready(), [sameSourceReversed]);
    expect(b.deductions).toEqual(a.deductions);
    expect(b.flags).toEqual(a.flags);
    expect(b.claims).toEqual(a.claims);
    expect(b.discovered).toEqual(a.discovered);
  });

  it("rejects a matching deduction whose requires do not hold", () => {
    const scenario: ScenarioDefinition = {
      ...FIXTURE_SCENARIO,
      deductions: {
        ...FIXTURE_SCENARIO.deductions,
        "ded.same-source": {
          ...FIXTURE_SCENARIO.deductions["ded.same-source"],
          requires: [{ kind: "flag", flag: "chain_identified" }],
        },
      },
    };
    const state = withEvidence(fixtureState(), ["ev.alex-statement", "ev.shared-case-id"]);
    const result = chapterReducer(state, sameSource, scenario);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe(REASONS.combinationInvalid);
    const unlocked = chapterReducer(withFlags(state, ["chain_identified"]), sameSource, scenario);
    expect(unlocked.accepted).toBe(true);
  });
});

describe("VERIFY_CLAIM", () => {
  const withNumber = (state: ChapterState): ChapterState => withEvidence(state, ["ev.official-contact-paper"]);

  it("saved-official-contact needs the saved contact evidence and no call in progress", () => {
    expectRejected(afterAlex(), OFFICIAL, REASONS.needOfficialNumber);
    const talking = withNumber(play(started(), [RING_ALEX]));
    expectRejected(talking, OFFICIAL, REASONS.callInProgress);
    const decided: ChapterState = { ...withNumber(afterAlex()), decision: "refuse-and-stop" };
    expectRejected(decided, OFFICIAL, REASONS.decisionAlreadyMade);
  });

  it("saved-official-contact accepts either E03 or E03b", () => {
    for (const id of ["ev.official-contact-paper", "ev.official-contact-app"] as const) {
      const result = chapterReducer(withEvidence(afterAlex(), [id]), OFFICIAL, FIXTURE_SCENARIO);
      expect(result.accepted).toBe(true);
    }
  });

  it("saved-official-contact starts an outgoing call to call.official and can contradict a claim", () => {
    const calling = play(withNumber(afterAlex()), [OFFICIAL]);
    expect(calling.call.current).toBe("call.official");
    expect(calling.call.status).toBe("active");
    expect(calling.call.log.at(-1)).toMatchObject({ callId: "call.official", direction: "outgoing", status: "answered" });
    expect(calling.conversation?.graphId).toBe("dlg.official-line");

    const done = play(calling, [option("off.ask")]);
    expect(done.call.current).toBeNull();
    expect(done.claims["claim.recovery-needed"]).toBe("contradicted");
    expect(done.flags.official_channel_verified).toBe(true);
  });

  it("bank-app needs the phone open and sets the claim to inconclusive, not contradicted", () => {
    expectRejected(started(), BANK_APP, REASONS.phoneClosed);
    const state = play(started(), [{ type: "OPEN_PHONE" }, BANK_APP]);
    expect(state.claims["claim.recovery-needed"]).toBe("inconclusive");
    expectRejected(state, BANK_APP, REASONS.evidenceAlreadyRecorded);
  });

  it("bank-app keeps a contradicted status from the official line", () => {
    const verified = play(withNumber(afterAlex()), [OFFICIAL, option("off.ask"), { type: "OPEN_PHONE" }, BANK_APP]);
    expect(verified.claims["claim.recovery-needed"]).toBe("contradicted");
  });
});

describe("RING_CALL rings at most once (regression)", () => {
  it("rejects a re-ring of a declined call so the first call stays closed", () => {
    const phoneOpen = play(createInitialState(CHAPTER_1_SCENARIO), [
      START,
      { type: "RING_CALL", callId: "call.alex", reason: "exploration-timer" },
      { type: "OPEN_PHONE" },
      END_CALL,
    ], CHAPTER_1_SCENARIO);
    const result = chapterReducer(phoneOpen, { type: "RING_CALL", callId: "call.alex", reason: "re-ring" }, CHAPTER_1_SCENARIO);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe(REASONS.callAlreadyRang);
    expect(result.state).toBe(phoneOpen);
    expect(phoneOpen.call.log.find((r) => r.callId === "call.alex")?.status).toBe("declined");
  });
});
