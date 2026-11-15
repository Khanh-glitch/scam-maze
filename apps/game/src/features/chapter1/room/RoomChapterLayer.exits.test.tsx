// Cross-cutting exit, audio cleanup, save and locale tests for the room chapter layer, task 13.1.
// Requirements 14.5 to 14.8, 16.5, 17.2, 17.3, 20.1 to 20.3, 23.1.
// jsdom, the shared harness (fake bridge, fake audio port and clock, real scenario). No WebGL, no
// network, no real audio. States the room has no UI shortcut for are restore lists for `setupLayer`.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readContinueAvailability } from "../../../app/continueAvailability";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import { INTRO_SEQUENCE } from "../../../game/narrative/chapter1/dialogues/intro";
import type { CoreAction } from "../../../game/narrative/types";
import { restoreProgress } from "../../../game/saves/chapterProgress";
import {
  SAVE_FORMAT_VERSION_V3,
  SAVE_STORAGE_KEY_V2,
  createLocalStorageSaveSource,
  type SaveGameSource,
  type SaveReadResult,
  type SavedGameV3,
} from "../../../game/saves/saveGame";
import type { VoiceClipEntry, VoiceManifest } from "../../../game/voice/manifestTypes";
import { applyLocale } from "../../../i18n";
import enLaptop from "../../../i18n/locales/en/chapter1/laptop";
import enOutcome from "../../../i18n/locales/en/chapter1/outcome";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import enStory from "../../../i18n/locales/en/chapter1/story";
import enMenu from "../../../i18n/locales/en/menu";
import viLaptop from "../../../i18n/locales/vi/chapter1/laptop";
import viMenu from "../../../i18n/locales/vi/menu";
import { CALL_SAVED_CONTACT, DECLINE_ALEX, reachEndingA } from "../../../test/chapterRuns";
import { MainMenuOverlay } from "../../menu/MainMenuOverlay";
import { ALEX_OPEN_MANIFEST, finishIntro, setupLayer, type LayerRig } from "./testHarness";

