// Which background cue should play. Pure logic: the presentation layer feeds it the scene and a
// few story signals, it answers with one cue id (or null). No audio, no React, no timers, so the
// whole "when does the music change" policy is testable.
//
// Priority (highest first): ending > radio > intro > ride > street > room.tense > room.calm.
// The menu is not handled here: the menu keeps its own recorded track (see `app/App.tsx`).
import {
  MUSIC_MANIFEST,
  findMusicCue,
  type MusicCueId,
  type MusicTensionThresholds,
} from "./musicManifest";

export type ChapterMusicScene = "menu" | "intro" | "room" | "street" | "ride" | "ending";

export interface MusicSelectionInput {
  scene: ChapterMusicScene;
  /** The player's sound switch. False means silence, always. */
  soundEnabled: boolean;
  /** Room only: a scam surface is open, security is low or the deadline is close (see `isTense`). */
  tense?: boolean;
  /** Ending scene only: which family of ending the run reached. */
  outcome?: "hope" | "cost" | null;
  /** Radio open in the phone, if any. Null or absent means no radio. */
  radio?: MusicCueId | null;
}

/** Story signals that turn the room's music tense. */
export interface TensionSignals {
  /** A scam page, offer or suspicious call is open in front of the player. */
  scamSurfaceOpen: boolean;
  /** Account/device security, 0..100. */
  security: number;
  /** Simulated minutes left before the Friday 17:00 deadline. */
  minutesLeft: number;
}

/**
 * The room is tense when the player is looking at something suspicious, when security has dropped
 * to the threshold, or when the deadline is close. Thresholds live in `musicManifest.json` so they
 * can be tuned without touching this file.
 */
export function isTense(
  signals: TensionSignals,
  thresholds: MusicTensionThresholds = MUSIC_MANIFEST.tense,
): boolean {
  return (
    signals.scamSurfaceOpen ||
    signals.security <= thresholds.securityAtMost ||
    signals.minutesLeft <= thresholds.minutesLeftAtMost
  );
}

/** The cue to play for this scene, or null for silence (menu, sound off, unknown scene). */
export function selectMusicCue(input: MusicSelectionInput): MusicCueId | null {
  if (!input.soundEnabled) return null;

  switch (input.scene) {
    case "ending":
      return input.outcome === "hope" ? "ending.hope" : "ending.cost";
    case "menu":
      return null;
    default:
      break;
  }

  if (input.radio) return input.radio;

  switch (input.scene) {
    case "intro":
      return "theme.alex";
    case "ride":
      return "ride";
    case "street":
      return "street";
    case "room":
      return input.tense ? "room.tense" : "room.calm";
    default:
      return null;
  }
}

/** The scene a cue belongs to, from the manifest. */
export function cueScene(id: MusicCueId): ChapterMusicScene | null {
  return findMusicCue(id)?.scene ?? null;
}

/**
 * How long the crossfade between two cues takes. Ending cues get the longest fade, the room's two
 * moods a medium one, radio stays snappy, everything else uses the default.
 */
export function crossfadeMs(from: MusicCueId | null, to: MusicCueId | null): number {
  if (from === to) return 0;
  const table = MUSIC_MANIFEST.crossfadeMs;
  const sceneOf = (id: MusicCueId | null): ChapterMusicScene | null =>
    id === null ? null : cueScene(id);
  const isEnding = (id: MusicCueId | null) => sceneOf(id) === "ending";
  if (isEnding(from) || isEnding(to)) return table.ending;
  const isRadio = (id: MusicCueId | null) => id !== null && id.startsWith("radio.");
  if (isRadio(from) || isRadio(to)) return table.radio;
  if (sceneOf(from) === "room" && sceneOf(to) === "room") return table.roomMood;
  return table.default;
}
