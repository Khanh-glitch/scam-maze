// Chapter reducer for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-double-deception/design.md (core and reducer sections).
//
// Pipeline per dispatched value:
// 1. Shape check (`isCoreAction`), otherwise "Unknown action."
// 2. Outcome lock: once an Outcome is set, only FINISH_CHAPTER is accepted.
// 3. Per-action guard from the design's guard table. A failing guard returns a reason.
// 4. Apply the action (pure; the input state is never mutated).
// 5. Beats (pplyBeats): scripted state changes, each once; fired beats are tagged in the event.
// 6. Objective manager (activations and completions).
// 7. Outcome function, when a Decision exists and no Outcome is set yet.
// 8. Append one Event_Log entry with the derived evidence, flags, objectives and debrief tags.
//
// A rejected action returns the same state object, `accepted: false` and a non-empty reason.

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import {
  CALL_IDS,
  CLAIM_IDS,
  DECISION_IDS,
  DEVICE_ACTION_IDS,
  EVIDENCE_IDS,
  FLAG_IDS,
  INTERACTABLE_IDS,
  NPC_IDS,
  OBJECTIVE_IDS,
  VERIFY_METHODS,
  type CallId,
  type ClaimId,
  type DeviceActionId,
  type EvidenceId,
  type FlagId,
  type IncomingCallId,
  type NpcId,
  type ObjectiveId,
  type VerifyMethod,
} from "./chapter1/ids";
import { applyBeats, beatTag } from "./beats";
import { applyEffect, applyEffects, evaluateConditions } from "./conditions";
import { canRecordDeduction, matchDeduction } from "./deductions";
import { endConversation, selectOption, startConversation } from "./dialogueEngine";
import { canDiscover, discover, type DiscoveryTrigger } from "./evidence";
import {
  canCompleteObjective,
  OBJECTIVE_CONDITION_NOT_MET,
  runObjectiveManager,
} from "./objectives";
import { selectOutcome } from "./outcome";
import type {
  ActionResult,
  CallRecord,
  ChapterState,
  ClaimStatus,
  CoreAction,
  EventLogEntry,
  RingReason,
  ScenarioDefinition,
} from "./types";

// ---------------------------------------------------------------------------
// Rejection reasons
// ---------------------------------------------------------------------------

export const REASONS = {
  unknownAction: "Unknown action.",
  chapterEnded: "The chapter has ended.",
  notStarted: "The chapter has not started.",
  alreadyStarted: "The chapter has already started.",
  unknownObject: "This object does not exist.",
  wrongObjectAction: "This object cannot be used that way.",
  callInProgress: "Finish the call first.",
  conversationInProgress: "Finish the conversation first.",
  unknownEvidence: "This evidence does not exist.",
  evidenceNotAvailable: "Evidence not available yet.",
  evidenceAlreadyRecorded: "Evidence already recorded.",
  phoneAlreadyOpen: "The phone is already open.",
  phoneAlreadyClosed: "The phone is already closed.",
  callAlreadyRinging: "A call is already ringing.",
  unknownCall: "This call does not exist.",
  callNotYet: "This call cannot ring yet.",
  callAlreadyRang: "This call has already been answered.",
  decisionAlreadyMade: "A decision has already been made.",
  noCallRinging: "No call is ringing.",
  noCallToEnd: "There is no call to end.",
  unknownNpc: "This person is not here.",
  needOfficialNumber: "You need the bank's official number first.",
  phoneClosed: "Open your phone first.",
  decisionUnavailable: "This decision is not available yet.",
  chapterNotEnded: "The chapter has not ended yet.",
  chapterAlreadyFinished: "The chapter is already finished.",
  // Reason codes for DEVICE_ACTION and COMBINE_EVIDENCE.
  unknownDeviceAction: "This device action does not exist.",
  deviceActionUnavailable: "This action is not available yet.",
  deviceActionAlreadyDone: "This action was already done.",
  combinationInvalid: "These items do not combine.",
  deductionAlreadyRecorded: "This deduction is already recorded.",
} as const;

