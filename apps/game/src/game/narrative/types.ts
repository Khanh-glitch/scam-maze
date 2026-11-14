// Core and scenario types for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Data Models".

import type {
  ActId,
  CallId,
  ClaimId,
  DecisionId,
  DeductionId,
  DeviceActionId,
  DialogueGraphId,
  EvidenceId,
  FlagId,
  IncomingCallId,
  InteractableId,
  MessageId,
  NpcId,
  ObjectiveId,
  OutcomeId,
  SourceId,
  SpeakerId,
  Tone,
  VerifyMethod,
  WarningSignId,
} from "./chapter1/ids";
import type { ProvenanceTrust } from "@scammaze/shared-types";

// ---------------------------------------------------------------------------
// Core actions and results
// ---------------------------------------------------------------------------

export type RingReason = "first-interaction" | "exploration-timer" | "re-ring" | "callback" | "follow-up";

export type CoreAction =
  | { type: "START_CHAPTER" }
  | { type: "INTERACT_OBJECT"; objectId: InteractableId }
  | { type: "INSPECT_EVIDENCE"; evidenceId: EvidenceId }
  | { type: "OPEN_PHONE" }
  | { type: "CLOSE_PHONE" }
  | { type: "RING_CALL"; callId: IncomingCallId; reason: RingReason }
  | { type: "ANSWER_CALL" }
  /** Declines when ringing, hangs up when active. */
  | { type: "END_CALL" }
  | { type: "TALK_TO_NPC"; npcId: NpcId }
  | { type: "SELECT_DIALOGUE_OPTION"; optionId: string }
  | { type: "VERIFY_CLAIM"; claimId: ClaimId; method: VerifyMethod }
  | { type: "MAKE_DECISION"; decision: DecisionId }
  | { type: "COMPLETE_OBJECTIVE"; objectiveId: ObjectiveId }
  | { type: "FINISH_CHAPTER" }
  /** A laptop or phone action defined by `DeviceActionDef` (opens a record, inspects, compares). */
  | { type: "DEVICE_ACTION"; deviceActionId: DeviceActionId }
  /** Combines 2 to 3 unique evidence items into a deduction. Order does not matter. */
  | { type: "COMBINE_EVIDENCE"; evidenceIds: EvidenceId[] };

export type CoreActionType = CoreAction["type"];

export interface ActionResult {
  state: ChapterState;
  accepted: boolean;
  /** Non-empty when `accepted` is false. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Chapter state
// ---------------------------------------------------------------------------

export type ChapterStatus = "not-started" | "playing" | "ended" | "finished";
export type CallStatus = "idle" | "ringing" | "active" | "declined" | "ended";
export type ClaimStatus = "unverified" | "supported" | "contradicted" | "inconclusive";
export type Stance = "supports" | "contradicts" | "inconclusive" | "needs-verification";
export type PressureLevel = 0 | 1 | 2 | 3;

export interface CallRecord {
  callId: CallId;
  direction: "incoming" | "outgoing";
  /** From Scenario_Data. */
  displayName: string;
  /** Fictional_Phone_Number, always starting with `+000`. */
  number: string;
  status: "ringing" | "answered" | "declined" | "missed" | "ended";
  ringCount: number;
}

export interface ConversationState {
  graphId: DialogueGraphId;
  nodeId: string;
  /** `null` for face-to-face conversations (Sam). */
  callId: CallId | null;
  history: Array<{ nodeId: string; optionId: string }>;
}

export interface ChapterState {
  chapterId: "chapter-1";
  status: ChapterStatus;
  objectives: { active: ObjectiveId[]; completed: ObjectiveId[] };
  /** Message IDs. */
  phone: { open: boolean; unread: MessageId[]; messages: MessageId[] };
  call: { current: CallId | null; status: CallStatus; log: CallRecord[] };
  conversation: ConversationState | null;
  conversationHistory: Array<{
    graphId: DialogueGraphId;
    history: ConversationState["history"];
    endNodeId: string | null;
  }>;
  npc: Record<NpcId, { timesTalked: number }>;
  interacted: InteractableId[];
  /** Discovery order, no duplicates. */
  discovered: EvidenceId[];
  claims: Record<ClaimId, ClaimStatus>;
  decision: DecisionId | null;
  /** Recorded deductions in recording order, no duplicates. */
  deductions: DeductionId[];
  flags: Record<FlagId, boolean>;
  pressure: PressureLevel;
  outcome: OutcomeId | null;
  events: EventLogEntry[];
}

