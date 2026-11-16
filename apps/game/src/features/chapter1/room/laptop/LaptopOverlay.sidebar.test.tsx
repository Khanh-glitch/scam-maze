// Cinematic laptop window: vertical app sidebar (ARIA tablist), alert banner and the primary
// Review Security button. Uses hand-built view models, not the real scenario.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LaptopView, NotificationState } from "../../../../game/narrative/selectors";
import type { CoreAction } from "../../../../game/narrative/types";
import { applyLocale } from "../../../../i18n";
import en from "../../../../i18n/locales/en/chapter1/laptop";
import vi_ from "../../../../i18n/locales/vi/chapter1/laptop";
import { CINE } from "../../theme";
import { LaptopOverlay, nextTabIndex, type LaptopExtraTab } from "./LaptopOverlay";
import { ReviewSecurityPage } from "./ReviewSecurityPage";
import { buildReviewSecurityView } from "./laptopView";

const T = en.laptop;

function action(id: string, available = true) {
  return { id, label: id, once: true, done: false, available } as unknown as LaptopView["deviceActions"][number];
}

function makeView(state: NotificationState): LaptopView {
  return {
    notification: { state, originInspected: false, handled: state === "opened" || state === "dismissed" },
    bankApp: { opened: false, title: "", screens: [] },
    compareRows: [{ key: "contact", notification: "555-0100", reference: null }],
    deviceActions:
      state === "new"
        ? [action("dev.open-notification"), action("dev.dismiss-notification"), action("dev.review-security")]
        : [action("dev.review-security")],
  };
}

function tabsFor(view: LaptopView, dispatch: (action: CoreAction) => void): LaptopExtraTab[] {
  return [
    { id: "bank", label: T.apps.bank, content: <p>Bank content</p> },
    { id: "compare", label: T.apps.compare, content: <p>Compare content</p> },
    {
      id: "security",
      label: T.apps.security,
      content: <ReviewSecurityPage view={buildReviewSecurityView(view)} dispatch={dispatch} />,
    },
  ];
}

function renderLaptop(state: NotificationState, dispatch: (action: CoreAction) => void = vi.fn()) {
  const view = makeView(state);
  return render(<LaptopOverlay view={view} dispatch={dispatch} onClose={vi.fn()} extraTabs={tabsFor(view, dispatch)} />);
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("nextTabIndex", () => {
  it("moves with the arrow keys, wraps, and jumps with Home and End", () => {
    expect(nextTabIndex("ArrowDown", 0, 4)).toBe(1);
    expect(nextTabIndex("ArrowDown", 3, 4)).toBe(0);
    expect(nextTabIndex("ArrowUp", 0, 4)).toBe(3);
    expect(nextTabIndex("ArrowUp", 2, 4)).toBe(1);
    expect(nextTabIndex("Home", 2, 4)).toBe(0);
    expect(nextTabIndex("End", 0, 4)).toBe(3);
    expect(nextTabIndex("a", 0, 4)).toBeNull();
    expect(nextTabIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("LaptopOverlay sidebar", () => {
  it("lists the apps in a vertical tablist with an icon and a label each", () => {
    renderLaptop("new");
    const list = screen.getByRole("tablist", { name: T.appsLabel });
    expect(list.getAttribute("aria-orientation")).toBe("vertical");
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([T.apps.notifications, T.apps.bank, T.apps.compare, T.apps.security]);
    for (const tab of tabs) expect(tab.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("uses a roving tabindex: only the selected tab is a tab stop", () => {
    renderLaptop("new");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);
  });

  it("selects and focuses the next tab with ArrowDown and the previous with ArrowUp", () => {
    renderLaptop("new");
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowDown" });
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
    expect(screen.getByText("Bank content")).toBeTruthy();
    fireEvent.keyDown(tabs[1], { key: "ArrowUp" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(tabs[3].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[3]);
    fireEvent.keyDown(tabs[3], { key: "ArrowDown" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("links the selected tab to the tabpanel", () => {
    renderLaptop("new");
    const tab = screen.getByRole("tab", { selected: true });
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
  });

  it("shows an unread dot on the notifications item only while the notification is new", () => {
    const first = renderLaptop("new");
    expect(screen.getByTestId("laptop-unread-dot")).toBeTruthy();
    // The dot is decorative: the item keeps its plain name.
    expect(screen.getByRole("tab", { name: T.apps.notifications })).toBeTruthy();
    first.unmount();
    renderLaptop("opened");
    expect(screen.queryByTestId("laptop-unread-dot")).toBeNull();
  });

  it("titles the main pane Northgate Bank for the notification app", () => {
    renderLaptop("new");
    expect(screen.getByTestId("laptop-window-title").textContent).toBe(T.windowTitle);
    fireEvent.click(screen.getByRole("tab", { name: T.apps.compare }));
    expect(screen.getByTestId("laptop-window-title").textContent).toBe(T.apps.compare);
  });
});

describe("Notification alert banner", () => {
  it("shows a red Security alert banner with the existing alert text and no new wording", () => {
    renderLaptop("new");
    const banner = screen.getByTestId("laptop-alert-banner");
    expect(banner.textContent).toContain(T.notification.alertTitle);
    expect(banner.style.background).toContain("179, 52, 62");
    expect(banner.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText(T.notification.alertText)).toBeTruthy();
  });

  it("offers Review Security as the primary button next to quiet Details and Dismiss", () => {
    renderLaptop("new");
    const review = screen.getByTestId("laptop-review-security");
    expect(review.textContent).toBe(T.notification.reviewSecurity);
    expect(review.className).toContain("bg-[#7654d6]");
    const details = screen.getByRole("button", { name: T.notification.details });
    const dismiss = screen.getByRole("button", { name: T.notification.dismiss });
    expect(details.className).not.toContain("bg-[#7654d6]");
    expect(dismiss.className).not.toContain("bg-[#7654d6]");
  });

  it("opens the Review Security page, which sends dev.review-security once, as before", () => {
    const dispatch = vi.fn<(action: CoreAction) => void>();
    renderLaptop("new", dispatch);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("laptop-review-security"));
    expect(screen.getByRole("tab", { name: T.apps.security }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { level: 3, name: T.security.heading })).toBeTruthy();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "DEVICE_ACTION", deviceActionId: "dev.review-security" });
  });

  it("still dispatches the same device actions for Details and Dismiss", () => {
    const dispatch = vi.fn<(action: CoreAction) => void>();
    renderLaptop("new", dispatch);
    fireEvent.click(screen.getByRole("button", { name: T.notification.details }));
    fireEvent.click(screen.getByRole("button", { name: T.notification.dismiss }));
    expect(dispatch.mock.calls.map(([call]) => call)).toEqual([
      { type: "DEVICE_ACTION", deviceActionId: "dev.open-notification" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" },
    ]);
  });

  it("has the new strings in Vietnamese and keeps the CINE sidebar width", () => {
    expect(vi_.laptop.windowTitle.length).toBeGreaterThan(0);
    expect(vi_.laptop.notification.reviewSecurity).not.toBe(T.notification.reviewSecurity);
    expect(CINE.laptop.sidebarPx).toBeGreaterThan(120);
  });
});
