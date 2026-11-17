import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../i18n";
import enQuests from "../../i18n/locales/en/worlds/quests";
import { HomeCallOverlay } from "./HomeCallOverlay";
describe("HomeCallOverlay", () => {
  beforeEach(() => applyLocale("en"));
  it("has no go-home or stay buttons; a click after the last line ends it", () => {
    const onDone = vi.fn();
    render(<HomeCallOverlay locale="en" voiceGain={0} onDone={onDone} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 12 && onDone.mock.calls.length === 0; i += 1) fireEvent.click(dialog);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByText(enQuests.quests.dialogue.continue)).toBeTruthy();
  });
});
