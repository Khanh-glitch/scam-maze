// Chapter 1 interactables: the three props in the player's room that carry evidence.
// Each maps to a Room v2 prop (`note`, `receipts`, `calendar`) and reveals one evidence item.
// The inspection text carries the evidence text, so the player reads the clue itself.
// Every identifier comes from sources.ts. Pure data: no React, Three.js or i18n.

import type { InteractableDef } from "../types";
import type { InteractableId } from "./ids";
import { OFFICIAL_NUMBER, SAVED_APP } from "./sources";

export const CHAPTER_1_INTERACTABLES: Record<InteractableId, InteractableDef> = {
  "obj.note": {
    id: "obj.note",
    label: "Your handwritten reminder",
    actionLabel: "read",
    inspectionText: [
      "A note in your own handwriting, pinned near the desk.",
      `It says: "My bank reaches me through the ${SAVED_APP} app. For a call, use the number printed on the back of my card and statement: ${OFFICIAL_NUMBER}. I never use a number someone gives me."`,
      "You wrote it after a friend had a bad experience. The note does not say that any message today is wrong. It only says how your bank has always contacted you.",
    ].join(" "),
    produces: { type: "INTERACT_OBJECT" },
    reveals: ["ev.note-app-origin"],
  },
  "obj.receipts": {
    id: "obj.receipts",
    label: "The folded bank statement",
    actionLabel: "look at",
    inspectionText: [
      "A paper statement folded in with your receipts.",
      `At the bottom of the first page, the bank prints its contact number: ${OFFICIAL_NUMBER}.`,
      "This paper was printed before today. It shows a number you can compare with any number that reaches you now.",
    ].join(" "),
    produces: { type: "INTERACT_OBJECT" },
    reveals: ["ev.official-contact-paper"],
  },
  "obj.calendar": {
    id: "obj.calendar",
    label: "The wall calendar",
    actionLabel: "check",
    inspectionText: [
      "Your wall calendar. The next statement date is marked near the end of the month.",
      "No appointment with a bank security team is written on any day.",
      "This is a small detail. It fits what you remember, but a missing entry does not prove anything on its own.",
    ].join(" "),
    produces: { type: "INTERACT_OBJECT" },
    reveals: ["ev.calendar-routine"],
  },
};

/** One complete sentence per prop, shown while the crosshair is on it. */
export const CHAPTER_1_INTERACTION_PROMPTS: Record<InteractableId, string> = {
  "obj.note": "Read your handwritten reminder",
  "obj.receipts": "Look at the folded bank statement",
  "obj.calendar": "Check the wall calendar",
};
