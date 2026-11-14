// Tests of the Chapter 1 harness (task 7.4 of spec chapter-01-double-deception): each guided
// policy reaches its intended ending and variant, the careful policy never reaches A or B, and
// the generators cover all 16 Core_Action kinds.

import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "../game/narrative/chapter1/scenario";
import { createInitialState } from "../game/narrative/reducer";
import { selectConsequenceVariant } from "../game/narrative/outcome";
import type { CoreActionType } from "../game/narrative/types";
import {
  assertInvariants,
  carefulPolicy,
  caseSeed,
  CORE_PROPERTY_SEED,
  generateActionSequence,
  HARM_FLAGS,
  harmfulOptionPolicy,
  MALFORMED_ACTIONS,
  reachEndingA,
  reachEndingB,
  reachEndingC,
  reachEndingD,
  runSequence,
  completeChapterFrom,
  type GuidedCompletion,
} from "./chapterRuns";

const variantOf = (run: GuidedCompletion): string | undefined =>
  selectConsequenceVariant(run.outcomeState, CHAPTER_1_SCENARIO)?.id;

/** Every state of a guided run satisfies the invariants. */
function expectValidRun(run: GuidedCompletion): void {
  const states = runSequence(run.actions).states;
  for (const state of states) expect(assertInvariants(state)).toEqual([]);
  expect(run.final.status).toBe("finished");
  expect(run.outcomeState.outcome).toBe(run.final.outcome);
}

describe("guided policies", () => {
  it("reachEndingA reaches false-victory without the code", () => {
    const run = reachEndingA();
    expect(run.final.outcome).toBe("false-victory");
    expect(variantOf(run)).toBe("after-rejecting-alex");
    expect(run.final.flags).toMatchObject({ code_shared: false, second_caller_trusted: true, money_moved: true });
    expectValidRun(run);
  });

  it("reachEndingB reaches perfect-chain after both harmful choices", () => {
    const run = reachEndingB();
    expect(run.final.outcome).toBe("perfect-chain");
    expect(variantOf(run)).toBe("default");
    expect(run.final.flags).toMatchObject({ code_shared: true, second_caller_trusted: true, money_moved: true });
    expectValidRun(run);
  });

  it("reachEndingC reaches break-the-chain with the default variant and no deductions", () => {
    const run = reachEndingC();
    expect(run.final.outcome).toBe("break-the-chain");
    expect(variantOf(run)).toBe("default");
    expect(run.final.deductions).toEqual([]);
    expect(run.final.flags.official_channel_verified).toBe(true);
    for (const flag of HARM_FLAGS) expect(run.final.flags[flag], flag).toBe(false);
    expectValidRun(run);
  });

  it("reachEndingC with caseReport reaches the secret case-report variant", () => {
    const run = reachEndingC({ caseReport: true });
    expect(run.final.outcome).toBe("break-the-chain");
    expect(variantOf(run)).toBe("case-report");
    expect(run.final.deductions).toEqual(["ded.same-source", "ded.third-caller-not-independent"]);
    for (const flag of HARM_FLAGS) expect(run.final.flags[flag], flag).toBe(false);
    expectValidRun(run);
  });

  it("reachEndingD reaches unfinished-case, with and without the built evidence", () => {
    const plain = reachEndingD();
    expect(plain.final.outcome).toBe("unfinished-case");
    expect(variantOf(plain)).toBe("default");
    expectValidRun(plain);

    const built = reachEndingD({ evidenceBuilt: true });
    expect(built.final.outcome).toBe("unfinished-case");
    expect(variantOf(built)).toBe("evidence-built");
    expectValidRun(built);
  });

  it("replays to the same final state", () => {
    const run = reachEndingC({ caseReport: true });
    expect(runSequence(run.actions).final).toEqual(run.final);
  });
});

describe("careful policy", () => {
  const SEEDS = 120;

  it("never sets a harm flag and never reaches ending A or B", () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < SEEDS; i += 1) {
      const seed = caseSeed(CORE_PROPERTY_SEED, i);
      const run = carefulPolicy(seed);
      const label = `seed ${seed}`;
      for (const state of runSequence(run.actions).states) {
        for (const flag of HARM_FLAGS) expect(state.flags[flag], `${label} ${flag}`).toBe(false);
      }
      expect(run.final.status, label).toBe("finished");
      expect(["break-the-chain", "unfinished-case"], label).toContain(run.final.outcome);
      expect(assertInvariants(run.final), label).toEqual([]);
      outcomes.add(String(run.final.outcome));
    }
    expect(outcomes.has("unfinished-case")).toBe(true);
  });

  it("is deterministic for a seed", () => {
    expect(carefulPolicy(42).actions).toEqual(carefulPolicy(42).actions);
  });
});

describe("harmful-option policy", () => {
  it("finishes the chapter and sets a harm flag in most runs", () => {
    let harmed = 0;
    const runs = 60;
    for (let i = 0; i < runs; i += 1) {
      const seed = caseSeed(CORE_PROPERTY_SEED ^ 0x55, i);
      const run = harmfulOptionPolicy(seed);
      expect(run.final.status, `seed ${seed}`).toBe("finished");
      expect(assertInvariants(run.final), `seed ${seed}`).toEqual([]);
      if (HARM_FLAGS.some((flag) => run.final.flags[flag])) harmed += 1;
    }
    expect(harmed).toBeGreaterThan(runs / 2);
  });
});

describe("completeChapterFrom", () => {
  it("finishes the chapter from the initial state and from a finished state", () => {
    const run = completeChapterFrom(createInitialState());
    expect(run.final.status).toBe("finished");
    expect(run.final.outcome).toBe("unfinished-case");
    expect(completeChapterFrom(run.final).actions).toEqual([]);
  });
});

describe("action generators", () => {
  const ALL_KINDS: readonly CoreActionType[] = [
    "START_CHAPTER",
    "INTERACT_OBJECT",
    "INSPECT_EVIDENCE",
    "OPEN_PHONE",
    "CLOSE_PHONE",
    "RING_CALL",
    "ANSWER_CALL",
    "END_CALL",
    "TALK_TO_NPC",
    "SELECT_DIALOGUE_OPTION",
    "VERIFY_CLAIM",
    "MAKE_DECISION",
    "COMPLETE_OBJECTIVE",
    "FINISH_CHAPTER",
    "DEVICE_ACTION",
    "COMBINE_EVIDENCE",
  ];

  it("generates all 16 action kinds across seeds", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      for (const action of generateActionSequence(caseSeed(CORE_PROPERTY_SEED, i), 80)) {
        if (typeof action === "object" && action !== null && "type" in action && typeof action.type === "string") {
          seen.add(action.type);
        }
      }
    }
    for (const kind of ALL_KINDS) expect(seen.has(kind), kind).toBe(true);
  });

  it("is deterministic for a seed and keeps every reached state valid", () => {
    const first = generateActionSequence(7, 80);
    expect(generateActionSequence(7, 80)).toEqual(first);
    for (const state of runSequence(first).states) expect(assertInvariants(state)).toEqual([]);
  });

  it("rejects every malformed value without changing the state", () => {
    let state = runSequence([{ type: "START_CHAPTER" }]).final;
    for (const value of MALFORMED_ACTIONS) {
      const [result] = runSequence([value], state).results;
      expect(result.accepted, JSON.stringify(value)).toBe(false);
      expect(result.state).toBe(state);
      expect(result.reason).toBeTruthy();
    }
    state = createInitialState();
    expect(assertInvariants(state)).toEqual([]);
  });
});
