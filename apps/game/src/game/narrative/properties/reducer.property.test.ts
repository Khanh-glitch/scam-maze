// Feature: chapter-01-double-deception, Property 1: Reducer purity and event log shape
/**
 * Property 1 (design.md, "Correctness Properties"), with requirements 3.4, 3.5 and 10.11.
 *
 * For any seeded action sequence (valid, rejected and malformed values) dispatched against the
 * real CHAPTER_1_SCENARIO:
 * - the reducer never throws and always returns an Action_Result;
 * - a rejected action returns the SAME state object with a non-empty reason (unknown and
 *   malformed values included);
 * - an accepted action appends exactly one event, whose seq equals the previous event count,
 *   and leaves the earlier events unchanged;
 * - the input state is never mutated;
 * - the same sequence gives deep-equal states and results (also after a JSON round trip, and
 *   when only the logged actions are replayed);
 * - the chapter store matches the reducer fold and notifies once per accepted action only.
 *
 * Failures print the seed and the case index. Reproduce a case with `caseSeed(SEED, index)`.
 *
 * This file merges the former dispatch, determinism and store property tests.
 */

import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  MALFORMED_ACTIONS,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { chapterReducer, createInitialState } from "../reducer";
import { createChapterStore } from "../store";
import type { ChapterState, CoreAction } from "../types";

/** Seeded property runs of 200 cases can exceed Vitest's 5 s default. */
const PROPERTY_TIMEOUT_MS = 120_000;

const DISPATCH_SEED = (CORE_PROPERTY_SEED + 1) >>> 0;
const DETERMINISM_SEED = (CORE_PROPERTY_SEED + 3) >>> 0;
const STORE_SEED = (CORE_PROPERTY_SEED ^ 0x14) >>> 0;

