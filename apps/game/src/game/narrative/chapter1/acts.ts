// Chapter 1 acts (design.md, "Narrative graph"). Acts are monotonic and derived from state by
// `selectCurrentAct`. Each `exitWhen` equals the next act's `enterWhen` (validator rule V1).

import type { ActDef, Condition } from "../types";

const ALEX_CLOSED: Condition[] = [{ kind: "callClosed", callId: "call.alex" }];
const NOTIFICATION_HANDLED: Condition[] = [{ kind: "flag", flag: "notification_handled" }];
const RECOVERY_RANG: Condition[] = [{ kind: "callRang", callId: "call.recovery" }];
const RECOVERY_CLOSED: Condition[] = [{ kind: "callClosed", callId: "call.recovery" }];

export const CHAPTER_1_ACTS: ActDef[] = [
  {
    id: "act.1",
    title: "The Obvious Trap",
    enterWhen: [],
    exitWhen: ALEX_CLOSED,
    objectives: ["obj.answer-or-decline"],
  },
  {
    id: "act.2",
    title: "The Reassuring Choice",
    enterWhen: ALEX_CLOSED,
    exitWhen: NOTIFICATION_HANDLED,
    objectives: ["obj.check-laptop"],
  },
  {
    id: "act.3",
    title: "The Contradiction",
    enterWhen: NOTIFICATION_HANDLED,
    exitWhen: RECOVERY_RANG,
    objectives: ["obj.investigate"],
  },
  {
    id: "act.4",
    title: "The Third Voice",
    enterWhen: RECOVERY_RANG,
    exitWhen: RECOVERY_CLOSED,
    objectives: ["obj.answer-recovery"],
  },
  {
    id: "act.5",
    title: "The False Victory",
    enterWhen: RECOVERY_CLOSED,
    exitWhen: [],
    objectives: ["obj.decide", "obj.review"],
  },
];
