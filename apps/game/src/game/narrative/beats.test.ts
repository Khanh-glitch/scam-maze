import { describe, expect, it } from "vitest";
import { FIXTURE_SCENARIO, fixtureState } from "../../test/fixtureScenario";
import type { FlagId } from "./chapter1/ids";
import { MAX_BEAT_PASSES, applyBeats, beatTag } from "./beats";
import type { BeatDef, CallRecord, ChapterState, EventLogEntry, ScenarioDefinition } from "./types";

const flag = (name: string) => name as FlagId;

function withBeats(beats: BeatDef[]): ScenarioDefinition {
  return { ...FIXTURE_SCENARIO, beats };
}

function declinedAlex(state: ChapterState): ChapterState {
  const record: CallRecord = {
    callId: "call.alex",
    direction: "incoming",
    displayName: "Alex",
    number: "+000 0100 2200",
    status: "declined",
    ringCount: 1,
  };
  return { ...state, call: { ...state.call, log: [record] } };
}

function eventWithTag(tag: string): EventLogEntry {
  return {
    seq: 0,
    action: { type: "OPEN_PHONE" },
    derived: { evidence: [], flags: [], resources: {}, persistent: [], objectivesActivated: [], objectivesCompleted: [], debriefTags: [tag] },
  };
}

describe("applyBeats", () => {
  it("does nothing while the conditions do not hold", () => {
    const state = fixtureState();
    const result = applyBeats(state, FIXTURE_SCENARIO);
    expect(result.state).toBe(state);
    expect(result.fired).toEqual([]);
  });

  it("fires the fixture beat when its conditions hold and does not mutate the input", () => {
    const state = declinedAlex(fixtureState());
    const result = applyBeats(state, FIXTURE_SCENARIO);
    expect(result.fired).toEqual(["beat.notification"]);
    expect(result.state.flags[flag("notification_delivered")]).toBe(true);
    expect(state.flags[flag("notification_delivered")]).not.toBe(true);
  });

  it("does not fire a beat already recorded in the event log", () => {
    const beat: BeatDef = { id: "beat.once", when: [], effects: [{ kind: "addPressure" }] };
    const scenario = withBeats([beat]);
    const first = applyBeats(fixtureState(), scenario);
    expect(first.state.pressure).toBe(1);
    const logged = { ...fixtureState(), events: [eventWithTag(beatTag("beat.once"))] };
    const again = applyBeats(logged, scenario);
    expect(again.fired).toEqual([]);
    expect(again.state.pressure).toBe(0);
  });

  it("fires each beat once per call even when its conditions keep holding", () => {
    const scenario = withBeats([{ id: "beat.p", when: [], effects: [{ kind: "addPressure" }] }]);
    const result = applyBeats(fixtureState(), scenario);
    expect(result.fired).toEqual(["beat.p"]);
    expect(result.state.pressure).toBe(1);
  });

  it("applies beats in scenario order, chaining within one pass", () => {
    const scenario = withBeats([
      { id: "beat.a", when: [], effects: [{ kind: "setFlag", flag: flag("flag_a") }] },
      { id: "beat.b", when: [{ kind: "flag", flag: flag("flag_a") }], effects: [{ kind: "setFlag", flag: flag("flag_b") }] },
    ]);
    const result = applyBeats(fixtureState(), scenario);
    expect(result.fired).toEqual(["beat.a", "beat.b"]);
  });

  it("stops after the pass limit when beats are listed against their dependency order", () => {
    const count = MAX_BEAT_PASSES + 2;
    // Beat i needs flag i-1, but the list is reversed, so one beat fires per pass.
    const beats: BeatDef[] = [];
    for (let i = count; i >= 1; i -= 1) {
      beats.push({
        id: `beat.${i}`,
        when: i === 1 ? [] : [{ kind: "flag", flag: flag(`flag_${i - 1}`) }],
        effects: [{ kind: "setFlag", flag: flag(`flag_${i}`) }],
      });
    }
    const result = applyBeats(fixtureState(), withBeats(beats));
    expect(MAX_BEAT_PASSES).toBe(8);
    expect(result.fired).toEqual(Array.from({ length: 8 }, (_, i) => `beat.${i + 1}`));
    expect(result.state.flags[flag("flag_8")]).toBe(true);
    expect(result.state.flags[flag("flag_9")]).not.toBe(true);
  });
});
