// useNarrationPlayback tests (task 10.2). Requirements 14.4, 14.5, 14.6, 15.x (skip).
// jsdom, the fake audio port and fake clock; no network and no real audio.
import type { GameLocale } from "@scammaze/shared-types";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyLocale } from "../../../i18n";
import { INTRO_SEQUENCE } from "../../../game/narrative/chapter1/dialogues/intro";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import type { VoiceClipEntry, VoiceManifest } from "../../../game/voice/manifestTypes";
import { createFakeAudioPort, type FakeAudioPort } from "../../../test/fakeAudioPort";
import { useNarrationPlayback, type NarrationSequence, type UseNarrationPlaybackOptions } from "./useNarrationPlayback";

const SEQUENCE: NarrationSequence = { graphId: "dlg.intro", nodeIds: INTRO_SEQUENCE };

function clip(nodeId: string, locale: GameLocale): VoiceClipEntry {
  return {
    clipId: nodeId,
    nodeId,
    graphId: "dlg.intro",
    speakerId: "spk.narrator",
    locale,
    status: "present",
    sources: [{ src: `/voice/${locale}/${nodeId}.mp3`, type: "audio/mpeg" }],
    tone: "reassuring",
    voiceNote: "test",
    origin: "tts-generated",
    credit: "not provided",
    sourceTextHash: "00000000",
  };
}

const manifestOf = (clips: VoiceClipEntry[]): VoiceManifest => ({ schemaVersion: 1, chapterId: "chapter-1", clips });
const EN_MANIFEST = manifestOf(INTRO_SEQUENCE.map((id) => clip(id, "en")));

const SETTINGS = {
  soundEnabled: true,
  sfxVolume: 1,
  voiceVolume: 1,
  phoneVoiceFilter: false,
  englishVoiceFallback: false,
  reducedStress: false,
  subtitlesEnabled: false,
};

interface Rig {
  port: FakeAudioPort;
  hook: ReturnType<typeof renderHook<ReturnType<typeof useNarrationPlayback>, Partial<UseNarrationPlaybackOptions>>>;
  /** Moves the fake clock past the pause and the load, then lets promises settle. */
  settle(ms?: number): Promise<void>;
  /** Ends the live clip the way the audio engine does. */
  endLive(): Promise<void>;
}

function setup(manifest: VoiceManifest, extra: Partial<UseNarrationPlaybackOptions> = {}): Rig {
  const port = createFakeAudioPort({ autoLoad: true });
  const clock = port.clock;
  const base: UseNarrationPlaybackOptions = {
    scenario: CHAPTER_1_SCENARIO,
    sequence: SEQUENCE,
    active: true,
    settings: SETTINGS,
    deps: {
      manifest,
      createPort: () => port,
      createPreview: () => null,
      now: () => clock.now(),
      setTimer: (fn, ms) => clock.setTimer(fn, ms),
      clearTimer: (id) => clock.clearTimer(id),
      log: () => undefined,
    },
  };
  const hook = renderHook((props: Partial<UseNarrationPlaybackOptions>) => useNarrationPlayback({ ...base, ...props }), {
    initialProps: extra,
  });
  const settle = async (ms = 3000) => {
    await act(async () => {
      for (let i = 0; i < 6; i += 1) await Promise.resolve();
      clock.advance(ms);
      for (let i = 0; i < 12; i += 1) await Promise.resolve();
    });
  };
  const endLive = async () => {
    const live = port.playbacks.find((p) => p.live);
    if (!live) throw new Error("no live playback");
    await act(async () => {
      port.fireEnded(live.id);
      for (let i = 0; i < 6; i += 1) await Promise.resolve();
    });
  };
  return { port, hook, settle, endLive };
}

const playedClips = (port: FakeAudioPort): string[] => port.playbacks.map((p) => p.clip.id);

afterEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("useNarrationPlayback", () => {
  it("plays the intro lines in order, one clip at a time, and finishes after the last one", async () => {
    const rig = setup(EN_MANIFEST);
    await rig.settle();
    expect(playedClips(rig.port)).toEqual(["/voice/en/intro.1.mp3"]);
    expect(rig.hook.result.current.index).toBe(0);
    expect(rig.hook.result.current.line?.nodeId).toBe("intro.1");

    await rig.endLive();
    await rig.settle();
    await rig.endLive();
    await rig.settle();
    expect(playedClips(rig.port)).toEqual(INTRO_SEQUENCE.map((id) => `/voice/en/${id}.mp3`));
    expect(rig.hook.result.current.index).toBe(2);
    expect(rig.hook.result.current.finished).toBe(false);

    await rig.endLive();
    expect(rig.hook.result.current.finished).toBe(true);
    expect(rig.hook.result.current.line).toBeNull();
    expect(rig.port.liveHandles).toBe(0);
    expect(rig.port.maxConcurrentPlaybacks).toBe(1);
  });

  it("advance cuts the current clip and starts the next line; the last advance finishes", async () => {
    const rig = setup(EN_MANIFEST, { autoAdvance: false });
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);

    act(() => rig.hook.result.current.advance());
    expect(rig.port.liveHandles).toBe(0);
    await rig.settle();
    expect(playedClips(rig.port)).toEqual(["/voice/en/intro.1.mp3", "/voice/en/intro.2.mp3"]);

    act(() => rig.hook.result.current.advance());
    await rig.settle();
    act(() => rig.hook.result.current.advance());
    expect(rig.hook.result.current.finished).toBe(true);
    expect(rig.port.liveHandles).toBe(0);
    expect(rig.port.maxConcurrentPlaybacks).toBe(1);
  });

  it("does not move on by itself when autoAdvance is off", async () => {
    const rig = setup(EN_MANIFEST, { autoAdvance: false });
    await rig.settle();
    await rig.endLive();
    await rig.settle();
    expect(rig.hook.result.current.index).toBe(0);
    expect(playedClips(rig.port)).toHaveLength(1);
  });

  it("skip stops the clip at once and ends the sequence", async () => {
    const rig = setup(EN_MANIFEST);
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    act(() => rig.hook.result.current.skip());
    expect(rig.port.liveHandles).toBe(0);
    expect(rig.hook.result.current.finished).toBe(true);
    await rig.settle();
    expect(playedClips(rig.port)).toHaveLength(1);
  });

  it("goTo shows the requested line and clamps the index", async () => {
    const rig = setup(EN_MANIFEST, { autoAdvance: false });
    await rig.settle();
    act(() => rig.hook.result.current.goTo(2));
    await rig.settle();
    expect(rig.hook.result.current.line?.nodeId).toBe("intro.3");
    expect(playedClips(rig.port).at(-1)).toBe("/voice/en/intro.3.mp3");
    act(() => rig.hook.result.current.goTo(99));
    expect(rig.hook.result.current.index).toBe(2);
  });

  it("stops when it becomes inactive and plays again from the same line when active again", async () => {
    const rig = setup(EN_MANIFEST);
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    rig.hook.rerender({ active: false });
    expect(rig.port.liveHandles).toBe(0);
    await rig.settle();
    expect(rig.port.liveHandles).toBe(0);
    rig.hook.rerender({ active: true });
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    expect(rig.port.maxConcurrentPlaybacks).toBe(1);
  });

  it("stops and releases the port on unmount", async () => {
    const rig = setup(EN_MANIFEST);
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    rig.hook.unmount();
    expect(rig.port.liveHandles).toBe(0);
    expect(rig.port.disposed).toBe(true);
  });

  it("pauses while an overlay is open and resumes afterwards", async () => {
    const rig = setup(EN_MANIFEST);
    await rig.settle(1500);
    expect(rig.port.liveHandles).toBe(1);
    rig.hook.rerender({ paused: true });
    expect(rig.port.liveHandles).toBe(0);
    expect(rig.hook.result.current.snapshot.phase).toBe("paused");
    rig.hook.rerender({ paused: false });
    expect(rig.port.liveHandles).toBe(1);
    expect(rig.port.maxConcurrentPlaybacks).toBe(1);
  });

  it("shows the text only (subtitle visible) when there is no clip", async () => {
    const rig = setup(manifestOf([]));
    await rig.settle();
    expect(rig.port.playbacks).toHaveLength(0);
    expect(rig.hook.result.current.line?.text).toBe(CHAPTER_1_SCENARIO.dialogues["dlg.intro"].lines["line.intro.1"]);
    expect(rig.hook.result.current.snapshot.reason).toBe("missing");
    // Subtitles are off in the settings, but nothing is audible, so the text still shows.
    expect(rig.hook.result.current.subtitleVisible).toBe(true);
  });

  it("does not play English audio in Vietnamese unless the English-voice fallback is on", async () => {
    act(() => {
      applyLocale("vi");
    });
    const off = setup(EN_MANIFEST);
    await off.settle();
    expect(off.port.playbacks).toHaveLength(0);
    expect(off.hook.result.current.snapshot.source).toBe("none");
    off.hook.unmount();

    const on = setup(EN_MANIFEST, { settings: { ...SETTINGS, englishVoiceFallback: true } });
    await on.settle();
    expect(playedClips(on.port)).toEqual(["/voice/en/intro.1.mp3"]);
    expect(on.hook.result.current.snapshot.label).toBe("english-voice");
  });

  it("returns an empty, finished playback for no sequence", () => {
    const rig = setup(EN_MANIFEST, { sequence: null });
    expect(rig.hook.result.current.total).toBe(0);
    expect(rig.hook.result.current.finished).toBe(true);
    expect(rig.hook.result.current.line).toBeNull();
  });
});
