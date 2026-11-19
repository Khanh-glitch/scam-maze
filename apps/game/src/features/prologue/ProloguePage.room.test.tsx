// A new game reaches the chapter layer: neighborhood -> house no. 59 -> the room stage mounts
// RoomChapterLayer with the same bridge that the room engine page received (task 12.4).
// The street world, the room engine page and the layer are stubs: no WebGL in jsdom.
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../app/settingsStorage";
import type { ChapterSession } from "../../game/chapters/chapterSession";
import { RoomStoryBridge } from "../chapter1/room/roomStoryBridge";

const harness = vi.hoisted(() => ({
  roomStory: null as unknown,
  layer: null as null | { bridge: unknown; session: ChapterSession; engineReady?: boolean; modelAllowed?: boolean },
  layerMounts: 0,
  streetMuted: [] as boolean[],
  enterHome: (() => undefined) as () => void,
  /** ctivate calls of the room engine stub. */
  activate: [] as unknown[],
  /** The room stub's onUI (the engine's state callback) and onReady; holdReady delays the room being built. */
  roomUI: (() => undefined) as (ui: Record<string, unknown>) => void,
  holdReady: false,
  releaseRoom: (() => undefined) as () => void,
  /** Every setInputBlocked value the street stub received. */
  blocked: [] as boolean[],
}));

vi.mock("../khupho/KhuphoStoryWorld", () => ({
  KhuphoStoryWorld: (props: { onReady: (engine: unknown) => void; onEnterHome?: () => void }) => {
    harness.enterHome = () => props.onEnterHome?.();
    React.useEffect(() => {
      props.onReady({
        audio: { setMuted: (m: boolean) => void harness.streetMuted.push(m), setDuck: () => undefined },
        begin: () => undefined,
        suspend: () => undefined,
        resume: () => undefined,
        setInputBlocked: (b: boolean) => void harness.blocked.push(b),
        setPaused: () => undefined,
        placeAtHome: () => undefined,
        lock: () => undefined,
        getMapData: () => null,
        getPlayerPose: () => ({ x: 0, z: 0, yaw: 0 }),
        npcPosition: () => ({ x: 10, z: 0 }),
        setNpcMarker: () => undefined,
        showPathTo: () => undefined,
        hidePath: () => undefined,
        setStoryPacing: () => undefined,
        targetPosition: () => ({ x: 10, z: 0 }),
        insideHome: () => false,
      });
    }, []);
    return null;
  },
}));
vi.mock("../player/runtime/CharacterAssetCache", () => ({ CharacterAssetCache: { loadArmsModel: () => Promise.resolve() } }));
vi.mock("../chapter1/intro/ChapterIntroOverlay", () => ({
  ChapterIntroOverlay: (props: { onBegin: () => void }) => (
    <button type="button" onClick={props.onBegin}>
      Stub begin walk
    </button>
  ),
}));
vi.mock("../roomv2", () => ({
  RoomV2Page: (props: { story?: unknown; overlay?: React.ReactNode; onReady?: (engine: unknown) => void; onUI?: (ui: Record<string, unknown>) => void }) => {
    harness.roomStory = props.story;
    harness.roomUI = (ui) => props.onUI?.(ui);
    React.useEffect(() => {
      const ready = () =>
        props.onReady?.({
          audio: { setMuted: () => undefined },
          activate: (options?: unknown) => void harness.activate.push(options),
          deactivate: () => undefined,
          setCursorMode: () => undefined,
          lock: () => undefined,
        });
      if (harness.holdReady) harness.releaseRoom = ready;
      else ready();
    }, []);
    return <div data-testid="room-v2-stub">{props.overlay}</div>;
  },
}));
vi.mock("../chapter1/room/RoomChapterLayer", () => ({
  RoomChapterLayer: (props: { bridge: unknown; session: ChapterSession; engineReady?: boolean; modelAllowed?: boolean }) => {
    harness.layer = props;
    React.useEffect(() => {
      harness.layerMounts += 1;
    }, []);
    return <div data-testid="chapter-layer-stub" />;
  },
}));

import { ProloguePage } from "./ProloguePage";

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "street", origin: "new-game" };