const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const DISMISS: CoreAction = { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" };
const RING_RECOVERY: CoreAction = { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" };
const END_CALL: CoreAction = { type: "END_CALL" };

const LAPTOP = enLaptop.laptop;
const DECISION = enOutcome.decision;
const DEBRIEF = enOutcome.debrief;

/** Alex and the third caller declined: Act V, decisions offered. */
const ACT_FIVE: CoreAction[] = [START, ...DECLINE_ALEX, DISMISS, RING_RECOVERY, END_CALL];

function introClip(nodeId: string): VoiceClipEntry {
  return {
    clipId: nodeId,
    nodeId,
    graphId: "dlg.intro",
    speakerId: "spk.narrator",
    locale: "en",
    status: "present",
    sources: [{ src: `/voice/en/${nodeId}.mp3`, type: "audio/mpeg" }],
    tone: "professional",
    voiceNote: "test",
    origin: "tts-generated",
    credit: "not provided",
    sourceTextHash: "00000000",
  };
}
const INTRO_MANIFEST: VoiceManifest = { schemaVersion: 1, chapterId: "chapter-1", clips: INTRO_SEQUENCE.map(introClip) };

function memorySaveSource() {
  let saved: SavedGameV3 | null = null;
  const write = vi.fn((save: SavedGameV3) => {
    saved = save;
    return true;
  });
  const clear = vi.fn(() => {
    saved = null;
    return true;
  });
  const source: SaveGameSource = {
    read: (): SaveReadResult => (saved ? { status: "valid", save: saved } : { status: "none" }),
    write,
    clear,
  };
  return { source, write, clear };
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
  window.localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  act(() => {
    applyLocale("en");
  });
});

const state = (rig: LayerRig) => rig.store().getState();
const countAction = (rig: LayerRig, type: CoreAction["type"]) => state(rig).events.filter((e) => e.action.type === type).length;
const openProp = (rig: LayerRig, prop: "laptop" | "phone") => act(() => rig.bridge.onProp(prop, "inspect-ready"));

describe("hang up at the first node of each call", () => {
  const cases: Array<{ name: string; callId: string; restore: CoreAction[] }> = [
    { name: "Alex", callId: "call.alex", restore: [START, RING_ALEX, ANSWER] },
    { name: "the third caller", callId: "call.recovery", restore: [START, ...DECLINE_ALEX, DISMISS, RING_RECOVERY, ANSWER] },
    {
      name: "the official line",
      callId: "call.official",
      // NO UI: the saved-contact call starts from the phone records; here it is restored as active.
      restore: [START, ...DECLINE_ALEX, CALL_SAVED_CONTACT[0], CALL_SAVED_CONTACT[1]],
    },
  ];

  for (const { name, callId, restore } of cases) {
    it(`hangs up ${name} once and leaves no conversation for that call`, () => {
      const rig = setupLayer({ restoreActions: restore });
      finishIntro();
      expect(state(rig).call.current).toBe(callId);
      expect(state(rig).call.status).toBe("active");
      expect(state(rig).conversation).not.toBeNull();

      const hangUp = screen.getByTestId("call-screen-hang-up");
      fireEvent.click(hangUp);
      fireEvent.click(hangUp);
      expect(countAction(rig, "END_CALL")).toBe(restore.filter((a) => a.type === "END_CALL").length + 1);
      expect(state(rig).events.at(-1)?.action).toEqual(END_CALL);
      expect(state(rig).call.current).not.toBe(callId);
      expect(state(rig).conversation?.callId ?? null).not.toBe(callId);
    });
  }
});

describe("closing overlays", () => {
  /** Playing, Alex declined: laptop, phone and journal are usable. */
  function freeRoom(): LayerRig {
    const rig = setupLayer({ restoreActions: [START, ...DECLINE_ALEX] });
    finishIntro();
    expect(state(rig).call.status).toBe("declined");
    return rig;
  }

  const laptopOpen = () => screen.queryByRole("dialog", { name: LAPTOP.dialogLabel });
  const phoneOpen = () => screen.queryByRole("dialog", { name: enPhone.phone.overlay.name });
  const journalOpen = () => document.getElementById("evidence-journal-heading");

  it("closes the laptop with Escape and with the close button, and leaves the inspect pose", () => {
    const rig = freeRoom();
    openProp(rig, "laptop");
    expect(laptopOpen()).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(laptopOpen()).toBeNull();
    expect(rig.commands.closeInspect).toHaveBeenCalledTimes(1);

    openProp(rig, "laptop");
    fireEvent.click(within(laptopOpen()!).getByRole("button", { name: LAPTOP.close }));
    expect(laptopOpen()).toBeNull();
    expect(rig.commands.closeInspect).toHaveBeenCalledTimes(2);
  });

  it("closes the phone records with Escape and with the close button", () => {
    const rig = freeRoom();
    openProp(rig, "phone");
    expect(phoneOpen()).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(phoneOpen()).toBeNull();

    openProp(rig, "phone");
    fireEvent.click(within(phoneOpen()!).getByRole("button", { name: enPhone.phone.overlay.close }));
    expect(phoneOpen()).toBeNull();
    expect(rig.commands.closeInspect).toHaveBeenCalledTimes(2);
  });

  it("closes the journal with Escape and with the close button", () => {
    freeRoom();
    fireEvent.click(screen.getByRole("button", { name: /^Journal/ }));
    expect(journalOpen()).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(journalOpen()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Journal/ }));
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    fireEvent.click(within(dialog).getByRole("button", { name: enStory.journal.close }));
    expect(journalOpen()).toBeNull();
  });

  it("closes the decision panel with Escape and with the close button without deciding", () => {
    const rig = setupLayer({ restoreActions: ACT_FIVE });
    finishIntro();
    const panel = () => screen.queryByRole("dialog", { name: DECISION.heading });
    expect(panel()).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Journal/ }));
    fireEvent.click(within(screen.getAllByRole("dialog").at(-1)!).getByRole("button", { name: enStory.journal.decide }));
    expect(panel()).toBeTruthy();
    fireEvent.click(within(panel()!).getByRole("button", { name: DECISION.close }));
    expect(panel()).toBeNull();
    expect(state(rig).outcome).toBeNull();
    expect(state(rig).decision).toBeNull();
  });
});

