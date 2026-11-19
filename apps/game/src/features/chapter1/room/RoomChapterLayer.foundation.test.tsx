// The chapter layer with the real "LAST SUBMISSION: 72 GIỜ CUỐI" routing (no parked story).
// jsdom, a fake commands object on a real RoomStoryBridge. No WebGL, no engine.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { CHAPTER_1_INITIAL_STATE } from "../../../game/narrative/resources";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

// Load the real routing instead of the suite-wide parked-story fixture (see `src/test/setup.ts`).
vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer(): { store: () => ChapterStore } {
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
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  return {
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

function finishIntro() {
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) return;
    fireEvent.click(intro);
  }
  throw new Error("intro did not close");
}

describe("RoomChapterLayer with LAST SUBMISSION routing", () => {
  it("opens with the facts of the brief and does not start the parked story", () => {
    const rig = mountLayer();
    expect(rig.store().getState().status).toBe("not-started");
    expect(rig.store().getState().resources).toEqual(CHAPTER_1_INITIAL_STATE.resources);
    const intro = screen.getByTestId("chapter-intro");
    // The full text of the first paragraph is available to screen readers at once.
    expect(within(intro).getByText(/You are Alex, 23 years old/)).toBeTruthy();
    expect(screen.queryByText(/bakery/i)).toBeNull();
  });

  it("starts the chapter on Begin and shows the status bar with the start values", () => {
    const rig = mountLayer();
    finishIntro();
    expect(rig.store().getState().status).toBe("playing");
    const bar = screen.getByTestId("resource-status");
    expect(within(bar).getByTestId("resource-time").textContent).toContain("Tuesday 17:00, 72 h left");
    expect(within(bar).getByTestId("resource-thesis").textContent).toContain("60%");
    expect(within(bar).getByTestId("resource-cash").textContent).toContain("2,500,000 VND");
    expect(within(bar).getByTestId("resource-security").textContent).toContain("100%");
    expect(within(bar).getByTestId("resource-support").textContent).toContain("50%");
    expect(within(bar).getByTestId("resource-evidence").textContent).toContain("0");
  });

  it("shows the status bar in Vietnamese", () => {
    applyLocale("vi");
    mountLayer();
    finishIntro();
    const bar = screen.getByTestId("resource-status");
    expect(within(bar).getByTestId("resource-time").textContent).toContain("Thứ Ba 17:00, còn 72 giờ");
    expect(within(bar).getByTestId("resource-cash").textContent).toContain("VNĐ");
  });
});
