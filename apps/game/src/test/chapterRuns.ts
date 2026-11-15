/**
 * Test harness for the Chapter 1 core property tests (spec chapter-01-double-deception,
 * design.md "Correctness Properties" and "Testing Strategy"). No property-based testing library is
 * installed, so action sequences come from the fixed-seed LCG in seededRandom.ts. The same seed
 * always yields the same sequence, so a failing case can be reproduced from its seed and index.
 *
 * Contents:
 * - action generators for all 16 Core_Action kinds, plus malformed values;
 * - `assertInvariants` (the state invariants of Property 4);
 * - guided policies `reachEndingA`, `reachEndingB`, `reachEndingC` (with and without the secret
 *   `case-report` variant) and `reachEndingD`;
 * - a careful policy (never sets `code_shared`, `second_caller_trusted` or `money_moved`) and a
 *   harmful-option policy (prefers the harmful options);
 * - `completeChapterFrom` (soft-lock check) and `shrinkFailingPrefix`.
 *
 * This module imports only the pure chapter core and seededRandom.ts (no React, no Testing
 * Library), so pure core tests can use it.
 */

import { CHAPTER_1_SCENARIO } from "../game/narrative/chapter1/scenario";
import {
  DECISION_IDS,
  DEVICE_ACTION_IDS,
  EVIDENCE_IDS,
  INTERACTABLE_IDS,
  OBJECTIVE_IDS,
  VERIFY_METHODS,
  CLAIM_IDS,
  type DecisionId,
  type DeviceActionId,
  type EvidenceId,
  type FlagId,
  type IncomingCallId,
  type NpcId,
} from "../game/narrative/chapter1/ids";
import { evaluateConditions } from "../game/narrative/conditions";
import { availableOptions } from "../game/narrative/dialogueEngine";
import { chapterReducer, createInitialState } from "../game/narrative/reducer";
import { enumerateCandidateActions, selectDeception } from "../game/narrative/selectors";
import type {
  ActionResult,
  ChapterState,
  CoreAction,
  RingReason,
  ScenarioDefinition,
} from "../game/narrative/types";
import { createLcg, pick, randomInt } from "./seededRandom";

/** Fixed seed for core property tests. Files may derive per-case seeds from it. */
export const CORE_PROPERTY_SEED = 0x0c4a9701;

/** Number of generated cases per core property test (design: at least 200). */
export const CORE_PROPERTY_RUNS = 200;

/** Maximum length of a generated core action sequence (design: up to 80 actions). */
export const CORE_SEQUENCE_MAX_LENGTH = 80;

/** Accepted-action budget of the guided completion policy (design, Property 4). */
export const GUIDED_POLICY_MAX_STEPS = 60;

/** The three flags that mean the player was harmed. Each needs an explicit player choice. */
export const HARM_FLAGS: readonly FlagId[] = ["code_shared", "second_caller_trusted", "money_moved"];

