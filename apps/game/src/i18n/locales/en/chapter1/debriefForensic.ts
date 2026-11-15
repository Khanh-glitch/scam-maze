/** English source text for the `chapter1` namespace, `debriefForensic` area. Owns one top-level key group. */
const debriefForensic = {
  debriefForensic: {
    heading: "Case review",
    timeline: {
      heading: "What happened, in order",
      empty: "No events were recorded.",
      row: "{{number}}. {{text}}",
      kind: {
        call: "Call",
        device: "Laptop or phone",
        evidence: "Evidence",
        deduction: "Connection",
        decision: "Decision",
        verification: "Check",
      },
    },
    analysis: {
      heading: "Analysis",
      pressure: "How the pressure built up",
      trust: "Why the warning looked trustworthy",
      unverified: "Signals that were never checked",
      thirdCaller: "The third caller",
      thirdCallerIndependent: "The third caller was independent of the first two sources.",
      thirdCallerNotIndependent: "The third caller shared its origin with the first two sources.",
      trap: "The trap you entered",
      trapNone: "You did not enter the trap.",
      verifyNext: "What to verify next time",
      pressureLevel: "Pressure reached: {{number}} of 3",
    },
    cluesMissed: {
      heading: "Clues you did not find",
      none: "You found every clue.",
      missedLabel: "Missed",
      summary_one: "Show {{number}} missed clue",
      summary_other: "Show {{number}} missed clues",
    },
    habit: {
      heading: "The habit to keep",
      line: "A warning can be trusted only when it reaches you through a channel you already knew before it contacted you.",
    },
    evidence: {
      heading: "Your evidence",
      count_one: "{{number}} piece of evidence",
      count_other: "{{number}} pieces of evidence",
    },
    caseReport: {
      heading: "Case report",
    },
    ending: {
      phone: "On your phone",
      laptop: "On your laptop",
      evidence: "What you had",
      narration: "Narration",
      next: "Next line",
    },
    simulation: "Everything in this chapter was a simulation.",
    continue: "Continue",
  },
};
export default debriefForensic;
