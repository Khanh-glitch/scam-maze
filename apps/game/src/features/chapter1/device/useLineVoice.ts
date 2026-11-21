// React view of the line voice: which line plays now. Used by the lines (to show Stop) and by the
// layer (Alex's story voice waits while a line plays, so the two never overlap).
import { useSyncExternalStore } from "react";
import { lineVoiceKey, subscribeLineVoice } from "./lineVoice";

/** The key of the playing line, or null. */
export function useLineVoiceKey(): string | null {
  return useSyncExternalStore(subscribeLineVoice, lineVoiceKey, () => null);
}

/** True while any conversation line plays. */
export function useLineVoiceActive(): boolean {
  return useLineVoiceKey() !== null;
}
