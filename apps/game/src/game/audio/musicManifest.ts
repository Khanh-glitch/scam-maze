// The music manifest: one place that says which background track belongs to which scene, where the
// file lives, and what the track must sound like. The data is `musicManifest.json`, so the asset
// checker (`scripts/check-music.mjs`) and the game read the same file; the brief the composer works
// from (`docs/gameplay/MUSIC_BRIEF.md`) is checked against it by `musicManifest.test.ts`.
//
// The owner composes the tracks. Until a file exists, the player stays silent for that cue: nothing
// here loads audio, it only describes it.
import raw from "./musicManifest.json";

/** Where a cue plays. `menu` is not in the manifest: the menu keeps its own recorded track. */
export type MusicScene = "intro" | "room" | "street" | "ride" | "ending";

export interface MusicCueDefinition {
  /** Stable id used by the game and by the tests. */
  id: string;
  /** File name inside `directory`. */
  file: string;
  scene: MusicScene;
  /** True when the file must join end-to-start without a gap. */
  loop: boolean;
  bpm: number;
  /** Length in 4/4 bars; loop cues must be an exact number of bars. */
  bars: number;
  key: string;
  genre: string;
  mood: string;
  /** Base gain for this cue (0..1); the composer delivers a flat, loudness-normalised file. */
  gain: number;
  /** Gain reduction while a voice line plays, in dB. */
  duckDb: number;
  /** Higher wins when two cues could play. */
  priority: number;
  /** One-shot cues only: accepted length window in seconds. */
  lengthRangeSeconds?: [number, number];
}

export interface MusicFormatRules {
  extensions: string[];
  sampleRate: number;
  channels: number;
  maxBytes: number;
  minBytes: number;
}

export interface MusicLoudnessRules {
  loopLufs: number;
  oneShotLufs: number;
  truePeakDb: number;
}

export interface MusicTensionThresholds {
  /** At or below this security value the room turns tense. */
  securityAtMost: number;
  /** At or below this many minutes left the room turns tense. */
  minutesLeftAtMost: number;
  /** How long after the last trigger the room goes back to calm. */
  releaseAfterMs: number;
}

export interface MusicCrossfadeMs {
  default: number;
  roomMood: number;
  ending: number;
  radio: number;
}

export interface MusicManifest {
  version: number;
  directory: string;
  format: MusicFormatRules;
  loudness: MusicLoudnessRules;
  tense: MusicTensionThresholds;
  voiceDuckDb: number;
  crossfadeMs: MusicCrossfadeMs;
  cues: MusicCueDefinition[];
}

export const MUSIC_MANIFEST = raw as MusicManifest;

/** Every cue id the game knows. Kept as a literal list so TypeScript catches typos. */
export const MUSIC_CUE_IDS = [
  "theme.alex",
  "room.calm",
  "room.tense",
  "street",
  "ride",
  "ending.hope",
  "ending.cost",
] as const;

export type MusicCueId = (typeof MUSIC_CUE_IDS)[number];

const CUES_BY_ID = new Map<string, MusicCueDefinition>(
  MUSIC_MANIFEST.cues.map((cue) => [cue.id, cue]),
);

/** The cue definition, or undefined when the manifest is broken (tests catch that). */
export function findMusicCue(id: string): MusicCueDefinition | undefined {
  return CUES_BY_ID.get(id);
}

/** URL the browser fetches for a cue. */
export function musicCueUrl(cue: MusicCueDefinition): string {
  return `${MUSIC_MANIFEST.directory}/${cue.file}`;
}

/** Seconds of one 4/4 bar at `bpm`. */
export function barSeconds(bpm: number): number {
  return (60 / bpm) * 4;
}

/** Exact length a loop cue must have, or null for one-shot cues. */
export function loopSeconds(cue: MusicCueDefinition): number | null {
  return cue.loop ? barSeconds(cue.bpm) * cue.bars : null;
}

/** Gain the player uses for a cue, after the user's music volume (applied by the player). */
export function cueGain(cue: MusicCueDefinition): number {
  return Math.max(0, Math.min(1, cue.gain));
}
