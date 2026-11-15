// Connects a device overlay to the projected 3D screen. The layer provides a `ScreenQuadSource`
// (backed by the room engine through the story bridge); `useScreenQuad` turns its corners and the
// window size into one `ScreenLayout`: "surface" (HTML mapped onto the device screen) or "panel"
// (the flat dialog). Without a provider, or without a visible quad, the answer is always "panel".
import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import { useViewport } from "../call/useViewport";
import { decideScreenLayout, type ScreenDevice, type ScreenLayout } from "./screenLayout";

/** Four viewport corners in CSS pixels: top-left, top-right, bottom-right, bottom-left (x, y each). */
export type ScreenCorners = readonly number[];

export interface ScreenQuadSource {
  /** Starts following the device screen. Returns the function that stops it. */
  watch(device: ScreenDevice, listener: (corners: ScreenCorners | null) => void): () => void;
}

export const ScreenQuadContext = createContext<ScreenQuadSource | null>(null);

export function useScreenQuad(device: ScreenDevice): ScreenLayout {
  const source = useContext(ScreenQuadContext);
  const viewport = useViewport();
  const [corners, setCorners] = useState<ScreenCorners | null>(null);

  // A layout effect, so the first quad is applied before the first paint (no flash of the flat panel).
  useLayoutEffect(() => {
    if (source === null) return undefined;
    return source.watch(device, setCorners);
  }, [source, device]);

  return useMemo(() => decideScreenLayout(corners, viewport, device), [corners, viewport, device]);
}
