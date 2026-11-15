// Wrapper that places a device overlay either on the projected 3D screen ("surface") or in the
// flat panel layout ("panel"). The children are the same accessible dialog in both cases, so
// role, accessible name, focus trap, Escape and focus return stay with the overlay itself.
// In surface mode the content is a fixed-size element mapped by a CSS `matrix3d`; pointer events
// work normally under a 3D transform. A thin glass layer is drawn over it and does not take clicks.
import React from "react";
import type { ScreenLayout, ScreenDevice } from "./screenLayout";

export interface ScreenSurfaceProps {
  layout: ScreenLayout;
  device: ScreenDevice;
  /** Classes of the full-screen wrapper in panel mode (the original backdrop). */
  panelWrapperClassName: string;
  children: React.ReactNode;
}

/** Corner radius in logical pixels, matched to the bezel of each model. */
const CORNER_RADIUS: Record<ScreenDevice, number> = { laptop: 6, phone: 34 };

const GLASS =
  "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 32%), " +
  "radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(0,0,0,0.28) 100%)";

export const ScreenSurface: React.FC<ScreenSurfaceProps> = ({ layout, device, panelWrapperClassName, children }) => {
  const surface = layout.mode === "surface";
  // One fixed element structure in both modes, so switching mode never remounts the dialog (focus and
  // local state stay). Panel mode: the wrapper is the original backdrop and the middle element has no box.
  return (
    // In surface mode the full-screen layer is transparent. It keeps clicks off the 3D view while the overlay is open.
    <div
      className={surface ? "fixed inset-0 z-40" : panelWrapperClassName}
      data-screen-mode={layout.mode}
      data-screen-device={device}
    >
      <div
        className={surface ? undefined : "contents"}
        data-testid={surface ? `screen-surface-${device}` : undefined}
        style={
          layout.mode === "surface"
            ? {
                position: "absolute",
                left: 0,
                top: 0,
                width: layout.width,
                height: layout.height,
                transformOrigin: "0 0",
                transform: layout.matrix,
                pointerEvents: "auto",
                overflow: "hidden",
                borderRadius: CORNER_RADIUS[device],
                background: "#12101c",
              }
            : undefined
        }
      >
        {children}
        {surface && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: GLASS, borderRadius: "inherit" }} />
        )}
      </div>
    </div>
  );};
