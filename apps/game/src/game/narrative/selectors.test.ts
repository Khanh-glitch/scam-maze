// Selector tests for the double-deception chapter, driven by the fixture scenario.
// Feature: chapter-01-double-deception, task 3.5. Requirements 4.4, 5.5, 6.3, 8.11, 9.1, 10.1.

import { describe, expect, it } from "vitest";
import { FIXTURE_SCENARIO, withEvidence } from "../../test/fixtureScenario";
import { chapterReducer, createInitialState } from "./reducer";
import {
  enumerateCandidateActions,
  selectCallLog,
  selectCombinationOptions,
  selectDecisionPanel,
  selectDeception,
  selectLaptopView,
  selectPhoneRecords,
  selectRingableCall,
} from "./selectors";
import type { ChapterState, CoreAction, ScenarioDefinition } from "./types";

const S = FIXTURE_SCENARIO;

function run(actions: CoreAction[], from: ChapterState = createInitialState(S)): ChapterState {
  let state = from;
  for (const action of actions) {
    const result = chapterReducer(state, action, S);
    expect(result.accepted, `${JSON.stringify(action)}: ${result.reason ?? ""}`).toBe(true);
    state = result.state;
  }
  return state;
}

const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "exploration-timer" };
const RING_RECOVERY: CoreAction = { type: "RING_CALL", callId: "call.recovery", reason: "callback" };
const END_CALL: CoreAction = { type: "END_CALL" };
const INSPECT_ORIGIN: CoreAction = { type: "DEVICE_ACTION", deviceActionId: "dev.inspect-notification-origin" };
const READ_RECEIPTS: CoreAction = { type: "INTERACT_OBJECT", objectId: "obj.receipts" };

/** Alex declined, notification delivered and inspected. */
const afterNotification = (): ChapterState => run([START, RING_ALEX, END_CALL, INSPECT_ORIGIN]);

function afterRecoveryCall(): ChapterState {
  let state = run([START, RING_ALEX, END_CALL, INSPECT_ORIGIN, RING_RECOVERY, { type: "ANSWER_CALL" }]);
  state = run([{ type: "SELECT_DIALOGUE_OPTION", optionId: "rec.hang-up" }], state);
  return state.call.current !== null ? run([END_CALL], state) : state;
}

describe("selectDeception", () => {
  it("projects flags, evidence, deductions and the decision", () => {
    const start = run([START]);
    expect(selectDeception(start, S)).toEqual({
      firstCallRejected: false,
      notificationOpened: false,
      notificationOriginInspected: false,
      officialChannelVerified: false,
      secondCallerTrusted: false,
      evidenceDiscovered: [],
      deductionsUnlocked: [],
      finalDecision: null,
    });
    const state = afterNotification();
    const view = selectDeception(state, S);
    expect(view.firstCallRejected).toBe(true);
    expect(view.notificationOriginInspected).toBe(true);
    expect(view.evidenceDiscovered).toEqual(["ev.notification-metadata"]);
  });

  it("returns the same object for the same state", () => {
    const state = run([START]);
    expect(selectDeception(state, S)).toBe(selectDeception(state, S));
  });
});

describe("selectRingableCall", () => {
  it("offers the first call after the chapter starts, and nothing before", () => {
    expect(selectRingableCall(createInitialState(S), S)).toBeNull();
    expect(selectRingableCall(run([START]), S)).toBe("call.alex");
  });

  it("returns null while a call rings, after it has rung, and after a decision", () => {
    const ringing = run([START, RING_ALEX]);
    expect(selectRingableCall(ringing, S)).toBeNull();
    const declined = run([END_CALL], ringing);
    expect(selectRingableCall(declined, S)).toBeNull();
  });

  it("offers the third call only when an authored alternative holds", () => {
    const declined = run([START, RING_ALEX, END_CALL]);
    expect(selectRingableCall(declined, S)).toBeNull();
    expect(selectRingableCall(run([INSPECT_ORIGIN], declined), S)).toBe("call.recovery");
  });
});

