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
}));

vi.mock("../khupho/KhuphoStoryWorld", () => ({
  KhuphoStoryWorld: (props: { onReady: (engine: unknown) => void }) => {
    React.useEffect(() => {
      props.onReady({
        audio: { setMuted: () => undefined, setDuck: () => undefined },
        begin: () => undefined,
        suspend: () => undefined,
        resume: () => undefined,
        setInputBlocked: () => undefined,
        setPaused: () => undefined,
        placeAtHome: () => undefined,
        lock: () => undefined,
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
  RoomV2Page: (props: { story?: unknown; overlay?: React.ReactNode; onReady?: (engine: unknown) => void }) => {
    harness.roomStory = props.story;
    React.useEffect(() => {
      props.onReady?.({
        audio: { setMuted: () => undefined },
        activate: () => undefined,
        deactivate: () => undefined,
        setCursorMode: () => undefined,
        lock: () => undefined,
      });
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

    // H heads home: white doorway, then the room stage.
    act(() => {
      fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    });
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

  it("does not mount the layer without a session", async () => {
    harness.layer = null;
    render(<ProloguePage settings={DEFAULT_SETTINGS} onUpdateSettings={() => undefined} onBackToMenu={() => undefined} revealed />);
    fireEvent.click(await screen.findByRole("button", { name: "Stub begin walk" }));
    act(() => {
      fireEvent.keyDown(window, { code: "KeyH", key: "h" });
    });
    await waitFor(() => expect(screen.getByTestId("room-v2-stub")).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByTestId("chapter-layer-stub")).toBeNull();
    expect(harness.layer).toBeNull();
  });
});
