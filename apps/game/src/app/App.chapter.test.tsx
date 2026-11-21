import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChapterSession } from "../game/chapters/chapterSession";
import type { ChapterLoadRequest } from "../game/loading/chapterLoader";
import {
  SAVE_CONTENT_VERSION,
  SAVE_FORMAT_VERSION_V3,
  SAVE_STORAGE_KEY_V2,
  SAVE_STORAGE_KEY_V3,
  START_CHECKPOINT_ID,
} from "../game/saves/saveGame";
import { RoomStoryBridge } from "../features/chapter1/room/roomStoryBridge";
import enMenu from "../i18n/locales/en/menu";
import { TEST_CHAPTER } from "../test/fakeAssets";

// Routing tests for the App shell (Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 17.6, 17.7). The 3D canvas,
// the room engine page, the chapter layer and the chapter loader flow are replaced by small stubs;
// the menu, the continue rules and the placeholder are real.

const harness = vi.hoisted(() => ({
  /** Chapter ID the loading stub puts in the session it hands to the App. */
  sessionChapterId: "chapter-1",
  loadingRequest: null as ChapterLoadRequest | null,
  /** Origin of the session the loading stub hands to the App. */
  sessionOrigin: "new-game" as "new-game" | "saved-game",
  /** Props the RoomV2Page stub received (null when it is not mounted). */
  roomProps: null as null | { story?: unknown; embedded?: boolean; options?: unknown; hasOverlay: boolean },
  /** Props the RoomChapterLayer stub received (null when it is not mounted). */
  layerProps: null as null | { session: ChapterSession; bridge: unknown; engineReady?: boolean; modelAllowed?: boolean },
  /** True: a built room is waiting (the background preloader finished). False: preloading is not available. */
  preloadedRoomReady: false as boolean,
}));

// The engines cannot run in jsdom: a stub page renders the overlay it is given and reports a fake
// engine through `onReady`, as the real page does once the room is built.
vi.mock("../features/roomv2", () => ({
  RoomV2Page: (props: { story?: unknown; embedded?: boolean; options?: unknown; overlay?: React.ReactNode; onReady?: (engine: unknown) => void }) => {
    harness.roomProps = { story: props.story, embedded: props.embedded, options: props.options, hasOverlay: props.overlay !== undefined };
    React.useEffect(() => {
      props.onReady?.({ audio: { setMuted: () => undefined }, setCursorMode: () => undefined, lock: () => undefined });
    }, []);
    return (
      <div data-testid="room-v2-stub">
        {props.overlay}
      </div>
    );
  },
}));
vi.mock("../features/chapter1/room/RoomChapterLayer", () => ({
  RoomChapterLayer: (props: { session: ChapterSession; bridge: unknown; engineReady?: boolean; modelAllowed?: boolean; onReturnToMenu?: () => void }) => {
    harness.layerProps = props;
    return (
      <div data-testid="chapter-layer-stub" data-engine-ready={String(props.engineReady)}>
        <button type="button" onClick={props.onReturnToMenu}>
          Return to menu
        </button>
      </div>
    );
  },
}));

// The background room preloader needs WebGL. Tests either switch it off (the normal loading screen is
// used) or pretend a finished room is waiting (New Game skips the loading screen).
vi.mock("../features/chapter1/room/roomPreloader", async (importOriginal) => {
  const original = await importOriginal<typeof import("../features/chapter1/room/roomPreloader")>();
  const { RoomStoryBridge: Bridge } = await import("../features/chapter1/room/roomStoryBridge");
  return {
    ...original,
    canPreloadRoom: () => harness.preloadedRoomReady,
    startRoomPreload: () => undefined,
    discardRoomPreload: () => undefined,
    peekReadyRoom: () => (harness.preloadedRoomReady ? { engine: {} as never, bridge: new Bridge() } : null),
    consumeRoomPreload: () => true,
  };
});vi.mock("../game/core/GameCanvas", () => ({ GameCanvas: () => <div data-testid="menu-canvas" /> }));
vi.mock("../features/loading/MenuStartupLoading", () => ({ MenuStartupLoading: () => null }));
vi.mock("../features/testmove", () => ({ TestMovePage: () => null }));
vi.mock("../features/ueh", () => ({ UEHPage: () => null }));
vi.mock("../features/hue", () => ({ HuePage: () => null }));
vi.mock("../features/prologue", () => ({
  ProloguePage: (props: { onBackToMenu: () => void }) => (
    <div data-testid="prologue-page">
      <button type="button" onClick={props.onBackToMenu}>
        Stub prologue back
      </button>
    </div>
  ),
}));

