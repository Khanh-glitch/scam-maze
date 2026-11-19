// Decides whether the main menu enables Continue (Requirements 15.6 and 15.11).
// Continue is enabled only when the save names a known chapter and its progress replays through
// the chapter core. An older save format is reported as incompatible (Requirement 17.2).

import type { ContinueAvailability } from "../features/menu/MainMenuOverlay";
import { getChapter } from "../game/chapters/chapterRegistry";
import { ACTIVE_SCENARIO } from "../game/narrative/activeScenario";
import { restoreProgress } from "../game/saves/chapterProgress";
import type { SaveGameSource } from "../game/saves/saveGame";

/** English source text; the menu shows `menu:continueReasons.<reasonCode>` in the UI language. */
export const CONTINUE_REASONS = {
  none: "No saved game found.",
  invalid: "Your saved game could not be read. Start a new game instead.",
  incompatible: "Your saved game is from an older version of the game and cannot be continued. Start a new game instead.",
} as const;

export function readContinueAvailability(source: SaveGameSource): ContinueAvailability {
  const result = source.read();
  if (result.status === "none") {
    return { available: false, reasonCode: "none", reason: CONTINUE_REASONS.none };
  }
  if (result.status === "invalid" && result.code === "incompatible") {
    return { available: false, reasonCode: "incompatible", reason: CONTINUE_REASONS.incompatible };
  }
  if (result.status === "invalid" || !getChapter(result.save.chapterId)) {
    return { available: false, reasonCode: "invalid", reason: CONTINUE_REASONS.invalid };
  }
  if (!restoreProgress(result.save.progress, ACTIVE_SCENARIO).ok) {
    return { available: false, reasonCode: "invalid", reason: CONTINUE_REASONS.invalid };
  }
  return { available: true };
}
