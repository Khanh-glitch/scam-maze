// Cinematic subtitles of Alex's voice lines. Pure data and rules: no React, no audio API.
//
// A caption text (the transcript in `i18n/locales/<locale>/chapter1/voice.ts`) is cut into units: one
// per line, and a line with several sentences gives one unit per sentence, so the screen shows only
// the sentence Alex is saying (never more than two lines of text). Each clip has its own timing: for
// each unit, when it starts and ends in that clip, in milliseconds from the start of the clip.
// The timings come from the pauses in the recordings (`mission01SubtitleTimings.ts`, generated);
// a unit that has no timing is spread over the clip by its length.
import type { GameLocale } from "@scammaze/shared-types";

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
}

/** Splits a caption into units: lines first, then the sentences of each line. */
export function splitCaptionUnits(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?\u2026])\s+/))
    .map((unit) => unit.trim())
    .filter((unit) => unit !== "");
}

/**
 * The cues of a caption. `timings` holds one `[startMs, endMs]` per unit of `splitCaptionUnits(text)`.
 * Without timings (or with a different number of them) the units share `durationMs` in proportion
 * to their length, so the captions still follow the voice roughly.
 */
export function buildSubtitleCues(text: string, timings: ReadonlyArray<readonly [number, number]> | undefined, durationMs: number): SubtitleCue[] {
  const units = splitCaptionUnits(text);
  if (units.length === 0) return [];
  if (timings !== undefined && timings.length === units.length) {
    return units.map((unit, index) => ({ text: unit, startMs: timings[index][0], endMs: timings[index][1] }));
  }
  const total = units.reduce((sum, unit) => sum + unit.length, 0);
  let at = 0;
  return units.map((unit) => {
    const startMs = at;
    at += (unit.length / total) * Math.max(0, durationMs);
    return { text: unit, startMs, endMs: at };
  });
}

/** The cue to show at this position of the clip, or null between two cues. */
export function cueAt(cues: readonly SubtitleCue[], positionMs: number): SubtitleCue | null {
  for (const cue of cues) {
    if (positionMs >= cue.startMs && positionMs < cue.endMs) return cue;
  }
  return null;
}

export type SubtitleTimings = Record<GameLocale, Record<string, ReadonlyArray<readonly [number, number]>>>;
