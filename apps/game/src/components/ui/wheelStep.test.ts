import { describe, expect, it } from "vitest";
import { createWheelStepper } from "./wheelStep";
describe("createWheelStepper", () => {
  it("gives one step for a coasting swipe and ignores tiny scrolls", () => {
    const step = createWheelStepper();
    expect(step(100, 0, 1000)).toBe(1);
    [80, 60, 40, 20, 5].forEach((dy, i) => expect(step(dy, 0, 1016 + i * 16)).toBe(0));
    expect(createWheelStepper()(5, 0, 0)).toBe(0);
  });
  it("steps again after a pause, or when the swipe turns around", () => {
    const step = createWheelStepper();
    expect(step(100, 0, 1000)).toBe(1);
    expect(step(100, 0, 1500)).toBe(1);
    expect(step(-100, 0, 1520)).toBe(-1);
  });
  it("counts lines as 16 px", () => {
    expect(createWheelStepper()(3, 1, 1000)).toBe(1);
  });
});
