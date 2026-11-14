// Chapter 1 "Double Deception": the first call (`dlg.alex`, call `call.alex`).
// Alex claims to be from the fictional "Northgate" security desk. He is plausible at first and
// becomes more suspicious: pressure, a refusal to let the player call back, and a code request.
// The "code" is fictional and is never typed or entered by the player in the game.
// Pure TypeScript data. No timers or countdown wording (design: no timers in the core).
//
// Node IDs are stable and double as voice clip IDs (`alex.*`). End nodes are system nodes.
//
// Paths (every path ends within 6 option steps, the longest is 6):
// - open -> who -> defend -> callback -> pressure -> refused -> end.check
// - open -> who -> details -> proof -> pressure -> alex.share-code -> code-taken
// - any non-end node -> hang up (sets `first_call_rejected`)
//
// The only harmful option is `alex.share-code`. It sets `code_shared`, an explicit choice.
// Nodes marked `pressure: true` add 1 pressure when entered (capped at 3 by the engine).
// No debrief tags are used yet: the decision notes are authored by the debrief task.
//
// Foreshadowing (Requirements 5.x, 9.7): `alex.proof` and `alex.refused` name the case ID
// NG-4471-X, announce a notification on the laptop, and name a follow-up team that will call.

import type { DialogueGraph, DialogueNode, DialogueOption } from "../../types";

const lines: Record<string, string> = {
  // Caller lines (spoken, voice clips)
  "line.alex.open":
    "Hello, this is Alex from the Northgate Security Desk. We found unusual activity linked to your account. Am I speaking with the account holder?",
  "line.alex.who":
    "I am Alex, a case handler. Your case ID is NG-4471-X. I can help you with this, but I need a few details to continue.",
  "line.alex.defend":
    "I understand why you are careful. The number on your screen is our special case line. It is not the number on your card. That is normal for security cases.",
  "line.alex.details":
    "I cannot share every detail on an open line. Money may leave your account soon. If we act together on case NG-4471-X, we can stop it.",
  "line.alex.callback":
    "Please do not call back. The main line cannot see this case, and the wait is long. Stay with me. I am the only person who can help with it.",
  "line.alex.proof":
    "Of course. The case ID is NG-4471-X. You will also get a notification on your laptop about this case. After this call, a follow-up team will contact you to finish the process.",
  "line.alex.pressure":
    "To protect the account, I need the verification code that was sent to your phone. Please read it to me. Do not tell anyone else about this call. They are not cleared to see the case.",
  "line.alex.refused":
    "That is a mistake. Without the code, I cannot close case NG-4471-X. A notification will arrive on your laptop, and the follow-up team will call you. Please use them, not the main line.",
  "line.alex.code-taken":
    "Thank you. That helps. The follow-up team will contact you with the next steps. Please do not speak about this to anyone until then.",
  // Player option lines
  "line.alex.opt.ask-who": "Who are you, and why are you calling me?",
  "line.alex.opt.challenge-number": "This is not the number on my card.",
  "line.alex.opt.ask-details": "What is the problem with my account?",
  "line.alex.opt.hang-up": "I am hanging up.",
  "line.alex.opt.ask-details-next": "Tell me more about the problem.",
  "line.alex.opt.keep-challenging": "I still do not trust this number.",
  "line.alex.opt.accept": "Okay. What do you need from me?",
  "line.alex.opt.ask-proof": "How can I know you are really from the bank?",
  "line.alex.opt.call-back": "I will call the bank back myself.",
  "line.alex.opt.go-on": "Go on.",
  "line.alex.opt.then-what": "Then what do you need?",
  "line.alex.opt.continue": "I see. Please continue.",
  "line.alex.opt.share-code": "Read the code to the caller.",
  "line.alex.opt.refuse-code": "No. I will not share a code with you.",
  "line.alex.opt.check-myself": "I will check it myself, with a number I trust.",
  // End lines (system text)
  "line.alex.end.hung-up": "You end the call.",
  "line.alex.end.check": "You end the call so you can check the claim yourself.",
};

const hangUp = (nodeKey: string): DialogueOption => ({
  id: `alex.opt.${nodeKey}.hang-up`,
  lineId: "line.alex.opt.hang-up",
  effects: [{ kind: "setFlag", flag: "first_call_rejected" }],
  next: "alex.end.hung-up",
});

