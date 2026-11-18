import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TYPEWRITER_CPS, typewriterCps, useTypewriter } from "./useTypewriter";

const TEXT = "x".repeat(100);

describe("typewriterCps", () => {
  it("uses the fixed speed without a usable duration", () => {
    for (const d of [null, undefined, 0, -5, Number.NaN]) expect(typewriterCps(100, d)).toBe(TYPEWRITER_CPS);
  });
  it("spreads the characters over the clip duration", () => {
    expect(typewriterCps(100, 10_000)).toBe(10);
  });
});

describe("useTypewriter with a voice clip duration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("finishes when the clip ends, not at the fixed speed", () => {
    const { result } = renderHook(() => useTypewriter("k", TEXT, false, 10_000));
    act(() => void vi.advanceTimersByTime(5_000));
    expect(result.current.complete).toBe(false);
    expect(result.current.count).toBeGreaterThan(40);
    expect(result.current.count).toBeLessThan(60);
    act(() => void vi.advanceTimersByTime(5_100));
    expect(result.current.complete).toBe(true);
  });

  it("falls back to the fixed speed without a duration", () => {
    const { result } = renderHook(() => useTypewriter("k", TEXT, false, null));
    act(() => void vi.advanceTimersByTime(Math.ceil((100 / TYPEWRITER_CPS) * 1000) + 100));
    expect(result.current.complete).toBe(true);
  });
});
