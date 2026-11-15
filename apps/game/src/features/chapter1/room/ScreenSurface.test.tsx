// Wiring tests for the "UI on the device screen" overlays. jsdom cannot project a 3D screen, so a fake
// `ScreenQuadSource` reports corners. Checks the fallback decisions of `useScreenQuad` and that the
// laptop and phone dialogs keep their role, name, focus handling and Escape in both modes.
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaptopView } from "../../../game/narrative/selectors";
import type { PhoneRecordsView } from "../../../game/narrative/selectors";
import { applyLocale } from "../../../i18n";
import { PhoneOverlay } from "../phone/PhoneOverlay";
import { LaptopOverlay } from "./laptop/LaptopOverlay";
import { ScreenQuadContext, useScreenQuad, type ScreenCorners, type ScreenQuadSource } from "./useScreenQuad";

// A laptop quad at about 75 percent of a 1280x720 view, and a phone quad at about 85 percent of the height.
const LAPTOP_CORNERS = [167, 79, 1107, 79, 1140, 670, 134, 670];
const PHONE_CORNERS = [490, 40, 800, 40, 820, 650, 470, 650];

interface FakeSource extends ScreenQuadSource {
  emit(corners: ScreenCorners | null): void;
  stops: number;
  watches: string[];
}

function makeSource(): FakeSource {
  let listener: ((corners: ScreenCorners | null) => void) | null = null;
  const source: FakeSource = {
    stops: 0,
    watches: [],
    watch(device, next) {
      listener = next;
      source.watches.push(device);
      return () => {
        source.stops += 1;
        listener = null;
      };
    },
    emit(corners) {
      listener?.(corners);
    },
  };
  return source;
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

const wrap = (source: ScreenQuadSource | null) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ScreenQuadContext.Provider value={source}>{children}</ScreenQuadContext.Provider>
  );
  return Wrapper;
};

const laptopView: LaptopView = {
  notification: { state: "new", originInspected: false, handled: false },
  bankApp: { opened: false, title: "", screens: [] },
  compareRows: [],
  deviceActions: [],
} as unknown as LaptopView;

const records: PhoneRecordsView = { calls: [], voicemail: null, summaries: [], savedContact: null, deviceActions: [] };

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
  setViewport(1280, 720);
});
afterEach(() => setViewport(1024, 768));

describe("useScreenQuad decisions", () => {
  it("is the panel without a provider", () => {
    const { result } = renderHook(() => useScreenQuad("laptop"));
    expect(result.current).toEqual({ mode: "panel", reason: "no-quad" });
  });

  it("is the panel for a null quad and the surface for a valid quad", () => {
    const source = makeSource();
    const { result } = renderHook(() => useScreenQuad("laptop"), { wrapper: wrap(source) });
    expect(result.current.mode).toBe("panel");
    act(() => source.emit(LAPTOP_CORNERS));
    expect(result.current.mode).toBe("surface");
    act(() => source.emit(null));
    expect(result.current).toEqual({ mode: "panel", reason: "no-quad" });
  });

  it("is the panel in a narrow or portrait window even with a valid quad", () => {
    setViewport(700, 500);
    const source = makeSource();
    const { result } = renderHook(() => useScreenQuad("laptop"), { wrapper: wrap(source) });
    act(() => source.emit(LAPTOP_CORNERS));
    expect(result.current).toEqual({ mode: "panel", reason: "narrow-viewport" });
    act(() => setViewport(900, 1400));
    expect(result.current).toEqual({ mode: "panel", reason: "portrait-viewport" });
    act(() => setViewport(1280, 720));
    expect(result.current.mode).toBe("surface");
  });

  it("stops watching on unmount", () => {
    const source = makeSource();
    const { unmount } = renderHook(() => useScreenQuad("phone"), { wrapper: wrap(source) });
    expect(source.watches).toEqual(["phone"]);
    unmount();
    expect(source.stops).toBe(1);
  });
});

describe("LaptopOverlay on the screen", () => {
  it("renders the panel without a quad and the surface with one, keeping the same dialog element", () => {
    const source = makeSource();
    render(<LaptopOverlay view={laptopView} dispatch={vi.fn()} onClose={vi.fn()} />, { wrapper: wrap(source) });
    const panelDialog = screen.getByRole("dialog", { name: "Laptop screen" });
    expect(document.querySelector('[data-screen-mode="panel"]')).not.toBeNull();

    act(() => source.emit(LAPTOP_CORNERS));
    expect(document.querySelector('[data-screen-mode="surface"]')).not.toBeNull();
    const surface = screen.getByTestId("screen-surface-laptop");
    expect(surface.style.transform).toMatch(/^matrix3d\(/);
    expect(surface.style.transformOrigin).toBe("0px 0px");
    const dialog = screen.getByRole("dialog", { name: "Laptop screen" });
    expect(dialog).toBe(panelDialog);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(surface.contains(dialog)).toBe(true);
    expect(dialog.className).not.toMatch(/shadow-xl/);
  });

  it("keeps Escape, the visible close button and the focus return on the surface", () => {
    const source = makeSource();
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<LaptopOverlay view={laptopView} dispatch={vi.fn()} onClose={onClose} />, { wrapper: wrap(source) });
    act(() => source.emit(LAPTOP_CORNERS));

    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Laptop" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close the laptop" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("traps Tab inside the dialog on the surface", () => {
    const source = makeSource();
    render(<LaptopOverlay view={laptopView} dispatch={vi.fn()} onClose={vi.fn()} />, { wrapper: wrap(source) });
    act(() => source.emit(LAPTOP_CORNERS));
    const dialog = screen.getByRole("dialog", { name: "Laptop screen" });
    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>("button"));
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe("PhoneOverlay on the screen", () => {
  const renderPhone = (source: ScreenQuadSource | null, onClose = vi.fn()) =>
    render(
      <PhoneOverlay
        records={records}
        messages={[]}
        onInspectEvidence={vi.fn()}
        onDeviceAction={vi.fn()}
        onCallSavedContact={vi.fn()}
        onClose={onClose}
      />,
      { wrapper: wrap(source) },
    );

  it("maps the phone dialog onto the screen and drops the frame styling", () => {
    const source = makeSource();
    renderPhone(source);
    const before = screen.getByRole("dialog", { name: "Phone" });
    expect(before.className).toMatch(/shadow-xl/);
    act(() => source.emit(PHONE_CORNERS));
    const surface = screen.getByTestId("screen-surface-phone");
    expect(surface.style.transform).toMatch(/^matrix3d\(/);
    const after = screen.getByRole("dialog", { name: "Phone" });
    expect(after).toBe(before);
    expect(after.getAttribute("aria-modal")).toBe("true");
    expect(after.className).not.toMatch(/shadow-xl|border-4/);
    // The close control stays a named, keyboard-reachable button.
    const close = screen.getByRole("button", { name: "Close phone" });
    close.focus();
    expect(document.activeElement).toBe(close);
  });

  it("falls back to the framed phone when the quad is missing", () => {
    const source = makeSource();
    renderPhone(source);
    act(() => source.emit(PHONE_CORNERS));
    act(() => source.emit(null));
    expect(screen.queryByTestId("screen-surface-phone")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Phone" }).className).toMatch(/shadow-xl/);
  });
});
