// The journey map is derived from the scenario, so these tests check the derivation, not authored
// copies: the spine of the chapter, the missions that exist today, the planned ones, and the code
// map (every path it names must be a real file).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAPTER_DURATION_MINUTES, PERSISTENT_FLAG_IDS } from "../resources";
import { LAST_SUBMISSION_SCENARIO } from "./lastSubmission";
import { CHAPTER_1_CODE_MAP, buildScenarioJourney, journeyClock, journeyDayBands, summarizeEffect } from "./journey";

const JOURNEY = buildScenarioJourney(LAST_SUBMISSION_SCENARIO);
/** Vitest runs with the game app as its working directory; every path below is relative to it. */
const APP_ROOT = process.cwd();

describe("journey clock", () => {
  it("starts on Tuesday 17:00 and ends on Friday 17:00", () => {
    expect(journeyClock(0)).toEqual({ minutes: 0, isoWeekday: 2, hour: 17, minute: 0 });
    expect(journeyClock(CHAPTER_DURATION_MINUTES)).toEqual({ minutes: CHAPTER_DURATION_MINUTES, isoWeekday: 5, hour: 17, minute: 0 });
  });

  it("splits the 72 hours into four day bands at midnight", () => {
    expect(journeyDayBands()).toEqual([
      { isoWeekday: 2, startMinute: 0, endMinute: 420 },
      { isoWeekday: 3, startMinute: 420, endMinute: 1860 },
      { isoWeekday: 4, startMinute: 1860, endMinute: 3300 },
      { isoWeekday: 5, startMinute: 3300, endMinute: 4320 },
    ]);
  });

  it("clamps a minute outside the chapter instead of returning an impossible clock", () => {
    expect(journeyClock(-30).minutes).toBe(0);
    expect(journeyClock(CHAPTER_DURATION_MINUTES + 60).minutes).toBe(CHAPTER_DURATION_MINUTES);
  });
});

describe("the missions that exist today", () => {
  it("lists every mission of the routed scenario, in data order", () => {
    expect(JOURNEY.missions.map((mission) => mission.id)).toEqual([
      "m01.missing-access",
      "m01.final-submission",
      "m01.security-breach",
      "m01.easy-money",
      "m01.golden-platform",
      "m02.the-ride",
    ]);
    expect(JOURNEY.counts.missions).toBe(6);
  });

  it("keeps the two optional offers apart from the required missions", () => {
    const optional = JOURNEY.missions.filter((mission) => mission.optional).map((mission) => mission.id);
    expect(optional).toEqual(["m01.easy-money", "m01.golden-platform"]);
    expect(JOURNEY.counts.optionalMissions).toBe(2);
  });

  it("reads the Mission 01 deadline as Wednesday 06:00 and a failure that costs the night", () => {
    const mission = JOURNEY.missions.find((entry) => entry.id === "m01.missing-access");
    expect(mission).toBeDefined();
    expect(mission?.startMinute).toBe(0);
    expect(journeyClock(mission?.deadlineMinute ?? -1)).toMatchObject({ isoWeekday: 3, hour: 6, minute: 0 });
    expect(mission?.onFail).toEqual(expect.arrayContaining(["overnightWork = true", "timeMinutes -180", "fatigue +25"]));
  });

  it("reads every path and step of Mission 01 without inventing any", () => {
    const mission = JOURNEY.missions.find((entry) => entry.id === "m01.missing-access");
    expect(mission?.paths.map((path) => path.id)).toEqual(["breach", "verified", "default"]);
    const defaultPath = mission?.paths.find((path) => path.id === "default");
    expect(defaultPath?.steps.map((step) => step.id)).toEqual(["read-mail", "confirm-access", "write"]);
    expect(defaultPath?.steps.find((step) => step.id === "write")).toMatchObject({ target: "laptop", app: "thesis", optional: false });
    expect(defaultPath?.steps.find((step) => step.id === "confirm-access")?.optional).toBe(true);
  });

  it("puts the interview on Wednesday 11:30 with the trip allowed from 11:00", () => {
    const mission = JOURNEY.missions.find((entry) => entry.id === "m02.the-ride");
    expect(journeyClock(mission?.startMinute ?? -1)).toMatchObject({ isoWeekday: 3, hour: 11, minute: 0 });
    expect(journeyClock(mission?.deadlineMinute ?? -1)).toMatchObject({ isoWeekday: 3, hour: 14, minute: 0 });
    expect(JOURNEY.appointments.map((appointment) => appointment.id)).toEqual(
      expect.arrayContaining(["cal.m02-interview"]),
    );
    const interview = JOURNEY.appointments.find((appointment) => appointment.id === "cal.m02-interview");
    expect(journeyClock(interview?.startMinute ?? -1)).toMatchObject({ isoWeekday: 3, hour: 11, minute: 30 });
  });

  it("keeps the timeline in clock order", () => {
    const minutes = JOURNEY.tracks.map((track) => track.startMinute);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
  });
});

