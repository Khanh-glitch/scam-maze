// The walkable footprint of the Saigon open world, as data. `saigonDistricts` uses this for
// `isWithinOpenWorld`; the audit script and `openWorldBounds.test.ts` read the same file, so the
// area and the shape written in the docs are the ones the player actually walks on.
//
// Coordinates are world metres. One unit = one metre, X grows east, Z grows south.
import raw from "./openWorldBounds.json";

export interface BoundsRect {
  id: string;
  name: string;
  district: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface MapPoi {
  id: string;
  name: string;
  x: number;
  z: number;
}

export interface OpenWorldBoundsData {
  version: number;
  units: string;
  note: string;
  rects: BoundsRect[];
  pois: MapPoi[];
  walkSpeedMetresPerSecond: number;
}

export const OPEN_WORLD_BOUNDS = raw as OpenWorldBoundsData;

export function insideRect(rect: BoundsRect, x: number, z: number): boolean {
  return x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1;
}

/** True inside any walkable rectangle. This is the single source of truth for the map's edge. */
export function isWithinOpenWorld(x: number, z: number): boolean {
  return OPEN_WORLD_BOUNDS.rects.some((rect) => insideRect(rect, x, z));
}

export interface BoundsBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  width: number;
  depth: number;
}

/** The box that encloses every walkable rectangle (not the walkable area itself). */
export function openWorldBoundingBox(): BoundsBox {
  const rects = OPEN_WORLD_BOUNDS.rects;
  const x0 = Math.min(...rects.map((rect) => rect.x0));
  const x1 = Math.max(...rects.map((rect) => rect.x1));
  const z0 = Math.min(...rects.map((rect) => rect.z0));
  const z1 = Math.max(...rects.map((rect) => rect.z1));
  return { x0, x1, z0, z1, width: x1 - x0, depth: z1 - z0 };
}

export function rectArea(rect: BoundsRect): number {
  return (rect.x1 - rect.x0) * (rect.z1 - rect.z0);
}

/** How much two rectangles share, in square metres (0 when they only touch). */
export function rectOverlapArea(a: BoundsRect, b: BoundsRect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const d = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return w > 0 && d > 0 ? w * d : 0;
}
