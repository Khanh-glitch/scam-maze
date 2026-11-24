// The clock rule, as a contract. These are the cases that decide whether Mission 02 feels like a
// world with a schedule or like a game waiting for the player.
import { describe, expect, it } from "vitest";
import { CLOCK_RUNNING_OVERLAYS, clockRunsNow, type ClockDecision } from "./clockRule";

const base: ClockDecision = {
  started: true,
  playing: true,
  hostPaused: false,
  introOpen: false,
  inspecting: false,
  extensionBlocking: false,
  overlays: [],
  callOpen: false,
  callActive: false,
  legacyTimedStory: false,
  freeRoam: true,
};

const run = (patch: Partial<ClockDecision>) => clockRunsNow({ ...base, ...patch });

describe("the world clock", () => {
  it("runs when Alex is doing nothing at all", () => {
    expect(run({})).toBe(true);
  });

  it("keeps running while the phone is open — reading a message is not a pause", () => {
    expect(run({ overlays: ["phone"] })).toBe(true);
    expect(run({ overlays: ["laptop"] })).toBe(true);
  });

  it("keeps running while a call rings — hesitating has a price", () => {
    expect(run({ overlays: [], callOpen: true, callActive: false })).toBe(true);
  });

  it("stops while a call is actually being talked through", () => {
    expect(run({ callOpen: true, callActive: true })).toBe(false);
  });

  it("stops for the game's own screens, not the world's", () => {
    for (const kind of ["planner", "journal", "tasks", "inspection", "pause", "ending", "decision", "debrief"]) {
      expect(run({ overlays: [kind] }), kind).toBe(false);
    }
  });

  it("stops for the story's own moments", () => {
    expect(run({ introOpen: true })).toBe(false);
    expect(run({ hostPaused: true })).toBe(false);
    expect(run({ inspecting: true })).toBe(false);
    expect(run({ extensionBlocking: true })).toBe(false);
    expect(run({ playing: false })).toBe(false);
    expect(run({ started: false })).toBe(false);
  });

  it("only lets the two devices run time", () => {
    expect(CLOCK_RUNNING_OVERLAYS).toEqual(["phone", "laptop"]);
  });

  it("keeps the parked story on its old rule: only an empty free room moves time", () => {
    const legacy = { legacyTimedStory: true };
    expect(run(legacy)).toBe(true);
    // The host computes `freeRoam` itself, so an open phone is already not free.
    expect(run({ ...legacy, overlays: ["phone"], freeRoam: false })).toBe(false);
    expect(run({ ...legacy, callOpen: true, freeRoam: false })).toBe(false);
    expect(run({ ...legacy, freeRoam: false })).toBe(false);
  });
});
