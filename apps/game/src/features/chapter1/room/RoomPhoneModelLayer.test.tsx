// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPhoneScreenSink } from "../call/phoneScreenSink";
import { RoomPhoneModelLayer, type RoomPhoneModelLayerProps } from "./RoomPhoneModelLayer";

const canvasProps: Array<Record<string, unknown>> = [];
const sharedCanvas = document.createElement("canvas");
let throwFromModel = false;

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => {
    canvasProps.push(props);
    return <div data-testid="fake-canvas">{children}</div>;
  },
  useFrame: () => undefined,
  useThree: (select: (state: unknown) => unknown) =>
    select({ gl: { domElement: sharedCanvas }, invalidate: () => undefined }),
}));

vi.mock("../call/PhoneModel3D", async () => {
  const React = await import("react");
  class Boundary extends React.Component<
    { onError: (error: unknown) => void; children: React.ReactNode },
    { failed: boolean }
  > {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch(error: unknown) {
      this.props.onError(error);
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }
  return {
    PhoneModelBoundary: Boundary,
    PhoneModel3D: ({ live }: { live: boolean }) => {
      if (throwFromModel) throw new Error("model failed");
      return <div data-testid="fake-phone-model" data-live={live ? "true" : "false"} />;
    },
  };
});

function renderLayer(overrides: Partial<RoomPhoneModelLayerProps> = {}) {
  const props: RoomPhoneModelLayerProps = {
    active: true,
    modelAllowed: true,
    ringing: false,
    screenSink: createPhoneScreenSink(),
    ...overrides,
  };
  const view = render(<RoomPhoneModelLayer {...props} />);
  return { ...view, props, rerenderWith: (next: Partial<RoomPhoneModelLayerProps>) => view.rerender(<RoomPhoneModelLayer {...props} {...next} />) };
}

describe("RoomPhoneModelLayer", () => {
  beforeEach(() => {
    canvasProps.length = 0;
    throwFromModel = false;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a demand-driven, non-interactive canvas while a call is shown", () => {
    renderLayer();
    expect(screen.getByTestId("fake-phone-model").getAttribute("data-live")).toBe("true");
    const wrapper = screen.getByTestId("room-phone-model-layer");
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.className).toContain("pointer-events-none");
    expect(wrapper.style.visibility).toBe("visible");
    expect(canvasProps[0].frameloop).toBe("demand");
  });
  it("is mounted before any call, hidden, so the model is loaded and compiled before the first ring", () => {
    const { rerenderWith } = renderLayer({ active: false });
    const wrapper = screen.getByTestId("room-phone-model-layer");
    expect(screen.getByTestId("fake-phone-model").getAttribute("data-live")).toBe("false");
    expect(wrapper.style.visibility).toBe("hidden");
    // The call opens: the same canvas is shown, nothing is mounted again.
    const canvasMounts = canvasProps.length;
    rerenderWith({ active: true });
    expect(screen.getByTestId("room-phone-model-layer")).toBe(wrapper);
    expect(wrapper.style.visibility).toBe("visible");
    expect(screen.getByTestId("fake-phone-model").getAttribute("data-live")).toBe("true");
    expect(canvasProps.length).toBeGreaterThanOrEqual(canvasMounts);
    // The call ends: hidden again, still mounted.
    rerenderWith({ active: false });
    expect(screen.getByTestId("room-phone-model-layer").style.visibility).toBe("hidden");
  });

  it("mounts nothing when the model is not allowed (2D screen is used)", () => {
    renderLayer({ modelAllowed: false });
    expect(screen.queryByTestId("fake-canvas")).toBeNull();
  });

  it("reports a model failure, publishes null so the call screen falls back to 2D", () => {
    throwFromModel = true;
    const screenSink = createPhoneScreenSink();
    screenSink.publish({ left: 1, top: 1, width: 10, height: 20 });
    const seen: Array<unknown> = [];
    screenSink.subscribe((rect) => seen.push(rect));
    const onModelError = vi.fn();
    act(() => {
      renderLayer({ screenSink, onModelError });
    });
    expect(onModelError).toHaveBeenCalledTimes(1);
    expect(screenSink.current()).toBeNull();
    expect(seen).toContain(null);
  });

  it("reports context loss and restoration, and removes its listeners on unmount", () => {
    const add = vi.spyOn(sharedCanvas, "addEventListener");
    const remove = vi.spyOn(sharedCanvas, "removeEventListener");
    const screenSink = createPhoneScreenSink();
    screenSink.publish({ left: 1, top: 1, width: 10, height: 20 });
    const onContextChange = vi.fn();
    const { unmount } = renderLayer({ onContextChange, screenSink });

    const lost = new Event("webglcontextlost", { cancelable: true });
    act(() => {
      sharedCanvas.dispatchEvent(lost);
    });
    expect(lost.defaultPrevented).toBe(true);
    expect(onContextChange).toHaveBeenLastCalledWith(true);
    expect(screenSink.current()).toBeNull();

    act(() => {
      sharedCanvas.dispatchEvent(new Event("webglcontextrestored"));
    });
    expect(onContextChange).toHaveBeenLastCalledWith(false);

    unmount();
    expect(add.mock.calls.length).toBeGreaterThan(0);
    for (const [type] of add.mock.calls) {
      expect(remove.mock.calls.some(([removed]) => removed === type)).toBe(true);
    }
    sharedCanvas.dispatchEvent(new Event("webglcontextlost"));
    expect(onContextChange).toHaveBeenCalledTimes(2);
  });
});