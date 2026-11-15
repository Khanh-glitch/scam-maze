// Chapter 1 "The Urgent Call: The False Victory": the five final decisions of Act V.
// Availability is data (`requires`); the reducer only checks it. Two exits never depend on
// optional clues: "refuse and stop" has no requirement, and "verify independently" needs only the
// saved official contact (E03 paper or E03b app), which the pre-step uses to call that number.
// No decision is forced and no timer applies. Pure TypeScript data.

import type { Condition, DecisionDef } from "../types";
import type { DecisionId } from "./ids";

const SAVED_CONTACT_KNOWN: Condition[] = [
  { kind: "hasAnyEvidence", evidenceIds: ["ev.official-contact-paper", "ev.official-contact-app"] },
];

export const CHAPTER_1_DECISIONS: Record<DecisionId, DecisionDef> = {
  "follow-recovery": {
    id: "follow-recovery",
    label: "Follow the recovery steps from the third caller",
    requires: [{ kind: "flag", flag: "recovery_instruction_known" }],
    unavailableHint: "You have not heard the recovery steps yet.",
    // The harm is the explicit result of this choice, never of a timer or a forced action.
    effects: [{ kind: "setFlag", flag: "money_moved" }],
    debriefTag: "decided-follow-recovery",
  },
  "follow-both": {
    id: "follow-both",
    label: "Do what both callers asked",
    requires: [
      { kind: "flag", flag: "recovery_instruction_known" },
      { kind: "flag", flag: "alex_request_heard" },
    ],
    unavailableHint: "You need to have heard the request from the first caller and the recovery steps.",
    effects: [{ kind: "setFlag", flag: "money_moved" }],
    debriefTag: "decided-follow-both",
  },
  "refuse-and-stop": {
    id: "refuse-and-stop",
    label: "Refuse and stop here",
    // Always available in Act V.
    requires: [],
    unavailableHint: "",
    debriefTag: "decided-refuse-and-stop",
  },
  "verify-independently": {
    id: "verify-independently",
    label: "Check with the number you saved before today",
    requires: [{ kind: "flag", flag: "official_channel_verified" }],
    unavailableHint: "Call the number saved before today first, then come back to this choice.",
    preStep: {
      label: "Call the number on your statement",
      method: "saved-official-contact",
      claimId: "claim.alex-identity",
      requires: SAVED_CONTACT_KNOWN,
      unavailableHint: "Find the contact printed on your statement or saved in your bank app first.",
    },
    debriefTag: "decided-verify-independently",
  },
  "report-deception": {
    id: "report-deception",
    label: "Report the connected deception",
    requires: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
    unavailableHint: "Link the first caller and the notification in your notes before you report.",
    debriefTag: "decided-report-deception",
  },
};
