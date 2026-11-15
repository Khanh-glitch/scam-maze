// Feature: chapter-01-double-deception, Property 2: Save v3 round trip and tamper handling
// **Validates: Requirements 17.4, 17.5**
import { describe, expect, it } from "vitest";
import { getChapter } from "../chapters/chapterRegistry";
import { applyRestoredProgress, restoreChapterSession } from "../chapters/chapterSession";
import { isCoreAction } from "../narrative/reducer";
import type { ChapterState, CoreAction } from "../narrative/types";
import {
  assertInvariants,
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  MALFORMED_ACTIONS,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
} from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { encodeProgress } from "./chapterProgress";
import {
  createLocalStorageSaveSource,
  parseSaveEnvelopeV3,
  SAVE_CONTENT_VERSION,
  SAVE_FORMAT_VERSION_V3,
  SAVE_MAX_ACTIONS,
  SAVE_STORAGE_KEY_V3,
  type SavedPlayerPose,
} from "./saveGame";

/** Number of tampered saves that must be checked (design: at least 200). */
const TAMPER_RUNS = Math.max(200, CORE_PROPERTY_RUNS);
/** Upper bound on generation attempts, so a run of still-valid tampers cannot loop forever. */
const MAX_ATTEMPTS = TAMPER_RUNS * 20;
const SEED = (CORE_PROPERTY_SEED ^ 0x5a7e0013) >>> 0;
const CHAPTER_ID = "chapter-1";

const TAMPER_KINDS = [
  "wrong-format-version",
  "wrong-content-version",
  "wrong-type",
  "unknown-action",
  "rejected-action",
  "reorder",
  "non-finite-pose",
  "exceed-cap",
  "proto-keys",
  "truncated-json",
  "wrong-scene-or-chapter",
] as const;
type TamperKind = (typeof TAMPER_KINDS)[number];

type Envelope = Record<string, unknown> & { progress: Record<string, unknown> & { actions: unknown[] } };

interface ValidSave {
  envelope: Envelope;
  /** Accepted actions of the source run; `states[i]` is the state before `actions[i]`. */
  actions: CoreAction[];
  states: ChapterState[];
}

/** Input to the loader: a parsed value, or the raw text stored under the v3 key. */
type Input = { obj: unknown } | { text: string };

type Expectation =
  | { type: "invalid"; code: "incompatible" | "damaged" }
  | { type: "no-chapter" }
  | { type: "session-rejected" }
  | { type: "replay-failed" }
  | { type: "trimmed"; acceptedActions: number; state: ChapterState }
  | { type: "any" };

type Outcome =
  | { stage: "invalid"; code: string | undefined }
  | { stage: "no-chapter" }
  | { stage: "session-rejected" }
  | { stage: "replay-failed" }
  | { stage: "restored"; state: ChapterState; trimmed: boolean; acceptedActions: number };

/** Builds a valid v3 envelope from a random run, via `encodeProgress`. */
function generateValidSave(next: () => number): ValidSave {
  const raw = generateActionSequence(Math.floor(next() * 0x1_0000_0000), randomInt(next, 1, CORE_SEQUENCE_MAX_LENGTH));
  const run = runSequence(raw);
  const pose: SavedPlayerPose | null =
    next() < 0.3 ? null : { position: [randomInt(next, 1, 230), randomInt(next, 1, 100), randomInt(next, 1, 120)], yaw: 1.5 };
  const progress = encodeProgress(run.final, pose, pick(next, ["start", "debrief", "obj.stay-calm"]));
  if (progress === null) throw new Error("encodeProgress returned null for a run below the action cap.");
  const actions = progress.actions;
  return {
    envelope: {
      formatVersion: SAVE_FORMAT_VERSION_V3,
      contentVersion: SAVE_CONTENT_VERSION,
      chapterId: CHAPTER_ID,
      sceneId: pick(next, ["apartment", "street"] as const),
      savedAt: new Date(Date.UTC(2026, 10, randomInt(next, 1, 28))).toISOString(),
      progress: { ...progress, actions: [...actions] },
    },
    actions,
    states: runSequence(actions).states,
  };
}

