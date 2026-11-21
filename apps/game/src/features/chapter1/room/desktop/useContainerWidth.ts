import { useLayoutEffect, useState, type RefObject } from "react";

/** True when the element is at least `minPx` wide. Follows resizes; false where `ResizeObserver` is missing. */
export function useIsWide(ref: RefObject<HTMLElement | null>, minPx: number): boolean {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWide(el.clientWidth >= minPx);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, minPx]);
  return wide;
}
