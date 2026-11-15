// Feature: chapter-01-double-deception, Property 12: Ending selection is a deterministic total function
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  carefulPolicy,
  completeChapterFrom,
  describeAction,
  generateActionSequence,
  harmfulOptionPolicy,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import {
  CLAIM_IDS,
  DECISION_IDS,
  DEDUCTION_IDS,
  EVIDENCE_IDS,
  FLAG_IDS,
  OUTCOME_IDS,
  type DecisionId,
  type OutcomeId,
} from "../chapter1/ids";
import { evaluateConditions } from "../conditions";
import { selectConsequenceVariant, selectOutcome } from "../outcome";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, ClaimStatus, PressureLevel, ScenarioDefinition } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const OUTCOME_SEED = (CORE_PROPERTY_SEED ^ 0x000c0012) >>> 0;

const CLAIM_STATUSES: readonly ClaimStatus[] = ["unverified", "supported", "contradicted", "inconclusive"];
const DECISIONS_OR_NONE: readonly (DecisionId | null)[] = [null, ...DECISION_IDS];

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 120_000;

/** Reference ending table, written independently of `selectOutcome` (design, "Decisions and ending resolution"). */
function referenceOutcome(state: ChapterState): OutcomeId | null {
  if (state.decision === null) return null;
  if (state.decision === "follow-recovery" && !state.flags.code_shared) return "false-victory";
  if (state.flags.money_moved) return "perfect-chain";
  if (state.flags.official_channel_verified) return "break-the-chain";
  return "unfinished-case";
}

/** Reference consequence variant table. */
function referenceVariant(state: ChapterState, outcome: OutcomeId): string {
  const both =
    state.deductions.includes("ded.same-source") && state.deductions.includes("ded.third-caller-not-independent");
  switch (outcome) {
    case "false-victory":
      return state.flags.first_call_rejected ? "after-rejecting-alex" : "default";
    case "perfect-chain":
      return "default";
    case "break-the-chain":
      if (both) return "case-report";
      return state.flags.code_shared ? "contained-late" : "default";
    case "unfinished-case":
      return state.deductions.includes("ded.same-source") ? "evidence-built" : "default";
  }
}

function subset<T>(next: () => number, items: readonly T[]): T[] {
  return items.filter(() => next() < 0.5);
}

/** A hand-built state with random other fields and the four forced selection inputs. */
function craftedState(
  next: () => number,
  decision: DecisionId | null,
  codeShared: boolean,
  moneyMoved: boolean,
  verified: boolean,
): ChapterState {
  const base = createInitialState();
  const flags = { ...base.flags };
  for (const flag of FLAG_IDS) flags[flag] = next() < 0.5;
  flags.code_shared = codeShared;
  flags.money_moved = moneyMoved;
  flags.official_channel_verified = verified;
  const claims = { ...base.claims };
  for (const claim of CLAIM_IDS) claims[claim] = pick(next, CLAIM_STATUSES);
  return {
    ...base,
    status: "playing",
    decision,
    flags,
    claims,
    deductions: subset(next, DEDUCTION_IDS),
    discovered: subset(next, EVIDENCE_IDS),
    pressure: randomInt(next, 0, 3) as PressureLevel,
  };
}

/** A twin that differs only in event order, pressure, discovered evidence and deduction order. */
function twinOf(state: ChapterState, next: () => number): ChapterState {
  return {
    ...state,
    pressure: ((state.pressure + 1 + randomInt(next, 0, 2)) % 4) as PressureLevel,
    discovered: subset(next, EVIDENCE_IDS),
    deductions: [...state.deductions].reverse(),
    events: [...state.events].reverse(),
  };
}

/** Chooses a random decision the reducer accepts, so guided completions reach all four endings. */
function randomAcceptedDecision(next: () => number): (state: ChapterState) => DecisionId {
  return (state) => {
    const accepted = DECISION_IDS.filter(
      (decision) => chapterReducer(state, { type: "MAKE_DECISION", decision }).accepted,
    );
    return accepted.length > 0 ? pick(next, accepted) : "refuse-and-stop";
  };
}

function matchingEndings(state: ChapterState, scenario: ScenarioDefinition): OutcomeId[] {
  return Object.values(scenario.endings)
    .filter((ending) => evaluateConditions(ending.selectWhen, state, scenario))
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
    .map((ending) => ending.id);
}

