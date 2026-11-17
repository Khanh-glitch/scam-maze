import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoSignalMinimap } from "./Minimap";
describe("NoSignalMinimap", () => {
  it("is a map disc that only says there is no signal", () => {
    render(<NoSignalMinimap label="No signal" />);
    const disc = screen.getByTestId("minimap-no-signal");
    expect(disc.getAttribute("role")).toBe("img");
    expect(disc.getAttribute("aria-label")).toBe("No signal");
    expect(disc.textContent).toBe("No signal");
    expect(disc.querySelector("canvas")).toBeNull();
  });
});
