import { describe, expect, it } from "vitest";
import {
  createLocalStorageSaveSource,
  parseSaveEnvelopeV3,
  SAVE_CONTENT_VERSION,
  SAVE_FORMAT_VERSION_V3,
  SAVE_MAX_ACTIONS,
  SAVE_STORAGE_KEY,
  SAVE_STORAGE_KEY_V2,
  SAVE_STORAGE_KEY_V3,
  type SavedGameV3,
} from "./saveGame";

const VALID_V3: SavedGameV3 = {
  formatVersion: SAVE_FORMAT_VERSION_V3,
  contentVersion: SAVE_CONTENT_VERSION,
  chapterId: "chapter-1",
  sceneId: "apartment",
  savedAt: "2026-11-10T08:00:00.000Z",
  progress: {
    checkpointId: "obj.answer-call",
    actions: [{ type: "START_CHAPTER" }, { type: "OPEN_PHONE" }],
    playerPose: null,
  },
};
const OLD_V1 = { formatVersion: 1, chapterId: "chapter-1", sceneId: "street", savedAt: "2026-11-10T08:00:00.000Z" };
const OLD_V2 = { ...OLD_V1, formatVersion: 2, progress: { checkpointId: "start", actions: [], playerPose: null } };

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

/** Memory storage whose writes always fail, like a full quota. */
function readOnlyStorage(initial: Record<string, string>): Storage {
  return {
    ...memoryStorage(initial),
    setItem: () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    },
  };
}

describe("parseSaveEnvelopeV3", () => {
  it("accepts a well-formed v3 save and drops unknown fields", () => {
    const raw = { ...VALID_V3, extra: "x", progress: { ...VALID_V3.progress, note: "y" } };
    expect(parseSaveEnvelopeV3(raw)).toEqual({ status: "valid", save: VALID_V3 });
  });

  it("keeps a finite pose and accepts null", () => {
    const pose = { position: [1, 2, 3], yaw: 0.5 };
    const withPose = parseSaveEnvelopeV3({ ...VALID_V3, progress: { ...VALID_V3.progress, playerPose: pose } });
    expect(withPose.status === "valid" && withPose.save.progress.playerPose).toEqual(pose);
    expect(parseSaveEnvelopeV3(VALID_V3).status).toBe("valid");
  });

  it.each([
    ["version 1", { ...VALID_V3, formatVersion: 1 }],
    ["version 2", { ...VALID_V3, formatVersion: 2 }],
    ["an unknown future version", { ...VALID_V3, formatVersion: 4 }],
    ["a different content version", { ...VALID_V3, contentVersion: "ch1-other" }],
  ])("reports %s as incompatible", (_label, raw) => {
    expect(parseSaveEnvelopeV3(raw)).toMatchObject({ status: "invalid", code: "incompatible" });
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "save"],
    ["a missing content version", { ...VALID_V3, contentVersion: undefined }],
    ["an empty chapter", { ...VALID_V3, chapterId: "" }],
    ["an unknown scene", { ...VALID_V3, sceneId: "rooftop" }],
    ["an invalid date", { ...VALID_V3, savedAt: "yesterday" }],
    ["no progress", { ...VALID_V3, progress: undefined }],
    ["an empty checkpoint", { ...VALID_V3, progress: { ...VALID_V3.progress, checkpointId: "" } }],
    ["a non-array action list", { ...VALID_V3, progress: { ...VALID_V3.progress, actions: {} } }],
    ["an unknown action", { ...VALID_V3, progress: { ...VALID_V3.progress, actions: [{ type: "PAY" }] } }],
    [
      "too many actions",
      { ...VALID_V3, progress: { ...VALID_V3.progress, actions: Array(SAVE_MAX_ACTIONS + 1).fill({ type: "OPEN_PHONE" }) } },
    ],
    ["a malformed pose", { ...VALID_V3, progress: { ...VALID_V3.progress, playerPose: { position: [1, 2], yaw: 0 } } }],
  ])("reports %s as damaged without throwing", (_label, raw) => {
    expect(parseSaveEnvelopeV3(raw)).toMatchObject({ status: "invalid", code: "damaged" });
  });
});