export interface EventLogEntry {
  /** 0-based, contiguous. */
  seq: number;
  action: CoreAction;
  derived: {
    evidence: EvidenceId[];
    flags: FlagId[];
    objectivesActivated: ObjectiveId[];
    objectivesCompleted: ObjectiveId[];
    /** For example "shared-code", "challenged-number", "hung-up-to-verify". */
    debriefTags: string[];
  };
}

// ---------------------------------------------------------------------------
// Conditions, effects and discovery
// ---------------------------------------------------------------------------

export type Condition =
  | { kind: "hasEvidence"; evidenceId: EvidenceId }
  | { kind: "hasAnyEvidence"; evidenceIds: EvidenceId[] }
  | { kind: "flag"; flag: FlagId }
  | { kind: "notFlag"; flag: FlagId }
  | { kind: "callEnded"; callId: CallId }
  | { kind: "claimStatus"; claimId: ClaimId; status: ClaimStatus }
  /** A call log record exists for the call. */
  | { kind: "callRang"; callId: CallId }
  /** The call ended, was declined or was missed. */
  | { kind: "callClosed"; callId: CallId }
  /** The deduction is in `ChapterState.deductions`. */
  | { kind: "deductionRecorded"; deductionId: DeductionId }
  /** The recorded final decision equals `decision`. */
  | { kind: "decisionIs"; decision: DecisionId }
  | { kind: "objectiveCompleted"; objectiveId: ObjectiveId }
  | { kind: "outcomeSet" }
  /** At least `count` of the listed evidence items are discovered. */
  | { kind: "evidenceCountAtLeast"; evidenceIds: EvidenceId[]; count: number };

export type Effect =
  | { kind: "setFlag"; flag: FlagId }
  | { kind: "discoverEvidence"; evidenceId: EvidenceId }
  /** Adds pressure, capped at 3. Defaults to 1. */
  | { kind: "addPressure"; amount?: number }
  /** Allowed only in graphs with `independentChannel: true` (enforced by the validator). */
  | { kind: "setClaimStatus"; claimId: ClaimId; status: ClaimStatus }
  | { kind: "recordDecision"; decision: DecisionId }
  | { kind: "deliverMessage"; messageId: MessageId };

export type DiscoveryCondition =
  | { via: "interact"; objectId: InteractableId }
  | { via: "inspect"; requires: Condition[] }
  | { via: "dialogue-node"; nodeId: string }
  | { via: "verify"; method: VerifyMethod }
  /** Revealed by a device action that lists the item in its `reveals`. */
  | { via: "device"; deviceActionId: DeviceActionId };

export type DiscoveryVia = DiscoveryCondition["via"];

// ---------------------------------------------------------------------------
// Scenario content
// ---------------------------------------------------------------------------

export interface Claim {
  id: ClaimId;
  text: string;
}

/** Data-driven objective: text plus activation and completion predicates. */
export interface Objective {
  id: ObjectiveId;
  text: string;
  /** All conditions must hold for the objective to become active. */
  activateWhen: Condition[];
  /** All conditions must hold for the objective to complete. */
  completeWhen: Condition[];
  /** Optional hint, shown only when the player opens hints. */
  hint?: string;
}

export interface InteractableDef {
  id: InteractableId;
  /** Object name, for example "Your wallet on the café table". */
  label: string;
  /** Verb shown in the prompt, for example "check". */
  actionLabel: string;
  inspectionText: string;
  produces: { type: "INTERACT_OBJECT" } | { type: "TALK_TO_NPC"; npcId: NpcId };
  /** Evidence revealed directly by the interaction (empty for NPCs; their evidence comes from dialogue). */
  reveals: EvidenceId[];
}

export interface WarningSignDef {
  id: WarningSignId;
  label: string;
  description: string;
}

export interface EvidenceItem {
  id: EvidenceId;
  title: string;
  description: string;
  source: "physical" | "device" | "dialogue" | "npc" | "verification";
  location: string;
  discovery: DiscoveryCondition;
  relations: Array<{ claimId: ClaimId; stance: Stance; note: string }>;
  warningSigns: WarningSignId[];
  /** Provenance source the item claims to come from. */
  sourceId: SourceId;
  /** Educational relevance. */
  relevance: string;
  /** Shown in "clues missed" when not discovered. */
  debriefHint?: string;
}

