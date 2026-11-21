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
      onOpenSettings={vi.fn()}
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
    // The opening is cinematic: no paragraph and no goal text on screen. The facts stay in the HUD, the schedule and the journal.
    expect(within(intro).queryByText(/You are Alex, 23 years old/)).toBeNull();
    expect(within(intro).queryByText(/72 hours/i)).toBeNull();
    expect(screen.queryByTestId("chapter-intro-text")).toBeNull();
    expect(screen.queryByText(/bakery/i)).toBeNull();
  });

  it("starts the chapter on Begin and shows the HUD with the start values", () => {
    const rig = mountLayer();
    finishIntro();
    expect(rig.store().getState().status).toBe("playing");
    const cluster = screen.getByTestId("chapter-status-cluster");
    const time = within(cluster).getByTestId("resource-time").textContent;
    expect(time).toContain("17:00");
    expect(time).toContain("Tuesday");
    expect(time).toContain("72 h left to submit the thesis");
    expect(within(cluster).getByTestId("resource-thesis").textContent).toContain("60%");
    expect(within(cluster).getByTestId("resource-security").textContent).toContain("100%");
    expect(within(cluster).getByTestId("resource-support").textContent).toContain("50%");
    expect(within(cluster).getByTestId("resource-fatigue").textContent).toContain("20%");
    expect(within(screen.getByTestId("chapter-top-bar")).getByTestId("resource-cash").textContent).toContain("2,500,000 VND");
    // Evidence is not on the HUD (it will be inventory items).
    expect(screen.queryByTestId("resource-evidence")).toBeNull();
  });

  it("puts cash before settings and opens the schedule from the task icon, which clears its mark", () => {
    mountLayer();
    finishIntro();
    const bar = screen.getByTestId("chapter-top-bar");
    const cash = within(bar).getByTestId("resource-cash");
    expect(cash.compareDocumentPosition(within(bar).getByTestId("hud-settings")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const task = within(screen.getByTestId("chapter-status-cluster")).getByRole("button", { name: "Tasks" });
    expect(screen.getByTestId("hud-task-new-mark")).toBeTruthy();
    fireEvent.click(task);
    expect(screen.getByTestId("planner-overlay")).toBeTruthy();
    expect(screen.queryByTestId("hud-task-new-mark")).toBeNull();
  });

  it("shows the HUD in Vietnamese", () => {
    applyLocale("vi");
    mountLayer();
    finishIntro();
    const time = screen.getByTestId("resource-time").textContent;
    expect(time).toContain("Thứ Ba");
    expect(time).toContain("Còn 72 giờ để nộp khóa luận");
    expect(screen.getByTestId("resource-cash").textContent).toContain("VNĐ");
  });
});
