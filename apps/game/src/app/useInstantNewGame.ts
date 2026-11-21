import { useCallback, useEffect, useRef } from "react";
import { canPreloadRoom, peekReadyRoom, startRoomPreload, type RoomPreloadQuality, type RoomPreloadRequest } from "../features/chapter1/room/roomPreloader";
/** The room is built after the menu has been up for this long, so the menu's first seconds stay smooth. */
export const ROOM_PRELOAD_DELAY_MS = 1500;
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
  /** The room is not ready (still building, failed or not possible): use the normal chapter loading screen. */
  onFallback: () => void;
}
export interface InstantNewGame {
  requestNewGame: () => void;
}
/**
 * Builds the Room v2 apartment in the background while the main menu is open (`roomPreloader`) and
 * decides what New Game does: enter at once when the room is ready, otherwise go to the loading
 * screen right away (the menu never waits on New Game).
 */
export function useInstantNewGame(options: InstantNewGameOptions): InstantNewGame {
  const { enabled, quality, language, translate } = options;
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
    if (current.available && canPreloadRoom() && peekReadyRoom(current.quality, current.language)) current.onEnterDirect();
    else current.onFallback();
  }, []);
  return { requestNewGame };
}
