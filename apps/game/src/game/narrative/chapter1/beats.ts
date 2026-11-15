// Chapter 1 scripted beats: records and the laptop notification that follow the first call.
// Each beat also guards itself with a `notFlag` on the flag it sets, in addition to the
// reducer's beat markers. Pure data: no React, Three.js or i18n.

import type { BeatDef } from "../types";

export const CHAPTER_1_BEATS: BeatDef[] = [
  {
    // The player rejected Alex without talking: the voicemail carries the same case ID.
    id: "beat.voicemail",
    when: [
      { kind: "callClosed", callId: "call.alex" },
      { kind: "flag", flag: "first_call_rejected" },
      { kind: "notFlag", flag: "first_call_answered" },
      { kind: "notFlag", flag: "voicemail_delivered" },
    ],
    effects: [
      { kind: "setFlag", flag: "voicemail_delivered" },
      { kind: "deliverMessage", messageId: "msg.alex-voicemail" },
    ],
  },
  {
    // The player answered and the call ended: a call summary record is kept.
    id: "beat.call-summary",
    when: [
      { kind: "callClosed", callId: "call.alex" },
      { kind: "flag", flag: "first_call_answered" },
      { kind: "notFlag", flag: "call_summary_delivered" },
    ],
    effects: [
      { kind: "setFlag", flag: "call_summary_delivered" },
      { kind: "deliverMessage", messageId: "msg.alex-summary" },
    ],
  },
  {
    // Act I is over: the laptop receives the notification.
    id: "beat.notification",
    when: [
      { kind: "callClosed", callId: "call.alex" },
      { kind: "notFlag", flag: "notification_delivered" },
    ],
    effects: [{ kind: "setFlag", flag: "notification_delivered" }],
  },
];
