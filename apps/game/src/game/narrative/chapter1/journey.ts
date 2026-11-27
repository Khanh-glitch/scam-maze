// The journey map of "LAST SUBMISSION: 72 GIỜ CUỐI", derived from the scenario data.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand, Dexie or i18n imports.
//
// Why this module exists: the chapter is a 72-hour clock with missions, optional offers, scheduled
// events and persistent flags. Reading that story out of nine data files is possible but slow. This
// module reads the same `ScenarioDefinition` the game routes to and returns one plain model (the
// spine of the chapter, the missions with their paths and steps, the clock, the cast, the flags that
// something writes now, and the flags that only a later mission will write). The `/journey` page
// renders it, and the tests keep it honest: it never adds narrative that is not in the data, and a
// planned mission is marked as planned.
//
// Nothing here changes game state or writes text: labels come from the scenario (so they follow the
// display language through `localizeScenario`), and flags, minutes and cast come from the data.
import type { GameLocale } from "@scammaze/shared-types";
import {
  CHAPTER_DURATION_MINUTES,
  CHAPTER_PROTAGONIST,
  PERSISTENT_FLAG_IDS,
  RESOURCE_IDS,
  RESOURCE_LIMITS,
  minutesFromStart,
  simulatedClock,
  type PersistentFlagId,
  type ResourceId,
} from "../resources";
import type { Effect, MissionDef, MissionStepDef, ScenarioDefinition } from "../types";
import { LAST_SUBMISSION_SCENARIO } from "./lastSubmission";
import { STORY_NPC_CAST, type StoryNpcId } from "./storyCast";

// ---------------------------------------------------------------------------
// Clock and day bands
// ---------------------------------------------------------------------------

export interface JourneyClock {
  /** Whole minutes since Tuesday 17:00. */
  minutes: number;
  /** ISO weekday: 1 Monday ... 7 Sunday. */
  isoWeekday: number;
  hour: number;
  minute: number;
}

/** The clock of a chapter minute. Clamped to the chapter, so a band can never point outside it. */
export function journeyClock(minutes: number): JourneyClock {
  const clamped = Math.max(0, Math.min(CHAPTER_DURATION_MINUTES, Math.round(minutes)));
  const clock = simulatedClock(CHAPTER_DURATION_MINUTES - clamped);
  return { minutes: clamped, isoWeekday: clock.isoWeekday, hour: clock.hour, minute: clock.minute };
}

export interface JourneyDayBand {
  isoWeekday: number;
  startMinute: number;
  endMinute: number;
}

