// Display scenario per UI language (game-i18n-en-vi, design section 10).
// English returns the canonical objects unchanged. Other locales are localized once and cached,
// so selectors memoized by (state, scenario) keep stable references across renders.

import type { GameLocale } from "@scammaze/shared-types";
import type { InteractableId } from "../game/narrative/chapter1/ids";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../game/narrative/chapter1/interactables";
import { ACTIVE_SCENARIO } from "../game/narrative/activeScenario";
import { localizeInteractionPrompts, localizeScenario, type NarrativeOverlay } from "../game/narrative/localize";
import type { ScenarioDefinition } from "../game/narrative/types";
import { LAST_SUBMISSION_NARRATIVE_VI } from "./narrative/lastSubmission.vi";
import { useGameLocale } from "./useGameLocale";

export const NARRATIVE_OVERLAYS: Record<GameLocale, NarrativeOverlay> = {
  en: {},
  vi: LAST_SUBMISSION_NARRATIVE_VI,
};

const scenarioCache = new Map<GameLocale, ScenarioDefinition>();
const promptsCache = new Map<GameLocale, Record<InteractableId, string>>();

/** Chapter 1 scenario with display text in `locale`. Same object for repeated calls. */
export function getDisplayScenario(locale: GameLocale): ScenarioDefinition {
  if (locale === "en") return ACTIVE_SCENARIO;
  let scenario = scenarioCache.get(locale);
  if (scenario === undefined) {
    scenario = localizeScenario(ACTIVE_SCENARIO, NARRATIVE_OVERLAYS[locale]);
    scenarioCache.set(locale, scenario);
  }
  return scenario;
}

/** Interaction prompts with display text in `locale`. Same object for repeated calls. */
export function getDisplayPrompts(locale: GameLocale): Record<InteractableId, string> {
  if (locale === "en") return CHAPTER_1_INTERACTION_PROMPTS;
  let prompts = promptsCache.get(locale);
  if (prompts === undefined) {
    prompts = localizeInteractionPrompts(CHAPTER_1_INTERACTION_PROMPTS, NARRATIVE_OVERLAYS[locale]);
    promptsCache.set(locale, prompts);
  }
  return prompts;
}

/** Display scenario for the current UI language; changes reference only when the language changes. */
export function useDisplayScenario(): ScenarioDefinition {
  return getDisplayScenario(useGameLocale());
}
