// Chapter 1 "The Urgent Call: The False Victory": calls, messages and phone content.
// Numbers start with +000 and domains are reserved; they are shown as plain text, never links.
// Pure TypeScript data.

import type { CallDef, Condition, PhoneContent } from "../types";
import type { CallId, EvidenceId } from "./ids";
import {
  ALEX_CALLBACK_NUMBER,
  CASE_REFERENCE,
  NOTIFICATION_NUMBER,
  OFFICIAL_DOMAIN,
  OFFICIAL_NUMBER,
  PLAYER_NUMBER,
  SAVED_APP,
} from "./sources";

/** E01 to E06 (including the app variant of E03): three of them open the third call. */
const EARLY_EVIDENCE: EvidenceId[] = [
  "ev.caller-id-anomaly",
  "ev.notification-metadata",
  "ev.official-contact-paper",
  "ev.official-contact-app",
  "ev.account-activity",
  "ev.shared-case-id",
  "ev.note-app-origin",
];

const ALEX_CLOSED: Condition = { kind: "callClosed", callId: "call.alex" };

export const CHAPTER_1_CALLS: Record<CallId, CallDef> = {
  "call.alex": {
    id: "call.alex",
    direction: "incoming",
    // The caller ID shows the player's own number, so the name stays neutral.
    displayName: "Unknown caller",
    number: PLAYER_NUMBER,
    graphId: "dlg.alex",
    ringWhen: [[]],
  },
  "call.recovery": {
    id: "call.recovery",
    direction: "incoming",
    displayName: "Case Response Desk",
    number: NOTIFICATION_NUMBER,
    graphId: "dlg.recovery",
    ringWhen: [
      [ALEX_CLOSED, { kind: "flag", flag: "review_security_opened" }],
      // Dismissing the notification brings the third call at once. Merely opening it does not:
      // the player must also have found two items (origin, receipts, saved contact, ...).
      [ALEX_CLOSED, { kind: "flag", flag: "notification_dismissed" }],
      [
        ALEX_CLOSED,
        { kind: "flag", flag: "notification_handled" },
        { kind: "evidenceCountAtLeast", evidenceIds: EARLY_EVIDENCE, count: 2 },
      ],
      [ALEX_CLOSED, { kind: "flag", flag: "official_channel_verified" }],
      [ALEX_CLOSED, { kind: "evidenceCountAtLeast", evidenceIds: EARLY_EVIDENCE, count: 3 }],
      [ALEX_CLOSED, { kind: "claimStatus", claimId: "claim.claims-independent", status: "inconclusive" }],
    ],
  },
  "call.official": {
    id: "call.official",
    direction: "outgoing",
    displayName: "Northgate Bank (saved)",
    number: OFFICIAL_NUMBER,
    graphId: "dlg.official-line",
    ringWhen: [],
  },
};

export const CHAPTER_1_PHONE: PhoneContent = {
  messages: {
    "msg.alex-voicemail": {
      id: "msg.alex-voicemail",
      from: "Voicemail from an unknown caller",
      body: [
        "Voicemail text:",
        `"Hello, this is Alex from Northgate Bank security. Your case is ${CASE_REFERENCE}.`,
        "Someone tried to use your account. Call me back soon on",
        `${ALEX_CALLBACK_NUMBER}. We will send you a code to confirm it is you. Do not ignore this message."`,
      ].join(" "),
      evidenceId: "ev.alex-statement",
      deliveredAtStart: false,
    },
    "msg.alex-summary": {
      id: "msg.alex-summary",
      from: "Call summary",
      body: [
        "Call summary, written by your phone.",
        "The caller said he was Alex from Northgate Bank security.",
        `He gave the case reference ${CASE_REFERENCE}.`,
        "He asked for a code sent to your phone.",
        "He said an incident team would call you back later.",
      ].join(" "),
      evidenceId: "ev.alex-statement",
      deliveredAtStart: false,
    },
  },
  contacts: [
    { name: "Northgate Bank (saved)", number: OFFICIAL_NUMBER },
  ],
  officialWebsite: OFFICIAL_DOMAIN,
  bankApp: {
    title: SAVED_APP,
    screens: [
      {
        id: "home",
        title: "Home",
        body: [
          "Welcome back.",
          "Checking account: balance shown on the account page.",
          "Open Activity to see recent payments.",
          "Open Contacts to see how the bank reaches you.",
        ].join("\n"),
      },
      {
        id: "activity",
        title: "Activity",
        body: [
          "Recent activity",
          "Grocery store: 18.40",
          "Transit pass: 30.00",
          "Music subscription: 9.99",
          "No payment is flagged. No security notice is open on this account.",
        ].join("\n"),
      },
      {
        id: "contacts",
        title: "Contacts",
        body: [
          "Contact us",
          `Customer line: ${OFFICIAL_NUMBER}`,
          `Website: ${OFFICIAL_DOMAIN}`,
          "The bank says it will never ask you for a one-time code or ask you to move money to another account.",
        ].join("\n"),
      },
      {
        id: "messages",
        title: "Messages",
        body: "You have no security messages.",
      },
    ],
  },
};
