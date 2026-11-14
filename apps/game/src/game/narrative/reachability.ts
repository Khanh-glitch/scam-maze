// Bounded reachability solver for a scenario (check V2, measured parts of V3 and V4).
//
// It explores the states the real `chapterReducer` can reach from `createInitialState`, using the
// moves of `enumerateCandidateActions`. It never re-implements game rules, so it cannot disagree
// with the game. Pure and deterministic: no React, Three.js, i18n, audio, clock or randomness.

import { BEAT_TAG_PREFIX } from "./beats";
import { matchDeduction } from "./deductions";
import { availableOptions } from "./dialogueEngine";
import { chapterReducer, createInitialState } from "./reducer";
import { enumerateCandidateActions } from "./selectors";
import type { ChapterState, CoreAction, Effect, NpcDef, ScenarioDefinition } from "./types";

/** Default state budget (design.md "Reachability solver"). */
export const DEFAULT_MAX_STATES = 100_000;

/** At most this many soft-lock state keys are listed in the report. */
const MAX_REPORTED_SOFT_LOCKS = 20;

/** Guard for the free-action saturation loop. */
const MAX_SATURATION_PASSES = 200;

export interface ReachabilityOptions {
  /** State budget. Default `DEFAULT_MAX_STATES`. */
  maxStates?: number;
}

export interface ReachabilityReport {
  /** Number of distinct states (by state key) that were discovered. */
  states: number;
  /** True when the budget was exceeded. A truncated report proves nothing. */
  truncated: boolean;
  /** Distinct `state.outcome` values seen in reachable states, sorted. */
  outcomesReached: string[];
  /** Endings of the scenario that no explored state selected. Sorted. Not meaningful when `truncated`. */
  unreachableOutcomes: string[];
  /** Node IDs that never became the current node or the end node of a conversation. Sorted. */
  unreachableNodes: string[];
  /** Authored option IDs that were never available in any reachable state. Sorted. */
  unreachableOptions: string[];
  /** State keys of explored states from which no outcome is reachable (capped list). */
  softLocks: string[];
  /** Largest number of options available at once (0 when no conversation was seen). */
  maxAvailableOptions: number;
  /** Smallest number of options available at once at a non-end node (0 when none was seen). */
  minAvailableOptions: number;
}

/** Flags named by a `notFlag` Condition anywhere in the scenario: setting one can disable something. */
function negatedFlags(scenario: ScenarioDefinition): Set<string> {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (record.kind === "notFlag" && typeof record.flag === "string") found.add(record.flag);
    // A flag read by `startNodeWhen` picks the first matching start node, so setting it early can
    // hide a later start node (for example a call that begins "blank" because nothing was opened).
    if (Array.isArray(record.startNodeWhen)) {
      for (const entry of record.startNodeWhen as Array<{ when?: unknown }>) {
        if (!Array.isArray(entry.when)) continue;
        for (const cond of entry.when as Array<Record<string, unknown>>) {
          if (cond.kind === "flag" && typeof cond.flag === "string") found.add(cond.flag);
        }
      }
    }
    for (const child of Object.values(record)) walk(child);
  };
  walk(scenario);
  return found;
}

/**
 * True when every effect only adds: it sets flags that no `notFlag` Condition reads and discovers
 * evidence. No Condition kind can turn false after evidence or such a flag appears, so applying
 * the action first never removes a later option. Claim statuses and pressure are not additive.
 */
function isAdditive(effects: readonly Effect[], negated: ReadonlySet<string>): boolean {
  return effects.every(
    (effect) => (effect.kind === "setFlag" && !negated.has(effect.flag)) || effect.kind === "discoverEvidence",
  );
}

/**
 * Moves that only add evidence, flags or the open phone. They never remove an option, so they
 * are saturated instead of branched on. Device actions and combinations are saturated only when
 * their effects are additive (`isAdditive`); all others stay branching moves.
 */
function isFreeAction(action: CoreAction, scenario: ScenarioDefinition, negated: ReadonlySet<string>): boolean {
  switch (action.type) {
    case "INTERACT_OBJECT":
    case "INSPECT_EVIDENCE":
    case "OPEN_PHONE":
      return true;
    case "VERIFY_CLAIM":
      return action.method === "bank-app";
    case "DEVICE_ACTION": {
      if (!Object.hasOwn(scenario.deviceActions, action.deviceActionId)) return false;
      return isAdditive(scenario.deviceActions[action.deviceActionId].effects, negated);
    }
    case "COMBINE_EVIDENCE": {
      const deduction = matchDeduction(action.evidenceIds, scenario);
      return deduction !== null && isAdditive(deduction.effects, negated);
    }
    default:
      return false;
  }
}