describe("selectLaptopView", () => {
  it("tracks the notification state", () => {
    expect(selectLaptopView(run([START]), S).notification.state).toBe("none");
    const delivered = run([START, RING_ALEX, END_CALL]);
    expect(selectLaptopView(delivered, S).notification.state).toBe("new");
  });

  it("lists only available or finished laptop actions", () => {
    expect(selectLaptopView(run([START]), S).deviceActions).toEqual([]);
    const delivered = run([START, RING_ALEX, END_CALL]);
    expect(selectLaptopView(delivered, S).deviceActions).toEqual([
      expect.objectContaining({ id: "dev.inspect-notification-origin", available: true, done: false }),
    ]);
    const done = run([INSPECT_ORIGIN], delivered);
    expect(selectLaptopView(done, S).deviceActions).toEqual([
      expect.objectContaining({ id: "dev.inspect-notification-origin", available: false, done: true }),
    ]);
  });

  it("fills compare rows from what the player holds and never states a match", () => {
    const inspected = afterNotification();
    const before = selectLaptopView(inspected, S).compareRows;
    expect(before.map((row) => row.key)).toEqual(["case", "domain"]);
    expect(before.every((row) => row.reference === null)).toBe(true);
    const after = selectLaptopView(run([READ_RECEIPTS], inspected), S).compareRows;
    expect(after.find((row) => row.key === "domain")).toEqual({
      key: "domain",
      notification: "northgate-alerts.invalid",
      reference: "northgate-bank.example",
    });
    for (const row of after) expect(Object.keys(row).sort()).toEqual(["key", "notification", "reference"]);
  });

  it("shows bank app screens only after the app was opened", () => {
    const state = run([START]);
    expect(selectLaptopView(state, S).bankApp.screens).toEqual([]);
    const opened: ChapterState = { ...state, flags: { ...state.flags, bank_app_opened: true } };
    expect(selectLaptopView(opened, S).bankApp.screens).toHaveLength(1);
  });
});

describe("selectPhoneRecords", () => {
  it("lists the call history and the saved contact state", () => {
    const state = run([START, RING_ALEX, END_CALL]);
    const view = selectPhoneRecords(state, S);
    expect(view.calls.map((entry) => entry.callId)).toEqual(["call.alex"]);
    expect(view.voicemail).toBeNull();
    expect(view.savedContact).toMatchObject({ number: "+000 0100 0800", available: false, called: false });
  });

  it("makes the saved contact available once a contact is discovered and no call is active", () => {
    const state = withEvidence(run([START, RING_ALEX, END_CALL]), ["ev.official-contact-paper"]);
    expect(selectPhoneRecords(state, S).savedContact?.available).toBe(true);
    const ringing = withEvidence(run([START, RING_ALEX]), ["ev.official-contact-paper"]);
    expect(selectPhoneRecords(ringing, S).savedContact?.available).toBe(false);
  });
});

describe("selectCallLog evidence", () => {
  it("derives the revealable evidence from Scenario_Data", () => {
    const scenario: ScenarioDefinition = structuredClone(S);
    scenario.evidence["ev.shared-case-id"].discovery = {
      via: "inspect",
      requires: [{ kind: "callRang", callId: "call.alex" }],
    };
    let state = createInitialState(scenario);
    for (const action of [START, RING_ALEX]) state = chapterReducer(state, action, scenario).state;
    const [entry] = selectCallLog(state, scenario);
    expect(entry.evidenceId).toBe("ev.shared-case-id");
    expect(entry.evidenceAvailable).toBe(true);
    expect(selectCallLog(run([START, RING_ALEX]), S)[0].evidenceId).toBeNull();
  });
});

