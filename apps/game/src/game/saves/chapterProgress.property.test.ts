// Feature: chapter-01-double-deception, Property 2: Save v3 round trip and tamper handling
// **Validates: Requirements 17.4, 17.5**
import { describe, expect, it } from "vitest";
import {
  caseSeed,
  CORE_PROPERTY_RUNS,
  CORE_SEQUENCE_MAX_LENGTH,
  generateActionSequence,
  runSequence,
} from "../../test/chapterRuns";
import { createLcg, randomInt } from "../../test/seededRandom";
import { encodeProgress, restoreProgress } from "./chapterProgress";
import {
  createLocalStorageSaveSource,
  parseSaveEnvelopeV3,
  SAVE_CONTENT_VERSION,
  SAVE_FORMAT_VERSION_V3,
  type SavedGameV3,
  type SavedPlayerPose,
} from "./saveGame";

const SEED = 0x5a7e0c12;
const RUNS = Math.max(200, CORE_PROPERTY_RUNS);

/** Minimal in-memory Storage for the localStorage save source. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

/** Uniform float in [min, max). */
function randomFloat(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

/**
 * Any finite pose, near or far from any play area: v3 stores it unchanged. Magnitudes start at
 * 0.001 so `-0` never appears (JSON writes `-0` as `0`).
 */
function randomPose(next: () => number): SavedPlayerPose {
  const axis = () => randomFloat(next, 0.001, next() < 0.5 ? 5 : 100_000) * (next() < 0.5 ? -1 : 1);
  return { position: [axis(), axis(), axis()], yaw: axis() };
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 120_000;

describe("chapter progress save v3 round trip", () => {
  it("restores the same Chapter_State and the unchanged pose after encode, JSON, write, read and replay", () => {
    for (let index = 0; index < RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const next = createLcg(seed);
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      const state = runSequence(generateActionSequence(seed, length)).final;
      const pose = next() < 0.3 ? null : randomPose(next);
      const label = `seed ${seed} (case ${index}), length ${length}, pose ${JSON.stringify(pose)}`;

      const progress = encodeProgress(state, pose, "start");
      expect(progress, label).not.toBeNull();
      if (progress === null) continue;
      expect(progress.actions.length, label).toBe(state.events.length);

      const save: SavedGameV3 = {
        formatVersion: SAVE_FORMAT_VERSION_V3,
        contentVersion: SAVE_CONTENT_VERSION,
        chapterId: state.chapterId,
        sceneId: next() < 0.5 ? "apartment" : "street",
        savedAt: "2026-11-08T12:00:00.000Z",
        progress,
      };

      // Path 1: JSON text -> structural parse -> replay.
      const parsed = parseSaveEnvelopeV3(JSON.parse(JSON.stringify(save)));
      expect(parsed.status, label).toBe("valid");
      if (parsed.status !== "valid") continue;
      expect(parsed.save, label).toEqual(save);
      const restored = restoreProgress(parsed.save.progress);
      expect(restored.ok, label).toBe(true);
      if (!restored.ok) continue;
      expect(restored.state, label).toEqual(state);
      expect(restored.pose, label).toEqual(pose);

      // Path 2: write and read through the localStorage save source with in-memory storage.
      const storage = memoryStorage();
      const source = createLocalStorageSaveSource(() => storage);
      expect(source.write?.(save), label).toBe(true);
      const read = source.read();
      expect(read.status, label).toBe("valid");
      if (read.status !== "valid") continue;
      const fromStorage = restoreProgress(read.save.progress, undefined, { lenient: true });
      expect(fromStorage.ok, label).toBe(true);
      if (!fromStorage.ok) continue;
      expect(fromStorage.trimmed, label).toBe(false);
      expect(fromStorage.state, label).toEqual(state);
      expect(fromStorage.pose, label).toEqual(pose);
    }
  }, PROPERTY_TIMEOUT_MS);
});
