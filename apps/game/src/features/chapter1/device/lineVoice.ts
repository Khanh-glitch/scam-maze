// The voice of one conversation line (a chat reply or a turn of a phone call). Presentation only:
// it never touches game state.
//   - A recorded clip comes first. When the clip for a line does not exist or cannot play, the
//     line falls back to the browser's computer voice (Listen), and when the browser has no voice
//     either, the text on screen is all there is. The text is always shown.
//   - There is one channel. Starting a line stops the one before it, so two lines never overlap.
//     Alex's story voice waits while a line plays (see `useLineVoiceActive`).
//   - Pause and resume: a hold (the game paused, a hidden tab) pauses the line where it is and the
//     end of the hold continues it.
import type { GameLocale } from "@scammaze/shared-types";
import { canSpeakSynthetic, speakSynthetic, stopSynthetic } from "./speakSynthetic";

export type LineVoiceResult = "clip" | "synthetic" | "none";

/** The part of an `HTMLAudioElement` the module uses, so tests can supply a stand-in. */
export interface LineAudio {
  src: string;
  preload: string;
  currentTime: number;
  play: () => Promise<void> | void;
  pause: () => void;
  addEventListener: (type: string, listener: () => void, options?: { once?: boolean }) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/** How long a clip may take to become playable before the line falls back. */
export const CLIP_LOAD_MS = 4000;

interface Active {
  key: string;
  kind: "clip" | "synthetic";
  audio: LineAudio | null;
  token: number;
}

let active: Active | null = null;
let token = 0;
let held = false;
const listeners = new Set<() => void>();
/** Clip urls that failed once. They are not tried again in this run. */
const missing = new Set<string>();
let makeAudio: (url: string) => LineAudio | null = (url) => (typeof Audio === "undefined" ? null : (new Audio(url) as unknown as LineAudio));
let visibilityHooked = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeLineVoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The key of the line that is playing, or null. */
export function lineVoiceKey(): string | null {
  return active === null ? null : active.key;
}

export function stopLineVoice(): void {
  const current = active;
  token += 1;
  active = null;
  if (current?.kind === "clip") current.audio?.pause();
  if (current?.kind === "synthetic") stopSynthetic();
  if (current !== null) emit();
}

function applyHold(): void {
  if (active === null) return;
  if (active.kind === "clip") {
    if (held) active.audio?.pause();
    else void Promise.resolve(active.audio?.play()).catch(() => undefined);
  } else if (canSpeakSynthetic()) {
    if (held) window.speechSynthesis.pause();
    else window.speechSynthesis.resume();
  }
}

/** Holds the line (the game is paused) or lets it continue. */
export function setLineVoiceHeld(next: boolean): void {
  if (held === next) return;
  held = next;
  applyHold();
}

function hookVisibility(): void {
  if (visibilityHooked || typeof document === "undefined") return;
  visibilityHooked = true;
  document.addEventListener("visibilitychange", () => setLineVoiceHeld(document.visibilityState === "hidden"));
}

/** Loads a clip. Resolves with the audio when it can play and with null when it cannot. */
function loadClip(url: string): Promise<LineAudio | null> {
  if (missing.has(url)) return Promise.resolve(null);
  const audio = makeAudio(url);
  if (audio === null) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onFail);
      if (!ok) missing.add(url);
      resolve(ok ? audio : null);
    };
    const onReady = () => finish(true);
    const onFail = () => finish(false);
    const timer = window.setTimeout(() => finish(false), CLIP_LOAD_MS);
    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("error", onFail, { once: true });
    audio.preload = "auto";
    audio.src = url;
  });
}

export interface PlayLineOptions {
  /** Read the line with the computer voice when there is no clip. False for lines that start by themselves. */
  synthetic: boolean;
}

/**
 * Plays one line: its clip if there is one, else (when `synthetic`) the computer voice. A new call
 * stops the line that was playing. The promise says what was used, and "none" when nothing played.
 */
export async function playLineVoice(
  key: string,
  text: string,
  locale: GameLocale,
  clipUrl: string,
  options: PlayLineOptions,
): Promise<LineVoiceResult> {
  hookVisibility();
  stopLineVoice();
  const mine = token;
  const clip = await loadClip(clipUrl);
  if (mine !== token) return "none";
  const onEnd = () => {
    if (active !== null && active.token === mine) {
      active = null;
      emit();
    }
  };
  if (clip !== null) {
    clip.currentTime = 0;
    clip.addEventListener("ended", onEnd, { once: true });
    clip.addEventListener("error", onEnd, { once: true });
    active = { key, kind: "clip", audio: clip, token: mine };
    emit();
    try {
      await Promise.resolve(clip.play());
    } catch {
      // The browser refused to start it (no gesture yet): the text stays on screen.
      onEnd();
      return "none";
    }
    if (held) applyHold();
    return "clip";
  }
  if (!options.synthetic) return "none";
  active = { key, kind: "synthetic", audio: null, token: mine };
  if (!speakSynthetic(text, locale, onEnd)) {
    active = null;
    return "none";
  }
  emit();
  if (held) applyHold();
  return "synthetic";
}

/** For tests: replaces how clips are created and forgets which clips failed. */
export function setLineAudioFactoryForTests(factory: ((url: string) => LineAudio | null) | null): void {
  makeAudio = factory ?? ((url) => (typeof Audio === "undefined" ? null : (new Audio(url) as unknown as LineAudio)));
  missing.clear();
  stopLineVoice();
  held = false;
}
