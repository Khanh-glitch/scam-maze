// Chapter 1 device actions: what the player can do on the laptop and in the phone records.
// Evidence is revealed only through `reveals`. No action asks for typed input, opens a link or
// makes a network request. Labels are plain English source text (the Vietnamese overlay and the
// UI keys carry the translations). Pure data: no React, Three.js or i18n.

import type { DeviceActionId } from "./ids";
import type { DeviceActionDef } from "../types";

export const CHAPTER_1_DEVICE_ACTIONS: Record<DeviceActionId, DeviceActionDef> = {
  "dev.open-alex-record": {
    id: "dev.open-alex-record",
    device: "phone",
    label: "Open the record of the first call",
    requires: [{ kind: "callClosed", callId: "call.alex" }],
    effects: [
      { kind: "setFlag", flag: "case_id_heard" },
      { kind: "setFlag", flag: "alex_request_heard" },
    ],
    reveals: ["ev.alex-statement"],
    once: true,
    debriefTag: "opened-alex-record",
  },
  "dev.open-call-details": {
    id: "dev.open-call-details",
    device: "phone",
    label: "Open the call details",
    requires: [{ kind: "callRang", callId: "call.alex" }],
    effects: [],
    reveals: ["ev.caller-id-anomaly"],
    once: true,
    debriefTag: "opened-call-details",
  },
  "dev.open-notification": {
    id: "dev.open-notification",
    device: "laptop",
    label: "Open the notification",
    requires: [{ kind: "flag", flag: "notification_delivered" }],
    effects: [
      { kind: "setFlag", flag: "notification_opened" },
      { kind: "setFlag", flag: "notification_handled" },
    ],
    reveals: [],
    // A dismissed notification stays in the history and can still be opened.
    once: false,
    debriefTag: "opened-notification",
  },
  "dev.dismiss-notification": {
    id: "dev.dismiss-notification",
    device: "laptop",
    label: "Dismiss the notification",
    requires: [
      { kind: "flag", flag: "notification_delivered" },
      { kind: "notFlag", flag: "notification_handled" },
    ],
    effects: [
      { kind: "setFlag", flag: "notification_dismissed" },
      { kind: "setFlag", flag: "notification_handled" },
    ],
    reveals: [],
    once: true,
    debriefTag: "dismissed-notification",
  },
  "dev.inspect-notification-origin": {
    id: "dev.inspect-notification-origin",
    device: "laptop",
    label: "Check where the notification comes from",
    requires: [{ kind: "flag", flag: "notification_opened" }],
    effects: [{ kind: "setFlag", flag: "notification_origin_inspected" }],
    reveals: ["ev.notification-metadata"],
    once: true,
    debriefTag: "inspected-origin",
  },
  "dev.open-bank-app": {
    id: "dev.open-bank-app",
    device: "laptop",
    label: "Open the bank app you installed yourself",
    requires: [],
    effects: [{ kind: "setFlag", flag: "bank_app_opened" }],
    reveals: [],
    once: true,
    debriefTag: "opened-bank-app",
  },
  "dev.open-account-activity": {
    id: "dev.open-account-activity",
    device: "laptop",
    label: "Look at the account activity",
    requires: [{ kind: "flag", flag: "bank_app_opened" }],
    effects: [],
    reveals: ["ev.account-activity"],
    once: true,
    debriefTag: "checked-account-activity",
  },
  "dev.open-saved-contacts": {
    id: "dev.open-saved-contacts",
    device: "laptop",
    label: "Look at the contacts saved in the bank app",
    requires: [{ kind: "flag", flag: "bank_app_opened" }],
    effects: [],
    reveals: ["ev.official-contact-app"],
    once: true,
    debriefTag: "checked-saved-contacts",
  },
  "dev.compare-case-ref": {
    id: "dev.compare-case-ref",
    device: "laptop",
    label: "Compare the case reference with the first call",
    requires: [
      { kind: "flag", flag: "case_id_heard" },
      { kind: "flag", flag: "notification_opened" },
    ],
    effects: [],
    reveals: ["ev.shared-case-id"],
    once: true,
    debriefTag: "compared-case-ref",
  },
  "dev.compare-contacts": {
    id: "dev.compare-contacts",
    device: "laptop",
    label: "Compare the contact details with your saved records",
    requires: [{ kind: "flag", flag: "notification_opened" }],
    effects: [],
    reveals: [],
    once: true,
    debriefTag: "compared-contacts",
  },
  "dev.review-security": {
    id: "dev.review-security",
    device: "laptop",
    label: "Open Review Security",
    requires: [{ kind: "flag", flag: "notification_delivered" }],
    // The page only shows text. It asks for no password, no code and no personal data.
    effects: [
      { kind: "setFlag", flag: "review_security_opened" },
      { kind: "setFlag", flag: "recovery_instruction_known" },
    ],
    reveals: [],
    once: true,
    debriefTag: "opened-review-security",
  },
  "dev.open-recovery-details": {
    id: "dev.open-recovery-details",
    device: "phone",
    label: "Open the details of the third call",
    requires: [{ kind: "callRang", callId: "call.recovery" }],
    effects: [],
    reveals: ["ev.recovery-number-match"],
    once: true,
    debriefTag: "opened-recovery-details",
  },
};