/** Checks one dispatch. Returns a violation message, or null when Property 1 holds. */
function checkDispatch(state: ChapterState, action: unknown): string | null {
  const snapshot = structuredClone(state);
  const previousEvents = state.events;
  const previousCount = previousEvents.length;
  let result: ReturnType<typeof chapterReducer>;
  try {
    result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
  } catch (error) {
    return `reducer threw: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (result === null || typeof result !== "object") return "reducer returned no Action_Result";
  if (typeof result.accepted !== "boolean") return "result.accepted is not a boolean";
  if (!isDeepStrictEqual(state, snapshot)) return "the input state was mutated";
  if (!result.accepted) {
    if (result.state !== state) return "rejected, but result.state is not the input state object";
    if (typeof result.reason !== "string" || result.reason.trim() === "") {
      return "rejected without a non-empty reason";
    }
    return null;
  }
  const events = result.state.events;
  if (events.length !== previousCount + 1) {
    return `accepted, but events grew from ${previousCount} to ${events.length}`;
  }
  if (events[previousCount].seq !== previousCount) {
    return `new event has seq ${events[previousCount].seq}, expected ${previousCount}`;
  }
  if (!isDeepStrictEqual(events.slice(0, previousCount), snapshot.events)) {
    return "earlier events changed";
  }
  return null;
}

/** Replays `actions` from the initial state; returns the first violation, or null. */
function firstViolation(actions: readonly unknown[]): { step: number; message: string } | null {
  let state = createInitialState();
  for (let step = 0; step < actions.length; step += 1) {
    const message = checkDispatch(state, actions[step]);
    if (message !== null) return { step, message };
    state = chapterReducer(state, actions[step], CHAPTER_1_SCENARIO).state;
  }
  return null;
}

describe("Property 1: reducer purity and event log shape", () => {
  it("returns a result for every dispatch, rejects without change, and appends one event when accepted", () => {
    const failures: string[] = [];
    let accepted = 0;
    let rejected = 0;

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(DISPATCH_SEED, index);
      const length = randomInt(createLcg(seed ^ 0x5bd1e995), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);

      const violation = firstViolation(actions);
      if (violation !== null) {
        const shrunk = shrinkFailingPrefix(actions, (prefix) => firstViolation(prefix) !== null) ?? actions;
        failures.push(
          `case ${index} (seed ${seed}, length ${length}): step ${violation.step} ` +
            `${describeAction(actions[violation.step])}: ${violation.message}\n` +
            `  shrunk prefix (${shrunk.length}): [${shrunk.map(describeAction).join(", ")}]`,
        );
        continue;
      }
      for (const result of runSequence(actions).results) {
        if (result.accepted) accepted += 1;
        else rejected += 1;
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);

  it("rejects unknown and malformed values in any reachable state with the same state object", () => {
    const failures: string[] = [];
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(DISPATCH_SEED ^ 0x77, index);
      const next = createLcg(seed);
      const prefix = generateActionSequence(seed, randomInt(next, 0, 40));
      const state = runSequence(prefix).final;
      const value = pick(next, MALFORMED_ACTIONS);
      const message = checkDispatch(state, value);
      const result = message === null ? chapterReducer(state, value, CHAPTER_1_SCENARIO) : null;
      if (message !== null) {
        failures.push(`case ${index} (seed ${seed}): ${describeAction(value)}: ${message}`);
      } else if (result !== null && result.accepted) {
        failures.push(`case ${index} (seed ${seed}): malformed ${describeAction(value)} was accepted`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("is deterministic: the same sequence gives deep-equal states and results", () => {
    const failures: string[] = [];
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(DETERMINISM_SEED, index);
      const length = randomInt(createLcg(seed), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const label = `case ${index} (seed ${seed}, length ${length})`;

      const first = runSequence(actions);
      const second = runSequence(actions);
      if (!isDeepStrictEqual(second.states, first.states)) failures.push(`${label}: states differ between runs`);
      if (!isDeepStrictEqual(second.results, first.results)) failures.push(`${label}: results differ between runs`);

      // `undefined` becomes `null` in a JSON array; both are malformed and rejected.
      const fromJson = runSequence(JSON.parse(JSON.stringify(actions)) as unknown[]);
      if (!isDeepStrictEqual(fromJson.states, first.states)) failures.push(`${label}: JSON round trip changed states`);

      const replay = runSequence(first.final.events.map((entry) => entry.action));
      if (!isDeepStrictEqual(replay.final, first.final)) failures.push(`${label}: event log replay changed the final state`);
      if (!replay.results.every((result) => result.accepted)) failures.push(`${label}: a logged action was rejected on replay`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("store dispatch matches the reducer and notifies exactly once per accepted action", () => {
    const failures: string[] = [];
    let accepted = 0;
    let rejected = 0;

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(STORE_SEED, index);
      const next = createLcg(seed ^ 0x27d4eb2f);
      const length = randomInt(next, 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const unsubscribeAt = randomInt(next, 0, length);
      const fail = (message: string): void => {
        failures.push(`case ${index} (seed ${seed}, length ${length}): ${message}`);
      };

      const initial = createInitialState();
      const store = createChapterStore(initial, CHAPTER_1_SCENARIO);
      const expected = runSequence(actions, initial, CHAPTER_1_SCENARIO);

      let kept = 0;
      let dropped = 0;
      let neverCalled = 0;
      store.subscribe(() => {
        kept += 1;
      });
      let unsubscribeDropped: (() => void) | null = store.subscribe(() => {
        dropped += 1;
      });
      store.subscribe(() => {
        neverCalled += 1;
      })();

      let acceptedCount = 0;
      let droppedExpected = 0;
      for (let step = 0; step < actions.length; step += 1) {
        if (step === unsubscribeAt && unsubscribeDropped !== null) {
          unsubscribeDropped();
          unsubscribeDropped = null;
        }
        const before = store.getState();
        const keptBefore = kept;
        const result = store.dispatch(actions[step] as CoreAction);
        const label = `step ${step} ${describeAction(actions[step])}`;

        if (result.accepted !== expected.results[step].accepted) {
          fail(`${label}: accepted is ${result.accepted}, the reducer fold says ${expected.results[step].accepted}`);
          break;
        }
        if (result.accepted) {
          acceptedCount += 1;
          accepted += 1;
          if (unsubscribeDropped !== null) droppedExpected += 1;
          if (kept !== keptBefore + 1) fail(`${label}: accepted, but listeners ran ${kept - keptBefore} times`);
          if (store.getState() !== result.state) fail(`${label}: getState() is not the result state`);
        } else {
          rejected += 1;
          if (kept !== keptBefore) fail(`${label}: rejected, but listeners ran ${kept - keptBefore} times`);
          if (store.getState() !== before) fail(`${label}: rejected, but getState() changed object`);
        }
      }

      if (kept !== acceptedCount) fail(`kept listener ran ${kept} times for ${acceptedCount} accepted actions`);
      if (dropped !== droppedExpected) {
        fail(`unsubscribed listener ran ${dropped} times, expected ${droppedExpected}`);
      }
      if (neverCalled !== 0) fail(`listener unsubscribed before any dispatch ran ${neverCalled} times`);
      if (!isDeepStrictEqual(store.getState(), expected.final)) fail("store state differs from the reducer fold");

      const keptBeforeReplace = kept;
      const replacement = createInitialState();
      store.replace(replacement);
      if (kept !== keptBeforeReplace + 1) fail(`replace notified ${kept - keptBeforeReplace} times`);
      if (neverCalled !== 0) fail("replace called a listener unsubscribed before any dispatch");
      if (store.getState() !== replacement) fail("getState() after replace is not the replacement state");
    }

    expect(failures, failures.join("\n")).toEqual([]);
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});
