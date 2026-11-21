// RoomChapterLayer (base) tests, task 10.1. Requirements 1.2, 2.3, 2.4, 12.6, 15.5, 15.6, 17.6, 22.2.
// jsdom, a fake commands object on a real RoomStoryBridge, the real scenario. No WebGL, no engine.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import type { SaveGameSource, SavedGameV3, SaveReadResult } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import enLaptop from "../../../i18n/locales/en/chapter1/laptop";
import enRoom from "../../../i18n/locales/en/chapter1/room";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

const ROOM = enRoom.room;

function fakeCommands() {
  return {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
}

function memorySaveSource() {
  let saved: SavedGameV3 | null = null;
  const write = vi.fn((save: SavedGameV3) => {
    saved = save;
    return true;
  });
  const source: SaveGameSource = {
    read: (): SaveReadResult => (saved ? { status: "valid", save: saved } : { status: "none" }),
    write,
    clear: () => true,
  };
  return { source, write };
}

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };

interface Rig {
  bridge: RoomStoryBridge;
  commands: ReturnType<typeof fakeCommands>;
  store: () => ChapterStore;
  write: ReturnType<typeof memorySaveSource>["write"];
}

function setup(options: { restoreActions?: CoreAction[]; engineReady?: boolean } = {}): Rig {
  const bridge = new RoomStoryBridge();
  const commands = fakeCommands();
  bridge.commands = commands;
  const save = memorySaveSource();
  let store: ChapterStore | null = null;

  let session = SESSION;
  if (options.restoreActions) {
    const scratch = createChapterStore(createInitialState());
    for (const action of options.restoreActions) {
      const result = scratch.dispatch(action);
      if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    }
    session = { ...SESSION, origin: "saved-game", restored: { state: scratch.getState(), pose: null } };
  }

  render(
    <RoomChapterLayer
      session={session}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={save.source}
      ringSettleMs={0}
      engineReady={options.engineReady}
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  return {
    bridge,
    commands,
    write: save.write,
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

/** Clicks through the intro narration until the overlay is gone. */
function finishIntro() {
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) return;
    fireEvent.click(intro);
  }
  throw new Error("intro did not close");
}

function dispatch(rig: Rig, action: CoreAction) {
  act(() => {
    const result = rig.store().dispatch(action);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
  });
}

const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const DECLINE: CoreAction = { type: "END_CALL" };
const DISMISS_NOTIFICATION: CoreAction = { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" };

/** Playing, first call declined: the notification exists and the third call is not yet due. */
const AFTER_DECLINE: CoreAction[] = [START, RING_ALEX, DECLINE];

function callStatus(rig: Rig) {
  return rig.store().getState().call.status;
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("intro and START_CHAPTER", () => {
  it("shows the intro first, starts the chapter only when the player begins, then rings the first call", () => {
    const rig = setup();
    expect(screen.getByTestId("chapter-intro")).toBeTruthy();
    expect(rig.store().getState().status).toBe("not-started");
    expect(callStatus(rig)).toBe("idle");

    finishIntro();
    expect(screen.queryByTestId("chapter-intro")).toBeNull();
    expect(rig.store().getState().status).toBe("playing");
    expect(rig.store().getState().events[0].action).toEqual(START);
    // The room is free, so the first call rings (a call rings from state, not from a timer).
    expect(callStatus(rig)).toBe("ringing");
    expect(rig.commands.ring).toHaveBeenLastCalledWith(true);
  });

  it("shows the continue intro for a restored run and does not dispatch START_CHAPTER again", () => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    const before = rig.store().getState().events.length;
    finishIntro();
    expect(rig.store().getState().events.length).toBe(before);
  });

  it("waits for the engine: no intro text and no ring until engineReady", () => {
    const rig = setup({ engineReady: false });
    expect(screen.getByTestId("chapter-intro").getAttribute("aria-busy")).toBe("true");
    expect(rig.commands.setPhoneMode).not.toHaveBeenCalled();
  });
});

describe("prop to action mapping", () => {
  it.each([
    ["note", "obj.note"],
    ["receipts", "obj.receipts"],
    ["calendar", "obj.calendar"],
  ] as const)("%s interact dispatches INTERACT_OBJECT %s", (prop, objectId) => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    act(() => rig.bridge.onProp(prop, "interact"));
    const last = rig.store().getState().events.at(-1)?.action;
    expect(last).toEqual({ type: "INTERACT_OBJECT", objectId });
  });

  it("phone key F answers a ringing call", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    expect(rig.bridge.actions("phone")?.map((a) => a.key)).toEqual(["F", "R"]);
    expect(rig.bridge.label("phone")).toBe(ROOM.prompt.phoneRinging);
    expect(rig.bridge.canLeaveInspect("phone")).toBe(false);
    let handled = false;
    act(() => {
      handled = rig.bridge.onInspectKey("phone", "F");
    });
    expect(handled).toBe(true);
    expect(callStatus(rig)).toBe("active");
  });

  it("phone key R declines a ringing call and keys are ignored when nothing rings", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    let handled = false;
    act(() => {
      handled = rig.bridge.onInspectKey("phone", "R");
    });
    expect(handled).toBe(true);
    expect(callStatus(rig)).toBe("declined");
    expect(rig.bridge.actions("phone")).toBeNull();
    expect(rig.bridge.onInspectKey("phone", "F")).toBe(false);
  });

  it("does not open the phone records while a call rings", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    act(() => rig.bridge.onProp("phone", "inspect-ready"));
    // Only the call screen is shown (task 10.2), not the phone records.
    expect(screen.queryByRole("dialog", { name: ROOM.records.dialogLabel })).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByTestId("call-presentation")).toBeTruthy();
  });

  it("keeps the door locked during the chapter with a cached prompt", () => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    expect(rig.bridge.doorLocked()).toBe(true);
    const first = rig.bridge.label("door");
    expect(first).toBe(ROOM.prompt.doorLocked);
    expect(rig.bridge.label("door")).toBe(first);
    expect(rig.bridge.overlayOpen()).toBe(false);
  });
});

