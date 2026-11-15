import { describe, expect, it } from "vitest";
import { formatClock, gameClockText, setGameElapsedSeconds } from "./gameClock";

describe("gameClock", () => {
  it("starts at 23:08 and follows the elapsed seconds", () => {
    setGameElapsedSeconds(0);
    expect(gameClockText()).toBe("23:08");
    setGameElapsedSeconds(125);
    expect(gameClockText()).toBe("23:10");
  });
  it("wraps past midnight and ignores invalid input", () => {
    expect(formatClock(24 * 3600 + 5 * 60)).toBe("00:05");
    setGameElapsedSeconds(Number.NaN);
    expect(gameClockText()).toBe("23:08");
  });
});
