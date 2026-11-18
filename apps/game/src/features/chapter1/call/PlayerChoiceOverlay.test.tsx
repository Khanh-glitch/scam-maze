// PlayerChoiceOverlay unit tests (task 7.4). Requirements 3.5, 3.7, 3.8, 3.9, 4.1, 4.7 and 7.10.
//
// The dialogue views come from the real Chapter 1 core (`chapterReducer` and
// `selectDialogueView`), in English and in the Vietnamese display scenario, so the overlay is
// tested with the same data the Chapter_Page passes to it.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { selectDialogueView, type DialogueView } from "../../../game/narrative/selectors";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import type { GameLocale } from "@scammaze/shared-types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import enStory from "../../../i18n/locales/en/chapter1/story";
import viStory from "../../../i18n/locales/vi/chapter1/story";
import enRoom from "../../../i18n/locales/en/chapter1/room";
import viRoom from "../../../i18n/locales/vi/chapter1/room";
import { CHOICE_CARD_CLASS, PlayerChoiceOverlay } from "./PlayerChoiceOverlay";

const STORY = { en: enStory, vi: viStory } as const;
const LOCALES: readonly GameLocale[] = ["en", "vi"];
const REGION = { left: 16, top: 400, width: 360, height: 300 };

/** Scam call answered: the caller's opening node, with its reply options. */
const SCAM_OPEN: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "RING_CALL", callId: "call.alex", reason: "exploration-timer" },
  { type: "ANSWER_CALL" },
];


function run(actions: readonly CoreAction[]): ChapterState {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  for (const action of actions) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    expect(result.accepted, `${JSON.stringify(action)} rejected: ${result.reason ?? ""}`).toBe(true);
    state = result.state;
  }
  return state;
}

function viewFor(actions: readonly CoreAction[], scenario: ScenarioDefinition): DialogueView {
  const view = selectDialogueView(run(actions), scenario);
  expect(view).not.toBeNull();
  return view!;
}