describe("quit to the menu mid-chapter and continue", () => {
  it("restores the saved state through a v3 save and shows the continue intro", () => {
    const save = memorySaveSource();
    const first = setupLayer({ saveSource: save.source });
    finishIntro();
    expect(state(first).call.current).toBe("call.alex");
    fireEvent.click(screen.getByTestId("incoming-call-decline"));
    // The checkpoint is written once the call is over and the objectives changed.
    expect(save.write).toHaveBeenCalled();
    const read = save.source.read();
    expect(read.status).toBe("valid");
    if (read.status !== "valid") return;
    expect(read.save.formatVersion).toBe(SAVE_FORMAT_VERSION_V3);

    const savedState = state(first);
    const restored = restoreProgress(read.save.progress);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.state).toEqual(savedState);

    // Quit: the layer goes away. Continue: a new layer from the saved action log.
    first.unmount();
    document.body.innerHTML = "";
    const second = setupLayer({ restoreActions: read.save.progress.actions });
    expect(state(second)).toEqual(savedState);
    // "Continue" mode: the short resume intro (no controls list and no step dots).
    expect(screen.getByTestId("chapter-intro")).toBeTruthy();
    expect(screen.queryByTestId("chapter-intro-step")).toBeNull();
    finishIntro();
    expect(state(second)).toEqual(savedState);
  });
});