/** Stable code of a core rejection reason; the UI translates by this code. */
export type ReasonCode = keyof typeof REASONS;

// ---------------------------------------------------------------------------
// Shape check
// ---------------------------------------------------------------------------

const RING_REASONS: readonly RingReason[] = ["first-interaction", "exploration-timer", "re-ring", "callback", "follow-up"];
const INCOMING_CALL_IDS: readonly IncomingCallId[] = CALL_IDS.filter((id): id is IncomingCallId => id !== "call.official");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** True when `value` has the shape of a known Core_Action with known IDs (Requirement 5.4). */
export function isCoreAction(value: unknown): value is CoreAction {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "START_CHAPTER":
    case "OPEN_PHONE":
    case "CLOSE_PHONE":
    case "ANSWER_CALL":
    case "END_CALL":
    case "FINISH_CHAPTER":
      return true;
    case "INTERACT_OBJECT":
      return isOneOf(INTERACTABLE_IDS, value.objectId);
    case "INSPECT_EVIDENCE":
      return isOneOf(EVIDENCE_IDS, value.evidenceId);
    case "RING_CALL":
      return isOneOf(INCOMING_CALL_IDS, value.callId) && isOneOf(RING_REASONS, value.reason);
    case "TALK_TO_NPC":
      // No NPC exists in this chapter; the reducer rejects it with "This person is not here.".
      return typeof value.npcId === "string";
    case "SELECT_DIALOGUE_OPTION":
      return typeof value.optionId === "string" && value.optionId.length > 0;
    case "VERIFY_CLAIM":
      return isOneOf(CLAIM_IDS, value.claimId) && isOneOf(VERIFY_METHODS, value.method);
    case "MAKE_DECISION":
      return isOneOf(DECISION_IDS, value.decision);
    case "COMPLETE_OBJECTIVE":
      return isOneOf(OBJECTIVE_IDS, value.objectiveId);
    case "DEVICE_ACTION":
      return isOneOf(DEVICE_ACTION_IDS, value.deviceActionId);
    case "COMBINE_EVIDENCE":
      return (
        Array.isArray(value.evidenceIds) &&
        value.evidenceIds.length >= 2 &&
        value.evidenceIds.length <= 3 &&
        value.evidenceIds.every((id) => isOneOf(EVIDENCE_IDS, id)) &&
        new Set(value.evidenceIds).size === value.evidenceIds.length
      );
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function recordOf<K extends string, V>(keys: readonly K[], value: () => V): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const key of keys) record[key] = value();
  return record;
}