describe("selectCombinationOptions", () => {
  it("lists discovered evidence only and exposes no match information", () => {
    const state = run([START, RING_ALEX, END_CALL, INSPECT_ORIGIN, READ_RECEIPTS]);
    const view = selectCombinationOptions(state, S);
    expect(view.items.map((item) => item.id)).toEqual(["ev.notification-metadata", "ev.account-activity"]);
    expect(view.items[0].sourceLabel).toBe("Laptop notification");
    expect(Object.keys(view).sort()).toEqual(["items", "maxSelection", "minSelection", "recorded"]);
    expect(view.recorded).toEqual([]);
  });

  it("gives the same item list whether or not a combination would match", () => {
    const state = run([START, RING_ALEX, END_CALL, INSPECT_ORIGIN]);
    const withMatch = run([READ_RECEIPTS], state);
    const ids = selectCombinationOptions(withMatch, S).items.map((item) => item.id);
    expect(ids).toEqual([...selectCombinationOptions(state, S).items.map((item) => item.id), "ev.account-activity"]);
  });

  it("lists a deduction after the player recorded it", () => {
    const state = run([
      START,
      RING_ALEX,
      END_CALL,
      INSPECT_ORIGIN,
      READ_RECEIPTS,
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.account-activity", "ev.notification-metadata"] },
    ]);
    expect(selectCombinationOptions(state, S).recorded).toEqual([
      { id: "ded.notification-mismatch", statement: "The notification domain does not match the statement." },
    ]);
  });
});

describe("selectDecisionPanel", () => {
  it("is not offered before the last act", () => {
    const panel = selectDecisionPanel(afterNotification(), S);
    expect(panel.offered).toBe(false);
    expect(panel.options.every((option) => !option.available)).toBe(true);
  });

  it("offers the decisions in the last act, with the verify pre-step", () => {
    const state = run([READ_RECEIPTS], afterRecoveryCall());
    const panel = selectDecisionPanel(state, S);
    expect(panel.offered).toBe(true);
    const ids = panel.options.map((option) => option.id);
    expect(ids).toEqual(["follow-recovery", "refuse-and-stop", "verify-independently"]);
    const verify = panel.options.find((option) => option.id === "verify-independently");
    expect(verify?.available).toBe(true);
    expect(verify?.preStep).toMatchObject({ method: "saved-official-contact", done: false });
    expect(panel.options.find((option) => option.id === "refuse-and-stop")?.available).toBe(true);
  });

  it("closes once a decision exists", () => {
    const state = run([{ type: "MAKE_DECISION", decision: "refuse-and-stop" }], afterRecoveryCall());
    expect(selectDecisionPanel(state, S).offered).toBe(false);
  });
});

describe("enumerateCandidateActions", () => {
  const kinds = (actions: CoreAction[]) => new Set(actions.map((action) => action.type));

  it("offers the start action, then the first call", () => {
    expect(enumerateCandidateActions(createInitialState(S), S)).toEqual([{ type: "START_CHAPTER" }]);
    expect(enumerateCandidateActions(run([START]), S)).toContainEqual({
      type: "RING_CALL",
      callId: "call.alex",
      reason: "callback",
    });
  });

  it("covers device actions, combinations and the saved-contact check, and every one is accepted", () => {
    let state = run([START, RING_ALEX, END_CALL, INSPECT_ORIGIN, READ_RECEIPTS]);
    state = withEvidence(state, ["ev.official-contact-paper"]);
    const actions = enumerateCandidateActions(state, S);
    expect(kinds(actions)).toContain("COMBINE_EVIDENCE");
    expect(kinds(actions)).toContain("VERIFY_CLAIM");
    expect(actions).toContainEqual({
      type: "COMBINE_EVIDENCE",
      evidenceIds: ["ev.notification-metadata", "ev.account-activity"],
    });
    const device = enumerateCandidateActions(run([START, RING_ALEX, END_CALL]), S);
    expect(device).toContainEqual(INSPECT_ORIGIN);
    for (const action of actions.filter((a) => a.type === "COMBINE_EVIDENCE" || a.type === "VERIFY_CLAIM")) {
      expect(chapterReducer(state, action, S).accepted).toBe(true);
    }
  });

  it("does not list a combination that is already recorded or does not match", () => {
    const state = run([
      START,
      RING_ALEX,
      END_CALL,
      INSPECT_ORIGIN,
      READ_RECEIPTS,
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.notification-metadata", "ev.account-activity"] },
    ]);
    expect(kinds(enumerateCandidateActions(state, S))).not.toContain("COMBINE_EVIDENCE");
  });
});
