// Feature: chapter-01-double-deception, Property 5: Harm requires an explicit player choice
//
// A harm flag (`code_shared`, `second_caller_trusted`, `money_moved`) becomes set only by an
// accepted action that is an explicit harmful dialogue option or a harmful decision. Both sets are
// derived from the real CHAPTER_1_SCENARIO data (effects that set a harm flag), not hard-coded.
// The careful policy never sets a harm flag and always finishes the chapter in ending C or D.
// Hanging up, declining and refusing never set harm.
// Validates: Requirements 4.2, 5.8, 9.6, 12.2

import { describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  HARM_FLAGS,
  carefulPolicy,
  caseSeed,
  describeAction,
  generateActionSequence,
  harmfulOptionPolicy,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import type { FlagId } from "../chapter1/ids";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction, Effect } from "../types";

/** Seed offset so this file's sequences differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x0005) >>> 0;

/** Explicit timeout: 200 random walks plus policy runs can be slow on a loaded machine. */
const PROPERTY_TIMEOUT_MS = 120_000;

const scenario = CHAPTER_1_SCENARIO;

function harmFlagsIn(effects: readonly Effect[] | undefined): FlagId[] {
  const found: FlagId[] = [];
  for (const effect of effects ?? []) {
    if (effect.kind === "setFlag" && HARM_FLAGS.includes(effect.flag)) found.push(effect.flag);
  }
  return found;
}

// --- Harm sources derived from scenario data -------------------------------

/** Option ID -> harm flags it sets. */
const harmfulOptions = new Map<string, FlagId[]>();
/** Option IDs that end a call by hanging up (`next: { end: "hang-up" }`). */
const hangUpOptionIds = new Set<string>();
/** Places other than options and decisions that set a harm flag (must stay empty). */
const otherHarmSources: string[] = [];

for (const graph of Object.values(scenario.dialogues)) {
  for (const node of Object.values(graph.nodes)) {
    if (harmFlagsIn(node.onEnter).length > 0) otherHarmSources.push(`node ${graph.id}/${node.id} onEnter`);
    for (const opt of node.options) {
      const flags = harmFlagsIn(opt.effects);
      if (flags.length > 0) harmfulOptions.set(opt.id, flags);
      if (typeof opt.next === "object") hangUpOptionIds.add(opt.id);
    }
  }
}

/** Decision ID -> harm flags it sets. */
const harmfulDecisions = new Map<string, FlagId[]>();
for (const decision of Object.values(scenario.decisions)) {
  const flags = harmFlagsIn(decision.effects);
  if (flags.length > 0) harmfulDecisions.set(decision.id, flags);
}
for (const device of Object.values(scenario.deviceActions)) {
  if (harmFlagsIn(device.effects).length > 0) otherHarmSources.push(`device action ${device.id}`);
}
for (const deduction of Object.values(scenario.deductions)) {
  if (harmFlagsIn(deduction.effects).length > 0) otherHarmSources.push(`deduction ${deduction.id}`);
}
scenario.beats.forEach((beat) => {
  if (harmFlagsIn(beat.effects).length > 0) otherHarmSources.push(`beat ${beat.id}`);
});

/** Harm flags newly set by one accepted step. */
function newHarm(before: ChapterState, after: ChapterState): FlagId[] {
  return HARM_FLAGS.filter((flag) => after.flags[flag] && !before.flags[flag]);
}

/**
 * Returns a problem when this accepted step sets harm without being an explicit harmful option or
 * decision that is authored to set exactly those flags; otherwise null.
 */
function stepProblem(action: unknown, before: ChapterState, after: ChapterState): string | null {
  const flags = newHarm(before, after);
  if (flags.length === 0) return null;
  const typed = action as CoreAction;
  let authored: FlagId[] | undefined;
  if (typed.type === "SELECT_DIALOGUE_OPTION") authored = harmfulOptions.get(typed.optionId);
  else if (typed.type === "MAKE_DECISION") authored = harmfulDecisions.get(typed.decision);
  if (authored === undefined) return `${flags.join(", ")} set by ${describeAction(action)}, which is not a harmful option or decision`;
  const unexpected = flags.filter((flag) => !authored.includes(flag));
  return unexpected.length > 0 ? `${unexpected.join(", ")} set by ${describeAction(action)} but not authored on it` : null;
}

/** True when the action is a hang up, decline or refusal. */
function isSafeExit(action: unknown): boolean {
  const typed = action as CoreAction;
  if (typed.type === "END_CALL") return true;
  if (typed.type === "SELECT_DIALOGUE_OPTION") return hangUpOptionIds.has(typed.optionId);
  return typed.type === "MAKE_DECISION" && (typed.decision === "refuse-and-stop" || typed.decision === "verify-independently");
}

