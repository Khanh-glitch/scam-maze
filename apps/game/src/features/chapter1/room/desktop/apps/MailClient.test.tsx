// MailClient on its own: layout by width, the voice's "list on screen" signal, and links outside a desktop.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceItemView, DeviceView } from "../../../../../game/narrative/device";
import { applyLocale } from "../../../../../i18n";
import { DesktopNavProvider } from "../desktopNav";
import { MailClient } from "./MailClient";

function item(id: string, extra: Partial<DeviceItemView> = {}): DeviceItemView {
  return {
    id,
    app: "mail",
    title: `Title of ${id}`,
    from: "Sender Name <sender@example.test>",
    detail: null,
    body: `Body of ${id}`,
    folder: "university",
    arrivedAtMinute: 10,
    read: false,
    tracksUnread: true,
    startsAtMinute: null,
    endsAtMinute: null,
    amount: null,
    actions: [],
    conversation: [],
    figures: null,
    ...extra,
  };
}

function viewOf(items: DeviceItemView[]): DeviceView {
  return { apps: { mail: items } } as unknown as DeviceView;
}

const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");

function setWidth(width: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => width });
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  if (originalWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
  else delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth;
});

describe("MailClient layout", () => {
  it("shows the list and the reader side by side when the window is wide, with no Back button", () => {
    setWidth(900);
    render(<MailClient view={viewOf([item("mail.a"), item("mail.b")])} onOpenItem={vi.fn()} onUseItem={vi.fn()} />);
    expect(screen.getByTestId("mail-reader-empty")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mail-row-mail.a"));
    expect(screen.getByTestId("mail-list")).toBeTruthy();
    expect(screen.getByTestId("mail-message-mail.a")).toBeTruthy();
    expect(screen.queryByTestId("mail-back")).toBeNull();
    expect(screen.getByTestId("mail-row-mail.a").getAttribute("aria-current")).toBe("true");
  });

  it("shows one pane at a time in a narrow window, with Back to Inbox", () => {
    setWidth(400);
    render(<MailClient view={viewOf([item("mail.a")])} onOpenItem={vi.fn()} onUseItem={vi.fn()} />);
    fireEvent.click(screen.getByTestId("mail-row-mail.a"));
    expect(screen.queryByTestId("mail-list")).toBeNull();
    fireEvent.click(screen.getByTestId("mail-back"));
    expect(screen.getByTestId("mail-list")).toBeTruthy();
  });

  it("shows an empty state when there is no mail", () => {
    render(<MailClient view={viewOf([])} onOpenItem={vi.fn()} onUseItem={vi.fn()} />);
    expect(screen.getByTestId("mail-empty").textContent).toContain("No messages in this folder.");
  });

  it("marks only an unread message as opened, once", () => {
    const onOpenItem = vi.fn();
    render(<MailClient view={viewOf([item("mail.a"), item("mail.b", { read: true })])} onOpenItem={onOpenItem} onUseItem={vi.fn()} />);
    fireEvent.click(screen.getByTestId("mail-row-mail.b"));
    expect(onOpenItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("mail-back"));
    fireEvent.click(screen.getByTestId("mail-row-mail.a"));
    expect(onOpenItem).toHaveBeenCalledTimes(1);
    expect(onOpenItem).toHaveBeenCalledWith("mail.a");
  });
});

describe("MailClient and the voice", () => {
  it("reports the list that is on screen, and no list while a message fills the window", () => {
    setWidth(400);
    const onView = vi.fn();
    render(<MailClient view={viewOf([item("mail.a"), item("mail.b")])} onOpenItem={vi.fn()} onUseItem={vi.fn()} onView={onView} />);
    expect(onView).toHaveBeenLastCalledWith({ app: "mail", itemIds: ["mail.a", "mail.b"] });
    fireEvent.click(screen.getByTestId("mail-row-mail.a"));
    expect(onView).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByTestId("mail-back"));
    expect(onView).toHaveBeenLastCalledWith({ app: "mail", itemIds: ["mail.a", "mail.b"] });
  });

  it("keeps reporting the list in a wide window, where it stays visible", () => {
    setWidth(900);
    const onView = vi.fn();
    render(<MailClient view={viewOf([item("mail.a")])} onOpenItem={vi.fn()} onUseItem={vi.fn()} onView={onView} />);
    fireEvent.click(screen.getByTestId("mail-row-mail.a"));
    expect(onView).toHaveBeenLastCalledWith({ app: "mail", itemIds: ["mail.a"] });
  });
});

describe("links", () => {
  const withLink = item("mail.link", { body: "Open https://pay.example/x now." });

  it("ask the desktop to open the Browser on that address", () => {
    const openBrowser = vi.fn();
    render(
      <DesktopNavProvider value={{ openBrowser, setEscapeHandler: vi.fn(), openApp: vi.fn() }}>
        <MailClient view={viewOf([withLink])} onOpenItem={vi.fn()} onUseItem={vi.fn()} />
      </DesktopNavProvider>,
    );
    fireEvent.click(screen.getByTestId("mail-row-mail.link"));
    fireEvent.click(screen.getByTestId("mail-link"));
    expect(openBrowser).toHaveBeenCalledWith({ url: "https://pay.example/x" });
  });

  it("stay plain visible text outside a desktop", () => {
    render(<MailClient view={viewOf([withLink])} onOpenItem={vi.fn()} onUseItem={vi.fn()} />);
    fireEvent.click(screen.getByTestId("mail-row-mail.link"));
    expect(screen.queryByTestId("mail-link")).toBeNull();
    expect(screen.getByTestId("mail-link-text").textContent).toBe("https://pay.example/x");
  });

  it("hide the story's open-link action, since the link replaces it, and keep other actions", () => {
    const action = (id: string) => ({ id, label: id, available: true, blocked: null, timeCostMinutes: 0, cashCost: 0 }) as unknown as DeviceItemView["actions"][number];
    render(
      <DesktopNavProvider value={{ openBrowser: vi.fn(), setEscapeHandler: vi.fn(), openApp: vi.fn() }}>
        <MailClient
          view={viewOf([item("mail.link", { body: "See https://pay.example/x", actions: [action("open-link"), action("reply")] })])}
          onOpenItem={vi.fn()}
          onUseItem={vi.fn()}
        />
      </DesktopNavProvider>,
    );
    fireEvent.click(screen.getByTestId("mail-row-mail.link"));
    expect(screen.queryByTestId("device-action-mail.link-open-link")).toBeNull();
    expect(screen.getByTestId("device-action-mail.link-reply")).toBeTruthy();
  });
});
