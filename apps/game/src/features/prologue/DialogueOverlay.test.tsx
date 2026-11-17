import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../i18n";
import enQuests from "../../i18n/locales/en/worlds/quests";
import viQuests from "../../i18n/locales/vi/worlds/quests";
import { DialogueOverlay } from "./DialogueOverlay";
import { startDialogue } from "./quest/dialogue";
import { MAI_DIALOGUE } from "./quest/maiDialogue";

const handlers = () => ({ onChoose: vi.fn(), onAdvance: vi.fn(), onClose: vi.fn(), onHoverSound: vi.fn() });

describe("DialogueOverlay", () => {
  beforeEach(() => applyLocale("en"));

  it("shows the speaker, the line and replies", () => {
    render(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "greet")} speaker="Auntie Mai" {...handlers()} />);
    expect(screen.getByText("Auntie Mai")).toBeTruthy();
    expect(screen.getByText(enQuests.quests.mai.lines.greet)).toBeTruthy();
    const replies = screen.getAllByRole("button");
    expect(replies).toHaveLength(3);
    expect(replies[0].textContent).toContain(enQuests.quests.mai.options.busy);
  });

  it("picks the first reply with F and any reply with a click; number keys do nothing", () => {
    const h = handlers();
    render(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "greet")} speaker="Auntie Mai" {...h} />);
    fireEvent.keyDown(window, { code: "Digit2" });
    expect(h.onChoose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(h.onChoose).toHaveBeenLastCalledWith("busy");
    fireEvent.click(screen.getByText(enQuests.quests.mai.options.stall));
    expect(h.onChoose).toHaveBeenLastCalledWith("stall");
  });

  it("moves the highlight with the arrows and picks it with F", () => {
    const h = handlers();
    render(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "greet")} speaker="Auntie Mai" {...h} />);
    fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(h.onChoose).toHaveBeenLastCalledWith("quiet");
    fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" });
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(h.onChoose).toHaveBeenLastCalledWith("stall");
    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(window, { code: "KeyE" });
    expect(h.onChoose).toHaveBeenCalledTimes(2);
  });

  it("plays the hover sound for arrows and for the wheel, and the wheel moves the highlight", () => {
    const h = handlers();
    const { container } = render(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "greet")} speaker="Auntie Mai" {...h} />);
    fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown" });
    expect(h.onHoverSound).toHaveBeenCalledTimes(1);
    fireEvent.wheel(container.firstElementChild as Element, { deltaY: 100 });
    expect(h.onHoverSound).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(h.onChoose).toHaveBeenLastCalledWith("stall");
    // The rest of a coasting swipe, and a tiny scroll, do nothing.
    for (const deltaY of [80, 60, 40, 20, 5]) fireEvent.wheel(container.firstElementChild as Element, { deltaY });
    expect(h.onHoverSound).toHaveBeenCalledTimes(2);
    // Swiping the other way is a new step.
    fireEvent.wheel(container.firstElementChild as Element, { deltaY: -100 });
    expect(h.onHoverSound).toHaveBeenCalledTimes(3);
  });
  it("shows Continue on a line without replies", () => {
    const h = handlers();
    render(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "work")} speaker="Auntie Mai" {...h} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(enQuests.quests.dialogue.continue)).toBeTruthy();
    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    expect(h.onAdvance).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "f", code: "KeyF" });
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
    expect(h.onChoose).not.toHaveBeenCalled();
  });

  it("continues on a click anywhere when there are no replies, and not when there are", () => {
    const h = handlers();
    const { container, rerender } = render(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "work")} speaker="Auntie Mai" {...h} />);
    fireEvent.click(container.firstElementChild as Element);
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
    rerender(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "greet")} speaker="Auntie Mai" {...h} />);
    fireEvent.click(container.firstElementChild as Element);
    expect(h.onAdvance).toHaveBeenCalledTimes(1);
  });
  it("ignores a number with no matching reply and closes on Escape", () => {
    const h = handlers();
    render(<DialogueOverlay graph={MAI_DIALOGUE} state={startDialogue(MAI_DIALOGUE, "bye")} speaker="Auntie Mai" {...h} />);
    fireEvent.keyDown(window, { code: "Digit3" });
    expect(h.onChoose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it("has a text for every line and reply in both languages", () => {
    for (const quests of [enQuests, viQuests]) {
      for (const node of Object.values(MAI_DIALOGUE.nodes)) {
        expect((quests.quests.mai.lines as Record<string, string>)[node.id], `line ${node.id}`).toBeTruthy();
        for (const o of node.options ?? []) expect((quests.quests.mai.options as Record<string, string>)[o.id], `option ${o.id}`).toBeTruthy();
      }
    }
  });
});
