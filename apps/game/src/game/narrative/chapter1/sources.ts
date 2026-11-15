// Chapter 1 "The Urgent Call: The False Victory": provenance sources.
// A source says where a piece of evidence claims to come from. `trust` is authoring truth and is
// shown to the player only in the debrief. Every identifier is fictional: numbers start with
// +000, domains are reserved (.invalid or .example). Pure TypeScript data.

import type { SourceDef } from "../types";
import type { SourceId } from "./ids";

/** The case reference used by Alex, the notification and the third caller. */
export const CASE_REFERENCE = "NG-4471-X";
/** The player's own fictional number. Caller ID for Alex's call shows this number. */
export const PLAYER_NUMBER = "+000 0100 3300";
/** Callback number that Alex gives. */
export const ALEX_CALLBACK_NUMBER = "+000 0100 2200";
/** Number supplied by the notification and used by the third caller. */
export const NOTIFICATION_NUMBER = "+000 0100 7771";
/** Official number printed on the statement and saved in the bank app. */
export const OFFICIAL_NUMBER = "+000 0100 0800";
/** Domain of the notification sender. */
export const NOTIFICATION_DOMAIN = "northgate-alerts.invalid";
/** Domain of the official bank. */
export const OFFICIAL_DOMAIN = "northgate-bank.example";
/** App name shown by the notification. */
export const NOTIFICATION_APP = "NG Secure Helper";
/** Name of the bank app that is installed on the laptop. */
export const SAVED_APP = "Northgate Mobile";

export const CHAPTER_1_SOURCES: Record<SourceId, SourceDef> = {
  "src.call-alex": {
    id: "src.call-alex",
    label: "The first call",
    kind: "call",
    claimedOrigin: "Alex from Northgate Bank security",
    trust: "unverified",
    identifiers: [
      { key: "case", value: CASE_REFERENCE },
      { key: "contact", value: ALEX_CALLBACK_NUMBER },
      { key: "callerId", value: PLAYER_NUMBER },
    ],
  },
  "src.voicemail-alex": {
    id: "src.voicemail-alex",
    label: "The voicemail from the first call",
    kind: "voicemail",
    claimedOrigin: "Alex from Northgate Bank security",
    trust: "unverified",
    identifiers: [
      { key: "case", value: CASE_REFERENCE },
      { key: "contact", value: ALEX_CALLBACK_NUMBER },
      { key: "callerId", value: PLAYER_NUMBER },
    ],
  },
  "src.notification": {
    id: "src.notification",
    label: "The laptop notification",
    kind: "notification",
    claimedOrigin: "Northgate Security Desk",
    trust: "unverified",
    identifiers: [
      { key: "case", value: CASE_REFERENCE },
      { key: "contact", value: NOTIFICATION_NUMBER },
      { key: "domain", value: NOTIFICATION_DOMAIN },
      { key: "app", value: NOTIFICATION_APP },
    ],
  },
  "src.statement-paper": {
    id: "src.statement-paper",
    label: "The paper bank statement",
    kind: "document",
    claimedOrigin: "Northgate Bank, printed statement",
    trust: "pre-existing",
    identifiers: [
      { key: "contact", value: OFFICIAL_NUMBER },
      { key: "domain", value: OFFICIAL_DOMAIN },
    ],
  },
  "src.saved-app": {
    id: "src.saved-app",
    label: "The saved bank app",
    kind: "app",
    claimedOrigin: "Northgate Mobile, installed before today",
    trust: "pre-existing",
    identifiers: [
      { key: "contact", value: OFFICIAL_NUMBER },
      { key: "domain", value: OFFICIAL_DOMAIN },
      { key: "app", value: SAVED_APP },
    ],
  },
  "src.note": {
    id: "src.note",
    label: "Your handwritten reminder",
    kind: "note",
    claimedOrigin: "Your own note about how the bank contacts you",
    trust: "pre-existing",
    identifiers: [
      { key: "contact", value: OFFICIAL_NUMBER },
      { key: "app", value: SAVED_APP },
    ],
  },
  "src.calendar": {
    id: "src.calendar",
    label: "The wall calendar",
    kind: "calendar",
    claimedOrigin: "Your own calendar",
    trust: "pre-existing",
    identifiers: [],
  },
  "src.call-recovery": {
    id: "src.call-recovery",
    label: "The third call",
    kind: "call",
    claimedOrigin: "The Northgate case response team",
    trust: "unverified",
    identifiers: [
      { key: "case", value: CASE_REFERENCE },
      { key: "contact", value: NOTIFICATION_NUMBER },
      { key: "callerId", value: NOTIFICATION_NUMBER },
    ],
  },
  "src.official-line": {
    id: "src.official-line",
    label: "The official bank line",
    kind: "official-line",
    claimedOrigin: "Northgate Bank, the number saved before today",
    trust: "independent-confirmation",
    identifiers: [
      { key: "contact", value: OFFICIAL_NUMBER },
      { key: "domain", value: OFFICIAL_DOMAIN },
    ],
  },
};
