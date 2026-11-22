// The held phone (P): low on the right, clear of the chip row, the same screen shape as in a call.
import { describe, expect, it } from "vitest";
import { HELD_BOTTOM_INSET, SCREEN_ASPECT, computeCallLayout, heldPhoneLayout } from "./callLayout";

describe("heldPhoneLayout", () => {
  it("puts the screen in the lower right of a wide viewport, above the chip row", () => {
    const viewport = { width: 1440, height: 810 };
    const { screen } = heldPhoneLayout(viewport);
    expect(screen.left).toBeGreaterThan(viewport.width / 2);
    expect(screen.left + screen.width).toBeLessThanOrEqual(viewport.width - 24);
    expect(screen.top + screen.height).toBeCloseTo(viewport.height - HELD_BOTTOM_INSET);
    expect(screen.width / screen.height).toBeCloseTo(SCREEN_ASPECT);
    expect(screen.height).toBeLessThan(computeCallLayout(viewport).screen.height);
  });

  it("keeps the call layout on a narrow viewport", () => {
    const viewport = { width: 390, height: 800 };
    expect(heldPhoneLayout(viewport).screen).toEqual(computeCallLayout(viewport).screen);
  });
});
