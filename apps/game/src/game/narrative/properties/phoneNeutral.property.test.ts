// Feature: chapter-01-double-deception, Property 7: Opening and closing the phone never changes story facts
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { chapterReducer } from "../reducer";
import type { ChapterState, CoreAction } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const PHONE_NEUTRAL_SEED = (CORE_PROPERTY_SEED ^ 0x00070007) >>> 0;

const OPEN_PHONE: CoreAction = { type: "OPEN_PHONE" };
const CLOSE_PHONE: CoreAction = { type: "CLOSE_PHONE" };

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const SCENARIO = CHAPTER_1_SCENARIO;

/** Phone-records reading actions, taken from Scenario_Data. */
const PHONE_RECORD_ACTIONS = Object.values(SCENARIO.deviceActions).filter((def) => def.device === "phone");

/** Fields that hold story facts. Compared as JSON. */
function storyFacts(state: ChapterState): Record<string, string> {
  return {
    status: JSON.stringify(state.status),
    claims: JSON.stringify(state.claims),
    deductions: JSON.stringify(state.deductions),
    pressure: JSON.stringify(state.pressure),
    decision: JSON.stringify(state.decision),
    outcome: JSON.stringify(state.outcome),
    call: JSON.stringify(state.call),
    conversation: JSON.stringify(state.conversation),
    interacted: JSON.stringify(state.interacted),
  };
}

function differing(before: ChapterState, after: ChapterState, ignore: readonly string[] = []): string[] {
  const a = storyFacts(before);
  const b = storyFacts(after);
  return Object.keys(a).filter((key) => !ignore.includes(key) && a[key] !== b[key]);
}

describe("chapter core phone neutrality", () => {
  it(
    "opening and closing the phone changes only the phone flag and the event log",
    () => {
      let acceptedOpens = 0;
      let acceptedCloses = 0;
      const failures: string[] = [];

      const check = (state: ChapterState, action: CoreAction, where: string): ChapterState | null => {
        const result = chapterReducer(state, action, SCENARIO);
        if (!result.accepted) return null;
        if (action.type === "OPEN_PHONE") acceptedOpens += 1;
        else acceptedCloses += 1;
        const context = `${where}, ${action.type}`;
        const changed = differing(state, result.state);
        if (changed.length > 0) failures.push(`${context}: changed ${changed.join(", ")}`);
        if (JSON.stringify(result.state.flags) !== JSON.stringify(state.flags)) failures.push(`${context}: flags changed`);
        if (JSON.stringify(result.state.discovered) !== JSON.stringify(state.discovered)) failures.push(`${context}: evidence changed`);
        if (JSON.stringify(result.state.objectives) !== JSON.stringify(state.objectives)) failures.push(`${context}: objectives changed`);
        const entry = result.state.events.at(-1);
        if (!entry || entry.derived.objectivesActivated.length > 0 || entry.derived.objectivesCompleted.length > 0) {
          failures.push(`${context}: event log entry reports objective changes`);
        }
        return result.state;
      };

      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(PHONE_NEUTRAL_SEED, index);
        const next = createLcg(seed);
        const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
        const run = runSequence(generateActionSequence(seed, length), undefined, SCENARIO);
        run.states.forEach((state, step) => {
          const where = `seed ${seed} (case ${index}), step ${step}`;
          const opened = check(state, OPEN_PHONE, where);
          if (opened !== null) check(opened, CLOSE_PHONE, `${where}, after OPEN_PHONE`);
          check(state, CLOSE_PHONE, where);
        });
      }

      expect(failures, `seed base ${PHONE_NEUTRAL_SEED}; ${failures.length} failure(s):\n${failures.slice(0, 10).join("\n")}`).toEqual([]);
      expect(acceptedOpens, `seed base ${PHONE_NEUTRAL_SEED}`).toBeGreaterThan(0);
      expect(acceptedCloses, `seed base ${PHONE_NEUTRAL_SEED}`).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    "reading phone records changes only its authored flags and evidence",
    () => {
      expect(PHONE_RECORD_ACTIONS.length).toBeGreaterThan(0);
      let accepted = 0;
      const failures: string[] = [];

      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(PHONE_NEUTRAL_SEED, index);
        const next = createLcg(seed);
        const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
        const run = runSequence(generateActionSequence(seed, length), undefined, SCENARIO);
        run.states.forEach((state, step) => {
          for (const def of PHONE_RECORD_ACTIONS) {
            const result = chapterReducer(state, { type: "DEVICE_ACTION", deviceActionId: def.id }, SCENARIO);
            if (!result.accepted) continue;
            accepted += 1;
            const where = `seed ${seed} (case ${index}), step ${step}, ${def.id}`;
            const changed = differing(state, result.state);
            if (changed.length > 0) failures.push(`${where}: changed ${changed.join(", ")}`);

            const authoredFlags = new Set<string>(def.effects.flatMap((effect) => (effect.kind === "setFlag" ? [effect.flag] : [])));
            const before = state.flags as Record<string, unknown>;
            const after = result.state.flags as Record<string, unknown>;
            for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
              if (before[key] !== after[key] && !authoredFlags.has(key)) failures.push(`${where}: flag ${key} changed without an effect`);
            }
            const added = result.state.discovered.filter((id) => !state.discovered.includes(id));
            for (const id of added) {
              if (!def.reveals.includes(id)) failures.push(`${where}: evidence ${id} was added but is not revealed by the action`);
            }
            if (result.state.discovered.length < state.discovered.length) failures.push(`${where}: evidence was removed`);
          }
        });
      }

      expect(failures, `seed base ${PHONE_NEUTRAL_SEED}; ${failures.length} failure(s):\n${failures.slice(0, 10).join("\n")}`).toEqual([]);
      expect(accepted, `seed base ${PHONE_NEUTRAL_SEED}`).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});