function renderOverlay(props: {
  view: DialogueView;
  narration?: string | null;
  disabled?: boolean;
  onSelectOption?: (optionId: string) => void;
  onHoverSound?: () => void;
}) {
  const onSelectOption = props.onSelectOption ?? vi.fn();
  const utils = render(
    <PlayerChoiceOverlay
      view={props.view}
      narration={props.narration ?? null}
      disabled={props.disabled ?? false}
      onSelectOption={onSelectOption}
      region={REGION}
      onHoverSound={props.onHoverSound}
    />,
  );
  return { ...utils, onSelectOption, overlay: screen.getByTestId("player-choice-overlay") };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(LOCALES)("PlayerChoiceOverlay (%s)", (locale) => {
  const story = STORY[locale];
  const scenario = getDisplayScenario(locale);

  function setLocale(): void {
    applyLocale(locale);
  }

  it("names the ordered option list with the visible label (Req 3.8, 7.10)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    expect(view.options.length).toBeGreaterThan(0);
    const { overlay } = renderOverlay({ view });

    const label = within(overlay).getByText(story.dialogue.optionsLabel);
    expect(label.tagName).toBe("P");
    const list = within(overlay).getByRole("list", { name: story.dialogue.optionsLabel });
    expect(list.tagName).toBe("OL");
    expect(list.getAttribute("aria-labelledby")).toBe(label.id);
    // The label sits above the list.
    expect(label.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // One list item per option, in order, each with exactly one button named by the option text.
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(view.options.length);
    items.forEach((item, index) => {
      const option = view.options[index];
      const buttons = within(item).getAllByRole("button");
      expect(buttons).toHaveLength(1);
      const expectedText = option.fallback ? story.dialogue.fallbackOption : option.text;
      expect(within(item).getByRole("button", { name: expectedText })).toBe(buttons[0]);
      expect(buttons[0].getAttribute("data-testid")).toBe(`dialogue-option-${option.id}`);
    });
  });

  it("shows noOptions and zero option buttons for a node without options (Req 3.7)", () => {
    setLocale();
    const base = viewFor(SCAM_OPEN, scenario);
    const { overlay } = renderOverlay({ view: { ...base, options: [] } });

    expect(within(overlay).getByText(story.dialogue.noOptions)).toBeTruthy();
    expect(within(overlay).getByText(story.dialogue.optionsLabel)).toBeTruthy();
    expect(within(overlay).queryAllByRole("button")).toHaveLength(0);
    expect(within(overlay).queryByRole("list")).toBeNull();
  });

  it("shows a system line as a labeled narration paragraph in a polite live region", () => {
    setLocale();
    // A system node (for example the end line of a call) has no persona and no speaker name.
    const base = viewFor(SCAM_OPEN, scenario);
    const view: DialogueView = { ...base, speaker: "system", speakerName: null, line: scenario.dialogues[base.graphId].lines["line.alex.end.hung-up"] };
    expect(view.line.length).toBeGreaterThan(0);
    const { overlay, rerender, onSelectOption } = renderOverlay({ view, narration: view.line });

    const region = within(overlay).getByTestId("choice-narration");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(within(region).getByText(story.dialogue.systemSpeaker)).toBeTruthy();
    const paragraph = within(region).getByText(view.line);
    expect(paragraph.tagName).toBe("P");
    expect(paragraph.className).toContain("whitespace-normal");
    expect(paragraph.className).toContain("break-words");
    // Narration comes before the options label and list.
    const label = within(overlay).getByText(story.dialogue.optionsLabel);
    expect(region.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The live region stays mounted when there is no narration, so the next line is announced.
    rerender(
      <PlayerChoiceOverlay
        view={view}
        narration={null}
        disabled={false}
        onSelectOption={onSelectOption}
        region={REGION}
      />,
    );
    const emptyRegion = screen.getByTestId("choice-narration");
    expect(emptyRegion).toBe(region);
    expect(emptyRegion.textContent).toBe("");
    expect(screen.queryByText(story.dialogue.systemSpeaker)).toBeNull();
  });

  it("wraps option text, never truncates it, and uses UI.choiceOption (Req 3.5, 3.9)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const { overlay } = renderOverlay({ view });

    const buttons = within(overlay).getAllByRole("button");
    for (const button of buttons) {
      expect(button.className).toContain(CHOICE_CARD_CLASS);
      expect(button.className).toContain("whitespace-normal");
      expect(button.className).toContain("break-words");
      const text = button.querySelector("span.flex-1");
      expect(text?.className).toContain("whitespace-normal");
      expect(text?.className).toContain("break-words");
    }
    // State classes of the card (keyboard focus, disabled).
    for (const token of ["rounded-full", "disabled:opacity-60"]) {
      expect(CHOICE_CARD_CLASS).toContain(token);
    }
    // No truncation or ellipsis anywhere in the overlay.
    for (const element of [overlay, ...Array.from(overlay.querySelectorAll("*"))]) {
      const className = element.getAttribute("class") ?? "";
      expect(className).not.toMatch(/\b(truncate|text-ellipsis|line-clamp-\S+|whitespace-nowrap)\b/);
    }
    expect(overlay.style.overflowX).toBe("hidden");
    // The root clips; the list inside is the scroller (so the hang-up can be pinned in it).
    expect(overlay.style.overflowY).toBe("hidden");
    expect((within(overlay).getByRole("list") as HTMLElement).style.overflowY).toBe("auto");
  });

  it("calls onSelectOption once with the option ID on click, Enter and Space (Req 4.1)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const first = view.options[0];
    const last = view.options[view.options.length - 1];

    // Each pick hides the cards, so every activation gets its own mount.
    {
      const onSelectOption = vi.fn();
      const { overlay, unmount } = renderOverlay({ view, onSelectOption });
      fireEvent.click(within(overlay).getAllByRole("button")[0]);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption).toHaveBeenLastCalledWith(first.id);
      unmount();
    }

    // Enter and Space use the native button activation: no key handler cancels it or selects on
    // its own. jsdom does not synthesize the activation click, so dispatch it as the browser would.
    for (const key of [
      { key: "Enter", code: "Enter" },
      { key: " ", code: "Space" },
    ]) {
      const onSelectOption = vi.fn();
      const { overlay, unmount } = renderOverlay({ view, onSelectOption });
      const buttons = within(overlay).getAllByRole("button");
      const target = buttons[buttons.length - 1];
      target.focus();
      expect(document.activeElement).toBe(target);
      expect(fireEvent.keyDown(target, key)).toBe(true);
      expect(fireEvent.keyUp(target, key)).toBe(true);
      expect(onSelectOption).not.toHaveBeenCalled();
      fireEvent.click(target);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption).toHaveBeenLastCalledWith(last.id);
      unmount();
    }
  });

  it("moves with the arrow keys, picks with F, ignores number keys, and hides the cards after a pick", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    expect(view.options.length).toBeGreaterThanOrEqual(2);
    const onSelectOption = vi.fn();
    const onHoverSound = vi.fn();
    const { overlay } = renderOverlay({ view, onSelectOption, onHoverSound });
    // The first card has focus and the selected highlight on open.
    const buttons = within(overlay).getAllByRole("button");
    expect(document.activeElement).toBe(buttons[0]);
    expect(buttons[0].getAttribute("data-selected")).toBe("true");
    // Arrow down moves focus and the highlight to the second card (with the hover sound); arrow up wraps back.
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1].getAttribute("data-selected")).toBe("true");
    expect(buttons[0].getAttribute("data-selected")).toBe("false");
    expect(onHoverSound).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(document.activeElement).toBe(buttons[0]);
    expect(onHoverSound).toHaveBeenCalledTimes(2);
    // Number keys do nothing; F picks the highlighted option.
    fireEvent.keyDown(window, { key: "2", code: "Digit2" });
    expect(onSelectOption).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenLastCalledWith(view.options[1].id);
    // The cards leave at once: no cards, no list, and a second F does nothing.
    expect(within(overlay).queryAllByRole("button")).toHaveLength(0);
    expect(within(overlay).queryByRole("list")).toBeNull();
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).toHaveBeenCalledTimes(1);
  });
  it("moves the highlight with the mouse wheel, one step per swipe", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const onHoverSound = vi.fn();
    const { overlay } = renderOverlay({ view, onHoverSound });
    const buttons = within(overlay).getAllByRole("button");
    fireEvent.wheel(window, { deltaY: 100 });
    expect(buttons[1].getAttribute("data-selected")).toBe("true");
    // The rest of the same swipe does not move it again.
    for (const deltaY of [80, 60, 40, 20]) fireEvent.wheel(window, { deltaY });
    expect(buttons[1].getAttribute("data-selected")).toBe("true");
    expect(onHoverSound).toHaveBeenCalledTimes(1);
  });
  it("shows no number key caps; the highlighted card shows the F key", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const { overlay } = renderOverlay({ view });
    const buttons = within(overlay).getAllByRole("button");
    for (const button of buttons) expect(button.querySelector("kbd")).toBeNull();
    const hints = within(overlay).getAllByTestId("choice-hint");
    expect(hints).toHaveLength(buttons.length);
    expect(hints[0].textContent).toContain("F");
    expect(hints[0].className).toContain("opacity-100");
    expect(hints[1].className).toContain("opacity-0");
  });
  it("keeps every option reachable when the list overflows: a scrolling list, a hint, and the hang-up pinned", () => {
    setLocale();
    const base = viewFor(SCAM_OPEN, scenario);
    const template = base.options[0];
    const options = [
      ...Array.from({ length: 5 }, (_, i) => ({ ...template, id: `x.extra-${i}`, text: `Reply ${i + 1}` })),
      { ...template, id: "x.opt.hang-up", text: "Hang up" },
    ];
    // jsdom has no layout: report an overflowing list.
    const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 400 });
    try {
      const { overlay } = renderOverlay({ view: { ...base, options } });
      const list = within(overlay).getByRole("list");
      expect(list.getAttribute("data-scrolls")).toBe("true");
      expect((list as HTMLElement).style.overflowY).toBe("auto");
      expect(within(list).getAllByRole("button")).toHaveLength(6);
      expect(within(overlay).getByTestId("choice-more").textContent).toBe(
        locale === "en" ? enRoom.room.call.moreReplies : viRoom.room.call.moreReplies,
      );
      const pinned = list.querySelector('li[data-pinned="true"]') as HTMLElement | null;
      expect(pinned).not.toBeNull();
      expect(pinned?.style.position).toBe("sticky");
      expect(pinned?.querySelector("button")?.getAttribute("data-testid")).toBe("dialogue-option-x.opt.hang-up");
    } finally {
      if (scrollHeight) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeight);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
    }
  });

  it("does not show the label as a visible row", () => {
    setLocale();
    const { overlay } = renderOverlay({ view: viewFor(SCAM_OPEN, scenario) });
    expect(within(overlay).getByText(story.dialogue.optionsLabel).className).toContain("sr-only");
  });

  it("has no scroll hint when the list does not overflow", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const { overlay } = renderOverlay({ view: { ...view, options: view.options.slice(0, 3) } });
    expect(within(overlay).queryByTestId("choice-more")).toBeNull();
    expect(within(overlay).getByRole("list").getAttribute("data-scrolls")).toBe("false");
  });

  it("disables every option while paused and dispatches nothing (Req 4.7)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const onSelectOption = vi.fn();
    const { overlay } = renderOverlay({ view, disabled: true, onSelectOption });

    const buttons = within(overlay).getAllByRole("button");
    expect(buttons).toHaveLength(view.options.length);
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).not.toHaveBeenCalled();
    // No option takes focus while paused.
    expect(buttons).not.toContain(document.activeElement);
  });
});

