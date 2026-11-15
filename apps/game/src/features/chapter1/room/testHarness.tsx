// Shared jsdom harness for the RoomChapterLayer path and accessibility tests (task 10.5).
// A real RoomStoryBridge with fake engine commands, the fake audio port and clock, a null save
// source and the real scenario. No WebGL, no network, no real audio.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import type { SaveGameSource, SaveReadResult } from "../../../game/saves/saveGame";
import type { VoiceManifest } from "../../../game/voice/manifestTypes";
import { createFakeAudioPort, type FakeAudioPort } from "../../../test/fakeAudioPort";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

export function fakeCommands() {
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

export const nullSaveSource: SaveGameSource = {
  read: (): SaveReadResult => ({ status: "none" }),
  write: () => true,
  clear: () => true,
};

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SILENT: VoiceManifest = { schemaVersion: 1, chapterId: "chapter-1", clips: [] };

/** A manifest with the one Alex opening clip, so the call has audible voice and Replay is enabled. */
export const ALEX_OPEN_MANIFEST: VoiceManifest = {
  schemaVersion: 1,
  chapterId: "chapter-1",
  clips: [
    {
      clipId: "alex.open",
      nodeId: "alex.open",
      graphId: "dlg.alex",
      speakerId: "spk.alex",
      locale: "en",
      status: "present",
      sources: [{ src: "/voice/en/alex.open.mp3", type: "audio/mpeg" }],
      tone: "professional",
      voiceNote: "test",
      origin: "tts-generated",
      credit: "not provided",
      sourceTextHash: "00000000",
    },
  ],
};

export interface LayerRig {
  port: FakeAudioPort;
  bridge: RoomStoryBridge;
  commands: ReturnType<typeof fakeCommands>;
  store: () => ChapterStore;
  onReturnToMenu: ReturnType<typeof vi.fn>;
  unmount: () => void;
  /** Moves the fake clock past pauses and loads, then lets promises settle. */
  settle: (ms?: number) => Promise<void>;
}

/** Renders the layer. Without `restoreActions` it starts a new game at the intro. */
export function setupLayer(
  options: { restoreActions?: readonly CoreAction[]; manifest?: VoiceManifest; saveSource?: SaveGameSource } = {},
): LayerRig {
  const bridge = new RoomStoryBridge();
  const commands = fakeCommands();
  bridge.commands = commands;
  const port = createFakeAudioPort({ autoLoad: true });
  const clock = port.clock;
  const onReturnToMenu = vi.fn();
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
      saveSource={options.saveSource ?? nullSaveSource}
      ringSettleMs={0}
      onReturnToMenu={onReturnToMenu}
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
    commands,
    onReturnToMenu,
    unmount: view.unmount,
    settle: async (ms = 3000) => {
      await act(async () => {
        for (let i = 0; i < 6; i += 1) await Promise.resolve();
        clock.advance(ms);
        for (let i = 0; i < 12; i += 1) await Promise.resolve();
      });
    },
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

/** Clicks through the intro narration until the overlay is gone. */
export function finishIntro(): void {
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) return;
    fireEvent.click(intro);
  }
  throw new Error("intro did not close");
}

/** Dispatches core actions straight to the store. Tests document each use (no UI exists for it). */
export function dispatchCore(rig: LayerRig, ...actions: CoreAction[]): void {
  for (const action of actions) {
    act(() => {
      const result = rig.store().dispatch(action);
      if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    });
  }
}
