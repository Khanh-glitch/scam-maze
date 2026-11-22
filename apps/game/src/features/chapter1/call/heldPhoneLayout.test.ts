// The held phone (P): low on the right, clear of the chip row, the same screen shape as in a call.
import { describe, expect, it } from "vitest";
import { HELD_BOTTOM_INSET, HELD_CENTER_X_RATIO, SCREEN_ASPECT, computeCallLayout, heldPhoneLayout } from "./callLayout";
import { ENTRY_DURATION_MS, heldPhoneRiseOffset } from "./phoneMotion";

describe("heldPhoneLayout", () => {
  it("puts the screen low and right of center in a wide viewport, above the chip row", () => {
    const viewport = { width: 1440, height: 810 };
    const { screen } = heldPhoneLayout(viewport);
    expect(screen.left + screen.width / 2).toBeGreaterThan(viewport.width / 2);
    expect(screen.left + screen.width).toBeLessThanOrEqual(viewport.width - 24);
    expect(screen.top + screen.height).toBeCloseTo(viewport.height - HELD_BOTTOM_INSET);
    expect(screen.width / screen.height).toBeCloseTo(SCREEN_ASPECT);
    expect(screen.height).toBeLessThan(computeCallLayout(viewport).screen.height);
    // Where the right hand holds it: right of center, not against the edge.
    expect(screen.left + screen.width / 2).toBeCloseTo(HELD_CENTER_X_RATIO * viewport.width);
  });
  it("rises from just below the view into place, and stays put with reduced motion", () => {
    const viewport = { width: 1440, height: 810 };
    const layout = heldPhoneLayout(viewport);
    const at = (elapsedMs: number, reducedMotion = false) => heldPhoneRiseOffset({ elapsedMs, animateEntry: true, reducedMotion, layout, viewport });
    expect(layout.screen.top + at(0)).toBeCloseTo(viewport.height);
    expect(at(ENTRY_DURATION_MS / 2)).toBeGreaterThan(0);
    expect(at(ENTRY_DURATION_MS / 2)).toBeLessThan(at(0));
    expect(at(ENTRY_DURATION_MS)).toBe(0);
    expect(at(0, true)).toBe(0);
  });

  it("keeps the call layout on a narrow viewport", () => {
    const viewport = { width: 390, height: 800 };
    expect(heldPhoneLayout(viewport).screen).toEqual(computeCallLayout(viewport).screen);
  });
});
