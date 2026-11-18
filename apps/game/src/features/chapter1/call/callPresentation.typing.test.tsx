// The caller line of the in-room call types out like the other typed text. Replies appear as soon as
// the line is fully revealed, with no Continue step. F or a click while it types shows the rest.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import { CallPresentation } from "./CallPresentation";
import { createPhoneScreenSink } from "./phoneScreenSink";
import { TYPEWRITER_CPS } from "./useTypewriter";

const OPEN: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "RING_CALL", callId: "call.alex", reason: "exploration-timer" },
  { type: "ANSWER_CALL" },
];

function mount(subtitlesEnabled = true) {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  for (const action of OPEN) state = chapterReducer(state, action, CHAPTER_1_SCENARIO).state;
  const onSelectOption = vi.fn();
  render(
    <CallPresentation
      store={createChapterStore(state)}
      scenario={getDisplayScenario("en")}
      paused={false}
      modelAllowed={false}
      screenSink={createPhoneScreenSink()}
      onAnswer={() => undefined}
      onEnd={() => undefined}
      onSelectOption={onSelectOption}
      subtitlesEnabled={subtitlesEnabled}
    />,
  );
  return { onSelectOption };
}

const typed = () => screen.getByTestId("call-subtitle-typed").textContent ?? "";
const pending = () => screen.getByTestId("call-subtitle-pending").textContent ?? "";
const full = () => screen.getByTestId("call-subtitle-line").textContent ?? "";
const replies = () => screen.queryByTestId("choice-list");
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("the caller line types out", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    applyLocale("en");
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("reveals the line progressively and shows the replies once it is complete, with no Continue step", () => {
    mount();
    expect(typed()).toBe("");
    expect(full().length).toBeGreaterThan(TYPEWRITER_CPS);
    expect(replies()).toBeNull();
    expect(screen.queryByTestId("choice-waiting")).toBeNull();

    advance(500);
    const partial = typed().length;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(full().length);
    expect(typed() + pending()).toBe(full());
    expect(replies()).toBeNull();

    advance(500);
    expect(typed().length).toBeGreaterThan(partial);

    advance(60_000);
    expect(pending()).toBe("");
    expect(replies()).not.toBeNull();
    expect(screen.queryByTestId("choice-waiting")).toBeNull();
  });

  it("completes the text and shows the replies when F is pressed while typing", () => {
    mount();
    advance(300);
    expect(replies()).toBeNull();
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(pending()).toBe("");
    expect(replies()).not.toBeNull();
  });

  it("completes the text when the screen is clicked while typing, but not when a button is clicked", () => {
    mount();
    advance(300);
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(pending()).not.toBe("");
    fireEvent.click(screen.getByTestId("call-presentation"));
    expect(pending()).toBe("");
    expect(replies()).not.toBeNull();
  });

  it("does not pick a reply with the F key that completed the text", () => {
    const { onSelectOption } = mount();
    advance(300);
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).toHaveBeenCalledTimes(1);
  });
});

describe("the caller line with reduced motion", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("is complete at once and the replies show right away", () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
    );
    mount();
    expect(pending()).toBe("");
    expect(replies()).not.toBeNull();
  });
});
