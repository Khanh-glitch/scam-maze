// Chapter 1 "LAST SUBMISSION: 72 GIỜ CUỐI": the Scenario_Data of the new chapter foundation.
// Pure TypeScript data.
//
// Foundation only. The character, the 72-hour clock and the resources and persistent flags (see
// `../resources.ts`) exist. Story content does not: no mission, call, message, evidence, decision
// or ending is defined yet, and each is added with its mission. The empty records below are typed
// with the legacy ID unions until the missions bring their own IDs; they are empty on purpose.
import type { NpcDef, ScenarioDefinition } from "../types";
import { CHAPTER_1_INITIAL_STATE } from "../resources";
import type { NpcId } from "./ids";

/** English title and subtitle. The Vietnamese text lives in `i18n/narrative/lastSubmission.vi.ts`. */
export const LAST_SUBMISSION_TITLE = "LAST SUBMISSION: 72 GIỜ CUỐI";
export const LAST_SUBMISSION_SUBTITLE = "Submit the thesis by Friday, 17:00.";

export const LAST_SUBMISSION_SCENARIO: ScenarioDefinition = {
  id: "chapter-1",
  title: LAST_SUBMISSION_TITLE,
  subtitle: LAST_SUBMISSION_SUBTITLE,
  initial: CHAPTER_1_INITIAL_STATE,
  gameplay: { clockRuns: true },
  events: [],
  missions: [],
  objectives: {} as ScenarioDefinition["objectives"],
  interactables: {} as ScenarioDefinition["interactables"],
  claims: {} as ScenarioDefinition["claims"],
  evidence: {} as ScenarioDefinition["evidence"],
  warningSigns: {} as ScenarioDefinition["warningSigns"],
  journalNotes: [],
  calls: {} as ScenarioDefinition["calls"],
  npcs: {} as Record<NpcId, NpcDef>,
  dialogues: {} as ScenarioDefinition["dialogues"],
  phone: {
    messages: {} as ScenarioDefinition["phone"]["messages"],
    contacts: [],
    officialWebsite: "",
    bankApp: { title: "", screens: [] },
  },
  decisions: {} as ScenarioDefinition["decisions"],
  endings: {} as ScenarioDefinition["endings"],
  debrief: {
    mechanism: "",
    saferAlternatives: [],
    outcomeSummaries: {} as ScenarioDefinition["debrief"]["outcomeSummaries"],
    decisionNotes: {},
    analysis: {
      pressureBuilt: "",
      whyWarningLooked: "",
      thirdCallerNote: "",
      trapNotes: { none: "", first: "", second: "", both: "" },
      verifyNextTime: [],
    },
  },
  acts: [],
  sources: {} as ScenarioDefinition["sources"],
  deductions: {} as ScenarioDefinition["deductions"],
  deviceActions: {} as ScenarioDefinition["deviceActions"],
  beats: [],
};
