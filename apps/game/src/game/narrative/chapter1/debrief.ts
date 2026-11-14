// Placeholder (task 2.1): rewritten by the Act V task. The previous street chapter content lives in
// legacy/urgent-call-street/narrative/chapter1/.

import type { DebriefContent } from "../types";
import type { OutcomeId } from "./ids";

export const CHAPTER_1_DEBRIEF: DebriefContent = {
  mechanism: "",
  saferAlternatives: [],
  outcomeSummaries: {} as Record<OutcomeId, string>,
  decisionNotes: {},
  analysis: {
    pressureBuilt: "",
    whyWarningLooked: "",
    thirdCallerNote: "",
    trapNotes: { none: "", first: "", second: "", both: "" },
    verifyNextTime: [],
  },
};
