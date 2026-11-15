// Pure beat helper for the chapter core.
// No clock, randomness, I/O, React, Three.js or i18n. See the double-deception design, "Ring and beat rules".
//
// "Already fired" is derived from the event log, so ChapterState gets no new field: the reducer
// adds `beatTag(id)` to `derived.debriefTags` of the event entry of the action that triggered
// the beat (task 3.3). `applyBeats` returns the fired IDs so the reducer can do that.

import { applyEffects, evaluateConditions } from "./conditions";
import type { ChapterState, ScenarioDefinition } from "./types";

/** Maximum number of passes over the beat list per accepted action. */
export const MAX_BEAT_PASSES = 8;

export const BEAT_TAG_PREFIX = "beat:";

/** The debrief tag that marks a beat as fired in an event entry. */
export function beatTag(beatId: string): string {
  return `${BEAT_TAG_PREFIX}${beatId}`;
}

/** True when an earlier event entry recorded the beat as fired. */
export function hasBeatFired(state: ChapterState, beatId: string): boolean {
  const tag = beatTag(beatId);
  return state.events.some((entry) => entry.derived.debriefTags.includes(tag));
}

export interface BeatsResult {
  state: ChapterState;
  /** IDs of the beats fired by this call, in firing order. */
  fired: string[];
}

/**
 * Applies beats whose conditions hold, in scenario order, repeating until a pass fires nothing
 * or `MAX_BEAT_PASSES` passes ran. Each beat fires at most once, counting beats already recorded
 * in the event log. Never mutates `state`.
 */
export function applyBeats(state: ChapterState, scenario: ScenarioDefinition): BeatsResult {
  let current = state;
  const fired: string[] = [];
  const firedNow = new Set<string>();

  for (let pass = 0; pass < MAX_BEAT_PASSES; pass += 1) {
    let firedInPass = false;
    for (const beat of scenario.beats) {
      if (firedNow.has(beat.id) || hasBeatFired(state, beat.id)) continue;
      if (!evaluateConditions(beat.when, current, scenario)) continue;
      current = applyEffects(current, beat.effects, scenario);
      firedNow.add(beat.id);
      fired.push(beat.id);
      firedInPass = true;
    }
    if (!firedInPass) break;
  }

  return { state: current, fired };
}
