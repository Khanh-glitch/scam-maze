// Background-music player. One instance per chapter page: loads the cue files the manifest names,
// loops the ones marked as loops, crossfades between cues and ducks under voice.
//
// The audio context is created lazily and structurally typed, so the same code runs in a browser
// and in jsdom (where there is no AudioContext): without one, `play` only records the requested
// cue and stays silent. Nothing here throws when a file is missing — the owner may not have
// composed it yet.
import {
  MUSIC_MANIFEST,
  cueGain,
  findMusicCue,
  musicCueUrl,
  type MusicCueId,
  type MusicManifest,
} from "./musicManifest";

export interface MusicGainParamLike {
  value: number;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
  cancelScheduledValues(time: number): void;
}

export interface MusicGainNodeLike {
  gain: MusicGainParamLike;
  connect(destination: unknown): void;
  disconnect(): void;
}

export interface MusicSourceNodeLike {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  connect(destination: unknown): void;
  disconnect(): void;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}

export interface MusicContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  createGain(): MusicGainNodeLike;
  createBufferSource(): MusicSourceNodeLike;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  resume?(): Promise<void>;
  close?(): Promise<void>;
}

export interface MusicPlayerOptions {
  /** Test seam: returns null when there is no audio context (jsdom, old browsers). */
  createContext?: () => MusicContextLike | null;
  /** Test seam: fetches the encoded file. */
  loadBuffer?: (url: string) => Promise<ArrayBuffer>;
  manifest?: MusicManifest;
  log?: (...args: unknown[]) => void;
}

