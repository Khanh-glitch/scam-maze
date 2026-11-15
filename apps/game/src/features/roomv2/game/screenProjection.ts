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