/**
 * Flags that engine code reads directly (reducer guards, candidate actions, objectives, outcome),
 * outside any scenario Condition. The reducer itself only writes `first_call_rejected` (declining
 * or hanging up the first call); the harm flags are kept because the debrief reads them.
 * Keep this list in sync when the engine starts reading a new flag.
 */
export const ENGINE_READ_FLAGS: readonly string[] = ["first_call_rejected", "code_shared", "money_moved"];

/**
 * Flags that can influence which actions are possible or which Outcome is selected: every flag
 * named by a `flag` or `notFlag` Condition anywhere in the scenario (a conservative deep walk),
 * plus `ENGINE_READ_FLAGS`. Flags outside this set are only read by presentation, so states that
 * differ only in them behave the same and share one state key.
 */
export function relevantFlags(scenario: ScenarioDefinition): string[] {
  const found = new Set<string>(ENGINE_READ_FLAGS);
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if ((record.kind === "flag" || record.kind === "notFlag") && typeof record.flag === "string") {
      found.add(record.flag);
    }
    for (const child of Object.values(record)) walk(child);
  };
  walk(scenario);
  return [...found].sort();
}

/** Compact, order-independent key of the parts of the state that decide which actions are possible. */
function stateKey(state: ChapterState, flags: readonly string[]): string {
  const sortedRecord = (record: Record<string, unknown>): Array<[string, unknown]> =>
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]]);
  const flagRecord = state.flags as Record<string, boolean>;
  return JSON.stringify([
    state.status,
    flags.filter((flag) => flagRecord[flag] === true),
    sortedRecord(state.claims),
    [...state.discovered].sort(),
    state.decision,
    state.outcome,
    state.pressure,
    state.call.current,
    state.call.status,
    state.call.log.map((record) => `${record.callId}:${record.status}`).sort(),
    state.conversation === null ? null : [state.conversation.graphId, state.conversation.nodeId],
    state.phone.open,
    [...state.interacted].sort(),
    [...state.deductions].sort(),
    [...state.objectives.completed].sort(),
    // Beats that fired, and device actions that were done (a `once` action leaves the candidate list).
    // A set: repeating a device action that is not `once` (for example reopening the notification)
    // must not create a new state, or the search never ends.
    [
      ...new Set(
        state.events.flatMap((entry) =>
          entry.derived.debriefTags.filter((tag) => tag.startsWith(BEAT_TAG_PREFIX)).concat(
            entry.action.type === "DEVICE_ACTION" ? [`device:${entry.action.deviceActionId}`] : [],
          ),
        ),
      ),
    ].sort(),
  ]);
}

