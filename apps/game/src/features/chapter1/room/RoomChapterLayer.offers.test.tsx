// EASY MONEY and THE GOLDEN PLATFORM through the real phone UI, with the real scenario: the four
// kinds of money are shown apart, a deposit moves real money, and the text exists in both locales.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer() {
  const bridge = new RoomStoryBridge();
  bridge.commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
  let store: ChapterStore | null = null;
  render(
    <RoomChapterLayer
      session={SESSION}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={SAVE_SOURCE}
      ringSettleMs={0}
      clockPaused
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  for (let i = 0; i < 12 && screen.queryByTestId("chapter-intro"); i += 1) fireEvent.click(screen.getByTestId("chapter-intro"));
  return { bridge, store: () => store as unknown as ChapterStore };
}

const openPhone = (rig: ReturnType<typeof mountLayer>) => {
  act(() => rig.bridge.onProp("phone", "inspect-ready"));
  fireEvent.click(screen.getByTestId("phone-unlock"));
  return screen.getByRole("dialog", { name: /Phone|Điện thoại/ });
};
/** Presses Back until the phone home (with the Jobs app) is showing. */
const goHome = (phone: HTMLElement) => {
  for (let i = 0; i < 4 && !within(phone).queryByTestId("phone-app-jobs"); i += 1) {
    fireEvent.click(within(phone).getAllByRole("button", { name: /Quay lại|Back/ })[0]);
  }
};
const text = (element: HTMLElement) => element.textContent ?? "";

describe("EASY MONEY in the phone", () => {
  it("shows the job page with real money, the balance shown, nothing to withdraw and the money kept apart", () => {
    applyLocale("en");
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 150 }));
    expect(screen.getByTestId("event-arrival-notice").textContent).toContain("Linh");
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages|Tin nhắn/ }));
    fireEvent.click(within(phone).getByTestId("device-row-msg.easy-money"));
    fireEvent.click(within(phone).getByTestId("device-action-msg.easy-money-open-link"));
    goHome(phone);
    fireEvent.click(within(phone).getByTestId("phone-app-jobs"));
    fireEvent.click(within(phone).getByTestId("device-row-job.platform"));
    expect(text(within(phone).getByTestId("platform-figure-shown"))).toContain("not money");
    expect(text(within(phone).getByTestId("platform-figure-real"))).toContain("2,500,000");
    fireEvent.click(within(phone).getByTestId("device-action-job.platform-do-task-1"));
    expect(text(within(phone).getByTestId("platform-figure-shown"))).toContain("45,000");
    expect(text(within(phone).getByTestId("platform-figure-withdrawable"))).toContain("0 VND");
    fireEvent.click(within(phone).getByTestId("device-action-job.platform-deposit-1"));
    expect(rig.store().getState().resources.cash).toBe(2_200_000);
    expect(text(within(phone).getByTestId("platform-figure-real"))).toContain("2,200,000");
    expect(text(within(phone).getByTestId("platform-figure-shown"))).toContain("345,000");
    expect(text(within(phone).getByTestId("platform-figure-locked"))).toContain("300,000");
    expect(text(within(phone).getByTestId("platform-figure-withdrawable"))).toContain("0 VND");
    expect(screen.getByTestId("resource-cash").textContent).toContain("2,200,000");
  });

  it("shows the same page in Vietnamese with the four labels", () => {
    applyLocale("vi");
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 150 }));
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages|Tin nhắn/ }));
    fireEvent.click(within(phone).getByTestId("device-row-msg.easy-money"));
    expect(text(phone)).toContain("Hỏi Linh");
    fireEvent.click(within(phone).getByTestId("device-action-msg.easy-money-open-link"));
    goHome(phone);
    fireEvent.click(within(phone).getByTestId("phone-app-jobs"));
    fireEvent.click(within(phone).getByTestId("device-row-job.platform"));
    expect(text(within(phone).getByTestId("platform-figure-real"))).toContain("Tiền thật");
    expect(text(within(phone).getByTestId("platform-figure-shown"))).toContain("không phải tiền");
    expect(text(within(phone).getByTestId("platform-figure-withdrawable"))).toContain("rút");
    expect(text(within(phone).getByTestId("platform-figure-locked"))).toContain("giữ lại");
    applyLocale("en");
  });
});
