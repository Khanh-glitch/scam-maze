// ChapterIntroOverlay: Continue is available as soon as the scene is ready (P2-8).
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
  it("is enabled at once when the scene is ready, before the voice has finished", () => {
    const onBegin = vi.fn();
    render(<ChapterIntroOverlay ready mode="begin" voiceGain={1} onBegin={onBegin} createAudio={silentAudio} />);
    const button = screen.getByRole("button", { name: CONTINUE }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.tabIndex).toBe(0);
    fireEvent.click(button);
    expect(onBegin).toHaveBeenCalledTimes(1);
  });

  it("stays disabled while the scene is not ready", () => {
    const onBegin = vi.fn();
    render(<ChapterIntroOverlay ready={false} mode="begin" voiceGain={1} onBegin={onBegin} createAudio={silentAudio} />);
    const button = screen.getByRole("button", { name: CONTINUE }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("still advances paragraph by paragraph on click and begins after the last one", () => {
    const onBegin = vi.fn();
    render(<ChapterIntroOverlay ready mode="begin" voiceGain={0} onBegin={onBegin} createAudio={silentAudio} />);
    const intro = screen.getByTestId("chapter-intro");
    for (let i = 0; i < 12 && onBegin.mock.calls.length === 0; i += 1) fireEvent.click(intro);
    expect(onBegin).toHaveBeenCalledTimes(1);
  });
});