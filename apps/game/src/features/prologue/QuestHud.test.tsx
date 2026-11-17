import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../i18n";
import enQuests from "../../i18n/locales/en/worlds/quests";
import { QuestListButton, QuestListPanel, QuestToast, QuestTracker } from "./QuestHud";
import { completeQuest, initialQuestState, markSeen } from "./quest/quests";

describe("quest HUD", () => {
  beforeEach(() => applyLocale("en"));

  it("marks the list button until the list was opened", () => {
    const { rerender } = render(<QuestListButton state={initialQuestState()} onOpen={() => undefined} />);
    expect(screen.getByTestId("quest-new-mark")).toBeTruthy();
    rerender(<QuestListButton state={markSeen(initialQuestState())} onOpen={() => undefined} />);
    expect(screen.queryByTestId("quest-new-mark")).toBeNull();
  });

  it("the tracker shows the quest and its distance, and lights the path when pressed", () => {
    const onShowPath = vi.fn();
    render(<QuestTracker questId="meetMai" distance={41.6} onShowPath={onShowPath} />);
    expect(screen.getByText(enQuests.quests.meetMai.title)).toBeTruthy();
    expect(screen.getByText("42 m")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onShowPath).toHaveBeenCalledTimes(1);
  });

  it("the list shows active and completed quests, and tracks one on request", () => {
    const onShowPath = vi.fn();
    const { rerender } = render(<QuestListPanel state={initialQuestState()} onClose={() => undefined} onShowPath={onShowPath} />);
    expect(screen.getByText(enQuests.quests.meetMai.description)).toBeTruthy();
    fireEvent.click(screen.getByText(/Show path/));
    expect(onShowPath).toHaveBeenCalledWith("meetMai");
    rerender(<QuestListPanel state={completeQuest(initialQuestState(), "meetMai")} onClose={() => undefined} onShowPath={onShowPath} />);
    expect(screen.getByText(enQuests.quests.meetMai.done)).toBeTruthy();
    expect(screen.queryByText(enQuests.quests.meetMai.description)).toBeNull();
  });

  it("the toast appears only for a completed quest", () => {
    const { rerender } = render(<QuestToast questId={null} />);
    expect(screen.queryByTestId("quest-toast")).toBeNull();
    rerender(<QuestToast questId="meetMai" />);
    expect(screen.getByTestId("quest-toast").textContent).toContain(enQuests.quests.complete);
  });
});
