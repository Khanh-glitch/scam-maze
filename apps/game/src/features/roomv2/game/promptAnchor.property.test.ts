// Pure parts of the world-anchored interaction prompt: where the box goes (`placePrompt`) and when
// the engine reports a new anchor (`anchorMoved`).
import { describe, expect, it } from "vitest";
import { createLcg } from "../../../test/seededRandom";
import { ANCHOR_TOLERANCE_PX, anchorMoved, placePrompt } from "./screenProjection";

const CASES = 200;
const SEED = 0xa4c40a11;

function randomIn(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

describe("placePrompt", () => {
  it("keeps the box inside the viewport with the margin, for any anchor", () => {
    const next = createLcg(SEED);
    for (let index = 0; index < CASES; index += 1) {
      const vw = randomIn(next, 480, 2560);
      const vh = randomIn(next, 360, 1440);
      const width = randomIn(next, 120, 260);
      const height = randomIn(next, 24, 48);
      const margin = randomIn(next, 4, 20);
      const offset = randomIn(next, 8, 40);
      // Anchors may be anywhere, also slightly outside the viewport.
      const ax = randomIn(next, -100, vw + 100);
      const ay = randomIn(next, -100, vh + 100);
      const label = `seed ${SEED.toString(16)} case ${index}, ${JSON.stringify({ vw, vh, width, height, margin, offset, ax, ay })}`;
      const { left, top } = placePrompt(ax, ay, vw, vh, width, height, offset, margin);
      expect(left, label).toBeGreaterThanOrEqual(margin - 1e-9);
      expect(top, label).toBeGreaterThanOrEqual(margin - 1e-9);
      expect(left + width, label).toBeLessThanOrEqual(vw - margin + 1e-9);
      expect(top + height, label).toBeLessThanOrEqual(vh - margin + 1e-9);
    }
  });

  it("puts the box to the right of the anchor by the offset when there is room, centered vertically", () => {
    const { left, top } = placePrompt(300, 200, 1280, 720, 200, 32, 22, 12);
    expect(left).toBe(322);
    expect(top).toBe(184);
  });

  it("flips to the left side when the right side would leave the viewport", () => {
    const { left } = placePrompt(1200, 200, 1280, 720, 200, 32, 22, 12);
    expect(left).toBe(1200 - 22 - 200);
  });
});

describe("anchorMoved", () => {
  it("reports an appearing or disappearing anchor", () => {
    expect(anchorMoved(null, 10, 10, ANCHOR_TOLERANCE_PX)).toBe(true);
    expect(anchorMoved({ x: 10, y: 10 }, null, null, ANCHOR_TOLERANCE_PX)).toBe(true);
    expect(anchorMoved(null, null, null, ANCHOR_TOLERANCE_PX)).toBe(false);
  });

  it("reports a move only beyond the tolerance (0.5 px)", () => {
    expect(ANCHOR_TOLERANCE_PX).toBe(0.5);
    expect(anchorMoved({ x: 100, y: 100 }, 100.4, 99.6, ANCHOR_TOLERANCE_PX)).toBe(false);
    expect(anchorMoved({ x: 100, y: 100 }, 100.6, 100, ANCHOR_TOLERANCE_PX)).toBe(true);
    expect(anchorMoved({ x: 100, y: 100 }, 100, 99.4, ANCHOR_TOLERANCE_PX)).toBe(true);
  });

  it("never reports a change for identical positions", () => {
    const next = createLcg(SEED + 1);
    for (let index = 0; index < CASES; index += 1) {
      const x = randomIn(next, 0, 2000);
      const y = randomIn(next, 0, 1200);
      expect(anchorMoved({ x, y }, x, y, ANCHOR_TOLERANCE_PX), `seed ${(SEED + 1).toString(16)} case ${index}`).toBe(false);
    }
  });
});
