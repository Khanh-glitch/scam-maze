// useIntroNarration: a line voiced elsewhere is typed over its `durationMs`, after its `delayMs`.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIntroNarration } from "./useIntroNarration";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIntroNarration timed lines", () => {
  it("spreads the text over durationMs, starting after delayMs", () => {
    const text = "0123456789"; // 10 characters over 5 s: 2 per second
    const lines = [{ text, src: null, durationMs: 5000, delayMs: 500 }];
    const { result } = renderHook(() => useIntroNarration({ lines, active: true, gain: 1 }));
    act(() => { vi.advanceTimersByTime(450); });
    expect(result.current.shown).toBe("");
    act(() => { vi.advanceTimersByTime(3050); }); // 3 s of typing after the delay
    expect(result.current.shown.length).toBeGreaterThanOrEqual(5);
    expect(result.current.shown.length).toBeLessThanOrEqual(6);
    expect(result.current.lineDone).toBe(false);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(result.current.shown).toBe(text);
    expect(result.current.lineDone).toBe(true);
  });
});
