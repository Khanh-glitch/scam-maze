/**
 * Pure projection helpers for the story-mode "UI on the device screen" feature. No three.js: the
 * engine passes the camera view-projection matrix as a plain column-major 16-number array (the
 * layout of `THREE.Matrix4.elements`) and the world-space corners of a screen plane.
 *
 * Corner order everywhere: top-left, top-right, bottom-right, bottom-left, as seen on the screen.
 */

/** Which device screen the story host wants to follow. */
export type ScreenDeviceId = 'laptop' | 'phone';

/** Eight numbers: x0, y0 (top-left), x1, y1 (top-right), x2, y2 (bottom-right), x3, y3 (bottom-left), in CSS pixels. */
export type ScreenCornersPx = readonly [number, number, number, number, number, number, number, number];

/** Smallest clip-space w that still counts as in front of the camera. */
const MIN_W = 1e-4;

/**
 * Projects one world-space point to CSS pixels and writes it to `out[index * 2]` and `out[index * 2 + 1]`.
 * Returns false (and writes nothing) when the point is behind the camera or not finite.
 */
export function projectPointToViewport(
  viewProjection: ArrayLike<number>,
  x: number,
  y: number,
  z: number,
  viewportWidth: number,
  viewportHeight: number,
  offsetLeft: number,
  offsetTop: number,
  out: number[],
  index: number,
): boolean {
  const m = viewProjection;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!(w > MIN_W)) return false;
  const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  const cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
  out[index * 2] = offsetLeft + ((cx + 1) / 2) * viewportWidth;
  out[index * 2 + 1] = offsetTop + ((1 - cy) / 2) * viewportHeight;
  return true;
}

/**
 * Projects four world corners (12 numbers, x y z per corner) to CSS pixels. Returns false when the
 * viewport is empty or any corner is behind the camera; `out` is only meaningful when true.
 */
export function projectCornersToViewport(
  viewProjection: ArrayLike<number>,
  worldCorners: ArrayLike<number>,
  viewportWidth: number,
  viewportHeight: number,
  offsetLeft: number,
  offsetTop: number,
  out: number[],
): boolean {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return false;
  for (let i = 0; i < 4; i++) {
    const ok = projectPointToViewport(
      viewProjection,
      worldCorners[i * 3],
      worldCorners[i * 3 + 1],
      worldCorners[i * 3 + 2],
      viewportWidth,
      viewportHeight,
      offsetLeft,
      offsetTop,
      out,
      i,
    );
    if (!ok) return false;
  }
  return true;
}

/** True when two corner sets differ by more than `tolerance` pixels in any coordinate. */
export function cornersChanged(a: ArrayLike<number>, b: ArrayLike<number>, tolerance: number): boolean {
  for (let i = 0; i < 8; i++) if (Math.abs(a[i] - b[i]) > tolerance) return true;
  return false;
}

/** A projected world point in CSS pixels, relative to the engine container. */
export interface PromptAnchor {
  x: number;
  y: number;
}

/** Distance (px) the anchored prompt must move before the engine reports it again. */
export const ANCHOR_TOLERANCE_PX = 0.5;

/** True when the anchor appeared, disappeared or moved by more than `tolerance` pixels. */
export function anchorMoved(prev: PromptAnchor | null, nextX: number | null, nextY: number | null, tolerance: number): boolean {
  if (nextX === null || nextY === null) return prev !== null;
  if (prev === null) return true;
  return Math.abs(prev.x - nextX) > tolerance || Math.abs(prev.y - nextY) > tolerance;
}

/**
 * Where to draw a prompt box of `width` x `height` next to an anchor: to the right of it with a
 * short `offset`, flipped to the left side when it would leave the viewport, vertically centered
 * on the anchor, and always inside the viewport with `margin` pixels to spare.
 */
export function placePrompt(
  anchorX: number,
  anchorY: number,
  viewportWidth: number,
  viewportHeight: number,
  width: number,
  height: number,
  offset: number,
  margin: number,
): { left: number; top: number } {
  let left = anchorX + offset;
  if (left + width > viewportWidth - margin) left = anchorX - offset - width;
  const maxLeft = Math.max(margin, viewportWidth - margin - width);
  const maxTop = Math.max(margin, viewportHeight - margin - height);
  const top = anchorY - height / 2;
  return {
    left: Math.min(Math.max(left, margin), maxLeft),
    top: Math.min(Math.max(top, margin), maxTop),
  };
}
/**
 * Where the task marker of a prop goes on screen. On screen: the projected point. Off screen or
 * behind the camera: the viewport edge (inset by `margin`) in the direction the player must turn,
 * with `angle` (radians, 0 = right, clockwise, screen axes) for the arrow. Coordinates are relative
 * to the viewport's top-left corner.
 */
export interface TaskMarkerPlacement {
  x: number;
  y: number;
  onScreen: boolean;
  angle: number;
}
export function placeTaskMarker(
  viewProjection: ArrayLike<number>,
  x: number,
  y: number,
  z: number,
  viewportWidth: number,
  viewportHeight: number,
  margin: number,
): TaskMarkerPlacement | null {
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return null;
  const m = viewProjection;
  const clipX = m[0] * x + m[4] * y + m[8] * z + m[12];
  const clipY = m[1] * x + m[5] * y + m[9] * z + m[13];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!Number.isFinite(clipX) || !Number.isFinite(clipY) || !Number.isFinite(w)) return null;
  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;
  if (w > MIN_W) {
    const px = halfW + (clipX / w) * halfW;
    const py = halfH - (clipY / w) * halfH;
    if (px >= margin && px <= viewportWidth - margin && py >= margin && py <= viewportHeight - margin) {
      return { x: px, y: py, onScreen: true, angle: Math.PI / 2 };
    }
  }
  // In front of the camera the direction from the center points at the target. Behind it, only the
  // side matters (turn left or right), so the marker sits at mid-height on that side.
  let dx = clipX;
  let dy = -clipY;
  if (w <= MIN_W) {
    dx = clipX === 0 ? 1 : Math.sign(clipX);
    dy = 0;
  } else if (dx === 0 && dy === 0) dy = 1;
  const reachX = Math.max(1, halfW - margin);
  const reachY = Math.max(1, halfH - margin);
  const scale = Math.min(dx === 0 ? Infinity : reachX / Math.abs(dx), dy === 0 ? Infinity : reachY / Math.abs(dy));
  return { x: halfW + dx * scale, y: halfH + dy * scale, onScreen: false, angle: Math.atan2(dy, dx) };
}
