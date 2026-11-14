// Chapter 1 evidence E01 to E11, warning signs and journal notes.
// Two independent paths reach the same conclusion: physical (statement, note, calendar, Alex's
// record) and digital (saved bank app, notification details). A single detail needs
// interpretation and never proves a claim false. Only `ev.official-confirmation` (found in the
// official-line node `off.confirm`) can contradict a claim. Identifiers come from sources.ts.
// Pure data: no React, Three.js or i18n.

import type { EvidenceItem, JournalNote, WarningSignDef } from "../types";
import type { EvidenceId, WarningSignId } from "./ids";
import {
  ALEX_CALLBACK_NUMBER,
  CASE_REFERENCE,
  NOTIFICATION_APP,
  NOTIFICATION_DOMAIN,
  NOTIFICATION_NUMBER,
  OFFICIAL_DOMAIN,
  OFFICIAL_NUMBER,
  PLAYER_NUMBER,
  SAVED_APP,
} from "./sources";

export const CHAPTER_1_WARNING_SIGNS: Record<WarningSignId, WarningSignDef> = {
  "ws.urgency": {
    id: "ws.urgency",
    label: "Pressure to act soon",
    description: "The message asks you to act soon so that you have less time to think and check.",
  },
  "ws.unverified-sender": {
    id: "ws.unverified-sender",
    label: "Sender you have not checked",
    description: "The sender, the address or the app is not one you set up or saved before today.",
  },
  "ws.caller-id-spoof": {
    id: "ws.caller-id-spoof",
    label: "Caller ID that does not fit",
    description: "The number on the screen can be set by the caller. Here it shows your own number, which no bank would call from.",
  },
  "ws.self-supplied-contact": {
    id: "ws.self-supplied-contact",
    label: "Contact details supplied by the sender",
    description: "The message gives its own number to call. A number from the sender proves nothing about who the sender is.",
  },
  "ws.shared-case-id": {
    id: "ws.shared-case-id",
    label: "The same case reference in separate contacts",
    description: "Two contacts that look separate use the same reference. They may come from one source, so they do not confirm each other.",
  },
  "ws.validates-your-doubt": {
    id: "ws.validates-your-doubt",
    label: "Agreeing with your doubt",
    description: "The caller praises your caution and then asks you to follow their own steps. Agreement is not proof.",
  },
  "ws.move-funds": {
    id: "ws.move-funds",
    label: "Request to move money",
    description: "You are asked to move money to a place you did not choose, for protection.",
  },
  "ws.discourages-verification": {
    id: "ws.discourages-verification",
    label: "Discouraging a check",
    description: "The caller says that checking with the bank is slow, useless or not allowed.",
  },
  "ws.code-request": {
    id: "ws.code-request",
    label: "Request for a code",
    description: "You are asked to read out a one-time code that was sent to you. That code is only for you.",
  },
};

