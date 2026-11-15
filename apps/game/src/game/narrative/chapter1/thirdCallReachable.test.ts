// Regression for the browser audit of the third call (spec chapter-01-double-deception, req 9.1,
// 9.8, 12.x): after the player handled the laptop notification in ANY way, or gathered enough on
// their own, Morgan (`call.recovery`) must be ringable, so the player is never left without a
// cue. The tests use the real scenario, the reducer and `selectRingableCall`.
import { describe, expect, it } from "vitest";
import { DECLINE_ALEX } from "../../../test/chapterRuns";
import { chapterReducer, createInitialState } from "../reducer";
import { enumerateCandidateActions, selectRingableCall } from "../selectors";
import type { ChapterState, CoreAction } from "../types";
import { CHAPTER_1_SCENARIO } from "./scenario";

const SCENARIO = CHAPTER_1_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const dev = (deviceActionId: Extract<CoreAction, { type: "DEVICE_ACTION" }>["deviceActionId"]): CoreAction => ({
  type: "DEVICE_ACTION",
  deviceActionId,
});
const interact = (objectId: Extract<CoreAction, { type: "INTERACT_OBJECT" }>["objectId"]): CoreAction => ({
  type: "INTERACT_OBJECT",
  objectId,
});

function run(actions: readonly CoreAction[]): ChapterState {
  let state = createInitialState();
  for (const action of actions) {
    const result = chapterReducer(state, action, SCENARIO);
    if (!result.accepted) throw new Error(`rejected ${JSON.stringify(action)}: ${result.reason ?? ""}`);
    state = result.state;
  }
  return state;
}

/** Applies every accepted device action or prop inspection until nothing new is possible. */
function saturateFreeActions(from: ChapterState): ChapterState {
  let state = from;
  for (let pass = 0; pass < 50; pass += 1) {
    const free = enumerateCandidateActions(state, SCENARIO).filter(
      (a) => a.type === "DEVICE_ACTION" || a.type === "INTERACT_OBJECT",
    );
    let progressed = false;
    for (const action of free) {
      const result = chapterReducer(state, action, SCENARIO);
      if (result.accepted) {
        state = result.state;
        progressed = true;
      }
    }
    if (!progressed) return state;
  }
  return state;
}

const AFTER_DECLINE: CoreAction[] = [START, ...DECLINE_ALEX];

describe("third call is reachable without a hidden step", () => {
  it("does not ring right after the first call closes", () => {
    expect(selectRingableCall(run(AFTER_DECLINE), SCENARIO)).toBeNull();
  });

  it("does not ring after the player only opened the notification", () => {
    const state = run([...AFTER_DECLINE, dev("dev.open-notification")]);
    expect(state.flags.notification_handled).toBe(true);
    expect(state.flags.review_security_opened).not.toBe(true);
    expect(state.flags.notification_dismissed).not.toBe(true);
    expect(selectRingableCall(state, SCENARIO)).toBeNull();
  });

  it("does not ring after opening the notification and inspecting only its origin", () => {
    const state = run([...AFTER_DECLINE, dev("dev.open-notification"), dev("dev.inspect-notification-origin")]);
    expect(state.discovered).toContain("ev.notification-metadata");
    expect(selectRingableCall(state, SCENARIO)).toBeNull();
  });

  it("rings after opening the notification, inspecting the origin and the saved contacts", () => {
    const state = run([
      ...AFTER_DECLINE,
      dev("dev.open-notification"),
      dev("dev.inspect-notification-origin"),
      dev("dev.open-bank-app"),
      dev("dev.open-saved-contacts"),
    ]);
    expect(state.flags.review_security_opened).not.toBe(true);
    expect(selectRingableCall(state, SCENARIO)).toBe("call.recovery");
  });

  it("rings after Details, Check origin, Contacts and Compare without Review Security or Dismiss", () => {
    // Audit run 2: after a declined first call only two counted items exist (origin and saved contacts).
    const state = run([
      ...AFTER_DECLINE,
      dev("dev.open-notification"),
      dev("dev.inspect-notification-origin"),
      dev("dev.open-bank-app"),
      dev("dev.open-saved-contacts"),
      dev("dev.compare-contacts"),
    ]);
    expect(state.discovered.length).toBeGreaterThan(0);
    expect(selectRingableCall(state, SCENARIO)).toBe("call.recovery");
  });

  it("rings after Dismiss and after Review Security", () => {
    expect(selectRingableCall(run([...AFTER_DECLINE, dev("dev.dismiss-notification")]), SCENARIO)).toBe("call.recovery");
    expect(selectRingableCall(run([...AFTER_DECLINE, dev("dev.review-security")]), SCENARIO)).toBe("call.recovery");
  });

  it("rings for a player who never opens the laptop but looks at the room and the phone", () => {
    const state = run([
      ...AFTER_DECLINE,
      interact("obj.receipts"),
      interact("obj.note"),
      dev("dev.open-call-details"),
    ]);
    expect(state.flags.notification_handled).not.toBe(true);
    expect(selectRingableCall(state, SCENARIO)).toBe("call.recovery");
  });

  it("every state reached by free actions alone rings once the free actions are used up", () => {
    const state = saturateFreeActions(run(AFTER_DECLINE));
    expect(selectRingableCall(state, SCENARIO)).toBe("call.recovery");
  });
});
