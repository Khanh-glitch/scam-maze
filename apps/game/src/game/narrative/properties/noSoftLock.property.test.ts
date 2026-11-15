// Feature: chapter-01-double-deception, Property 13: No soft lock
// Validates: Requirements 3.7, 5.7, 9.8, 11.3, 12.2.
//
// From every state reached by a seeded random walk over the real CHAPTER_1_SCENARIO, a sequence of
// non-harmful actions (the guided policy `completeChapterFrom`) reaches a finished state with an
// outcome, and never sets a harm flag on the way. The walks also start after declining Alex,
// after dismissing the notification, and after hanging up on the third caller. While the status
// is "playing", at least one candidate action is accepted.
//
// The exhaustive solver run on the real scenario (about 46 s) lives in
// `chapter1/scenario.test.ts`; it is not repeated here. Fixture-level analyzer tests live in
// `../reachability.test.ts`.
//
// Reproduce a failure with the seed and case index in the message (`caseSeed(SEED, index)`).

import { describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  GUIDED_POLICY_MAX_STEPS,
  caseSeed,
  completeChapterFrom,
  describeAction,
  generateActionSequence,
  runSequence,
  setsHarm,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { chapterReducer, createInitialState } from "../reducer";
import { enumerateCandidateActions } from "../selectors";
import type { ChapterState, CoreAction } from "../types";

/** Seed offset so this file's sequences differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x000d) >>> 0;

/** Heavy property: allow 120 s per test on a loaded machine. */
const PROPERTY_TIMEOUT_MS = 120_000;

const WALK_MAX_LENGTH = 40;

const START: CoreAction = { type: "START_CHAPTER" };
const ring = (callId: "call.alex" | "call.recovery", reason: "first-interaction" | "follow-up"): CoreAction => ({
  type: "RING_CALL",
  callId,
  reason,
});

const DECLINE_ALEX_PREFIX: readonly CoreAction[] = [START, ring("call.alex", "first-interaction"), { type: "END_CALL" }];
const DISMISS_PREFIX: readonly CoreAction[] = [
  ...DECLINE_ALEX_PREFIX,
  { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" },
];
const HANG_UP_THIRD_PREFIX: readonly CoreAction[] = [
  ...DISMISS_PREFIX,
  ring("call.recovery", "follow-up"),
  { type: "ANSWER_CALL" },
  { type: "END_CALL" },
];

/** Applies `prefix` from the initial state; throws when an action is rejected. */
function applyPrefix(prefix: readonly CoreAction[]): ChapterState {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  for (const [index, action] of prefix.entries()) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    if (!result.accepted) {
      throw new Error(`Prefix step ${index} ${describeAction(action)} rejected: ${result.reason ?? ""}`);
    }
    state = result.state;
  }
  return state;
}

/** Returns a failure message when non-harmful actions cannot finish the chapter from `start`. */
function softLockProblem(start: ChapterState): string | null {
  let completion;
  try {
    completion = completeChapterFrom(start, GUIDED_POLICY_MAX_STEPS, CHAPTER_1_SCENARIO);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const { actions, outcomeState, final } = completion;
  if (final.status !== "finished") return `final status is ${final.status}`;
  if (final.outcome === null || outcomeState.outcome === null) return "no outcome after completion";
  if (actions.length > GUIDED_POLICY_MAX_STEPS) return `used ${actions.length} actions`;
  if (start.status !== "finished" && actions.at(-1)?.type !== "FINISH_CHAPTER") {
    return `last action is ${describeAction(actions.at(-1))}, not FINISH_CHAPTER`;
  }
  // Replay independently: every action is accepted and none sets a harm flag.
  let state = start;
  for (const [index, action] of actions.entries()) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    if (!result.accepted) return `step ${index} ${describeAction(action)} rejected: ${result.reason ?? ""}`;
    if (setsHarm(state, result.state)) return `step ${index} ${describeAction(action)} sets a harm flag`;
    state = result.state;
  }
  return null;
}

/** Returns a message when a playing state has no accepted candidate action. */
function noWayForwardProblem(state: ChapterState): string | null {
  if (state.status !== "playing") return null;
  const accepted = enumerateCandidateActions(state, CHAPTER_1_SCENARIO).some(
    (action) => chapterReducer(state, action, CHAPTER_1_SCENARIO).accepted,
  );
  return accepted ? null : "playing state has no accepted candidate action";
}

/** States to check from one run: the first, the middle, the final, and every fifth state. */
function sampledStates(states: readonly ChapterState[]): ChapterState[] {
  const picked = new Set<number>([0, Math.floor(states.length / 2), states.length - 1]);
  for (let i = 0; i < states.length; i += 5) picked.add(i);
  return [...picked].sort((a, b) => a - b).map((i) => states[i]);
}

/**
 * Runs `RUNS` seeded cases. Each case walks `actions` from `initial` and checks every sampled
 * state with `softLockProblem`, and every state with `noWayForwardProblem`.
 */
function collectFailures(label: string, seedBase: number, prefix: readonly CoreAction[]): string[] {
  const initial = applyPrefix(prefix);
  const failures: string[] = [];
  for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
    const seed = caseSeed(seedBase, index);
    const length = randomInt(createLcg(seed ^ 0x5a5a5a5a), 0, WALK_MAX_LENGTH);
    const actions = generateActionSequence(seed, length, initial, CHAPTER_1_SCENARIO);
    const run = runSequence(actions, initial, CHAPTER_1_SCENARIO);
    const problem = (state: ChapterState): string | null => softLockProblem(state) ?? noWayForwardProblem(state);

    let found: string | null = null;
    for (const state of run.states) {
      found = noWayForwardProblem(state);
      if (found !== null) break;
    }
    if (found === null) {
      for (const state of sampledStates(run.states)) {
        found = softLockProblem(state);
        if (found !== null) break;
      }
    }
    if (found !== null) {
      const shortest = shrinkFailingPrefix(actions, (p) => problem(runSequence(p, initial, CHAPTER_1_SCENARIO).final) !== null);
      failures.push(
        `${label} (seed ${seed}, case ${index}): ${found}. Shortest failing prefix after [${prefix
          .map(describeAction)
          .join(", ")}]: ${(shortest ?? actions).map(describeAction).join(", ")}`,
      );
    }
  }
  return failures;
}

