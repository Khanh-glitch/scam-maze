// RoomChapterLayer call, voice and narration tests, task 10.2.
// Requirements 9.4, 9.5, 13.1, 13.2, 13.5, 14.4, 14.5, 14.6.
// jsdom, a fake bridge, the fake audio port and fake clock (`test/fakeAudioPort.ts`), the real
// scenario. No WebGL, no network, no real audio.
import type { GameLocale } from "@scammaze/shared-types";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { INTRO_SEQUENCE } from "../../../game/narrative/chapter1/dialogues/intro";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import type { SaveGameSource, SaveReadResult } from "../../../game/saves/saveGame";
import type { VoiceClipEntry, VoiceManifest } from "../../../game/voice/manifestTypes";
import { applyLocale } from "../../../i18n";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import { createFakeAudioPort, type FakeAudioPort } from "../../../test/fakeAudioPort";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";
import { useInstantCallText } from "../../../test/instantCallText";

const PHONE = enPhone.phone;
const ALEX_OPEN_LINE = CHAPTER_1_SCENARIO.dialogues["dlg.alex"].lines["line.alex.open"];

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

const nullSaveSource: SaveGameSource = {
  read: (): SaveReadResult => ({ status: "none" }),
  write: () => true,
  clear: () => true,
};

function clip(graphId: VoiceClipEntry["graphId"], nodeId: string, speakerId: VoiceClipEntry["speakerId"], locale: GameLocale = "en"): VoiceClipEntry {
  return {
    clipId: nodeId,
    nodeId,
    graphId,
    speakerId,
    locale,
    status: "present",
    sources: [{ src: `/voice/${locale}/${nodeId}.mp3`, type: "audio/mpeg" }],
    tone: "professional",
    voiceNote: "test",
    origin: "tts-generated",
    credit: "not provided",
    sourceTextHash: "00000000",
  };
}

const manifestOf = (clips: VoiceClipEntry[]): VoiceManifest => ({ schemaVersion: 1, chapterId: "chapter-1", clips });
const INTRO_CLIPS = INTRO_SEQUENCE.map((id) => clip("dlg.intro", id, "spk.narrator"));
const ALEX_CLIP = clip("dlg.alex", "alex.open", "spk.alex");
const SILENT = manifestOf([]);

const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const DISMISS_NOTIFICATION: CoreAction = { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" };

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };

interface Rig {
  port: FakeAudioPort;
  bridge: RoomStoryBridge;
  store: () => ChapterStore;
  unmount: () => void;
  settle: (ms?: number) => Promise<void>;
}

