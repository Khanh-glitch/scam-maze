// ChapterIntroOverlay: the controls and Continue appear with the last paragraph (owner, replaces P2-8).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../../i18n";
import enHud from "../../../i18n/locales/en/chapter1/hud";
import { ChapterIntroOverlay } from "./ChapterIntroOverlay";

const CONTINUE = enHud.intro.continue;

/** A clip that never ends: the voice would block Continue for a long time if it had to finish. */
function silentAudio(): HTMLAudioElement {
  const audio = new EventTarget() as unknown as HTMLAudioElement;
  Object.assign(audio, { play: () => new Promise<void>(() => undefined), pause: () => undefined, duration: 16, currentTime: 0 });
  return audio;
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChapterIntroOverlay Continue", () => {
  const button = () => screen.getByRole("button", { name: CONTINUE, hidden: true }) as HTMLButtonElement;

  it("is hidden and disabled before the last paragraph", () => {
    render(<ChapterIntroOverlay ready mode="begin" voiceGain={1} onBegin={vi.fn()} createAudio={silentAudio} />);
    expect(button().disabled).toBe(true);
    expect(screen.getByTestId("chapter-intro-controls").getAttribute("aria-hidden")).toBe("true");
  });

  it("appears with the last paragraph, before its voice has finished, and begins the story", () => {
    const onBegin = vi.fn();
    const lines = [{ text: "One.", src: null }, { text: "Two.", src: null }, { text: "Three.", src: null }];
    render(<ChapterIntroOverlay ready mode="begin" voiceGain={1} onBegin={onBegin} createAudio={silentAudio} lines={lines} />);
    const intro = screen.getByTestId("chapter-intro");
    // Each paragraph takes two clicks: the first shows it whole, the second moves on.
    for (let i = 0; i < 4; i += 1) fireEvent.click(intro);
    expect(button().disabled).toBe(false);
    expect(screen.getByTestId("chapter-intro-controls").getAttribute("aria-hidden")).toBe("false");
    fireEvent.click(button());
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it("stays disabled while the scene is not ready", () => {
    render(<ChapterIntroOverlay ready={false} mode="begin" voiceGain={1} onBegin={vi.fn()} createAudio={silentAudio} />);
    expect(button().disabled).toBe(true);
  });

  it("is available at once in continue mode (a single resume line)", () => {
    render(<ChapterIntroOverlay ready mode="continue" voiceGain={0} onBegin={vi.fn()} createAudio={silentAudio} />);
    expect(button().disabled).toBe(false);
  });

  it("still advances paragraph by paragraph on click and begins after the last one", () => {
    const onBegin = vi.fn();
    render(<ChapterIntroOverlay ready mode="begin" voiceGain={0} onBegin={onBegin} createAudio={silentAudio} />);
    const intro = screen.getByTestId("chapter-intro");
    for (let i = 0; i < 12 && onBegin.mock.calls.length === 0; i += 1) fireEvent.click(intro);
    expect(onBegin).toHaveBeenCalledTimes(1);
  });
});
