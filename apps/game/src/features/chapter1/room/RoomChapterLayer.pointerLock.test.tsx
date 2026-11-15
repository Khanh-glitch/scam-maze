// RoomChapterLayer and the mouse (P1-2). jsdom has no pointer lock, so the lock is simulated with
// a `pointerLockElement` getter, `exitPointerLock` and the `pointerlockchange` event.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import enRoom from "../../../i18n/locales/en/chapter1/room";
import viRoom from "../../../i18n/locales/vi/chapter1/room";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

const HUD = enRoom.room.hud;
const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const AFTER_DECLINE: CoreAction[] = [START, RING_ALEX, { type: "END_CALL" }];

let lockElement: Element | null = null;
const exitPointerLock = vi.fn(() => {
  lockElement = null;
});

function setLock(element: Element | null) {
  lockElement = element;
  act(() => {
    document.dispatchEvent(new Event("pointerlockchange"));
  });
}

function setup() {
  const commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
  const bridge = new RoomStoryBridge();
  bridge.commands = commands;
  const scratch = createChapterStore(createInitialState());
  for (const action of AFTER_DECLINE) scratch.dispatch(action);
  const session: ChapterSession = {
    chapterId: "chapter-1",
    chapterNumber: 1,
    sceneId: "apartment",
    origin: "saved-game",
    restored: { state: scratch.getState(), pose: null },
  };
  const source: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };
  render(<RoomChapterLayer session={session} settings={DEFAULT_SETTINGS} bridge={bridge} saveSource={source} ringSettleMs={0} />);
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) break;
    fireEvent.click(intro);
  }
  return { bridge, commands };
}

beforeEach(() => {
  lockElement = null;
  exitPointerLock.mockClear();
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => lockElement });
  Object.defineProperty(document, "exitPointerLock", { configurable: true, value: exitPointerLock });
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(document, "pointerLockElement");
  Reflect.deleteProperty(document, "exitPointerLock");
});

describe("pointer lock and the HUD", () => {
  it("shows 'Press Ctrl to use the mouse' while the world holds the pointer and no layer is open", () => {
    setup();
    expect(screen.queryByTestId("room-mouse-hint")).toBeNull();
    setLock(document.body);
    expect(screen.getByTestId("room-mouse-hint").textContent).toBe(HUD.mouseLockedHint);
    setLock(null);
    expect(screen.queryByTestId("room-mouse-hint")).toBeNull();
  });

  it("releases a lock that appears while an overlay is open, and frees the mouse for the overlay", () => {
    const { bridge, commands } = setup();
    act(() => bridge.onProp("laptop", "inspect-ready"));
    expect(commands.setCursorMode).toHaveBeenLastCalledWith(true);
    exitPointerLock.mockClear();
    commands.setCursorMode.mockClear();

    // The engine takes the pointer again while the overlay stays open (for example after a call).
    setLock(document.body);
    expect(exitPointerLock).toHaveBeenCalled();
    expect(commands.setCursorMode).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId("room-mouse-hint")).toBeNull();
  });

  it("releases a lock that is already held when an overlay opens", () => {
    const { bridge, commands } = setup();
    setLock(document.body);
    commands.setCursorMode.mockClear();
    act(() => bridge.onProp("laptop", "inspect-ready"));
    expect(exitPointerLock).toHaveBeenCalled();
    expect(commands.setCursorMode).toHaveBeenCalledWith(true);
  });

  it("has the key-hint texts in English and Vietnamese", () => {
    expect(enRoom.room.hud.mouseKeyHint).not.toBe("");
    expect(viRoom.room.hud.mouseKeyHint).not.toBe("");
    expect(viRoom.room.hud.mouseLockedHint).not.toMatch(/an toàn/i);
  });
});