vi.mock("../features/loading/ChapterLoadingFlow", () => ({
  ChapterLoadingFlow: (props: {
    request: ChapterLoadRequest;
    onEnterChapter: (session: ChapterSession) => void;
    onBackToMenu: () => void;
  }) => {
    harness.loadingRequest = props.request;
    const session: ChapterSession = {
      chapterId: harness.sessionChapterId,
      chapterNumber: 1,
      sceneId: "street",
      origin: harness.sessionOrigin,
    };
    return (
      <div data-testid="chapter-loading">
        <button type="button" onClick={() => props.onEnterChapter(session)}>
          Stub enter chapter
        </button>
        <button type="button" onClick={props.onBackToMenu}>
          Stub loading back
        </button>
      </div>
    );
  },
}));

// The real registry plus one test chapter whose gameplay is not available.
vi.mock("../game/chapters/chapterRegistry", async (importOriginal) => {
  const original = await importOriginal<typeof import("../game/chapters/chapterRegistry")>();
  const { TEST_CHAPTER: testChapter } = await import("../test/fakeAssets");
  return {
    ...original,
    getChapter: (id: string) => (id === testChapter.id ? testChapter : original.getChapter(id)),
  };
});

import { App } from "./App";

/** A valid version 3 save that replays: the chapter was started. */
function writeV3Save() {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY_V3,
    JSON.stringify({
      formatVersion: SAVE_FORMAT_VERSION_V3,
      contentVersion: SAVE_CONTENT_VERSION,
      chapterId: "chapter-1",
      sceneId: "apartment",
      savedAt: "2026-11-08T08:00:00.000Z",
      progress: { checkpointId: START_CHECKPOINT_ID, actions: [{ type: "START_CHAPTER" }], playerPose: null },
    }),
  );
}

function continueButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /CONTINUE/ }) as HTMLButtonElement;
}

/** Menu → NEW GAME (straight to loading, no prologue dialog) → loading stub → enter the chapter. */
function startNewGameAndEnterChapter() {
  fireEvent.click(screen.getByRole("button", { name: /NEW GAME/ }));
  expect(screen.getByTestId("chapter-loading")).toBeTruthy();
  expect(harness.loadingRequest).toEqual({ kind: "new-game", chapterId: "chapter-1" });
  fireEvent.click(screen.getByRole("button", { name: "Stub enter chapter" }));
}

beforeEach(() => {
  window.localStorage.clear();
  // These tests cover the street chapter itself; the prologue has its own test below.
  window.history.replaceState(null, "", "/?skip-prologue");
  harness.sessionChapterId = "chapter-1";
  harness.loadingRequest = null;
  harness.sessionOrigin = "new-game";
  harness.preloadedRoomReady = false;
  harness.roomProps = null;
  harness.layerProps = null;
});

afterEach(() => {
  window.localStorage.clear();
});

