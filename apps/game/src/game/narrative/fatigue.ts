// Fatigue of Alex in "LAST SUBMISSION: 72 GIỜ CUỐI". Pure TypeScript: no React, Three.js or i18n.
//
// Fatigue is a persistent resource (0..100). Long thesis work, working through the night and
// missing sleep raise it. Sleep and short breaks lower it. It never ends the chapter by itself:
// the only effect is that thesis work takes longer. Every number here is a placeholder that the
// canonical brief does not state; change them in `DEFAULT_FATIGUE_CONFIG` or in
// `ScenarioDefinition.gameplay.fatigue`.
import { minutesFromStart } from "./resources";

export interface RestOption {
  /** Simulated minutes the rest takes. */
  minutes: number;
  /** Fatigue removed. */
  recovery: number;
}

export interface FatigueConfig {
  /** When false the scenario has no fatigue rules (resource stays as it is). */
  enabled: boolean;
  /** Fatigue added per hour of thesis work (free work and thesis tasks), pro rata. */
  perThesisHour: number;
  /** Below this value there is no effect. */
  tiredAt: number;
  /** From this value the interface says "exhausted". */
  exhaustedAt: number;
  /** Extra time thesis work takes at fatigue 100, as a fraction (1 = twice as long; 1.25 = 2.25 times as long). Linear from `tiredAt`. */
  maxSlowdown: number;
  /** A short break. */
  nap: RestOption;
  /** A night of sleep. */
  sleep: RestOption;
  /** Simulated minutes (since Tuesday 17:00) at which the night is checked. */
  nightChecksAtMinute: number[];
  /** Less sleep than this in the night window counts as missed sleep. */
  minSleepMinutes: number;
  /** Fatigue added for a night with missed sleep. */
  missedSleepPenalty: number;
}

export const DEFAULT_FATIGUE_CONFIG: FatigueConfig = {
  enabled: false,
  perThesisHour: 6,
  tiredAt: 40,
  exhaustedAt: 70,
  maxSlowdown: 1.25,
  nap: { minutes: 30, recovery: 6 },
  sleep: { minutes: 360, recovery: 50 },
  nightChecksAtMinute: [minutesFromStart(3, 3, 0), minutesFromStart(4, 3, 0), minutesFromStart(5, 3, 0)],
  minSleepMinutes: 240,
  missedSleepPenalty: 15,
};

export type FatigueLevel = "rested" | "tired" | "exhausted";
export type RestMode = "nap" | "sleep";
export const REST_MODES: readonly RestMode[] = ["nap", "sleep"];

export function fatigueLevel(value: number, config: FatigueConfig): FatigueLevel {
  if (value >= config.exhaustedAt) return "exhausted";
  if (value >= config.tiredAt) return "tired";
  return "rested";
}

/** Multiplier on the time thesis work takes: 1 when rested, up to 1 + maxSlowdown at fatigue 100. */
export function workSlowdown(fatigue: number, config: FatigueConfig): number {
  if (!config.enabled || fatigue <= config.tiredAt) return 1;
  const span = Math.max(1, 100 - config.tiredAt);
  const ratio = Math.min(1, (fatigue - config.tiredAt) / span);
  return 1 + config.maxSlowdown * ratio;
}

/** Minutes a piece of thesis work takes at this fatigue (whole minutes, never less than the base). */
export function effectiveWorkMinutes(baseMinutes: number, fatigue: number, config: FatigueConfig): number {
  return Math.ceil(baseMinutes * workSlowdown(fatigue, config));
}

/** Fatigue added by `minutes` of thesis work. */
export function workFatigue(minutes: number, config: FatigueConfig): number {
  if (!config.enabled) return 0;
  return Math.round((minutes * config.perThesisHour) / 60);
}

export function restOption(mode: RestMode, config: FatigueConfig): RestOption {
  return mode === "sleep" ? config.sleep : config.nap;
}
