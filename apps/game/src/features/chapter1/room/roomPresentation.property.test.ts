// Feature: chapter-01-double-deception, Property 17: Presentation commands depend only on state
// Validates: Requirements 2.4, 6.1
import { describe, expect, it } from "vitest";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { enumerateCandidateActions } from "../../../game/narrative/selectors";
import type { ChapterState, CoreAction } from "../../../game/narrative/types";
import { FIXTURE_SCENARIO } from "../../../test/fixtureScenario";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import {
  applyPresentation,
  LAPTOP_FRAME_KEYS,
  roomPresentation,
  type PresentationSink,
  type RoomPresentation,
} from "./roomPresentation";

const SEED = 0x17_2026;
const CASES = 250;
const WALK_MAX = 30;
const TIMEOUT_MS = 60_000;

type Command = readonly [string, unknown];

function recordingSink(): { sink: PresentationSink; commands: Command[] } {
  const commands: Command[] = [];
  const sink: PresentationSink = {
    setPhoneMode: (mode) => void commands.push(["setPhoneMode", mode]),
    ring: (on) => void commands.push(["ring", on]),
    setLaptopFrame: (frame) => void commands.push(["setLaptopFrame", frame]),
    chime: () => void commands.push(["chime", undefined]),
    setMood: (mood) => void commands.push(["setMood", mood]),
  };
  return { sink, commands };
}

function walk(actionsSeed: number): { actions: CoreAction[]; states: ChapterState[] } {
  const next = createLcg(actionsSeed);
  const length = randomInt(next, 0, WALK_MAX);
  let state = createInitialState(FIXTURE_SCENARIO);
  const states = [state];
  const actions: CoreAction[] = [];
  for (let step = 0; step < length; step += 1) {
    const candidates = enumerateCandidateActions(state, FIXTURE_SCENARIO);
    if (candidates.length === 0) break;
    const action = pick(next, candidates);
    actions.push(action);
    state = chapterReducer(state, action, FIXTURE_SCENARIO).state;
    states.push(state);
  }
  return { actions, states };
}

function replay(actions: readonly CoreAction[]): ChapterState[] {
  let state = createInitialState(FIXTURE_SCENARIO);
  const states = [state];
  for (const action of actions) {
    state = chapterReducer(state, action, FIXTURE_SCENARIO).state;
    states.push(state);
  }
  return states;
}

function expectedCommands(prev: RoomPresentation, next: RoomPresentation): Command[] {
  const expected: Command[] = [];
  if (prev.phoneMode !== next.phoneMode) expected.push(["setPhoneMode", next.phoneMode]);
  if (prev.ringing !== next.ringing) expected.push(["ring", next.ringing]);
  if (JSON.stringify(prev.laptopFrame) !== JSON.stringify(next.laptopFrame)) {
    expected.push(["setLaptopFrame", next.laptopFrame]);
  }
  const becameNew =
    next.laptopFrame?.badgeKey === LAPTOP_FRAME_KEYS.new.badgeKey &&
    prev.laptopFrame?.badgeKey !== LAPTOP_FRAME_KEYS.new.badgeKey;
  if (becameNew) expected.push(["chime", undefined]);
  if (prev.mood !== next.mood) expected.push(["setMood", next.mood]);
  return expected;
}

describe("Property 17: presentation commands depend only on state", () => {
  it(
    `holds for ${CASES} seeded random reachable states (seed ${SEED})`,
    () => {
      const seedNext = createLcg(SEED);
      let sawChime = false;
      let sawNewFrame = false;
      for (let index = 0; index < CASES; index += 1) {
        const caseSeed = Math.floor(seedNext() * 0xffff_ffff);
        const context = `seed=${SEED} caseSeed=${caseSeed} caseIndex=${index}`;
        try {
          const { actions, states } = walk(caseSeed);
          const rebuilt = replay(actions);
          const a = states[randomInt(createLcg(caseSeed ^ 1), 0, states.length - 1)];
          const b = states[randomInt(createLcg(caseSeed ^ 2), 0, states.length - 1)];
          const aIndex = states.indexOf(a);

          // Deterministic for equal, independently built states.
          const pa = roomPresentation(a, FIXTURE_SCENARIO);
          expect(roomPresentation(rebuilt[aIndex], FIXTURE_SCENARIO)).toEqual(pa);
          expect(roomPresentation(structuredClone(a), FIXTURE_SCENARIO)).toEqual(pa);

          // Does not mutate its input.
          const snapshot = structuredClone(a);
          roomPresentation(a, FIXTURE_SCENARIO);
          expect(a).toEqual(snapshot);

          // Applying the same presentation issues no commands.
          const same = recordingSink();
          applyPresentation(pa, structuredClone(pa), same.sink);
          expect(same.commands).toEqual([]);

          // Issues exactly the commands whose fields differ; chime only on transition to "new".
          const pb = roomPresentation(b, FIXTURE_SCENARIO);
          const diff = recordingSink();
          applyPresentation(pa, pb, diff.sink);
          expect(diff.commands).toEqual(expectedCommands(pa, pb));
          if (diff.commands.some(([name]) => name === "chime")) {
            sawChime = true;
            expect(pb.laptopFrame?.badgeKey).toBe(LAPTOP_FRAME_KEYS.new.badgeKey);
          }
          if (pa.laptopFrame?.badgeKey === LAPTOP_FRAME_KEYS.new.badgeKey) sawNewFrame = true;

          // Consecutive states along the walk obey the same rule.
          for (let step = 1; step < states.length; step += 1) {
            const before = roomPresentation(states[step - 1], FIXTURE_SCENARIO);
            const after = roomPresentation(states[step], FIXTURE_SCENARIO);
            const stepSink = recordingSink();
            applyPresentation(before, after, stepSink.sink);
            expect(stepSink.commands).toEqual(expectedCommands(before, after));
          }

          // First call sends everything except the chime.
          const first = recordingSink();
          applyPresentation(null, pa, first.sink);
          expect(first.commands.map(([name]) => name)).toEqual([
            "setPhoneMode",
            "ring",
            "setLaptopFrame",
            "setMood",
          ]);
        } catch (error) {
          throw new Error(`Property 17 failed (${context}): ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
          });
        }
      }
      // Sanity: the generator reached the "new" badge state at least once.
      expect(sawNewFrame || sawChime).toBe(true);
    },
    TIMEOUT_MS,
  );
});