describe("PlayerChoiceOverlay icons and selection style (cinematic)", () => {
  it("gives every card the chat icon only", () => {
    applyLocale("en");
    const view = viewFor(SCAM_OPEN, getDisplayScenario("en"));
    const { overlay } = renderOverlay({ view });
    const icons = within(overlay).getAllByTestId("choice-icon");
    expect(icons).toHaveLength(view.options.length);
    icons.forEach((icon) => {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("src")).toBe("/assets/ui/hud/scammaze-chat-icon-512.png");
    });
  });

  it("draws the selected card as a light pill (swept in from the left), the others dark with a hairline", () => {
    applyLocale("en");
    const view = viewFor(SCAM_OPEN, getDisplayScenario("en"));
    const { overlay } = renderOverlay({ view });
    const buttons = within(overlay).getAllByRole("button");
    const sweep = (button: HTMLElement) => button.querySelector("span[aria-hidden='true'].origin-left") as HTMLElement;
    expect(buttons[0].getAttribute("data-selected")).toBe("true");
    expect(buttons[0].className).toContain("border-white/80");
    expect(sweep(buttons[0]).style.transform).toBe("scaleX(1)");
    expect(buttons[1].getAttribute("data-selected")).toBe("false");
    expect(buttons[1].className).toContain("border-white/30");
    expect(buttons[1].className).toContain("bg-black/55");
    expect(sweep(buttons[1]).style.transform).toBe("scaleX(0)");
    // Hover moves the selection style to the hovered card.
    fireEvent.pointerEnter(buttons[1]);
    expect(buttons[1].getAttribute("data-selected")).toBe("true");
    expect(sweep(buttons[1]).style.transform).toBe("scaleX(1)");
    expect(sweep(buttons[0]).style.transform).toBe("scaleX(0)");
  });

  it("anchors the cards to the bottom of the region (lower-left, above the subtitle)", () => {
    applyLocale("en");
    const view = viewFor(SCAM_OPEN, getDisplayScenario("en"));
    const { overlay } = renderOverlay({ view });
    expect(overlay.style.bottom).toContain(`${REGION.top + REGION.height}px`);
    expect(overlay.style.top).toBe("");
  });
});
