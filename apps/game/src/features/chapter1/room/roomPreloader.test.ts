// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeEngine {
  disposed: boolean;
  warmed: Promise<void>;
  dispose: () => void;
  commands?: unknown;
}

const created: FakeEngine[] = [];
let warmGate: { resolve: () => void; promise: Promise<void> } | null = null;
let throwOnCreate = false;

vi.mock("../../roomv2/game/engine", () => ({
  Engine: class {
    disposed = false;
    warmed: Promise<void> = warmGate ? warmGate.promise : Promise.resolve();
    constructor() {
      if (throwOnCreate) throw new Error("no webgl");
      created.push(this as unknown as FakeEngine);
    }
    dispose() {
      this.disposed = true;
    }
  },
}));
vi.mock("./RoomChapterPage", () => ({}));
vi.mock("../../roomv2", () => ({}));

import {
  canPreloadRoom,
  consumeRoomPreload,
  discardRoomPreload,
  getRoomPreloadStatus,
  peekReadyRoom,
  resetFailedRoomPreload,
  startRoomPreload,
} from "./roomPreloader";

const request = (quality: "high" | "low" = "low", language = "en") => ({ quality, language, translate: (key: string) => key });

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  warmGate = { resolve, promise };
  return warmGate;
}

async function settle() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe("canPreloadRoom", () => {
  it("allows devices that report enough memory and cores, or report nothing", () => {
    expect(canPreloadRoom({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(true);
    expect(canPreloadRoom({})).toBe(true);
  });

  it("blocks low memory, few cores and save-data", () => {
    expect(canPreloadRoom({ deviceMemory: 2 })).toBe(false);
    expect(canPreloadRoom({ hardwareConcurrency: 2 })).toBe(false);
    expect(canPreloadRoom({ connection: { saveData: true } })).toBe(false);
  });
});

describe("room preloader", () => {
  beforeEach(() => {
    created.length = 0;
    warmGate = null;
    throwOnCreate = false;
    discardRoomPreload();
  });
  afterEach(() => {
    discardRoomPreload();
    document.body.innerHTML = "";
  });

  it("is ready only after the engine has drawn its warm frame", async () => {
    const g = gate();
    startRoomPreload(request());
    await settle();
    expect(getRoomPreloadStatus()).toBe("building");
    expect(peekReadyRoom("low", "en")).toBeNull();
    g.resolve();
    await settle();
    expect(getRoomPreloadStatus()).toBe("ready");
    expect(peekReadyRoom("low", "en")?.engine).toBe(created[0]);
  });

  it("does not hand out a room built for another quality or language", async () => {
    startRoomPreload(request("low", "en"));
    await settle();
    expect(peekReadyRoom("high", "en")).toBeNull();
    expect(peekReadyRoom("low", "vi")).toBeNull();
  });

  it("builds once for the same key and rebuilds (disposing the old room) for a new key", async () => {
    startRoomPreload(request("low", "en"));
    await settle();
    startRoomPreload(request("low", "en"));
    await settle();
    expect(created).toHaveLength(1);
    startRoomPreload(request("low", "vi"));
    await settle();
    expect(created).toHaveLength(2);
    expect(created[0].disposed).toBe(true);
    expect(peekReadyRoom("low", "vi")?.engine).toBe(created[1]);
  });

  it("gives the room away once: consume empties the slot and keeps the engine alive", async () => {
    startRoomPreload(request());
    await settle();
    const room = peekReadyRoom("low", "en");
    expect(room).not.toBeNull();
    expect(consumeRoomPreload(room!.engine)).toBe(true);
    expect(getRoomPreloadStatus()).toBe("idle");
    expect(peekReadyRoom("low", "en")).toBeNull();
    expect((room!.engine as unknown as FakeEngine).disposed).toBe(false);
    expect(document.querySelector("[data-room-preload]")).toBeNull();
  });

  it("disposes an engine that finishes after the preload was discarded", async () => {
    const g = gate();
    startRoomPreload(request());
    await settle();
    discardRoomPreload();
    g.resolve();
    await settle();
    expect(created[0].disposed).toBe(true);
    expect(getRoomPreloadStatus()).toBe("idle");
    expect(document.querySelector("[data-room-preload]")).toBeNull();
  });

  it("reports failure when the engine cannot be created, and can be reset", async () => {
    throwOnCreate = true;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    startRoomPreload(request());
    await settle();
    expect(getRoomPreloadStatus()).toBe("failed");
    expect(document.querySelector("[data-room-preload]")).toBeNull();
    resetFailedRoomPreload();
    expect(getRoomPreloadStatus()).toBe("idle");
    errorSpy.mockRestore();
  });
});