describe("audio cleanup", () => {
  it("hang-up stops the playing clip in the same action", async () => {
    const rig = setupLayer({ manifest: ALEX_OPEN_MANIFEST, restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    // No settle: the clip is already stopped.
    expect(rig.port.liveHandles).toBe(0);
    expect(state(rig).call.status).toBe("ended");
  });

  it("unmounting during a call leaves no live clip and no pending timer", async () => {
    const rig = setupLayer({ manifest: ALEX_OPEN_MANIFEST, restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    rig.unmount();
    expect(rig.port.liveHandles).toBe(0);
    expect(rig.port.timers).toBe(0);
    expect(rig.port.listeners).toBe(0);
  });

  it("unmounting during the intro narration leaves no live clip and no pending timer", async () => {
    const rig = setupLayer({ manifest: INTRO_MANIFEST });
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    rig.unmount();
    expect(rig.port.liveHandles).toBe(0);
    expect(rig.port.timers).toBe(0);
    expect(rig.port.listeners).toBe(0);
  });

  it("Replay plays the current node again and only that node", async () => {
    const rig = setupLayer({ manifest: ALEX_OPEN_MANIFEST, restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    await rig.settle();
    const before = rig.port.playbacks.map((p) => p.clip.id);
    expect(before).toEqual(["/voice/en/alex.open.mp3"]);

    fireEvent.click(screen.getByTestId("call-screen-replay"));
    await rig.settle(100);
    expect(rig.port.playbacks.map((p) => p.clip.id)).toEqual(["/voice/en/alex.open.mp3", "/voice/en/alex.open.mp3"]);
    expect(rig.port.liveHandles).toBe(1);
    expect(rig.port.maxConcurrentPlaybacks).toBe(1);
    // Replay never touches the story.
    expect(countAction(rig, "SELECT_DIALOGUE_OPTION")).toBe(0);
  });

  it("Mute sets the gain of the playing clip to 0 and Unmute restores it", async () => {
    const rig = setupLayer({ manifest: ALEX_OPEN_MANIFEST, restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    await rig.settle();
    const playing = rig.port.last();
    expect(playing?.live).toBe(true);
    expect(playing?.gain).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("call-screen-mute"));
    expect(rig.port.last()?.gain).toBe(0);
    fireEvent.click(screen.getByTestId("call-screen-mute"));
    expect(rig.port.last()?.gain).toBeGreaterThan(0);
  });
});

describe("save and restart", () => {
  it("shows the incompatible-save reason for a v2 save in English and Vietnamese", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY_V2, JSON.stringify({ formatVersion: 2, chapterId: "chapter-1" }));
    const availability = readContinueAvailability(createLocalStorageSaveSource());
    expect(availability).toMatchObject({ available: false, reasonCode: "incompatible" });

    for (const [locale, reason] of [
      ["en", enMenu.continueReasons.incompatible],
      ["vi", viMenu.continueReasons.incompatible],
    ] as const) {
      act(() => {
        applyLocale(locale);
      });
      const view = render(
        <MainMenuOverlay
          settings={DEFAULT_SETTINGS}
          onUpdateSettings={() => undefined}
          onStartNewGame={() => undefined}
          onContinue={() => undefined}
          continueAvailability={availability}
        />,
      );
      expect(screen.getByText(reason)).toBeTruthy();
      view.unmount();
    }
    expect(enMenu.continueReasons.incompatible).not.toBe(viMenu.continueReasons.incompatible);
  });

  it("Replay from the debrief restarts at the chapter start with a fresh state and a cleared save", () => {
    const save = memorySaveSource();
    const rig = setupLayer({ restoreActions: reachEndingA().actions, saveSource: save.source });
    const debrief = screen.getByTestId("debrief-screen");
    expect(state(rig).status).toBe("finished");
    fireEvent.click(within(debrief).getByRole("button", { name: DEBRIEF.replay }));
    expect(save.clear).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("debrief-screen")).toBeNull();
    const fresh = state(rig);
    expect(fresh.status).toBe("playing");
    expect(fresh.outcome).toBeNull();
    expect(fresh.discovered).toEqual([]);
    expect(fresh.deductions).toEqual([]);
    expect(fresh.events.map((e) => e.action.type)).toEqual(["START_CHAPTER", "RING_CALL"]);
    expect(fresh.call.current).toBe("call.alex");
    // The finished run is gone. The new run may have written its own start checkpoint.
    const after = save.source.read();
    if (after.status === "valid") {
      expect(after.save.progress.actions.some((a) => a.type === "MAKE_DECISION" || a.type === "FINISH_CHAPTER")).toBe(false);
      expect(after.save.progress.checkpointId).not.toBe("debrief");
    }
  });
});

describe("laptop text in each locale", () => {
  const cases = [
    ["en", LAPTOP] as const,
    ["vi", viLaptop.laptop] as const,
  ];

  for (const [locale, text] of cases) {
    it(`renders the notification headline and the Review Security title in ${locale}`, () => {
      act(() => {
        applyLocale(locale);
      });
      const rig = setupLayer({ restoreActions: [START, ...DECLINE_ALEX] });
      finishIntro();
      openProp(rig, "laptop");
      const dialog = screen.getByRole("dialog", { name: text.dialogLabel });
      expect(within(dialog).getByText(text.notification.alertTitle)).toBeTruthy();

      fireEvent.click(within(dialog).getByRole("tab", { name: text.apps.security }));
      expect(within(dialog).getByRole("heading", { level: 3, name: text.security.heading })).toBeTruthy();
      // The page is the same data in both languages: no text of the other locale leaks in.
      if (locale === "vi") expect(within(dialog).queryByText(LAPTOP.notification.alertTitle)).toBeNull();
    });
  }

  it("the two locales differ for the checked strings", () => {
    expect(viLaptop.laptop.notification.alertTitle).not.toBe(LAPTOP.notification.alertTitle);
    expect(viLaptop.laptop.security.heading).not.toBe(LAPTOP.security.heading);
  });
});