const nodes: Record<string, DialogueNode> = {
  "alex.open": {
    id: "alex.open",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "professional",
    waitForVoice: true,
    lineId: "line.alex.open",
    onEnter: [{ kind: "setFlag", flag: "first_call_answered" }],
    options: [
      { id: "alex.opt.open.ask-who", lineId: "line.alex.opt.ask-who", next: "alex.who" },
      {
        id: "alex.opt.open.challenge-number",
        lineId: "line.alex.opt.challenge-number",
        next: "alex.defend",
      },
      { id: "alex.opt.open.ask-details", lineId: "line.alex.opt.ask-details", next: "alex.details" },
      hangUp("open"),
    ],
  },
  "alex.who": {
    id: "alex.who",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "reassuring",
    lineId: "line.alex.who",
    onEnter: [{ kind: "setFlag", flag: "case_id_heard" }],
    options: [
      {
        id: "alex.opt.who.ask-details",
        lineId: "line.alex.opt.ask-details-next",
        next: "alex.details",
      },
      {
        id: "alex.opt.who.challenge-number",
        lineId: "line.alex.opt.challenge-number",
        next: "alex.defend",
      },
      hangUp("who"),
    ],
  },
  "alex.defend": {
    id: "alex.defend",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    pressure: true,
    lineId: "line.alex.defend",
    options: [
      {
        id: "alex.opt.defend.keep-challenging",
        lineId: "line.alex.opt.keep-challenging",
        next: "alex.callback",
      },
      { id: "alex.opt.defend.accept", lineId: "line.alex.opt.accept", next: "alex.pressure" },
      hangUp("defend"),
    ],
  },
  "alex.details": {
    id: "alex.details",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    pressure: true,
    lineId: "line.alex.details",
    options: [
      { id: "alex.opt.details.ask-proof", lineId: "line.alex.opt.ask-proof", next: "alex.proof" },
      { id: "alex.opt.details.go-on", lineId: "line.alex.opt.go-on", next: "alex.pressure" },
      hangUp("details"),
    ],
  },
  "alex.callback": {
    id: "alex.callback",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "impatient",
    pressure: true,
    lineId: "line.alex.callback",
    options: [
      { id: "alex.opt.callback.then-what", lineId: "line.alex.opt.then-what", next: "alex.pressure" },
      {
        id: "alex.opt.callback.call-back",
        lineId: "line.alex.opt.call-back",
        effects: [{ kind: "setFlag", flag: "first_call_rejected" }],
        next: "alex.end.check",
      },
      hangUp("callback"),
    ],
  },
  "alex.proof": {
    id: "alex.proof",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "reassuring",
    lineId: "line.alex.proof",
    onEnter: [{ kind: "setFlag", flag: "case_id_heard" }],
    options: [
      { id: "alex.opt.proof.continue", lineId: "line.alex.opt.continue", next: "alex.pressure" },
      hangUp("proof"),
    ],
  },
  "alex.pressure": {
    id: "alex.pressure",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    pressure: true,
    lineId: "line.alex.pressure",
    onEnter: [{ kind: "setFlag", flag: "alex_request_heard" }],
    options: [
      {
        id: "alex.share-code",
        lineId: "line.alex.opt.share-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "alex.code-taken",
      },
      {
        id: "alex.opt.pressure.refuse-code",
        lineId: "line.alex.opt.refuse-code",
        next: "alex.refused",
      },
      hangUp("pressure"),
    ],
  },
  "alex.refused": {
    id: "alex.refused",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "impatient",
    lineId: "line.alex.refused",
    options: [
      {
        id: "alex.opt.refused.check-myself",
        lineId: "line.alex.opt.check-myself",
        effects: [{ kind: "setFlag", flag: "first_call_rejected" }],
        next: "alex.end.check",
      },
      hangUp("refused"),
    ],
  },
  "alex.code-taken": {
    id: "alex.code-taken",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "reassuring",
    lineId: "line.alex.code-taken",
    options: [],
    end: { kind: "completed" },
  },
  // End nodes (system text, not voiced)
  "alex.end.hung-up": {
    id: "alex.end.hung-up",
    speaker: "system",
    lineId: "line.alex.end.hung-up",
    options: [],
    end: { kind: "hung-up" },
  },
  "alex.end.check": {
    id: "alex.end.check",
    speaker: "system",
    lineId: "line.alex.end.check",
    options: [],
    end: { kind: "completed" },
  },
};

export const ALEX_DIALOGUE: DialogueGraph = {
  id: "dlg.alex",
  persona: {
    speakerId: "spk.alex",
    name: "Alex",
    role: "Says he is a case handler at the Northgate Security Desk",
    honesty: "scammer",
  },
  channel: "phone",
  independentChannel: false,
  startNodeId: "alex.open",
  lines,
  nodes,
};
