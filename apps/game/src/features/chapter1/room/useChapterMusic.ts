// Chapter music: turns the scene, the story's tension and the settings into one cue, and keeps a
// MusicPlayer in step with them. Presentation only — the narrative core never learns about audio.
//
// The player is created once per mount. Without an AudioContext (jsdom, blocked audio) it stays
// silent, so every chapter test keeps running unchanged. A missing clip is silent too: the owner
// may still be composing it.
import { useEffect, useRef } from "react";
import {
  MUSIC_MANIFEST,
  type MusicCueId,
  type MusicManifest,
} from "../../../game/audio/musicManifest";
import {
  crossfadeMs,
  selectMusicCue,
  type ChapterMusicScene,
} from "../../../game/audio/musicCueSelection";
import { MusicPlayer } from "../../../game/audio/musicPlayer";

/** The part of `MusicPlayer` the hook uses; tests pass a recorder instead. */
export interface MusicSink {
  play(cueId: MusicCueId, fadeMs?: number): void;
  stop(fadeMs?: number): void;
  setVolume(volume: number): void;
  setEnabled(enabled: boolean): void;
  setDucked(ducked: boolean): void;
  currentCue(): MusicCueId | null;
  resume(): void;
  dispose(): void;
}

export interface UseChapterMusicOptions {
  scene: ChapterMusicScene;
  /** Room only: a suspicious surface is open, security is low or the deadline is close. */
  tense: boolean;
  /** Ending scene only. */
  outcome: "hope" | "cost" | null;
  /** A voice line (Alex, a call, a chat clip) is playing. */
  voicePlaying: boolean;
  /** The sound switch and the music volume, straight from the player's settings. */
  soundEnabled: boolean;
  volume: number;
  /** False before the room is ready, while paused, or in a test that does not want audio. */
  enabled: boolean;
  /** Test seam. */
  player?: MusicSink;
  manifest?: MusicManifest;
}

export function useChapterMusic(options: UseChapterMusicOptions): void {
  const { scene, tense, outcome, voicePlaying, soundEnabled, volume, enabled } = options;
  const manifest = options.manifest ?? MUSIC_MANIFEST;
  const playerRef = useRef<MusicSink | null>(null);

  // One player per mount, disposed on unmount. The injected player belongs to the caller.
  useEffect(() => {
    const player = options.player ?? new MusicPlayer({ manifest });
    playerRef.current = player;

    // Autoplay policy: the first click or key press may start the context.
    const resume = () => player.resume();
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      player.dispose();
      playerRef.current = null;
    };
    // The player is created once; later option changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Volume, mute and readiness.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.setEnabled(enabled && soundEnabled);
    player.setVolume(volume);
  }, [enabled, soundEnabled, volume]);

  // Which cue plays. Only when the room is ready: no music over the loading screen.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (!enabled) {
      player.stop(manifest.crossfadeMs.default);
      return;
    }
    const cue = selectMusicCue({ scene, tense, outcome, soundEnabled: true });
    if (cue === null) {
      player.stop(manifest.crossfadeMs.default);
      return;
    }
    const fade = crossfadeMs(player.currentCue(), cue);
    player.play(cue, fade === 0 ? undefined : fade);
  }, [enabled, scene, tense, outcome, manifest]);

  // Duck under a voice line.
  useEffect(() => {
    playerRef.current?.setDucked(voicePlaying);
  }, [voicePlaying]);
}
