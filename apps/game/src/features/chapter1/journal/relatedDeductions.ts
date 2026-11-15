// Maps each evidence ID to the statements of the recorded deductions that use it as an input.
// Pure helper for the evidence journal. It reads only recorded deductions, so it never hints at
// combinations the player has not recorded yet.

import type { ChapterState, ScenarioDefinition } from "../../../game/narrative/types";

export function relatedDeductionStatements(
  state: Pick<ChapterState, "deductions" | "discovered">,
  scenario: Pick<ScenarioDefinition, "deductions">,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const id of state.deductions) {
    if (!Object.hasOwn(scenario.deductions, id)) continue;
    const deduction = scenario.deductions[id];
    const anyOf = (deduction.inputsAnyOf ?? []).filter((evidenceId) => state.discovered.includes(evidenceId));
    for (const evidenceId of [...deduction.inputs, ...anyOf]) {
      if (!Object.hasOwn(result, evidenceId)) result[evidenceId] = [];
      result[evidenceId].push(deduction.statement);
    }
  }
  return result;
}
