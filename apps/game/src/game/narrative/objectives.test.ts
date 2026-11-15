// Unit tests for the data-driven objective manager (spec chapter-01-double-deception, task 3.4).
// States are crafted from the fixture scenario; the full reducer rewrite is task 3.3.

import { describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO, fixtureState, withEvidence, withFlags } from "../../test/fixtureScenario";
import type { CallRecord, ChapterState, CoreAction, ScenarioDefinition } from "./types";
import {
  canCompleteObjective,
  OBJECTIVE_CONDITION_NOT_MET,
  OBJECTIVE_NEUTRAL_ACTIONS,
  runObjectiveManager,
} from "./objectives";

const START: CoreAction = { type: "START_CHAPTER" };
const OPEN_PHONE: CoreAction = { type: "OPEN_PHONE" };
const S = FIXTURE_SCENARIO;

function record(callId: CallRecord["callId"], status: CallRecord["status"]): CallRecord {
  return { callId, direction: "incoming", displayName: "Caller", number: "+000 0100 2200", status, ringCount: 1 };
}

function withCall(state: ChapterState, callId: CallRecord["callId"], status: CallRecord["status"]): ChapterState {
  return { ...state, call: { ...state.call, log: [...state.call.log, record(callId, status)] } };
}

/** Runs the manager as the reducer does and returns the result for `next`. */
function step(prev: ChapterState, next: ChapterState, action: CoreAction = START, scenario = S) {
  return runObjectiveManager(prev, next, action, scenario);
}

describe("activateWhen and completeWhen from Scenario_Data", () => {
  it("activates an objective with no activation conditions on the first accepted action", () => {
    const state = fixtureState();
    const result = step(state, state);
    expect(result.activated).toEqual(["obj.answer-or-decline"]);
    expect(result.completed).toEqual([]);
    expect(result.state.objectives.active).toEqual(["obj.answer-or-decline"]);
  });

  it("completes an objective when its conditions hold and activates the next one", () => {
    const first = step(fixtureState(), fixtureState()).state;
    const closed = withCall(first, "call.alex", "declined");
    const result = step(first, closed, { type: "END_CALL" });
    expect(result.completed).toEqual(["obj.answer-or-decline"]);
    expect(result.activated).toEqual(["obj.check-laptop"]);
    expect(result.state.objectives).toEqual({
      active: ["obj.check-laptop"],
      completed: ["obj.answer-or-decline"],
    });
  });

  it("can activate and complete in the same step, in OBJECTIVE_IDS order", () => {
    const next = withFlags(withCall(fixtureState(), "call.alex", "ended"), ["notification_handled"]);
    const result = step(fixtureState(), next, { type: "END_CALL" });
    expect(result.activated).toEqual(["obj.answer-or-decline", "obj.check-laptop", "obj.investigate"]);
    expect(result.completed).toEqual(["obj.answer-or-decline", "obj.check-laptop"]);
    expect(result.state.objectives.active).toEqual(["obj.investigate"]);
  });

  it("completes on a deduction and on evidence-derived state", () => {
    const base = step(fixtureState(), withFlags(fixtureState(), ["notification_handled"])).state;
    expect(base.objectives.active).toContain("obj.investigate");
    const recorded: ChapterState = { ...base, deductions: ["ded.same-source"] };
    const result = step(base, recorded, { type: "COMBINE_EVIDENCE", evidenceIds: [] } as unknown as CoreAction);
    expect(result.completed).toContain("obj.investigate");
  });

  it("lets objectiveCompleted see a completion made earlier in the same step", () => {
    const base = fixtureState({ decision: "refuse-and-stop", outcome: "break-the-chain", status: "ended" });
    const prepared = withCall(withCall(base, "call.alex", "ended"), "call.recovery", "ended");
    const result = step(base, prepared, { type: "MAKE_DECISION", decision: "refuse-and-stop" });
    expect(result.completed).toContain("obj.decide");
    expect(result.completed).toContain("obj.review");
    expect(result.completed.indexOf("obj.decide")).toBeLessThan(result.completed.indexOf("obj.review"));
  });

  it("never activates an objective twice or completes an inactive one", () => {
    const once = step(fixtureState(), fixtureState()).state;
    const again = step(once, once);
    expect(again.activated).toEqual([]);
    expect(again.state).toBe(once);

    const done: ChapterState = { ...once, objectives: { active: [], completed: ["obj.answer-or-decline"] } };
    const closed = withCall(done, "call.alex", "ended");
    expect(step(done, closed).completed).not.toContain("obj.answer-or-decline");
  });

  it("never completes an objective whose completeWhen is empty", () => {
    const scenario: ScenarioDefinition = {
      ...S,
      objectives: {
        ...S.objectives,
        "obj.answer-or-decline": { ...S.objectives["obj.answer-or-decline"], completeWhen: [] },
      },
    };
    const result = step(fixtureState(), fixtureState(), START, scenario);
    expect(result.activated).toContain("obj.answer-or-decline");
    expect(result.completed).not.toContain("obj.answer-or-decline");
  });

  it("does not mutate its inputs", () => {
    const prev = fixtureState();
    const next = withCall(prev, "call.alex", "ended");
    const frozenObjectives = JSON.stringify(next.objectives);
    step(prev, next, { type: "END_CALL" });
    expect(JSON.stringify(next.objectives)).toBe(frozenObjectives);
  });
});

describe("phone neutrality", () => {
  it("lists only OPEN_PHONE and CLOSE_PHONE as neutral actions", () => {
    expect([...OBJECTIVE_NEUTRAL_ACTIONS].sort()).toEqual(["CLOSE_PHONE", "OPEN_PHONE"]);
  });

  it("changes nothing on a neutral action even when a predicate would hold", () => {
    const prev = fixtureState();
    const next = withCall(prev, "call.alex", "ended");
    for (const action of [OPEN_PHONE, { type: "CLOSE_PHONE" } as CoreAction]) {
      const result = step(prev, next, action);
      expect(result.state).toBe(next);
      expect(result.activated).toEqual([]);
      expect(result.completed).toEqual([]);
    }
    expect(step(prev, next, { type: "END_CALL" }).completed).toEqual(["obj.answer-or-decline"]);
  });
});

describe("canCompleteObjective", () => {
  it("requires the objective to be active and its conditions to hold", () => {
    const active = step(fixtureState(), fixtureState()).state;
    expect(canCompleteObjective(active, "obj.answer-or-decline", S)).toBe(false);

    const closed = withCall(active, "call.alex", "ended");
    expect(canCompleteObjective(closed, "obj.answer-or-decline", S)).toBe(true);

    const notActive: ChapterState = { ...closed, objectives: { active: [], completed: [] } };
    expect(canCompleteObjective(notActive, "obj.answer-or-decline", S)).toBe(false);
  });

  it("is false for an active objective that has no definition", () => {
    const state = withEvidence(fixtureState({ objectives: { active: ["obj.review"], completed: [] } }), []);
    const scenario = { ...S, objectives: {} } as unknown as ScenarioDefinition;
    expect(canCompleteObjective(state, "obj.review", scenario)).toBe(false);
  });

  it("exposes the rejection reason", () => {
    expect(OBJECTIVE_CONDITION_NOT_MET).toBe("Objective condition not met.");
  });
});