/** The state before START_CHAPTER. Every Claim is `unverified` and every flag is false. */
export function createInitialState(_scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): ChapterState {
  return {
    chapterId: "chapter-1",
    status: "not-started",
    objectives: { active: [], completed: [] },
    phone: { open: false, unread: [], messages: [] },
    call: { current: null, status: "idle", log: [] },
    conversation: null,
    conversationHistory: [],
    npc: recordOf<NpcId, { timesTalked: number }>(NPC_IDS, () => ({ timesTalked: 0 })),
    interacted: [],
    discovered: [],
    claims: recordOf<ClaimId, ClaimStatus>(CLAIM_IDS, () => "unverified"),
    decision: null,
    deductions: [],
    flags: recordOf<FlagId, boolean>(FLAG_IDS, () => false),
    pressure: 0,
    outcome: null,
    events: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ApplyResult = { ok: true; state: ChapterState; debriefTags: string[] } | { ok: false; reason: string };

function reject(reason: string): ApplyResult {
  return { ok: false, reason };
}

function accept(state: ChapterState, debriefTags: string[] = []): ApplyResult {
  return { ok: true, state, debriefTags };
}

function findRecordIndex(state: ChapterState, callId: CallId): number {
  for (let i = state.call.log.length - 1; i >= 0; i -= 1) {
    if (state.call.log[i].callId === callId) return i;
  }
  return -1;
}

/** True when the call has any record in the call log (it rang before, whatever happened to it). */
function hasRung(state: ChapterState, callId: CallId): boolean {
  return state.call.log.some((record) => record.callId === callId);
}

/** True when an accepted VERIFY_CLAIM with this method is in the Event_Log. */
function hasVerifiedBy(state: ChapterState, method: VerifyMethod): boolean {
  return state.events.some((entry) => entry.action.type === "VERIFY_CLAIM" && entry.action.method === method);
}

/** True when an accepted DEVICE_ACTION with this ID is in the Event_Log. */
function hasDoneDeviceAction(state: ChapterState, id: DeviceActionId): boolean {
  return state.events.some((entry) => entry.action.type === "DEVICE_ACTION" && entry.action.deviceActionId === id);
}

/** Updates the latest record for `callId`, or appends a new one built from Scenario_Data. */
function upsertCallRecord(
  state: ChapterState,
  callId: CallId,
  update: (record: CallRecord | null) => CallRecord,
): CallRecord[] {
  const index = findRecordIndex(state, callId);
  if (index === -1) return [...state.call.log, update(null)];
  return state.call.log.map((record, i) => (i === index ? update(record) : record));
}

function newCallRecord(callId: CallId, scenario: ScenarioDefinition): CallRecord {
  const def = scenario.calls[callId];
  return {
    callId,
    direction: def.direction,
    displayName: def.displayName,
    number: def.number,
    status: "ringing",
    ringCount: 0,
  };
}

/** Discovers every `dialogue-node` evidence item whose node has been reached (idempotent). */
function sweepDialogueEvidence(state: ChapterState, scenario: ScenarioDefinition): ChapterState {
  let next = state;
  for (const id of Object.keys(scenario.evidence) as EvidenceId[]) {
    if (scenario.evidence[id].discovery.via !== "dialogue-node") continue;
    if (canDiscover(next, id, "dialogue-node", scenario)) next = discover(next, id);
  }
  return next;
}

/** Discovers every evidence item that matches the trigger (idempotent). */
function discoverByTrigger(
  state: ChapterState,
  ids: readonly EvidenceId[],
  trigger: DiscoveryTrigger,
  scenario: ScenarioDefinition,
): ChapterState {
  let next = state;
  for (const id of ids) {
    if (canDiscover(next, id, trigger, scenario)) next = discover(next, id);
  }
  return next;
}

/** Debrief tag recorded when the player hangs up an active call with END_CALL. */
const HANG_UP_TAG = "hung-up";

/** Flag recorded when the player declines or hangs up the first call (Requirement 5, first call). */
const FIRST_CALL_ID: CallId = "call.alex";
const FIRST_CALL_REJECTED_FLAG: FlagId = "first_call_rejected";

// ---------------------------------------------------------------------------
// Per-action guard and apply
// ---------------------------------------------------------------------------

function applyAction(state: ChapterState, action: CoreAction, scenario: ScenarioDefinition): ApplyResult {
  if (action.type !== "START_CHAPTER" && action.type !== "FINISH_CHAPTER" && state.status === "not-started") {
    return reject(REASONS.notStarted);
  }

  switch (action.type) {
    case "START_CHAPTER": {
      if (state.status !== "not-started") return reject(REASONS.alreadyStarted);
      let next: ChapterState = {
        ...state,
        status: "playing",
        claims: recordOf<ClaimId, ClaimStatus>(CLAIM_IDS, () => "unverified"),
      };
      for (const message of Object.values(scenario.phone.messages)) {
        if (message.deliveredAtStart) {
          next = applyEffect(next, { kind: "deliverMessage", messageId: message.id }, scenario);
        }
      }
      return accept(next);
    }

    case "INTERACT_OBJECT": {
      if (!Object.hasOwn(scenario.interactables, action.objectId)) return reject(REASONS.unknownObject);
      const def = scenario.interactables[action.objectId];
      if (def.produces.type !== "INTERACT_OBJECT") return reject(REASONS.wrongObjectAction);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      let next = state.interacted.includes(action.objectId)
        ? state
        : { ...state, interacted: [...state.interacted, action.objectId] };
      next = discoverByTrigger(next, def.reveals, { via: "interact", objectId: action.objectId }, scenario);
      return accept(next);
    }

    case "INSPECT_EVIDENCE": {
      if (!Object.hasOwn(scenario.evidence, action.evidenceId)) return reject(REASONS.unknownEvidence);
      if (state.discovered.includes(action.evidenceId)) return reject(REASONS.evidenceAlreadyRecorded);
      if (!canDiscover(state, action.evidenceId, { via: "inspect" }, scenario)) {
        return reject(REASONS.evidenceNotAvailable);
      }
      let next = discover(state, action.evidenceId);
      const readIds = Object.values(scenario.phone.messages)
        .filter((message) => message.evidenceId === action.evidenceId)
        .map((message) => message.id);
      if (readIds.some((id) => next.phone.unread.includes(id))) {
        next = {
          ...next,
          phone: { ...next.phone, unread: next.phone.unread.filter((id) => !readIds.includes(id)) },
        };
      }
      return accept(next);
    }

    case "OPEN_PHONE": {
      if (state.phone.open) return reject(REASONS.phoneAlreadyOpen);
      return accept({ ...state, phone: { ...state.phone, open: true } });
    }

    case "CLOSE_PHONE": {
      if (!state.phone.open) return reject(REASONS.phoneAlreadyClosed);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      return accept({ ...state, phone: { ...state.phone, open: false } });
    }

    case "RING_CALL": {
      if (state.call.status === "ringing") return reject(REASONS.callAlreadyRinging);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      const callId = action.callId;
      if (!Object.hasOwn(scenario.calls, callId)) return reject(REASONS.unknownCall);
      const def = scenario.calls[callId];
      if (def.direction !== "incoming") return reject(REASONS.callNotYet);
      if (state.decision !== null) return reject(REASONS.decisionAlreadyMade);
      // Every incoming call rings at most once: answered, declined, missed or ended calls never ring again.
      if (hasRung(state, callId)) return reject(REASONS.callAlreadyRang);
      if (!def.ringWhen.some((all) => evaluateConditions(all, state, scenario))) {
        return reject(REASONS.callNotYet);
      }
      const next: ChapterState = {
        ...state,
        call: {
          current: callId,
          status: "ringing",
          log: upsertCallRecord(state, callId, (record) => ({
            ...(record ?? newCallRecord(callId, scenario)),
            status: "ringing",
            ringCount: (record?.ringCount ?? 0) + 1,
          })),
        },
      };
      return accept(next);
    }

    case "ANSWER_CALL": {
      const callId = state.call.current;
      if (state.call.status !== "ringing" || callId === null) return reject(REASONS.noCallRinging);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      const answered: ChapterState = {
        ...state,
        call: {
          current: callId,
          status: "active",
          log: upsertCallRecord(state, callId, (record) => ({
            ...(record ?? newCallRecord(callId, scenario)),
            status: "answered",
          })),
        },
      };
      let next = startConversation(answered, scenario.calls[callId].graphId, scenario, { callId });
      next = sweepDialogueEvidence(next, scenario);
      return accept(next);
    }

    case "END_CALL": {
      const callId = state.call.current;
      if (callId === null) return reject(REASONS.noCallToEnd);
      if (state.call.status === "ringing") {
        // Decline: the call record stays in the log as declined.
        let declined: ChapterState = {
          ...state,
          call: {
            current: null,
            status: "declined",
            log: upsertCallRecord(state, callId, (record) => ({
              ...(record ?? newCallRecord(callId, scenario)),
              status: "declined",
            })),
          },
        };
        if (callId === FIRST_CALL_ID) {
          declined = applyEffect(declined, { kind: "setFlag", flag: FIRST_CALL_REJECTED_FLAG }, scenario);
        }
        return accept(declined);
      }
      // Hang up an active call: end its conversation at the current node.
      let next =
        state.conversation !== null && state.conversation.callId === callId
          ? endConversation(state, null)
          : state;
      if (next.call.current !== null) {
        next = {
          ...next,
          call: {
            current: null,
            status: "ended",
            log: upsertCallRecord(next, callId, (record) => ({
              ...(record ?? newCallRecord(callId, scenario)),
              status: "ended",
            })),
          },
        };
      }
      if (callId === FIRST_CALL_ID) {
        next = applyEffect(next, { kind: "setFlag", flag: FIRST_CALL_REJECTED_FLAG }, scenario);
      }
      return accept(next, [HANG_UP_TAG]);
    }

    case "TALK_TO_NPC": {
      // This chapter has no NPC conversations (`NPC_IDS` is empty), so every NPC is unknown.
      return reject(REASONS.unknownNpc);
    }

    case "SELECT_DIALOGUE_OPTION": {
      const result = selectOption(state, action.optionId, scenario);
      if (!result.ok) return reject(result.reason);
      return accept(sweepDialogueEvidence(result.state, scenario), result.debriefTags);
    }

    case "VERIFY_CLAIM":
      return applyVerify(state, action.claimId, action.method, scenario);

    case "MAKE_DECISION": {
      if (state.decision !== null) return reject(REASONS.decisionAlreadyMade);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (!Object.hasOwn(scenario.decisions, action.decision)) return reject(REASONS.decisionUnavailable);
      const def = scenario.decisions[action.decision];
      if (!evaluateConditions(def.requires, state, scenario)) {
        return reject(def.unavailableHint || REASONS.decisionUnavailable);
      }
      let next = applyEffects(state, def.effects, scenario);
      next = applyEffect(next, { kind: "recordDecision", decision: action.decision }, scenario);
      return accept(next, def.debriefTag ? [def.debriefTag] : []);
    }

    case "COMPLETE_OBJECTIVE": {
      if (!canCompleteObjective(state, action.objectiveId, scenario)) {
        return reject(OBJECTIVE_CONDITION_NOT_MET);
      }
      return accept({
        ...state,
        objectives: {
          active: state.objectives.active.filter((id) => id !== action.objectiveId),
          completed: OBJECTIVE_IDS.filter(
            (id) => id === action.objectiveId || state.objectives.completed.includes(id),
          ),
        },
      });
    }

    case "FINISH_CHAPTER": {
      if (state.outcome === null) return reject(REASONS.chapterNotEnded);
      if (state.status === "finished") return reject(REASONS.chapterAlreadyFinished);
      return accept({ ...state, status: "finished" });
    }

    case "DEVICE_ACTION": {
      if (!Object.hasOwn(scenario.deviceActions, action.deviceActionId)) {
        return reject(REASONS.unknownDeviceAction);
      }
      const def = scenario.deviceActions[action.deviceActionId];
      if (def.once && hasDoneDeviceAction(state, def.id)) return reject(REASONS.deviceActionAlreadyDone);
      if (!evaluateConditions(def.requires, state, scenario)) return reject(REASONS.deviceActionUnavailable);
      let next = applyEffects(state, def.effects, scenario);
      next = discoverByTrigger(next, def.reveals, { via: "device", deviceActionId: def.id }, scenario);
      return accept(next, def.debriefTag ? [def.debriefTag] : []);
    }

    case "COMBINE_EVIDENCE": {
      const ids = action.evidenceIds;
      if (!ids.every((id) => Object.hasOwn(scenario.evidence, id) && state.discovered.includes(id))) {
        return reject(REASONS.evidenceNotAvailable);
      }
      const deduction = matchDeduction(ids, scenario);
      if (deduction === null) return reject(REASONS.combinationInvalid);
      if (state.deductions.includes(deduction.id)) return reject(REASONS.deductionAlreadyRecorded);
      if (!canRecordDeduction(state, deduction, scenario)) return reject(REASONS.combinationInvalid);
      const recorded: ChapterState = { ...state, deductions: [...state.deductions, deduction.id] };
      return accept(applyEffects(recorded, deduction.effects, scenario), [deduction.debriefTag]);
    }
  }
}

function applyVerify(
  state: ChapterState,
  claimId: ClaimId,
  method: VerifyMethod,
  scenario: ScenarioDefinition,
): ApplyResult {
  if (method === "saved-official-contact") {
    // E03 (paper) or E03b (app): the saved official contact.
    if (!state.discovered.includes("ev.official-contact-paper") && !state.discovered.includes("ev.official-contact-app")) {
      return reject(REASONS.needOfficialNumber);
    }
    if (state.call.current !== null) return reject(REASONS.callInProgress);
    if (state.conversation !== null) return reject(REASONS.conversationInProgress);
    if (state.decision !== null) return reject(REASONS.decisionAlreadyMade);
    // The player calls the saved official contact: an outgoing Call linked to the official line graph.
    const callId: CallId = "call.official";
    if (!Object.hasOwn(scenario.calls, callId)) return reject(REASONS.unknownCall);
    const calling: ChapterState = {
      ...state,
      call: {
        current: callId,
        status: "active",
        log: upsertCallRecord(state, callId, (record) => ({
          ...(record ?? newCallRecord(callId, scenario)),
          status: "answered",
          ringCount: (record?.ringCount ?? 0) + 1,
        })),
      },
    };
    let next = startConversation(calling, scenario.calls[callId].graphId, scenario, { callId });
    next = discoverByTrigger(next, EVIDENCE_IDS, { via: "verify", method }, scenario);
    next = sweepDialogueEvidence(next, scenario);
    return accept(next);
  }

  // bank-app
  if (!state.phone.open) return reject(REASONS.phoneClosed);
  if (state.call.current !== null) return reject(REASONS.callInProgress);
  if (hasVerifiedBy(state, method)) return reject(REASONS.evidenceAlreadyRecorded);
  let next = discoverByTrigger(state, EVIDENCE_IDS, { via: "verify", method }, scenario);
  // The app is not an independent channel, so the result is `inconclusive`.
  // A `contradicted` status from the official line is kept, because it is the stronger result.
  if (next.claims[claimId] !== "contradicted") {
    next = applyEffect(next, { kind: "setClaimStatus", claimId, status: "inconclusive" }, scenario);
  }
  return accept(next);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Computes the next Chapter_State from the current state, a dispatched value and Scenario_Data
 * (Requirement 5.5). Every call returns an Action_Result (Requirement 5.2). Rejections return
 * the input state object unchanged with a non-empty reason (Requirement 5.3).
 */
export function chapterReducer(
  state: ChapterState,
  action: unknown,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): ActionResult {
  // 1. Shape check.
  if (!isCoreAction(action)) return { state, accepted: false, reason: REASONS.unknownAction };

  // 2. Outcome lock (Requirement 5.9).
  if (state.outcome !== null && action.type !== "FINISH_CHAPTER") {
    return { state, accepted: false, reason: REASONS.chapterEnded };
  }

  // 3 and 4. Guard and apply.
  const applied = applyAction(state, action, scenario);
  if (!applied.ok) return { state, accepted: false, reason: applied.reason };

  // 5. Beats. The fired IDs are tagged in this entry so a beat never fires twice.
  const beats = applyBeats(applied.state, scenario);
  const debriefTags = [...applied.debriefTags, ...beats.fired.map(beatTag)];

  // 6. Objective manager.
  const manager = runObjectiveManager(state, beats.state, action, scenario);
  let next = manager.state;
  const objectivesCompleted: ObjectiveId[] = [...manager.completed];
  if (action.type === "COMPLETE_OBJECTIVE" && !objectivesCompleted.includes(action.objectiveId)) {
    objectivesCompleted.unshift(action.objectiveId);
  }

  // 6. Outcome (Requirement 13.6).
  if (next.outcome === null && next.decision !== null) {
    const outcome = selectOutcome(next, scenario);
    if (outcome !== null) {
      next = { ...next, outcome, status: next.status === "finished" ? "finished" : "ended" };
    }
  }

  // 7. Event_Log append (Requirement 5.6).
  const entry: EventLogEntry = {
    seq: state.events.length,
    action,
    derived: {
      evidence: next.discovered.filter((id) => !state.discovered.includes(id)),
      flags: FLAG_IDS.filter((flag) => next.flags[flag] === true && state.flags[flag] !== true),
      objectivesActivated: [...manager.activated],
      objectivesCompleted,
      debriefTags,
    },
  };
  next = { ...next, events: [...state.events, entry] };

  return { state: next, accepted: true };
}