describe("ProloguePage chapter layer", () => {
  it("mounts the chapter layer in the room stage with the engine's bridge", async () => {
    harness.activate = [];
    harness.layerMounts = 0;
    render(
      <ProloguePage
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={() => undefined}
        onBackToMenu={() => undefined}
        revealed
        session={SESSION}
      />,
    );

    // No layer while the player is in the neighborhood.
    fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
    expect(screen.queryByTestId("chapter-layer-stub")).toBeNull();

    // H no longer sends the player home: only the white doorway of house no. 59 does.
    act(() => {
      fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    });
    expect(screen.queryByTestId("chapter-layer-stub")).toBeNull();
    // Stepping into the white doorway: the room stage.
    act(() => {
      harness.enterHome();
    });
    // The room opens with its entrance shot: the chapter layer (and its intro) waits for the shot to end.
    await waitFor(() => expect(harness.activate).toEqual([{ entrance: true }]), { timeout: 4000 });
    expect(screen.queryByTestId("chapter-layer-stub")).toBeNull();
    act(() => harness.roomUI({ started: true, ended: null, locked: true, cursorMode: false, inspecting: null }));
    await waitFor(() => expect(screen.getByTestId("chapter-layer-stub")).toBeTruthy(), { timeout: 4000 });

    expect(harness.layerMounts).toBe(1);
    expect(harness.roomStory).toBeInstanceOf(RoomStoryBridge);
    expect(harness.layer?.bridge).toBe(harness.roomStory);
    expect(harness.layer?.session).toMatchObject({ chapterId: "chapter-1", sceneId: "apartment" });
    // The page no longer forces the 2D call screen: the layer decides from the WebGL probe (3D phone, 2D fallback).
    expect(harness.layer?.modelAllowed).toBeUndefined();
    await waitFor(() => expect(harness.layer?.engineReady).toBe(true));
    // The room engine's commands are published on the bridge for the layer.
    expect((harness.roomStory as RoomStoryBridge).commands).not.toBeNull();
  });

  it("keeps the street silent once the player is in the room", async () => {
    harness.streetMuted = [];
    render(
      <ProloguePage
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={() => undefined}
        onBackToMenu={() => undefined}
        revealed
        session={SESSION}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
    act(() => {
      harness.enterHome();
    });
    await waitFor(() => expect(harness.activate.length).toBeGreaterThan(0), { timeout: 4000 });
    // The room is built after the player went home; the sound effect that runs then must not unmute the street.
    expect(harness.streetMuted.at(-1)).toBe(true);
  });
  it("enters with no white screen: the cut is the room's entrance shot", async () => {
    harness.activate = [];
    render(<ProloguePage settings={DEFAULT_SETTINGS} onUpdateSettings={() => undefined} onBackToMenu={() => undefined} revealed session={SESSION} />);
    fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
    const white = () => screen.getByTestId("prologue-white-out").style.opacity;
    expect(white()).toBe("0");
    act(() => {
      harness.enterHome();
    });
    // Nothing whites out, at once or later, and the room is activated with the entrance shot in the same call.
    expect(white()).toBe("0");
    await waitFor(() => expect(harness.activate).toEqual([{ entrance: true }]), { timeout: 4000 });
    expect(white()).toBe("0");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(white()).toBe("0");
  });
  it("enters at once with no overlay when the room is already built", async () => {
    harness.activate = [];
    render(<ProloguePage settings={DEFAULT_SETTINGS} onUpdateSettings={() => undefined} onBackToMenu={() => undefined} revealed session={SESSION} />);
    fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
    // The room is built shortly after the walk begins.
    await waitFor(() => expect(screen.getByTestId("room-v2-stub")).toBeTruthy(), { timeout: 4000 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    act(() => {
      harness.enterHome();
    });
    // Synchronous: no timer, no cover, no loading screen.
    expect(harness.activate).toEqual([{ entrance: true }]);
    expect(screen.queryByTestId("prologue-room-wait")).toBeNull();
    expect(screen.queryByText(/walking home/i)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
  it("covers a room that is still being built with plain black, then enters the moment it is ready", async () => {
    harness.activate = [];
    harness.holdReady = true;
    try {
      render(<ProloguePage settings={DEFAULT_SETTINGS} onUpdateSettings={() => undefined} onBackToMenu={() => undefined} revealed session={SESSION} />);
      fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
      act(() => {
        harness.enterHome();
      });
      expect(screen.getByTestId("prologue-room-wait")).toBeTruthy();
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.queryByText(/walking home/i)).toBeNull();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(harness.activate).toEqual([]);
      expect(screen.getByTestId("prologue-white-out").style.opacity).toBe("0");
      await waitFor(() => expect(harness.releaseRoom).not.toBeUndefined());
      act(() => harness.releaseRoom());
      // Same commit: the room is activated and the cover is gone.
      expect(harness.activate).toEqual([{ entrance: true }]);
      expect(screen.queryByTestId("prologue-room-wait")).toBeNull();
      expect(screen.getByTestId("prologue-white-out").style.opacity).toBe("0");
    } finally {
      harness.holdReady = false;
    }
  });
  it("gives up after 8 s when the room never builds: input is back and the cover is gone", async () => {
    harness.activate = [];
    harness.blocked = [];
    harness.holdReady = true;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<ProloguePage settings={DEFAULT_SETTINGS} onUpdateSettings={() => undefined} onBackToMenu={() => undefined} revealed session={SESSION} />);
      fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
      act(() => {
        harness.enterHome();
      });
      expect(screen.getByTestId("prologue-room-wait")).toBeTruthy();
      expect(harness.blocked.at(-1)).toBe(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7500);
      });
      expect(screen.getByTestId("prologue-room-wait")).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.queryByTestId("prologue-room-wait")).toBeNull();
      expect(harness.blocked.at(-1)).toBe(false);
      expect(harness.activate).toEqual([]);
      // The player can step into the doorway again.
      act(() => {
        harness.enterHome();
      });
      expect(screen.getByTestId("prologue-room-wait")).toBeTruthy();
    } finally {
      vi.useRealTimers();
      harness.holdReady = false;
    }
  });
  it("does not mount the layer without a session", async () => {
    harness.layer = null;
    render(<ProloguePage settings={DEFAULT_SETTINGS} onUpdateSettings={() => undefined} onBackToMenu={() => undefined} revealed />);
    fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
    act(() => {
      harness.enterHome();
    });
    await waitFor(() => expect(screen.getByTestId("room-v2-stub")).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByTestId("chapter-layer-stub")).toBeNull();
    expect(harness.layer).toBeNull();
  });
});
