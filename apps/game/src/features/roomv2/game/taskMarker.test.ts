// `placeTaskMarker`: on screen at the projected point, otherwise on the edge toward the target.
import { describe, expect, it } from "vitest";
import { placeTaskMarker } from "./screenProjection";

// A camera at the origin looking down -z: clip x = x, clip y = y, w = -z (a 90° field of view).
const VIEW_PROJ = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0];
const W = 800;
const H = 600;
const MARGIN = 40;

describe("placeTaskMarker", () => {
  it("puts a target in view at its projected point", () => {
    expect(placeTaskMarker(VIEW_PROJ, 0, 0, -2, W, H, MARGIN)).toEqual({ x: 400, y: 300, onScreen: true, angle: Math.PI / 2 });
    const right = placeTaskMarker(VIEW_PROJ, 1, 0, -2, W, H, MARGIN);
    expect(right?.onScreen).toBe(true);
    expect(right?.x).toBeCloseTo(600);
  });

  it("clamps a target outside the view to the edge it lies beyond", () => {
    const farRight = placeTaskMarker(VIEW_PROJ, 10, 0, -2, W, H, MARGIN);
    expect(farRight).toMatchObject({ onScreen: false, y: 300 });
    expect(farRight?.x).toBeCloseTo(W - MARGIN);
    expect(farRight?.angle).toBeCloseTo(0);
    const above = placeTaskMarker(VIEW_PROJ, 0, 10, -2, W, H, MARGIN);
    expect(above?.y).toBeCloseTo(MARGIN);
    expect(above?.angle).toBeCloseTo(-Math.PI / 2);
  });

  it("sends a target behind the camera to the side the player should turn to", () => {
    const behindLeft = placeTaskMarker(VIEW_PROJ, -1, 0, 3, W, H, MARGIN);
    expect(behindLeft).toMatchObject({ onScreen: false, y: 300 });
    expect(behindLeft?.x).toBeCloseTo(MARGIN);
    const behindRight = placeTaskMarker(VIEW_PROJ, 1, 2, 3, W, H, MARGIN);
    expect(behindRight?.x).toBeCloseTo(W - MARGIN);
    expect(behindRight?.y).toBeCloseTo(300);
  });

  it("returns null for an empty viewport or a broken matrix", () => {
    expect(placeTaskMarker(VIEW_PROJ, 0, 0, -2, 0, H, MARGIN)).toBeNull();
    expect(placeTaskMarker([Number.NaN, ...VIEW_PROJ.slice(1)], 0, 0, -2, W, H, MARGIN)).toBeNull();
  });
});
