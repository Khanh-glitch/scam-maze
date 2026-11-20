// PlayerChoiceOverlay reply gate tests. Requirements 5.9 and 8.3.
//
// While `waiting` is true the caller line is still typing: the options and the number keys are off
// and nothing is shown, with no "continue" step. When the wait ends the replies appear and focus
// moves to the first option. Without `waiting` nothing changes.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { selectDialogueView, type DialogueView } from "../../../game/narrative/selectors";
import type { CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import { PlayerChoiceOverlay } from "./PlayerChoiceOverlay";

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const REGION = { left: 16, top: 400, width: 360, height: 300 };

const SCAM_OPEN: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "RING_CALL", callId: "call.alex", reason: "exploration-timer" },
  { type: "ANSWER_CALL" },
];

function viewFor(scenario: ScenarioDefinition): DialogueView {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  for (const action of SCAM_OPEN) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    expect(result.accepted).toBe(true);
    state = result.state;
  }
  const view = selectDialogueView(state, scenario);
  expect(view).not.toBeNull();
  return view!;
}

function overlayElement(
  view: DialogueView,
  props: { waiting?: boolean; onSelectOption?: (id: string) => void },
) {
  return (
    <PlayerChoiceOverlay
      view={view}
      narration={null}
      disabled={false}
      onSelectOption={props.onSelectOption ?? vi.fn()}
      region={REGION}
      waiting={props.waiting}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(LOCALES)("PlayerChoiceOverlay reply gate (%s)", (locale) => {
  const scenario = getDisplayScenario(locale);

  it("hides the options and shows nothing, no Continue step, while waiting", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    expect(view.options.length).toBeGreaterThan(0);
    render(overlayElement(view, { waiting: true }));
    const overlay = screen.getByTestId("player-choice-overlay");

    for (const option of view.options) {
      expect(screen.queryByTestId(`dialogue-option-${option.id}`)).toBeNull();
    }
    expect(within(overlay).queryByRole("list")).toBeNull();
    expect(within(overlay).queryByRole("status")).toBeNull();
    expect(within(overlay).queryAllByRole("button")).toHaveLength(0);
    expect(within(overlay).queryByTestId("choice-waiting")).toBeNull();
    expect(within(overlay).queryByTestId("choice-skip-wait")).toBeNull();
    expect(overlay.textContent).not.toMatch(/Continue|Tiếp tục|Listening|Show replies|Đang nghe|Hiện các câu/);
  });

  it("ignores number keys and F while waiting", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    render(overlayElement(view, { waiting: true, onSelectOption }));

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).not.toHaveBeenCalled();
  });

  it("shows the replies, moves focus to the first option and enables F when the wait ends", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    const { rerender } = render(overlayElement(view, { waiting: true, onSelectOption }));
    expect(screen.queryByTestId(`dialogue-option-${view.options[0].id}`)).toBeNull();

    rerender(overlayElement(view, { waiting: false, onSelectOption }));

    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId(`dialogue-option-${view.options[0].id}`));

    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenLastCalledWith(view.options[0].id);
  });

  it("behaves as before when waiting is absent", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    render(overlayElement(view, { onSelectOption }));
    const overlay = screen.getByTestId("player-choice-overlay");

    expect(within(overlay).queryByTestId("choice-waiting")).toBeNull();
    expect(within(overlay).queryByRole("status")).toBeNull();
    expect(within(overlay).getAllByRole("button")).toHaveLength(view.options.length);
    expect(document.activeElement).toBe(screen.getByTestId(`dialogue-option-${view.options[0].id}`));

    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(onSelectOption).toHaveBeenCalledWith(view.options[0].id);
  });
});
