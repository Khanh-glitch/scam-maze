// Pure deduction helpers for the chapter core.
// No clock, randomness, I/O, React, Three.js or i18n. See the double-deception design, "Deductions".

import type { EvidenceId } from "./chapter1/ids";
import { evaluateConditions } from "./conditions";
import type { ChapterState, DeductionDef, ScenarioDefinition } from "./types";

/**
 * Returns the deduction whose evidence set equals `evidenceIds`, or `null`.
 *
 * The set must be exactly `inputs` plus, when `inputsAnyOf` is defined, exactly one member of it.
 * Order does not matter. A list with duplicates never matches. When several deductions match,
 * the first in scenario order wins.
 */
export function matchDeduction(
  evidenceIds: readonly EvidenceId[],
  scenario: ScenarioDefinition,
): DeductionDef | null {
  const selected = new Set<EvidenceId>(evidenceIds);
  if (selected.size !== evidenceIds.length || selected.size === 0) return null;

  for (const deduction of Object.values(scenario.deductions)) {
    const anyOf = deduction.inputsAnyOf;
    const expectedSize = deduction.inputs.length + (anyOf ? 1 : 0);
    if (selected.size !== expectedSize) continue;
    if (!deduction.inputs.every((id) => selected.has(id))) continue;
    if (anyOf) {
      const extras = anyOf.filter((id) => selected.has(id) && !deduction.inputs.includes(id));
      if (extras.length !== 1) continue;
    }
    return deduction;
  }
  return null;
}

/**
 * True when the deduction can be recorded now: it is not recorded yet, every input (and one
 * `inputsAnyOf` member, when defined) is discovered, and its `requires` conditions hold.
 */
export function canRecordDeduction(
  state: ChapterState,
  deduction: DeductionDef,
  scenario: ScenarioDefinition,
): boolean {
  if (state.deductions.includes(deduction.id)) return false;
  if (!deduction.inputs.every((id) => state.discovered.includes(id))) return false;
  if (deduction.inputsAnyOf && !deduction.inputsAnyOf.some((id) => state.discovered.includes(id))) {
    return false;
  }
  return evaluateConditions(deduction.requires, state, scenario);
}
