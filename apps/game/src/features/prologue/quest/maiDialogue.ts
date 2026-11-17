// The conversation with Auntie Mai, the banh mi vendor (the first quest of Chapter 1). Structure
// only: the text is in `i18n/locales/{en,vi}/worlds/quests.ts` under `quests.mai`.
//
// Flow: she asks about the player's life (three replies), then warns about the scams going around.
// The player may ask for details (a fake bank call that asks for the OTP, a fake police call), or
// leave. When the details are not asked for, she just says goodbye.
import type { DialogueGraph } from "./dialogue";

export const MAI_DIALOGUE: DialogueGraph = {
  prefix: "worlds:quests.mai",
  nodes: {
    greet: {
      id: "greet",
      options: [
        { id: "busy", next: "work" },
        { id: "quiet", next: "quiet" },
        { id: "stall", next: "stallTalk" },
      ],
    },
    work: { id: "work", next: "scams" },
    quiet: { id: "quiet", next: "scams" },
    stallTalk: { id: "stallTalk", next: "scams" },
    scams: {
      id: "scams",
      options: [
        { id: "kinds", next: "kinds" },
        { id: "awful", next: "comfort" },
        { id: "leave", next: "bye" },
      ],
    },
    comfort: { id: "comfort", next: "bye" },
    kinds: {
      id: "kinds",
      options: [
        { id: "otp", next: "otp" },
        { id: "police", next: "police" },
        { id: "enough", next: "bye" },
      ],
    },
    otp: {
      id: "otp",
      options: [
        { id: "policeToo", next: "police", hideIfVisited: ["police"] },
        { id: "gotItOtp", next: "wrap", showIfVisited: ["police"] },
        { id: "gotItOtp", next: "bye", hideIfVisited: ["police"] },
      ],
    },
    police: {
      id: "police",
      options: [
        { id: "otpToo", next: "otp", hideIfVisited: ["otp"] },
        { id: "gotItPolice", next: "wrap", showIfVisited: ["otp"] },
        { id: "gotItPolice", next: "bye", hideIfVisited: ["otp"] },
      ],
    },
    wrap: { id: "wrap", next: "bye" },
    bye: { id: "bye", options: [{ id: "goodbye", next: null }] },
    again: { id: "again", options: [{ id: "goodbye", next: null }] },
  },
};

/** Node where a conversation starts: the full one the first time, a short greeting afterwards. */
export const maiStart = (alreadyMet: boolean) => (alreadyMet ? "again" : "greet");
