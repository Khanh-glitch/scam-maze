// Outcome function and consequence variant selection for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-double-deception/design.md, "Endings".

import type { OutcomeId } from "./chapter1/ids";
import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { evaluateConditions } from "./conditions";
import type { ChapterState, EndingDef, ScenarioDefinition } from "./types";

/** One consequence text variant of an Ending. */
export type ConsequenceVariant = EndingDef["variants"][number];

/**
 * Selects the Outcome from Scenario_Data. Returns `null` while no Decision is recorded. Otherwise
 * the endings are tried by `order` ascending and the first one whose `selectWhen` conditions all
 * hold wins (an empty `selectWhen` always holds, so a last unconditional ending makes the
 * function total). Ties in `order` fall back to the ending id so the result stays deterministic.
 * Returns `null` only with broken data (no ending matches).
 */
export function selectOutcome(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): OutcomeId | null {
  if (state.decision === null) return null;
  const endings = Object.values(scenario.endings).sort(
    (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const ending of endings) {
    if (evaluateConditions(ending.selectWhen, state, scenario)) return ending.id;
  }
  return null;
}

/**
 * Returns the first consequence variant of the Outcome's Ending whose conditions all hold.
 * The Outcome defaults to `state.outcome`. Returns `null` when there is no Outcome, no Ending
 * for it, or no variant matches (the last variant of each Ending has no conditions, so this
 * only happens with broken data).
 */
export function selectConsequenceVariant(
  state: ChapterState,
  scenario: ScenarioDefinition,
  outcome: OutcomeId | null = state.outcome,
): ConsequenceVariant | null {
  if (outcome === null) return null;
  if (!Object.hasOwn(scenario.endings, outcome)) return null;
  const ending = scenario.endings[outcome];
  return ending.variants.find((variant) => evaluateConditions(variant.when, state, scenario)) ?? null;
}
