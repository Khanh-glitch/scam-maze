import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  canPreloadRoom,
  discardRoomPreload,
  getRoomPreloadStatus,
  peekReadyRoom,
  resetFailedRoomPreload,
  startRoomPreload,
  subscribeRoomPreload,
  type RoomPreloadQuality,
  type RoomPreloadRequest,
} from "../features/chapter1/room/roomPreloader";

/** The room is built after the menu has been up for this long, so the menu's first seconds stay smooth. */
export const ROOM_PRELOAD_DELAY_MS = 1500;
/** A New Game that waits for the room gives up after this long and uses the normal loading screen. */
export const ROOM_PRELOAD_WAIT_LIMIT_MS = 10_000;

export interface InstantNewGameOptions {
  /** True while the main menu is shown and settled: the room may be built in the background. */
  enabled: boolean;
  /** True when the new game goes straight to the apartment (no prologue), so it may skip the loading screen. */
  available: boolean;
  quality: RoomPreloadQuality;
  language: string;
  translate: RoomPreloadRequest["translate"];
  /** The room is ready: go straight into it. */
  onEnterDirect: () => void;
  /** The room cannot be preloaded or failed: use the normal chapter loading screen. */
  onFallback: () => void;
}

export interface InstantNewGame {
  /** True while New Game waits for the room; the menu stays visible and shows a small loader. */
  pending: boolean;
  requestNewGame: () => void;
  cancelPending: () => void;
}

/**
 * Builds the Room v2 apartment in the background while the main menu is open (`roomPreloader`) and
 * decides what New Game does: enter at once when the room is ready, wait on the menu with a loader
 * when it is still being built, or fall back to the loading screen when preloading is not possible.
 */
export function useInstantNewGame(options: InstantNewGameOptions): InstantNewGame {
  const { enabled, available, quality, language, translate } = options;
  const status = useSyncExternalStore(subscribeRoomPreload, getRoomPreloadStatus, getRoomPreloadStatus);
  const [pending, setPending] = useState(false);
  const latest = useRef(options);
  latest.current = options;

  // Build in the background once the menu has settled (and when quality or language change).
  useEffect(() => {
    if (!enabled || !canPreloadRoom()) return undefined;
    const timer = window.setTimeout(() => {
      startRoomPreload({ quality, language, translate: (key, o) => latest.current.translate(key, o) });
    }, ROOM_PRELOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, quality, language, translate]);

  const requestNewGame = useCallback(() => {
    const current = latest.current;
    if (!current.available || !canPreloadRoom()) {
      current.onFallback();
      return;
    }
    if (peekReadyRoom(current.quality, current.language)) {
      current.onEnterDirect();
      return;
    }
    setPending(true);
    resetFailedRoomPreload();
    startRoomPreload({ quality: current.quality, language: current.language, translate: (key, o) => latest.current.translate(key, o) });
  }, []);

  const cancelPending = useCallback(() => setPending(false), []);

  // Pending New Game: continue when the room is ready, fall back when it failed or takes too long.
  useEffect(() => {
    if (!pending) return undefined;
    const current = latest.current;
    if (status === "ready" && peekReadyRoom(current.quality, current.language)) {
      setPending(false);
      current.onEnterDirect();
      return undefined;
    }
    if (status === "failed") {
      setPending(false);
      resetFailedRoomPreload();
      current.onFallback();
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setPending(false);
      discardRoomPreload();
      latest.current.onFallback();
    }, ROOM_PRELOAD_WAIT_LIMIT_MS);
    return () => window.clearTimeout(timer);
  }, [pending, status]);

  // Leaving the menu ends the wait.
  useEffect(() => {
    if (!available) setPending(false);
  }, [available]);

  return { pending, requestNewGame, cancelPending };
}
