// The cinematic opening of the room chapter: no paragraph and no step bars on screen, a small hint,
// and a click (or Continue) that goes on. The goals are not written in the middle of the screen.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChapterIntroOverlay } from "./ChapterIntroOverlay";

const props = { ready: true, mode: "begin" as const, voiceGain: 0, lines: [{ text: "", src: null }], cinematic: true };

describe("the cinematic intro", () => {
  it("writes no text and no step bars over the room", () => {
    render(<ChapterIntroOverlay {...props} onBegin={() => undefined} />);
    expect(screen.queryByTestId("chapter-intro-text")).toBeNull();
    expect(screen.queryByTestId("chapter-intro-step")).toBeNull();
    const text = screen.getByTestId("chapter-intro").textContent ?? "";
    expect(text).not.toMatch(/72 h|hours left|Friday|signature|chữ ký|72 giờ/i);
  });

  it("keeps the hint and the controls at the edges, and a click goes on once", () => {
    const onBegin = vi.fn();
    render(<ChapterIntroOverlay {...props} onBegin={onBegin} />);
    expect(screen.getByTestId("chapter-intro-hint").className).toContain("bottom-6");
    expect(screen.getByTestId("chapter-intro-controls").className).toContain("top-5");
    fireEvent.click(screen.getByTestId("chapter-intro"));
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it("shows one instruction and no second Continue button", () => {
    render(<ChapterIntroOverlay {...props} onBegin={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId("chapter-intro-hint").textContent).toBe("Click to continue");
  });
  it("cannot be skipped while Alex speaks: no hint, and clicks and Enter do nothing until the line ends", () => {
    const onBegin = vi.fn();
    const view = render(<ChapterIntroOverlay {...props} holdForVoice onBegin={onBegin} />);
    expect(screen.queryByTestId("chapter-intro-hint")).toBeNull();
    fireEvent.click(screen.getByTestId("chapter-intro"));
    fireEvent.keyDown(screen.getByTestId("chapter-intro"), { key: "Enter" });
    expect(onBegin).not.toHaveBeenCalled();
    view.rerender(<ChapterIntroOverlay {...props} holdForVoice={false} onBegin={onBegin} />);
    expect(screen.getByTestId("chapter-intro-hint").textContent).toBe("Click to continue");
    fireEvent.click(screen.getByTestId("chapter-intro"));
    expect(onBegin).toHaveBeenCalledTimes(1);
  });
  it("waits for the scene: nothing goes on while it loads", () => {
    const onBegin = vi.fn();
    render(<ChapterIntroOverlay {...props} ready={false} onBegin={onBegin} />);
    fireEvent.click(screen.getByTestId("chapter-intro"));
    expect(onBegin).not.toHaveBeenCalled();
    expect(screen.queryByTestId("chapter-intro-hint")).toBeNull();
  });
});
