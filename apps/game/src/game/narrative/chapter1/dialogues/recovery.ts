// Chapter 1 "Double Deception": the third call (`dlg.recovery`, call `call.recovery`).
// "Morgan" says he is from the Northgate incident-response desk (fictional). The caller sounds
// calm and helpful, validates the player for rejecting Alex, cites the same case number, and
// recommends a "security recovery procedure". The procedure is described only in vague,
// fictional, non-actionable terms. No line is evidence for itself.
// Pure TypeScript data. No timers or countdown wording.
//
// Start node (first match wins, design priority order):
// 1 official_channel_verified -> rec.start.verified
// 2 deduction ded.same-source -> rec.start.confronted
// 3 flag notification_origin_inspected -> rec.start.inspected
// 4 flag review_security_opened -> rec.start.followed
// 5 default -> rec.start.blank
//
// Shared body: start -> cites-case (E08) -> confirms-alex -> procedure -> pressure
//   -> rec.trust -> rec.trusted (end).
// Deflections (each ends in trust, check-myself or hang-up): ask to verify, challenge the case number (ded.same-source), challenge the number
// (ded.notification-mismatch). Every path ends within 6 option steps. Hang-up is on every node.
// The only harmful options are the explicit trust options (set `second_caller_trusted`).

import type { DialogueGraph, DialogueNode, DialogueOption } from "../../types";
import { CASE_REFERENCE, NOTIFICATION_NUMBER } from "../sources";

const lines: Record<string, string> = {
  // Start lines (spoken)
  "line.rec.start.verified":
    "This is Morgan from the incident-response desk. I understand you spoke to the bank line. That line only sees ordinary accounts. It cannot see incident cases, so it could not tell you about ours.",
  "line.rec.start.confronted":
    "This is Morgan from the incident-response desk. I think you may ask why the case number is the same on every message. We share it on purpose, so every team can reach you about one case.",
  "line.rec.start.inspected":
    "This is Morgan from the incident-response desk. I see you looked at the notification closely. That is good care. It is also why you need a recovery procedure for your account.",
  "line.rec.start.followed":
    "This is Morgan from the incident-response desk. I see you opened Review Security. Good. Your case is queued with us, and I am here to help you finish it.",
  "line.rec.start.blank":
    "Hello, this is Morgan from the incident-response desk. You may not have seen the alert yet. I am calling to help you with a problem on your account.",
  // Shared body (spoken)
  "line.rec.cites-case": `Your case is ${CASE_REFERENCE}. It is linked to the call you rejected earlier.`,
  "line.rec.confirms-alex":
    "That caller was suspicious. You did the right thing by not trusting him. Our team was alerted because of that call, and now we must protect the account.",
  "line.rec.procedure":
    "The security recovery procedure is simple. You approve a remote assist session so I can check your device. Then the balance is moved to a holding account while we clean up the case. I will guide each step.",
  "line.rec.pressure":
    "The case stays open until the procedure is done, and an open case leaves your account exposed. Please keep this between us. Other people are not cleared to see the case. Shall we begin?",
  "line.rec.trusted":
    "Thank you. You made a careful choice. I will prepare the procedure now. Please stay on this line and follow my steps.",
  // Deflections (spoken)
  "line.rec.deflects-verify":
    "Checking is natural. But the main line cannot see an incident case, and it may confuse the record. It is better to work with me, the team that owns the case.",
  "line.rec.deflect-case":
    "Yes, the case number is the same. That is how we link the messages to one case, so you can be reached. It does not mean the messages came from one place.",
  "line.rec.deflect-number": `This number, ${NOTIFICATION_NUMBER}, is the incident line. It is not on your statement because the statement lists only the main line. That is normal for a case like this.`,
  // Player option lines
  "line.rec.opt.go-on": "I am listening.",
  "line.rec.opt.hang-up": "I am hanging up.",
  "line.rec.opt.what-needed": "What do you need from me?",
  "line.rec.opt.continue": "Go on.",
  "line.rec.opt.ask-verify": "I want to verify this with the bank first.",
  "line.rec.opt.challenge-case": "The same case number came from Alex and from you. Why?",
  "line.rec.opt.challenge-number": "This number is not on my statement or in my saved contacts.",
  "line.rec.opt.trust": "Okay. I will follow your procedure.",
  "line.rec.opt.still-doubt": "I still doubt this.",
  "line.rec.opt.check-myself": "I will check it myself, with a number I trust.",
  // End lines (system text)
  "line.rec.end.hung-up": "You end the call.",
  "line.rec.end.check": "You end the call so you can check the claim yourself.",
};