describe("createLocalStorageSaveSource", () => {
  const sourceOf = (storage: Storage) => createLocalStorageSaveSource(() => storage);

  it("reports no save when no key is present", () => {
    expect(sourceOf(memoryStorage()).read()).toEqual({ status: "none" });
  });

  it("reads a valid v3 save", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY_V3]: JSON.stringify(VALID_V3) });
    expect(sourceOf(storage).read()).toEqual({ status: "valid", save: VALID_V3 });
  });

  it("prefers the v3 key over old keys", () => {
    const storage = memoryStorage({
      [SAVE_STORAGE_KEY_V3]: JSON.stringify(VALID_V3),
      [SAVE_STORAGE_KEY_V2]: JSON.stringify(OLD_V2),
      [SAVE_STORAGE_KEY]: JSON.stringify(OLD_V1),
    });
    expect(sourceOf(storage).read()).toEqual({ status: "valid", save: VALID_V3 });
  });

  it.each([
    ["v2", SAVE_STORAGE_KEY_V2, OLD_V2],
    ["v1", SAVE_STORAGE_KEY, OLD_V1],
  ])("reports a %s save as incompatible and neither migrates nor deletes it", (_label, key, old) => {
    const storage = memoryStorage({ [key]: JSON.stringify(old) });
    const result = sourceOf(storage).read();
    expect(result).toMatchObject({ status: "invalid", code: "incompatible" });
    expect(storage.getItem(key)).toBe(JSON.stringify(old));
    expect(storage.getItem(SAVE_STORAGE_KEY_V3)).toBeNull();
  });

  it("reports an old key as incompatible even when its content is not JSON", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY_V2]: "{not json" });
    expect(sourceOf(storage).read()).toMatchObject({ status: "invalid", code: "incompatible" });
  });

  it("reports invalid JSON under the v3 key as damaged", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY_V3]: "{not json" });
    expect(sourceOf(storage).read()).toMatchObject({ status: "invalid", code: "damaged" });
  });

  it("reports a v3 save with another content version as incompatible", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY_V3]: JSON.stringify({ ...VALID_V3, contentVersion: "old" }) });
    expect(sourceOf(storage).read()).toMatchObject({ status: "invalid", code: "incompatible" });
  });

  it("does not fall back to old keys when the v3 key is damaged", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY_V3]: "null", [SAVE_STORAGE_KEY_V2]: JSON.stringify(OLD_V2) });
    expect(sourceOf(storage).read()).toMatchObject({ status: "invalid", code: "damaged" });
  });

  it("writes a v3 save under the v3 key that reads back unchanged", () => {
    const storage = memoryStorage();
    const source = sourceOf(storage);
    expect(source.write?.(VALID_V3)).toBe(true);
    expect(storage.getItem(SAVE_STORAGE_KEY_V3)).not.toBeNull();
    expect(source.read()).toEqual({ status: "valid", save: VALID_V3 });
  });

  it("returns false when the write fails", () => {
    expect(sourceOf(readOnlyStorage({})).write?.(VALID_V3)).toBe(false);
    expect(createLocalStorageSaveSource(() => undefined).write?.(VALID_V3)).toBe(false);
  });

  it("clear removes all three save keys and keeps other keys", () => {
    const storage = memoryStorage({
      [SAVE_STORAGE_KEY_V3]: JSON.stringify(VALID_V3),
      [SAVE_STORAGE_KEY_V2]: JSON.stringify(OLD_V2),
      [SAVE_STORAGE_KEY]: JSON.stringify(OLD_V1),
      other: "kept",
    });
    const source = sourceOf(storage);
    expect(source.clear?.()).toBe(true);
    for (const key of [SAVE_STORAGE_KEY_V3, SAVE_STORAGE_KEY_V2, SAVE_STORAGE_KEY]) {
      expect(storage.getItem(key)).toBeNull();
    }
    expect(storage.getItem("other")).toBe("kept");
    expect(source.read()).toEqual({ status: "none" });
  });

  it("handles blocked storage without throwing", () => {
    const source = createLocalStorageSaveSource(() => {
      throw new Error("SecurityError");
    });
    expect(source.read()).toEqual({ status: "none" });
    expect(source.write?.(VALID_V3)).toBe(false);
    expect(source.clear?.()).toBe(false);
  });

  it("treats storage that throws on getItem as no save", () => {
    const throwing: Storage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(sourceOf(throwing).read()).toEqual({ status: "none" });
  });
});