function setup(options: { manifest?: VoiceManifest; restoreActions?: CoreAction[] } = {}): Rig {
  const bridge = new RoomStoryBridge();
  bridge.commands = fakeCommands();
  const port = createFakeAudioPort({ autoLoad: true });
  const clock = port.clock;
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

  const view = render(
    <RoomChapterLayer
      session={session}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={nullSaveSource}
      ringSettleMs={0}
      onStoreReady={(s) => {
        store = s;
      }}
      voiceDeps={{
        manifest: options.manifest ?? SILENT,
        createPort: () => port,
        createPreview: () => null,
        now: () => clock.now(),
        setTimer: (fn, ms) => clock.setTimer(fn, ms),
        clearTimer: (id) => clock.clearTimer(id),
        log: () => undefined,
      }}
    />,
  );
  return {
    port,
    bridge,
    unmount: view.unmount,
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
    /** Moves the fake clock past the pauses and loads, then lets promises settle. */
    settle: async (ms = 3000) => {
      await act(async () => {
        for (let i = 0; i < 6; i += 1) await Promise.resolve();
        clock.advance(ms);
        for (let i = 0; i < 12; i += 1) await Promise.resolve();
      });
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

const callStatus = (rig: Rig) => rig.store().getState().call.status;
const countAction = (rig: Rig, type: CoreAction["type"]) =>
  rig.store().getState().events.filter((event) => event.action.type === type).length;
const playedClips = (port: FakeAudioPort): string[] => port.playbacks.map((p) => p.clip.id);

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the call on the phone screen", () => {
  useInstantCallText();

  it("shows Accept and Decline while the call rings, with no call controls yet", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    expect(callStatus(rig)).toBe("ringing");
    const host = screen.getByTestId("phone-screen-host");
    expect(within(host).getByTestId("incoming-call-accept")).toBeTruthy();
    expect(within(host).getByTestId("incoming-call-decline")).toBeTruthy();
    expect(screen.queryByTestId("call-screen-mute")).toBeNull();
    expect(screen.queryByTestId("room-call-notes")).toBeNull();
  });

  it("declining dispatches END_CALL once and removes the call UI", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    const decline = screen.getByTestId("incoming-call-decline");
    fireEvent.click(decline);
    fireEvent.click(decline);
    expect(countAction(rig, "END_CALL")).toBe(1);
    expect(callStatus(rig)).toBe("declined");
    expect(screen.queryByTestId("call-presentation")).toBeNull();
  });

  it("answering shows Mute, Speaker, Replay and End call; the caller line is outside the phone", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(callStatus(rig)).toBe("active");

    const host = screen.getByTestId("phone-screen-host");
    for (const label of [PHONE.call.mute, PHONE.call.speaker, PHONE.call.replay, PHONE.call.hangUp]) {
      expect(within(host).getByText(label)).toBeTruthy();
    }
    const subtitle = screen.getByTestId("call-subtitle-line");
    expect(subtitle.textContent).toBe(ALEX_OPEN_LINE);
    expect(host.contains(subtitle)).toBe(false);
    // The phone screen shows caller info and controls only, never the script.
    expect(host.textContent).not.toContain(ALEX_OPEN_LINE);
  });

  it("shows the reply choices outside the phone and dispatches the chosen option", () => {
    const rig = setup({ restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    const host = screen.getByTestId("phone-screen-host");
    const choices = screen.getByTestId("player-choice-overlay");
    expect(host.contains(choices)).toBe(false);
    const option = screen.getByTestId("dialogue-option-alex.opt.open.ask-who");
    expect(host.contains(option)).toBe(false);
    fireEvent.click(option);
    const last = rig.store().getState().events.at(-1)?.action;
    expect(last).toEqual({ type: "SELECT_DIALOGUE_OPTION", optionId: "alex.opt.open.ask-who" });
  });

  it("End call stops the playing clip and dispatches END_CALL once", async () => {
    const rig = setup({ manifest: manifestOf([ALEX_CLIP]), restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    await rig.settle();
    expect(playedClips(rig.port)).toEqual(["/voice/en/alex.open.mp3"]);
    expect(rig.port.liveHandles).toBe(1);

    const end = screen.getByTestId("call-screen-hang-up");
    fireEvent.click(end);
    fireEvent.click(end);
    expect(countAction(rig, "END_CALL")).toBe(1);
    expect(callStatus(rig)).toBe("ended");
    await rig.settle();
    expect(rig.port.liveHandles).toBe(0);
    expect(screen.queryByTestId("call-presentation")).toBeNull();
  });
});

describe("the Speaker toggle", () => {
  it("changes the phone filter for this call only and resets for the next call", async () => {
    const rig = setup({ manifest: manifestOf([ALEX_CLIP]), restoreActions: [START, RING_ALEX] });
    finishIntro();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    await rig.settle();

    const speaker = screen.getByTestId("call-screen-speaker");
    const initial = speaker.getAttribute("aria-pressed");
    expect(initial).toBe(String(DEFAULT_SETTINGS.phoneVoiceFilter));
    expect(rig.port.playbacks.at(-1)?.phoneFilter).toBe(DEFAULT_SETTINGS.phoneVoiceFilter);

    fireEvent.click(speaker);
    expect(screen.getByTestId("call-screen-speaker").getAttribute("aria-pressed")).toBe(String(!DEFAULT_SETTINGS.phoneVoiceFilter));
    // The saved setting is a plain object here and is never written by the toggle.
    expect(DEFAULT_SETTINGS.phoneVoiceFilter).toBe(true);

    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(callStatus(rig)).toBe("ended");
    dispatch(rig, DISMISS_NOTIFICATION);
    expect(callStatus(rig)).toBe("ringing");
    expect(rig.store().getState().call.current).toBe("call.recovery");
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(screen.getByTestId("call-screen-speaker").getAttribute("aria-pressed")).toBe(initial);
  });
});

describe("Notes during a call", () => {
  it("opens the journal without ending the call, pauses the voice and resumes it after", async () => {
    const rig = setup({ manifest: manifestOf([ALEX_CLIP]), restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    await rig.settle(1500);
    expect(rig.port.liveHandles).toBe(1);

    const events = rig.store().getState().events.length;
    fireEvent.click(screen.getByTestId("room-call-notes"));
    // The journal is the top dialog and the call is still active underneath.
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs.at(-1)?.getAttribute("aria-labelledby")).toBe("evidence-journal-heading");
    expect(screen.getByTestId("call-presentation")).toBeTruthy();
    expect(callStatus(rig)).toBe("active");
    expect(rig.port.liveHandles).toBe(0);
    expect(screen.queryByTestId("room-call-notes")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById("evidence-journal-heading")).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(callStatus(rig)).toBe("active");
    expect(rig.store().getState().events.length).toBe(events);
    expect(countAction(rig, "END_CALL")).toBe(0);
    expect(rig.port.liveHandles).toBe(1);
    expect(rig.port.maxConcurrentPlaybacks).toBe(1);
    expect(screen.getByTestId("room-call-notes")).toBeTruthy();
  });
});

describe("intro narration through the voice player", () => {
  it("plays the intro lines in order and stops when the player begins", async () => {
    const rig = setup({ manifest: manifestOf([...INTRO_CLIPS, ALEX_CLIP]) });
    await rig.settle();
    expect(playedClips(rig.port)).toEqual(["/voice/en/intro.1.mp3"]);

    // First click shows the whole line, the next one moves to the next line.
    const intro = () => screen.getByTestId("chapter-intro");
    fireEvent.click(intro());
    fireEvent.click(intro());
    await rig.settle();
    expect(playedClips(rig.port)).toEqual(["/voice/en/intro.1.mp3", "/voice/en/intro.2.mp3"]);
    expect(rig.port.liveHandles).toBe(1);

    fireEvent.click(intro());
    fireEvent.click(intro());
    await rig.settle();
    expect(playedClips(rig.port)).toEqual(INTRO_SEQUENCE.map((id) => `/voice/en/${id}.mp3`));

    // Skipping through the last line begins the chapter: the narration stops at once.
    finishIntro();
    expect(rig.store().getState().status).toBe("playing");
    expect(rig.port.liveHandles).toBe(0);
    await rig.settle();
    expect(rig.port.liveHandles).toBe(0);
    // The first call rings now; answering it plays the call clip. No two clips ever overlapped.
    expect(callStatus(rig)).toBe("ringing");
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    await rig.settle();
    expect(playedClips(rig.port).at(-1)).toBe("/voice/en/alex.open.mp3");
    expect(rig.port.liveHandles).toBe(1);
    expect(rig.port.maxConcurrentPlaybacks).toBe(1);
  });

  it("stops the narration clip on unmount", async () => {
    const rig = setup({ manifest: manifestOf(INTRO_CLIPS) });
    await rig.settle();
    expect(rig.port.liveHandles).toBe(1);
    rig.unmount();
    expect(rig.port.liveHandles).toBe(0);
  });

  it("shows the text only when the clips are missing", async () => {
    const rig = setup({ manifest: SILENT });
    await rig.settle();
    expect(rig.port.playbacks).toHaveLength(0);
    expect(screen.getByTestId("chapter-intro")).toBeTruthy();
  });
});
