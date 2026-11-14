// Feature: chapter-01-double-deception, Property 12: Ending selection is a deterministic total function
// The investigator-style path of this chapter: the secret `case-report` variant of Ending C.
// It is selected if and only if the ending is C and both `ded.same-source` and
// `ded.third-caller-not-independent` are recorded. (The old investigator outcome no longer exists.)
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  caseSeed,
  carefulPolicy,
  harmfulOptionPolicy,
  reachEndingA,
  reachEndingB,
  reachEndingC,
  reachEndingD,
} from "../../../test/chapterRuns";
import { createLcg, pick } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { DECISION_IDS, DEDUCTION_IDS, FLAG_IDS, OUTCOME_IDS, type DecisionId } from "../chapter1/ids";
import { selectConsequenceVariant, selectOutcome } from "../outcome";
import { createInitialState } from "../reducer";
import type { ChapterState } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const CASE_REPORT_SEED = (CORE_PROPERTY_SEED ^ 0x000c0014) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 120_000;

function hasBothDeductions(state: ChapterState): boolean {
  return (
    state.deductions.includes("ded.same-source") && state.deductions.includes("ded.third-caller-not-independent")
  );
}

/** One message per violated clause. Empty means the case-report rule holds for `state`. */
function violations(state: ChapterState): string[] {
  const found: string[] = [];
  const outcome = selectOutcome(state);
  if (outcome === null) {
    if (selectConsequenceVariant(state, CHAPTER_1_SCENARIO, null) !== null) found.push("variant without an ending");
    return found;
  }
  const variant = selectConsequenceVariant(state, CHAPTER_1_SCENARIO, outcome);
  const expected = outcome === "break-the-chain" && hasBothDeductions(state);
  if ((variant?.id === "case-report") !== expected) {
    found.push(`case-report is ${variant?.id === "case-report"} but the rule says ${expected} (ending ${outcome})`);
  }
  if (variant?.id === "case-report" && !state.flags.official_channel_verified) {
    found.push("case-report without official_channel_verified");
  }
  if (variant?.id === "case-report" && state.flags.money_moved) {
    found.push("case-report after money moved");
  }
  return found;
}

function craftedState(next: () => number): ChapterState {
  const base = createInitialState();
  const flags = { ...base.flags };
  for (const flag of FLAG_IDS) flags[flag] = next() < 0.5;
  // Keep verified common, and harm flags less common, so ending C states are frequent.
  flags.official_channel_verified = next() < 0.7;
  flags.money_moved = next() < 0.15;
  flags.code_shared = next() < 0.3;
  const decision: DecisionId = pick(next, DECISION_IDS);
  return {
    ...base,
    status: "playing",
    decision,
    flags,
    deductions: DEDUCTION_IDS.filter(() => next() < 0.7),
  };
}

describe("chapter core case-report variant (Property 12)", () => {
  it("is selected only for Ending C with both deductions recorded", () => {
    let caseReports = 0;
    let boundaryBelow = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(CASE_REPORT_SEED, index);
      const next = createLcg(seed);
      const context = `seed ${seed} (case ${index})`;

      for (let n = 0; n < 20; n += 1) {
        const state = craftedState(next);
        expect(violations(state), `${context}, crafted state ${n}`).toEqual([]);
        const outcome = selectOutcome(state);
        if (outcome === null) continue;
        const variant = selectConsequenceVariant(state, CHAPTER_1_SCENARIO, outcome)?.id;
        if (variant === "case-report") caseReports += 1;
        if (outcome === "break-the-chain" && !hasBothDeductions(state) && state.deductions.length === 1) {
          boundaryBelow += 1;
          expect(variant, `${context}, one deduction only`).not.toBe("case-report");
        }
      }

      for (const completion of [carefulPolicy(seed), harmfulOptionPolicy(seed)]) {
        expect(violations(completion.outcomeState), `${context}, reachable outcome state`).toEqual([]);
        expect(violations(completion.final), `${context}, reachable final state`).toEqual([]);
      }
    }
    expect(caseReports).toBeGreaterThan(0);
    expect(boundaryBelow).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);

  it("matches the scripted endings and drops to default when a deduction is missing", () => {
    const secret = reachEndingC({ caseReport: true }).outcomeState;
    expect(secret.outcome).toBe("break-the-chain");
    expect(hasBothDeductions(secret)).toBe(true);
    expect(selectConsequenceVariant(secret, CHAPTER_1_SCENARIO)?.id).toBe("case-report");
    for (const missing of ["ded.same-source", "ded.third-caller-not-independent"] as const) {
      const reduced = { ...secret, deductions: secret.deductions.filter((id) => id !== missing) };
      expect(selectOutcome(reduced)).toBe("break-the-chain");
      expect(selectConsequenceVariant(reduced, CHAPTER_1_SCENARIO, "break-the-chain")?.id).not.toBe("case-report");
    }
    expect(selectConsequenceVariant(reachEndingC().outcomeState, CHAPTER_1_SCENARIO)?.id).toBe("default");

    const others = [reachEndingA(), reachEndingB(), reachEndingD(), reachEndingD({ evidenceBuilt: true })];
    const outcomes = others.map((run) => run.outcomeState.outcome);
    expect(outcomes).toEqual(["false-victory", "perfect-chain", "unfinished-case", "unfinished-case"]);
    for (const run of others) {
      expect(selectConsequenceVariant(run.outcomeState, CHAPTER_1_SCENARIO)?.id).not.toBe("case-report");
    }
    expect(OUTCOME_IDS).toHaveLength(4);
  }, PROPERTY_TIMEOUT_MS);
});
