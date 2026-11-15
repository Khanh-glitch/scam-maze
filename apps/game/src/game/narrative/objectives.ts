// Objective manager for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-double-deception/design.md, "Objectives".
//
// Objectives are data: `Objective.activateWhen` and `Objective.completeWhen` are condition lists
// from Scenario_Data. OPEN_PHONE and CLOSE_PHONE never change objectives, and the
// Evidence_Journal is UI state that never reaches the core.

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { OBJECTIVE_IDS, type ObjectiveId } from "./chapter1/ids";
import { evaluateConditions } from "./conditions";
import type { ChapterState, CoreAction, CoreActionType, ScenarioDefinition } from "./types";

export interface ObjectiveManagerResult {
  /** `next` with updated objectives, or `next` itself when nothing changed. */
  state: ChapterState;
  /** Objectives activated in this step, in `OBJECTIVE_IDS` order. */
  activated: ObjectiveId[];
  /** Objectives completed in this step, in `OBJECTIVE_IDS` order. */
  completed: ObjectiveId[];
}

/** Actions that never activate or complete an objective. */
export const OBJECTIVE_NEUTRAL_ACTIONS: readonly CoreActionType[] = ["OPEN_PHONE", "CLOSE_PHONE"];

/** An objective with an empty `completeWhen` never completes by itself (it needs a condition). */
function completionHolds(
  state: ChapterState,
  id: ObjectiveId,
  scenario: ScenarioDefinition,
): boolean {
  if (!Object.hasOwn(scenario.objectives, id)) return false;
  const { completeWhen } = scenario.objectives[id];
  return completeWhen.length > 0 && evaluateConditions(completeWhen, state, scenario);
}

/**
 * Activates and completes objectives after an accepted action. Pure: never mutates its inputs.
 * Activation runs first, then completion, both in `OBJECTIVE_IDS` order, so an objective can be
 * activated and completed in the same step. Conditions are evaluated against a working state
 * whose `objectives` follow each change, so `objectiveCompleted` conditions see earlier
 * completions of the same step. Only active objectives can complete, and an objective is never
 * activated twice. `prev` and `action` are kept for the call sites; only the neutral-action
 * check reads `action`.
 */
export function runObjectiveManager(
  _prev: ChapterState,
  next: ChapterState,
  action: CoreAction,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): ObjectiveManagerResult {
  if (OBJECTIVE_NEUTRAL_ACTIONS.includes(action.type)) {
    return { state: next, activated: [], completed: [] };
  }

  const active = new Set<ObjectiveId>(next.objectives.active);
  const done = new Set<ObjectiveId>(next.objectives.completed);
  const activated: ObjectiveId[] = [];
  const completed: ObjectiveId[] = [];

  const working = (): ChapterState => ({
    ...next,
    objectives: {
      active: OBJECTIVE_IDS.filter((id) => active.has(id)),
      completed: OBJECTIVE_IDS.filter((id) => done.has(id)),
    },
  });

  for (const id of OBJECTIVE_IDS) {
    if (active.has(id) || done.has(id)) continue;
    if (!Object.hasOwn(scenario.objectives, id)) continue;
    if (evaluateConditions(scenario.objectives[id].activateWhen, working(), scenario)) {
      active.add(id);
      activated.push(id);
    }
  }

  for (const id of OBJECTIVE_IDS) {
    if (!active.has(id)) continue;
    if (completionHolds(working(), id, scenario)) {
      active.delete(id);
      done.add(id);
      completed.push(id);
    }
  }

  if (activated.length === 0 && completed.length === 0) {
    return { state: next, activated, completed };
  }

  return { state: working(), activated, completed };
}

/**
 * Guard for COMPLETE_OBJECTIVE: the objective is active and its `completeWhen` conditions hold
 * on the current state.
 */
export function canCompleteObjective(
  state: ChapterState,
  objectiveId: ObjectiveId,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): boolean {
  if (!state.objectives.active.includes(objectiveId)) return false;
  return completionHolds(state, objectiveId, scenario);
}

/** Rejection reason for COMPLETE_OBJECTIVE when `canCompleteObjective` is false. */
export const OBJECTIVE_CONDITION_NOT_MET = "Objective condition not met.";