/** Journal note shown once all listed evidence is discovered (for example the number mismatch). */
export interface JournalNote {
  id: string;
  requires: EvidenceId[];
  text: string;
}

export interface DialogueGraph {
  id: DialogueGraphId;
  persona: { speakerId: SpeakerId; name: string; role: string; honesty: "scammer" | "trusted" | "neutral" };
  channel: "phone" | "face-to-face";
  /** Only `dlg.official-line` is true. */
  independentChannel: boolean;
  startNodeId: string;
  startNodeWhen?: Array<{ when: Condition[]; nodeId: string }>;
  /** Approved line IDs → text. */
  lines: Record<string, string>;
  nodes: Record<string, DialogueNode>;
}

export interface DialogueNode {
  id: string;
  speaker: "caller" | "player" | "npc" | "system";
  lineId: string;
  pressure?: boolean;
  /** Required by the content validator on every Spoken_Node. */
  tone?: Tone;
  /** Overrides `graph.persona.speakerId` for this node. */
  speakerId?: SpeakerId;
  /** Presentation only, 0..3000. Delays audio start, not the caption. */
  pauseBeforeMs?: number;
  /** Presentation only. Holds the choice list until the voice line ends. */
  waitForVoice?: boolean;
  onEnter?: Effect[];
  options: DialogueOption[];
  end?: { kind: "hung-up" | "completed"; debriefTag?: string };
}

export interface DialogueOption {
  id: string;
  lineId: string;
  conditions?: Condition[];
  effects?: Effect[];
  next: string | { end: "hang-up" };
  debriefTag?: string;
}

export interface CallDef {
  id: CallId;
  direction: "incoming" | "outgoing";
  displayName: string;
  /** Fictional_Phone_Number, always starting with `+000`. */
  number: string;
  graphId: DialogueGraphId;
  /** The call rings when any inner list has all its conditions true (OR of ANDs). Empty for outgoing calls. */
  ringWhen: Condition[][];
}

export interface NpcDef {
  id: NpcId;
  name: string;
  interactableId: InteractableId;
  graphId: DialogueGraphId;
}

export interface PhoneMessage {
  id: MessageId;
  from: string;
  body: string;
  /** Evidence recorded when the player opens the message. */
  evidenceId: EvidenceId;
  /** True when the message is on the phone at chapter start; otherwise delivered by an effect. */
  deliveredAtStart: boolean;
}

export interface PhoneContent {
  messages: Record<MessageId, PhoneMessage>;
  contacts: Array<{ name: string; number: string }>;
  /** Official website as plain text (a reserved domain, never a link). */
  officialWebsite: string;
  bankApp: { title: string; screens: Array<{ id: string; title: string; body: string }> };
}

export interface DecisionDef {
  id: DecisionId;
  /** Panel label for the final decision. */
  label: string;
  /** All conditions must hold for MAKE_DECISION to be available. */
  requires: Condition[];
  /** Shown when the decision is unavailable. */
  unavailableHint: string;
  /** Optional verification step before the decision (the official-line call). */
  preStep?: {
    label: string;
    method: VerifyMethod;
    claimId: ClaimId;
    requires: Condition[];
    unavailableHint: string;
  };
  /** Effects applied when the decision is recorded (for example `money_moved`). */
  effects?: Effect[];
  debriefTag?: string;
}

/** Ending aftermath: what happens next on the phone and laptop, with closing narration. */
export interface Aftermath {
  /** Narrative consequence shown in the ending. */
  consequence: string;
  /** Phone aftermath text. */
  phone: string;
  /** Laptop aftermath text. */
  laptop: string;
  /** Summary of the evidence the player had. */
  evidenceSummary: string;
  /** Case report text. */
  caseReport: string;
  /** Spoken closing node IDs in `dlg.aftermath`, played in order. */
  narrationNodeIds: string[];
}

export interface EndingDef {
  id: OutcomeId;
  title: string;
  /** First variant whose conditions all hold is shown. The last variant should have no conditions. */
  variants: Array<{ id: string; when: Condition[]; text: string }>;
  /** "Simulation: nothing real happened." */
  simulationLabel: string;
  /** Extra conditions that must hold for this outcome. */
  unlockWhen?: Condition[];
  /** All conditions must hold for this ending to be selected. */
  selectWhen: Condition[];
  /** Selection priority: the lowest matching `order` wins. */
  order: number;
  /** Aftermath content for this ending. */
  aftermath: Aftermath;
}

