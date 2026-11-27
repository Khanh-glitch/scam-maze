// The chapter layer decides the music scene from what the player is doing: room, street, bus or
// ending. The hook itself is tested next door; here only the wiring is checked, with the audio
// side replaced by a mock.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { RoomChapterLayer, type RoomChapterLayerProps } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";
import { useChapterMusic, type UseChapterMusicOptions } from "./useChapterMusic";

vi.mock("./useChapterMusic", () => ({ useChapterMusic: vi.fn() }));

const SESSION: ChapterSession = {
  chapterId: "chapter-1",
  chapterNumber: 1,
  sceneId: "apartment",
  origin: "new-game",
};
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

const musicHook = vi.mocked(useChapterMusic);

function bridge(): RoomStoryBridge {
  const instance = new RoomStoryBridge();
  instance.commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  };
  return instance;
}

function mount(overrides: Partial<RoomChapterLayerProps> = {}) {
  const props: RoomChapterLayerProps = {
    session: SESSION,
    settings: DEFAULT_SETTINGS,
    bridge: bridge(),
    saveSource: SAVE_SOURCE,
    ringSettleMs: 0,
    clockPaused: true,
    ...overrides,
  };
  const view = render(<RoomChapterLayer {...props} />);
  return {
    rerender: (next: Partial<RoomChapterLayerProps>) =>
      view.rerender(<RoomChapterLayer {...props} {...next} />),
  };
}

/** Clicks through the intro card until it closes (the room becomes the scene). */
function finishIntro() {
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) return;
    fireEvent.click(intro);
  }
  throw new Error("intro did not close");
}

function lastMusicOptions(): UseChapterMusicOptions {
  const calls = musicHook.mock.calls;
  return calls[calls.length - 1][0];
}

describe("RoomChapterLayer music wiring", () => {
  it("plays the theme during the intro, then the room cue with the player's settings", () => {
    mount();
    expect(lastMusicOptions().scene).toBe("intro");
    expect(lastMusicOptions().enabled).toBe(true);
    expect(lastMusicOptions().soundEnabled).toBe(true);
    expect(lastMusicOptions().volume).toBe(DEFAULT_SETTINGS.musicVolume);

    finishIntro();
    expect(screen.queryByTestId("chapter-intro")).toBeNull();
    expect(lastMusicOptions().scene).toBe("room");
  });

  it("follows the player outside and aboard Bus 06", () => {
    const { rerender } = mount();
    finishIntro();
    rerender({ outdoors: true });
    expect(lastMusicOptions().scene).toBe("street");
    rerender({ outdoors: true, onBus: true });
    expect(lastMusicOptions().scene).toBe("ride");
    rerender({ outdoors: true, onBus: true, hideHud: true });
    expect(lastMusicOptions().scene).toBe("ride");
  });

  it("passes the sound switch through", () => {
    mount({ settings: { ...DEFAULT_SETTINGS, soundEnabled: false, musicVolume: 0.2 } });
    const options = lastMusicOptions();
    expect(options.soundEnabled).toBe(false);
    expect(options.volume).toBe(0.2);
  });

  it("asks for silence while the room is not ready", () => {
    mount({ engineReady: false });
    expect(lastMusicOptions().enabled).toBe(false);
  });
});
