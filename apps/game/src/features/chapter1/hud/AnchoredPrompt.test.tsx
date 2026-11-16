import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CINE } from "../theme";
import { AnchoredPrompt } from "./AnchoredPrompt";

describe("AnchoredPrompt", () => {
  it("draws a key-cap pill and the label beside the anchor, not at the screen center", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 720 });
    render(<AnchoredPrompt label="Use the laptop" anchor={{ x: 400, y: 300 }} />);
    const prompt = screen.getByTestId("anchored-prompt");
    expect(prompt.textContent).toBe("EUse the laptop");
    expect(prompt.querySelector("kbd")?.getAttribute("aria-hidden")).toBe("true");
    // Right of the anchor by the token offset, vertically centered on it.
    expect(parseFloat(prompt.style.left)).toBe(400 + CINE.prompt.offsetPx);
    expect(parseFloat(prompt.style.top)).toBe(300 - CINE.prompt.boxHeightPx / 2);
    expect(prompt.style.pointerEvents).toBe("");
    expect(prompt.className).toContain("pointer-events-none");
  });

  it("flips to the left of the anchor near the right edge", () => {
    render(<AnchoredPrompt label="Check the phone" anchor={{ x: 1250, y: 300 }} />);
    expect(parseFloat(screen.getByTestId("anchored-prompt").style.left)).toBeLessThan(1250);
  });
});
