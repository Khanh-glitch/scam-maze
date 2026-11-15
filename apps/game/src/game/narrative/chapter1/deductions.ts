// Chapter 1 "The Urgent Call: The False Victory": deductions.
// A deduction is the player's reasoning, built by combining evidence. It can only set a claim to
// `inconclusive` (design D7) and never adds pressure. Only the official line can set `contradicted`.
// Each basis is checked by the validator against the source identifiers in `sources.ts`.
// Pure TypeScript data.

import type { DeductionDef } from "../types";
import type { DeductionId } from "./ids";

export const CHAPTER_1_DEDUCTIONS: Record<DeductionId, DeductionDef> = {
  "ded.same-source": {
    id: "ded.same-source",
    // Alex's record, the notification details and the shared case reference.
    inputs: ["ev.alex-statement", "ev.notification-metadata", "ev.shared-case-id"],
    requires: [],
    // Alex (call or voicemail) and the notification carry the same case reference.
    basis: { kind: "shared-identifier", key: "case" },
    statement: "These claims are not independently verified.",
    effects: [
      { kind: "setFlag", flag: "shared_origin_established" },
      { kind: "setClaimStatus", claimId: "claim.claims-independent", status: "inconclusive" },
    ],
    debriefTag: "linked-same-source",
  },
  "ded.notification-mismatch": {
    id: "ded.notification-mismatch",
    inputs: ["ev.notification-metadata"],
    // One saved record of how the bank really contacts the player.
    inputsAnyOf: ["ev.official-contact-paper", "ev.official-contact-app", "ev.note-app-origin"],
    requires: [],
    // The notification contact number differs from the number in the saved record.
    basis: { kind: "conflicting-identifier", key: "contact" },
    statement: "The contact details in the notification do not match your own saved records.",
    effects: [
      { kind: "setFlag", flag: "notification_origin_mismatch" },
      { kind: "setClaimStatus", claimId: "claim.notification-genuine", status: "inconclusive" },
    ],
    debriefTag: "notification-not-from-bank",
  },
  "ded.third-caller-not-independent": {
    id: "ded.third-caller-not-independent",
    inputs: ["ev.recovery-statement", "ev.shared-case-id"],
    requires: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
    // The third caller and the notification carry the same case reference.
    basis: { kind: "shared-identifier", key: "case" },
    statement: "The third caller uses the same case reference as the earlier claims, so this is not a separate confirmation.",
    effects: [
      { kind: "setFlag", flag: "chain_identified" },
      { kind: "setClaimStatus", claimId: "claim.recovery-needed", status: "inconclusive" },
    ],
    debriefTag: "third-caller-linked",
  },
};