/** Seed for case `index` of a property test that uses `baseSeed`. */
export function caseSeed(baseSeed: number, index: number): number {
  return (baseSeed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

// ---------------------------------------------------------------------------
// Action generator
// ---------------------------------------------------------------------------

const INCOMING_CALLS: readonly IncomingCallId[] = ["call.alex", "call.recovery"];
const RING_REASONS: readonly RingReason[] = [
  "first-interaction",
  "exploration-timer",
  "re-ring",
  "callback",
  "follow-up",
];

/** Every authored option ID across all graphs, plus one that exists nowhere. */
const ALL_OPTION_IDS: readonly string[] = [
  ...Object.values(CHAPTER_1_SCENARIO.dialogues).flatMap((graph) =>
    Object.values(graph.nodes).flatMap((node) => node.options.map((option) => option.id)),
  ),
  "opt.does-not-exist",
];

/** Values that fail the reducer's shape check (`isCoreAction`). */
export const MALFORMED_ACTIONS: readonly unknown[] = [
  null,
  undefined,
  42,
  "START_CHAPTER",
  [],
  [{ type: "START_CHAPTER" }],
  {},
  { type: 7 },
  { type: "UNKNOWN_ACTION" },
  { type: "start_chapter" },
  { type: "INTERACT_OBJECT" },
  { type: "INTERACT_OBJECT", objectId: "obj.does-not-exist" },
  { type: "INSPECT_EVIDENCE", evidenceId: 3 },
  { type: "RING_CALL", callId: "call.official", reason: "re-ring" },
  { type: "RING_CALL", callId: "call.alex" },
  { type: "TALK_TO_NPC" },
  { type: "TALK_TO_NPC", npcId: 5 },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "" },
  { type: "SELECT_DIALOGUE_OPTION" },
  { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "guess" },
  { type: "VERIFY_CLAIM", claimId: "claim.unknown", method: "bank-app" },
  { type: "MAKE_DECISION", decision: "run-away" },
  { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.unknown" },
  { type: "DEVICE_ACTION" },
  { type: "DEVICE_ACTION", deviceActionId: "dev.does-not-exist" },
  { type: "COMBINE_EVIDENCE" },
  { type: "COMBINE_EVIDENCE", evidenceIds: "ev.alex-statement" },
  { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement"] },
  { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.alex-statement"] },
  { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.does-not-exist"] },
  {
    type: "COMBINE_EVIDENCE",
    evidenceIds: ["ev.alex-statement", "ev.shared-case-id", "ev.notification-metadata", "ev.account-activity"],
  },
];

/** Two or three distinct evidence IDs, in random order. */
function randomEvidenceSet(next: () => number): EvidenceId[] {
  const pool = [...EVIDENCE_IDS];
  const size = randomInt(next, 2, 3);
  const chosen: EvidenceId[] = [];
  for (let i = 0; i < size; i += 1) {
    const [id] = pool.splice(randomInt(next, 0, pool.length - 1), 1);
    chosen.push(id);
  }
  return chosen;
}

/** A random well-formed Core_Action (all 16 kinds) with known IDs, not drawn from the candidate list. */
function randomWellFormedAction(next: () => number): CoreAction {
  switch (randomInt(next, 0, 15)) {
    case 0:
      return { type: "START_CHAPTER" };
    case 1:
      return { type: "INTERACT_OBJECT", objectId: pick(next, INTERACTABLE_IDS) };
    case 2:
      return { type: "INSPECT_EVIDENCE", evidenceId: pick(next, EVIDENCE_IDS) };
    case 3:
      return { type: "OPEN_PHONE" };
    case 4:
      return { type: "CLOSE_PHONE" };
    case 5:
      return { type: "RING_CALL", callId: pick(next, INCOMING_CALLS), reason: pick(next, RING_REASONS) };
    case 6:
      return { type: "ANSWER_CALL" };
    case 7:
      return { type: "END_CALL" };
    case 8:
      // No NPC exists in this chapter: a well-formed TALK_TO_NPC is always rejected.
      return { type: "TALK_TO_NPC", npcId: "npc.nobody" as NpcId };
    case 9:
      return { type: "SELECT_DIALOGUE_OPTION", optionId: pick(next, ALL_OPTION_IDS) };
    case 10:
      return { type: "VERIFY_CLAIM", claimId: pick(next, CLAIM_IDS), method: pick(next, VERIFY_METHODS) };
    case 11:
      return { type: "MAKE_DECISION", decision: pick(next, DECISION_IDS) };
    case 12:
      return { type: "COMPLETE_OBJECTIVE", objectiveId: pick(next, OBJECTIVE_IDS) };
    case 13:
      return { type: "DEVICE_ACTION", deviceActionId: pick(next, DEVICE_ACTION_IDS) };
    case 14:
      return { type: "COMBINE_EVIDENCE", evidenceIds: randomEvidenceSet(next) };
    default:
      return { type: "FINISH_CHAPTER" };
  }
}

/**
 * A well-formed action that the reducer rejects in `state`. Tries a few random well-formed
 * actions and returns the first rejected one; if all of them happen to be accepted, returns the
 * last try (so the 20% bucket is "almost always invalid", never malformed).
 */
function invalidWellFormedAction(
  next: () => number,
  state: ChapterState,
  scenario: ScenarioDefinition,
): CoreAction {
  let action = randomWellFormedAction(next);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!chapterReducer(state, action, scenario).accepted) return action;
    action = randomWellFormedAction(next);
  }
  return action;
}

/**
 * Generates `length` dispatchable values from `seed`, tracking the running state so candidate
 * actions fit it. Mix per step (design: 70/20/10):
 * - 70%: an action from `enumerateCandidateActions(state)` (falls back to the 20% bucket when the
 *   list is empty, for example after FINISH_CHAPTER);
 * - 20%: a well-formed Core_Action that is rejected in the current state;
 * - 10%: a malformed value from `MALFORMED_ACTIONS`.
 * The running state starts at `initial` (default `createInitialState()`).
 */
export function generateActionSequence(
  seed: number,
  length: number,
  initial: ChapterState = createInitialState(),
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): unknown[] {
  const next = createLcg(seed);
  const actions: unknown[] = [];
  let state = initial;
  for (let i = 0; i < length; i += 1) {
    const roll = next();
    let action: unknown;
    if (roll < 0.7) {
      const candidates = enumerateCandidateActions(state, scenario);
      action = candidates.length > 0 ? pick(next, candidates) : invalidWellFormedAction(next, state, scenario);
    } else if (roll < 0.9) {
      action = invalidWellFormedAction(next, state, scenario);
    } else {
      action = pick(next, MALFORMED_ACTIONS);
    }
    actions.push(action);
    state = chapterReducer(state, action, scenario).state;
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Running sequences
// ---------------------------------------------------------------------------

export interface SequenceRun {
  /** `states[0]` is the initial state; `states[i + 1]` is the state after `actions[i]`. */
  states: ChapterState[];
  /** `results[i]` is the Action_Result of `actions[i]`. */
  results: ActionResult[];
  final: ChapterState;
}

/** Dispatches every value through `chapterReducer`. Exceptions from the reducer propagate. */
export function runSequence(
  actions: readonly unknown[],
  initial: ChapterState = createInitialState(),
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): SequenceRun {
  const states: ChapterState[] = [initial];
  const results: ActionResult[] = [];
  let state = initial;
  for (const action of actions) {
    const result = chapterReducer(state, action, scenario);
    results.push(result);
    state = result.state;
    states.push(state);
  }
  return { states, results, final: state };
}

/** Short printable form of a dispatched value, for failure messages. */
export function describeAction(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// State invariants (Property 4)
// ---------------------------------------------------------------------------

function duplicates<T>(items: readonly T[]): T[] {
  return items.filter((item, index) => items.indexOf(item) !== index);
}

/**
 * Checks the state invariants of design.md (Property 4) and returns one message per violation.
 * An empty list means every invariant holds. It returns instead of throwing so a property test
 * can report all violations of a state together with the seed and the shrunk prefix; use
 * `expect(assertInvariants(state)).toEqual([])`.
 */
export function assertInvariants(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): string[] {
  const violations: string[] = [];

  // discovered, deductions and interacted: no duplicates, every ID exists in Scenario_Data.
  for (const id of duplicates(state.discovered)) violations.push(`discovered has duplicate ${id}`);
  for (const id of duplicates(state.deductions)) violations.push(`deductions has duplicate ${id}`);
  for (const id of duplicates(state.interacted)) violations.push(`interacted has duplicate ${id}`);
  for (const id of state.discovered) {
    if (!Object.hasOwn(scenario.evidence, id)) violations.push(`discovered has unknown evidence ${id}`);
  }
  for (const id of state.deductions) {
    if (!Object.hasOwn(scenario.deductions, id)) violations.push(`deductions has unknown deduction ${id}`);
  }
  for (const id of state.interacted) {
    if (!Object.hasOwn(scenario.interactables, id)) violations.push(`interacted has unknown object ${id}`);
  }

  // Each recorded deduction has all its inputs discovered, and the claims it changed are
  // `inconclusive` (or `contradicted` later, by the official line only).
  for (const id of state.deductions) {
    if (!Object.hasOwn(scenario.deductions, id)) continue;
    const def = scenario.deductions[id];
    for (const input of def.inputs) {
      if (!state.discovered.includes(input)) violations.push(`deduction ${id} is recorded without input ${input}`);
    }
    if (def.inputsAnyOf !== undefined && !def.inputsAnyOf.some((input) => state.discovered.includes(input))) {
      violations.push(`deduction ${id} is recorded without any of its alternative inputs`);
    }
    for (const effect of def.effects) {
      if (effect.kind !== "setClaimStatus") continue;
      if (effect.status !== "inconclusive") violations.push(`deduction ${id} sets ${effect.claimId} to ${effect.status}`);
      const status = state.claims[effect.claimId];
      if (status !== "inconclusive" && status !== "contradicted") {
        violations.push(`claim ${effect.claimId} is ${status} after deduction ${id}`);
      }
    }
  }

  // Active and completed objectives are disjoint (and known).
  for (const id of state.objectives.active) {
    if (state.objectives.completed.includes(id)) violations.push(`objective ${id} is both active and completed`);
  }
  for (const id of [...state.objectives.active, ...state.objectives.completed]) {
    if (!Object.hasOwn(scenario.objectives, id)) violations.push(`unknown objective ${id}`);
  }

  // A current conversation points at an existing node of an existing graph.
  const conversation = state.conversation;
  if (conversation !== null) {
    const graph = Object.hasOwn(scenario.dialogues, conversation.graphId)
      ? scenario.dialogues[conversation.graphId]
      : undefined;
    if (!graph) violations.push(`conversation has unknown graph ${conversation.graphId}`);
    else if (!Object.hasOwn(graph.nodes, conversation.nodeId)) {
      violations.push(`conversation node ${conversation.nodeId} is not in ${conversation.graphId}`);
    }
  }

  // call.status in {ringing, active} if and only if call.current !== null.
  const live = state.call.status === "ringing" || state.call.status === "active";
  if (live !== (state.call.current !== null)) {
    violations.push(`call status ${state.call.status} does not match current call ${String(state.call.current)}`);
  }

  // An active call has its conversation linked to it (the official line included).
  if (state.call.status === "active" && state.call.current !== null && conversation?.callId !== state.call.current) {
    violations.push(`active call ${state.call.current} has no linked conversation`);
  }

  // A claim is `contradicted` only when the official confirmation is discovered.
  for (const [claimId, status] of Object.entries(state.claims)) {
    if (status === "contradicted" && !state.discovered.includes("ev.official-confirmation")) {
      violations.push(`claim ${claimId} is contradicted without ev.official-confirmation`);
    }
  }

  // official_channel_verified implies the official confirmation is discovered.
  if (state.flags.official_channel_verified && !state.discovered.includes("ev.official-confirmation")) {
    violations.push("official_channel_verified without ev.official-confirmation");
  }

  // notification_delivered implies callClosed(call.alex).
  if (
    state.flags.notification_delivered &&
    !evaluateConditions([{ kind: "callClosed", callId: "call.alex" }], state, scenario)
  ) {
    violations.push("notification_delivered before call.alex is closed");
  }

  // 0 <= pressure <= 3 (whole number).
  if (!Number.isInteger(state.pressure) || state.pressure < 0 || state.pressure > 3) {
    violations.push(`pressure ${state.pressure} is out of range`);
  }

  // A decision exists if and only if an outcome exists.
  if ((state.decision === null) !== (state.outcome === null)) {
    violations.push(`decision ${String(state.decision)} and outcome ${String(state.outcome)} do not match`);
  }

  // events[i].seq === i.
  state.events.forEach((entry, index) => {
    if (entry.seq !== index) violations.push(`events[${index}].seq is ${entry.seq}`);
  });

  // finished implies outcome.
  if (state.status === "finished" && state.outcome === null) violations.push("finished without an outcome");

  // selectDeception equals the projection of flags, evidence, deductions and decision.
  const expectedDeception = {
    firstCallRejected: state.flags.first_call_rejected === true,
    notificationOpened: state.flags.notification_opened === true,
    notificationOriginInspected: state.flags.notification_origin_inspected === true,
    officialChannelVerified: state.flags.official_channel_verified === true,
    secondCallerTrusted: state.flags.second_caller_trusted === true,
    evidenceDiscovered: [...state.discovered],
    deductionsUnlocked: [...state.deductions],
    finalDecision: state.decision,
  };
  if (JSON.stringify(selectDeception(state)) !== JSON.stringify(expectedDeception)) {
    violations.push("selectDeception does not match the projection of the state");
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Scripted guided policies (one per ending)
// ---------------------------------------------------------------------------

const START: CoreAction = { type: "START_CHAPTER" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };

const ring = (callId: IncomingCallId, reason: RingReason): CoreAction => ({ type: "RING_CALL", callId, reason });
const device = (deviceActionId: DeviceActionId): CoreAction => ({ type: "DEVICE_ACTION", deviceActionId });
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
const decide = (decision: DecisionId): CoreAction => ({ type: "MAKE_DECISION", decision });
const combine = (evidenceIds: EvidenceId[]): CoreAction => ({ type: "COMBINE_EVIDENCE", evidenceIds });

/** Decline Alex. The record, the voicemail and the laptop notification follow. */
export const DECLINE_ALEX: readonly CoreAction[] = [ring("call.alex", "first-interaction"), END_CALL];

/** Answer Alex and read the code (the only way to set `code_shared`). The call ends at the end node. */
export const ALEX_SHARES_CODE: readonly CoreAction[] = [
  ring("call.alex", "first-interaction"),
  ANSWER,
  option("alex.opt.open.ask-details"),
  option("alex.opt.details.go-on"),
  option("alex.share-code"),
];

/** Open the notification, then Review Security. Needs Alex to be closed. */
export const FOLLOW_THE_NOTIFICATION: readonly CoreAction[] = [
  device("dev.open-notification"),
  device("dev.review-security"),
];

/** Answer the third caller (start node `followed`) and trust the procedure. Sets `second_caller_trusted`. */
export const TRUST_THIRD_CALL: readonly CoreAction[] = [
  ring("call.recovery", "follow-up"),
  ANSWER,
  option("rec.opt.start.followed.go-on"),
  option("rec.opt.cites-case.continue"),
  option("rec.opt.confirms-alex.what-needed"),
  option("rec.opt.procedure.continue"),
  option("rec.trust"),
];

/** Read the statement, call the number saved before today and hear the confirmation. */
export const CALL_SAVED_CONTACT: readonly CoreAction[] = [
  { type: "INTERACT_OBJECT", objectId: "obj.receipts" },
  { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "saved-official-contact" },
  option("off.opt.open.ask-case"),
  option("off.opt.ask.give-case"),
  option("off.opt.confirm.all-done"),
];

/** Record `ded.same-source` from Alex's record, the notification details and the case compare view. */
export const LINK_FIRST_TWO: readonly CoreAction[] = [
  device("dev.open-alex-record"),
  device("dev.open-notification"),
  device("dev.inspect-notification-origin"),
  device("dev.compare-case-ref"),
  combine(["ev.alex-statement", "ev.notification-metadata", "ev.shared-case-id"]),
];

/** After `ded.same-source`: take the third call only to read the case reference, hang up, record `ded.third-caller-not-independent`. */
export const EXPOSE_THIRD_CALL: readonly CoreAction[] = [
  ring("call.recovery", "follow-up"),
  ANSWER,
  option("rec.opt.start.confronted.go-on"),
  option("rec.opt.cites-case.hang-up"),
  combine(["ev.recovery-statement", "ev.shared-case-id"]),
];

export interface GuidedCompletion {
  /** Accepted actions taken by the policy, in order (the final FINISH_CHAPTER included). */
  actions: CoreAction[];
  /** First state with an Outcome (before FINISH_CHAPTER). */
  outcomeState: ChapterState;
  /** Final state, with `status === "finished"`. */
  final: ChapterState;
}

/**
 * Plays `script` from the initial state. Every action must be accepted; the first rejection
 * throws with its index. When the script ends with an Outcome, FINISH_CHAPTER is added.
 */
export function playScript(
  script: readonly CoreAction[],
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): GuidedCompletion {
  const actions: CoreAction[] = [];
  let state = createInitialState(scenario);
  let outcomeState: ChapterState | null = null;
  const take = (action: CoreAction): void => {
    const result = chapterReducer(state, action, scenario);
    if (!result.accepted) {
      throw new Error(
        `Script: ${describeAction(action)} rejected at step ${actions.length}: ${result.reason ?? "no reason"}`,
      );
    }
    actions.push(action);
    state = result.state;
    if (outcomeState === null && state.outcome !== null) outcomeState = state;
  };
  for (const action of script) take(action);
  if (outcomeState === null) throw new Error("Script: no Outcome after the last action.");
  take({ type: "FINISH_CHAPTER" });
  return { actions, outcomeState, final: state };
}

/** Ending A, "The False Victory" (`false-victory`): decline Alex, follow the notification, trust the third caller. */
export function reachEndingA(scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): GuidedCompletion {
  return playScript(
    [START, ...DECLINE_ALEX, ...FOLLOW_THE_NOTIFICATION, ...TRUST_THIRD_CALL, decide("follow-recovery")],
    scenario,
  );
}

/** Ending B, "The Perfect Chain" (`perfect-chain`): give Alex the code, then trust the third caller and do both. */
export function reachEndingB(scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): GuidedCompletion {
  return playScript(
    [START, ...ALEX_SHARES_CODE, ...FOLLOW_THE_NOTIFICATION, ...TRUST_THIRD_CALL, decide("follow-both")],
    scenario,
  );
}

export interface EndingCOptions {
  /** Also record `ded.same-source` and `ded.third-caller-not-independent` (the secret `case-report` variant). */
  caseReport?: boolean;
}

/** Ending C, "Break the Chain" (`break-the-chain`): call the number saved before today. */
export function reachEndingC(
  options: EndingCOptions = {},
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): GuidedCompletion {
  const evidence = options.caseReport === true ? [...LINK_FIRST_TWO, ...EXPOSE_THIRD_CALL] : [];
  return playScript(
    [START, ...DECLINE_ALEX, ...evidence, ...CALL_SAVED_CONTACT, decide("verify-independently")],
    scenario,
  );
}

export interface EndingDOptions {
  /** Record `ded.same-source` first (the `evidence-built` variant). */
  evidenceBuilt?: boolean;
}

/** Ending D, "The Unfinished Case" (`unfinished-case`): refuse and stop, without verifying. */
export function reachEndingD(
  options: EndingDOptions = {},
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): GuidedCompletion {
  const script =
    options.evidenceBuilt === true
      ? [START, ...DECLINE_ALEX, ...LINK_FIRST_TWO, decide("refuse-and-stop")]
      : [
          START,
          ...DECLINE_ALEX,
          device("dev.dismiss-notification"),
          ring("call.recovery", "follow-up"),
          END_CALL,
          decide("refuse-and-stop"),
        ];
  return playScript(script, scenario);
}

// ---------------------------------------------------------------------------
// Guided completion policy (soft-lock check)
// ---------------------------------------------------------------------------

/**
 * The next action of the guided completion policy, in priority order:
 * 1. not started: START_CHAPTER; Outcome set: FINISH_CHAPTER; finished: null;
 * 2. a call is current: END_CALL (declines when ringing, hangs up when active);
 * 3. a conversation without a call: its first available option;
 * 4. otherwise the decision from `chooseDecision` (default: `refuse-and-stop`, which needs nothing).
 */
function guidedAction(
  state: ChapterState,
  scenario: ScenarioDefinition,
  chooseDecision: (state: ChapterState) => DecisionId,
): CoreAction | null {
  if (state.status === "finished") return null;
  if (state.status === "not-started") return START;
  if (state.outcome !== null) return { type: "FINISH_CHAPTER" };
  if (state.call.current !== null) return END_CALL;
  if (state.conversation !== null) {
    const [first] = availableOptions(state, scenario);
    if (first) return option(first.id);
  }
  return decide(chooseDecision(state));
}

/**
 * Drives the chapter from any reachable state to an Outcome and then FINISH_CHAPTER, using the
 * guided policy above, within `maxSteps` accepted actions (default 60, design Property 4).
 * Throws when the policy proposes a rejected action or runs out of steps, because either means
 * the state may be soft-locked. From a finished state it returns immediately with no actions.
 */
export function completeChapterFrom(
  start: ChapterState,
  maxSteps: number = GUIDED_POLICY_MAX_STEPS,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
  chooseDecision: (state: ChapterState) => DecisionId = () => "refuse-and-stop",
): GuidedCompletion {
  const actions: CoreAction[] = [];
  let state = start;
  let outcomeState: ChapterState | null = state.outcome !== null ? state : null;
  for (let step = 0; step <= maxSteps; step += 1) {
    const action = guidedAction(state, scenario, chooseDecision);
    if (action === null) {
      if (outcomeState === null) throw new Error("Guided policy: finished state without an outcome.");
      return { actions, outcomeState, final: state };
    }
    if (step === maxSteps) break;
    const result = chapterReducer(state, action, scenario);
    if (!result.accepted) {
      throw new Error(
        `Guided policy: ${describeAction(action)} rejected after ${actions.length} steps: ${result.reason ?? ""}`,
      );
    }
    actions.push(action);
    state = result.state;
    if (outcomeState === null && state.outcome !== null) outcomeState = state;
  }
  throw new Error(`Guided policy: no finished chapter within ${maxSteps} accepted actions.`);
}

// ---------------------------------------------------------------------------
// Careful policy and harmful-option policy (seeded random walks)
// ---------------------------------------------------------------------------

/** True when `after` has a harm flag that `before` did not have. */
export function setsHarm(before: ChapterState, after: ChapterState): boolean {
  return HARM_FLAGS.some((flag) => after.flags[flag] && !before.flags[flag]);
}

interface Simulated {
  action: CoreAction;
  after: ChapterState;
  harmful: boolean;
}

/** Candidate actions (decisions and FINISH_CHAPTER excluded) that the reducer accepts, with their result. */
function simulateCandidates(state: ChapterState, scenario: ScenarioDefinition): Simulated[] {
  const out: Simulated[] = [];
  for (const action of enumerateCandidateActions(state, scenario)) {
    if (action.type === "MAKE_DECISION" || action.type === "FINISH_CHAPTER") continue;
    const result = chapterReducer(state, action, scenario);
    if (result.accepted) out.push({ action, after: result.state, harmful: setsHarm(state, result.state) });
  }
  return out;
}

/** Decisions the reducer accepts now. */
function acceptedDecisions(state: ChapterState, scenario: ScenarioDefinition): Array<{ id: DecisionId; harmful: boolean }> {
  const out: Array<{ id: DecisionId; harmful: boolean }> = [];
  for (const id of DECISION_IDS) {
    const result = chapterReducer(state, decide(id), scenario);
    if (result.accepted) out.push({ id, harmful: setsHarm(state, result.state) });
  }
  return out;
}

/** How much the harmful-option policy likes a candidate. Harm first, then progress inside calls. */
function harmScore(candidate: Simulated, before: ChapterState): number {
  if (candidate.harmful) return 100;
  switch (candidate.action.type) {
    case "ANSWER_CALL":
      return 50;
    case "RING_CALL":
      return 40;
    case "SELECT_DIALOGUE_OPTION":
      return candidate.after.conversation !== null ? 30 : 0;
    case "DEVICE_ACTION":
      return 10;
    case "END_CALL":
      return 0;
    default:
      return before.call.current !== null ? 0 : 1;
  }
}

type WalkMode = "careful" | "harmful";

function walkPolicy(seed: number, mode: WalkMode, scenario: ScenarioDefinition): GuidedCompletion {
  const next = createLcg(seed);
  const walkLength = randomInt(next, 4, 45);
  const actions: CoreAction[] = [];
  let state = createInitialState(scenario);

  const take = (action: CoreAction): void => {
    const result = chapterReducer(state, action, scenario);
    if (!result.accepted) {
      throw new Error(`Policy (${mode}, seed ${seed}): ${describeAction(action)} rejected: ${result.reason ?? ""}`);
    }
    actions.push(action);
    state = result.state;
  };

  take(START);
  for (let i = 0; i < walkLength; i += 1) {
    const candidates = simulateCandidates(state, scenario);
    let pool: Simulated[];
    if (mode === "careful") {
      pool = candidates.filter((candidate) => !candidate.harmful);
    } else {
      const best = Math.max(-1, ...candidates.map((candidate) => harmScore(candidate, state)));
      pool = candidates.filter((candidate) => harmScore(candidate, state) === best);
    }
    if (pool.length === 0) break;
    take(pick(next, pool).action);
  }

  const chooseDecision = (current: ChapterState): DecisionId => {
    const decisions = acceptedDecisions(current, scenario);
    const preferred = mode === "careful" ? decisions.filter((entry) => !entry.harmful) : decisions.filter((entry) => entry.harmful);
    const pool = preferred.length > 0 ? preferred : decisions.filter((entry) => !entry.harmful);
    return pool.length > 0 ? pick(next, pool).id : "refuse-and-stop";
  };
  const completion = completeChapterFrom(state, GUIDED_POLICY_MAX_STEPS, scenario, chooseDecision);
  return { actions: [...actions, ...completion.actions], outcomeState: completion.outcomeState, final: completion.final };
}

/**
 * The careful policy: a seeded random walk that never takes a harmful option (every candidate is
 * simulated first and dropped when it would set `code_shared`, `second_caller_trusted` or
 * `money_moved`), then ends any live call and takes a harmless decision. Reaches an ending.
 */
export function carefulPolicy(seed: number, scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): GuidedCompletion {
  return walkPolicy(seed, "careful", scenario);
}

/**
 * The harmful-option policy: a seeded walk that takes a harmful option whenever one is available,
 * prefers answering and listening to hanging up, and ends with a harmful decision when it can.
 */
export function harmfulOptionPolicy(seed: number, scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): GuidedCompletion {
  return walkPolicy(seed, "harmful", scenario);
}

// ---------------------------------------------------------------------------
// Shrinking
// ---------------------------------------------------------------------------

/**
 * Returns the shortest prefix of `actions` for which `fails(prefix)` is true, or `null` when even
 * the full sequence passes. Re-runs prefixes from length 0 upward (design: "found by re-running
 * prefixes of the failing sequence"). `fails` should replay the prefix from the initial state.
 */
export function shrinkFailingPrefix<T>(actions: readonly T[], fails: (prefix: T[]) => boolean): T[] | null {
  for (let length = 0; length <= actions.length; length += 1) {
    const prefix = actions.slice(0, length);
    if (fails(prefix)) return prefix;
  }
  return null;
}
