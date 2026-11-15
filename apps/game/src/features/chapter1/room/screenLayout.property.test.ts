// Properties of the surface/panel decision and of the matrix: the logical corners land exactly on the
// projected quad, and every degenerate, narrow or too-small input falls back to the panel.
import { describe, expect, it } from "vitest";
import { createLcg } from "../../../test/seededRandom";
import {
  LOGICAL_SIZE,
  MIN_SURFACE_SCALE,
  decideScreenLayout,
  mapLogicalPoint,
  type ScreenDevice,
} from "./screenLayout";

const CASES = 200;
const BASE_SEED = 0x7a11e5c0;
const DEVICES: ScreenDevice[] = ["laptop", "phone"];
const VIEWPORT = { width: 1280, height: 720 };

function randomIn(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

/** A convex, clockwise-on-screen quad of roughly `scale` times the logical size, mildly keystoned. */
function makeCorners(next: () => number, device: ScreenDevice, scale: number): number[] {
  const { width, height } = LOGICAL_SIZE[device];
  const w = width * scale;
  const h = height * scale;
  const left = randomIn(next, 20, 200);
  const top = randomIn(next, 10, 60);
  const k = () => randomIn(next, -0.04, 0.04);
  return [
    left + w * (0.03 + k()), top + h * k(),
    left + w * (1 - 0.03 + k()), top + h * k(),
    left + w * (1 + k()), top + h * (1 + k()),
    left + w * k(), top + h * (1 + k()),
  ];
}

describe("screenLayout", () => {
  it("maps the logical corners exactly onto the projected quad (surface mode)", () => {
    for (let index = 0; index < CASES; index += 1) {
      const seed = (BASE_SEED + index) >>> 0;
      const next = createLcg(seed);
      const device = DEVICES[index % 2];
      const corners = makeCorners(next, device, randomIn(next, 1.0, 1.3));
      const layout = decideScreenLayout(corners, VIEWPORT, device);
      const message = `seed=${seed} device=${device}`;
      expect(layout.mode, message).toBe("surface");
      if (layout.mode !== "surface") continue;
      expect(layout.matrix, message).toMatch(/^matrix3d\(/);
      expect(layout.scale, message).toBeGreaterThanOrEqual(MIN_SURFACE_SCALE);
      const { width, height } = LOGICAL_SIZE[device];
      const targets: Array<[number, number, number, number]> = [
        [0, 0, corners[0], corners[1]],
        [width, 0, corners[2], corners[3]],
        [width, height, corners[4], corners[5]],
        [0, height, corners[6], corners[7]],
      ];
      for (const [x, y, ex, ey] of targets) {
        const p = mapLogicalPoint(corners, device, x, y);
        expect(p, message).not.toBeNull();
        expect(p!.x, message).toBeCloseTo(ex, 5);
        expect(p!.y, message).toBeCloseTo(ey, 5);
      }
    }
  });

  it("falls back to the panel for a missing quad, narrow or portrait viewports, and tiny quads", () => {
    for (let index = 0; index < CASES; index += 1) {
      const seed = (BASE_SEED + 5000 + index) >>> 0;
      const next = createLcg(seed);
      const device = DEVICES[index % 2];
      const good = makeCorners(next, device, 1.1);
      const message = `seed=${seed} device=${device}`;
      expect(decideScreenLayout(null, VIEWPORT, device), message).toEqual({ mode: "panel", reason: "no-quad" });
      expect(decideScreenLayout(good, { width: Math.floor(randomIn(next, 300, 799)), height: 700 }, device), message).toEqual({
        mode: "panel",
        reason: "narrow-viewport",
      });
      expect(decideScreenLayout(good, { width: 900, height: 1200 }, device), message).toEqual({
        mode: "panel",
        reason: "portrait-viewport",
      });
      const tiny = makeCorners(next, device, randomIn(next, 0.2, 0.8));
      const layout = decideScreenLayout(tiny, VIEWPORT, device);
      expect(layout.mode === "panel", message).toBe(true);
      const nan = [...good];
      nan[Math.floor(next() * 8)] = Number.NaN;
      expect(decideScreenLayout(nan, VIEWPORT, device), message).toEqual({ mode: "panel", reason: "no-quad" });
    }
  });

  it("rejects a mirrored quad and a collapsed quad", () => {
    const mirrored = [100, 100, 0, 100, 0, 700, 100, 700];
    expect(decideScreenLayout(mirrored, VIEWPORT, "phone")).toEqual({ mode: "panel", reason: "degenerate" });
    const point = [50, 50, 50, 50, 50, 50, 50, 50];
    expect(decideScreenLayout(point, VIEWPORT, "laptop").mode).toBe("panel");
  });

  it("uses the surface at the documented 1280x720 laptop and phone sizes", () => {
    // About 75 percent of the width for the laptop and 85 percent of the height for the phone (computed by the engine poses).
    const laptop = [167, 79, 1107, 79, 1140, 670, 134, 670];
    const phone = [490, 40, 800, 40, 820, 650, 470, 650];
    const a = decideScreenLayout(laptop, VIEWPORT, "laptop");
    const b = decideScreenLayout(phone, VIEWPORT, "phone");
    expect(a.mode).toBe("surface");
    expect(b.mode).toBe("surface");
  });
});
