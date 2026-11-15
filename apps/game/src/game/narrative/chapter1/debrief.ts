// Chapter 1 "The Urgent Call: The False Victory": debrief text.
// Every statement is derived by the debrief builder from this data and the event log. Nothing here
// calls a number, message, caller, website or notification "safe": the lesson is that a source is
// worth trusting only after it is checked through a channel the player set up earlier.
// Pure TypeScript data. Fictional names, numbers and domains only.

import type { DebriefContent } from "../types";
import { CASE_REFERENCE, NOTIFICATION_APP, OFFICIAL_NUMBER } from "./sources";

export const CHAPTER_1_DEBRIEF: DebriefContent = {
  mechanism: `This was a two-part plan. The first caller claimed to be from the bank, used urgency, and asked for a code. A laptop notification, then a third caller, offered a recovery procedure for the same case reference, ${CASE_REFERENCE}. The first call created the problem and the later layers sold the fix. All three came from one unverified source.`,

  saferAlternatives: [
    "End the call, then contact the bank yourself with a number you saved before the call, such as the one on your statement or in your bank app.",
    "Never read a code to a caller, even when the caller knows a case ID or says the code is for your protection.",
    "Treat a warning that agrees with your doubt like any other claim. Ask where it came from and whether you can check it without using the contact details it gave you.",
    "When two messages share the same case ID or contact number, count them as one source, not as two confirmations.",
    "If a caller asks you to move money, install an app or keep the call private, stop. Those requests are a reason to check, not a reason to hurry.",
  ],

  outcomeSummaries: {
    "false-victory":
      "You rejected the first call and then trusted the second layer. The warning looked like confirmation, but it had not been checked through a channel you chose yourself.",
    "perfect-chain":
      "Both layers worked together in the simulation. The code and the recovery steps came from one plan that made each part look believable.",
    "break-the-chain":
      "You checked through a contact saved before today, and that broke the chain. The bank confirmed it knew nothing about the case, the notification or a recovery procedure.",
    "unfinished-case":
      "You stopped and did not follow either caller. That is a valid choice. The claims stayed unchecked, because you did not call the saved bank contact.",
  },

  decisionNotes: {
    // Device actions.
    "opened-alex-record":
      "You opened the record of Alex's call. It shows the case ID and what Alex asked for, which you can compare with later messages.",
    "opened-call-details":
      "You opened the call details. The caller ID showed your own number, which a real bank call would not normally do. It needs thought: one odd detail is a hint, not proof.",
    "opened-notification":
      "You opened the notification. It agreed with your first reaction, which is why it felt trustworthy. It had not yet been checked against anything you already knew.",
    "dismissed-notification":
      "You dismissed the notification without acting on it. It stayed in the history, so you could still look at it later.",
    "inspected-origin": `You looked at who sent the notification. The sender, the app name (${NOTIFICATION_APP}) and the contact number did not match anything you had saved. Checking the origin is a good habit before you act on a warning.`,
    "opened-bank-app":
      "You opened the bank app you installed yourself. That is a better place to look than a link or contact in a message, but the app on its own cannot confirm what a caller said.",
    "checked-account-activity":
      "You checked the account activity. It showed no flagged payment, which did not settle the question. Only the bank can confirm whether a case exists.",
    "checked-saved-contacts": `You opened the saved contacts in the bank app. The official number there (${OFFICIAL_NUMBER}) was saved before today, so you can compare it with what the caller says.`,
    "compared-case-ref": `You compared the case reference in Alex's record with the notification. Both used ${CASE_REFERENCE}. Two sources that share one identifier may have one author.`,
    "compared-contacts":
      "You compared the contact in the notification with your saved records. The numbers did not match, which is a sign the notification did not come from your bank.",
    "opened-review-security":
      "You opened the Review Security page from the notification. It is part of the second layer, and it is where the recovery procedure begins.",
    "opened-recovery-details":
      "You opened the details of the third call. The number matched the contact inside the notification, so the third caller was not a separate witness.",

    // Deductions.
    "linked-same-source":
      "You linked the first caller and the notification. They used the same case reference, so they are not independent of each other.",
    "notification-not-from-bank":
      "You found that the notification does not match your saved bank records. Its contact details did not come from your bank.",
    "third-caller-linked":
      "You linked the third caller to the same source. A caller who repeats the same case reference gives you no new evidence.",

    // Reducer tags.
    "hung-up":
      "You ended a call. You can always do that. Ending a call and then checking through a number you already had saved is the key step.",

    // Final decisions.
    "decided-follow-recovery":
      "You followed the recovery steps from the third caller. The steps came from the same source that raised the warning, so they had not been checked.",
    "decided-follow-both":
      "You did what both callers asked. Each request made the other look more convincing, which is how a two-part plan holds together.",
    "decided-refuse-and-stop":
      "You refused both callers and stopped. That keeps you away from the plan, and calling a number you saved earlier would also tell you what was real.",
    "decided-verify-independently":
      "You checked with a number saved before today. That is the step that works: it does not depend on anything the callers or the notification told you.",
    "decided-report-deception":
      "You reported the connected deception. Showing how the claims link together is useful, and so is a report to the bank through a channel you already trust.",
  },

  analysis: {
    pressureBuilt:
      "Alex used urgency, authority and a case ID to make the call feel official. Each reply added pressure and made it harder to stop and check. The goal was a code, given before you could verify anything.",
    whyWarningLooked: `The laptop notification arrived right after you refused the first caller, and it agreed with you. That made it feel like proof that you chose well. It also gave you contact details of its own, and it quoted the same case reference, ${CASE_REFERENCE}. Things that agree with each other are not independent if they come from one source.`,
    thirdCallerNote:
      "The third caller repeated the same case reference and the same contact as the notification. That is not independent evidence. Only the call you made to the saved bank contact came from a channel that existed before the scare.",
    trapNotes: {
      none: "You did not enter either trap. You did not share a code and you did not follow the recovery steps.",
      first: "You shared the code in the first call. That was the trap of the first layer, and a later check with the bank could still limit what followed.",
      second:
        "You followed the second layer. It was designed for people who had just refused the first call, because their guard was already down.",
      both: "You entered both layers. The first call created the problem and the second sold the fix, which is the way the plan was designed to work.",
    },
    verifyNextTime: [
      "Stop and end the call or close the message. Do not use the contact details it gave you.",
      "Find a contact you saved before today: the number on your statement, the back of your card, or your own bank app.",
      "Ask the bank directly whether the case, the notification or the procedure exists.",
      "Count messages that share one case ID or contact number as one source.",
      "Never share a code or approve a remote session for someone who contacted you first.",
    ],
  },
};
