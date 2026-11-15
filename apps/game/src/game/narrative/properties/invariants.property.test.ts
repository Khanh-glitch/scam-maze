// Feature: chapter-01-double-deception, Property 4: State invariants hold in every reachable state
// Earlier feature line (kept for history): chapter-01-the-urgent-call, Property 2.
// Validates: Requirements 4.1, 4.4, 4.5, 6.1, 7.6, 8.3, 8.8
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  assertInvariants,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { selectDeception } from "../selectors";
import type { ChapterState } from "../types";

/**
 * Violations of the single state, or of the step from `before` to `after` made by `action`.
 * Step checks: pressure range, endings only chosen by decisions, claims changed by deductions
 * only to `inconclusive`, `contradicted` only after the official line, and selectDeception
 * derived only from state.
 */
function stepViolations(before: ChapterState, after: ChapterState, action: unknown): string[] {
  const violations = assertInvariants(after);

  if (!Number.isInteger(after.pressure) || after.pressure < 0 || after.pressure > 3) {
    violations.push(`pressure ${after.pressure} is outside 0..3`);
  }

  const isDecision =
    typeof action === "object" && action !== null && (action as { type?: unknown }).type === "MAKE_DECISION";
  if (before.outcome === null && after.outcome !== null && !isDecision) {
    violations.push(`an outcome appeared without a MAKE_DECISION action (outcome ${String(after.outcome)})`);
  }
  if (before.decision !== after.decision && !isDecision) {
    violations.push("the decision changed without a MAKE_DECISION action");
  }
  if (before.pressure !== after.pressure && before.outcome === null && after.outcome !== null && !isDecision) {
    violations.push("pressure change chose an ending");
  }

  const newDeductions = after.deductions.filter((id) => !before.deductions.includes(id));
  const officialJustFound =
    !before.discovered.includes("ev.official-confirmation") && after.discovered.includes("ev.official-confirmation");
  for (const [claimId, status] of Object.entries(after.claims)) {
    const previous = before.claims[claimId as keyof typeof before.claims];
    if (status === previous) continue;
    if (status === "contradicted" && !after.discovered.includes("ev.official-confirmation")) {
      violations.push(`claim ${claimId} became contradicted before the official line`);
    }
    if (newDeductions.length > 0 && !officialJustFound && status !== "inconclusive") {
      violations.push(`claim ${claimId} changed to ${status} in a step that recorded ${newDeductions.join(", ")}`);
    }
  }

  // selectDeception reads only state: a structural copy gives an equal projection.
  const copy = JSON.parse(JSON.stringify(after)) as ChapterState;
  if (JSON.stringify(selectDeception(copy)) !== JSON.stringify(selectDeception(after))) {
    violations.push("selectDeception differs for an equal copy of the state");
  }
  return violations;
}

/** Index (state index) of the first state or step that violates a property, or -1. */
function firstViolatingState(actions: readonly unknown[]): { index: number; violations: string[] } {
  const { states } = runSequence(actions);
  const initial = assertInvariants(states[0]);
  if (initial.length > 0) return { index: 0, violations: initial };
  for (let index = 1; index < states.length; index += 1) {
    const violations = stepViolations(states[index - 1], states[index], actions[index - 1]);
    if (violations.length > 0) return { index, violations };
  }
  return { index: -1, violations: [] };
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 120_000;

describe("chapter core properties: state invariants", () => {
  // Feature: chapter-01-double-deception, Property 4: State invariants hold in every reachable state
  it("keeps every reachable state within the state invariants", () => {
    // **Validates: Requirements 4.1, 4.4, 4.5, 6.1, 7.6, 8.3, 8.8**
    expect(CORE_PROPERTY_RUNS).toBeGreaterThanOrEqual(200);
    expect(CHAPTER_1_SCENARIO.acts.length).toBeGreaterThan(0);
    for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
      const seed = caseSeed(CORE_PROPERTY_SEED, run);
      const length = randomInt(createLcg(seed ^ 0x5f3759df), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const failure = firstViolatingState(actions);
      if (failure.index === -1) continue;

      const prefix =
        shrinkFailingPrefix(actions, (candidate) => firstViolatingState(candidate).index !== -1) ?? actions;
      const shrunk = firstViolatingState(prefix);
      const report = [
        `Invariant violated (base seed ${CORE_PROPERTY_SEED}, case ${run}, seed ${seed}, length ${length}).`,
        `Shrunk prefix (${prefix.length} actions):`,
        ...prefix.map((action, i) => `  ${i}: ${describeAction(action)}`),
        `Violations at state ${shrunk.index}:`,
        ...shrunk.violations.map((message) => `  - ${message}`),
      ].join("\n");
      expect.fail(report);
    }
  }, PROPERTY_TIMEOUT_MS);
});
