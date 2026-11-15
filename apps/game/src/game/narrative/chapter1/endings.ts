// Chapter 1 "The Urgent Call: The False Victory": the four endings and their aftermath.
// Selection is a pure function of the decision, flags and deductions (first match by `order`);
// no timers, no randomness. Each ending has its own consequence, phone and laptop aftermath,
// evidence summary and case report. Everything here is fictional and happens only in the
// simulation. Wording does not blame the player and avoids the word "safe" as a verdict.
// Pure TypeScript data.

import type { EndingDef } from "../types";
import type { OutcomeId } from "./ids";
import { CASE_REFERENCE, NOTIFICATION_NUMBER, OFFICIAL_NUMBER } from "./sources";

export const SIMULATION_LABEL = "Simulation: nothing real happened.";

export const CHAPTER_1_ENDINGS: Record<OutcomeId, EndingDef> = {
  "false-victory": {
    id: "false-victory",
    title: "The False Victory",
    simulationLabel: SIMULATION_LABEL,
    // Order 1: following the recovery steps alone, without the code from the first call.
    order: 1,
    selectWhen: [
      { kind: "decisionIs", decision: "follow-recovery" },
      { kind: "notFlag", flag: "code_shared" },
    ],
    variants: [
      {
        id: "after-rejecting-alex",
        when: [{ kind: "flag", flag: "first_call_rejected" }],
        text: "You turned Alex away, and that was a good instinct. The second layer then used it: the follow-up caller agreed with you, and agreeing made the recovery steps feel like the next sensible step.",
      },
      {
        id: "default",
        when: [],
        text: "You followed the recovery steps from the third caller. They sounded like the answer to the first call, but nothing in them had been checked through a channel you chose yourself.",
      },
    ],
    aftermath: {
      consequence:
        "In the simulation, the recovery steps move the balance to a holding account that the second layer controls. Alex never needed your code. The plan only needed you to trust the voice that said you had already won.",
      phone:
        "The phone shows a short confirmation from the follow-up team. When you call the number it came from, nobody answers. The call log has three entries that all lead back to the same case reference.",
      laptop:
        "The Review Security page says the recovery is complete. The balance in the saved bank app now shows a transfer you did not plan. The notification that started this is still in the history.",
      evidenceSummary: `You found some of the clues, but none of them was checked against the number saved before today. The case reference ${CASE_REFERENCE} appeared in every layer, and the layers never confirmed each other independently.`,
      caseReport: `Case report: a first call asked for a code and was refused. A laptop notification and a third caller then used the same case reference ${CASE_REFERENCE} to offer a recovery procedure. The second layer worked because it came after a warning the player had already accepted. A call to the saved bank contact would have answered the question in one step.`,
      narrationNodeIds: ["after.a.1", "after.a.2", "after.a.3"],
    },
  },

  "perfect-chain": {
    id: "perfect-chain",
    title: "The Perfect Chain",
    simulationLabel: SIMULATION_LABEL,
    // Order 2: money moved and Ending A did not match, so the decision was "follow both callers"
    // or "follow recovery" after the code was shared. Both decisions set `money_moved`.
    order: 2,
    selectWhen: [{ kind: "flag", flag: "money_moved" }],
    variants: [
      {
        id: "default",
        when: [],
        text: "Both callers got what they asked for. The first call made a problem, and the second call sold the fix. Each step looked reasonable because the step before it had already happened.",
      },
    ],
    aftermath: {
      consequence:
        "In the simulation, the code from the first call and the recovery steps from the third call work together. The plan needed both parts, and each part made the other look more believable.",
      phone:
        "The phone fills with messages from numbers you do not know, all pointing to the case reference. The follow-up team no longer picks up. There is no call to return and nobody to ask.",
      laptop:
        "The saved bank app asks you to sign in again, and the sign-in does not work. A new notification says the account is under review. The history now shows the first call, the notification and the recovery, in one line.",
      evidenceSummary: `The clues you found pointed one way: the call, the notification and the third caller all used ${CASE_REFERENCE} and the contact ${NOTIFICATION_NUMBER}. They felt like three confirmations, but they came from one source.`,
      caseReport: `Case report: a code request, a notification and a recovery caller formed one plan. The first call created the problem, the later layers offered the fix. Stopping after either call and checking with the saved bank contact would have broken the chain. This is a simulation and the chapter can be replayed.`,
      narrationNodeIds: ["after.b.1", "after.b.2", "after.b.3"],
    },
  },

  "break-the-chain": {
    id: "break-the-chain",
    title: "Break the Chain",
    simulationLabel: SIMULATION_LABEL,
    order: 3,
    // The saved bank contact confirmed nothing the callers said, and no money moved (A and B
    // are tried first, so a money move never reaches this ending).
    selectWhen: [{ kind: "flag", flag: "official_channel_verified" }],
    variants: [
      {
        id: "case-report",
        when: [
          { kind: "deductionRecorded", deductionId: "ded.same-source" },
          { kind: "deductionRecorded", deductionId: "ded.third-caller-not-independent" },
        ],
        text: "You called the number saved before today, and you also showed how the claims connect: the first call, the notification and the third caller shared one case reference. The detailed case report below traces the whole chain.",
      },
      {
        id: "contained-late",
        when: [{ kind: "flag", flag: "code_shared" }],
        text: "The code you gave in the first call had a cost in the simulation. You then called the saved bank contact and stopped the second layer before it started. The bank can act on a code that was shared, which is why this call mattered.",
      },
      {
        id: "default",
        when: [],
        text: "You called the number saved before today. The bank had no such case, no such notification and no phone recovery. Nothing the three callers said was confirmed.",
      },
    ],
    aftermath: {
      consequence:
        "In the simulation, the real bank line answers and says the case does not exist. The recovery steps are never run. The three voices lose their only shared support: your trust.",
      phone:
        "The call history shows one call you made yourself. The agent suggests you ignore the other numbers and gives you a way to report them. The follow-up team calls once more, and you can let it ring.",
      laptop:
        "The notification stays in the history, but you know where it came from. The saved bank app shows the account as you left it, with no new transfers.",
      evidenceSummary: `You checked the claims against the contact saved before today (${OFFICIAL_NUMBER}). That contradicted the caller, the notification and the recovery steps. You did not need every clue to reach this point.`,
      caseReport: `Case report: the bank confirmed there is no case ${CASE_REFERENCE}, no notification and no phone recovery procedure. The notification contact ${NOTIFICATION_NUMBER} does not match the saved contact. Keep the call times and numbers if you report this to your bank.`,
      narrationNodeIds: ["after.c.1", "after.c.2", "after.c.3"],
    },
  },

  "unfinished-case": {
    id: "unfinished-case",
    title: "The Unfinished Case",
    simulationLabel: SIMULATION_LABEL,
    order: 4,
    // Last and unconditional: every decision that is not matched above ends here.
    selectWhen: [],
    variants: [
      {
        id: "evidence-built",
        when: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
        text: "You built the chain of evidence and stopped before the last step. The connected claims were clear, but no one confirmed them through the number saved before today.",
      },
      {
        id: "default",
        when: [],
        text: "You stopped and did not follow either caller. Refusing is a valid choice. The question of who was behind the calls stays open.",
      },
    ],
    aftermath: {
      consequence:
        "In the simulation, nothing moves. No money leaves the account and no code is used. The claims stay unproven, and the callers can try again.",
      phone:
        "The phone is quiet for now. There are missed calls and a voicemail in the history. You have not called the saved bank contact, so the numbers that called remain unchecked.",
      laptop:
        "The notification sits unread or closed, and the saved bank app shows nothing unusual. The account looks as it did, but you do not yet know whether the warning was real.",
      evidenceSummary:
        "You kept your distance, and that protected the account in the simulation. Without a call to the saved bank contact, the clues you found stay as questions and not as answers.",
      caseReport: `Case report: the case reference ${CASE_REFERENCE} was never checked with the bank. The calls and the notification are unverified. A call to the number saved before today is the step that turns a doubt into an answer. Replay to try it.`,
      narrationNodeIds: ["after.d.1", "after.d.2", "after.d.3"],
    },
  },
};