describe("Property 5: Harm requires an explicit player choice", () => {
  it("derives the harmful options and decisions from the scenario data", () => {
    expect([...harmfulOptions.keys()]).toEqual(
      expect.arrayContaining(["alex.share-code", "rec.trust"]),
    );
    expect([...harmfulDecisions.keys()].sort()).toEqual(["follow-both", "follow-recovery"]);
    expect(otherHarmSources).toEqual([]);
    for (const flag of HARM_FLAGS) {
      const setters = [...harmfulOptions.values(), ...harmfulDecisions.values()].filter((flags) => flags.includes(flag));
      expect(setters.length, `a harmful source for ${flag}`).toBeGreaterThan(0);
    }
    // A hang-up option never carries a harm effect.
    for (const id of hangUpOptionIds) expect(harmfulOptions.has(id), id).toBe(false);
    // The real scenario is not mutated by this file (nothing here writes to it).
  });

  it("sets a harm flag only through an explicit harmful option or decision in random walks", () => {
    const failures: string[] = [];
    let harmSeen = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const length = randomInt(createLcg(seed ^ 0x5a5a5a5a), 0, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const run = runSequence(actions);
      run.results.forEach((result, step) => {
        const before = run.states[step];
        const after = run.states[step + 1];
        if (!result.accepted) {
          if (newHarm(before, after).length > 0 || after !== before) {
            failures.push(`seed ${seed}, case ${index}, step ${step}: rejected action changed state`);
          }
          return;
        }
        const harm = newHarm(before, after);
        if (harm.length > 0) harmSeen += 1;
        const problem = stepProblem(actions[step], before, after);
        if (problem !== null) failures.push(`seed ${seed}, case ${index}, step ${step}: ${problem}`);
        if (isSafeExit(actions[step]) && harm.length > 0) {
          failures.push(`seed ${seed}, case ${index}, step ${step}: ${describeAction(actions[step])} set harm`);
        }
        // Harm flags never turn off.
        for (const flag of HARM_FLAGS) {
          if (before.flags[flag] && !after.flags[flag]) failures.push(`seed ${seed}, case ${index}, step ${step}: ${flag} cleared`);
        }
        // The event log records the new harm flags only on the explicit action.
        const logged = after.events[after.events.length - 1].derived.flags.filter((flag) => HARM_FLAGS.includes(flag));
        if (logged.some((flag) => !harm.includes(flag))) {
          failures.push(`seed ${seed}, case ${index}, step ${step}: event log lists harm flag that was not newly set`);
        }
      });
      // Final state: every set harm flag has an accepted explicit action in the log.
      const accepted = run.final.events.map((entry) => entry.action);
      for (const flag of HARM_FLAGS) {
        if (!run.final.flags[flag]) continue;
        const explained = accepted.some((action) =>
          action.type === "SELECT_DIALOGUE_OPTION"
            ? harmfulOptions.get(action.optionId)?.includes(flag) === true
            : action.type === "MAKE_DECISION" && harmfulDecisions.get(action.decision)?.includes(flag) === true,
        );
        if (!explained) failures.push(`seed ${seed}, case ${index}: ${flag} set without an explicit harmful action in the log`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
    // Sanity: the walks did reach some harm, so the check is not vacuous.
    expect(harmSeen).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);

  it("never sets harm in the careful policy, which always completes with ending C or D", () => {
    const failures: string[] = [];
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED ^ 0x1111, index);
      try {
        const completion = carefulPolicy(seed);
        const { actions, final } = completion;
        let state = createInitialState(scenario);
        for (const action of actions) {
          const result = chapterReducer(state, action, scenario);
          if (!result.accepted) failures.push(`seed ${seed}, case ${index}: ${describeAction(action)} rejected: ${result.reason ?? ""}`);
          if (newHarm(state, result.state).length > 0) failures.push(`seed ${seed}, case ${index}: harm after ${describeAction(action)}`);
          state = result.state;
        }
        for (const flag of HARM_FLAGS) {
          if (final.flags[flag]) failures.push(`seed ${seed}, case ${index}: ${flag} is set`);
        }
        if (final.status !== "finished") failures.push(`seed ${seed}, case ${index}: status ${final.status}`);
        if (final.outcome !== "break-the-chain" && final.outcome !== "unfinished-case") {
          failures.push(`seed ${seed}, case ${index}: outcome ${String(final.outcome)} is not C or D`);
        }
        if (final.decision === "follow-recovery" || final.decision === "follow-both") {
          failures.push(`seed ${seed}, case ${index}: harmful decision ${final.decision}`);
        }
      } catch (error) {
        failures.push(`seed ${seed}, case ${index}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("explains every harm flag in the harmful-option policy by an explicit harmful choice", () => {
    const failures: string[] = [];
    let harmSeen = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED ^ 0x2222, index);
      try {
        const { actions } = harmfulOptionPolicy(seed);
        let state = createInitialState(scenario);
        actions.forEach((action, step) => {
          const result = chapterReducer(state, action, scenario);
          if (newHarm(state, result.state).length > 0) harmSeen += 1;
          const problem = stepProblem(action, state, result.state);
          if (problem !== null) failures.push(`seed ${seed}, case ${index}, step ${step}: ${problem}`);
          state = result.state;
        });
      } catch (error) {
        failures.push(`seed ${seed}, case ${index}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
    expect(harmSeen).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});
