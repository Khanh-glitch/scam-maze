// The voice of a conversation line: a recorded clip first, the computer voice second, the text
// always; one line at a time; pause and resume.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const synthetic = vi.hoisted(() => ({
  available: true,
  speakable: true,
  spoken: [] as string[],
  onEnd: null as (() => void) | null,
  cancelled: 0,
}));

vi.mock("./speakSynthetic", () => ({
  canSpeakSynthetic: () => synthetic.available,
  stopSynthetic: () => {
    synthetic.cancelled += 1;
  },
  speakSynthetic: (text: string, _locale: string, onEnd: () => void) => {
    if (!synthetic.speakable) return false;
    synthetic.spoken.push(text);
    synthetic.onEnd = onEnd;
    return true;
  },
}));

import { CLIP_LOAD_MS, lineVoiceKey, playLineVoice, setLineAudioFactoryForTests, setLineVoiceHeld, stopLineVoice, subscribeLineVoice, type LineAudio } from "./lineVoice";

class FakeAudio implements LineAudio {
  src = "";
  preload = "";
  currentTime = 0;
  playing = false;
  plays = 0;
  pauses = 0;
  private listeners = new Map<string, Array<() => void>>();
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  play() {
    this.playing = true;
    this.plays += 1;
  }
  pause() {
    this.playing = false;
    this.pauses += 1;
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== listener));
  }
  fire(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

let created: FakeAudio[] = [];
/** Decides what happens to a clip once it is requested. */
let clipBehaviour: "ready" | "error" | "silent" = "ready";

beforeEach(() => {
  synthetic.available = true;
  synthetic.speakable = true;
  synthetic.spoken = [];
  synthetic.onEnd = null;
  synthetic.cancelled = 0;
  created = [];
  clipBehaviour = "ready";
  setLineAudioFactoryForTests((url) => {
    const audio = new FakeAudio(url);
    created.push(audio);
    // The browser answers a little after the source is set.
    queueMicrotask(() => {
      if (clipBehaviour === "ready") audio.fire("canplay");
      else if (clipBehaviour === "error") audio.fire("error");
    });
    return audio;
  });
});

afterEach(() => {
  setLineAudioFactoryForTests(null);
  vi.useRealTimers();
});

describe("playLineVoice", () => {
  it("plays the recorded clip when there is one, and does not use the computer voice", async () => {
    const result = await playLineVoice("a/call/0", "Hello", "en", "/clip.mp3", { synthetic: true });
    expect(result).toBe("clip");
    expect(lineVoiceKey()).toBe("a/call/0");
    expect(created).toHaveLength(1);
    expect(created[0].playing).toBe(true);
    expect(synthetic.spoken).toEqual([]);
    created[0].fire("ended");
    expect(lineVoiceKey()).toBeNull();
  });

  it("falls back to the computer voice when the clip is missing, and to nothing when there is no voice", async () => {
    clipBehaviour = "error";
    expect(await playLineVoice("a/call/0", "Hello", "en", "/missing.mp3", { synthetic: true })).toBe("synthetic");
    expect(synthetic.spoken).toEqual(["Hello"]);
    expect(lineVoiceKey()).toBe("a/call/0");
    synthetic.onEnd?.();
    expect(lineVoiceKey()).toBeNull();
    synthetic.speakable = false;
    expect(await playLineVoice("a/call/1", "Again", "en", "/missing2.mp3", { synthetic: true })).toBe("none");
    expect(lineVoiceKey()).toBeNull();
  });

  it("does not start the computer voice for a line that starts by itself", async () => {
    clipBehaviour = "error";
    expect(await playLineVoice("a/call/0", "Hello", "en", "/missing.mp3", { synthetic: false })).toBe("none");
    expect(synthetic.spoken).toEqual([]);
  });

  it("does not ask for a clip that failed once again", async () => {
    clipBehaviour = "error";
    await playLineVoice("a/call/0", "Hello", "en", "/missing.mp3", { synthetic: false });
    await playLineVoice("a/call/0", "Hello", "en", "/missing.mp3", { synthetic: false });
    expect(created).toHaveLength(1);
  });

  it("gives up on a clip that never becomes playable", async () => {
    vi.useFakeTimers();
    clipBehaviour = "silent";
    const pending = playLineVoice("a/call/0", "Hello", "en", "/slow.mp3", { synthetic: false });
    await vi.advanceTimersByTimeAsync(CLIP_LOAD_MS + 10);
    expect(await pending).toBe("none");
  });

  it("plays one line at a time: a new line stops the one before", async () => {
    await playLineVoice("a/call/0", "One", "en", "/one.mp3", { synthetic: true });
    await playLineVoice("a/call/1", "Two", "en", "/two.mp3", { synthetic: true });
    expect(created[0].playing).toBe(false);
    expect(created[1].playing).toBe(true);
    expect(lineVoiceKey()).toBe("a/call/1");
    // A late answer of the first request must not start it again.
    expect(created.filter((audio) => audio.playing)).toHaveLength(1);
  });

  it("stops the voice and tells the listeners", async () => {
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeLineVoice(() => seen.push(lineVoiceKey()));
    await playLineVoice("a/call/0", "One", "en", "/one.mp3", { synthetic: true });
    stopLineVoice();
    unsubscribe();
    expect(seen).toEqual(["a/call/0", null]);
    expect(created[0].playing).toBe(false);
  });

  it("pauses a clip while the game is held and continues it afterwards", async () => {
    await playLineVoice("a/call/0", "One", "en", "/one.mp3", { synthetic: true });
    setLineVoiceHeld(true);
    expect(created[0].playing).toBe(false);
    expect(lineVoiceKey()).toBe("a/call/0");
    setLineVoiceHeld(false);
    expect(created[0].playing).toBe(true);
    expect(created[0].plays).toBe(2);
  });

  it("pauses and resumes the computer voice with the game", async () => {
    clipBehaviour = "error";
    const pause = vi.fn();
    const resume = vi.fn();
    Object.assign(window, { speechSynthesis: { pause, resume, cancel: vi.fn() } });
    await playLineVoice("a/call/0", "One", "en", "/missing.mp3", { synthetic: true });
    setLineVoiceHeld(true);
    setLineVoiceHeld(false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  });
});