describe("overlays", () => {
  it("opens the laptop on inspect-ready, closes it with one Escape and returns focus", () => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    const dialog = screen.getByRole("dialog", { name: enLaptop.laptop.dialogLabel });
    expect(dialog).toBeTruthy();
    expect(rig.bridge.overlayOpen()).toBe(true);
    expect(rig.bridge.canLeaveInspect("laptop")).toBe(false);
    expect(rig.commands.setCursorMode).toHaveBeenLastCalledWith(true);
    // The three extra apps are wired into the laptop.
    for (const label of [enLaptop.laptop.apps.bank, enLaptop.laptop.apps.compare, enLaptop.laptop.apps.security]) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // LaptopOverlay also listens for Escape; the layer handles it first and only once.
    expect(rig.commands.closeInspect).toHaveBeenCalledTimes(1);
    expect(rig.commands.setCursorMode).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(opener);
    expect(rig.bridge.overlayOpen()).toBe(false);
  });

  it("opens the phone records while no call is in progress and closes them with Escape", () => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    act(() => rig.bridge.onProp("phone", "inspect-ready"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(rig.bridge.label("phone")).toBe(ROOM.prompt.phoneRecords);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(rig.commands.closeInspect).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it("shows one overlay at a time", () => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    act(() => rig.bridge.onProp("phone", "inspect-ready"));
    fireEvent.keyDown(window, { key: "j", code: "KeyJ" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: enLaptop.laptop.dialogLabel })).toBeTruthy();
  });

  it("opens and closes the journal with the J key and the HUD button", () => {
    setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const button = screen.getByRole("button", { name: /Journal/ });
    button.focus();
    fireEvent.click(button);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(window, { key: "j", code: "KeyJ" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("shows the hint only after the player turns hints on", () => {
    setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    expect(screen.queryByTestId("room-hint")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: ROOM.hints.show }));
    expect(screen.getByTestId("room-hint")).toBeTruthy();
  });

  it("shows the Journal and Hint key-cap chips (J and H) and toggles the hint with the H key", () => {
    setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const journal = screen.getByRole("button", { name: /Journal/ });
    expect(journal.querySelector("kbd")?.textContent).toBe("J");
    expect(journal.getAttribute("aria-keyshortcuts")).toBe("J");
    const chip = screen.getByTestId("hud-hints-chip");
    expect(chip.querySelector("kbd")?.textContent).toBe("H");
    expect(chip.getAttribute("aria-keyshortcuts")).toBe("H");
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(chip.textContent).toContain(ROOM.hints.heading);
    fireEvent.keyDown(window, { key: "h", code: "KeyH" });
    expect(screen.getByTestId("room-hint")).toBeTruthy();
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.getAttribute("aria-label")).toBe(ROOM.hints.hide);
    fireEvent.keyDown(window, { key: "h", code: "KeyH" });
    expect(screen.queryByTestId("room-hint")).toBeNull();
  });

  it("ignores H while an overlay is open", () => {
    setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    fireEvent.keyDown(window, { key: "j", code: "KeyJ" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(window, { key: "h", code: "KeyH" });
    expect(screen.getByTestId("hud-hints-chip").getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the current objective in the objective card with the quest icon", () => {
    setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const current = screen.getByTestId("objective-current");
    expect(current.querySelector("img")?.getAttribute("src")).toContain("scammaze-quest-icon");
  });
});

describe("rings only while the room is free", () => {
  it("holds the third call while the laptop is open and rings it after it closes", () => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    dispatch(rig, DISMISS_NOTIFICATION);
    // The call is due, but the laptop overlay is open.
    expect(callStatus(rig)).not.toBe("ringing");
    fireEvent.keyDown(document, { key: "Escape" });
    // The overlay is closed; the room is free once the engine reports the end of the pose.
    expect(rig.commands.closeInspect).toHaveBeenCalledTimes(1);
    act(() => rig.bridge.onProp("laptop", "inspect-end"));
    expect(callStatus(rig)).toBe("ringing");
    expect(rig.store().getState().call.log.at(-1)?.callId).toBe("call.recovery");
  });

  it("holds the call during an inspect pose and rings it when the pose ends", () => {
    const rig = setup({ restoreActions: AFTER_DECLINE });
    finishIntro();
    act(() => rig.bridge.onProp("note", "inspect-ready"));
    dispatch(rig, DISMISS_NOTIFICATION);
    expect(callStatus(rig)).not.toBe("ringing");
    act(() => rig.bridge.onProp("note", "inspect-end"));
    expect(callStatus(rig)).toBe("ringing");
  });
});

describe("presentation commands", () => {
  it("sends the full presentation once, then only what changed, with translated laptop text", () => {
    const rig = setup({ restoreActions: [START] });
    finishIntro();
    // First ring happens right after the intro: ringing phone.
    expect(rig.commands.setPhoneMode).toHaveBeenCalledWith("ringing");
    expect(rig.commands.setLaptopFrame).toHaveBeenCalledTimes(1);
    expect(rig.commands.setLaptopFrame).toHaveBeenLastCalledWith(null);
    expect(rig.commands.chime).not.toHaveBeenCalled();
    const phoneModeCalls = rig.commands.setPhoneMode.mock.calls.length;
    const moodCalls = rig.commands.setMood.mock.calls.length;

    // Decline: the phone goes quiet and the notification card appears with a chime.
    dispatch(rig, DECLINE);
    expect(rig.commands.setPhoneMode).toHaveBeenLastCalledWith("lock");
    expect(rig.commands.ring).toHaveBeenLastCalledWith(false);
    expect(rig.commands.setLaptopFrame).toHaveBeenLastCalledWith({
      badge: ROOM.laptop.badge.new,
      headline: ROOM.laptop.headline.new,
    });
    expect(rig.commands.chime).toHaveBeenCalledTimes(1);

    // An action that changes no presentation sends nothing.
    const phoneAfter = rig.commands.setPhoneMode.mock.calls.length;
    const frameAfter = rig.commands.setLaptopFrame.mock.calls.length;
    const ringAfter = rig.commands.ring.mock.calls.length;
    act(() => rig.bridge.onProp("calendar", "interact"));
    expect(rig.commands.setPhoneMode.mock.calls.length).toBe(phoneAfter);
    expect(rig.commands.setLaptopFrame.mock.calls.length).toBe(frameAfter);
    expect(rig.commands.ring.mock.calls.length).toBe(ringAfter);
    expect(phoneModeCalls).toBeGreaterThan(0);
    expect(moodCalls).toBeGreaterThan(0);
  });

  it("announces the new notification in the polite live region", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    dispatch(rig, DECLINE);
    const region = screen.getByTestId("room-live-region");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toContain(ROOM.announce.notification);
  });
});

describe("checkpoints", () => {
  it("writes a checkpoint when the act changes (objectives change) through the saver", () => {
    const rig = setup();
    finishIntro();
    // START_CHAPTER activated the first objective: first checkpoint.
    expect(rig.write).toHaveBeenCalled();
    const afterStart = rig.write.mock.calls.length;
    expect(rig.write.mock.calls.at(-1)?.[0].progress.checkpointId).toBe("obj.answer-or-decline");

    // The call rings (no write while a call is in progress), then ends: act 2 starts.
    dispatch(rig, DECLINE);
    expect(rig.write.mock.calls.length).toBeGreaterThan(afterStart);
    expect(rig.write.mock.calls.at(-1)?.[0].progress.checkpointId).toBe("obj.check-laptop");
  });
});