describe("App chapter routing", () => {
  it("renders the main menu with Continue disabled when nothing is saved", () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: "Game Main Menu" })).toBeTruthy();
    expect(screen.getByTestId("menu-canvas")).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
  });

  it("renders the room chapter page with the chapter layer for ?skip-prologue", async () => {
    render(<App />);
    startNewGameAndEnterChapter();

    expect(await screen.findByTestId("chapter-layer-stub")).toBeTruthy();
    expect(screen.queryByText("Gameplay for this chapter is still in development.")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Game Main Menu" })).toBeNull();
    // The menu canvas stays mounted underneath.
    expect(screen.getByTestId("menu-canvas")).toBeTruthy();
    // One stable bridge is shared by the engine page and the layer; the room is not in standby.
    expect(harness.roomProps).toMatchObject({ embedded: true, hasOverlay: true });
    expect(harness.roomProps?.story).toBeInstanceOf(RoomStoryBridge);
    expect(harness.layerProps?.bridge).toBe(harness.roomProps?.story);
    expect(harness.layerProps?.session).toMatchObject({ chapterId: "chapter-1", sceneId: "apartment" });
    // The page no longer forces the 2D call screen: the layer decides from the WebGL probe (3D phone, 2D fallback).
    expect(harness.layerProps?.modelAllowed).toBeUndefined();
    expect(harness.roomProps?.options).toBeUndefined();
  });

  it("continues a version 3 save into the room chapter page", async () => {
    window.history.replaceState(null, "", "/");
    writeV3Save();
    harness.sessionOrigin = "saved-game";
    render(<App />);
    expect(continueButton().disabled).toBe(false);
    fireEvent.click(continueButton());
    expect(harness.loadingRequest).toEqual({ kind: "continue" });
    fireEvent.click(screen.getByRole("button", { name: "Stub enter chapter" }));

    // A saved game never plays the prologue, even without ?skip-prologue.
    expect(await screen.findByTestId("chapter-layer-stub")).toBeTruthy();
    expect(screen.queryByTestId("prologue-page")).toBeNull();
    expect(harness.layerProps?.session.origin).toBe("saved-game");
  });

  it("shows the incompatible reason and disables Continue for a version 2 save", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY_V2, JSON.stringify({ formatVersion: 2, chapterId: "chapter-1" }));
    render(<App />);
    expect(continueButton().disabled).toBe(true);
    expect(screen.getByText(enMenu.continueReasons.incompatible)).toBeTruthy();
  });

  it("serves /roomv2 as the standalone page without the chapter layer", async () => {
    window.history.replaceState(null, "", "/roomv2");
    render(<App />);

    expect(await screen.findByTestId("room-v2-stub")).toBeTruthy();
    expect(screen.queryByTestId("chapter-layer-stub")).toBeNull();
    expect(harness.roomProps).toMatchObject({ story: undefined, hasOverlay: false });
    expect(harness.layerProps).toBeNull();
  });

  it("renders the placeholder for a chapter whose gameplay is not available", () => {
    harness.sessionChapterId = TEST_CHAPTER.id;
    render(<App />);
    startNewGameAndEnterChapter();

    expect(screen.getByText("Gameplay for this chapter is still in development.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: TEST_CHAPTER.title })).toBeTruthy();
  });

  it("returns to the menu from the chapter page and re-reads Continue availability", async () => {
    render(<App />);
    expect(continueButton().disabled).toBe(true);
    startNewGameAndEnterChapter();

    // The chapter wrote a Checkpoint while it was open.
    writeV3Save();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Return to menu/i }));
    });

    expect(await screen.findByRole("navigation", { name: "Game Main Menu" })).toBeTruthy();
    expect(continueButton().disabled).toBe(false);
  });

  it("starts a new game in the room, without the parked neighborhood prologue", async () => {
    window.history.replaceState(null, "", "/");
    render(<App />);
    startNewGameAndEnterChapter();
    expect(await screen.findByTestId("chapter-layer-stub")).toBeTruthy();
    expect(screen.queryByTestId("prologue-page")).toBeNull();
    expect(harness.layerProps?.session).toMatchObject({ chapterId: "chapter-1", origin: "new-game" });
  });

  it("opens the room straight from the menu, with no loading screen, when the room is already built", async () => {
    harness.preloadedRoomReady = true;
    window.history.replaceState(null, "", "/");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /NEW GAME/ }));
    expect(screen.queryByTestId("chapter-loading")).toBeNull();
    expect(await screen.findByTestId("chapter-layer-stub")).toBeTruthy();
    expect(harness.layerProps?.session).toMatchObject({ chapterId: "chapter-1", origin: "new-game" });
    expect(harness.layerProps?.session.progress).toBeUndefined();
  });
  it("returns to the menu when the loading flow is left", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /NEW GAME/ }));
      fireEvent.click(screen.getByRole("button", { name: "Stub loading back" }));

    expect(screen.queryByTestId("chapter-loading")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Game Main Menu" })).toBeTruthy();
  });
});