export const CHAPTER_1_EVIDENCE: Record<EvidenceId, EvidenceItem> = {
  // E01: phone records, call details of Alex's call.
  "ev.caller-id-anomaly": {
    id: "ev.caller-id-anomaly",
    title: "The caller ID shows your own number",
    description: `The details of the first call show the caller ID ${PLAYER_NUMBER}. That is your own number. A caller can set the number that appears, so this detail needs interpretation. It is odd, but by itself it does not show who called.`,
    source: "device",
    location: "Phone, call details of the first call",
    discovery: { via: "device", deviceActionId: "dev.open-call-details" },
    sourceId: "src.call-alex",
    relations: [
      {
        claimId: "claim.alex-identity",
        stance: "needs-verification",
        note: "An odd caller ID is a reason to check. It does not prove the caller is not from the bank.",
      },
    ],
    warningSigns: ["ws.caller-id-spoof"],
    relevance: "Teaches that the number on the screen can be set by the caller, and that one odd detail is a reason to verify, not a verdict.",
    debriefHint: "The call details of the first call showed your own number as the caller ID.",
  },

  // E02: laptop, notification details.
  "ev.notification-metadata": {
    id: "ev.notification-metadata",
    title: "Where the notification comes from",
    description: `The details show a sender domain ${NOTIFICATION_DOMAIN}, an app called ${NOTIFICATION_APP}, the case reference ${CASE_REFERENCE} and a contact number ${NOTIFICATION_NUMBER} that the notification gives itself. None of these match the bank records you saved, but the details need to be compared with those records before you decide.`,
    source: "device",
    location: "Laptop, notification details",
    discovery: { via: "device", deviceActionId: "dev.inspect-notification-origin" },
    sourceId: "src.notification",
    relations: [
      {
        claimId: "claim.notification-genuine",
        stance: "needs-verification",
        note: "The origin looks unfamiliar. Compare it with records you saved before today.",
      },
    ],
    warningSigns: ["ws.unverified-sender", "ws.self-supplied-contact"],
    relevance: "Teaches how to read sender details, and that a number inside a message is not a trusted way to reach the bank.",
    debriefHint: "The notification details showed a sender, an app and a number that you had not saved before.",
  },

  // E03: receipts prop, printed statement (physical path).
  "ev.official-contact-paper": {
    id: "ev.official-contact-paper",
    title: "The contact number printed on your statement",
    description: `Your paper statement prints the bank contact number ${OFFICIAL_NUMBER} and the address ${OFFICIAL_DOMAIN}. The paper was printed before today, so it is a record that neither caller wrote.`,
    source: "physical",
    location: "The folded bank statement among your receipts",
    discovery: { via: "interact", objectId: "obj.receipts" },
    sourceId: "src.statement-paper",
    relations: [
      {
        claimId: "claim.notification-genuine",
        stance: "inconclusive",
        note: "It shows a channel that existed before today. It does not say anything about the notification until you compare the numbers.",
      },
    ],
    warningSigns: [],
    relevance: "Teaches the habit of keeping a contact you trust from before any message arrives.",
    debriefHint: "The paper statement in your receipts printed the bank number you could have used to check.",
  },

  // E03b: laptop, saved bank app, Contacts (digital path).
  "ev.official-contact-app": {
    id: "ev.official-contact-app",
    title: "The contact saved in your bank app",
    description: `The contacts page of ${SAVED_APP}, an app you installed before today, lists the bank number ${OFFICIAL_NUMBER} and the address ${OFFICIAL_DOMAIN}. It is the same number as on your paper statement.`,
    source: "device",
    location: "Laptop, bank app, contacts",
    discovery: { via: "device", deviceActionId: "dev.open-saved-contacts" },
    sourceId: "src.saved-app",
    relations: [
      {
        claimId: "claim.notification-genuine",
        stance: "inconclusive",
        note: "It shows the contact you saved. It does not confirm or deny the notification by itself.",
      },
    ],
    warningSigns: [],
    relevance: "Gives a digital way to reach the same conclusion as the paper statement.",
    debriefHint: "The bank app you installed yourself listed the same bank number as your statement.",
  },

  // E04: laptop, saved bank app, activity.
  "ev.account-activity": {
    id: "ev.account-activity",
    title: "No flagged payment in the account activity",
    description: "The activity page of your bank app shows your usual payments and no flagged or blocked payment. This is a quiet result, not proof. The app is not a live conversation with the bank, so it cannot answer whether a case exists.",
    source: "device",
    location: "Laptop, bank app, activity",
    discovery: { via: "device", deviceActionId: "dev.open-account-activity" },
    sourceId: "src.saved-app",
    relations: [
      {
        claimId: "claim.recovery-needed",
        stance: "inconclusive",
        note: "A quiet activity page does not show whether a problem exists. Ask the bank through a channel you trust.",
      },
    ],
    warningSigns: [],
    relevance: "Teaches that one quiet source is not an answer, and that checking is different from confirming.",
    debriefHint: "The account activity page showed no flagged payment, which was worth a second check.",
  },

  // E05: laptop, compare view, Alex's record against the notification.
  "ev.shared-case-id": {
    id: "ev.shared-case-id",
    title: "The same case reference in two places",
    description: `Alex gave the case reference ${CASE_REFERENCE} in the first call. The notification uses ${CASE_REFERENCE} too. Two separate contacts agree on a reference, but they may share one source. Agreement between them is not an independent confirmation.`,
    source: "device",
    location: "Laptop, compare view",
    discovery: { via: "device", deviceActionId: "dev.compare-case-ref" },
    sourceId: "src.notification",
    relations: [
      {
        claimId: "claim.claims-independent",
        stance: "needs-verification",
        note: "A shared reference can mean one source behind both. Check with someone who does not rely on either.",
      },
    ],
    warningSigns: ["ws.shared-case-id"],
    relevance: "Teaches that two messages repeating the same detail may be one source, not two witnesses.",
    debriefHint: "Alex and the notification used the same case reference. Two contacts that agree can still come from one source.",
  },

  // E06: note prop, the player's own reminder (physical path).
  "ev.note-app-origin": {
    id: "ev.note-app-origin",
    title: "Your own reminder about how the bank contacts you",
    description: `Your handwritten note says that your bank reaches you through the ${SAVED_APP} app and the number ${OFFICIAL_NUMBER} printed on your statement. The notification uses a different app, ${NOTIFICATION_APP}. This is a weak clue. The note only records your own habit and does not prove the notification is wrong.`,
    source: "physical",
    location: "Your handwritten reminder near the desk",
    discovery: { via: "interact", objectId: "obj.note" },
    sourceId: "src.note",
    relations: [
      {
        claimId: "claim.notification-genuine",
        stance: "contradicts",
        note: "Weak. The notification does not follow your usual channel, but only a check with the bank can settle it.",
      },
    ],
    warningSigns: ["ws.unverified-sender"],
    relevance: "Shows that a personal rule you wrote earlier can help you spot a message that does not fit.",
    debriefHint: "Your own note said how your bank contacts you, and the notification did not follow it.",
  },

  // E07: phone records, Alex's record (voicemail text or call summary).
  "ev.alex-statement": {
    id: "ev.alex-statement",
    title: "What Alex said, in writing",
    description: `The record of the first call says Alex gave the case reference ${CASE_REFERENCE}, asked for a code sent to your phone, and gave the callback number ${ALEX_CALLBACK_NUMBER}. It also says a notification and a follow-up team would come. These are claims from the caller, not facts you have checked.`,
    source: "device",
    location: "Phone, record of the first call",
    discovery: { via: "device", deviceActionId: "dev.open-alex-record" },
    sourceId: "src.call-alex",
    relations: [
      {
        claimId: "claim.alex-identity",
        stance: "needs-verification",
        note: "The record shows what was claimed. It cannot show whether the claim is true.",
      },
    ],
    warningSigns: ["ws.code-request", "ws.urgency", "ws.self-supplied-contact"],
    relevance: "A written record makes the claims easy to compare later, and it foreshadows the notification and the follow-up team.",
    debriefHint: "The record of the first call said a notification and a follow-up team would come. Both did.",
  },

  // E08: dialogue node rec.cites-case in the recovery call.
  "ev.recovery-statement": {
    id: "ev.recovery-statement",
    title: "The third caller repeats the case reference",
    description: `The third caller repeats the case reference ${CASE_REFERENCE} and says your money must be moved to a holding account for protection. The caller also agrees with your doubts. The same reference you already saw twice is a repeated claim, not a new witness.`,
    source: "dialogue",
    location: "Third call, recovery caller",
    discovery: { via: "dialogue-node", nodeId: "rec.cites-case" },
    sourceId: "src.call-recovery",
    relations: [
      {
        claimId: "claim.recovery-needed",
        stance: "needs-verification",
        note: "The caller asks for urgent action. Whether any action is needed is something only the bank can confirm.",
      },
    ],
    warningSigns: ["ws.shared-case-id", "ws.validates-your-doubt", "ws.move-funds", "ws.discourages-verification"],
    relevance: "Shows how a third voice can borrow details from the first two to look independent.",
    debriefHint: "The third caller repeated the same case reference and asked you to move money.",
  },

  // E09: official line, node off.confirm. The only item that can contradict claims.
  "ev.official-confirmation": {
    id: "ev.official-confirmation",
    title: "The bank line confirms no such case",
    description: `You called ${OFFICIAL_NUMBER}, the number saved before today. The bank agent finds no case ${CASE_REFERENCE}, no security notification sent to you, and no recovery procedure that asks you to move money.`,
    source: "verification",
    location: "Call to the saved bank number",
    discovery: { via: "dialogue-node", nodeId: "off.confirm" },
    sourceId: "src.official-line",
    relations: [
      { claimId: "claim.alex-identity", stance: "contradicts", note: "The bank has no record of this caller or case." },
      { claimId: "claim.notification-genuine", stance: "contradicts", note: "The bank did not send the notification." },
      { claimId: "claim.recovery-needed", stance: "contradicts", note: "No recovery procedure exists." },
      { claimId: "claim.claims-independent", stance: "contradicts", note: "The callers and the notification share one origin." },
    ],
    warningSigns: [],
    relevance: "Teaches the fix: stop, then ask through a channel you already trusted, not through one the sender gave you.",
    debriefHint: "Calling the number you had saved before today would have settled the question.",
  },

  // E10: calendar prop (optional, weak).
  "ev.calendar-routine": {
    id: "ev.calendar-routine",
    title: "No security appointment on your calendar",
    description: "Your calendar shows the usual statement date and no bank security appointment. This is optional and weak. A missing entry fits what you remember, but it proves nothing about the calls.",
    source: "physical",
    location: "The wall calendar",
    discovery: { via: "interact", objectId: "obj.calendar" },
    sourceId: "src.calendar",
    relations: [
      {
        claimId: "claim.recovery-needed",
        stance: "inconclusive",
        note: "Your routine gave no sign of a security matter, but a routine cannot rule one out.",
      },
    ],
    warningSigns: [],
    relevance: "An optional detail that shows how several weak signs differ from one confirmed fact.",
    debriefHint: "Your calendar showed no security appointment. It is a weak sign, not proof.",
  },

  // E11: phone records, call details of the third call (optional).
  "ev.recovery-number-match": {
    id: "ev.recovery-number-match",
    title: "The third caller uses the number from the notification",
    description: `The details of the third call show the caller ID ${NOTIFICATION_NUMBER}. That is the contact number the notification gave itself. The notification and the third caller may share one origin, though a number alone still needs checking.`,
    source: "device",
    location: "Phone, call details of the third call",
    discovery: { via: "device", deviceActionId: "dev.open-recovery-details" },
    sourceId: "src.call-recovery",
    relations: [
      {
        claimId: "claim.claims-independent",
        stance: "needs-verification",
        note: "A shared number suggests one origin. Confirm with the bank before you decide.",
      },
    ],
    warningSigns: ["ws.self-supplied-contact", "ws.shared-case-id"],
    relevance: "Connects the third call back to the notification, which was announced earlier.",
    debriefHint: "The third call came from the same number that the notification had supplied.",
  },
};

