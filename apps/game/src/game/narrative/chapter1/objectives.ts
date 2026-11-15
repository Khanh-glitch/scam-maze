// Chapter 1 objectives (design.md, "Objectives (data-driven)"). Hints are shown only when the
// player opens hints. They say where to look, never what the answer is.

import type { Objective } from "../types";
import type { ObjectiveId } from "./ids";

export const CHAPTER_1_OBJECTIVES: Record<ObjectiveId, Objective> = {
  "obj.answer-or-decline": {
    id: "obj.answer-or-decline",
    text: "Deal with the phone call.",
    activateWhen: [],
    completeWhen: [{ kind: "callClosed", callId: "call.alex" }],
    hint: "The phone is on the desk. You decide whether to pick up.",
  },
  "obj.check-laptop": {
    id: "obj.check-laptop",
    text: "Look at the new message on your laptop.",
    activateWhen: [{ kind: "flag", flag: "notification_delivered" }],
    completeWhen: [{ kind: "flag", flag: "notification_handled" }],
    hint: "Something on the laptop screen changed after the call. You can also look around your room.",
  },
  "obj.investigate": {
    id: "obj.investigate",
    text: "Find out where the messages and calls really come from.",
    activateWhen: [{ kind: "flag", flag: "notification_handled" }],
    // Three of E01 to E06 (both E03 variants count). A deduction needs evidence first.
    completeWhen: [
      {
        kind: "evidenceCountAtLeast",
        evidenceIds: [
          "ev.caller-id-anomaly",
          "ev.notification-metadata",
          "ev.official-contact-paper",
          "ev.official-contact-app",
          "ev.account-activity",
          "ev.shared-case-id",
          "ev.note-app-origin",
        ],
        count: 3,
      },
    ],
    hint: "Check the laptop, the desk papers and the things you already keep in your room. Another call may follow.",
  },
  "obj.answer-recovery": {
    id: "obj.answer-recovery",
    text: "Deal with the new call.",
    activateWhen: [{ kind: "callRang", callId: "call.recovery" }],
    completeWhen: [{ kind: "callClosed", callId: "call.recovery" }],
    hint: "Listen to what this caller says and compare it with what you already found.",
  },
  "obj.decide": {
    id: "obj.decide",
    text: "Decide what to do about your account.",
    activateWhen: [{ kind: "callClosed", callId: "call.recovery" }],
    completeWhen: [{ kind: "outcomeSet" }],
    hint: "Think about which sources you reached on your own, and which reached you.",
  },
  "obj.review": {
    id: "obj.review",
    text: "Review what happened.",
    activateWhen: [{ kind: "outcomeSet" }],
    completeWhen: [{ kind: "objectiveCompleted", objectiveId: "obj.decide" }],
  },
};
