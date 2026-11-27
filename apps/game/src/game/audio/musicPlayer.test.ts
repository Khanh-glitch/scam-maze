import { describe, expect, it, vi } from "vitest";
import { MusicPlayer, type MusicContextLike, type MusicGainNodeLike, type MusicSourceNodeLike } from "./musicPlayer";
import { MUSIC_MANIFEST, cueGain, findMusicCue } from "./musicManifest";

class FakeParam {
  value = 0;
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {
    // no-op
  }
}

class FakeGain implements MusicGainNodeLike {
  gain = new FakeParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeSource implements MusicSourceNodeLike {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeContext implements MusicContextLike {
  currentTime = 0;
  destination = {};
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  created = 0;
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData = vi.fn(async () => ({ decoded: true }));
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}

function playerWith(
  ctx: FakeContext | null,
  loadBuffer = vi.fn(async (_url: string) => new ArrayBuffer(8)),
) {
  const player = new MusicPlayer({
    createContext: () => ctx,
    loadBuffer,
    log: () => undefined,
  });
  return { player, loadBuffer };
}

describe("MusicPlayer", () => {
  it("stays silent without an audio context but still records the cue", () => {
    const { player } = playerWith(null);
    expect(() => player.play("room.calm")).not.toThrow();
    expect(player.currentCue()).toBe("room.calm");
    expect(player.isSilent()).toBe(true);
  });

  it("plays a loop cue through its own gain node", async () => {
    const ctx = new FakeContext();
    const { player, loadBuffer } = playerWith(ctx);
    player.play("room.calm", 0);

    await vi.waitFor(() => expect(ctx.sources).toHaveLength(1));
    expect(loadBuffer).toHaveBeenCalledWith("/assets/audio/music/room_calm.mp3");
    const source = ctx.sources[0];
    expect(source.loop).toBe(true);
    expect(source.start).toHaveBeenCalledTimes(1);
    const fade = ctx.gains[2];
    expect(fade.gain.value).toBeCloseTo(cueGain(findMusicCue("room.calm")!), 6);
  });

  it("does not restart the cue that is already playing", async () => {
    const ctx = new FakeContext();
    const { player } = playerWith(ctx);
    player.play("room.calm", 0);
    await vi.waitFor(() => expect(ctx.sources).toHaveLength(1));
    player.play("room.calm", 0);
    await Promise.resolve();
    expect(ctx.sources).toHaveLength(1);
  });

  it("crossfades: the old source is stopped and a new one starts", async () => {
    const ctx = new FakeContext();
    const { player } = playerWith(ctx);
    player.play("room.calm", 0);
    await vi.waitFor(() => expect(ctx.sources).toHaveLength(1));

    ctx.currentTime = 5;
    player.play("room.tense", 2500);
    await vi.waitFor(() => expect(ctx.sources).toHaveLength(2));

    const old = ctx.sources[0];
    expect(old.stop).toHaveBeenCalledWith(expect.closeTo(7.52, 2));
    expect(ctx.sources[1].loop).toBe(true);
    expect(player.currentCue()).toBe("room.tense");
  });

  it("fades one-shot cues without looping them", async () => {
    const ctx = new FakeContext();
    const { player } = playerWith(ctx);
    player.play("ending.cost", 0);
    await vi.waitFor(() => expect(ctx.sources).toHaveLength(1));
    expect(ctx.sources[0].loop).toBe(false);
  });

  it("applies the settings volume, the mute switch and voice ducking", () => {
    const ctx = new FakeContext();
    const { player } = playerWith(ctx);
    player.setVolume(0.4);
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.4, 6);

    player.setEnabled(false);
    expect(ctx.gains[0].gain.value).toBe(0);

    player.setEnabled(true);
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.4, 6);

    player.setDucked(true);
    expect(ctx.gains[1].gain.value).toBeCloseTo(10 ** (MUSIC_MANIFEST.voiceDuckDb / 20), 6);
    player.setDucked(false);
    expect(ctx.gains[1].gain.value).toBeCloseTo(1, 6);
  });

  it("stays silent when the file is missing and does not retry it", async () => {
    const ctx = new FakeContext();
    const loadBuffer = vi.fn(async (_url: string): Promise<ArrayBuffer> => {
      throw new Error("404");
    });
    const { player } = playerWith(ctx, loadBuffer);
    player.play("street", 0);
    await vi.waitFor(() => expect(loadBuffer).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(ctx.sources).toHaveLength(0));

    player.play("room.calm", 0);
    await vi.waitFor(() => expect(ctx.sources).toHaveLength(0));
    player.play("street", 0);
    await Promise.resolve();
    const streetLoads = loadBuffer.mock.calls.filter((call) => String(call[0]).includes("street"));
    expect(streetLoads).toHaveLength(1);
  });

  it("disposes: stops sources, closes the context and ignores later plays", async () => {
    const ctx = new FakeContext();
    const { player } = playerWith(ctx);
    player.play("room.calm", 0);
    await vi.waitFor(() => expect(ctx.sources).toHaveLength(1));

    player.dispose();
    expect(ctx.sources[0].stop).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalledTimes(1);

    player.play("street", 0);
    await Promise.resolve();
    expect(player.currentCue()).toBeNull();
    expect(ctx.sources).toHaveLength(1);
  });
});
