// Tests for the reachability solver on the fixture scenario (`src/test/fixtureScenario.ts`).
// Feature: chapter-01-double-deception, Property 13: No soft lock (analyzer part).
// Validates: Requirements 3.7, 5.7, 9.8, 11.3, 12.2.
//
// The fixture is small (about 500 states), so the full solver runs once per file in `beforeAll`.
// Shipped Chapter 1 data is analyzed in `chapter1/scenario.test.ts` (all endings, no unreachable
// node or option, no soft lock; about 46 s), not here. Real-scenario random walks are in
// `properties/noSoftLock.property.test.ts`.
// The seeded tests walk the real reducer on the fixture and do not call the solver again.

import { beforeAll, describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO } from "../../test/fixtureScenario";
import { createLcg, pick } from "../../test/seededRandom";
import { availableOptions } from "./dialogueEngine";
import { ENGINE_READ_FLAGS, analyzeReachability, relevantFlags, type ReachabilityReport } from "./reachability";
import { chapterReducer, createInitialState } from "./reducer";
import { enumerateCandidateActions } from "./selectors";
import type { ChapterState, ScenarioDefinition } from "./types";

const SEED = 0x7a3e51;
const WALKS = 200;
const WALK_LENGTH = 60;
const SOLVER_TIMEOUT_MS = 60_000;

function cloneScenario(): ScenarioDefinition {
  return JSON.parse(JSON.stringify(FIXTURE_SCENARIO)) as ScenarioDefinition;
}

let report: ReachabilityReport;

beforeAll(() => {
  report = analyzeReachability(FIXTURE_SCENARIO);
}, SOLVER_TIMEOUT_MS);

describe("analyzeReachability on the fixture scenario", () => {
  it("finishes within the state budget", () => {
    expect(report.truncated).toBe(false);
    expect(report.states).toBeGreaterThan(0);
  });

  it("reaches all four endings", () => {
    expect(report.outcomesReached).toEqual(["break-the-chain", "false-victory", "perfect-chain", "unfinished-case"]);
    expect(report.unreachableOutcomes).toEqual([]);
  });

  it("has no unreachable dialogue node and no unreachable option", () => {
    expect(report.unreachableNodes).toEqual([]);
    expect(report.unreachableOptions).toEqual([]);
  });

  it("has no soft lock", () => {
    expect(report.softLocks).toEqual([]);
  });

  it("keeps the available option count between one and four", () => {
    expect(report.maxAvailableOptions).toBeLessThanOrEqual(4);
    expect(report.minAvailableOptions).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic", () => {
    expect(analyzeReachability(FIXTURE_SCENARIO)).toEqual(report);
  });
});

describe("analyzeReachability reports faults", () => {
  it("reports a node that no state reaches", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.orphan"] = {
      ...s.dialogues["dlg.alex"].nodes["alex.refused"],
      id: "alex.orphan",
    };
    const faulty = analyzeReachability(s);
    expect(faulty.unreachableNodes).toEqual(["alex.orphan"]);
  });

  it("reports an option whose conditions can never hold", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].options[1].conditions = [{ kind: "flag", flag: "bank_app_opened" }];
    const faulty = analyzeReachability(s);
    expect(faulty.unreachableOptions).toContain("alex.refuse");
  });

  it("reports an ending that no state selects", () => {
    const s = cloneScenario();
    s.endings["perfect-chain"].selectWhen = [...s.endings["perfect-chain"].selectWhen, { kind: "flag", flag: "bank_app_opened" }];
    const faulty = analyzeReachability(s);
    expect(faulty.unreachableOutcomes).toEqual(["perfect-chain"]);
    expect(faulty.outcomesReached).not.toContain("perfect-chain");
  });

  it("reports soft locks when no decision can ever be made", () => {
    const s = cloneScenario();
    for (const decision of Object.values(s.decisions)) decision.requires = [{ kind: "flag", flag: "bank_app_opened" }];
    const faulty = analyzeReachability(s);
    expect(faulty.outcomesReached).toEqual([]);
    expect(faulty.unreachableOutcomes).toHaveLength(4);
    expect(faulty.softLocks.length).toBeGreaterThan(0);
  });

  it("reports a truncated run when the state budget is too small", () => {
    const small = analyzeReachability(FIXTURE_SCENARIO, { maxStates: 5 });
    expect(small.truncated).toBe(true);
    expect(small.states).toBe(5);
    expect(small.softLocks).toEqual([]);
  });

  it("needs the device action, the combinations and the saved contact for the perfect chain", () => {
    // Without the device action that reveals the notification origin, the mismatch deduction
    // cannot be recorded, so the perfect chain is no longer reachable.
    const s = cloneScenario();
    s.deviceActions["dev.inspect-notification-origin"].requires = [{ kind: "flag", flag: "bank_app_opened" }];
    expect(analyzeReachability(s).outcomesReached).not.toContain("perfect-chain");
    // Without the saved contact evidence the official line is never called, so no official confirmation exists.
    const t = cloneScenario();
    t.evidence["ev.official-contact-paper"].discovery = {
      via: "inspect",
      requires: [{ kind: "flag", flag: "bank_app_opened" }],
    };
    expect(analyzeReachability(t).outcomesReached).not.toContain("perfect-chain");
    // The unmodified fixture reaches it, so the two cases above differ only by that data.
    expect(report.outcomesReached).toContain("perfect-chain");
  });
});