/** The loader's continue path: parse, chapter lookup, session check, lenient replay. */
function load(input: Input): Outcome {
  let parsed;
  if ("text" in input) {
    const store = new Map<string, string>([[SAVE_STORAGE_KEY_V3, input.text]]);
    const storage = { getItem: (key: string) => store.get(key) ?? null } as unknown as Storage;
    const read = createLocalStorageSaveSource(() => storage).read();
    if (read.status === "none") throw new Error("a stored v3 text must never read as none");
    parsed = read;
  } else {
    parsed = parseSaveEnvelopeV3(input.obj);
  }
  if (parsed.status !== "valid") return { stage: "invalid", code: parsed.code };
  const chapter = getChapter(parsed.save.chapterId);
  if (!chapter) return { stage: "no-chapter" };
  const session = restoreChapterSession(chapter, parsed.save);
  if (!session.ok) return { stage: "session-rejected" };
  const applied = applyRestoredProgress(session.session);
  if (!applied.ok) return { stage: "replay-failed" };
  const restored = applied.session.restored;
  if (restored === undefined) throw new Error("applyRestoredProgress returned no restored state");
  const progress = applied.session.progress;
  const total = progress === undefined ? 0 : progress.actions.length;
  const trimmed = applied.session.saveTrimmed === true;
  return {
    stage: "restored",
    state: restored.state,
    trimmed,
    acceptedActions: trimmed ? restored.state.events.length : total,
  };
}

/** True when replaying `actions` from the initial state rejects at least one of them. */
function firstRejected(actions: readonly unknown[]): number {
  return runSequence(actions).results.findIndex((result) => !result.accepted);
}

function withActions(save: ValidSave, actions: unknown[]): Envelope {
  return { ...save.envelope, progress: { ...save.envelope.progress, actions } };
}

function withProgress(save: ValidSave, patch: Record<string, unknown>): Envelope {
  return { ...save.envelope, progress: { ...save.envelope.progress, ...patch } };
}

function trimmedExpectation(actions: unknown[]): Expectation | null {
  const k = firstRejected(actions);
  if (k === -1) return null;
  return { type: "trimmed", acceptedActions: k, state: runSequence(actions).states[k] };
}

interface Tampered {
  input: Input;
  expect: Expectation;
}