function browserContext(): MusicContextLike | null {
  const scope = globalThis as unknown as {
    AudioContext?: new () => MusicContextLike;
    webkitAudioContext?: new () => MusicContextLike;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`music ${url}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

export class MusicPlayer {
  private readonly manifest: MusicManifest;
  private readonly createContext: () => MusicContextLike | null;
  private readonly loadBuffer: (url: string) => Promise<ArrayBuffer>;
  private readonly log: (...args: unknown[]) => void;

  private ctx: MusicContextLike | null = null;
  private master: MusicGainNodeLike | null = null;
  private duck: MusicGainNodeLike | null = null;

  /** Sources that are currently audible, with the gain node that fades them. */
  private readonly voices = new Map<MusicSourceNodeLike, MusicGainNodeLike>();
  private current: MusicCueId | null = null;
  private volume = 1;
  private enabled = true;
  private ducked = false;
  private token = 0;
  private disposed = false;

  private readonly decoded = new Map<string, Promise<unknown>>();
  private readonly failed = new Set<string>();
  private readonly warned = new Set<string>();

  constructor(options: MusicPlayerOptions = {}) {
    this.manifest = options.manifest ?? MUSIC_MANIFEST;
    this.createContext = options.createContext ?? browserContext;
    this.loadBuffer = options.loadBuffer ?? fetchArrayBuffer;
    this.log = options.log ?? ((...args) => console.warn(...args));
  }

  /** The cue the player was last asked to play (it may be silent while its file loads). */
  currentCue(): MusicCueId | null {
    return this.current;
  }

  /** True when no audio context could be created (jsdom, blocked audio). */
  isSilent(): boolean {
    return this.ensure() === null;
  }

  /** Browser autoplay policy: call from a user gesture (click, key press) once. */
  resume(): void {
    void this.ctx?.resume?.().catch(() => undefined);
  }

  /** 0..1 from the player's settings. The manifest gain is applied on top of it. */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyMaster(120);
  }

  /** The sound switch. False fades everything to silence. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyMaster(150);
  }

  /** Voice playing: lower the music by the manifest's ducking amount. */
  setDucked(ducked: boolean): void {
    if (this.ducked === ducked) return;
    this.ducked = ducked;
    const ctx = this.ensure();
    if (!ctx || !this.duck) return;
    const factor = this.ducked ? 10 ** (this.manifest.voiceDuckDb / 20) : 1;
    this.ramp(this.duck.gain, factor, 250);
  }

  /**
   * Crossfade to a cue. The same cue that is already playing is ignored; `null` fades to silence.
   * Missing files leave the player silent for that cue, without throwing or retrying every frame.
   */
  play(cueId: MusicCueId, fadeMs: number = this.manifest.crossfadeMs.default): void {
    if (this.disposed) return;
    const cue = findMusicCue(cueId);
    if (!cue) {
      this.stop(fadeMs);
      return;
    }
    if (this.current === cueId && this.voices.size > 0) return;
    this.current = cueId;

    const ctx = this.ensure();
    if (!ctx || !this.duck) return;

    const token = ++this.token;
    this.fadeOutVoices(fadeMs);

    void this.load(cueId)
      .then((buffer) => {
        if (this.disposed || token !== this.token || this.current !== cueId) return;
        if (!this.ctx || !this.duck) return;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = cue.loop;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.duck);
        this.voices.set(source, gain);
        source.onended = () => {
          this.voices.delete(source);
          try {
            source.disconnect();
            gain.disconnect();
          } catch {
            // A disconnected node may throw in older browsers; nothing to do.
          }
        };
        source.start();
        this.ramp(gain.gain, cueGain(cue), fadeMs);
      })
      .catch((error: unknown) => {
        if (this.failed.has(cueId) && this.warned.has(cueId)) return;
        this.failed.add(cueId);
        if (!this.warned.has(cueId)) {
          this.warned.add(cueId);
          this.log(`[music] ${cueId}: no clip, staying silent (${String(error)})`);
        }
      });
  }

  /** Fade everything out; the next `play` starts clean. */
  stop(fadeMs: number = this.manifest.crossfadeMs.default): void {
    this.current = null;
    this.token += 1;
    this.fadeOutVoices(fadeMs);
  }

  /** Stop everything and release the audio context. Safe to call twice. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.current = null;
    this.token += 1;
    for (const [source, gain] of this.voices) {
      try {
        gain.gain.value = 0;
        source.stop();
        source.disconnect();
        gain.disconnect();
      } catch {
        // already stopped
      }
    }
    this.voices.clear();
    try {
      this.master?.disconnect();
      this.duck?.disconnect();
    } catch {
      // ignore
    }
    this.master = null;
    this.duck = null;
    this.decoded.clear();
    void this.ctx?.close?.().catch(() => undefined);
    this.ctx = null;
  }

  private ensure(): MusicContextLike | null {
    if (this.disposed) return null;
    if (this.ctx) return this.ctx;
    const ctx = this.createContext();
    if (!ctx) return null;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.duck.gain.value = this.ducked ? 10 ** (this.manifest.voiceDuckDb / 20) : 1;
    return ctx;
  }

  private applyMaster(ms: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.ramp(this.master.gain, this.enabled ? this.volume : 0, ms);
  }

  private ramp(param: MusicGainParamLike, target: number, ms: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + Math.max(0, ms) / 1000);
  }

  private fadeOutVoices(ms: number): void {
    const ctx = this.ctx;
    if (!ctx || this.voices.size === 0) return;
    const stopAt = ctx.currentTime + Math.max(0, ms) / 1000 + 0.02;
    for (const [source, gain] of this.voices) {
      this.ramp(gain.gain, 0, ms);
      try {
        source.stop(stopAt);
      } catch {
        // A source that never started throws; it is dropped below anyway.
      }
    }
    this.voices.clear();
  }

  private load(cueId: MusicCueId): Promise<unknown> {
    const cue = findMusicCue(cueId);
    if (!cue) return Promise.reject(new Error(`unknown cue ${cueId}`));
    if (this.failed.has(cueId)) return Promise.reject(new Error(`cue ${cueId} unavailable`));
    const cached = this.decoded.get(cueId);
    if (cached) return cached;

    const url = musicCueUrl(cue);
    const ctx = this.ensure();
    if (!ctx) return Promise.reject(new Error("no audio context"));

    const promise = this.loadBuffer(url).then((data) => ctx.decodeAudioData(data));
    this.decoded.set(cueId, promise);
    promise.catch(() => {
      this.decoded.delete(cueId);
      this.failed.add(cueId);
    });
    return promise;
  }
}
