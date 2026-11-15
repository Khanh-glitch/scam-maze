// Feature: chapter-01-double-deception, Property 7: Combination idempotence and order independence
// Validates: Requirements 8.6, 8.7
import { describe, expect, it } from "vitest";
import {
  ALEX_SHARES_CODE,
  CALL_SAVED_CONTACT,
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  DECLINE_ALEX,
  EXPOSE_THIRD_CALL,
  FOLLOW_THE_NOTIFICATION,
  LINK_FIRST_TWO,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { EVIDENCE_IDS, type EvidenceId } from "../chapter1/ids";
import { REASONS, chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction, DeductionDef } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const ORDER_SEED = (CORE_PROPERTY_SEED ^ 0x00070007) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 90_000;

const SCENARIO = CHAPTER_1_SCENARIO;
const DEDUCTIONS: readonly DeductionDef[] = Object.values(SCENARIO.deductions);

/** Reachable states along scripted prefixes, so deductions can become possible. */
function scriptedStates(): ChapterState[] {
  const scripts: CoreAction[][] = [
    [{ type: "START_CHAPTER" }, ...DECLINE_ALEX, ...LINK_FIRST_TWO, ...EXPOSE_THIRD_CALL],
    [{ type: "START_CHAPTER" }, ...DECLINE_ALEX, ...LINK_FIRST_TWO],
    [{ type: "START_CHAPTER" }, ...DECLINE_ALEX, ...FOLLOW_THE_NOTIFICATION, ...CALL_SAVED_CONTACT],
    [{ type: "START_CHAPTER" }, ...ALEX_SHARES_CODE, ...FOLLOW_THE_NOTIFICATION],
  ];
  const states: ChapterState[] = [createInitialState(SCENARIO)];
  for (const script of scripts) {
    let state = createInitialState(SCENARIO);
    for (const action of script) {
      const result = chapterReducer(state, action, SCENARIO);
      if (!result.accepted) break;
      state = result.state;
      states.push(state);
    }
  }
  return states;
}

const SCRIPTED = scriptedStates();

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

/** A random reachable state: a random point along a random walk from a scripted state. */
function randomState(next: () => number, seed: number): ChapterState {
  const start = pick(next, SCRIPTED);
  const length = randomInt(next, 0, 40);
  const run = runSequence(generateActionSequence(seed, length, start, SCENARIO), start, SCENARIO);
  return pick(next, run.states);
}

/** Every evidence set that exactly matches `deduction` (inputs plus each `inputsAnyOf` member). */
function matchingSets(deduction: DeductionDef): EvidenceId[][] {
  if (!deduction.inputsAnyOf) return [[...deduction.inputs]];
  return deduction.inputsAnyOf
    .filter((id) => !deduction.inputs.includes(id))
    .map((id) => [...deduction.inputs, id]);
}

/** A set of 2 or 3 evidence IDs: mostly sets that match a deduction, sometimes random ones. */
function randomSet(next: () => number, state: ChapterState): EvidenceId[] {
  const roll = next();
  if (roll < 0.6) return pick(next, matchingSets(pick(next, DEDUCTIONS)));
  if (roll < 0.8 && state.discovered.length >= 2) {
    const pool = [...state.discovered];
    const size = Math.min(randomInt(next, 2, 3), pool.length);
    const out: EvidenceId[] = [];
    while (out.length < size) out.push(...pool.splice(randomInt(next, 0, pool.length - 1), 1));
    return out;
  }
  const pool = [...EVIDENCE_IDS];
  const size = randomInt(next, 2, 3);
  const out: EvidenceId[] = [];
  while (out.length < size) out.push(...pool.splice(randomInt(next, 0, pool.length - 1), 1));
  return out;
}

/** The state with the evidence order inside COMBINE_EVIDENCE log entries sorted (payload order only). */
function semantic(state: ChapterState): unknown {
  return {
    ...state,
    events: state.events.map((entry) =>
      entry.action.type === "COMBINE_EVIDENCE"
        ? { ...entry, action: { ...entry.action, evidenceIds: [...entry.action.evidenceIds].sort() } }
        : entry,
    ),
  };
}

function combine(ids: readonly EvidenceId[]): CoreAction {
  return { type: "COMBINE_EVIDENCE", evidenceIds: [...ids] };
}

describe("chapter core combination idempotence and order independence", () => {
  it(
    "gives the same result for every permutation and rejects a repeated accepted combination",
    () => {
      const failures: string[] = [];
      let accepted = 0;
      let rejected = 0;
      let repeated = 0;
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(ORDER_SEED, index);
        const next = createLcg(seed);
        const state = randomState(next, seed);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const set = randomSet(next, state);
          const where = `seed ${seed} (case ${index}.${attempt}), ${describeAction(combine(set))}`;
          const frozen = JSON.stringify(state);
          const perms = permutations(set);
          const results = perms.map((order) => ({ order, result: chapterReducer(state, combine(order), SCENARIO) }));
          if (JSON.stringify(state) !== frozen) failures.push(`${where}: input state was mutated`);

          const first = results[0].result;
          for (const { order, result } of results.slice(1)) {
            const label = `${where} vs order ${JSON.stringify(order)}`;
            if (result.accepted !== first.accepted) failures.push(`${label}: accept/reject differs`);
            else if (!first.accepted && result.reason !== first.reason) {
              failures.push(`${label}: reasons differ (${String(first.reason)} / ${String(result.reason)})`);
            } else if (JSON.stringify(semantic(result.state)) !== JSON.stringify(semantic(first.state))) {
              failures.push(`${label}: resulting states differ`);
            }
          }

          if (!first.accepted) {
            rejected += 1;
            if (first.state !== state) failures.push(`${where}: rejected, but the state object changed`);
            continue;
          }
          accepted += 1;
          // Submitting any permutation of an accepted combination again is rejected, state unchanged.
          for (const order of perms) {
            repeated += 1;
            const again = chapterReducer(first.state, combine(order), SCENARIO);
            if (again.accepted) failures.push(`${where}: repeat ${JSON.stringify(order)} was accepted`);
            else if (again.reason !== REASONS.deductionAlreadyRecorded) {
              failures.push(`${where}: repeat rejected with "${String(again.reason)}", wanted deductionAlreadyRecorded`);
            }
            if (again.state !== first.state) failures.push(`${where}: repeat changed the state object`);
          }
        }
      }
      const report = `seed base ${ORDER_SEED}; ${failures.length} failure(s):\n${failures.slice(0, 10).join("\n")}`;
      expect(failures, report).toEqual([]);
      expect(accepted, `seed base ${ORDER_SEED}: no accepted combination`).toBeGreaterThan(0);
      expect(rejected, `seed base ${ORDER_SEED}: no rejected combination`).toBeGreaterThan(0);
      expect(repeated, `seed base ${ORDER_SEED}: no repeat checked`).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    "records two available deductions in either order with the same deductions, flags and claims",
    () => {
      const failures: string[] = [];
      let pairs = 0;
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(ORDER_SEED ^ 0x55, index);
        const next = createLcg(seed);
        const state = randomState(next, seed);
        // Every deduction the reducer accepts from this state, with one accepted evidence set each.
        const available: Array<{ deduction: DeductionDef; action: CoreAction }> = [];
        for (const deduction of DEDUCTIONS) {
          for (const set of matchingSets(deduction)) {
            const action = combine(set);
            if (chapterReducer(state, action, SCENARIO).accepted) {
              available.push({ deduction, action });
              break;
            }
          }
        }
        for (let i = 0; i < available.length; i += 1) {
          for (let j = i + 1; j < available.length; j += 1) {
            const a = available[i];
            const b = available[j];
            const where = `seed ${seed} (case ${index}), ${a.deduction.id} and ${b.deduction.id}`;
            const ab1 = chapterReducer(state, a.action, SCENARIO);
            const ba1 = chapterReducer(state, b.action, SCENARIO);
            if (!ab1.accepted || !ba1.accepted) continue;
            const ab = chapterReducer(ab1.state, b.action, SCENARIO);
            const ba = chapterReducer(ba1.state, a.action, SCENARIO);
            if (!ab.accepted || !ba.accepted) {
              failures.push(
                `${where}: both available, but the second was rejected (${a.deduction.id} first: ${String(ab.reason)}; ${b.deduction.id} first: ${String(ba.reason)})`,
              );
              continue;
            }
            pairs += 1;
            const x = ab.state;
            const y = ba.state;
            if (JSON.stringify([...x.deductions].sort()) !== JSON.stringify([...y.deductions].sort())) {
              failures.push(`${where}: deductions differ`);
            }
            if (JSON.stringify(x.flags) !== JSON.stringify(y.flags)) failures.push(`${where}: flags differ`);
            if (JSON.stringify(x.claims) !== JSON.stringify(y.claims)) failures.push(`${where}: claims differ`);
            if (JSON.stringify(x.discovered) !== JSON.stringify(y.discovered)) failures.push(`${where}: discovered differ`);
            if (x.pressure !== y.pressure) failures.push(`${where}: pressure differs`);
          }
        }
      }
      const report = `seed base ${ORDER_SEED ^ 0x55}; ${failures.length} failure(s):\n${failures.slice(0, 10).join("\n")}`;
      expect(failures, report).toEqual([]);
      expect(pairs, `seed base ${ORDER_SEED ^ 0x55}: no state had two available deductions`).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});
