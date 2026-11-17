import { describe, expect, it } from "vitest";
import { buildGrid, findPath, lineWalkable, nearestWalkable, pathLength, resamplePath, trimEnd } from "./pathfinding";

/** A 20 x 10 m field with a wall at x = 10 that has a gap at z in [8, 10). */
const wall = (x: number, z: number) => !(x >= 9.5 && x < 10.5 && z < 8);
const grid = () => buildGrid(0, 0, 20, 10, 0.5, wall);

describe("pathfinding", () => {
  it("goes straight when nothing is in the way", () => {
    const g = buildGrid(0, 0, 20, 10, 0.5, () => true);
    const path = findPath(g, { x: 1, z: 1 }, { x: 18, z: 9 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
    expect(pathLength(path!)).toBeCloseTo(Math.hypot(17, 8), 3);
  });
  it("goes around a wall through its gap and never crosses a blocked cell", () => {
    const g = grid();
    const path = findPath(g, { x: 2, z: 2 }, { x: 18, z: 2 })!;
    expect(path).not.toBeNull();
    expect(pathLength(path)).toBeGreaterThan(16);
    for (let i = 1; i < path.length; i++) expect(lineWalkable(g, path[i - 1], path[i])).toBe(true);
    expect(path.some((p) => p.z >= 7.5)).toBe(true);
  });
  it("returns null when the goal region is closed off", () => {
    const g = buildGrid(0, 0, 20, 10, 0.5, (x) => !(x >= 9.5 && x < 10.5));
    expect(findPath(g, { x: 2, z: 2 }, { x: 18, z: 2 })).toBeNull();
  });
  it("snaps a blocked start or goal to the nearest walkable cell", () => {
    const g = grid();
    expect(nearestWalkable(g, 10, 2)).toBeGreaterThanOrEqual(0);
    expect(findPath(g, { x: 10, z: 2 }, { x: 18, z: 2 })).not.toBeNull();
  });
  it("resamples at a fixed step and keeps both ends", () => {
    const pts = resamplePath([{ x: 0, z: 0 }, { x: 10, z: 0 }], 2);
    expect(pts.map((p) => p.d)).toEqual([0, 2, 4, 6, 8, 10]);
    const odd = resamplePath([{ x: 0, z: 0 }, { x: 5, z: 0 }], 2);
    expect(odd[odd.length - 1]).toEqual({ x: 5, z: 0, d: 5 });
  });
  it("trims the end of a path by a distance", () => {
    const path = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
    expect(pathLength(trimEnd(path, 4))).toBeCloseTo(16, 5);
    expect(trimEnd(path, 100)).toHaveLength(1);
  });
});