export interface DebriefContent {
  /** What the scammer did. */
  mechanism: string;
  /** What the player can do instead. */
  saferAlternatives: string[];
  outcomeSummaries: Record<OutcomeId, string>;
  /** Debrief tag → decision note text. */
  decisionNotes: Record<string, string>;
  /** Text for the forensic analysis section of the debrief. */
  analysis: DebriefAnalysisContent;
}

/** Which of the two traps the player entered. `first` is the code request of the first caller. */
export type DebriefTrap = "none" | "first" | "second" | "both";

export interface DebriefAnalysisContent {
  /** How the first caller built pressure. */
  pressureBuilt: string;
  /** Why the laptop warning and the later call looked trustworthy. */
  whyWarningLooked: string;
  /** Why the third caller gave no independent evidence. */
  thirdCallerNote: string;
  /** Text per trap outcome. */
  trapNotes: Record<DebriefTrap, string>;
  /** How to verify a similar claim. */
  verifyNextTime: string[];
}

export interface ActDef {
  id: ActId;
  /** Translatable, key `acts/<id>/title`. */
  title: string;
  /** Monotonic: once true it stays true. */
  enterWhen: Condition[];
  /** Equals the next act's `enterWhen` (checked by the validator). */
  exitWhen: Condition[];
  /** Each objective belongs to exactly one act. */
  objectives: ObjectiveId[];
}

export type SourceIdentifierKey = "case" | "contact" | "domain" | "app" | "callerId";

/** Where a piece of evidence claims to come from. `trust` is authoring truth, shown only in the debrief. */
export interface SourceDef {
  id: SourceId;
  label: string;
  kind: "call" | "voicemail" | "notification" | "document" | "app" | "note" | "official-line" | "calendar";
  /** What the source says it is, for example "Northgate Bank security". */
  claimedOrigin: string;
  trust: ProvenanceTrust;
  identifiers: Array<{ key: SourceIdentifierKey; value: string }>;
}

/** What the validator checks between the input sources of a deduction. */
export type DeductionBasis =
  /** All input sources carry the same value for the key. */
  | { kind: "shared-identifier"; key: SourceIdentifierKey }
  /** The input sources carry different values for the key. */
  | { kind: "conflicting-identifier"; key: SourceIdentifierKey };

/** A reasoning step made by combining evidence. Effects: flags and `inconclusive` claim statuses only. */
export interface DeductionDef {
  id: DeductionId;
  /** All required. */
  inputs: EvidenceId[];
  /** Exactly one of these must also be present. */
  inputsAnyOf?: EvidenceId[];
  requires: Condition[];
  basis: DeductionBasis;
  /** For example "These claims are not independently verified." */
  statement: string;
  effects: Effect[];
  debriefTag: string;
}

/** An action on the laptop or the phone. Evidence is revealed only through `reveals`. */
export interface DeviceActionDef {
  id: DeviceActionId;
  device: "laptop" | "phone";
  label: string;
  requires: Condition[];
  effects: Effect[];
  reveals: EvidenceId[];
  /** When true the action is accepted once. */
  once: boolean;
  debriefTag?: string;
}

/** A scripted state change applied once, in order, when its conditions hold (for example the notification arrives). */
export interface BeatDef {
  id: string;
  when: Condition[];
  effects: Effect[];
}

export interface ScenarioDefinition {
  id: "chapter-1";
  title: string;
  subtitle: string;
  objectives: Record<ObjectiveId, Objective>;
  interactables: Record<InteractableId, InteractableDef>;
  claims: Record<ClaimId, Claim>;
  evidence: Record<EvidenceId, EvidenceItem>;
  warningSigns: Record<WarningSignId, WarningSignDef>;
  journalNotes: JournalNote[];
  calls: Record<CallId, CallDef>;
  npcs: Record<NpcId, NpcDef>;
  dialogues: Record<DialogueGraphId, DialogueGraph>;
  phone: PhoneContent;
  decisions: Record<DecisionId, DecisionDef>;
  endings: Record<OutcomeId, EndingDef>;
  debrief: DebriefContent;
  acts: ActDef[];
  /** Provenance sources by ID. */
  sources: Record<SourceId, SourceDef>;
  /** Deductions by ID. */
  deductions: Record<DeductionId, DeductionDef>;
  /** Laptop and phone actions by ID. */
  deviceActions: Record<DeviceActionId, DeviceActionDef>;
  /** Scripted beats, applied once in order. */
  beats: BeatDef[];
}
