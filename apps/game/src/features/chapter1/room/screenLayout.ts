/**
 * Decides whether a device overlay (laptop or phone records) is drawn on the projected 3D screen or as
 * the flat panel, and builds the CSS matrix for the first case. Pure TypeScript: no React, three or i18n.
 * It reuses the quad-to-matrix math of the 3D phone call screen (`call/screenQuad.ts`).
 */
import { applyHomography, quadHomography, quadSize, quadToMatrix3d, type ScreenQuad } from "../call/screenQuad";

export type ScreenDevice = "laptop" | "phone";

/** Fixed logical size of the HTML content for each device. Its aspect matches the 3D screen plane. */
export const LOGICAL_SIZE: Record<ScreenDevice, { width: number; height: number }> = {
  // The laptop display plane is 0.294 m x 0.184 m (16:10).
  laptop: { width: 960, height: 600 },
  // The phone display plane is 0.067 m x 0.146 m.
  phone: { width: 320, height: 697 },
};

/** Below this viewport width the flat panel is used. */
export const MIN_SURFACE_VIEWPORT_WIDTH = 800;
/** Smallest base text size (px) the surface may show, and the effective size below which it falls back. */
export const BASE_TEXT_PX = 14;
export const MIN_EFFECTIVE_TEXT_PX = 12;
/** Smallest scale (projected size divided by logical size) at which 14 px text is still 12 px. */
export const MIN_SURFACE_SCALE = MIN_EFFECTIVE_TEXT_PX / BASE_TEXT_PX;

export type PanelReason = "no-quad" | "narrow-viewport" | "portrait-viewport" | "degenerate" | "too-small";

export type ScreenLayout =
  | { mode: "panel"; reason: PanelReason }
  | {
      mode: "surface";
      /** CSS `matrix3d(...)` for an element of the logical size, with `transform-origin: 0 0`. */
      matrix: string;
      width: number;
      height: number;
      /** Projected size divided by logical size (the smaller of the width and height ratios). */
      scale: number;
    };

export interface LayoutViewport {
  width: number;
  height: number;
}

/** Eight numbers (x, y per corner: top-left, top-right, bottom-right, bottom-left) to a quad. */
export function cornersToQuad(c: ArrayLike<number>): ScreenQuad {
  return [
    { x: c[0], y: c[1] },
    { x: c[2], y: c[3] },
    { x: c[4], y: c[5] },
    { x: c[6], y: c[7] },
  ];
}

/** Signed shoelace area; positive for the expected clockwise-on-screen order (y grows downwards). */
function signedArea(q: ScreenQuad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function decideScreenLayout(
  corners: ArrayLike<number> | null,
  viewport: LayoutViewport,
  device: ScreenDevice,
): ScreenLayout {
  if (corners === null || corners.length < 8 || !Array.from(corners).slice(0, 8).every(Number.isFinite)) {
    return { mode: "panel", reason: "no-quad" };
  }
  if (viewport.width < MIN_SURFACE_VIEWPORT_WIDTH) return { mode: "panel", reason: "narrow-viewport" };
  if (viewport.height > viewport.width) return { mode: "panel", reason: "portrait-viewport" };
  const quad = cornersToQuad(corners);
  const logical = LOGICAL_SIZE[device];
  // A mirrored or collapsed quad cannot carry readable content.
  if (!(signedArea(quad) > 1) || quadHomography(logical.width, logical.height, quad) === null) {
    return { mode: "panel", reason: "degenerate" };
  }
  const size = quadSize(quad);
  const scale = Math.min(size.width / logical.width, size.height / logical.height);
  if (!(scale >= MIN_SURFACE_SCALE)) return { mode: "panel", reason: "too-small" };
  const matrix = quadToMatrix3d(logical.width, logical.height, quad);
  if (matrix === null) return { mode: "panel", reason: "degenerate" };
  return { mode: "surface", matrix, width: logical.width, height: logical.height, scale };
}

/** Applies the layout homography to a logical point; used by tests to check the corners land on the quad. */
export function mapLogicalPoint(corners: ArrayLike<number>, device: ScreenDevice, x: number, y: number) {
  const logical = LOGICAL_SIZE[device];
  const m = quadHomography(logical.width, logical.height, cornersToQuad(corners));
  return m === null ? null : applyHomography(m, x, y);
}