/** Applies one tamper. Returns `null` when it cannot apply or the result is still fully valid. */
function tamper(kind: TamperKind, save: ValidSave, next: () => number): Tampered | null {
  const { actions, envelope } = save;
  const damaged: Expectation = { type: "invalid", code: "damaged" };
  switch (kind) {
    case "wrong-format-version": {
      const value = pick(next, [0, 1, 2, "3", 2.5, null, 4, undefined]);
      return { input: { obj: { ...envelope, formatVersion: value } }, expect: { type: "invalid", code: "incompatible" } };
    }
    case "wrong-content-version": {
      if (next() < 0.5) {
        const value = pick(next, ["ch1-double-deception-0", "", "ch1-the-urgent-call-1", "ch1-double-deception-2", " "]);
        return { input: { obj: { ...envelope, contentVersion: value } }, expect: { type: "invalid", code: "incompatible" } };
      }
      const value = pick(next, [1, null, undefined, {}, [], true]);
      return { input: { obj: { ...envelope, contentVersion: value } }, expect: damaged };
    }
    case "wrong-type": {
      const options: Array<() => unknown> = [
        () => ({ ...envelope, chapterId: pick(next, [1, "", null, {}]) }),
        () => ({ ...envelope, sceneId: pick(next, ["nowhere", 5, null, "Street"]) }),
        () => ({ ...envelope, savedAt: pick(next, ["not a date", 5, "", null]) }),
        () => ({ ...envelope, progress: pick(next, [null, [], "x", 5, undefined]) }),
        () => withProgress(save, { checkpointId: pick(next, ["", 5, null]) }),
        () => withProgress(save, { actions: pick(next, ["x", {}, null, 5]) }),
        () =>
          withProgress(save, {
            playerPose: pick(next, [
              { position: [1, 2], yaw: 0 },
              { position: ["1", 2, 3], yaw: 0 },
              { position: [1, 2, 3] },
              { position: [1, 2, 3], yaw: "0" },
              "x",
              undefined,
              [],
            ]),
          }),
        () => pick(next, [null, [], 5, "x", true, undefined]),
      ];
      return { input: { obj: pick(next, options)() }, expect: damaged };
    }
    case "unknown-action": {
      const bad = pick(next, [
        ...MALFORMED_ACTIONS,
        { type: "INTERACT_OBJECT", objectId: "__proto__" },
        { type: "INSPECT_EVIDENCE", evidenceId: "constructor" },
        { type: "__proto__" },
        { type: "toString" },
      ]);
      const index = randomInt(next, 0, actions.length);
      const tampered = [...actions.slice(0, index), bad, ...actions.slice(index)];
      const useText = next() < 0.5;
      const input: Input = useText ? { text: JSON.stringify(withActions(save, tampered)) } : { obj: withActions(save, tampered) };
      return { input, expect: isCoreAction(bad) ? { type: "any" } : damaged };
    }
    case "rejected-action": {
      // Re-use an action that this very save already knows is valid, but in the wrong place.
      const donor = actions.length > 0 ? pick(next, actions) : ({ type: "FINISH_CHAPTER" } as CoreAction);
      const options: CoreAction[] = [donor, { type: "START_CHAPTER" }, { type: "FINISH_CHAPTER" }, { type: "ANSWER_CALL" }];
      const index = randomInt(next, 0, actions.length);
      const tampered = [...actions.slice(0, index), pick(next, options), ...actions.slice(index)];
      const expected = trimmedExpectation(tampered);
      return expected === null ? null : { input: { obj: withActions(save, tampered) }, expect: expected };
    }
    case "reorder": {
      if (actions.length < 2) return null;
      const i = randomInt(next, 0, actions.length - 2);
      const j = randomInt(next, i + 1, actions.length - 1);
      const tampered: unknown[] = [...actions];
      [tampered[i], tampered[j]] = [tampered[j], tampered[i]];
      const expected = trimmedExpectation(tampered);
      return expected === null ? null : { input: { obj: withActions(save, tampered) }, expect: expected };
    }
    case "non-finite-pose": {
      const bad = pick(next, [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]);
      const position: [number, number, number] = [1, 2, 3];
      let yaw = 1;
      const slot = randomInt(next, 0, 3);
      if (slot === 3) yaw = bad;
      else position[slot] = bad;
      return { input: { obj: withProgress(save, { playerPose: { position, yaw } }) }, expect: { type: "replay-failed" } };
    }
    case "exceed-cap": {
      const filler = Array.from({ length: SAVE_MAX_ACTIONS + 1 - actions.length + randomInt(next, 0, 5) }, () => ({
        type: "OPEN_PHONE",
      }));
      return { input: { obj: withActions(save, [...actions, ...filler]) }, expect: damaged };
    }
    case "proto-keys": {
      const poisoned = JSON.parse('{"type":"OPEN_PHONE","__proto__":{"polluted":true},"constructor":{"polluted":true}}') as unknown;
      const index = randomInt(next, 0, actions.length);
      const text = JSON.stringify({ ...envelope, progress: { ...envelope.progress, actions: [...actions.slice(0, index), poisoned, ...actions.slice(index)] } });
      const injected = text.replace(
        '{"formatVersion"',
        pick(next, ['{"__proto__":{"polluted":true},"formatVersion"', '{"constructor":{"prototype":{"polluted":true}},"formatVersion"']),
      );
      return { input: { text: injected }, expect: { type: "any" } };
    }
    case "truncated-json": {
      const text = JSON.stringify(envelope);
      return { input: { text: text.slice(0, randomInt(next, 0, text.length - 1)) }, expect: damaged };
    }
    case "wrong-scene-or-chapter": {
      if (next() < 0.5) {
        const chapterId = pick(next, ["chapter-2", "chapter-01", "CHAPTER-1", " chapter-1"]);
        return { input: { obj: { ...envelope, chapterId } }, expect: { type: "no-chapter" } };
      }
      const sceneId = pick(next, ["main-menu", "intro-prologue"]);
      return { input: { obj: { ...envelope, sceneId } }, expect: { type: "session-rejected" } };
    }
  }
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 120_000;

describe("chapter progress save v3 tamper handling", () => {
  it("never throws, returns the right code or a trimmed replay, and only yields reachable states", () => {
    const next = createLcg(SEED);
    const counts = Object.fromEntries(TAMPER_KINDS.map((kind) => [kind, 0])) as Record<TamperKind, number>;
    let checked = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && checked < TAMPER_RUNS; attempt += 1) {
      const seed = caseSeed(Math.floor(next() * 0x1_0000_0000), attempt);
      const caseNext = createLcg(seed);
      const save = generateValidSave(caseNext);
      const kind = TAMPER_KINDS[checked % TAMPER_KINDS.length];
      const label = `seed=${seed} case=${checked} attempt=${attempt} kind=${kind}`;

      // The untampered save must load fully, so any change below is caused by the tamper.
      const clean = load({ obj: save.envelope });
      expect(clean.stage, `${label}: untampered save`).toBe("restored");
      if (clean.stage === "restored") {
        expect(clean.trimmed, `${label}: untampered save trimmed`).toBe(false);
        expect(clean.state, `${label}: untampered state`).toEqual(save.states[save.states.length - 1]);
      }

      const tampered = tamper(kind, save, caseNext);
      if (tampered === null) continue;

      let outcome: Outcome;
      try {
        outcome = load(tampered.input);
      } catch (error) {
        throw new Error(`${label} threw: ${String(error)}`);
      }
      const shown = "obj" in tampered.input ? describeAction(tampered.input.obj).slice(0, 300) : tampered.input.text.slice(0, 300);
      const info = `${label}: ${shown}`;

      expect(({} as Record<string, unknown>).polluted, `${info}: prototype polluted`).toBeUndefined();

      const want = tampered.expect;
      switch (want.type) {
        case "invalid":
          expect(outcome, info).toEqual({ stage: "invalid", code: want.code });
          break;
        case "no-chapter":
        case "session-rejected":
        case "replay-failed":
          expect(outcome, info).toEqual({ stage: want.type });
          break;
        case "trimmed":
          expect(outcome.stage, info).toBe("restored");
          if (outcome.stage === "restored") {
            expect(outcome.trimmed, info).toBe(true);
            expect(outcome.acceptedActions, info).toBe(want.acceptedActions);
            expect(outcome.state, info).toEqual(want.state);
          }
          break;
        case "any":
          break;
      }

      // Whatever came back, a restored state is one the reducer can reach from the start.
      if (outcome.stage === "restored") {
        expect(assertInvariants(outcome.state), `${info}: invariants`).toEqual([]);
        const replay = runSequence(outcome.state.events.map((entry) => entry.action));
        expect(
          replay.results.every((result) => result.accepted),
          `${info}: events replay`,
        ).toBe(true);
        expect(replay.final, `${info}: events replay state`).toEqual(outcome.state);
      } else {
        expect(["invalid", "no-chapter", "session-rejected", "replay-failed"], info).toContain(outcome.stage);
      }

      counts[kind] += 1;
      checked += 1;
    }

    expect(checked, `seed=${SEED}`).toBeGreaterThanOrEqual(TAMPER_RUNS);
    for (const kind of TAMPER_KINDS) expect(counts[kind], `${kind} (seed=${SEED})`).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});
