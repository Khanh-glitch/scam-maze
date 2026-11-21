// The laptop's interactive desktop: home screen, windows, taskbar, clock and keys. The apps are small
// stubs; what matters here is that the desktop itself never talks to the game core.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../../../i18n";
import type { LaptopExtraTab } from "../laptop/LaptopOverlay";
import { LaptopDesktop } from "./LaptopDesktop";
import type { DesktopState } from "./desktopState";

const APPS: LaptopExtraTab[] = [
  { id: "device-mail", label: "Mail", badge: 2, content: <p>Mail content</p> },
  { id: "device-files", label: "Files", content: <p>Files content</p> },
  { id: "thesis", label: "Thesis", content: <p>Thesis content</p> },
];

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

function mount(props: Partial<React.ComponentProps<typeof LaptopDesktop>> = {}) {
  const onClose = vi.fn();
  render(<LaptopDesktop apps={APPS} onClose={onClose} clockText="17:42" {...props} />);
  return { onClose, dialog: screen.getByRole("dialog", { name: "Laptop screen" }) };
}

describe("LaptopDesktop", () => {
  it("opens on the home screen with one icon per app, the unread badge and the game clock", () => {
    const { dialog } = mount();
    expect(within(dialog).getByTestId("desktop-home")).toBeTruthy();
    expect(within(dialog).getAllByRole("button", { name: /^Open / })).toHaveLength(3);
    expect(within(dialog).getByTestId("desktop-badge-device-mail").textContent).toBe("2");
    expect(within(dialog).getByRole("button", { name: "Open Mail, 2 unread" })).toBeTruthy();
    expect(within(dialog).getByTestId("desktop-clock").textContent).toBe("17:42");
    expect(within(dialog).queryByTestId("desktop-window")).toBeNull();
  });

  it("opens an app in a window, goes back to the desktop and shows it as running", () => {
    const { dialog } = mount();
    fireEvent.click(within(dialog).getByTestId("desktop-icon-device-mail"));
    const win = within(dialog).getByTestId("desktop-window");
    expect(within(win).getByText("Mail content")).toBeTruthy();
    expect(within(dialog).getByTestId("taskbar-app-device-mail").getAttribute("data-status")).toBe("active");

    fireEvent.click(within(dialog).getByTestId("desktop-back"));
    expect(within(dialog).queryByTestId("desktop-window")).toBeNull();
    expect(within(dialog).getByTestId("desktop-running-device-mail")).toBeTruthy();
    expect(within(dialog).getByTestId("taskbar-app-device-mail").getAttribute("data-status")).toBe("open");
  });

  it("switches between running apps from the taskbar", () => {
    const { dialog } = mount();
    fireEvent.click(within(dialog).getByTestId("desktop-icon-device-mail"));
    fireEvent.click(within(dialog).getByTestId("taskbar-home"));
    fireEvent.click(within(dialog).getByTestId("desktop-icon-device-files"));
    expect(within(dialog).getByText("Files content")).toBeTruthy();
    fireEvent.click(within(dialog).getByTestId("taskbar-app-device-mail"));
    expect(within(dialog).getByText("Mail content")).toBeTruthy();
    expect(within(dialog).queryByText("Files content")).toBeNull();
    expect(within(dialog).getByTestId("taskbar-app-device-files").getAttribute("data-status")).toBe("open");
  });

  it("minimizes to the taskbar, and a click on the active taskbar entry minimizes too", () => {
    const { dialog } = mount();
    fireEvent.click(within(dialog).getByTestId("desktop-icon-device-mail"));
    fireEvent.click(within(dialog).getByTestId("desktop-minimize"));
    expect(within(dialog).getByTestId("taskbar-app-device-mail").getAttribute("data-status")).toBe("minimized");
    fireEvent.click(within(dialog).getByTestId("taskbar-app-device-mail"));
    expect(within(dialog).getByTestId("taskbar-app-device-mail").getAttribute("data-status")).toBe("active");
    fireEvent.click(within(dialog).getByTestId("taskbar-app-device-mail"));
    expect(within(dialog).getByTestId("taskbar-app-device-mail").getAttribute("data-status")).toBe("minimized");
  });

  it("closes an app: its window and taskbar entry go away", () => {
    const { dialog } = mount();
    fireEvent.click(within(dialog).getByTestId("desktop-icon-thesis"));
    fireEvent.click(within(dialog).getByTestId("desktop-close-app"));
    expect(within(dialog).queryByTestId("desktop-window")).toBeNull();
    expect(within(dialog).queryByTestId("taskbar-app-thesis")).toBeNull();
    expect(within(dialog).queryByTestId("desktop-running-thesis")).toBeNull();
  });

  it("uses Escape in two steps: app to desktop, then close the laptop", () => {
    const { dialog, onClose } = mount();
    fireEvent.click(within(dialog).getByTestId("desktop-icon-device-mail"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(within(dialog).getByTestId("desktop-home")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lets the story layer ask for Escape first, and unregisters on unmount", () => {
    const registered: Array<(() => boolean) | null> = [];
    const { dialog, onClose } = mount({ registerEscape: (handler) => registered.push(handler) });
    const handler = registered[registered.length - 1];
    expect(handler).toBeTypeOf("function");
    expect(handler?.()).toBe(false);
    fireEvent.click(within(dialog).getByTestId("desktop-icon-device-files"));
    act(() => {
      expect(handler?.()).toBe(true);
    });
    expect(within(dialog).getByTestId("desktop-home")).toBeTruthy();
    // With a layer registered, the desktop does not close the laptop by itself.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens the nth app with a number key and moves between icons with the arrows", () => {
    const { dialog } = mount();
    const first = within(dialog).getByTestId("desktop-icon-device-mail");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(within(dialog).getByTestId("desktop-icon-device-files"));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(within(dialog).getByTestId("desktop-icon-thesis"));
    fireEvent.keyDown(dialog, { key: "2" });
    expect(within(dialog).getByText("Files content")).toBeTruthy();
  });

  it("keeps the open windows when it is reopened with the saved UI state", () => {
    let saved: DesktopState | undefined;
    const first = render(<LaptopDesktop apps={APPS} onClose={vi.fn()} onStateChange={(state) => { saved = state; }} />);
    fireEvent.click(within(first.container).getByTestId("desktop-icon-device-mail"));
    fireEvent.click(within(first.container).getByTestId("desktop-back"));
    first.unmount();
    render(<LaptopDesktop apps={APPS} onClose={vi.fn()} initialState={saved} />);
    expect(screen.getByTestId("taskbar-app-device-mail").getAttribute("data-status")).toBe("open");
  });

  it("closes the laptop from the taskbar and drops a window whose app disappeared", () => {
    const onClose = vi.fn();
    const view = render(<LaptopDesktop apps={APPS} onClose={onClose} />);
    fireEvent.click(within(view.container).getByTestId("desktop-icon-thesis"));
    view.rerender(<LaptopDesktop apps={APPS.filter((app) => app.id !== "thesis")} onClose={onClose} />);
    expect(within(view.container).getByTestId("desktop-home")).toBeTruthy();
    expect(within(view.container).queryByTestId("taskbar-app-thesis")).toBeNull();
    fireEvent.click(within(view.container).getByTestId("desktop-close-laptop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
