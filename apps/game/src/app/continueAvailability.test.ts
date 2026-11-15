import { describe, expect, it } from "vitest";
import type { CoreAction } from "../game/narrative/types";
import {
  SAVE_CONTENT_VERSION,
  SAVE_FORMAT_VERSION_V3,
  START_CHECKPOINT_ID,
  createLocalStorageSaveSource,
  type SaveGameSource,
  type SaveReadResult,
  type SavedGame,
} from "../game/saves/saveGame";
import { CONTINUE_REASONS, readContinueAvailability } from "./continueAvailability";

function sourceOf(result: SaveReadResult): SaveGameSource {
  return { read: () => result };
}

function v3Save(actions: CoreAction[], chapterId = "chapter-1"): SavedGame {
  return {
    formatVersion: SAVE_FORMAT_VERSION_V3,
    contentVersion: SAVE_CONTENT_VERSION,
    chapterId,
    sceneId: "apartment",
    savedAt: "2026-11-08T08:00:00.000Z",
    progress: { checkpointId: START_CHECKPOINT_ID, actions, playerPose: null },
  };
}

describe("readContinueAvailability", () => {
  it("reports that no saved game exists", () => {
    expect(readContinueAvailability(sourceOf({ status: "none" }))).toEqual({
      available: false,
      reasonCode: "none",
      reason: "No saved game found.",
    });
  });

  it("reports an unreadable save", () => {
    expect(readContinueAvailability(sourceOf({ status: "invalid", reason: "Saved data is not valid JSON." }))).toEqual({
      available: false,
      reasonCode: "invalid",
      reason: "Your saved game could not be read. Start a new game instead.",
    });
  });

  it("treats a save for an unknown chapter as unreadable", () => {
    const save = v3Save([{ type: "START_CHAPTER" }], "chapter-99");
    expect(readContinueAvailability(sourceOf({ status: "valid", save }))).toEqual({
      available: false,
      reasonCode: "invalid",
      reason: CONTINUE_REASONS.invalid,
    });
  });

  it("treats v3 progress that does not replay as unreadable", () => {
    // OPEN_PHONE twice in a row: the second one is rejected by the chapter core.
    const save = v3Save([{ type: "START_CHAPTER" }, { type: "OPEN_PHONE" }, { type: "OPEN_PHONE" }]);
    expect(readContinueAvailability(sourceOf({ status: "valid", save }))).toEqual({
      available: false,
      reasonCode: "invalid",
      reason: CONTINUE_REASONS.invalid,
    });
  });

  it("enables Continue for valid v3 progress", () => {
    const save = v3Save([{ type: "START_CHAPTER" }, { type: "OPEN_PHONE" }, { type: "CLOSE_PHONE" }]);
    expect(readContinueAvailability(sourceOf({ status: "valid", save }))).toEqual({ available: true });
  });

  it("reports an incompatible save with its own reason code", () => {
    const result: SaveReadResult = { status: "invalid", reason: "old", code: "incompatible" };
    expect(readContinueAvailability(sourceOf(result))).toEqual({
      available: false,
      reasonCode: "incompatible",
      reason: CONTINUE_REASONS.incompatible,
    });
  });
  it("keeps a damaged save on the invalid reason", () => {
    const result: SaveReadResult = { status: "invalid", reason: "bad", code: "damaged" };
    expect(readContinueAvailability(sourceOf(result))).toMatchObject({ available: false, reasonCode: "invalid" });
  });
  it("reports an old v2 key in storage as incompatible end to end", () => {
    const data = new Map([["scammaze_save_v2", "{}"]]);
    const storage = { getItem: (k: string) => data.get(k) ?? null } as Storage;
    expect(readContinueAvailability(createLocalStorageSaveSource(() => storage))).toMatchObject({
      available: false,
      reasonCode: "incompatible",
    });
  });
});
