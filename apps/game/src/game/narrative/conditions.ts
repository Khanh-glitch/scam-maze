// Conditions and effects for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Dialogue engine" and "Evidence registry".
//
// Every function here is pure. `applyEffect` never mutates its input: it returns a new
// ChapterState when the effect changes something, and the same object when the effect is a
// no-op (already set, unknown ID, already recorded). Callers can compare by identity.

import type { CallId } from "./chapter1/ids";
import { discover } from "./evidence";
import { CHAPTER_1_INITIAL_STATE, clampResource, isPersistentFlagId, isResourceId } from "./resources";
import type { ChapterState, Condition, Effect, LedgerCategory, PressureLevel, ScenarioDefinition } from "./types";

/** Highest pressure level (Requirement 10.6). */
export const MAX_PRESSURE: PressureLevel = 3;

/** True when the call was answered and has since ended (a declined call does not count). */
function hasCallEnded(state: ChapterState, callId: CallId): boolean {
  return state.call.log.some((record) => record.callId === callId && record.status === "ended");
}

/**
 * Evaluates one data-defined condition against the state.
 * `scenario` is accepted for symmetry with `applyEffect`; the current condition kinds only read
 * Chapter_State.
 */
export function evaluateCondition(
  condition: Condition,
  state: ChapterState,
  scenario?: ScenarioDefinition,
): boolean {
  switch (condition.kind) {
    case "hasEvidence":
      return state.discovered.includes(condition.evidenceId);
    case "hasAnyEvidence":
      return condition.evidenceIds.some((id) => state.discovered.includes(id));
    case "flag":
      return state.flags[condition.flag] === true;
    case "notFlag":
      return state.flags[condition.flag] !== true;
    case "callEnded":
      return hasCallEnded(state, condition.callId);
    case "claimStatus":
      return state.claims[condition.claimId] === condition.status;
    case "callRang":
      return state.call.log.some((record) => record.callId === condition.callId);
    case "callClosed":
      return state.call.log.some(
        (record) =>
          record.callId === condition.callId &&
          (record.status === "ended" || record.status === "declined" || record.status === "missed"),
      );
    case "deductionRecorded":
      return state.deductions.includes(condition.deductionId);
    case "decisionIs":
      return state.decision === condition.decision;
    case "objectiveCompleted":
      return state.objectives.completed.includes(condition.objectiveId);
    case "outcomeSet":
      return state.outcome !== null;
    case "evidenceCountAtLeast": {
      const found = condition.evidenceIds.filter((id) => state.discovered.includes(id)).length;
      return found >= condition.count;
    }
    case "resourceAtLeast":
      return isResourceId(condition.resource) && state.resources[condition.resource] >= condition.value;
    case "resourceAtMost":
      return isResourceId(condition.resource) && state.resources[condition.resource] <= condition.value;
    case "persistent":
      return isPersistentFlagId(condition.flag) && state.persistent[condition.flag] === condition.value;
    case "elapsedAtLeast": {
      const start = (scenario?.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
      return start - state.resources.timeMinutes >= condition.minutes;
    }
    case "eventStatus": {
      const current = Object.hasOwn(state.world.events, condition.eventId) ? state.world.events[condition.eventId] : null;
      return condition.status === "not-arrived" ? current === null : current?.status === condition.status;
    }
    case "eventResponse": {
      if (!Object.hasOwn(state.world.events, condition.eventId)) return false;
      return state.world.events[condition.eventId].response === condition.response;
    }
    case "missionStatus":
      return Object.hasOwn(state.world.missions, condition.missionId) && state.world.missions[condition.missionId].status === condition.status;
    case "itemArrived":
      return Object.hasOwn(state.device.items, condition.itemId);
    case "itemOpened":
      return Object.hasOwn(state.device.items, condition.itemId) && state.device.items[condition.itemId].read;
    case "itemActionDone":
      return Object.hasOwn(state.device.items, condition.itemId) && state.device.items[condition.itemId].done.includes(condition.actionId);
    case "anyOf":
      return condition.conditions.some((inner) => evaluateCondition(inner, state, scenario));
    case "allOf":
      return condition.conditions.every((inner) => evaluateCondition(inner, state, scenario));
    case "not":
      return !evaluateCondition(condition.condition, state, scenario);
    case "missionOpenFor": {
      if (!Object.hasOwn(state.world.missions, condition.missionId)) return false;
      const mission = state.world.missions[condition.missionId];
      if (mission.status !== "open" || mission.openedAtMinute === null) return false;
      const start = (scenario?.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
      return start - state.resources.timeMinutes - mission.openedAtMinute >= condition.minutes;
    }
    case "thesisTaskDone":
      return state.world.thesisTasksDone.includes(condition.taskId);
    case "atLocation":
      return state.device.location === condition.placeId;
    case "submission":
      return state.device.submission === condition.status;
    case "missionPath":
      return Object.hasOwn(state.world.missions, condition.missionId) && state.world.missions[condition.missionId].path === condition.path;
    default:
      return assertNever(condition);
  }
}

/** True when every condition holds. An empty or missing list holds. */
export function evaluateConditions(
  conditions: readonly Condition[] | undefined,
  state: ChapterState,
  scenario?: ScenarioDefinition,
): boolean {
  if (!conditions) return true;
  return conditions.every((condition) => evaluateCondition(condition, state, scenario));
}

function clampPressure(value: number): PressureLevel {
  return Math.min(MAX_PRESSURE, Math.max(0, value)) as PressureLevel;
}

/**
 * Applies one data-defined effect and returns the resulting state. Never mutates `state`.
 *
 * - `setFlag`: sets the flag to true.
 * - `discoverEvidence`: idempotent append to `discovered` (unknown evidence IDs are ignored).
 * - `addPressure`: adds `amount` (default 1, whole numbers), clamped to 0..3.
 * - `setClaimStatus`: sets the Claim status. Only independent-channel graphs may author this
 *   effect; `validateScenario` enforces that rule (Requirement 12.6).
 * - `recordDecision`: records the Decision only if none is recorded yet.
 * - `deliverMessage`: appends a known message to the phone inbox and marks it unread, once.
 * - `adjustResource`: adds a whole-number `delta` to a resource, clamped to its limits.
 * - `openMission` and `lockMission`: move a mission between locked and open. They never touch
 *   resources, persistent flags or finished missions, so a consequence is never reset.
 * - `setPersistent`: sets a persistent flag. Persistent flags are never cleared by later missions
 *   unless a scenario effect sets them back explicitly.
 */
export function applyEffect(
  state: ChapterState,
  effect: Effect,
  scenario: ScenarioDefinition,
): ChapterState {
  switch (effect.kind) {
    case "setFlag": {
      if (state.flags[effect.flag] === true) return state;
      return { ...state, flags: { ...state.flags, [effect.flag]: true } };
    }
    case "discoverEvidence": {
      if (!Object.hasOwn(scenario.evidence, effect.evidenceId)) return state;
      return discover(state, effect.evidenceId);
    }
    case "addPressure": {
      const amount = effect.amount ?? 1;
      if (!Number.isFinite(amount)) return state;
      const next = clampPressure(state.pressure + Math.trunc(amount));
      if (next === state.pressure) return state;
      return { ...state, pressure: next };
    }
    case "setClaimStatus": {
      if (!Object.hasOwn(scenario.claims, effect.claimId)) return state;
      if (state.claims[effect.claimId] === effect.status) return state;
      return { ...state, claims: { ...state.claims, [effect.claimId]: effect.status } };
    }
    case "recordDecision": {
      if (state.decision !== null) return state;
      if (!Object.hasOwn(scenario.decisions, effect.decision)) return state;
      return { ...state, decision: effect.decision };
    }
    case "deliverMessage": {
      if (!Object.hasOwn(scenario.phone.messages, effect.messageId)) return state;
      if (state.phone.messages.includes(effect.messageId)) return state;
      return {
        ...state,
        phone: {
          ...state.phone,
          messages: [...state.phone.messages, effect.messageId],
          unread: state.phone.unread.includes(effect.messageId)
            ? state.phone.unread
            : [...state.phone.unread, effect.messageId],
        },
      };
    }
    case "adjustResource": {
      if (!isResourceId(effect.resource) || !Number.isFinite(effect.delta)) return state;
      const current = state.resources[effect.resource];
      const next = clampResource(effect.resource, current + Math.trunc(effect.delta));
      if (next === current) return state;
      return { ...state, resources: { ...state.resources, [effect.resource]: next } };
    }
    case "setPersistent": {
      if (!isPersistentFlagId(effect.flag)) return state;
      if (state.persistent[effect.flag] === effect.value) return state;
      return { ...state, persistent: { ...state.persistent, [effect.flag]: effect.value } };
    }
    case "deliverItem": {
      if (Object.hasOwn(state.device.items, effect.itemId)) return state;
      if (!scenario.deviceItems?.some((item) => item.id === effect.itemId)) return state;
      const start = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
      const now = Math.max(0, start - state.resources.timeMinutes);
      return {
        ...state,
        device: { ...state.device, items: { ...state.device.items, [effect.itemId]: { arrivedAtMinute: now, read: false, readAtMinute: null, done: [] } } },
      };
    }
    case "recordTransaction": {
      // `limitToCash`: money that leaves without the player's approval can only take what is there.
      const amount = effect.limitToCash === true && effect.amount < 0 ? -Math.min(-Math.trunc(effect.amount), Math.max(0, state.resources.cash)) : effect.amount;
      return recordTransaction(state, scenario, effect.label, amount, effect.counterparty ?? null, null, null, effect.category ?? null);
    }
    case "setLocation": {
      if (state.device.location === effect.placeId) return state;
      return { ...state, device: { ...state.device, location: effect.placeId } };
    }
    case "setSubmission": {
      if (state.device.submission === effect.status) return state;
      return { ...state, device: { ...state.device, submission: effect.status } };
    }
    case "openMission": {
      if (!Object.hasOwn(state.world.missions, effect.missionId)) return state;
      const mission = state.world.missions[effect.missionId];
      if (mission.status !== "locked") return state;
      const start = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
      const now = Math.max(0, start - state.resources.timeMinutes);
      return {
        ...state,
        world: { ...state.world, missions: { ...state.world.missions, [effect.missionId]: { ...mission, status: "open", openedAtMinute: now } } },
      };
    }
    case "lockMission": {
      if (!Object.hasOwn(state.world.missions, effect.missionId)) return state;
      const mission = state.world.missions[effect.missionId];
      if (mission.status !== "open") return state;
      return {
        ...state,
        world: { ...state.world, missions: { ...state.world.missions, [effect.missionId]: { ...mission, status: "locked" } } },
      };
    }
    default:
      return assertNever(effect);
  }
}

/**
 * Moves money (cash may go below zero) and adds a bank ledger line. A zero or non-finite amount
 * changes nothing. `itemId` and `actionId` name the device action that made the payment, if any.
 */
export function recordTransaction(
  state: ChapterState,
  scenario: ScenarioDefinition,
  label: string,
  amount: number,
  counterparty: string | null,
  itemId: string | null,
  actionId: string | null,
  category: LedgerCategory | null = null,
): ChapterState {
  if (!Number.isFinite(amount) || Math.trunc(amount) === 0) return state;
  const whole = Math.trunc(amount);
  const start = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
  const now = Math.max(0, start - state.resources.timeMinutes);
  const entry = {
    seq: state.device.ledger.length,
    atMinute: now,
    label,
    amount: whole,
    counterparty,
    itemId,
    actionId,
    ...(category !== null ? { category } : {}),
  };
  return {
    ...state,
    resources: { ...state.resources, cash: clampResource("cash", state.resources.cash + whole) },
    device: { ...state.device, ledger: [...state.device.ledger, entry] },
  };
}
/** Applies effects in order. Returns the input object when no effect changed anything. */
export function applyEffects(
  state: ChapterState,
  effects: readonly Effect[] | undefined,
  scenario: ScenarioDefinition,
): ChapterState {
  if (!effects) return state;
  return effects.reduce((current, effect) => applyEffect(current, effect, scenario), state);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
