import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MusicCueId } from "../../../game/audio/musicManifest";
import { MUSIC_MANIFEST } from "../../../game/audio/musicManifest";
import { useChapterMusic, type MusicSink, type UseChapterMusicOptions } from "./useChapterMusic";

function recorder() {
  const calls: string[] = [];
  let cue: MusicCueId | null = null;
  const sink: MusicSink = {
    play: vi.fn((next: MusicCueId, fade?: number) => {
      cue = next;
      calls.push(`play:${next}:${fade ?? "default"}`);
    }),
    stop: vi.fn(() => {
      cue = null;
      calls.push("stop");
    }),
    setVolume: vi.fn((volume: number) => calls.push(`volume:${volume}`)),
    setEnabled: vi.fn((enabled: boolean) => calls.push(`enabled:${enabled}`)),
    setDucked: vi.fn((ducked: boolean) => calls.push(`ducked:${ducked}`)),
    currentCue: vi.fn(() => cue),
    resume: vi.fn(),
    dispose: vi.fn(),
  };
  return { sink, calls };
}

const base: UseChapterMusicOptions = {
  scene: "room",
  tense: false,
  outcome: null,
  voicePlaying: false,
  soundEnabled: true,
  volume: 0.8,
  enabled: true,
};

describe("useChapterMusic", () => {
  it("plays the calm room cue once the room is ready", () => {
    const { sink, calls } = recorder();
    renderHook(() => useChapterMusic({ ...base, player: sink }));
    expect(calls).toContain(`play:room.calm:${MUSIC_MANIFEST.crossfadeMs.default}`);
    expect(calls).toContain("enabled:true");
    expect(calls).toContain("volume:0.8");
  });

  it("plays nothing before the room is ready, and stops when it goes away", () => {
    const { sink, calls } = recorder();
    const view = renderHook(() => useChapterMusic({ ...base, enabled: false, player: sink }));
    expect(calls.some((call) => call.startsWith("play:"))).toBe(false);
    expect(calls).toContain("enabled:false");

    view.rerender();
    act(() => view.unmount());
    expect(sink.dispose).toHaveBeenCalledTimes(1);
  });

  it("switches to the tense room cue and back with the room crossfade", () => {
    const { sink, calls } = recorder();
    const view = renderHook((props: UseChapterMusicOptions) => useChapterMusic(props), {
      initialProps: { ...base, player: sink },
    });
    view.rerender({ ...base, tense: true, player: sink });
    expect(calls).toContain(`play:room.tense:${MUSIC_MANIFEST.crossfadeMs.roomMood}`);

    view.rerender({ ...base, tense: false, player: sink });
    expect(calls).toContain(`play:room.calm:${MUSIC_MANIFEST.crossfadeMs.roomMood}`);
  });

  it("follows the scene outside and on the bus", () => {
    const { sink, calls } = recorder();
    const view = renderHook((props: UseChapterMusicOptions) => useChapterMusic(props), {
      initialProps: { ...base, player: sink },
    });
    view.rerender({ ...base, scene: "street", player: sink });
    expect(calls).toContain(`play:street:${MUSIC_MANIFEST.crossfadeMs.default}`);
    view.rerender({ ...base, scene: "ride", player: sink });
    expect(calls).toContain(`play:ride:${MUSIC_MANIFEST.crossfadeMs.default}`);
  });

  it("plays the ending cue with the longest fade and stops on the menu scene", () => {
    const { sink, calls } = recorder();
    const view = renderHook((props: UseChapterMusicOptions) => useChapterMusic(props), {
      initialProps: { ...base, player: sink },
    });
    view.rerender({ ...base, scene: "ending", outcome: "hope", player: sink });
    expect(calls).toContain(`play:ending.hope:${MUSIC_MANIFEST.crossfadeMs.ending}`);

    view.rerender({ ...base, scene: "menu", player: sink });
    expect(calls).toContain("stop");
  });

  it("ducks under a voice line and comes back", () => {
    const { sink, calls } = recorder();
    const view = renderHook((props: UseChapterMusicOptions) => useChapterMusic(props), {
      initialProps: { ...base, player: sink },
    });
    view.rerender({ ...base, voicePlaying: true, player: sink });
    expect(calls).toContain("ducked:true");
    view.rerender({ ...base, voicePlaying: false, player: sink });
    expect(calls).toContain("ducked:false");
  });

  it("mirrors the sound switch and the volume setting", () => {
    const { sink, calls } = recorder();
    const view = renderHook((props: UseChapterMusicOptions) => useChapterMusic(props), {
      initialProps: { ...base, player: sink },
    });
    view.rerender({ ...base, soundEnabled: false, player: sink });
    expect(calls).toContain("enabled:false");
    view.rerender({ ...base, soundEnabled: true, volume: 0.3, player: sink });
    expect(calls).toContain("volume:0.3");
    expect(calls).toContain("enabled:true");
  });
});
