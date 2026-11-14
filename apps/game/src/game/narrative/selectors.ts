// Selectors for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Store" (selectors) and
// Requirements 11.7-11.9, 13.1-13.3.
//
// Every view selector is memoized by state identity (and scenario identity), so calling it twice
// with the same state returns the same object. This keeps `useSyncExternalStore` bindings stable.
// Selectors never mutate their inputs and read only Chapter_State and Scenario_Data.

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type {
  CallId,
  ClaimId,
  DecisionId,
  DeductionId,
  DeviceActionId,
  DialogueGraphId,
  EvidenceId,
  IncomingCallId,
  InteractableId,
  MessageId,
  NpcId,
  ObjectiveId,
  VerifyMethod,
} from "./chapter1/ids";
import { evaluateConditions } from "./conditions";
import { availableOptions, type DialogueOptionView } from "./dialogueEngine";
import { canRecordDeduction, matchDeduction } from "./deductions";
import { canDiscover } from "./evidence";
import { canCompleteObjective } from "./objectives";
import { REASONS, type ReasonCode } from "./reducer";
import type {
  ActDef,
  CallRecord,
  ChapterState,
  ClaimStatus,
  CoreAction,
  DialogueNode,
  EvidenceItem,
  Objective,
  ScenarioDefinition,
  Stance,
} from "./types";

// ---------------------------------------------------------------------------
// Display text
// ---------------------------------------------------------------------------

/**
 * Journal text for each Stance (Requirements 11.8, 11.9). A `contradicts` Stance is described as
 * pointing against the Claim, never as proof.
 */
export const STANCE_TEXT: Record<Stance, string> = {
  supports: "Points toward this claim",
  contradicts: "Points against this claim",
  inconclusive: "Does not settle this claim",
  "needs-verification": "Needs checking through a channel you trust",
};

/** Journal text for each Claim status. */
export const CLAIM_STATUS_TEXT: Record<ClaimStatus, string> = {
  unverified: "Not checked yet",
  supported: "Evidence points toward this claim",
  contradicted: "Contradicted by Northgate's official line",
  inconclusive: "Checked, but not settled",
};

/** Speaker name shown for the player's own lines. */
export const PLAYER_SPEAKER_NAME = "You";

/** Claim checked by each VERIFY_CLAIM method when the method is not tied to a decision. */
const VERIFY_METHOD_CLAIM: Record<VerifyMethod, ClaimId> = {
  "saved-official-contact": "claim.alex-identity",
  "bank-app": "claim.recovery-needed",
};

// ---------------------------------------------------------------------------
// Memoization by state identity
// ---------------------------------------------------------------------------

function memoByState<R>(
  compute: (state: ChapterState, scenario: ScenarioDefinition) => R,
): (state: ChapterState, scenario?: ScenarioDefinition) => R {
  const cache = new WeakMap<ChapterState, WeakMap<ScenarioDefinition, { value: R }>>();
  return (state, scenario = CHAPTER_1_SCENARIO) => {
    let byScenario = cache.get(state);
    if (!byScenario) {
      byScenario = new WeakMap();
      cache.set(state, byScenario);
    }
    const hit = byScenario.get(scenario);
    if (hit) return hit.value;
    const value = compute(state, scenario);
    byScenario.set(scenario, { value });
    return value;
  };
}

function hasRung(state: ChapterState, callId: CallId): boolean {
  return state.call.log.some((record) => record.callId === callId);
}

function hasDoneDeviceAction(state: ChapterState, id: DeviceActionId): boolean {
  return state.events.some((entry) => entry.action.type === "DEVICE_ACTION" && entry.action.deviceActionId === id);
}

function hasVerifiedBy(state: ChapterState, method: VerifyMethod): boolean {
  return state.events.some((entry) => entry.action.type === "VERIFY_CLAIM" && entry.action.method === method);
}

