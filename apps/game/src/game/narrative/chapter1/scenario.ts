// Chapter 1 "The Urgent Call: The False Victory": the Scenario_Data.
// Assembles every Chapter 1 data module into one `ScenarioDefinition`.
// Pure TypeScript data.

import type { NpcDef, ScenarioDefinition } from "../types";
import { CHAPTER_1_ACTS } from "./acts";
import { CHAPTER_1_BEATS } from "./beats";
import { CHAPTER_1_CLAIMS } from "./claims";
import { CHAPTER_1_DEBRIEF } from "./debrief";
import { CHAPTER_1_DECISIONS } from "./decisions";
import { CHAPTER_1_DEDUCTIONS } from "./deductions";
import { CHAPTER_1_DEVICE_ACTIONS } from "./deviceActions";
import { AFTERMATH_DIALOGUE } from "./dialogues/aftermath";
import { ALEX_DIALOGUE } from "./dialogues/alex";
import { INTRO_DIALOGUE } from "./dialogues/intro";
import { OFFICIAL_LINE_DIALOGUE } from "./dialogues/officialLine";
import { RECOVERY_DIALOGUE } from "./dialogues/recovery";
import { CHAPTER_1_ENDINGS } from "./endings";
import { CHAPTER_1_EVIDENCE, CHAPTER_1_JOURNAL_NOTES, CHAPTER_1_WARNING_SIGNS } from "./evidence";
import type { NpcId } from "./ids";
import { CHAPTER_1_INTERACTABLES } from "./interactables";
import { CHAPTER_1_OBJECTIVES } from "./objectives";
import { CHAPTER_1_CALLS, CHAPTER_1_PHONE } from "./phone";
import { CHAPTER_1_SOURCES } from "./sources";

/** No NPC conversations in this chapter. */
export const CHAPTER_1_NPCS = {} as Record<NpcId, NpcDef>;

export const CHAPTER_1_SCENARIO: ScenarioDefinition = {
  id: "chapter-1",
  title: "The Urgent Call",
  subtitle: "The False Victory",
  objectives: CHAPTER_1_OBJECTIVES,
  interactables: CHAPTER_1_INTERACTABLES,
  claims: CHAPTER_1_CLAIMS,
  evidence: CHAPTER_1_EVIDENCE,
  warningSigns: CHAPTER_1_WARNING_SIGNS,
  journalNotes: CHAPTER_1_JOURNAL_NOTES,
  calls: CHAPTER_1_CALLS,
  npcs: CHAPTER_1_NPCS,
  dialogues: {
    "dlg.alex": ALEX_DIALOGUE,
    "dlg.recovery": RECOVERY_DIALOGUE,
    "dlg.official-line": OFFICIAL_LINE_DIALOGUE,
    "dlg.aftermath": AFTERMATH_DIALOGUE,
    "dlg.intro": INTRO_DIALOGUE,
  },
  phone: CHAPTER_1_PHONE,
  decisions: CHAPTER_1_DECISIONS,
  endings: CHAPTER_1_ENDINGS,
  debrief: CHAPTER_1_DEBRIEF,
  acts: CHAPTER_1_ACTS,
  sources: CHAPTER_1_SOURCES,
  deductions: CHAPTER_1_DEDUCTIONS,
  deviceActions: CHAPTER_1_DEVICE_ACTIONS,
  beats: CHAPTER_1_BEATS,
};
