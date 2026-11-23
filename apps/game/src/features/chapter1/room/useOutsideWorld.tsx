import { useEffect, useState } from "react";
import type { Engine as RoomEngine } from "../../roomv2/game/engine";
import { attachOutsideWorld, type OutsideWorldHandle } from "./outsideWorld";

export interface OutsideWorldState {
  /** The street is live around the room (the door can open onto it). */
  ready: boolean;
  /** The player is out of the room. */
  outdoors: boolean;
  /** The street's action prompt while outside ("[E] Lên xe buýt ..."). */
  prompt: string | null;
  /** Where the player is while outside. */
  zone: string | null;
}

const IDLE: OutsideWorldState = { ready: false, outdoors: false, prompt: null, zone: null };

/**
 * Plugs the Saigon open world around a built room engine once it is running (1.2 s later, so the room's first
 * frames stay smooth). Not in tests (no WebGL). Disposed with the engine or when `enabled` turns false.
 */
export function useOutsideWorld(engine: RoomEngine | null, enabled: boolean): OutsideWorldState {
  const [state, setState] = useState<OutsideWorldState>(IDLE);
  useEffect(() => {
    if (!engine || !enabled || import.meta.env.MODE === "test" || typeof engine.setOutside !== "function") return;
    let handle: OutsideWorldHandle | null = null;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void attachOutsideWorld(engine, {
        onSnapshot: (snap, outdoors) => {
          setState((prev) => {
            const prompt = outdoors ? snap.prompt : null;
            const zone = outdoors ? snap.zone : null;
            if (prev.ready && prev.outdoors === outdoors && prev.prompt === prompt && prev.zone === zone) return prev;
            return { ready: true, outdoors, prompt, zone };
          });
        },
      })
        .then((h) => {
          if (!h) return;
          if (cancelled) h.dispose();
          else {
            handle = h;
            setState((prev) => (prev.ready ? prev : { ...prev, ready: true }));
          }
        })
        .catch((error) => console.error("Outside world failed to load:", error));
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      handle?.dispose();
      setState(IDLE);
    };
  }, [engine, enabled]);
  return state;
}

/** Street prompt and location while the player is outside the room. */
export function OutsideHud({ state }: { state: OutsideWorldState }) {
  if (!state.outdoors) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" data-testid="outside-hud">
      {state.prompt && (
        <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 rounded-md bg-black/55 px-3 py-1.5 text-sm text-white backdrop-blur">
          {state.prompt}
        </div>
      )}
      {state.zone && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">
          {state.zone}
        </div>
      )}
    </div>
  );
}
