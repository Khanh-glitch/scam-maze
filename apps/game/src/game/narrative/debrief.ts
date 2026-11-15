// Debrief builder for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Debrief builder", and
// Requirements 14.3-14.5.
//
// Every listed decision, Evidence_Item, warning sign and missed clue comes only from
// Scenario_Data and the Event_Log (Requirement 14.4). The Outcome and its consequence variant
// come from the state's Outcome and the authored Ending.

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type { EvidenceId, OutcomeId, WarningSignId } from "./chapter1/ids";
import { selectConsequenceVariant } from "./outcome";
import type { DebriefTimelineKind } from "@scammaze/shared-types";
import { BEAT_TAG_PREFIX } from "./beats";
import type { ChapterState, CoreAction, DebriefTrap, ScenarioDefinition } from "./types";

/** The call of the third caller (the recovery procedure). */
const THIRD_CALLER_ID = "call.recovery";

export interface DebriefView {
  outcome: {
    id: OutcomeId;
    title: string;
    summary: string;
    consequence: { id: string; text: string } | null;
    /** "Simulation: nothing real happened." */
    simulationLabel: string;
  };
  /** Event_Log entries with a debrief tag that has decision note text, in log order. */
  decisions: Array<{ seq: number; tag: string; text: string }>;
  /** Discovered evidence, in discovery order. */
  evidenceFound: Array<{ id: EvidenceId; title: string }>;
  /** Union of the warning signs of the discovered evidence, in first-seen order. */
  warningSignsNoticed: Array<{ id: WarningSignId; label: string }>;
  /** Evidence with a debrief hint that was not discovered, in scenario order (Requirement 14.5). */
  cluesMissed: Array<{ id: EvidenceId; title: string; hint: string }>;
  /** One entry per accepted action with a (non-beat) debrief tag, in `seq` order. */
  timeline: DebriefTimelineEntry[];
  analysis: DebriefAnalysis;
  mechanism: string;
  saferAlternatives: string[];
}

export interface DebriefTimelineEntry {
  seq: number;
  kind: DebriefTimelineKind;
  tag: string;
  /** Decision note for the tag, or an empty string when the scenario has none. */
  text: string;
}

export interface DebriefAnalysis {
  /** Authored text about how pressure was built. */
  pressureBuilt: string;
  /** Pressure reached in this run, 0..3. */
  pressureLevel: number;
  whyWarningLooked: string;
  /** Warning signs of the evidence the player found, as unverified-source signals. */
  unverifiedSignals: Array<{ id: WarningSignId; label: string }>;
  /** The third caller never gives independent evidence. */
  thirdCallerIndependent: false;
  /**
   * True when the player answered the third caller (a call record with status `answered` or
   * `ended`). A declined or never-rung call is not an encounter, so the debrief says nothing about it.
   */
  thirdCallerEncountered: boolean;
  /** Authored note about the third caller, or `null` when the player never talked to that caller. */
  thirdCallerNote: string | null;
  trapEntered: DebriefTrap;
  trapNote: string;
  verifyNextTime: string[];
}

/** Maps an action type to the timeline kind. */
function timelineKind(action: CoreAction): DebriefTimelineKind {
  switch (action.type) {
    case "RING_CALL":
    case "ANSWER_CALL":
    case "END_CALL":
    case "TALK_TO_NPC":
    case "SELECT_DIALOGUE_OPTION":
      return "call";
    case "INTERACT_OBJECT":
    case "INSPECT_EVIDENCE":
      return "evidence";
    case "COMBINE_EVIDENCE":
      return "deduction";
    case "VERIFY_CLAIM":
      return "verification";
    case "MAKE_DECISION":
      return "decision";
    default:
      return "device";
  }
}

/**
 * Builds the debrief for a state with an Outcome. Returns `null` when no Outcome is set.
 * Pure: never mutates its inputs.
 */
