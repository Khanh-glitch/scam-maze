// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preload = vi.hoisted(() => ({
  status: "idle" as "idle" | "building" | "ready" | "failed",
  listeners: new Set<() => void>(),
  ready: false,
  canPreload: true,
  started: [] as unknown[],
}));

vi.mock("../features/chapter1/room/roomPreloader", () => ({
  canPreloadRoom: () => preload.canPreload,
  discardRoomPreload: vi.fn(() => {
    preload.status = "idle";
    preload.ready = false;
  }),
  getRoomPreloadStatus: () => preload.status,
  peekReadyRoom: () => (preload.ready ? { engine: {}, bridge: {} } : null),
  resetFailedRoomPreload: () => {
    if (preload.status === "failed") preload.status = "idle";
  },
  startRoomPreload: (request: unknown) => {
    preload.started.push(request);
    if (preload.status !== "ready") preload.status = "building";
    preload.listeners.forEach((l) => l());
  },
  subscribeRoomPreload: (listener: () => void) => {
    preload.listeners.add(listener);
    return () => preload.listeners.delete(listener);
  },
}));

import { ROOM_PRELOAD_DELAY_MS, useInstantNewGame } from "./useInstantNewGame";

function setup(overrides: Partial<Parameters<typeof useInstantNewGame>[0]> = {}) {
  const onEnterDirect = vi.fn();
  const onFallback = vi.fn();
  const view = renderHook(() =>
    useInstantNewGame({
      enabled: true,
      available: true,
      quality: "low",
      language: "en",
      translate: (key) => key,
      onEnterDirect,
      onFallback,
      ...overrides,
    }),
  );
  return { ...view, onEnterDirect, onFallback };
}

function becomeReady() {
  preload.status = "ready";
  preload.ready = true;
  preload.listeners.forEach((l) => l());
}

describe("useInstantNewGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preload.status = "idle";
    preload.ready = false;
    preload.canPreload = true;
    preload.started = [];
    preload.listeners.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("starts building in the background once the menu has settled", () => {
    setup();
    expect(preload.started).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(ROOM_PRELOAD_DELAY_MS));
    expect(preload.started).toHaveLength(1);
  });

  it("does not build in the background when the menu is not settled", () => {
    setup({ enabled: false });
    act(() => void vi.advanceTimersByTime(ROOM_PRELOAD_DELAY_MS * 2));
    expect(preload.started).toHaveLength(0);
  });

  it("enters the room at once when it is ready", () => {
    preload.status = "ready";
    preload.ready = true;
    const { result, onEnterDirect, onFallback } = setup();
    act(() => result.current.requestNewGame());
    expect(onEnterDirect).toHaveBeenCalledTimes(1);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("goes to the loading screen at once while the room is still being built", () => {
    const { result, onEnterDirect, onFallback } = setup();
    act(() => result.current.requestNewGame());
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onEnterDirect).not.toHaveBeenCalled();
    act(() => becomeReady());
    expect(onEnterDirect).not.toHaveBeenCalled();
  });
  it("goes to the loading screen when the room build failed", () => {
    preload.status = "failed";
    const { result, onEnterDirect, onFallback } = setup();
    act(() => result.current.requestNewGame());
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onEnterDirect).not.toHaveBeenCalled();
  });
  it("uses the normal loading screen when preloading is not allowed", () => {
    preload.canPreload = false;
    const { result, onFallback } = setup();
    act(() => result.current.requestNewGame());
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(preload.started).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(ROOM_PRELOAD_DELAY_MS * 2));
    expect(preload.started).toHaveLength(0);
  });

  it("uses the normal loading screen when the new game must not skip it (prologue)", () => {
    const { result, onFallback } = setup({ available: false, enabled: false });
    act(() => result.current.requestNewGame());
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

});
