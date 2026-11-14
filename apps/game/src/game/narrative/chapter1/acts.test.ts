// Chapter 1 acts (spec chapter-01-double-deception, task 7.5; Requirements 5.6, 6.1, 15.3, 15.6):
// enter and exit conditions, objectives per act, and monotonic act progress along a full run.
import { describe, expect, it } from "vitest";
import {
  CALL_SAVED_CONTACT,
  DECLINE_ALEX,
  EXPOSE_THIRD_CALL,
  LINK_FIRST_TWO,
} from "../../../test/chapterRuns";
import { evaluateConditions } from "../conditions";
import { chapterReducer, createInitialState } from "../reducer";
import { selectCurrentAct } from "../selectors";
import type { ChapterState, CoreAction } from "../types";
import { CHAPTER_1_ACTS } from "./acts";
import { CHAPTER_1_SCENARIO } from "./scenario";

const SCENARIO = CHAPTER_1_SCENARIO;

function play(actions: readonly CoreAction[], from: ChapterState = createInitialState()): ChapterState[] {
  const states: ChapterState[] = [from];
  let state = from;
  for (const action of actions) {
    const result = chapterReducer(state, action, SCENARIO);
    if (!result.accepted) throw new Error(`rejected ${JSON.stringify(action)}: ${result.reason ?? ""}`);
    state = result.state;
    states.push(state);
  }
  return states;
}

const START: CoreAction = { type: "START_CHAPTER" };

describe("Chapter 1 acts data", () => {
  it("has five acts whose exit equals the next enter", () => {
    expect(CHAPTER_1_ACTS.map((act) => act.id)).toEqual(["act.1", "act.2", "act.3", "act.4", "act.5"]);
    for (let i = 0; i < CHAPTER_1_ACTS.length - 1; i += 1) {
      expect(CHAPTER_1_ACTS[i].exitWhen).toEqual(CHAPTER_1_ACTS[i + 1].enterWhen);
    }
  });

  it("lists only known objectives and gives every objective an act", () => {
    const listed = CHAPTER_1_ACTS.flatMap((act) => act.objectives);
    for (const id of listed) expect(Object.hasOwn(SCENARIO.objectives, id)).toBe(true);
    expect([...listed].sort()).toEqual(Object.keys(SCENARIO.objectives).sort());
  });
});

describe("Chapter 1 acts along a run", () => {
  it("starts in act 1 with the phone objective", () => {
    const [, started] = play([START]);
    expect(selectCurrentAct(started, SCENARIO).id).toBe("act.1");
    expect(started.objectives.active).toContain("obj.answer-or-decline");
  });

  it("enters act 2 when the first call closes, with the laptop objective", () => {
    const states = play([START, ...DECLINE_ALEX]);
    const before = states[states.length - 2];
    const after = states[states.length - 1];
    expect(selectCurrentAct(before, SCENARIO).id).toBe("act.1");
    expect(evaluateConditions(CHAPTER_1_ACTS[0].exitWhen, after, SCENARIO)).toBe(true);
    expect(selectCurrentAct(after, SCENARIO).id).toBe("act.2");
    expect(after.objectives.completed).toContain("obj.answer-or-decline");
    expect(after.objectives.active).toContain("obj.check-laptop");
  });

  it("enters act 3 once the notification is handled, with the investigation objective", () => {
    const states = play([START, ...DECLINE_ALEX, { type: "DEVICE_ACTION", deviceActionId: "dev.open-notification" }]);
    const last = states[states.length - 1];
    expect(selectCurrentAct(last, SCENARIO).id).toBe("act.3");
    expect(last.objectives.completed).toContain("obj.check-laptop");
    expect(last.objectives.active).toContain("obj.investigate");
  });

  it("reaches acts 4 and 5 through the third call and records an objective for each", () => {
    const states = play([
      START,
      ...DECLINE_ALEX,
      ...LINK_FIRST_TWO,
      { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" },
    ]);
    const ringing = states[states.length - 1];
    expect(selectCurrentAct(ringing, SCENARIO).id).toBe("act.4");
    expect(ringing.objectives.active).toContain("obj.answer-recovery");
    const closed = play(
      [{ type: "ANSWER_CALL" }, ...EXPOSE_THIRD_CALL.slice(2, 4)],
      ringing,
    );
    const done = closed[closed.length - 1];
    expect(selectCurrentAct(done, SCENARIO).id).toBe("act.5");
    expect(done.objectives.active).toContain("obj.decide");
  });

  it("only moves forward through the five acts on the saved-contact run", () => {
    const states = play([START, ...DECLINE_ALEX, ...LINK_FIRST_TWO, ...EXPOSE_THIRD_CALL, ...CALL_SAVED_CONTACT]);
    const indexes = states.map((state) => CHAPTER_1_ACTS.findIndex((act) => act.id === selectCurrentAct(state, SCENARIO).id));
    for (let i = 1; i < indexes.length; i += 1) expect(indexes[i]).toBeGreaterThanOrEqual(indexes[i - 1]);
    expect(new Set(indexes)).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it("holds enter conditions in the current act and exit conditions of earlier acts", () => {
    const states = play([START, ...DECLINE_ALEX, ...LINK_FIRST_TWO, ...EXPOSE_THIRD_CALL]);
    for (const state of states) {
      const index = CHAPTER_1_ACTS.findIndex((act) => act.id === selectCurrentAct(state, SCENARIO).id);
      expect(evaluateConditions(CHAPTER_1_ACTS[index].enterWhen, state, SCENARIO)).toBe(true);
      if (index < CHAPTER_1_ACTS.length - 1) {
        expect(evaluateConditions(CHAPTER_1_ACTS[index].exitWhen, state, SCENARIO)).toBe(false);
      }
    }
  });
});