export function buildDebrief(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): DebriefView | null {
  const outcomeId = state.outcome;
  if (outcomeId === null || !Object.hasOwn(scenario.endings, outcomeId)) return null;
  const ending = scenario.endings[outcomeId];
  const variant = selectConsequenceVariant(state, scenario, outcomeId);

  const decisions: DebriefView["decisions"] = [];
  const found: EvidenceId[] = [];
  for (const entry of state.events) {
    for (const tag of entry.derived.debriefTags) {
      if (Object.hasOwn(scenario.debrief.decisionNotes, tag)) {
        decisions.push({ seq: entry.seq, tag, text: scenario.debrief.decisionNotes[tag] });
      }
    }
    for (const id of entry.derived.evidence) {
      if (!found.includes(id) && Object.hasOwn(scenario.evidence, id)) found.push(id);
    }
  }

  // Beat events carry `beat:<id>` tags. They are system events, not player actions, so they are
  // excluded from the timeline.
  const timeline: DebriefTimelineEntry[] = [];
  for (const entry of state.events) {
    const tags = entry.derived.debriefTags.filter((tag) => !tag.startsWith(BEAT_TAG_PREFIX));
    if (tags.length === 0) continue;
    const tag = tags.find((candidate) => Object.hasOwn(scenario.debrief.decisionNotes, candidate)) ?? tags[0];
    const text = Object.hasOwn(scenario.debrief.decisionNotes, tag) ? scenario.debrief.decisionNotes[tag] : "";
    timeline.push({ seq: entry.seq, kind: timelineKind(entry.action), tag, text });
  }

  const signs: WarningSignId[] = [];
  for (const id of found) {
    for (const sign of scenario.evidence[id].warningSigns) {
      if (!signs.includes(sign)) signs.push(sign);
    }
  }

  const cluesMissed: DebriefView["cluesMissed"] = [];
  for (const id of Object.keys(scenario.evidence) as EvidenceId[]) {
    const item = scenario.evidence[id];
    if (item.debriefHint && !found.includes(id)) {
      cluesMissed.push({ id, title: item.title, hint: item.debriefHint });
    }
  }

  const warningSignsNoticed = signs
    .filter((id) => Object.hasOwn(scenario.warningSigns, id))
    .map((id) => ({ id, label: scenario.warningSigns[id].label }));
  const firstTrap = state.flags.code_shared === true;
  const secondTrap = state.flags.money_moved === true || state.flags.second_caller_trusted === true;
  const trapEntered: DebriefTrap = firstTrap && secondTrap ? "both" : firstTrap ? "first" : secondTrap ? "second" : "none";
  const content = scenario.debrief.analysis;
  const thirdCallerEncountered = state.call.log.some(
    (record) => record.callId === THIRD_CALLER_ID && (record.status === "answered" || record.status === "ended"),
  );

  return {
    outcome: {
      id: outcomeId,
      title: ending.title,
      summary: scenario.debrief.outcomeSummaries[outcomeId] ?? "",
      consequence: variant ? { id: variant.id, text: variant.text } : null,
      simulationLabel: ending.simulationLabel,
    },
    decisions,
    evidenceFound: found.map((id) => ({ id, title: scenario.evidence[id].title })),
    warningSignsNoticed,
    cluesMissed,
    timeline,
    analysis: {
      pressureBuilt: content.pressureBuilt,
      pressureLevel: state.pressure,
      whyWarningLooked: content.whyWarningLooked,
      unverifiedSignals: warningSignsNoticed,
      thirdCallerIndependent: false,
      thirdCallerEncountered,
      thirdCallerNote: thirdCallerEncountered ? content.thirdCallerNote : null,
      trapEntered,
      trapNote: content.trapNotes[trapEntered],
      verifyNextTime: [...content.verifyNextTime],
    },
    mechanism: scenario.debrief.mechanism,
    saferAlternatives: [...scenario.debrief.saferAlternatives],
  };
}
