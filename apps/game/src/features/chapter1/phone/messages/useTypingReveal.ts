// Shows the new lines of a conversation one after the other: the lines of Alex at once, the lines
// of the other side after a short "typing" moment. Presentation only. The game state already holds
// every line; this decides when the screen shows them, so a reply feels like a conversation.
//   - Lines that already exist when the screen opens (a saved game, coming back to the app) are shown
//     at once, with no typing.
//   - With reduced motion every line is shown at once.
import { useEffect, useState } from "react";

/** Typing time for a line: a short base and a little more for long lines. */
export function typingDelayMs(text: string): number {
  return Math.min(1500, 450 + text.length * 7);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface TypingReveal {
  /** How many lines are on screen. */
  shown: number;
  /** True while the other side is "typing" the next line. */
  typing: boolean;
}

export function useTypingReveal(lines: ReadonlyArray<{ speaker: "alex" | "other"; text: string }>): TypingReveal {
  const [shown, setShown] = useState(lines.length);
  const [typing, setTyping] = useState(false);
  const count = lines.length;
  useEffect(() => {
    if (count < shown) {
      setShown(count);
      setTyping(false);
      return undefined;
    }
    if (shown >= count) {
      setTyping(false);
      return undefined;
    }
    const next = lines[shown];
    if (next.speaker === "alex" || prefersReducedMotion()) {
      setShown(shown + 1);
      return undefined;
    }
    setTyping(true);
    const id = window.setTimeout(() => {
      setTyping(false);
      setShown(shown + 1);
    }, typingDelayMs(next.text));
    return () => window.clearTimeout(id);
    // `lines` changes identity on every state change; its length and the shown count drive the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, shown]);
  return { shown: Math.min(shown, count), typing };
}
