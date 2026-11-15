// DecisionPanel fits the viewport (P1-1): the dialog is capped to the viewport height, the body
// scrolls, and the heading and the Close button stay outside the scrolling region.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { createInitialState } from "../../../game/narrative/reducer";
import { selectDecisionPanel } from "../../../game/narrative/selectors";
import { UI } from "../theme";
import { DecisionPanel } from "./DecisionPanel";

function renderPanel() {
  const panel = selectDecisionPanel(createInitialState(CHAPTER_1_SCENARIO), CHAPTER_1_SCENARIO);
  render(<DecisionPanel panel={panel} onStartPreStep={vi.fn()} onDecide={vi.fn()} onClose={vi.fn()} />);
  return screen.getByRole("dialog");
}

describe("DecisionPanel viewport fit", () => {
  it("caps the dialog to the viewport height with a flex column", () => {
    const dialog = renderPanel();
    expect(UI.panelFit).toContain("100dvh");
    expect(dialog.className).toContain(UI.panelFit);
    expect(dialog.className).toContain("flex-col");
  });

  it("scrolls the option list while the heading and Close stay outside it", () => {
    const dialog = renderPanel();
    const body = within(dialog).getByTestId("decision-body");
    expect(body.className).toContain("overflow-y-auto");
    expect(body.className).toContain("min-h-0");
    const heading = within(dialog).getByRole("heading", { level: 2 });
    const close = within(dialog).getAllByRole("button").at(-1) as HTMLElement;
    expect(body.contains(heading)).toBe(false);
    expect(body.contains(close)).toBe(false);
    expect(within(body).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("keeps the dialog name tied to the heading", () => {
    const dialog = renderPanel();
    const heading = within(dialog).getByRole("heading", { level: 2 });
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
  });
});