/** Checks outcome, twin, variants and determinism for one state. */
function checkState(state: ChapterState, where: string, next: () => number): OutcomeId | null {
  const expected = referenceOutcome(state);
  const selected = selectOutcome(state);
  expect(selected, where).toBe(expected);
  expect(selectOutcome(state), `${where}, second call`).toBe(selected);

  const twin = twinOf(state, next);
  expect(selectOutcome(twin), `${where}, twin`).toBe(selected);

  if (selected === null) {
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO, null), where).toBeNull();
    return null;
  }
  // Exactly one ending is selected: the first of the matching endings in order, and one exists.
  const matches = matchingEndings(state, CHAPTER_1_SCENARIO);
  expect(matches.length, `${where}, matching endings`).toBeGreaterThan(0);
  expect(matches[0], `${where}, first matching ending`).toBe(selected);

  const variant = selectConsequenceVariant(state, CHAPTER_1_SCENARIO, selected);
  expect(variant?.id, `${where}, variant`).toBe(referenceVariant(state, selected));
  expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO, selected)?.id, `${where}, variant again`).toBe(variant?.id);
  expect(selectConsequenceVariant(twin, CHAPTER_1_SCENARIO, selected)?.id, `${where}, twin variant`).toBe(variant?.id);
  return selected;
}

describe("chapter core ending selection (Property 12)", () => {
  it("is a deterministic total function that matches the ending table", () => {
    const seen = new Set<OutcomeId>();
    let decisionsChecked = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(OUTCOME_SEED, index);
      const next = createLcg(seed);
      const context = `seed ${seed} (case ${index})`;

      // Hand-built: every combination of the four inputs, with random other fields.
      for (const decision of DECISIONS_OR_NONE) {
        for (const codeShared of [false, true]) {
          for (const moneyMoved of [false, true]) {
            for (const verified of [false, true]) {
              const state = craftedState(next, decision, codeShared, moneyMoved, verified);
              const where = `${context}, decision=${String(decision)} code_shared=${codeShared} money_moved=${moneyMoved} verified=${verified}`;
              const outcome = checkState(state, where, next);
              if (outcome !== null) seen.add(outcome);
            }
          }
        }
      }

      // Reachable: every decision the reducer accepts in every state of a random run.
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const run = runSequence(actions);
      run.states.forEach((state, step) => {
        if (state.status !== "playing") return;
        for (const decision of DECISION_IDS) {
          const result = chapterReducer(state, { type: "MAKE_DECISION", decision });
          if (!result.accepted) continue;
          decisionsChecked += 1;
          const where = `${context}, step ${step}, ${describeAction({ type: "MAKE_DECISION", decision })}`;
          expect(result.state.outcome, where).not.toBeNull();
          expect(checkState(result.state, where, next), where).toBe(result.state.outcome);
          seen.add(result.state.outcome as OutcomeId);
        }
      });

      // Reachable: guided and policy completions, then the outcome lock.
      const completions = [
        completeChapterFrom(run.final, undefined, undefined, randomAcceptedDecision(next)),
        carefulPolicy(seed),
        harmfulOptionPolicy(seed),
      ];
      for (const completion of completions) {
        const where = `${context}, completion`;
        const outcome = completion.outcomeState.outcome;
        expect(outcome, where).not.toBeNull();
        expect(checkState(completion.outcomeState, where, next), where).toBe(outcome);
        expect(completion.final.outcome, `${where}, outcome lock`).toBe(outcome);
        seen.add(outcome as OutcomeId);
      }
    }
    expect(decisionsChecked).toBeGreaterThan(0);
    expect([...seen].sort()).toEqual([...OUTCOME_IDS].sort());
  }, PROPERTY_TIMEOUT_MS);

  it("does not depend on the order in which endings are stored", () => {
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(OUTCOME_SEED, index + 1000);
      const next = createLcg(seed);
      const state = craftedState(
        next,
        pick(next, DECISION_IDS),
        next() < 0.5,
        next() < 0.5,
        next() < 0.5,
      );
      const reversed = {
        ...CHAPTER_1_SCENARIO,
        endings: Object.fromEntries(Object.entries(CHAPTER_1_SCENARIO.endings).reverse()),
      } as ScenarioDefinition;
      expect(selectOutcome(state, reversed), `seed ${seed} (case ${index})`).toBe(selectOutcome(state));

      // Equal orders fall back to the ending id.
      const tied = {
        ...CHAPTER_1_SCENARIO,
        endings: Object.fromEntries(
          Object.entries(CHAPTER_1_SCENARIO.endings)
            .reverse()
            .map(([id, ending]) => [id, { ...ending, order: 1, selectWhen: [] }]),
        ),
      } as unknown as ScenarioDefinition;
      expect(selectOutcome(state, tied), `seed ${seed} (case ${index}), tied`).toBe("break-the-chain");
    }
  }, PROPERTY_TIMEOUT_MS);
});
