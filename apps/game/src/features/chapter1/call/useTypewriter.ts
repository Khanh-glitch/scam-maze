// Typewriter reveal of the caller line in the in-room call. Presentation only.
// With a voice clip the speed follows its duration so the text ends with the voice; otherwise the
// speed matches the other typed text in the game (`chapter1/intro/useIntroNarration`, text-only
// lines). Skipping (F or a click, see `CallPresentation`) shows the whole line at once. With reduced
// motion, or when there is nothing to type, the line is complete at once.
import { useCallback, useEffect, useRef, useState } from "react";

/** Characters per second, the same as a text-only intro line. */
export const TYPEWRITER_CPS = 38;
const TICK_MS = 30;
/** Bounds for a speed derived from a voice clip, so an odd duration never freezes or flashes the line. */
const MIN_CPS = 8;
const MAX_CPS = 120;

/**
 * Speed that reveals `total` characters over `durationMs` (the generated voice clip), or the fixed
 * `TYPEWRITER_CPS` when there is no usable duration (no clip, muted, not loaded yet).
 */
export function typewriterCps(total: number, durationMs: number | null | undefined): number {
  if (durationMs === null || durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) {
    return TYPEWRITER_CPS;
  }
  return Math.min(MAX_CPS, Math.max(MIN_CPS, total / (durationMs / 1000)));
}

export interface Typewriter {
  /** Number of characters (code points) revealed so far. */
  count: number;
  /** True once every character is revealed (also when there is no text). */
  complete: boolean;
  /** Reveals the rest of the line at once. */
  skip: () => void;
}

/**
 * Reveals `text` progressively. Restarts when `key` changes. `text` null means no line to type
 * (complete). `instant` shows the whole line at once.
 */
export function useTypewriter(
  key: string,
  text: string | null,
  instant: boolean,
  durationMs: number | null = null,
): Typewriter {
  const total = text === null ? 0 : Array.from(text).length;
  const [state, setState] = useState<{ key: string; count: number }>({ key, count: 0 });
  // A new key starts from zero in the same render, so the old count is never used for the new line.
  const count = instant || total === 0 ? total : state.key === key ? Math.min(state.count, total) : 0;
  const complete = count >= total;
  // Read on every tick, so a duration that arrives mid-line changes the speed without a jump back.
  const cpsRef = useRef(TYPEWRITER_CPS);
  cpsRef.current = typewriterCps(total, durationMs);

  useEffect(() => {
    if (instant || complete) return undefined;
    let last = performance.now();
    let progress = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      progress += ((now - last) / 1000) * cpsRef.current;
      last = now;
      const next = Math.floor(progress);
      setState((current) => {
        const count = Math.min(total, next);
        return current.key === key && current.count === count ? current : { key, count };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [key, total, instant, complete]);

  const skip = useCallback(() => setState({ key, count: total }), [key, total]);
  return { count, complete, skip };
}
