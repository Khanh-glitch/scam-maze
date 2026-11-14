// Chapter 1 "The Urgent Call: The False Victory": the Scenario_Data.
// Placeholder assembly (task 2.1): the data modules are empty until the content tasks fill them.
// Pure TypeScript data.

import type { NpcDef, ScenarioDefinition } from "../types";
import { CHAPTER_1_ACTS } from "./acts";
import { CHAPTER_1_CLAIMS } from "./claims";
import { CHAPTER_1_DEBRIEF } from "./debrief";
import { CHAPTER_1_DECISIONS } from "./decisions";
import { CHAPTER_1_ENDINGS } from "./endings";
import { CHAPTER_1_EVIDENCE, CHAPTER_1_JOURNAL_NOTES, CHAPTER_1_WARNING_SIGNS } from "./evidence";
import type { NpcId } from "./ids";
import { CHAPTER_1_INTERACTABLES } from "./interactables";
import { CHAPTER_1_OBJECTIVES } from "./objectives";
import { CHAPTER_1_CALLS, CHAPTER_1_PHONE } from "./phone";

/** No NPC conversations in this chapter. */
export const CHAPTER_1_NPCS = {} as Record<NpcId, NpcDef>;

export const CHAPTER_1_SCENARIO: ScenarioDefinition = {
  id: "chapter-1",
  title: "The Urgent Call",
  subtitle: "The notification arrives before breakfast.",
  objectives: CHAPTER_1_OBJECTIVES,
  interactables: CHAPTER_1_INTERACTABLES,
  claims: CHAPTER_1_CLAIMS,
  evidence: CHAPTER_1_EVIDENCE,
  warningSigns: CHAPTER_1_WARNING_SIGNS,
  journalNotes: CHAPTER_1_JOURNAL_NOTES,
  calls: CHAPTER_1_CALLS,
  npcs: CHAPTER_1_NPCS,
  dialogues: {} as ScenarioDefinition["dialogues"],
  phone: CHAPTER_1_PHONE,
  decisions: CHAPTER_1_DECISIONS,
  endings: CHAPTER_1_ENDINGS,
  debrief: CHAPTER_1_DEBRIEF,
  acts: CHAPTER_1_ACTS,
  // Placeholders (task 2.2): filled by the content tasks.
  sources: {} as ScenarioDefinition["sources"],
  deductions: {} as ScenarioDefinition["deductions"],
  deviceActions: {} as ScenarioDefinition["deviceActions"],
  beats: [],
};
