// Chapter 1 "The Urgent Call: The False Victory": the four claims the player can weigh.
// Statuses change only through deductions (inconclusive) or the independent official line
// (contradicted). Pure TypeScript data.

import type { Claim } from "../types";
import type { ClaimId } from "./ids";

export const CHAPTER_1_CLAIMS: Record<ClaimId, Claim> = {
  "claim.alex-identity": {
    id: "claim.alex-identity",
    text: "The first caller is Alex from Northgate Bank security.",
  },
  "claim.notification-genuine": {
    id: "claim.notification-genuine",
    text: "The laptop notification comes from your bank.",
  },
  "claim.recovery-needed": {
    id: "claim.recovery-needed",
    text: "Your account needs a recovery procedure right now.",
  },
  "claim.claims-independent": {
    id: "claim.claims-independent",
    text: "The call and the notification confirm each other as separate sources.",
  },
};