describe("what is not built yet", () => {
  it("lists the three later missions of the brief and never as playable data", () => {
    expect(JOURNEY.plannedMissions.map((mission) => mission.number)).toEqual([3, 4, 5]);
    expect(journeyClock(JOURNEY.plannedMissions[0].openMinute)).toMatchObject({ isoWeekday: 4, hour: 8, minute: 0 });
    expect(journeyClock(JOURNEY.plannedMissions[1].openMinute)).toMatchObject({ isoWeekday: 4, hour: 20, minute: 0 });
    expect(journeyClock(JOURNEY.plannedMissions[2].openMinute)).toMatchObject({ isoWeekday: 5, hour: 14, minute: 0 });
    const ids = new Set(JOURNEY.missions.map((mission) => mission.id));
    for (const planned of JOURNEY.plannedMissions) {
      expect(ids.has(`m0${planned.number}`)).toBe(false);
    }
    expect(JOURNEY.counts.planned).toBe(3);
  });

  it("takes the cast of a planned mission from the cast registry", () => {
    const mission3 = JOURNEY.plannedMissions.find((mission) => mission.number === 3);
    expect(mission3?.cast).toEqual(expect.arrayContaining(["landlord_q10", "recruiter_q1"]));
    expect(JOURNEY.plannedMissions.find((mission) => mission.number === 4)?.cast).toEqual(
      expect.arrayContaining(["maya"]),
    );
    expect(JOURNEY.plannedMissions.find((mission) => mission.number === 5)?.cast).toEqual(
      expect.arrayContaining(["training_office"]),
    );
  });
});

describe("state", () => {
  it("splits the declared persistent flags into written now and reserved for later", () => {
    const written = new Set(JOURNEY.flags.written);
    const reserved = new Set(JOURNEY.flags.reserved);
    expect(written.size + reserved.size).toBe(PERSISTENT_FLAG_IDS.length);
    for (const flag of written) expect(reserved.has(flag)).toBe(false);
    // Written by today's content.
    expect([...written]).toEqual(
      expect.arrayContaining(["schoolAccessVerified", "draftFinished", "interviewCompleted", "submissionDeadlineMissed"]),
    );
    // Declared by the foundation for the later missions, written by nothing yet.
    expect([...reserved]).toEqual(
      expect.arrayContaining(["housingDepositLost", "safeHousing", "identityDocumentsExposed", "researchSavedChannelIncluded"]),
    );
  });

  it("starts from the brief's values", () => {
    expect(JOURNEY.resources.find((resource) => resource.id === "timeMinutes")?.start).toBe(72 * 60);
    expect(JOURNEY.resources.find((resource) => resource.id === "thesisProgress")?.start).toBe(60);
    expect(JOURNEY.resources.find((resource) => resource.id === "cash")?.start).toBe(2_500_000);
  });

  it("counts the device items per app, so the map shows the real surfaces", () => {
    const apps = new Map(JOURNEY.apps.map((entry) => [entry.app, entry.items]));
    expect(apps.get("mail")).toBeGreaterThan(0);
    expect(apps.get("files")).toBeGreaterThan(0);
    const counts = JOURNEY.apps.map((entry) => entry.items);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("summarizes an effect without throwing on an unknown kind", () => {
    expect(summarizeEffect({ kind: "adjustResource", resource: "fatigue", delta: 10 })).toBe("fatigue +10");
    expect(summarizeEffect({ kind: "setPersistent", flag: "bankReported", value: true })).toBe("bankReported = true");
  });
});

describe("the code map", () => {
  it("names only files that exist", () => {
    for (const entry of CHAPTER_1_CODE_MAP) {
      expect(existsSync(resolve(APP_ROOT, entry.path)), entry.path).toBe(true);
    }
  });

  it("reaches the journey page and the scenario through the map", () => {
    const paths = CHAPTER_1_CODE_MAP.map((entry) => entry.path);
    expect(paths).toContain("src/game/narrative/chapter1/lastSubmission.ts");
    expect(JOURNEY.codeMap).toBe(CHAPTER_1_CODE_MAP);
  });
});
