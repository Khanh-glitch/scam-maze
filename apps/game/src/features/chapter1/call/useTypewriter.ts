// Typewriter reveal of the caller line in the in-room call. Presentation only.
// The speed matches the other typed text in the game (`chapter1/intro/useIntroNarration`, text-only
// lines). Skipping (F or a click, see `CallPresentation`) shows the whole line at once. With reduced
// motion, or when there is nothing to type, the line is complete at once.
import { useCallback, useEffect, useState } from "react";

/** Characters per second, the same as a text-only intro line. */
export const TYPEWRITER_CPS = 38;
const TICK_MS = 30;

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
export function useTypewriter(key: string, text: string | null, instant: boolean): Typewriter {
  const total = text === null ? 0 : Array.from(text).length;
  const [state, setState] = useState<{ key: string; count: number }>({ key, count: 0 });
  // A new key starts from zero in the same render, so the old count is never used for the new line.
  const count = instant || total === 0 ? total : state.key === key ? Math.min(state.count, total) : 0;
  const complete = count >= total;

  useEffect(() => {
    if (instant || complete) return undefined;
    const startedAt = performance.now();
    const id = window.setInterval(() => {
      const next = Math.floor(((performance.now() - startedAt) / 1000) * TYPEWRITER_CPS);
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
