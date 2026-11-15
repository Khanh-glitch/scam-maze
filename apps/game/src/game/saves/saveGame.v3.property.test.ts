// Feature: chapter-01-double-deception, Property 3: Save parsing is total and old versions are incompatible
// Validates: Requirements 17.1, 17.2
import { describe, expect, it } from "vitest";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import {
  createLocalStorageSaveSource,
  parseSaveEnvelopeV3,
  SAVE_CONTENT_VERSION,
  SAVE_FORMAT_VERSION_V3,
  SAVE_STORAGE_KEY,
  SAVE_STORAGE_KEY_V2,
  SAVE_STORAGE_KEY_V3,
  type SavedGameV3,
} from "./saveGame";

const BASE_SEED = 0x5a3e0003;
const RUNS = 200;
const TIMEOUT_MS = 120_000;

function caseSeed(index: number): number {
  return (BASE_SEED + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

const HOSTILE_KEYS = ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty", "polluted"];
const KEY_POOL = [
  ...HOSTILE_KEYS,
  "formatVersion",
  "contentVersion",
  "chapterId",
  "sceneId",
  "savedAt",
  "progress",
  "checkpointId",
  "actions",
  "playerPose",
  "position",
  "yaw",
  "type",
];

type Rng = () => number;

function randomString(rng: Rng): string {
  const length = randomInt(rng, 0, 40);
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(randomInt(rng, 0, 0x2fff));
  return out;
}

function randomJson(rng: Rng, depth: number): unknown {
  const kind = randomInt(rng, 0, depth > 3 ? 5 : 8);
  switch (kind) {
    case 0:
      return null;
    case 1:
      return rng() < 0.5;
    case 2:
      return randomInt(rng, -1000, 1000) / (rng() < 0.5 ? 1 : 7);
    case 3:
      return randomString(rng);
    case 4:
      return pick(rng, [3, 2, 1, 0, -1, "3", SAVE_FORMAT_VERSION_V3]);
    case 5:
      return pick(rng, [SAVE_CONTENT_VERSION, "start", "apartment", "street"]);
    case 6: {
      const n = randomInt(rng, 0, 5);
      return Array.from({ length: n }, () => randomJson(rng, depth + 1));
    }
    default: {
      const out: Record<string, unknown> = {};
      const n = randomInt(rng, 0, 6);
      for (let i = 0; i < n; i += 1) {
        // defineProperty makes an own "__proto__" key, as JSON.parse would.
        Object.defineProperty(out, pick(rng, KEY_POOL), {
          value: randomJson(rng, depth + 1),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return out;
    }
  }
}

function validV3(rng: Rng): SavedGameV3 {
  const actionCount = randomInt(rng, 0, 5);
  return {
    formatVersion: SAVE_FORMAT_VERSION_V3,
    contentVersion: SAVE_CONTENT_VERSION,
    chapterId: `chapter-${randomInt(rng, 1, 9)}`,
    sceneId: pick(rng, ["main-menu", "intro-prologue", "apartment", "street"] as const),
    savedAt: new Date(randomInt(rng, 0, 2_000_000_000) * 1000).toISOString(),
    progress: {
      checkpointId: pick(rng, ["start", "debrief", "obj.answer-call"]),
      actions: [{ type: "START_CHAPTER" }, ...Array.from({ length: actionCount }, () => ({ type: "OPEN_PHONE" as const }))],
      playerPose: rng() < 0.5 ? null : { position: [randomInt(rng, -9, 9), 0, randomInt(rng, -9, 9)], yaw: rng() },
    },
  };
}

/** Replaces, deletes or adds a value at a random path of a JSON clone. */
function mutate(rng: Rng, value: unknown): unknown {
  const clone = JSON.parse(JSON.stringify(value)) as unknown;
  let target: unknown = clone;
  const steps = randomInt(rng, 0, 3);
  for (let i = 0; i < steps; i += 1) {
    if (typeof target !== "object" || target === null) break;
    const keys = Object.keys(target);
    if (keys.length === 0) break;
    const next = (target as Record<string, unknown>)[pick(rng, keys)];
    if (typeof next !== "object" || next === null) break;
    target = next;
  }
  if (typeof target !== "object" || target === null) return randomJson(rng, 0);
  const keys = Object.keys(target);
  const key = keys.length > 0 && rng() < 0.8 ? pick(rng, keys) : pick(rng, KEY_POOL);
  const record = target as Record<string, unknown>;
  if (rng() < 0.3 && !Array.isArray(target)) delete record[key];
  else
    Object.defineProperty(record, key, {
      value: randomJson(rng, 2),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  return clone;
}

function deepNested(rng: Rng): unknown {
  const depth = randomInt(rng, 100, 20_000);
  let node: unknown = pick(rng, [null, 1, "x", {}]);
  for (let i = 0; i < depth; i += 1) node = rng() < 0.5 ? [node] : { progress: node };
  return node;
}

function randomText(rng: Rng): string {
  const kind = randomInt(rng, 0, 5);
  if (kind === 0) return randomString(rng);
  if (kind === 1) return "[".repeat(randomInt(rng, 1, 50_000)) + "]".repeat(randomInt(rng, 0, 50_000));
  if (kind === 2) return '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}';
  if (kind === 3) return JSON.stringify(randomJson(rng, 0)) ?? "undefined";
  if (kind === 4) return JSON.stringify(mutate(rng, validV3(rng)));
  return JSON.stringify(validV3(rng)).slice(0, randomInt(rng, 0, 200));
}

function validLookingOld(rng: Rng, version: 1 | 2): string {
  if (rng() < 0.2) return randomString(rng); // includes empty string, which is still "present"
  return JSON.stringify({
    formatVersion: version,
    chapterId: "chapter-1",
    sceneId: "apartment",
    savedAt: new Date(0).toISOString(),
    progress: { checkpointId: "start", actions: [{ type: "START_CHAPTER" }], playerPose: null },
  });
}

class MemoryStorage {
  readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const asStorage = (s: MemoryStorage): Storage => s as unknown as Storage;

const OBJECT_PROTO_KEYS = Object.getOwnPropertyNames(Object.prototype).sort().join("|");

function assertTyped(result: unknown, allowNone: boolean): string | undefined {
  if (typeof result !== "object" || result === null) return "result is not an object";
  const r = result as { status?: unknown; code?: unknown; reason?: unknown; save?: unknown };
  if (r.status === "none") return allowNone ? undefined : "unexpected status none";
  if (r.status === "valid") return typeof r.save === "object" && r.save !== null ? undefined : "valid without save";
  if (r.status === "invalid") {
    if (typeof r.reason !== "string") return "invalid without reason";
    if (r.code !== "incompatible" && r.code !== "damaged") return `invalid with code ${String(r.code)}`;
    return undefined;
  }
  return `unknown status ${String(r.status)}`;
}

function pollutionProblem(): string | undefined {
  if (Object.getOwnPropertyNames(Object.prototype).sort().join("|") !== OBJECT_PROTO_KEYS) return "Object.prototype keys changed";
  if (({} as Record<string, unknown>).polluted !== undefined) return "Object.prototype polluted";
  return undefined;
}

function run(name: string, check: (rng: Rng, index: number) => string | undefined): void {
  const failures: string[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const seed = caseSeed(i);
    const rng = createLcg(seed);
    let problem: string | undefined;
    try {
      problem = check(rng, i) ?? pollutionProblem();
    } catch (error) {
      problem = `threw ${String(error)}`;
    }
    if (problem) failures.push(`[${name}] seed ${seed} case ${i}: ${problem}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[${name}] base seed 0x${BASE_SEED.toString(16)}, ${RUNS} cases, ${failures.length} failures`);
  expect(failures, failures.slice(0, 5).join("\n")).toEqual([]);
}

describe("Property 3: Save parsing is total and old versions are incompatible", () => {
  it(
    "parseSaveEnvelopeV3 never throws and returns a typed result for arbitrary values",
    () =>
      run("parse-arbitrary", (rng) => {
        const kind = randomInt(rng, 0, 4);
        const input =
          kind === 0
            ? randomJson(rng, 0)
            : kind === 1
              ? randomString(rng)
              : kind === 2
                ? deepNested(rng)
                : kind === 3
                  ? Array.from({ length: randomInt(rng, 1000, 60_000) }, () => ({ type: "OPEN_PHONE" }))
                  : { ...(randomJson(rng, 0) as object), formatVersion: pick(rng, [1, 2, 3, "3", null]) };
        const result = parseSaveEnvelopeV3(input);
        const bad = assertTyped(result, false);
        if (bad) return bad;
        if (result.status === "valid" && kind !== 4) return "arbitrary value parsed as valid";
        return undefined;
      }),
    TIMEOUT_MS,
  );

  it(
    "valid v3 envelopes are valid; mutated ones give a typed result and valid results re-parse identically",
    () =>
      run("parse-v3", (rng) => {
        const base = validV3(rng);
        const ok = parseSaveEnvelopeV3(JSON.parse(JSON.stringify(base)));
        if (ok.status !== "valid") return `valid v3 rejected: ${JSON.stringify(ok)}`;
        if (JSON.stringify(ok.save) !== JSON.stringify(base)) return "valid v3 was altered by parsing";

        const mutated = parseSaveEnvelopeV3(mutate(rng, base));
        const bad = assertTyped(mutated, false);
        if (bad) return bad;
        if (mutated.status === "valid") {
          const again = parseSaveEnvelopeV3(JSON.parse(JSON.stringify(mutated.save)));
          if (again.status !== "valid") return "valid result does not re-parse";
          if (Object.keys(mutated.save).sort().join() !== Object.keys(base).sort().join()) return "valid save has extra keys";
        }
        // Old formatVersion on an otherwise valid envelope is incompatible.
        const old = parseSaveEnvelopeV3({ ...base, formatVersion: pick(rng, [1, 2]) });
        if (old.status !== "invalid" || old.code !== "incompatible") return "old formatVersion not incompatible";
        return undefined;
      }),
    TIMEOUT_MS,
  );

  it(
    "read() is total for any v3 key content",
    () =>
      run("read-v3", (rng) => {
        const storage = new MemoryStorage();
        const text = randomText(rng);
        storage.setItem(SAVE_STORAGE_KEY_V3, text);
        const result = createLocalStorageSaveSource(() => asStorage(storage)).read();
        const bad = assertTyped(result, false);
        if (bad) return bad;
        if (storage.getItem(SAVE_STORAGE_KEY_V3) !== text) return "read() changed the v3 key";
        return undefined;
      }),
    TIMEOUT_MS,
  );

  it(
    "v1 and v2 keys without a v3 key are incompatible and are neither migrated nor deleted",
    () =>
      run("read-old", (rng) => {
        const storage = new MemoryStorage();
        const which = randomInt(rng, 0, 2); // 0: v1, 1: v2, 2: both
        if (which !== 1) storage.setItem(SAVE_STORAGE_KEY, validLookingOld(rng, 1));
        if (which !== 0) storage.setItem(SAVE_STORAGE_KEY_V2, validLookingOld(rng, 2));
        const before = JSON.stringify([...storage.map.entries()]);
        const source = createLocalStorageSaveSource(() => asStorage(storage));
        for (let i = 0; i < 2; i += 1) {
          const result = source.read();
          if (result.status !== "invalid" || result.code !== "incompatible") return `old save gave ${JSON.stringify(result)}`;
        }
        if (JSON.stringify([...storage.map.entries()]) !== before) return "old keys were migrated, changed or deleted";
        if (storage.getItem(SAVE_STORAGE_KEY_V3) !== null) return "a v3 key was created";
        return undefined;
      }),
    TIMEOUT_MS,
  );

  it(
    "a valid v3 key is valid even when old keys exist, and clear() removes v1, v2 and v3",
    () =>
      run("read-clear", (rng) => {
        const storage = new MemoryStorage();
        const save = validV3(rng);
        storage.setItem(SAVE_STORAGE_KEY_V3, JSON.stringify(save));
        if (rng() < 0.5) storage.setItem(SAVE_STORAGE_KEY, validLookingOld(rng, 1));
        if (rng() < 0.5) storage.setItem(SAVE_STORAGE_KEY_V2, validLookingOld(rng, 2));
        storage.setItem("unrelated", "keep");
        const source = createLocalStorageSaveSource(() => asStorage(storage));
        const result = source.read();
        if (result.status !== "valid") return `valid v3 gave ${JSON.stringify(result)}`;
        if (source.clear?.() !== true) return "clear() did not return true";
        for (const key of [SAVE_STORAGE_KEY, SAVE_STORAGE_KEY_V2, SAVE_STORAGE_KEY_V3]) {
          if (storage.getItem(key) !== null) return `clear() left ${key}`;
        }
        if (storage.getItem("unrelated") !== "keep") return "clear() removed an unrelated key";
        if (source.read().status !== "none") return "read() after clear() is not none";
        return undefined;
      }),
    TIMEOUT_MS,
  );

  it(
    "blocked or throwing storage yields a result, never an exception",
    () =>
      run("blocked-storage", (rng) => {
        const mode = randomInt(rng, 0, 3);
        const boom = (): never => {
          throw new Error("blocked");
        };
        const storage = {
          getItem: mode === 0 || mode === 3 ? boom : () => null,
          setItem: boom,
          removeItem: mode === 1 || mode === 3 ? boom : () => undefined,
        } as unknown as Storage;
        const source = createLocalStorageSaveSource(mode === 2 ? boom : () => storage);
        const read = source.read();
        const bad = assertTyped(read, true);
        if (bad) return bad;
        if (typeof source.write?.(validV3(rng)) !== "boolean") return "write() did not return a boolean";
        if (typeof source.clear?.() !== "boolean") return "clear() did not return a boolean";
        return undefined;
      }),
    TIMEOUT_MS,
  );

  it("an absent storage yields none", () => {
    const source = createLocalStorageSaveSource(() => undefined);
    expect(source.read()).toEqual({ status: "none" });
    expect(source.clear?.()).toBe(false);
  });
});