/** Applies free actions until none of them changes the state key. */
function saturate(
  initial: ChapterState,
  scenario: ScenarioDefinition,
  flags: readonly string[],
  negated: ReadonlySet<string>,
): ChapterState {
  let state = initial;
  for (let pass = 0; pass < MAX_SATURATION_PASSES; pass += 1) {
    let progressed = false;
    for (const action of enumerateCandidateActions(state, scenario)) {
      if (!isFreeAction(action, scenario, negated)) continue;
      const before = stateKey(state, flags);
      const result = chapterReducer(state, action, scenario);
      if (result.accepted && stateKey(result.state, flags) !== before) {
        state = result.state;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return state;
}

/** Moves that branch the search: everything except free actions, phone closing and finishing. */
function branchingMoves(
  state: ChapterState,
  scenario: ScenarioDefinition,
  negated: ReadonlySet<string>,
): CoreAction[] {
  return enumerateCandidateActions(state, scenario).filter(
    (action) =>
      !isFreeAction(action, scenario, negated) && action.type !== "CLOSE_PHONE" && action.type !== "FINISH_CHAPTER",
  );
}

/**
 * Narration graphs (`dlg.intro`, `dlg.aftermath`): every node is a terminal node without options,
 * and no call or NPC uses the graph. The presentation layer plays their nodes in a fixed order
 * through the voice player (design Q6), so the dialogue engine never enters them. A graph with
 * any option, or one that a call or an NPC starts, is real dialogue and is always checked.
 */
export function playbackOnlyGraphIds(scenario: ScenarioDefinition): string[] {
  const used = new Set<string>([
    ...Object.values(scenario.calls).map((call) => call.graphId),
    ...(Object.values(scenario.npcs) as NpcDef[]).map((npc) => npc.graphId),
  ]);
  return Object.values(scenario.dialogues)
    .filter(
      (graph) =>
        !used.has(graph.id) &&
        Object.values(graph.nodes).every((node) => node.options.length === 0 && node.end !== undefined),
    )
    .map((graph) => graph.id);
}

/**
 * Explores the reachable states of `scenario` breadth-first within `maxStates` and reports
 * reachability, soft locks and option-count bounds.
 */
export function analyzeReachability(
  scenario: ScenarioDefinition,
  options: ReachabilityOptions = {},
): ReachabilityReport {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  const flags = relevantFlags(scenario);
  const negated = negatedFlags(scenario);

  const indexByKey = new Map<string, number>();
  const keys: string[] = [];
  const isOutcome: boolean[] = [];
  const reverseEdges: number[][] = [];
  const outcomes = new Set<string>();
  const seenNodes = new Set<string>();
  const seenOptions = new Set<string>();
  let maxAvailable = 0;
  let minAvailable = Number.POSITIVE_INFINITY;
  let truncated = false;

  const observe = (state: ChapterState): void => {
    if (state.outcome !== null) outcomes.add(state.outcome);
    if (state.conversation !== null) {
      seenNodes.add(state.conversation.nodeId);
      const views = availableOptions(state, scenario);
      if (views.length > 0) {
        maxAvailable = Math.max(maxAvailable, views.length);
        minAvailable = Math.min(minAvailable, views.length);
      }
      for (const view of views) if (!view.fallback) seenOptions.add(view.id);
    }
    for (const entry of state.conversationHistory) if (entry.endNodeId) seenNodes.add(entry.endNodeId);
  };

  const queue: ChapterState[] = [];
  const register = (state: ChapterState): number | null => {
    const key = stateKey(state, flags);
    const known = indexByKey.get(key);
    if (known !== undefined) return known;
    if (keys.length >= maxStates) {
      truncated = true;
      return null;
    }
    const index = keys.length;
    indexByKey.set(key, index);
    keys.push(key);
    isOutcome.push(state.outcome !== null);
    reverseEdges.push([]);
    queue.push(state);
    return index;
  };

  const start = chapterReducer(createInitialState(scenario), { type: "START_CHAPTER" }, scenario);
  const first = saturate(start.state, scenario, flags, negated);
  observe(first);
  register(first);

  // `queue` is read by index so that expanded states stay out of the way without O(n) shifts.
  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head];
    if (state.outcome !== null) continue;
    const fromIndex = head;
    for (const action of branchingMoves(state, scenario, negated)) {
      const result = chapterReducer(state, action, scenario);
      if (!result.accepted) continue;
      const next = saturate(result.state, scenario, flags, negated);
      observe(next);
      const toIndex = register(next);
      if (toIndex !== null) reverseEdges[toIndex].push(fromIndex);
    }
  }

  // Soft locks: explored states that cannot reach any state with an outcome.
  const softLocks: string[] = [];
  if (!truncated) {
    const canFinish = new Array<boolean>(keys.length).fill(false);
    const stack: number[] = [];
    isOutcome.forEach((flag, index) => {
      if (flag) {
        canFinish[index] = true;
        stack.push(index);
      }
    });
    while (stack.length > 0) {
      const index = stack.pop() as number;
      for (const from of reverseEdges[index]) {
        if (!canFinish[from]) {
          canFinish[from] = true;
          stack.push(from);
        }
      }
    }
    for (let index = 0; index < keys.length && softLocks.length < MAX_REPORTED_SOFT_LOCKS; index += 1) {
      if (!canFinish[index]) softLocks.push(keys[index]);
    }
  }

  const allNodes: string[] = [];
  const allOptions: string[] = [];
  const playbackOnly = new Set(playbackOnlyGraphIds(scenario));
  for (const graph of Object.values(scenario.dialogues)) {
    // Narration is played by the presentation layer, never entered as a conversation.
    if (playbackOnly.has(graph.id)) continue;
    for (const node of Object.values(graph.nodes)) {
      allNodes.push(node.id);
      for (const option of node.options) allOptions.push(option.id);
    }
  }

  return {
    states: keys.length,
    truncated,
    outcomesReached: [...outcomes].sort(),
    unreachableOutcomes: Object.keys(scenario.endings)
      .filter((id) => !outcomes.has(id))
      .sort(),
    unreachableNodes: allNodes.filter((id) => !seenNodes.has(id)).sort(),
    unreachableOptions: allOptions.filter((id) => !seenOptions.has(id)).sort(),
    softLocks,
    maxAvailableOptions: maxAvailable,
    minAvailableOptions: Number.isFinite(minAvailable) ? minAvailable : 0,
  };
}
