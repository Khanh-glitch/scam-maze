/** English source text for the `chapter1` namespace, `journalCombine` area. Owns one top-level key group. */
const journalCombine = {
  journalCombine: {
    heading: "Combine evidence",
    intro: "Pick two or three pieces of evidence that you think are connected, then submit them.",
    selectedCount_one: "{{number}} item selected",
    selectedCount_other: "{{number}} items selected",
    selectPrompt: "Select evidence",
    itemSelected: "Selected: {{title}}",
    itemNotSelected: "Not selected: {{title}}",
    needTwo: "Select at least two items.",
    tooMany: "You can combine at most three items.",
    submit: "Submit the combination",
    clear: "Clear the selection",
    open: "Combine evidence",
    close: "Close",
    result: {
      accepted: "Connection recorded.",
      rejected: "These items do not support a connection.",
      alreadyRecorded: "You already recorded this connection.",
      notAvailable: "One of these items is not in your journal yet.",
    },
    deduction: {
      heading: "Connections",
      empty: "You have not recorded any connection yet.",
      statementLabel: "What this shows",
    },
    related: {
      heading: "Connections that use this item",
    },
    hint: {
      show: "Show hint",
      hide: "Hide hint",
      heading: "Hint",
    },
    unverified: "Not independently verified",
    announce: {
      recorded: "Connection recorded: {{statement}}",
    },
  },
};
export default journalCombine;
