// Feature: chapter-01-voice-narrative, Property 1: Act progression is monotonic
// Feature: chapter-01-double-deception, acts advance only by their exit conditions (Requirements 4.1, 8.3)
import { describe, expect, it } from "vitest";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { evaluateConditions } from "../conditions";
import { selectCurrentAct } from "../selectors";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const ACTS = CHAPTER_1_SCENARIO.acts;
const actIndex = (id: string): number => ACTS.findIndex((act) => act.id === id);

/**
 * Replays `actions` and checks that the act index never decreases, that moving from act i to a
 * later act needs the exit condition of act i, and that staying in act i means its exit
 * condition does not hold. Returns the first problem or `null`.
 */
function firstProblem(actions: readonly unknown[]): string | null {
  const { states, results } = runSequence(actions);
  let previous = actIndex(selectCurrentAct(states[0]).id);
  for (let i = 0; i < results.length; i += 1) {
    const state = states[i + 1];
    const current = actIndex(selectCurrentAct(state).id);
    if (!results[i].accepted) {
      if (current !== previous) return `after rejected action ${i}: act index changed ${previous} to ${current}`;
      continue;
    }
    if (current < previous) return `after action ${i}: act index went from ${previous} to ${current}`;
    // Acts can be skipped (for example the third caller rings before the notification is handled),
    // so only the next act needs the exit condition; a later act needs its own enter condition.
    if (current === previous + 1 && !evaluateConditions(ACTS[previous].exitWhen, state, CHAPTER_1_SCENARIO)) {
      return `after action ${i}: left ${ACTS[previous].id} without its exit condition`;
    }
    if (current > previous && !evaluateConditions(ACTS[current].enterWhen, state, CHAPTER_1_SCENARIO)) {
      return `after action ${i}: entered ${ACTS[current].id} without its enter condition`;
    }
    if (current === previous && current < ACTS.length - 1) {
      if (evaluateConditions(ACTS[current].exitWhen, state, CHAPTER_1_SCENARIO)) {
        return `after action ${i}: exit condition of ${ACTS[current].id} holds but the act did not advance`;
      }
    }
    previous = current;
  }
  return null;
}

describe("act progression properties", () => {
  it("each act's exit condition equals the next act's enter condition", () => {
    for (let i = 0; i < ACTS.length - 1; i += 1) {
      expect(JSON.stringify(ACTS[i].exitWhen), `${ACTS[i].id} exit vs ${ACTS[i + 1].id} enter`).toBe(
        JSON.stringify(ACTS[i + 1].enterWhen),
      );
    }
  });

  // Feature: chapter-01-voice-narrative, Property 1: Act progression is monotonic
  it("never moves to an earlier act and advances only by the exit condition", () => {
    // **Validates: Requirements 4.1, 8.3**
    for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
      const seed = caseSeed(CORE_PROPERTY_SEED, run);
      const length = randomInt(createLcg(seed ^ 0x5f3759df), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const problem = firstProblem(actions);
      if (problem === null) continue;

      const prefix = shrinkFailingPrefix(actions, (candidate) => firstProblem(candidate) !== null) ?? actions;
      const report = [
        `Act progression violated (case ${run}, seed ${seed}, length ${length}).`,
        `Shortest failing prefix (${prefix.length} actions):`,
        ...prefix.map((action, i) => `  ${i}: ${describeAction(action)}`),
        `Problem: ${firstProblem(prefix) ?? problem}`,
      ].join("\n");
      expect.fail(report);
    }
  }, PROPERTY_TIMEOUT_MS);
});
