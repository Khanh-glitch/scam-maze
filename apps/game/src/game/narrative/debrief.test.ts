import { describe, expect, it } from "vitest";
import { FIXTURE_SCENARIO, fixtureState, withFlags } from "../../test/fixtureScenario";
import { beatTag } from "./beats";
import type { EvidenceId, FlagId, OutcomeId } from "./chapter1/ids";
import { buildDebrief } from "./debrief";
import type { ChapterState, CoreAction, EventLogEntry } from "./types";

function entry(seq: number, action: CoreAction, debriefTags: string[], evidence: EvidenceId[] = []): EventLogEntry {
  return {
    seq,
    action,
    derived: { evidence, flags: [], resources: {}, persistent: [], objectivesActivated: [], objectivesCompleted: [], debriefTags },
  };
}

function ended(
  events: EventLogEntry[],
  outcome: OutcomeId,
  flags: FlagId[] = [],
  extra: Partial<ChapterState> = {},
): ChapterState {
  const discovered = events.flatMap((e) => e.derived.evidence);
  return withFlags(fixtureState({ events, outcome, status: "ended", discovered, ...extra }), flags);
}

const PATH_EVENTS: EventLogEntry[] = [
  entry(0, { type: "START_CHAPTER" }, []),
  entry(1, { type: "SELECT_DIALOGUE_OPTION", optionId: "alex.share-code" }, ["shared-code"]),
  entry(2, { type: "DEVICE_ACTION", deviceActionId: "dev.inspect-notification-origin" }, [
    "inspected-origin",
    beatTag("beat.notification"),
  ], ["ev.notification-metadata" as EvidenceId]),
  entry(3, { type: "OPEN_PHONE" }, []),
  entry(4, { type: "MAKE_DECISION", decision: "follow-recovery" }, ["followed-recovery"]),
];

describe("buildDebrief timeline", () => {
  it("returns null without an outcome", () => {
    expect(buildDebrief(fixtureState(), FIXTURE_SCENARIO)).toBeNull();
  });

  it("has one entry per tagged action in seq order with the matching kind", () => {
    const view = buildDebrief(ended(PATH_EVENTS, "false-victory", ["code_shared", "money_moved"]), FIXTURE_SCENARIO);
    expect(view?.timeline.map((e) => [e.seq, e.kind, e.tag])).toEqual([
      [1, "call", "shared-code"],
      [2, "device", "inspected-origin"],
      [4, "decision", "followed-recovery"],
    ]);
    expect(view?.timeline[0].text).toBe("A code was shared.");
  });

  it("excludes beat tags and uses an empty text for a tag without a note", () => {
    const events = [
      entry(0, { type: "OPEN_PHONE" }, [beatTag("beat.notification")]),
      entry(1, { type: "COMBINE_EVIDENCE", evidenceIds: [] }, ["unknown-tag"]),
    ];
    const view = buildDebrief(ended(events, "unfinished-case"), FIXTURE_SCENARIO);
    expect(view?.timeline).toEqual([{ seq: 1, kind: "deduction", tag: "unknown-tag", text: "" }]);
  });
});

describe("buildDebrief evidence", () => {
  it("lists only discovered evidence as found and keeps missed clues separate", () => {
    const view = buildDebrief(ended(PATH_EVENTS, "false-victory"), FIXTURE_SCENARIO);
    const found = view?.evidenceFound.map((e) => e.id) ?? [];
    const missed = view?.cluesMissed.map((c) => c.id) ?? [];
    expect(found).toEqual(["ev.notification-metadata"]);
    expect(missed.length).toBeGreaterThan(0);
    expect(missed.filter((id) => found.includes(id))).toEqual([]);
    expect(missed).not.toContain("ev.notification-metadata");
  });
});

describe("buildDebrief analysis", () => {
  const trap = (flags: FlagId[]) =>
    buildDebrief(ended(PATH_EVENTS, "unfinished-case", flags), FIXTURE_SCENARIO)?.analysis;

  it("reports the trap entered per path", () => {
    expect(trap([])?.trapEntered).toBe("none");
    expect(trap(["code_shared"])?.trapEntered).toBe("first");
    expect(trap(["second_caller_trusted"])?.trapEntered).toBe("second");
    expect(trap(["money_moved"])?.trapEntered).toBe("second");
    expect(trap(["code_shared", "money_moved"])?.trapEntered).toBe("both");
    expect(trap(["code_shared", "money_moved"])?.trapNote).toBe("You shared the code and then trusted the second caller.");
  });

  it("fills every analysis section from scenario text and never marks the third caller independent", () => {
    const analysis = trap([]);
    expect(analysis?.thirdCallerIndependent).toBe(false);
    expect(analysis?.pressureBuilt).not.toBe("");
    expect(analysis?.whyWarningLooked).not.toBe("");
    expect(analysis?.thirdCallerNote ?? "").toBeDefined();
    expect(analysis?.verifyNextTime).toEqual(FIXTURE_SCENARIO.debrief.analysis.verifyNextTime);
  });

  describe("third caller (P2-6)", () => {
    const withCall = (status: "answered" | "declined" | "missed" | "ended" | null) =>
      buildDebrief(
        ended(PATH_EVENTS, "unfinished-case", [], {
          call: {
            current: null,
            status: "ended",
            log:
              status === null
                ? []
                : [{ callId: "call.recovery", direction: "incoming", displayName: "X", number: "+0001", status, ringCount: 1 }],
          },
        }),
        FIXTURE_SCENARIO,
      )?.analysis;

    it.each(["answered", "ended"] as const)("includes the note when the call was %s", (status) => {
      const analysis = withCall(status);
      expect(analysis?.thirdCallerEncountered).toBe(true);
      expect(analysis?.thirdCallerNote).toBe(FIXTURE_SCENARIO.debrief.analysis.thirdCallerNote);
    });

    it.each(["declined", "missed", null] as const)("has no note when the call was %s", (status) => {
      const analysis = withCall(status);
      expect(analysis?.thirdCallerEncountered).toBe(false);
      expect(analysis?.thirdCallerNote).toBeNull();
    });
  });

  it("reports pressure and signs of discovered evidence only", () => {
    const state = ended(PATH_EVENTS, "unfinished-case", [], { pressure: 2 });
    const analysis = buildDebrief(state, FIXTURE_SCENARIO)?.analysis;
    expect(analysis?.pressureLevel).toBe(2);
    const expected = FIXTURE_SCENARIO.evidence["ev.notification-metadata" as EvidenceId].warningSigns;
    expect(analysis?.unverifiedSignals.map((s) => s.id)).toEqual(expected);
  });
});
