import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UEH_ORANGE, UEH_TEAL, UehLogo } from "./UehLogo";

describe("UehLogo", () => {
  it("draws UEH in dark teal and UNIVERSITY in orange, with an accessible name", () => {
    const { container } = render(<UehLogo height={40} />);
    const logo = screen.getByRole("img", { name: "UEH University" });
    expect(logo.getAttribute("viewBox")).toBe("0 0 1024 598");
    expect(logo.getAttribute("height")).toBe("40");
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(3);
    paths.forEach((path) => expect(path.getAttribute("fill")).toBe(UEH_TEAL));
    const text = container.querySelector("text");
    expect(text?.textContent).toBe("UNIVERSITY");
    expect(text?.getAttribute("fill")).toBe(UEH_ORANGE);
  });

  it("keeps the proportions of the logo", () => {
    render(<UehLogo height={59.8} />);
    expect(Number(screen.getByTestId("ueh-logo").getAttribute("width"))).toBeCloseTo(102.4, 1);
  });
});