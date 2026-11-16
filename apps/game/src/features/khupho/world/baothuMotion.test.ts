import { describe, expect, it } from "vitest";
import {
  PASS_OFFSET,
  WEAVE_AMPLITUDE,
  WEAVE_SECONDS,
  WHEELIE_PITCH,
  WHEELIE_SECONDS,
  pickStunt,
  revShake,
  stuntSeconds,
  weaveOffset,
  wheeliePitch,
} from "./baothuMotion";

describe("baothuMotion", () => {
  it("a wheelie starts and ends flat, and holds the full pitch in between", () => {
    expect(wheeliePitch(0)).toBe(0);
    expect(wheeliePitch(WHEELIE_SECONDS)).toBe(0);
    expect(wheeliePitch(WHEELIE_SECONDS / 2)).toBeCloseTo(WHEELIE_PITCH, 5);
    for (let t = 0; t <= WHEELIE_SECONDS; t += 0.05) {
      expect(wheeliePitch(t)).toBeGreaterThanOrEqual(0);
      expect(wheeliePitch(t)).toBeLessThanOrEqual(WHEELIE_PITCH + 1e-9);
    }
  });
  it("a weave returns to the lane and stays inside its amplitude", () => {
    expect(weaveOffset(0)).toBe(0);
    expect(weaveOffset(WEAVE_SECONDS)).toBe(0);
    let max = 0;
    for (let t = 0; t <= WEAVE_SECONDS; t += 0.02) max = Math.max(max, Math.abs(weaveOffset(t)));
    expect(max).toBeGreaterThan(WEAVE_AMPLITUDE * 0.8);
    expect(max).toBeLessThanOrEqual(WEAVE_AMPLITUDE);
  });
  it("outside a stunt there is no motion", () => {
    expect(wheeliePitch(-1)).toBe(0);
    expect(weaveOffset(WEAVE_SECONDS + 1)).toBe(0);
  });
  it("picks both stunts and knows how long each lasts", () => {
    expect(pickStunt(0.1)).toBe("wheelie");
    expect(pickStunt(0.9)).toBe("weave");
    expect(stuntSeconds("wheelie")).toBe(WHEELIE_SECONDS);
    expect(stuntSeconds("weave")).toBe(WEAVE_SECONDS);
  });
  it("the revving shake is small", () => {
    for (let t = 0; t < 2; t += 0.01) {
      const s = revShake(t);
      expect(Math.abs(s.lift)).toBeLessThan(0.03);
      expect(Math.abs(s.rock)).toBeLessThan(0.03);
    }
    expect(PASS_OFFSET).toBeGreaterThan(1.09);
  });
});
