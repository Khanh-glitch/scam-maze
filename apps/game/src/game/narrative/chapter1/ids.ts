// Chapter 1 "The Urgent Call: The False Victory": string-literal IDs.
// Each list is the single source of truth for its ID union, so the core can build
// initial records (claims, flags) and the validator can check references.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.

export const OBJECTIVE_IDS = [
  "obj.answer-or-decline",
  "obj.check-laptop",
  "obj.investigate",
  "obj.answer-recovery",
  "obj.decide",
  "obj.review",
] as const;
export type ObjectiveId = (typeof OBJECTIVE_IDS)[number];

export const INTERACTABLE_IDS = ["obj.note", "obj.receipts", "obj.calendar"] as const;
export type InteractableId = (typeof INTERACTABLE_IDS)[number];

/** E01 to E11 of the design (E03 has a paper and an app variant, E11 is the recovery number match). */
export const EVIDENCE_IDS = [
  "ev.caller-id-anomaly",
  "ev.notification-metadata",
  "ev.official-contact-paper",
  "ev.official-contact-app",
  "ev.account-activity",
  "ev.shared-case-id",
  "ev.note-app-origin",
  "ev.alex-statement",
  "ev.recovery-statement",
  "ev.official-confirmation",
  "ev.calendar-routine",
  "ev.recovery-number-match",
] as const;
export type EvidenceId = (typeof EVIDENCE_IDS)[number];

export const CLAIM_IDS = [
  "claim.alex-identity",
  "claim.notification-genuine",
  "claim.recovery-needed",
  "claim.claims-independent",
] as const;
export type ClaimId = (typeof CLAIM_IDS)[number];

export const CALL_IDS = ["call.alex", "call.recovery", "call.official"] as const;
export type CallId = (typeof CALL_IDS)[number];

/** Calls that ring on the player's phone (RING_CALL). The official line is outgoing only. */
export type IncomingCallId = Exclude<CallId, "call.official">;

/** No NPC conversations in this chapter. Kept as an empty tuple so `TALK_TO_NPC` still type-checks. */
export const NPC_IDS = [] as const;
export type NpcId = (typeof NPC_IDS)[number];

export const DIALOGUE_GRAPH_IDS = [
  "dlg.alex",
  "dlg.recovery",
  "dlg.official-line",
  "dlg.aftermath",
  "dlg.intro",
] as const;
export type DialogueGraphId = (typeof DIALOGUE_GRAPH_IDS)[number];

export const MESSAGE_IDS = ["msg.alex-voicemail", "msg.alex-summary"] as const;
export type MessageId = (typeof MESSAGE_IDS)[number];

export const FLAG_IDS = [
  /** Alex was answered. */
  "first_call_answered",
  /** The player rejected Alex (decline or hang up). */
  "first_call_rejected",
  /** The player knows the case ID Alex gave. */
  "case_id_heard",
  /** The player knows what Alex asked for. */
  "alex_request_heard",
  /** Layer 1 harm, an explicit choice. */
  "code_shared",
  /** The voicemail record exists (set by a beat). */
  "voicemail_delivered",
  /** The call summary record exists (set by a beat). */
  "call_summary_delivered",
  /** The laptop notification exists (set by a beat). */
  "notification_delivered",
  "notification_opened",
  "notification_origin_inspected",
  "notification_dismissed",
  /** Opened or dismissed: Act II is over. */
  "notification_handled",
  "bank_app_opened",
  /** The player entered the fake recovery workflow. */
  "review_security_opened",
  "recovery_instruction_known",
  /** The official line call was completed and `ev.official-confirmation` found. */
  "official_channel_verified",
  "second_caller_trusted",
  "shared_origin_established",
  "notification_origin_mismatch",
  "chain_identified",
  /** Final harm, only after a decision. */
  "money_moved",
] as const;
export type FlagId = (typeof FLAG_IDS)[number];

export const DECISION_IDS = [
  "follow-recovery",
  "follow-both",
  "refuse-and-stop",
  "verify-independently",
  "report-deception",
] as const;
export type DecisionId = (typeof DECISION_IDS)[number];

/** A false victory, a perfect chain, break the chain, an unfinished case. */
export const OUTCOME_IDS = [
  "false-victory",
  "perfect-chain",
  "break-the-chain",
  "unfinished-case",
] as const;
export type OutcomeId = (typeof OUTCOME_IDS)[number];

export const WARNING_SIGN_IDS = [
  "ws.urgency",
  "ws.unverified-sender",
  "ws.caller-id-spoof",
  "ws.self-supplied-contact",
  "ws.shared-case-id",
  "ws.validates-your-doubt",
  "ws.move-funds",
  "ws.discourages-verification",
  "ws.code-request",
] as const;
export type WarningSignId = (typeof WARNING_SIGN_IDS)[number];

export const VERIFY_METHODS = ["saved-official-contact", "bank-app"] as const;
export type VerifyMethod = (typeof VERIFY_METHODS)[number];

/** Voice identities of the speaking characters (one voice cast entry each). */
export const SPEAKER_IDS = [
  "spk.alex",
  "spk.recovery",
  "spk.northgate-agent",
  "spk.narrator",
] as const;
export type SpeakerId = (typeof SPEAKER_IDS)[number];

/** Delivery tones of spoken lines. */
export const TONE_IDS = [
  "professional",
  "reassuring",
  "defensive",
  "impatient",
  "pressuring",
] as const;
export type Tone = (typeof TONE_IDS)[number];

/** The five acts of Chapter 1. */
export const ACT_IDS = ["act.1", "act.2", "act.3", "act.4", "act.5"] as const;
export type ActId = (typeof ACT_IDS)[number];

/** Provenance sources: where a piece of evidence claims to come from. */
export const SOURCE_IDS = [
  "src.call-alex",
  "src.voicemail-alex",
  "src.notification",
  "src.statement-paper",
  "src.saved-app",
  "src.note",
  "src.calendar",
  "src.call-recovery",
  "src.official-line",
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/** Player reasoning steps made by combining evidence. */
export const DEDUCTION_IDS = [
  "ded.same-source",
  "ded.notification-mismatch",
  "ded.third-caller-not-independent",
] as const;
export type DeductionId = (typeof DEDUCTION_IDS)[number];

/** Actions on the laptop or the phone (DEVICE_ACTION). */
export const DEVICE_ACTION_IDS = [
  "dev.open-alex-record",
  "dev.open-call-details",
  "dev.open-notification",
  "dev.dismiss-notification",
  "dev.inspect-notification-origin",
  "dev.open-bank-app",
  "dev.open-account-activity",
  "dev.open-saved-contacts",
  "dev.compare-case-ref",
  "dev.compare-contacts",
  "dev.review-security",
  "dev.open-recovery-details",
] as const;
export type DeviceActionId = (typeof DEVICE_ACTION_IDS)[number];
