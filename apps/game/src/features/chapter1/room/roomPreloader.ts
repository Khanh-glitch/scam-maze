/**
 * Room preloader: builds the Room v2 apartment in standby while the player is on the main menu,
 * so "New Game" can show the room without a loading screen.
 *
 * It does not create a separate preview renderer. It builds the one `Engine` the chapter will use,
 * in a hidden host element, compiles its shaders and draws one full frame (`engine.warmed`). The
 * chapter page then adopts that engine (`RoomV2Page` `preloaded`), moves its canvas into the page and
 * starts the loop. An engine that nobody adopts is disposed. Nothing here touches story state.
 */
import { setTranslator } from "../../roomv2/game/strings";
import type { Engine } from "../../roomv2/game/engine";
import { RoomStoryBridge } from "./roomStoryBridge";

export type RoomPreloadStatus = "idle" | "building" | "ready" | "failed";
export type RoomPreloadQuality = "high" | "low";

export interface RoomPreloadRequest {
  quality: RoomPreloadQuality;
  /** The room's canvas screens are drawn once with this language, so a language change needs a rebuild. */
  language: string;
  /** Translator for the room's own strings (namespace `worlds`). */
  translate: (key: string, options?: Record<string, unknown>) => string;
}

export interface PreloadedRoom {
  engine: Engine;
  bridge: RoomStoryBridge;
}

interface Slot extends PreloadedRoom {
  host: HTMLElement;
  key: string;
}

export function roomPreloadKey(quality: RoomPreloadQuality, language: string): string {
  return `${quality}:${language}`;
}

let status: RoomPreloadStatus = "idle";
let slot: Slot | null = null;
let buildingKey: string | null = null;
/** Bumped by every start and discard; a build that finishes under an older token is thrown away. */
let token = 0;
const listeners = new Set<() => void>();

function setStatus(next: RoomPreloadStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function getRoomPreloadStatus(): RoomPreloadStatus {
  return status;
}

export function subscribeRoomPreload(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

/**
 * Low-end gate. A second WebGL context with the room's textures and shadow maps costs memory, so a
 * device that reports little memory, few cores or "save data" keeps the normal loading screen.
 * Values that the browser does not report do not block.
 */
export function canPreloadRoom(nav: NavigatorHints | undefined = typeof navigator === "undefined" ? undefined : (navigator as unknown as NavigatorHints)): boolean {
  if (!nav) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return false;
  if (nav.connection?.saveData === true) return false;
  return true;
}

function disposeSlot(target: Slot | null): void {
  if (!target) return;
  try {
    target.engine.dispose();
  } catch (error) {
    console.error(error);
  }
  target.host.remove();
}

function createHost(): HTMLElement {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.roomPreload = "true";
  // Laid out at window size (the engine reads its size from the container) but never visible.
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${window.innerWidth}px;height:${window.innerHeight}px;visibility:hidden;pointer-events:none;overflow:hidden;`;
  document.body.appendChild(host);
  return host;
}

/** Starts building the room now. Safe to call repeatedly: the same key is a no-op. */
export function startRoomPreload(request: RoomPreloadRequest): void {
  const key = roomPreloadKey(request.quality, request.language);
  if ((status === "building" && buildingKey === key) || (status === "ready" && slot?.key === key)) return;
  discardRoomPreload();
  const mine = ++token;
  buildingKey = key;
  setStatus("building");
  void build(request, key, mine);
}

async function build(request: RoomPreloadRequest, key: string, mine: number): Promise<void> {
  let host: HTMLElement | null = null;
  let engine: Engine | null = null;
  try {
    // The chapter page, its layer and the room page are code chunks too: fetching them now means the
    // click only mounts them (the same dynamic imports App and RoomChapterPage use, so nothing loads twice).
    const [{ Engine: EngineClass }] = await Promise.all([
      import("../../roomv2/game/engine"),
      import("./RoomChapterPage"),
      import("../../roomv2"),
    ]);
    if (mine !== token) return;
    host = createHost();
    setTranslator(request.translate);
    const bridge = new RoomStoryBridge();
    engine = new EngineClass(host, () => undefined, request.quality, { standby: true, story: bridge });
    bridge.commands = engine;
    await engine.warmed;
    if (mine !== token) {
      engine.dispose();
      host.remove();
      return;
    }
    slot = { engine, bridge, host, key };
    setStatus("ready");
  } catch (error) {
    console.error(error);
    try {
      engine?.dispose();
    } catch {
      /* already broken */
    }
    host?.remove();
    if (mine === token) {
      buildingKey = null;
      setStatus("failed");
    }
  }
}

/** The ready room for this key, or null. Does not take it: `consumeRoomPreload` does, when the page adopts it. */
export function peekReadyRoom(quality: RoomPreloadQuality, language: string): PreloadedRoom | null {
  if (status !== "ready" || !slot) return null;
  if (slot.key !== roomPreloadKey(quality, language)) return null;
  return { engine: slot.engine, bridge: slot.bridge };
}

/** The page adopted `engine`: forget it (the page owns and disposes it from now on). */
export function consumeRoomPreload(engine: Engine): boolean {
  if (!slot || slot.engine !== engine) return false;
  slot.host.remove();
  slot = null;
  buildingKey = null;
  setStatus("idle");
  return true;
}

/** Drops a ready room and cancels a build in progress. */
export function discardRoomPreload(): void {
  token += 1;
  const old = slot;
  slot = null;
  buildingKey = null;
  disposeSlot(old);
  setStatus("idle");
}

/** Forgets a failed attempt, so the next start tries again. */
export function resetFailedRoomPreload(): void {
  if (status === "failed") setStatus("idle");
}
