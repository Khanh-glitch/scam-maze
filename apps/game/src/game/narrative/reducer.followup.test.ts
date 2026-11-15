// Fixture-based tests for the second call (`call.recovery`) ringing through `CallDef.ringWhen`
// and for the official verify flow (spec chapter-01-double-deception, task 3.3).

import { describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO, withEvidence, withFlags } from "../../test/fixtureScenario";
import { chapterReducer, createInitialState, REASONS } from "./reducer";
import type { ChapterState, CoreAction } from "./types";

function play(state: ChapterState, actions: readonly CoreAction[]): ChapterState {
  let current = state;
  for (const action of actions) {
    const result = chapterReducer(current, action, FIXTURE_SCENARIO);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    current = result.state;
  }
  return current;
}

function expectRejected(state: ChapterState, action: CoreAction, reason: string): void {
  const result = chapterReducer(state, action, FIXTURE_SCENARIO);
  expect(result.accepted).toBe(false);
  expect(result.reason).toBe(reason);
  expect(result.state).toBe(state);
}

const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const RING_RECOVERY: CoreAction = { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const INSPECT_ORIGIN: CoreAction = { type: "DEVICE_ACTION", deviceActionId: "dev.inspect-notification-origin" };
const OFFICIAL: CoreAction = {
  type: "VERIFY_CLAIM",
  claimId: "claim.recovery-needed",
  method: "saved-official-contact",
};
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

const started = (): ChapterState => play(createInitialState(FIXTURE_SCENARIO), [START]);
const afterAlex = (): ChapterState => play(started(), [RING_ALEX, ANSWER, option("alex.refuse")]);

describe("RING_CALL for call.recovery through ringWhen", () => {
  it("is rejected while no ringWhen group holds", () => {
    expectRejected(afterAlex(), RING_RECOVERY, REASONS.callNotYet);
    expectRejected(started(), RING_RECOVERY, REASONS.callNotYet);
  });

  it("rings after the notification is handled (first group)", () => {
    const state = play(afterAlex(), [INSPECT_ORIGIN, RING_RECOVERY]);
    expect(state.call.current).toBe("call.recovery");
    expect(state.call.status).toBe("ringing");
  });

  it("rings when the first call closed and review_security_opened is set (second group)", () => {
    const state = play(withFlags(afterAlex(), ["review_security_opened"]), [RING_RECOVERY]);
    expect(state.call.current).toBe("call.recovery");
  });

  it("does not ring on one condition of an AND group alone", () => {
    expectRejected(withFlags(started(), ["review_security_opened"]), RING_RECOVERY, REASONS.callNotYet);
  });

  it("is rejected while another call is ringing or a conversation is open", () => {
    const ringing = play(withFlags(started(), ["notification_handled"]), [RING_ALEX]);
    expectRejected(ringing, RING_RECOVERY, REASONS.callAlreadyRinging);
    const talking = play(ringing, [ANSWER]);
    expectRejected(talking, RING_RECOVERY, REASONS.callInProgress);
  });

  it("is rejected after a decision was made", () => {
    const decided: ChapterState = { ...play(afterAlex(), [INSPECT_ORIGIN]), decision: "refuse-and-stop" };
    expectRejected(decided, RING_RECOVERY, REASONS.decisionAlreadyMade);
  });

  it("does not ring again after it was answered, and not after a decline either", () => {
    const base = play(afterAlex(), [INSPECT_ORIGIN]);
    const answered = play(base, [RING_RECOVERY, ANSWER, option("rec.trust")]);
    expectRejected(answered, RING_RECOVERY, REASONS.callAlreadyRang);
    const hungUp = play(base, [RING_RECOVERY, ANSWER, END_CALL]);
    expectRejected(hungUp, RING_RECOVERY, REASONS.callAlreadyRang);

    const declined = play(base, [RING_RECOVERY, END_CALL]);
    expect(declined.call.log.at(-1)?.status).toBe("declined");
    expectRejected(declined, RING_RECOVERY, REASONS.callAlreadyRang);
  });

  it("hanging up the second call records the hung-up tag without touching the first-call flag twice", () => {
    const state = play(afterAlex(), [INSPECT_ORIGIN, RING_RECOVERY, ANSWER, END_CALL]);
    expect(state.events.at(-1)?.derived.debriefTags).toEqual(["hung-up"]);
    expect(state.call.status).toBe("ended");
    expect(state.call.current).toBeNull();
  });

  it("never rings the outgoing official call", () => {
    const result = chapterReducer(
      afterAlex(),
      { type: "RING_CALL", callId: "call.official", reason: "callback" },
      FIXTURE_SCENARIO,
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe(REASONS.unknownAction);
  });
});

describe("official verify flow", () => {
  const ready = (): ChapterState => withEvidence(afterAlex(), ["ev.official-contact-app"]);

  it("calls the saved contact, reaches the confirmation node and closes the call", () => {
    const calling = play(ready(), [OFFICIAL]);
    expect(calling.conversation?.nodeId).toBe("off.open");
    const done = play(calling, [option("off.ask")]);
    expect(done.call.status).toBe("ended");
    expect(done.call.log.at(-1)).toMatchObject({ callId: "call.official", status: "ended" });
    expect(done.claims["claim.recovery-needed"]).toBe("contradicted");
    expect(done.flags.official_channel_verified).toBe(true);
  });

  it("makes the verified decision available and selects the verified ending path", () => {
    const done = play(ready(), [OFFICIAL, option("off.ask")]);
    const decided = play(done, [{ type: "MAKE_DECISION", decision: "verify-independently" }]);
    expect(decided.decision).toBe("verify-independently");
    expect(decided.outcome).not.toBeNull();
  });

  it("is rejected without the saved contact evidence", () => {
    expectRejected(afterAlex(), OFFICIAL, REASONS.needOfficialNumber);
  });
});