describe("relevantFlags", () => {
  it("lists the engine-read flags and every flag a Condition names, sorted", () => {
    const flags = relevantFlags(FIXTURE_SCENARIO);
    for (const flag of ENGINE_READ_FLAGS) expect(flags).toContain(flag);
    for (const flag of ["notification_handled", "notification_delivered", "review_security_opened", "official_channel_verified"]) {
      expect(flags).toContain(flag);
    }
    expect(flags).toEqual([...flags].sort());
  });

  it("leaves out a flag that only presentation reads", () => {
    expect(relevantFlags(FIXTURE_SCENARIO)).not.toContain("shared_origin_established");
  });

  it("includes a flag that a new Condition names", () => {
    const s = cloneScenario();
    s.beats[0].when = [...s.beats[0].when, { kind: "notFlag", flag: "shared_origin_established" }];
    expect(relevantFlags(s)).toContain("shared_origin_established");
  });
});

// ---------------------------------------------------------------------------
// Seeded random walks over the fixture, using the real reducer
// ---------------------------------------------------------------------------

/** Every state of one seeded walk through the candidate actions, including the initial state. */
function walk(index: number): ChapterState[] {
  const next = createLcg((SEED + Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  let state = createInitialState(FIXTURE_SCENARIO);
  const states = [state];
  for (let step = 0; step < WALK_LENGTH; step += 1) {
    const candidates = enumerateCandidateActions(state, FIXTURE_SCENARIO);
    if (candidates.length === 0) break;
    state = chapterReducer(state, pick(next, candidates), FIXTURE_SCENARIO).state;
    states.push(state);
  }
  return states;
}

describe("seeded random reachable states", () => {
  // Feature: chapter-01-double-deception, Property 13: No soft lock
  it("accepts END_CALL with a live call, in every state of every walk", () => {
    let liveCallStates = 0;
    for (let index = 0; index < WALKS; index += 1) {
      walk(index).forEach((state, position) => {
        if (state.call.current === null) return;
        liveCallStates += 1;
        const result = chapterReducer(state, { type: "END_CALL" }, FIXTURE_SCENARIO);
        expect(result.accepted, `END_CALL rejected: seed ${SEED}, walk ${index}, state ${position}`).toBe(true);
      });
    }
    expect(liveCallStates).toBeGreaterThan(0);
  });

  it("offers a way forward in every state of every walk that has no outcome", () => {
    let playing = 0;
    for (let index = 0; index < WALKS; index += 1) {
      walk(index).forEach((state, position) => {
        if (state.outcome !== null) return;
        playing += 1;
        const accepted = enumerateCandidateActions(state, FIXTURE_SCENARIO).some(
          (action) => chapterReducer(state, action, FIXTURE_SCENARIO).accepted,
        );
        expect(accepted, `no accepted action: seed ${SEED}, walk ${index}, state ${position}`).toBe(true);
      });
    }
    expect(playing).toBeGreaterThan(0);
  });

  // Feature: chapter-01-double-deception, Property 13: available options stay within bounds
  it("keeps option counts at most four, and at least one at a non-end node", () => {
    let conversationStates = 0;
    for (let index = 0; index < WALKS; index += 1) {
      walk(index).forEach((state, position) => {
        if (state.conversation === null) return;
        const node = FIXTURE_SCENARIO.dialogues[state.conversation.graphId].nodes[state.conversation.nodeId];
        const views = availableOptions(state, FIXTURE_SCENARIO).filter((view) => !view.fallback);
        conversationStates += 1;
        expect(views.length, `seed ${SEED}, walk ${index}, state ${position}`).toBeLessThanOrEqual(4);
        if (node.options.length > 0) expect(views.length).toBeGreaterThanOrEqual(1);
      });
    }
    expect(conversationStates).toBeGreaterThan(0);
  });
});
