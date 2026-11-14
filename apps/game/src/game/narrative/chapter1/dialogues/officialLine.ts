// Chapter 1 "Double Deception": the official bank line (`dlg.official-line`, call `call.official`).
// The player dials the number saved before today. This is an independent channel: it is the only
// graph that may set claim statuses. The agent never calls any number, message or caller "safe".
// It says what the bank did not send, and how the player can check for themselves.
// Pure TypeScript data. No timers or countdown wording.
//
// Node IDs are stable and double as voice clip IDs (`off.*`). End nodes are system nodes.
//
// Paths:
// - open -> ask -> confirm -> (advice | report | end.done)
// - confirm/advice/report -> end.done, or hang up at any node (end.hung-up)
//
// Entering `off.confirm` discovers `ev.official-confirmation`, sets the four claims to
// `contradicted` and sets `official_channel_verified`. Hanging up before that changes nothing.

import type { DialogueGraph, DialogueNode, DialogueOption } from "../../types";
import { OFFICIAL_NUMBER, CASE_REFERENCE } from "../sources";

const lines: Record<string, string> = {
  // Agent lines (spoken, voice clips)
  "line.official.greeting":
    "Hello, this is Northgate Bank customer care. You called the number saved on your statement. How can I help you today?",
  "line.official.agent": `Of course. Please tell me the case ID or the message you received, and I will look at your account.`,
  "line.official.confirm": `I have checked your account. There is no case ${CASE_REFERENCE}. We did not send you a notification about it. We also have no recovery procedure that is done by phone, and we never ask for a code in a call.`,
  "line.official.advice": `If someone calls and says they are from the bank, end the call. Then call us on the number saved on your statement, ${OFFICIAL_NUMBER}, or use the bank app you installed yourself. Never read a code to a caller. That includes a caller who knows your case ID.`,
  "line.official.report-basic":
    "To report this, use the official channel of your bank, such as the number on your statement or the help section of your bank app. Tell them the time of each call, the numbers that called, and what was asked of you. Do not reply to the caller or to the notification.",
  // Player option lines
  "line.official.opt.ask-case": "I want to ask about a call and a notification I received.",
  "line.official.opt.give-case": `The case ID is ${CASE_REFERENCE}. Is it real?`,
  "line.official.opt.advice": "What should I do if someone calls me like this again?",
  "line.official.opt.report-call": "How do I report these calls?",
  "line.official.opt.all-done": "That is all. Thank you.",
  "line.official.opt.hang-up": "I am hanging up.",
  // End lines (system text)
  "line.official.end": "You end the call with Northgate.",
  "line.official.end.hung-up": "You end the call.",
};

const hangUp = (nodeKey: string): DialogueOption => ({
  id: `off.opt.${nodeKey}.hang-up`,
  lineId: "line.official.opt.hang-up",
  next: "off.end.hung-up",
});

const nodes: Record<string, DialogueNode> = {
  "off.open": {
    id: "off.open",
    speaker: "caller",
    speakerId: "spk.northgate-agent",
    tone: "professional",
    waitForVoice: true,
    lineId: "line.official.greeting",
    options: [
      { id: "off.opt.open.ask-case", lineId: "line.official.opt.ask-case", next: "off.ask" },
      hangUp("open"),
    ],
  },
  "off.ask": {
    id: "off.ask",
    speaker: "caller",
    speakerId: "spk.northgate-agent",
    tone: "reassuring",
    lineId: "line.official.agent",
    options: [
      { id: "off.opt.ask.give-case", lineId: "line.official.opt.give-case", next: "off.confirm" },
      hangUp("ask"),
    ],
  },
  "off.confirm": {
    id: "off.confirm",
    speaker: "caller",
    speakerId: "spk.northgate-agent",
    tone: "professional",
    lineId: "line.official.confirm",
    onEnter: [
      { kind: "discoverEvidence", evidenceId: "ev.official-confirmation" },
      { kind: "setClaimStatus", claimId: "claim.alex-identity", status: "contradicted" },
      { kind: "setClaimStatus", claimId: "claim.notification-genuine", status: "contradicted" },
      { kind: "setClaimStatus", claimId: "claim.recovery-needed", status: "contradicted" },
      { kind: "setClaimStatus", claimId: "claim.claims-independent", status: "contradicted" },
      { kind: "setFlag", flag: "official_channel_verified" },
    ],
    options: [
      { id: "off.opt.confirm.advice", lineId: "line.official.opt.advice", next: "off.advice" },
      { id: "off.opt.confirm.report", lineId: "line.official.opt.report-call", next: "off.report" },
      { id: "off.opt.confirm.all-done", lineId: "line.official.opt.all-done", next: "off.end.done" },
      hangUp("confirm"),
    ],
  },
  "off.advice": {
    id: "off.advice",
    speaker: "caller",
    speakerId: "spk.northgate-agent",
    tone: "reassuring",
    lineId: "line.official.advice",
    options: [
      { id: "off.opt.advice.report", lineId: "line.official.opt.report-call", next: "off.report" },
      { id: "off.opt.advice.all-done", lineId: "line.official.opt.all-done", next: "off.end.done" },
      hangUp("advice"),
    ],
  },
  "off.report": {
    id: "off.report",
    speaker: "caller",
    speakerId: "spk.northgate-agent",
    tone: "professional",
    lineId: "line.official.report-basic",
    options: [
      { id: "off.opt.report.all-done", lineId: "line.official.opt.all-done", next: "off.end.done" },
      hangUp("report"),
    ],
  },
  // End nodes (system text, not voiced)
  "off.end.done": {
    id: "off.end.done",
    speaker: "system",
    lineId: "line.official.end",
    options: [],
    end: { kind: "completed" },
  },
  "off.end.hung-up": {
    id: "off.end.hung-up",
    speaker: "system",
    lineId: "line.official.end.hung-up",
    options: [],
    end: { kind: "hung-up" },
  },
};

export const OFFICIAL_LINE_DIALOGUE: DialogueGraph = {
  id: "dlg.official-line",
  persona: {
    speakerId: "spk.northgate-agent",
    name: "Northgate customer care",
    role: "Agent on the official Northgate Bank line",
    honesty: "trusted",
  },
  channel: "phone",
  independentChannel: true,
  startNodeId: "off.open",
  lines,
  nodes,
};
