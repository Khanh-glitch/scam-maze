import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React, { useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceItemView, DeviceView } from "../../../../../game/narrative/device";
import { applyLocale } from "../../../../../i18n";
import { DesktopNavProvider, type DesktopNav } from "../desktopNav";
import { BrowserApp } from "./BrowserApp";
import { browserReducer, createBrowserState, type BrowserAction, type BrowserState } from "./browserState";

const PORTAL = "https://student.ueh.edu.vn/";
const LIBRARY = "https://lib.ueh.edu.vn/hours";
const FACTS = { accountLocked: false, draftFinished: false, tasksDone: [] as string[] };
const FEE = "https://payment-ueh.vn/confirm";

function item(id: string, extra: Partial<DeviceItemView> = {}): DeviceItemView {
  return {
    id,
    app: "mail",
    title: id,
    from: null,
    detail: null,
    body: "",
    folder: null,
    arrivedAtMinute: 0,
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

const action = (id: string, label: string) => ({ id, label, available: true, blocked: null, timeCostMinutes: 3, cashCost: 0 }) as unknown as DeviceItemView["actions"][number];
const viewOf = (items: DeviceItemView[] = []) =>
  ({ apps: { mail: items, files: [] }, calendar: { minutesLeft: 4000, thesisProgress: 50, submission: "not-submitted", now: 0 } }) as unknown as DeviceView;

interface Probe {
  state: () => BrowserState;
  dispatch: (action: BrowserAction) => void;
  escape: () => boolean;
}

function Host({ probe, view, onOpenItem, onUseItem, initial }: { probe: Probe; view: DeviceView; onOpenItem: (id: string) => void; onUseItem: (id: string, action: string) => void; initial: BrowserState }) {
  const [state, dispatch] = useReducer(browserReducer, initial);
  const escapeRef = React.useRef<(() => boolean) | null>(null);
  probe.state = () => state;
  probe.dispatch = dispatch;
  probe.escape = () => {
    let used = false;
    act(() => {
      used = escapeRef.current?.() ?? false;
    });
    return used;
  };
  const nav: DesktopNav = { openBrowser: vi.fn(), openApp: vi.fn(), setEscapeHandler: (handler) => { escapeRef.current = handler; } };
  return (
    <DesktopNavProvider value={nav}>
      <div style={{ height: 500 }}>
        <BrowserApp state={state} dispatch={dispatch} view={view} facts={FACTS} onOpenItem={onOpenItem} onUseItem={onUseItem} loadMs={0} />
      </div>
    </DesktopNavProvider>
  );
}

function mount(options: { view?: DeviceView; initial?: BrowserState } = {}) {
  const probe: Probe = { state: () => createBrowserState(), dispatch: () => undefined, escape: () => false };
  const onOpenItem = vi.fn();
  const onUseItem = vi.fn();
  render(<Host probe={probe} view={options.view ?? viewOf()} onOpenItem={onOpenItem} onUseItem={onUseItem} initial={options.initial ?? createBrowserState()} />);
  return { probe, onOpenItem, onUseItem };
}

const address = () => screen.getByTestId("browser-address") as HTMLInputElement;

async function goTo(url: string) {
  fireEvent.focus(address());
  fireEvent.change(address(), { target: { value: url } });
  fireEvent.keyDown(address(), { key: "Enter" });
  await waitFor(() => expect(screen.queryByTestId("browser-loading")).toBeNull());
}

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

describe("BrowserApp", () => {
  it("opens on a New Tab page with the bookmarks and an empty address bar", () => {
    mount();
    expect(screen.getByTestId("browser-newtab")).toBeTruthy();
    expect(address().value).toBe("");
    expect(screen.getByTestId(`newtab-bookmark-${PORTAL}`)).toBeTruthy();
    expect(screen.getByTestId("newtab-recent-empty")).toBeTruthy();
    expect(screen.getByTestId("browser-back").hasAttribute("disabled")).toBe(true);
  });

  it("opens a bookmark with a loading bar first, then goes back and forward", async () => {
    mount();
    fireEvent.click(screen.getByTestId(`newtab-bookmark-${LIBRARY}`));
    expect(address().value).toBe(LIBRARY);
    await screen.findByTestId("browser-site-library");
    expect(screen.getByTestId("browser-site-library").textContent).toContain("Opening hours");
    fireEvent.click(screen.getByTestId("browser-back"));
    await screen.findByTestId("browser-newtab");
    expect(address().value).toBe("");
    fireEvent.click(screen.getByTestId("browser-forward"));
    await screen.findByTestId("browser-site-library");
  });

  it("shows a progress bar while a page loads", () => {
    const initial = browserReducer(createBrowserState(), { type: "navigate", url: LIBRARY });
    const probe: Probe = { state: () => initial, dispatch: () => undefined, escape: () => false };
    // loadMs is 0 in the host, so render BrowserApp directly with a state that is still loading.
    render(<BrowserApp state={initial} dispatch={probe.dispatch} view={viewOf()} facts={FACTS} onOpenItem={vi.fn()} onUseItem={vi.fn()} loadMs={100000} />);
    expect(screen.getByTestId("browser-progress").getAttribute("role")).toBe("progressbar");
    expect(screen.getByTestId("browser-loading")).toBeTruthy();
  });

  it("shows an error page for an address outside the game, with no way to reach the Internet", async () => {
    mount();
    await goTo("https://www.google.com/");
    expect(screen.getByRole("alert").textContent).toContain("This site cannot be reached");
    expect(screen.getByTestId("browser-star").hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("error-home"));
    await screen.findByTestId("browser-newtab");
  });

  it("shows an invalid address error for text that is not an address", async () => {
    mount();
    await goTo("hello there");
    expect(screen.getByTestId("browser-error").textContent).toContain("This is not a valid address");
  });

  it("types an address with the keyboard and keeps it selectable and copyable", async () => {
    mount();
    fireEvent.focus(address());
    fireEvent.change(address(), { target: { value: "lib.ueh.edu.vn/hours" } });
    fireEvent.keyDown(address(), { key: "Enter" });
    await screen.findByTestId("browser-site-library");
    expect(address().value).toBe(LIBRARY);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByTestId("browser-copy"));
    expect(writeText).toHaveBeenCalledWith(LIBRARY);
    await waitFor(() => expect(screen.getByTestId("browser-copy-status").textContent).toBe("Address copied"));
  });

  it("opens a second tab, keeps each tab's own page, and closes tabs", async () => {
    const { probe } = mount();
    await goTo(LIBRARY);
    fireEvent.click(screen.getByTestId("browser-new-tab"));
    expect(probe.state().tabs).toHaveLength(2);
    await screen.findByTestId("browser-newtab");
    await goTo(PORTAL);
    const [first, second] = probe.state().tabs;
    fireEvent.click(screen.getByTestId(`browser-tab-${first.id}`));
    await screen.findByTestId("browser-site-library");
    fireEvent.click(screen.getByTestId(`browser-tab-${second.id}`));
    await screen.findByTestId("portal-site");
    fireEvent.click(screen.getByTestId(`browser-tab-close-${second.id}`));
    expect(probe.state().tabs).toHaveLength(1);
    await screen.findByTestId("browser-site-library");
    fireEvent.click(screen.getByTestId(`browser-tab-close-${first.id}`));
    expect(probe.state().tabs).toHaveLength(1);
    expect(screen.getByTestId("browser-newtab")).toBeTruthy();
  });

  it("uses keys: Alt+T for a new tab, Alt+W to close it, Alt+L for the address bar, arrows between tabs", async () => {
    const { probe } = mount();
    const app = screen.getByTestId("browser-app");
    fireEvent.keyDown(app, { key: "t", altKey: true });
    expect(probe.state().tabs).toHaveLength(2);
    fireEvent.keyDown(app, { key: "l", altKey: true });
    expect(document.activeElement).toBe(address());
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(probe.state().activeTabId).toBe(probe.state().tabs[0].id);
    fireEvent.keyDown(app, { key: "w", altKey: true });
    expect(probe.state().tabs).toHaveLength(1);
  });

  it("bookmarks the current page from the star and from the menu, and opens a bookmark from the menu", async () => {
    const { probe } = mount();
    await goTo(FEE);
    expect(screen.getByTestId("browser-star").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByTestId("browser-star"));
    expect(probe.state().bookmarks).toContain(FEE);
    fireEvent.click(screen.getByTestId("browser-bookmarks"));
    const menu = screen.getByTestId("browser-bookmarks-menu");
    expect(within(menu).getByTestId(`menu-bookmark-${FEE}`)).toBeTruthy();
    fireEvent.click(within(menu).getByTestId("menu-toggle-bookmark"));
    expect(probe.state().bookmarks).not.toContain(FEE);
    fireEvent.click(within(menu).getByTestId(`menu-bookmark-${PORTAL}`));
    expect(screen.queryByTestId("browser-bookmarks-menu")).toBeNull();
    await screen.findByTestId("portal-site");
  });

  it("shows the history of visited pages and clears it", async () => {
    mount();
    await goTo(LIBRARY);
    await goTo(PORTAL);
    fireEvent.click(screen.getByTestId("browser-history-button"));
    await screen.findByTestId("browser-history");
    expect(screen.getByTestId("history-entry-0").textContent).toContain("UEH Student Portal");
    expect(screen.getByTestId("history-entry-1").textContent).toContain("University Library");
    fireEvent.click(screen.getByTestId("history-entry-1"));
    await screen.findByTestId("browser-site-library");
    fireEvent.click(screen.getByTestId("browser-history-button"));
    await screen.findByTestId("browser-history");
    fireEvent.click(screen.getByTestId("history-clear"));
    expect(screen.getByTestId("history-empty")).toBeTruthy();
  });

  it("does not open a second History tab when one is already showing it", async () => {
    const { probe } = mount();
    await goTo(LIBRARY);
    fireEvent.click(screen.getByTestId("browser-history-button"));
    await screen.findByTestId("browser-history");
    const count = probe.state().tabs.length;
    fireEvent.click(screen.getByTestId("browser-history-button"));
    expect(probe.state().tabs).toHaveLength(count);
  });

  it("lets Escape close the menu first, then leave the address bar, then go on to the desktop", () => {
    const { probe } = mount();
    expect(probe.escape()).toBe(false);
    fireEvent.click(screen.getByTestId("browser-bookmarks"));
    expect(probe.escape()).toBe(true);
    expect(screen.queryByTestId("browser-bookmarks-menu")).toBeNull();
    fireEvent.focus(address());
    fireEvent.change(address(), { target: { value: "half typed" } });
    expect(probe.escape()).toBe(true);
    expect(address().value).toBe("");
    expect(probe.escape()).toBe(false);
  });

  it("keeps scrolling inside the page viewport", () => {
    mount();
    const viewport = screen.getByTestId("browser-viewport");
    expect(viewport.className).toContain("overscroll-contain");
    expect(viewport.className).toContain("overflow-y-auto");
  });
});

describe("the look-alike clearance site", () => {
  const source = item("mail.src", { body: `Pay: ${FEE}`, actions: [action("open-link", "Open the payment link")] });
  const page = item("page.fee", {
    detail: "payment-ueh.vn",
    title: "Fee page",
    actions: [action("close", "Close the page"), action("sign-in", "Sign in")],
  });

  it("opens the story's payment link once when the page is first shown, and does nothing else", async () => {
    const { onUseItem, probe } = mount({ view: viewOf([source]) });
    act(() => probe.dispatch({ type: "openLink", url: FEE }));
    await waitFor(() => expect(onUseItem).toHaveBeenCalledTimes(1));
    expect(onUseItem).toHaveBeenCalledWith("mail.src", "open-link");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onUseItem).toHaveBeenCalledTimes(1);
  });

  it("shows the notice with the fee and the deadline, and signing in is a separate step", async () => {
    const { onUseItem, probe } = mount({ view: viewOf([source, page]) });
    act(() => probe.dispatch({ type: "openLink", url: FEE }));
    await screen.findByTestId("fake-step-notice");
    expect(screen.getByTestId("clearance-fee").textContent).toBe("800,000 VND");
    expect(screen.getByTestId("clearance-site").textContent).not.toMatch(/scam|fake|phish|fraud|warning|dangerous|unsafe|suspicious/i);
    fireEvent.click(screen.getByTestId("clearance-continue"));
    await screen.findByTestId("fake-step-login");
    expect(onUseItem).not.toHaveBeenCalled();
    expect(screen.getByTestId("login-submit").hasAttribute("disabled")).toBe(true);
    fireEvent.focus(screen.getByTestId("login-id"));
    fireEvent.click(screen.getByTestId("login-fill"));
    expect((screen.getByTestId("login-id") as HTMLInputElement).value).toBe("ALEX-0001");
    expect(onUseItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("login-submit"));
    expect(onUseItem).toHaveBeenCalledTimes(1);
    expect(onUseItem).toHaveBeenCalledWith("page.fee", "sign-in");
  });

  it("keeps the form values of a tab while the player looks elsewhere, and closing the tab calls nothing", async () => {
    const { onUseItem, probe } = mount({ view: viewOf([source, page]) });
    act(() => probe.dispatch({ type: "openLink", url: "https://payment-ueh.vn/login" }));
    await screen.findByTestId("fake-step-login");
    fireEvent.focus(screen.getByTestId("login-id"));
    fireEvent.click(screen.getByTestId("login-fill"));
    expect(probe.state().tabs.find((tab) => tab.id === probe.state().activeTabId)?.fields["login.id"]).toBe("ALEX-0001");
    fireEvent.click(screen.getByTestId(`browser-tab-close-${probe.state().activeTabId}`));
    expect(onUseItem).not.toHaveBeenCalled();
  });

  it("saves the page address as evidence only from the menu, as the player's own step", async () => {
    const withSave = item("page.fee", {
      detail: "payment-ueh.vn",
      actions: [action("sign-in", "Sign in"), action("save-address", "Save the page address as evidence")],
    });
    const { onUseItem, probe } = mount({ view: viewOf([source, withSave]) });
    act(() => probe.dispatch({ type: "openLink", url: FEE }));
    await screen.findByTestId("fake-step-notice");
    expect(onUseItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("browser-bookmarks"));
    fireEvent.click(screen.getByTestId("menu-save-address"));
    expect(onUseItem).toHaveBeenCalledTimes(1);
    expect(onUseItem).toHaveBeenCalledWith("page.fee", "save-address");
  });

  it("shows an error when the page has no way to be opened", async () => {
    const { probe } = mount({ view: viewOf([]) });
    act(() => probe.dispatch({ type: "openLink", url: FEE }));
    await screen.findByTestId("browser-unavailable");
  });
});
