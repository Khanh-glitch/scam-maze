// LaptopOverlay and NotificationApp tests (task 9.2). Requirements 6.2, 6.3, 6.5, 6.7, 22.1.
// Uses hand-built view models, not the real scenario.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React, { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LaptopView, NotificationState } from "../../../../game/narrative/selectors";
import type { CoreAction } from "../../../../game/narrative/types";
import { applyLocale } from "../../../../i18n";
import en from "../../../../i18n/locales/en/chapter1/laptop";
import { LaptopOverlay } from "./LaptopOverlay";

const T = en.laptop;

function action(id: string, available = true, done = false) {
  return { id, label: id, once: true, done, available } as unknown as LaptopView["deviceActions"][number];
}

function makeView(state: NotificationState, inspected = false): LaptopView {
  const opened = state === "opened";
  return {
    notification: { state, originInspected: inspected, handled: state === "opened" || state === "dismissed" },
    bankApp: { opened: false, title: "", screens: [] },
    compareRows: opened
      ? [
          { key: "case", notification: "CASE-0000", reference: null },
          { key: "contact", notification: "555-0100", reference: null },
        ]
      : [],
    deviceActions:
      state === "new"
        ? [action("dev.open-notification"), action("dev.dismiss-notification")]
        : state === "dismissed"
          ? [action("dev.open-notification")]
          : opened
            ? [action("dev.inspect-notification-origin", !inspected, inspected)]
            : [],
  };
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("LaptopOverlay", () => {
  it("opens as a named dialog with the notification in the list", () => {
    render(<LaptopOverlay view={makeView("new")} dispatch={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: T.dialogLabel });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByText(T.notification.alertTitle)).toBeTruthy();
    expect(within(dialog).getByRole("tab", { name: T.apps.notifications })).toBeTruthy();
    expect(within(dialog).getByText(T.notification.badgeNew)).toBeTruthy();
  });

  it("shows an empty message when nothing was delivered", () => {
    render(<LaptopOverlay view={makeView("none")} dispatch={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(T.notification.empty)).toBeTruthy();
  });

  it("details reveal sender, app, origin, case reference and contact as plain text", () => {
    render(<LaptopOverlay view={makeView("opened", true)} dispatch={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(T.notificationDetails.senderValue)).toBeTruthy();
    expect(screen.getByText(T.notificationDetails.appValue)).toBeTruthy();
    expect(screen.getByText(T.notificationDetails.originValue)).toBeTruthy();
    expect(screen.getByText("CASE-0000")).toBeTruthy();
    expect(screen.getByText("555-0100")).toBeTruthy();
  });

  it("hides the origin until it is inspected", () => {
    render(<LaptopOverlay view={makeView("opened", false)} dispatch={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(T.notificationDetails.originValue)).toBeNull();
    expect(screen.getByRole("button", { name: T.notificationDetails.inspect })).toBeTruthy();
  });

  it("keeps a dismissed notification in the history", () => {
    render(<LaptopOverlay view={makeView("dismissed")} dispatch={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(T.notification.alertTitle)).toBeTruthy();
    expect(screen.getByText(T.notification.badgeDismissed)).toBeTruthy();
    expect(screen.getByText(T.notification.historyNote)).toBeTruthy();
    expect(screen.getByRole("button", { name: T.notification.reopen })).toBeTruthy();
  });

  it("dispatches each device action exactly once per click", () => {
    const dispatch = vi.fn<(action: CoreAction) => void>();
    const first = render(<LaptopOverlay view={makeView("new")} dispatch={dispatch} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: T.notification.details }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "DEVICE_ACTION", deviceActionId: "dev.open-notification" });
    fireEvent.click(screen.getByRole("button", { name: T.notification.dismiss }));
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenLastCalledWith({ type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" });
    first.unmount();

    const second = vi.fn<(action: CoreAction) => void>();
    render(<LaptopOverlay view={makeView("opened")} dispatch={second} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: T.notificationDetails.inspect }));
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith({
      type: "DEVICE_ACTION",
      deviceActionId: "dev.inspect-notification-origin",
    });
  });

  it("closes with the close button and with Escape", () => {
    const onClose = vi.fn();
    render(<LaptopOverlay view={makeView("new")} dispatch={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: T.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus in on open and returns it to the opener on close", () => {
    const Host: React.FC = () => {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            opener
          </button>
          {open ? <LaptopOverlay view={makeView("new")} dispatch={vi.fn()} onClose={() => setOpen(false)} /> : null}
        </div>
      );
    };
    render(<Host />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("renders extra app tabs and switches to them", () => {
    render(
      <LaptopOverlay
        view={makeView("new")}
        dispatch={vi.fn()}
        onClose={vi.fn()}
        extraTabs={[{ id: "bank", label: "Bank tab", content: <p>Bank content</p> }]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Bank tab" }));
    expect(screen.getByText("Bank content")).toBeTruthy();
  });

  it("has no link, input, form or tel/http text target", () => {
    for (const state of ["none", "new", "opened", "dismissed"] as const) {
      const { container, unmount } = render(
        <LaptopOverlay view={makeView(state, true)} dispatch={vi.fn()} onClose={vi.fn()} />,
      );
      expect(container.querySelectorAll("a, input, textarea, select, form, [href]").length).toBe(0);
      expect(container.innerHTML).not.toMatch(/tel:|href=/);
      unmount();
    }
  });
});
