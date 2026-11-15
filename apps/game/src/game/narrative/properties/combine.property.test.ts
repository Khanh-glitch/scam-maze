// Feature: chapter-01-double-deception, Property 6: Combination validity
// Validates: Requirements 8.2, 8.4, 8.5
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
  assertInvariants,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { EVIDENCE_IDS, type EvidenceId } from "../chapter1/ids";
import { evaluateConditions } from "../conditions";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction, DeductionDef } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const COMBINE_SEED = (CORE_PROPERTY_SEED ^ 0x00060006) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 90_000;

const SCENARIO = CHAPTER_1_SCENARIO;
const DEDUCTIONS: readonly DeductionDef[] = Object.values(SCENARIO.deductions);

/** Reachable states along scripted prefixes, so deductions can become possible. */
function scriptedStates(): ChapterState[] {
  const scripts: CoreAction[][] = [
    [{ type: "START_CHAPTER" }, ...DECLINE_ALEX, ...LINK_FIRST_TWO, ...EXPOSE_THIRD_CALL],
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

function shuffle<T>(next: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(next, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A random reachable state: a random point along a random walk from a scripted state. */
function randomState(next: () => number, seed: number): ChapterState {
  const start = pick(next, SCRIPTED);
  const length = randomInt(next, 0, 40);
  const run = runSequence(generateActionSequence(seed, length, start, SCENARIO), start, SCENARIO);
  return pick(next, run.states);
}

/** Evidence IDs that exactly match `deduction` (inputs plus one `inputsAnyOf` member). */
function matchingSet(next: () => number, deduction: DeductionDef): EvidenceId[] {
  const ids: EvidenceId[] = [...deduction.inputs];
  if (deduction.inputsAnyOf) ids.push(pick(next, deduction.inputsAnyOf.filter((id) => !ids.includes(id))));
  return ids;
}

/** 2 or 3 distinct evidence IDs: an exact match, a near miss or a random set. */
function randomCombination(next: () => number, state: ChapterState): EvidenceId[] {
  const roll = next();
  if (roll < 0.35) return shuffle(next, matchingSet(next, pick(next, DEDUCTIONS)));
  if (roll < 0.55) {
    // Near miss: drop one member or add one extra.
    const set = matchingSet(next, pick(next, DEDUCTIONS));
    if (next() < 0.5 && set.length > 2) set.splice(randomInt(next, 0, set.length - 1), 1);
    else {
      const extra = pick(next, EVIDENCE_IDS.filter((id) => !set.includes(id)));
      set.splice(randomInt(next, 0, set.length), 0, extra);
    }
    return shuffle(next, set);
  }
  if (roll < 0.75 && state.discovered.length >= 2) {
    // Only discovered evidence, so rejection is not explained by missing discovery.
    const size = Math.min(randomInt(next, 2, 3), state.discovered.length);
    return shuffle(next, state.discovered).slice(0, size);
  }
  return shuffle(next, EVIDENCE_IDS).slice(0, randomInt(next, 2, 3));
}

/** Independent oracle, written from the Property 6 wording and Scenario_Data. */
function expectedDeduction(state: ChapterState, ids: readonly EvidenceId[]): DeductionDef | null {
  if (state.status !== "playing") return null;
  if (!ids.every((id) => state.discovered.includes(id))) return null;
  const set = new Set(ids);
  if (set.size !== ids.length) return null;
  for (const deduction of DEDUCTIONS) {
    const anyOf = deduction.inputsAnyOf ?? [];
    const chosen = anyOf.filter((id) => set.has(id) && !deduction.inputs.includes(id));
    const size = deduction.inputs.length + (deduction.inputsAnyOf ? 1 : 0);
    if (set.size !== size) continue;
    if (!deduction.inputs.every((id) => set.has(id))) continue;
    if (deduction.inputsAnyOf && chosen.length !== 1) continue;
    if (state.deductions.includes(deduction.id)) continue;
    if (!evaluateConditions(deduction.requires, state, SCENARIO)) continue;
    return deduction;
  }
  return null;
}

/** Violations of "records exactly that deduction and applies only its effects". */
function checkAccepted(before: ChapterState, after: ChapterState, deduction: DeductionDef): string[] {
  const out: string[] = [];
  const added = after.deductions.filter((id) => !before.deductions.includes(id));
  if (added.length !== 1 || added[0] !== deduction.id) out.push(`recorded ${JSON.stringify(added)}, wanted ${deduction.id}`);
  if (after.deductions.length !== before.deductions.length + 1) out.push("deductions length did not grow by 1");
  if (after.events.length !== before.events.length + 1) out.push("event log did not grow by 1");
  if (JSON.stringify(after.discovered) !== JSON.stringify(before.discovered)) out.push("discovered changed");
  if (after.pressure !== before.pressure) out.push("pressure changed");
  if (after.decision !== before.decision || after.outcome !== before.outcome) out.push("decision or outcome changed");
  if (after.status !== before.status) out.push("status changed");
  if (JSON.stringify(after.call) !== JSON.stringify(before.call)) out.push("call changed");
  if (JSON.stringify(after.conversation) !== JSON.stringify(before.conversation)) out.push("conversation changed");

  const flagEffects = new Set<string>();
  const claimEffects = new Set<string>();
  for (const effect of deduction.effects) {
    if (effect.kind === "setFlag") flagEffects.add(effect.flag);
    if (effect.kind === "setClaimStatus") {
      claimEffects.add(effect.claimId);
      if (effect.status !== "inconclusive") out.push(`effect sets ${effect.claimId} to ${effect.status}`);
    }
  }
  for (const key of new Set([...Object.keys(before.flags), ...Object.keys(after.flags)])) {
    const was = (before.flags as Record<string, unknown>)[key];
    const is = (after.flags as Record<string, unknown>)[key];
    if (was !== is && !flagEffects.has(key)) out.push(`flag ${key} changed without an effect`);
  }
  for (const key of Object.keys(after.claims)) {
    const was = (before.claims as Record<string, unknown>)[key];
    const is = (after.claims as Record<string, unknown>)[key];
    if (was === is) continue;
    if (!claimEffects.has(key)) out.push(`claim ${key} changed without an effect`);
    else if (is !== "inconclusive") out.push(`claim ${key} became ${String(is)}`);
  }
  return out;
}

describe("chapter core combination validity", () => {
  it(
    "accepts a combination only for an authored, discovered, allowed, unrecorded deduction",
    () => {
      const failures: string[] = [];
      let accepted = 0;
      let rejected = 0;
      const acceptedByDeduction: Record<string, number> = {};
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(COMBINE_SEED, index);
        const next = createLcg(seed);
        const state = randomState(next, seed);
        // Several combinations per state, each checked against the same starting state.
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const ids = randomCombination(next, state);
          const action: CoreAction = { type: "COMBINE_EVIDENCE", evidenceIds: ids };
          const where = `seed ${seed} (case ${index}.${attempt}), ${describeAction(action)}`;
          const frozen = JSON.stringify(state);
          const result = chapterReducer(state, action, SCENARIO);
          const wanted = expectedDeduction(state, ids);
          if (JSON.stringify(state) !== frozen) failures.push(`${where}: input state was mutated`);
          if (wanted === null) {
            rejected += 1;
            if (result.accepted) failures.push(`${where}: accepted, but no deduction is allowed (recorded ${JSON.stringify(result.state.deductions)})`);
            if (result.state !== state) failures.push(`${where}: rejected, but the state object changed`);
            if (!result.reason) failures.push(`${where}: rejected without a reason`);
            if (result.state.deductions.length !== state.deductions.length) failures.push(`${where}: rejected, but a deduction was recorded`);
          } else {
            accepted += 1;
            acceptedByDeduction[wanted.id] = (acceptedByDeduction[wanted.id] ?? 0) + 1;
            if (!result.accepted) {
              failures.push(`${where}: rejected (${result.reason ?? "no reason"}), wanted ${wanted.id}`);
              continue;
            }
            for (const problem of checkAccepted(state, result.state, wanted)) failures.push(`${where}: ${problem}`);
            // Only violations introduced by this action count; a violation already in the start state
            // comes from other actions (see the re-ring finding in the task report).
            const known = new Set(assertInvariants(state, SCENARIO));
            for (const problem of assertInvariants(result.state, SCENARIO)) {
              if (!known.has(problem)) failures.push(`: invariant ${problem}`);
            }
          }
        }
      }
      const report = `seed base ${COMBINE_SEED}; ${failures.length} failure(s):\n${failures.slice(0, 10).join("\n")}`;
      expect(failures, report).toEqual([]);
      // The generator must exercise both branches, and every deduction at least once.
      expect(rejected, `seed base ${COMBINE_SEED}`).toBeGreaterThan(0);
      expect(accepted, `seed base ${COMBINE_SEED}`).toBeGreaterThan(0);
      for (const deduction of DEDUCTIONS) {
        expect(acceptedByDeduction[deduction.id] ?? 0, `${deduction.id} never accepted; seed base ${COMBINE_SEED}`).toBeGreaterThan(0);
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});