export const CHAPTER_1_JOURNAL_NOTES: JournalNote[] = [
  {
    id: "note.own-number",
    requires: ["ev.caller-id-anomaly"],
    text: "The caller ID showed your own number. That is odd, but one odd detail is a reason to check, not an answer.",
  },
  {
    id: "note.same-case-reference",
    requires: ["ev.notification-metadata", "ev.shared-case-id"],
    text: "The notification and the first caller use the same case reference, and the notification gives its own number. They may come from one source. Try combining these clues.",
  },
  {
    id: "note.contact-differs-paper",
    requires: ["ev.notification-metadata", "ev.official-contact-paper"],
    text: "The number inside the notification is not the number printed on your statement. Compare them, then think about which one you trusted before today.",
  },
  {
    id: "note.contact-differs-app",
    requires: ["ev.notification-metadata", "ev.official-contact-app"],
    text: "The number inside the notification is not the number saved in your bank app. Your own records point to a different contact.",
  },
  {
    id: "note.two-paths",
    requires: ["ev.official-contact-paper", "ev.official-contact-app"],
    text: "Your paper statement and your bank app give the same number. Two records you kept before today agree with each other.",
  },
  {
    id: "note.third-call-origin",
    requires: ["ev.recovery-number-match", "ev.notification-metadata"],
    text: "The third caller uses the number that the notification supplied. The first caller, the notification and the third caller may be one chain.",
  },
  {
    id: "note.third-call-repeat",
    requires: ["ev.recovery-statement", "ev.shared-case-id"],
    text: "The third caller repeats the case reference from the first two contacts. Repeating a detail does not make a new witness.",
  },
  {
    id: "note.confirmed",
    requires: ["ev.official-confirmation"],
    text: "The bank line you saved before today has no such case. This is a confirmation from outside the chain.",
  },
];
