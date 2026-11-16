// The Ctrl / Esc footer strip steps aside while a call or its replies own the screen: the host HUD
// marks the strip and the global stylesheet hides it when the Chapter 1 layer reports that mode.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrologueHud } from "./PrologueHud";

describe("PrologueHud footer hints", () => {
  it("marks the strip so the stylesheet can hide it", () => {
    render(<PrologueHud objective={null} prompt={null} showResume={false} cursorMode={false} />);
    expect(screen.getByTestId("hud-key-hints").hasAttribute("data-hud-footer-hints")).toBe(true);
  });

  it("has a rule that hides the strip in call and decision modes", () => {
    const css = readFileSync(resolve(import.meta.dirname, "../../styles/index.css"), "utf8");
    expect(css).toMatch(/\[data-ui-mode="call"\][^{]*\[data-ui-mode="decision"\][^{]*\[data-hud-footer-hints\]\s*\{\s*display:\s*none/);
  });
});