/** The days the chapter touches, split at midnight. Tuesday starts at 17:00, Friday ends at 17:00. */
export function journeyDayBands(): JourneyDayBand[] {
  const bands: JourneyDayBand[] = [];
  let start = 0;
  while (start < CHAPTER_DURATION_MINUTES) {
    const clock = journeyClock(start);
    const minuteOfDay = clock.hour * 60 + clock.minute;
    const untilMidnight = 24 * 60 - minuteOfDay;
    const end = Math.min(start + untilMidnight, CHAPTER_DURATION_MINUTES);
    bands.push({ isoWeekday: clock.isoWeekday, startMinute: start, endMinute: end });
    start = end;
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Missions, paths and steps
// ---------------------------------------------------------------------------

export interface JourneyStep {
  id: string;
  label: string;
  /** `laptop` / `phone` when the step names a device, else null. */
  target: "laptop" | "phone" | null;
  app: string | null;
  optional: boolean;
}

export interface JourneyPath {
  id: string;
  objective: string;
  steps: JourneyStep[];
}

export interface JourneyMission {
  id: string;
  title: string;
  optional: boolean;
  startMinute: number | null;
  deadlineMinute: number | null;
  paths: JourneyPath[];
  /** Human-readable summaries of the `onFail` effects (the consequence of missing the deadline). */
  onFail: string[];
  /** How many conditions the mission needs to complete (the data stays in the scenario). */
  completeWhenCount: number;
}

function stepView(step: MissionStepDef): JourneyStep {
  return {
    id: step.id,
    label: step.label,
    target: step.target ?? null,
    app: step.app ?? null,
    optional: step.optional === true,
  };
}

/** One plain line per effect kind, so the page never has to know the effect union. */
export function summarizeEffect(effect: Effect): string {
  switch (effect.kind) {
    case "adjustResource":
      return `${effect.resource} ${effect.delta >= 0 ? "+" : ""}${effect.delta}`;
    case "setPersistent":
      return `${effect.flag} = ${effect.value ? "true" : "false"}`;
    case "setSubmission":
      return `submission = ${effect.status}`;
    case "deliverItem":
      return `deliver ${effect.itemId}`;
    case "openMission":
      return `open ${effect.missionId}`;
    case "lockMission":
      return `lock ${effect.missionId}`;
    case "recordTransaction":
      return `ledger ${effect.label} ${effect.amount}`;
    default:
      return effect.kind;
  }
}

function missionView(mission: MissionDef): JourneyMission {
  return {
    id: mission.id,
    title: mission.title,
    optional: mission.optional,
    startMinute: mission.opensWhen.atMinute ?? null,
    deadlineMinute: mission.deadlineAtMinute ?? null,
    completeWhenCount: mission.completeWhen.length,
    onFail: (mission.onFail ?? []).map(summarizeEffect),
    paths: mission.paths.map((path) => ({
      id: path.id,
      objective: path.objective,
      steps: (path.steps ?? []).map(stepView),
    })),
  };
}

// ---------------------------------------------------------------------------
// Scheduled events, appointments and the timeline
// ---------------------------------------------------------------------------

export interface JourneyEvent {
  id: string;
  title: string;
  /** The minute it fires at, when it is scheduled by the clock. */
  atMinute: number | null;
  /** `itemId/actionId +N` when it fires after an action instead of at a fixed time. */
  afterAction: string | null;
  optional: boolean;
  autoResolve: boolean;
  urgent: boolean;
  responses: number;
}

export type JourneyTrackKind = "mission" | "event" | "appointment";

export interface JourneyTrack {
  id: string;
  label: string;
  kind: JourneyTrackKind;
  startMinute: number;
  endMinute: number | null;
  optional: boolean;
}

// ---------------------------------------------------------------------------
// State: resources and persistent flags
// ---------------------------------------------------------------------------

export interface JourneyResource {
  id: ResourceId;
  start: number;
  min: number | null;
  max: number | null;
}

export interface JourneyFlags {
  /** Flags the current scenario writes somewhere (a step, an event, an item or a thesis task). */
  written: string[];
  /** Flags declared by the foundation that nothing writes yet: reserved for later missions. */
  reserved: string[];
}

function collectWrittenFlags(scenario: ScenarioDefinition): Set<PersistentFlagId> {
  const written = new Set<PersistentFlagId>();
  const fromEffects = (effects: readonly Effect[] | undefined): void => {
    for (const effect of effects ?? []) {
      if (effect.kind === "setPersistent") written.add(effect.flag);
    }
  };
  for (const mission of scenario.missions ?? []) {
    fromEffects(mission.onOpen);
    fromEffects(mission.onComplete);
    fromEffects(mission.onFail);
    for (const path of mission.paths) fromEffects(path.onEnter);
  }
  for (const event of scenario.events ?? []) {
    fromEffects(event.onFire);
    fromEffects(event.onExpire);
    for (const response of event.responses) fromEffects(response.effects);
  }
  for (const item of scenario.deviceItems ?? []) {
    fromEffects(item.onOpen);
    for (const action of item.actions ?? []) fromEffects(action.effects);
  }
  for (const task of scenario.thesisTasks ?? []) {
    fromEffects(task.effects);
    for (const approach of task.approaches ?? []) fromEffects(approach.effects);
  }
  return written;
}

// ---------------------------------------------------------------------------
// Cast
// ---------------------------------------------------------------------------

export interface JourneyCastMember {
  id: StoryNpcId;
  name: string;
  role: string;
  /** The mission numbers this character belongs to, from the cast registry. */
  missions: number[];
  /** True when the character is staged in the 3D street, false for a phone-only contact. */
  inStreet: boolean;
  district: string | null;
}

// ---------------------------------------------------------------------------
// What is not built yet
// ---------------------------------------------------------------------------

/**
 * The later missions of the brief. No mission data exists for them in the scenario, so they are
 * listed from the facts that ARE in the code: the clock times asserted by `game/clock/foundation.test.ts`,
 * the cast registry (`storyCast.ts`, by mission number) and the flags the foundation reserved for
 * them (`resources.ts`). The page marks them as planned; nothing here is playable.
 */
export const PLANNED_MISSIONS = [
  {
    number: 3,
    openMinute: minutesFromStart(4, 8, 0),
    /** Flags whose comments in `resources.ts` name Mission 03 as a reader. */
    reads: ["lostMoneyToScam", "debtFromScam"] as const,
  },
  {
    number: 4,
    openMinute: minutesFromStart(4, 20, 0),
    reads: [] as const,
  },
  {
    number: 5,
    openMinute: minutesFromStart(5, 14, 0),
    /** Flags whose comments in `resources.ts` name Mission 05 as the reader. */
    reads: ["lostMoneyToScam", "recoveryOfferEligible"] as const,
  },
] as const;

export interface PlannedMission {
  number: number;
  openMinute: number;
  /** Cast from `STORY_NPC_CAST` whose `missions` list includes this number. */
  cast: StoryNpcId[];
  reads: string[];
}

// ---------------------------------------------------------------------------
// Code map: which file owns which part of the journey
// ---------------------------------------------------------------------------

export interface JourneyCodeEntry {
  /** Path from `apps/game`, checked by the tests so the map cannot name a missing file. */
  path: string;
  owns: string;
}

/** Verified by `journey.test.ts`: every path below exists. */
export const CHAPTER_1_CODE_MAP: readonly JourneyCodeEntry[] = [
  { path: "src/game/narrative/chapter1/lastSubmission.ts", owns: "The scenario the game routes to: foundation + Mission 01 + offers + Mission 02 + the parcel slice." },
  { path: "src/game/narrative/resources.ts", owns: "72-hour clock, seven resources, every persistent flag, start state and the simulated wall clock." },
  { path: "src/game/narrative/world.ts", owns: "The world clock: `settleWorld` opens missions, fires events, fails deadlines and picks the mission path." },
  { path: "src/game/narrative/reducer.ts", owns: "The deterministic core: 21 action kinds in, new state out. No clock, randomness or I/O." },
  { path: "src/game/narrative/fatigue.ts", owns: "Fatigue rules: what thesis work costs, what sleep restores, when work slows down." },
  { path: "src/game/narrative/thesisSession.ts", owns: "Writing Mode's warm-up → flow → burnout session, with interruptions saved and resumed." },
  { path: "src/game/narrative/chapter1/mission01.ts", owns: "Mission 01 THE MISSING ACCESS: the fake clearance fee, the breach, the late access check." },
  { path: "src/game/narrative/chapter1/mission01Offers.ts", owns: "EASY MONEY and THE GOLDEN PLATFORM: the two optional offers and their money traps." },
  { path: "src/game/narrative/chapter1/mission02.ts", owns: "Mission 02 THE RIDE: the District 5 interview, Bus 06, the unregistered driver." },
  { path: "src/game/narrative/chapter1/parcel.ts", owns: "The parcel thread (Slip A): the tracking slip, the fake redelivery page, the courier lookup." },
  { path: "src/game/narrative/chapter1/storyCast.ts", owns: "The ten story NPCs, their mission numbers, street anchors, schedules and branching dialogue." },
  { path: "src/features/chapter1/room/RoomChapterLayer.tsx", owns: "The playable host: intro, overlays, HUD, world clock, checkpoints and the bridge to the room." },
  { path: "src/features/chapter1/room/desktop/LaptopDesktop.tsx", owns: "The laptop: Mail, Files, Browser (UEH sites), Banking, Calendar, Thesis and Writing Mode." },
  { path: "src/features/chapter1/hud/ChapterStatusHud.tsx", owns: "The HUD: map disc, the three status bars, the clock and the cash." },
  { path: "src/features/chapter1/hud/TaskListPanel.tsx", owns: "The task list: open missions with their steps, then the missions that ended." },
  { path: "src/game/saves/saveGame.ts", owns: "Local saves: the accepted actions, the checkpoint and the pose; restore replays them through the core." },
] as const;

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

export interface ScenarioJourney {
  title: string;
  subtitle: string;
  protagonist: typeof CHAPTER_PROTAGONIST;
  durationMinutes: number;
  days: JourneyDayBand[];
  missions: JourneyMission[];
  plannedMissions: PlannedMission[];
  events: JourneyEvent[];
  appointments: JourneyTrack[];
  tracks: JourneyTrack[];
  resources: JourneyResource[];
  flags: JourneyFlags;
  cast: JourneyCastMember[];
  /** Device items per app, so the page can show which surfaces carry the story. */
  apps: Array<{ app: string; items: number }>;
  thesisTasks: Array<{ id: string; label: string; minutes: number | null; gain: number }>;
  interactables: Array<{ id: string; label: string }>;
  codeMap: readonly JourneyCodeEntry[];
  counts: {
    missions: number;
    optionalMissions: number;
    scheduledEvents: number;
    planned: number;
    writtenFlags: number;
    reservedFlags: number;
  };
}

/**
 * Builds the journey model of a scenario. Total: a scenario without missions yields empty lists.
 * `locale` only picks the display name and role of the cast (the cast registry keeps both).
 */
export function buildScenarioJourney(
  scenario: ScenarioDefinition = LAST_SUBMISSION_SCENARIO,
  locale: GameLocale = "en",
): ScenarioJourney {
  const missions = (scenario.missions ?? []).map(missionView);
  const events: JourneyEvent[] = (scenario.events ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    atMinute: event.trigger.atMinute ?? null,
    afterAction:
      event.trigger.afterAction === undefined
        ? null
        : `${event.trigger.afterAction.itemId}/${event.trigger.afterAction.actionId} +${event.trigger.afterAction.minutes} min`,
    optional: event.optional,
    autoResolve: event.autoResolve === true,
    urgent: event.thesisInterruption?.urgent === true,
    responses: event.responses.length,
  }));

  const appointments: JourneyTrack[] = (scenario.deviceItems ?? [])
    .filter((item) => item.startsAtMinute !== undefined)
    .map((item) => ({
      id: item.id,
      label: item.title,
      kind: "appointment" as const,
      startMinute: item.startsAtMinute ?? 0,
      endMinute: item.endsAtMinute ?? null,
      optional: false,
    }));

  const tracks: JourneyTrack[] = [
    ...missions.map((mission) => ({
      id: mission.id,
      label: mission.title,
      kind: "mission" as const,
      startMinute: mission.startMinute ?? 0,
      endMinute: mission.deadlineMinute,
      optional: mission.optional,
    })),
    ...appointments,
    ...events
      .filter((event) => event.atMinute !== null)
      .map((event) => ({
        id: event.id,
        label: event.title,
        kind: "event" as const,
        startMinute: event.atMinute ?? 0,
        endMinute: null,
        optional: event.optional,
      })),
  ].sort((a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id));

  const written = collectWrittenFlags(scenario);
  const flags: JourneyFlags = {
    written: PERSISTENT_FLAG_IDS.filter((flag) => written.has(flag)),
    reserved: PERSISTENT_FLAG_IDS.filter((flag) => !written.has(flag)),
  };

  const initial = scenario.initial;
  const resources: JourneyResource[] = RESOURCE_IDS.map((id) => ({
    id,
    start: initial?.resources[id] ?? 0,
    min: RESOURCE_LIMITS[id].min,
    max: RESOURCE_LIMITS[id].max,
  }));

  const apps = new Map<string, number>();
  for (const item of scenario.deviceItems ?? []) {
    apps.set(item.app, (apps.get(item.app) ?? 0) + 1);
  }

  const cast: JourneyCastMember[] = STORY_NPC_CAST.map((profile) => ({
    id: profile.id,
    name: profile.name[locale],
    role: profile.role[locale],
    missions: [...profile.missions],
    inStreet: profile.worldAnchor !== undefined,
    district: profile.worldAnchor?.district[locale] ?? null,
  }));

  const plannedMissions: PlannedMission[] = PLANNED_MISSIONS.map((planned) => ({
    number: planned.number,
    openMinute: planned.openMinute,
    reads: [...planned.reads],
    cast: STORY_NPC_CAST.filter((profile) => profile.missions.includes(planned.number)).map((profile) => profile.id),
  }));

  return {
    title: scenario.title,
    subtitle: scenario.subtitle,
    protagonist: CHAPTER_PROTAGONIST,
    durationMinutes: CHAPTER_DURATION_MINUTES,
    days: journeyDayBands(),
    missions,
    plannedMissions,
    events,
    appointments,
    tracks,
    resources,
    flags,
    cast,
    apps: [...apps.entries()].map(([app, items]) => ({ app, items })).sort((a, b) => b.items - a.items || a.app.localeCompare(b.app)),
    thesisTasks: (scenario.thesisTasks ?? []).map((task) => ({
      id: task.id,
      label: task.label,
      minutes: task.timeCostMinutes ?? null,
      gain: task.progressGain,
    })),
    interactables: Object.values(scenario.interactables ?? {}).map((item) => ({ id: item.id, label: item.label })),
    codeMap: CHAPTER_1_CODE_MAP,
    counts: {
      missions: missions.length,
      optionalMissions: missions.filter((mission) => mission.optional).length,
      scheduledEvents: events.length,
      planned: plannedMissions.length,
      writtenFlags: flags.written.length,
      reservedFlags: flags.reserved.length,
    },
  };
}
