// Optional computer voice for conversation lines, read by the browser's `speechSynthesis`.
// The game has no recorded clips for these lines, so the interface always says the voice is
// synthetic. It only speaks when the player presses Listen, never by itself, and it stays silent
// when the browser has no voice for the locale. Presentation only: it never touches game state.
import type { GameLocale } from "@scammaze/shared-types";
import { pickPreviewVoice } from "../../../game/voice/devSpeechPreview";

/** True when this browser can speak at all. */
export function canSpeakSynthetic(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

/** Stops any line that is being read. */
export function stopSynthetic(): void {
  if (canSpeakSynthetic()) window.speechSynthesis.cancel();
}

/**
 * Reads one line aloud. Returns false (and says nothing) when there is no voice for the locale.
 * `onEnd` runs when the line ends or is stopped.
 */
export function speakSynthetic(text: string, locale: GameLocale, onEnd: () => void): boolean {
  if (!canSpeakSynthetic()) return false;
  const synth = window.speechSynthesis;
  const voice = pickPreviewVoice(synth.getVoices(), locale);
  if (voice === null) return false;
  synth.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  synth.speak(utterance);
  return true;
}