describe("Property 13: No soft lock", () => {
  it("completes the chapter without harm from every state of random walks from the start", () => {
    const failures = collectFailures("random walk", SEED, []);
    expect(failures, `base seed ${SEED}\n${failures.slice(0, 3).join("\n")}`).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("never soft-locks after declining Alex", () => {
    const failures = collectFailures("declined Alex", (SEED ^ 0x1111) >>> 0, DECLINE_ALEX_PREFIX);
    expect(failures, `base seed ${(SEED ^ 0x1111) >>> 0}\n${failures.slice(0, 3).join("\n")}`).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("never soft-locks after dismissing the notification", () => {
    const failures = collectFailures("dismissed notification", (SEED ^ 0x2222) >>> 0, DISMISS_PREFIX);
    expect(failures, `base seed ${(SEED ^ 0x2222) >>> 0}\n${failures.slice(0, 3).join("\n")}`).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("never soft-locks after hanging up on the third caller", () => {
    const failures = collectFailures("hung up on third caller", (SEED ^ 0x3333) >>> 0, HANG_UP_THIRD_PREFIX);
    expect(failures, `base seed ${(SEED ^ 0x3333) >>> 0}\n${failures.slice(0, 3).join("\n")}`).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("finishes from the initial state and from each scripted prefix", () => {
    for (const [label, prefix] of [
      ["initial", []],
      ["declined Alex", DECLINE_ALEX_PREFIX],
      ["dismissed notification", DISMISS_PREFIX],
      ["hung up on third caller", HANG_UP_THIRD_PREFIX],
    ] as const) {
      expect(softLockProblem(applyPrefix(prefix)), label).toBeNull();
    }
  }, PROPERTY_TIMEOUT_MS);
});