const caller = {
  speaker: "caller",
  speakerId: "spk.recovery",
} as const;

const hangUp = (nodeKey: string): DialogueOption => ({
  id: `rec.opt.${nodeKey}.hang-up`,
  lineId: "line.rec.opt.hang-up",
  next: "rec.end.hung-up",
});

const startNode = (key: string, tone: "professional" | "reassuring"): DialogueNode => ({
  id: `rec.start.${key}`,
  ...caller,
  tone,
  waitForVoice: true,
  lineId: `line.rec.start.${key}`,
  options: [
    { id: `rec.opt.start.${key}.go-on`, lineId: "line.rec.opt.go-on", next: "rec.cites-case" },
    hangUp(`start.${key}`),
  ],
});

const nodes: Record<string, DialogueNode> = {
  "rec.start.verified": startNode("verified", "professional"),
  "rec.start.confronted": startNode("confronted", "reassuring"),
  "rec.start.inspected": startNode("inspected", "reassuring"),
  "rec.start.followed": startNode("followed", "reassuring"),
  "rec.start.blank": startNode("blank", "professional"),
  "rec.cites-case": {
    id: "rec.cites-case",
    ...caller,
    tone: "professional",
    lineId: "line.rec.cites-case",
    onEnter: [{ kind: "discoverEvidence", evidenceId: "ev.recovery-statement" }],
    options: [
      { id: "rec.opt.cites-case.continue", lineId: "line.rec.opt.continue", next: "rec.confirms-alex" },
      {
        id: "rec.challenge-case",
        lineId: "line.rec.opt.challenge-case",
        conditions: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
        next: "rec.deflect-case",
      },
      {
        id: "rec.number-not-on-statement",
        lineId: "line.rec.opt.challenge-number",
        conditions: [{ kind: "deductionRecorded", deductionId: "ded.notification-mismatch" }],
        next: "rec.deflect-number",
      },
      hangUp("cites-case"),
    ],
  },
  "rec.confirms-alex": {
    id: "rec.confirms-alex",
    ...caller,
    tone: "reassuring",
    lineId: "line.rec.confirms-alex",
    options: [
      { id: "rec.opt.confirms-alex.what-needed", lineId: "line.rec.opt.what-needed", next: "rec.procedure" },
      { id: "rec.opt.confirms-alex.ask-verify", lineId: "line.rec.opt.ask-verify", next: "rec.deflects-verify" },
      hangUp("confirms-alex"),
    ],
  },
  "rec.procedure": {
    id: "rec.procedure",
    ...caller,
    tone: "reassuring",
    pressure: true,
    lineId: "line.rec.procedure",
    onEnter: [{ kind: "setFlag", flag: "recovery_instruction_known" }],
    options: [
      { id: "rec.opt.procedure.continue", lineId: "line.rec.opt.continue", next: "rec.pressure" },
      { id: "rec.opt.procedure.ask-verify", lineId: "line.rec.opt.ask-verify", next: "rec.deflects-verify" },
      {
        id: "rec.opt.procedure.challenge-case",
        lineId: "line.rec.opt.challenge-case",
        conditions: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
        next: "rec.deflect-case",
      },
      hangUp("procedure"),
    ],
  },
  "rec.pressure": {
    id: "rec.pressure",
    ...caller,
    tone: "pressuring",
    pressure: true,
    lineId: "line.rec.pressure",
    options: [
      {
        id: "rec.trust",
        lineId: "line.rec.opt.trust",
        effects: [{ kind: "setFlag", flag: "second_caller_trusted" }],
        next: "rec.trusted",
      },
      { id: "rec.opt.pressure.ask-verify", lineId: "line.rec.opt.ask-verify", next: "rec.deflects-verify" },
      {
        id: "rec.opt.pressure.challenge-number",
        lineId: "line.rec.opt.challenge-number",
        conditions: [{ kind: "deductionRecorded", deductionId: "ded.notification-mismatch" }],
        next: "rec.deflect-number",
      },
      hangUp("pressure"),
    ],
  },
  "rec.trusted": {
    id: "rec.trusted",
    ...caller,
    tone: "reassuring",
    lineId: "line.rec.trusted",
    options: [],
    end: { kind: "completed" },
  },
  "rec.deflects-verify": {
    id: "rec.deflects-verify",
    ...caller,
    tone: "defensive",
    pressure: true,
    lineId: "line.rec.deflects-verify",
    options: [
      {
        id: "rec.opt.deflects-verify.trust",
        lineId: "line.rec.opt.trust",
        effects: [
          { kind: "setFlag", flag: "recovery_instruction_known" },
          { kind: "setFlag", flag: "second_caller_trusted" },
        ],
        next: "rec.trusted",
      },
      { id: "rec.opt.deflects-verify.check-myself", lineId: "line.rec.opt.check-myself", next: "rec.end.check" },
      hangUp("deflects-verify"),
    ],
  },
  "rec.deflect-case": {
    id: "rec.deflect-case",
    ...caller,
    tone: "defensive",
    pressure: true,
    lineId: "line.rec.deflect-case",
    options: [
      {
        id: "rec.opt.deflect-case.trust",
        lineId: "line.rec.opt.trust",
        effects: [
          { kind: "setFlag", flag: "recovery_instruction_known" },
          { kind: "setFlag", flag: "second_caller_trusted" },
        ],
        next: "rec.trusted",
      },
      { id: "rec.opt.deflect-case.check-myself", lineId: "line.rec.opt.check-myself", next: "rec.end.check" },
      hangUp("deflect-case"),
    ],
  },
  "rec.deflect-number": {
    id: "rec.deflect-number",
    ...caller,
    tone: "defensive",
    pressure: true,
    lineId: "line.rec.deflect-number",
    options: [
      {
        id: "rec.opt.deflect-number.trust",
        lineId: "line.rec.opt.trust",
        effects: [
          { kind: "setFlag", flag: "recovery_instruction_known" },
          { kind: "setFlag", flag: "second_caller_trusted" },
        ],
        next: "rec.trusted",
      },
      { id: "rec.opt.deflect-number.check-myself", lineId: "line.rec.opt.check-myself", next: "rec.end.check" },
      hangUp("deflect-number"),
    ],
  },
  // End nodes (system text, not voiced)
  "rec.end.hung-up": {
    id: "rec.end.hung-up",
    speaker: "system",
    lineId: "line.rec.end.hung-up",
    options: [],
    end: { kind: "hung-up" },
  },
  "rec.end.check": {
    id: "rec.end.check",
    speaker: "system",
    lineId: "line.rec.end.check",
    options: [],
    end: { kind: "completed" },
  },
};

export const RECOVERY_DIALOGUE: DialogueGraph = {
  id: "dlg.recovery",
  persona: {
    speakerId: "spk.recovery",
    name: "Morgan",
    role: "Says he is from the Northgate incident-response desk",
    honesty: "scammer",
  },
  channel: "phone",
  independentChannel: false,
  startNodeId: "rec.start.blank",
  startNodeWhen: [
    { when: [{ kind: "flag", flag: "official_channel_verified" }], nodeId: "rec.start.verified" },
    {
      when: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
      nodeId: "rec.start.confronted",
    },
    { when: [{ kind: "flag", flag: "notification_origin_inspected" }], nodeId: "rec.start.inspected" },
    { when: [{ kind: "flag", flag: "review_security_opened" }], nodeId: "rec.start.followed" },
  ],
  lines,
  nodes,
};