function incomingCallIds(scenario: ScenarioDefinition): IncomingCallId[] {
  return (Object.keys(scenario.calls) as CallId[]).filter(
    (id): id is IncomingCallId => scenario.calls[id].direction === "incoming",
  );
}

function isPlaying(state: ChapterState): boolean {
  return state.status === "playing" && state.outcome === null;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

/** Active objectives with their text, in objective order. */
export const selectActiveObjectives = memoByState((state, scenario): Objective[] =>
  state.objectives.active
    .filter((id) => Object.hasOwn(scenario.objectives, id))
    .map((id) => scenario.objectives[id]),
);

// ---------------------------------------------------------------------------
// Acts
// ---------------------------------------------------------------------------

/**
 * The current act: the last act (highest index) whose `enterWhen` holds. Falls back to the first
 * act when none holds. Pure; reads only Chapter_State and Scenario_Data.
 */
export function selectCurrentAct(state: ChapterState, scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): ActDef {
  let current = scenario.acts[0];
  for (const act of scenario.acts) {
    if (evaluateConditions(act.enterWhen, state, scenario)) current = act;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

export interface DialogueView {
  graphId: DialogueGraphId;
  nodeId: string;
  /** Linked Call, or `null` for a face-to-face conversation. */
  callId: CallId | null;
  channel: "phone" | "face-to-face";
  speaker: DialogueNode["speaker"];
  /** Persona name for caller and NPC lines, "You" for player lines, `null` for system lines. */
  speakerName: string | null;
  line: string;
  options: DialogueOptionView[];
}

/** The current conversation as the Dialogue panel shows it, or `null` when there is none. */
export const selectDialogueView = memoByState((state, scenario): DialogueView | null => {
  const conversation = state.conversation;
  if (!conversation || !Object.hasOwn(scenario.dialogues, conversation.graphId)) return null;
  const graph = scenario.dialogues[conversation.graphId];
  if (!Object.hasOwn(graph.nodes, conversation.nodeId)) return null;
  const node = graph.nodes[conversation.nodeId];
  const speakerName =
    node.speaker === "caller" || node.speaker === "npc"
      ? graph.persona.name
      : node.speaker === "player"
        ? PLAYER_SPEAKER_NAME
        : null;
  return {
    graphId: graph.id,
    nodeId: node.id,
    callId: conversation.callId,
    channel: graph.channel,
    speaker: node.speaker,
    speakerName,
    line: Object.hasOwn(graph.lines, node.lineId) ? graph.lines[node.lineId] : "",
    options: availableOptions(state, scenario),
  };
});

// ---------------------------------------------------------------------------
// Journal and claims
// ---------------------------------------------------------------------------

export interface JournalStance {
  claimId: ClaimId;
  claimText: string;
  stance: Stance;
  /** Text from `STANCE_TEXT`. */
  stanceText: string;
  note: string;
}

export interface JournalEntry {
  id: EvidenceId;
  title: string;
  description: string;
  source: EvidenceItem["source"];
  location: string;
  stances: JournalStance[];
  /**
   * Journal notes whose required evidence is all discovered, attached to the entry that
   * completed the requirement (the latest discovered of the required items).
   */
  notes: string[];
}

/** Discovered Evidence_Items in discovery order, with stance text (Requirements 11.7-11.9). */
export const selectJournalEntries = memoByState((state, scenario): JournalEntry[] => {
  const notesByEntry = new Map<EvidenceId, string[]>();
  for (const note of scenario.journalNotes) {
    if (note.requires.length === 0) continue;
    if (!note.requires.every((id) => state.discovered.includes(id))) continue;
    let anchor = note.requires[0];
    for (const id of note.requires) {
      if (state.discovered.indexOf(id) > state.discovered.indexOf(anchor)) anchor = id;
    }
    notesByEntry.set(anchor, [...(notesByEntry.get(anchor) ?? []), note.text]);
  }

  const entries: JournalEntry[] = [];
  for (const id of state.discovered) {
    if (!Object.hasOwn(scenario.evidence, id)) continue;
    const item = scenario.evidence[id];
    entries.push({
      id,
      title: item.title,
      description: item.description,
      source: item.source,
      location: item.location,
      stances: item.relations.map((relation) => ({
        claimId: relation.claimId,
        claimText: Object.hasOwn(scenario.claims, relation.claimId) ? scenario.claims[relation.claimId].text : "",
        stance: relation.stance,
        stanceText: STANCE_TEXT[relation.stance],
        note: relation.note,
      })),
      notes: notesByEntry.get(id) ?? [],
    });
  }
  return entries;
});

export interface ClaimStatusView {
  id: ClaimId;
  text: string;
  status: ClaimStatus;
  /** Text from `CLAIM_STATUS_TEXT`. */
  statusText: string;
  /** Discovered evidence related to the Claim, in discovery order. */
  evidence: Array<{ evidenceId: EvidenceId; title: string; stance: Stance; stanceText: string; note: string }>;
}

/** Every Claim with its status and related discovered evidence, in scenario order. */
export const selectClaimStatuses = memoByState((state, scenario): ClaimStatusView[] =>
  (Object.keys(scenario.claims) as ClaimId[]).map((claimId) => {
    const status = state.claims[claimId] ?? "unverified";
    const evidence: ClaimStatusView["evidence"] = [];
    for (const id of state.discovered) {
      if (!Object.hasOwn(scenario.evidence, id)) continue;
      const item = scenario.evidence[id];
      for (const relation of item.relations) {
        if (relation.claimId !== claimId) continue;
        evidence.push({
          evidenceId: id,
          title: item.title,
          stance: relation.stance,
          stanceText: STANCE_TEXT[relation.stance],
          note: relation.note,
        });
      }
    }
    return {
      id: claimId,
      text: scenario.claims[claimId].text,
      status,
      statusText: CLAIM_STATUS_TEXT[status],
      evidence,
    };
  }),
);

// ---------------------------------------------------------------------------
// Decision panel
// ---------------------------------------------------------------------------

export interface DecisionPreStepView {
  label: string;
  method: VerifyMethod;
  claimId: ClaimId;
  /** True when VERIFY_CLAIM with this method would be accepted now. */
  available: boolean;
  /** Shown when unavailable; `null` when available or done. */
  hint: string | null;
  /** Code of `hint` when it is a core rejection reason; `null` when it comes from scenario data. */
  hintCode: ReasonCode | null;
  /** True once the verification step has been taken. */
  done: boolean;
}

export interface DecisionOptionView {
  id: DecisionId;
  label: string;
  /** True when MAKE_DECISION with this decision would be accepted now. */
  available: boolean;
  /** Shown when unavailable; `null` when available. */
  hint: string | null;
  /** Code of `hint` when it is a core rejection reason; `null` when it comes from scenario data. */
  hintCode: ReasonCode | null;
  preStep: DecisionPreStepView | null;
}

export interface DecisionPanelView {
  /** True while the last act is current, the chapter is playing and no decision exists. */
  offered: boolean;
  options: DecisionOptionView[];
}

function busyReasonCode(state: ChapterState): ReasonCode | null {
  if (state.call.current !== null) return "callInProgress";
  if (state.conversation !== null) return "conversationInProgress";
  return null;
}

interface HintView {
  hint: string | null;
  hintCode: ReasonCode | null;
}

const NO_HINT: HintView = { hint: null, hintCode: null };

function reasonHint(code: ReasonCode): HintView {
  return { hint: REASONS[code], hintCode: code };
}

function scenarioHint(text: string): HintView {
  return { hint: text, hintCode: null };
}

/**
 * The decision panel with availability and hints from `decisions.requires`, `unavailableHint`
 * and `preStep` (Requirements 13.1-13.3).
 */
export const selectDecisionPanel = memoByState((state, scenario): DecisionPanelView => {
  // The panel opens when the last act (Act V) has started and no decision exists yet.
  const lastAct = scenario.acts[scenario.acts.length - 1];
  const offered =
    isPlaying(state) &&
    state.decision === null &&
    lastAct !== undefined &&
    selectCurrentAct(state, scenario).id === lastAct.id;
  const busy = busyReasonCode(state);
  const options = (Object.keys(scenario.decisions) as DecisionId[]).map((id): DecisionOptionView => {
    const def = scenario.decisions[id];
    let preStep: DecisionPreStepView | null = null;
    let preStepPendingHint: string | null = null;
    if (def.preStep) {
      const step = def.preStep;
      const done = state.events.some(
        (entry) => entry.action.type === "VERIFY_CLAIM" && entry.action.method === step.method,
      );
      const meets = evaluateConditions(step.requires, state, scenario);
      const available = offered && !done && meets && busy === null;
      const stepHint =
        available || done
          ? NO_HINT
          : !meets
            ? scenarioHint(step.unavailableHint)
            : busy !== null
              ? reasonHint(busy)
              : NO_HINT;
      preStep = { label: step.label, method: step.method, claimId: step.claimId, available, ...stepHint, done };
      if (!meets) preStepPendingHint = step.unavailableHint;
    }
    const meets = evaluateConditions(def.requires, state, scenario);
    const available = offered && meets && busy === null;
    const optionHint = available
      ? NO_HINT
      : !meets
        ? scenarioHint(preStepPendingHint ?? def.unavailableHint)
        : busy !== null
          ? reasonHint(busy)
          : state.decision !== null
            ? reasonHint("decisionAlreadyMade")
            : scenarioHint(def.unavailableHint);
    return { id, label: def.label, available, ...optionHint, preStep };
  });
  return { offered, options };
});

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export interface CallLogEntryView extends CallRecord {
  /** Evidence revealed by opening this entry, if any. */
  evidenceId: EvidenceId | null;
  evidenceRecorded: boolean;
  /** True when INSPECT_EVIDENCE for `evidenceId` would be accepted now. */
  evidenceAvailable: boolean;
}

/**
 * The evidence a call history entry can reveal: the first `inspect` item (not a phone message)
 * whose requirements name this call (`callRang`, `callEnded` or `callClosed`). Derived from
 * Scenario_Data, so there is no per-call mapping in code.
 */
function callLogEvidenceId(callId: CallId, state: ChapterState, scenario: ScenarioDefinition): EvidenceId | null {
  const messageEvidence = new Set<EvidenceId>(Object.values(scenario.phone.messages).map((m) => m.evidenceId));
  const candidates = (Object.keys(scenario.evidence) as EvidenceId[]).filter((id) => {
    const discovery = scenario.evidence[id].discovery;
    if (discovery.via !== "inspect" || messageEvidence.has(id)) return false;
    return discovery.requires.some(
      (c) => (c.kind === "callRang" || c.kind === "callEnded" || c.kind === "callClosed") && c.callId === callId,
    );
  });
  return candidates.find((id) => !state.discovered.includes(id)) ?? candidates[0] ?? null;
}

/** Call history, oldest first, with the evidence each entry can reveal. */
export const selectCallLog = memoByState((state, scenario): CallLogEntryView[] =>
  state.call.log.map((record) => {
    const evidenceId = callLogEvidenceId(record.callId, state, scenario);
    return {
      ...record,
      // Caller name from the (possibly localized) scenario by call ID, else the stored record.
      displayName: scenario.calls[record.callId]?.displayName ?? record.displayName,
      evidenceId,
      evidenceRecorded: evidenceId !== null && state.discovered.includes(evidenceId),
      evidenceAvailable:
        evidenceId !== null && state.status === "playing" && canDiscover(state, evidenceId, "inspect", scenario),
    };
  }),
);

export interface PhoneMessageView {
  id: MessageId;
  from: string;
  body: string;
  unread: boolean;
  evidenceId: EvidenceId;
  evidenceRecorded: boolean;
}

/** Delivered messages in delivery order. */
export const selectPhoneMessages = memoByState((state, scenario): PhoneMessageView[] =>
  state.phone.messages
    .filter((id) => Object.hasOwn(scenario.phone.messages, id))
    .map((id) => {
      const message = scenario.phone.messages[id];
      return {
        id,
        from: message.from,
        body: message.body,
        unread: state.phone.unread.includes(id),
        evidenceId: message.evidenceId,
        evidenceRecorded: state.discovered.includes(message.evidenceId),
      };
    }),
);

// ---------------------------------------------------------------------------
// Deception state, ringing, device actions, phone records, combinations
// ---------------------------------------------------------------------------

export interface DeceptionView {
  firstCallRejected: boolean;
  notificationOpened: boolean;
  notificationOriginInspected: boolean;
  officialChannelVerified: boolean;
  secondCallerTrusted: boolean;
  /** Discovery order. */
  evidenceDiscovered: EvidenceId[];
  /** Recording order. */
  deductionsUnlocked: DeductionId[];
  finalDecision: DecisionId | null;
}

/** Typed projection of the deception facts in Chapter_State. No second store (Requirement 4.4). */
export const selectDeception = memoByState(
  (state): DeceptionView => ({
    firstCallRejected: state.flags.first_call_rejected === true,
    notificationOpened: state.flags.notification_opened === true,
    notificationOriginInspected: state.flags.notification_origin_inspected === true,
    officialChannelVerified: state.flags.official_channel_verified === true,
    secondCallerTrusted: state.flags.second_caller_trusted === true,
    evidenceDiscovered: [...state.discovered],
    deductionsUnlocked: [...state.deductions],
    finalDecision: state.decision,
  }),
);

/**
 * The incoming call that may ring now, or `null`. A call qualifies when the chapter is playing,
 * no call, conversation or decision exists, the call has not rung yet, and one `ringWhen`
 * alternative holds. The first qualifying call in scenario order is returned.
 */
export function selectRingableCall(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): IncomingCallId | null {
  if (!isPlaying(state) || state.decision !== null) return null;
  if (state.call.current !== null || state.call.status === "ringing" || state.conversation !== null) return null;
  for (const id of incomingCallIds(scenario)) {
    if (hasRung(state, id)) continue;
    if (scenario.calls[id].ringWhen.some((all) => evaluateConditions(all, state, scenario))) return id;
  }
  return null;
}

export interface DeviceActionView {
  id: DeviceActionId;
  label: string;
  once: boolean;
  /** True once an accepted DEVICE_ACTION with this ID is in the event log. */
  done: boolean;
  /** True when DEVICE_ACTION with this ID would be accepted now. */
  available: boolean;
}

/** Device actions of one device that are available or already done. Unavailable ones are not listed. */
function deviceActionViews(
  state: ChapterState,
  scenario: ScenarioDefinition,
  device: "laptop" | "phone",
): DeviceActionView[] {
  const views: DeviceActionView[] = [];
  for (const id of Object.keys(scenario.deviceActions) as DeviceActionId[]) {
    const def = scenario.deviceActions[id];
    if (def.device !== device) continue;
    const done = hasDoneDeviceAction(state, id);
    const available =
      state.status === "playing" &&
      state.outcome === null &&
      !(def.once && done) &&
      evaluateConditions(def.requires, state, scenario);
    if (available || done) views.push({ id, label: def.label, once: def.once, done, available });
  }
  return views;
}

export type NotificationState = "none" | "new" | "opened" | "dismissed";

export interface CompareRowView {
  /** Identifier key, for example "domain". The UI translates the label. */
  key: string;
  /** Value on the notification, or `null` when the player has not seen it yet. */
  notification: string | null;
  /** Value on a record the player holds, or `null` when not seen yet. No match flag is given. */
  reference: string | null;
}

export interface LaptopView {
  notification: {
    state: NotificationState;
    originInspected: boolean;
    handled: boolean;
  };
  bankApp: {
    opened: boolean;
    title: string;
    /** Empty until the saved bank app is opened. */
    screens: Array<{ id: string; title: string; body: string }>;
  };
  /** Values side by side. Never states whether they match. */
  compareRows: CompareRowView[];
  deviceActions: DeviceActionView[];
}

const COMPARE_KEYS = ["case", "domain", "contact", "app"] as const;

function notificationState(state: ChapterState): NotificationState {
  if (state.flags.notification_delivered !== true) return "none";
  if (state.flags.notification_opened === true) return "opened";
  if (state.flags.notification_dismissed === true) return "dismissed";
  return "new";
}

function buildCompareRows(state: ChapterState, scenario: ScenarioDefinition): CompareRowView[] {
  const notification = Object.hasOwn(scenario.sources, "src.notification") ? scenario.sources["src.notification"] : null;
  if (!notification) return [];
  const seen = state.flags.notification_opened === true || state.flags.notification_origin_inspected === true;
  if (!seen) return [];
  const heldSourceIds = new Set<string>();
  for (const id of state.discovered) {
    if (Object.hasOwn(scenario.evidence, id)) heldSourceIds.add(scenario.evidence[id].sourceId);
  }
  const rows: CompareRowView[] = [];
  for (const key of COMPARE_KEYS) {
    const own = notification.identifiers.find((identifier) => identifier.key === key);
    if (!own) continue;
    let reference: string | null = null;
    if (key === "case") {
      const caller = Object.hasOwn(scenario.sources, "src.call-alex") ? scenario.sources["src.call-alex"] : null;
      const known = state.flags.case_id_heard === true;
      reference = known ? (caller?.identifiers.find((i) => i.key === key)?.value ?? null) : null;
    } else {
      for (const source of Object.values(scenario.sources)) {
        if (source.trust !== "pre-existing" || !heldSourceIds.has(source.id)) continue;
        const found = source.identifiers.find((identifier) => identifier.key === key);
        if (found) {
          reference = found.value;
          break;
        }
      }
    }
    rows.push({ key, notification: own.value, reference });
  }
  return rows;
}

/** The laptop screens: notification state, saved bank app, compare rows and device actions. */
export const selectLaptopView = memoByState((state, scenario): LaptopView => {
  const opened = state.flags.bank_app_opened === true;
  return {
    notification: {
      state: notificationState(state),
      originInspected: state.flags.notification_origin_inspected === true,
      handled: state.flags.notification_handled === true,
    },
    bankApp: {
      opened,
      title: scenario.phone.bankApp.title,
      screens: opened ? scenario.phone.bankApp.screens.map((screen) => ({ ...screen })) : [],
    },
    compareRows: buildCompareRows(state, scenario),
    deviceActions: deviceActionViews(state, scenario, "laptop"),
  };
});

export interface SavedContactView {
  name: string;
  /** Fictional number, plain text. */
  number: string;
  claimId: ClaimId;
  /** True when VERIFY_CLAIM with `saved-official-contact` would be accepted now. */
  available: boolean;
  /** True once the saved contact was called. */
  called: boolean;
}

export interface PhoneRecordsView {
  calls: CallLogEntryView[];
  /** Voicemail message from the first caller, when delivered. */
  voicemail: PhoneMessageView | null;
  /** Call summary message, when delivered. */
  summaries: PhoneMessageView[];
  /** `null` when the scenario has no outgoing official call. */
  savedContact: SavedContactView | null;
  deviceActions: DeviceActionView[];
}

/** Claim for the saved-contact check: the decision pre-step claim, else a default. */
function savedContactClaim(scenario: ScenarioDefinition): ClaimId {
  return (
    Object.values(scenario.decisions).find((def) => def.preStep?.method === "saved-official-contact")?.preStep
      ?.claimId ?? VERIFY_METHOD_CLAIM["saved-official-contact"]
  );
}

/** True when VERIFY_CLAIM `saved-official-contact` mirrors the reducer guard. */
function canCallSavedContact(state: ChapterState, scenario: ScenarioDefinition): boolean {
  return (
    isPlaying(state) &&
    Object.hasOwn(scenario.calls, "call.official") &&
    state.call.current === null &&
    state.conversation === null &&
    state.decision === null &&
    (state.discovered.includes("ev.official-contact-paper") || state.discovered.includes("ev.official-contact-app"))
  );
}

/** Call history, message summaries, voicemail and the saved-contact call. */
export const selectPhoneRecords = memoByState((state, scenario): PhoneRecordsView => {
  const messages = selectPhoneMessages(state, scenario);
  const official = Object.hasOwn(scenario.calls, "call.official") ? scenario.calls["call.official"] : null;
  return {
    calls: selectCallLog(state, scenario),
    voicemail: messages.find((message) => message.id === "msg.alex-voicemail") ?? null,
    summaries: messages.filter((message) => message.id === "msg.alex-summary"),
    savedContact: official
      ? {
          name: official.displayName,
          number: official.number,
          claimId: savedContactClaim(scenario),
          available: canCallSavedContact(state, scenario),
          called: state.call.log.some((record) => record.callId === "call.official"),
        }
      : null,
    deviceActions: deviceActionViews(state, scenario, "phone"),
  };
});

export interface CombinationItemView {
  id: EvidenceId;
  title: string;
  /** Source label from Scenario_Data, or `null` when the item has no known source. */
  sourceLabel: string | null;
}

export interface CombinationOptionsView {
  /** Discovered evidence in discovery order. */
  items: CombinationItemView[];
  minSelection: 2;
  maxSelection: 3;
  /** Deductions already recorded, in recording order. */
  recorded: Array<{ id: DeductionId; statement: string }>;
}

/**
 * The evidence the player may select for a combination. It lists discovered evidence only and
 * never says whether any selection matches: matching happens when COMBINE_EVIDENCE is submitted
 * (Requirement 8.11).
 */
export const selectCombinationOptions = memoByState((state, scenario): CombinationOptionsView => {
  const items: CombinationItemView[] = [];
  for (const id of state.discovered) {
    if (!Object.hasOwn(scenario.evidence, id)) continue;
    const item = scenario.evidence[id];
    items.push({
      id,
      title: item.title,
      sourceLabel: Object.hasOwn(scenario.sources, item.sourceId) ? scenario.sources[item.sourceId].label : null,
    });
  }
  const recorded = state.deductions
    .filter((id) => Object.hasOwn(scenario.deductions, id))
    .map((id) => ({ id, statement: scenario.deductions[id].statement }));
  return { items, minSelection: 2, maxSelection: 3, recorded };
});

// ---------------------------------------------------------------------------
// Candidate actions
// ---------------------------------------------------------------------------

/**
 * Actions that are likely to be accepted from `state`, in a fixed order. Used by property tests
 * and the guided completion policy. The list mirrors the reducer guards; a few entries may still
 * be rejected, but every accepted action family is covered. Not memoized (returns a new array).
 */
export function enumerateCandidateActions(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): CoreAction[] {
  if (state.status === "not-started") return [{ type: "START_CHAPTER" }];
  if (state.status === "finished") return [];
  if (state.outcome !== null) return [{ type: "FINISH_CHAPTER" }];

  const actions: CoreAction[] = [];
  const callCurrent = state.call.current;

  if (state.conversation !== null) {
    for (const option of availableOptions(state, scenario)) {
      actions.push({ type: "SELECT_DIALOGUE_OPTION", optionId: option.id });
    }
    if (callCurrent !== null) actions.push({ type: "END_CALL" });
  } else if (state.call.status === "ringing" && callCurrent !== null) {
    actions.push({ type: "ANSWER_CALL" });
    actions.push({ type: "END_CALL" });
  } else if (callCurrent !== null) {
    // An active call without a conversation can only be hung up.
    actions.push({ type: "END_CALL" });
  } else {
    // Idle: explore, inspect, ring, verify, decide.
    for (const id of Object.keys(scenario.interactables) as InteractableId[]) {
      if (scenario.interactables[id].produces.type === "INTERACT_OBJECT") {
        actions.push({ type: "INTERACT_OBJECT", objectId: id });
      }
    }
    for (const id of Object.keys(scenario.npcs) as NpcId[]) {
      actions.push({ type: "TALK_TO_NPC", npcId: id });
    }

    // Calls: mirror the reducer (never rang before, `ringWhen` holds, no decision).
    if (state.decision === null) {
      for (const id of incomingCallIds(scenario)) {
        if (hasRung(state, id)) continue;
        if (!scenario.calls[id].ringWhen.some((all) => evaluateConditions(all, state, scenario))) continue;
        const reason = state.interacted.length > 0 ? "first-interaction" : "callback";
        actions.push({ type: "RING_CALL", callId: id, reason });
      }
    }

    // Laptop and phone actions.
    for (const id of Object.keys(scenario.deviceActions) as DeviceActionId[]) {
      const def = scenario.deviceActions[id];
      if (def.once && hasDoneDeviceAction(state, id)) continue;
      if (evaluateConditions(def.requires, state, scenario)) actions.push({ type: "DEVICE_ACTION", deviceActionId: id });
    }

    // Combinations of discovered evidence: only the pairs and triples that would record a deduction.
    const found = state.discovered;
    const combos: EvidenceId[][] = [];
    for (let i = 0; i < found.length; i += 1) {
      for (let j = i + 1; j < found.length; j += 1) {
        combos.push([found[i], found[j]]);
        for (let k = j + 1; k < found.length; k += 1) combos.push([found[i], found[j], found[k]]);
      }
    }
    for (const evidenceIds of combos) {
      const deduction = matchDeduction(evidenceIds, scenario);
      if (deduction !== null && canRecordDeduction(state, deduction, scenario)) {
        actions.push({ type: "COMBINE_EVIDENCE", evidenceIds });
      }
    }

    if (canCallSavedContact(state, scenario)) {
      actions.push({ type: "VERIFY_CLAIM", claimId: savedContactClaim(scenario), method: "saved-official-contact" });
    }
    if (state.phone.open && state.decision === null && !hasVerifiedBy(state, "bank-app")) {
      actions.push({ type: "VERIFY_CLAIM", claimId: VERIFY_METHOD_CLAIM["bank-app"], method: "bank-app" });
    }

    if (state.decision === null) {
      for (const id of Object.keys(scenario.decisions) as DecisionId[]) {
        if (evaluateConditions(scenario.decisions[id].requires, state, scenario)) {
          actions.push({ type: "MAKE_DECISION", decision: id });
        }
      }
    }
  }

  // Evidence that can be inspected now (phone messages and call history). Not blocked by calls.
  for (const id of Object.keys(scenario.evidence) as EvidenceId[]) {
    if (scenario.evidence[id].discovery.via === "inspect" && canDiscover(state, id, "inspect", scenario)) {
      actions.push({ type: "INSPECT_EVIDENCE", evidenceId: id });
    }
  }

  for (const id of state.objectives.active as ObjectiveId[]) {
    if (canCompleteObjective(state, id, scenario)) actions.push({ type: "COMPLETE_OBJECTIVE", objectiveId: id });
  }

  if (!state.phone.open) actions.push({ type: "OPEN_PHONE" });
  else if (callCurrent === null) actions.push({ type: "CLOSE_PHONE" });

  return actions;
}
