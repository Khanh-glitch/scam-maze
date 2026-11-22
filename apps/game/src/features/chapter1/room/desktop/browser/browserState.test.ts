import { describe, expect, it } from "vitest";
import {
  INITIAL_BROWSER_STATE,
  activeTab,
  browserReducer,
  canGoBack,
  canGoForward,
  createBrowserState,
  currentUrl,
  isBrowserState,
  type BrowserAction,
  type BrowserState,
} from "./browserState";

const PORTAL = "https://student.ueh.edu.vn/";
const LIBRARY = "https://lib.ueh.edu.vn/hours";
const FEE = "https://payment-ueh.vn/confirm";

function run(actions: BrowserAction[], from: BrowserState = createBrowserState()): BrowserState {
  return actions.reduce(browserReducer, from);
}

/** Finishes the load of every tab, as the browser's timers do. */
function settle(state: BrowserState): BrowserState {
  return state.tabs.reduce((next, tab) => browserReducer(next, { type: "loaded", tabId: tab.id }), state);
}

describe("browserReducer", () => {
  it("starts with one New Tab, the default bookmarks and an empty history", () => {
    expect(INITIAL_BROWSER_STATE.tabs).toHaveLength(1);
    expect(currentUrl(activeTab(INITIAL_BROWSER_STATE))).toBe("about:newtab");
    expect(INITIAL_BROWSER_STATE.bookmarks).toEqual([PORTAL, LIBRARY]);
    expect(INITIAL_BROWSER_STATE.history).toEqual([]);
    expect(isBrowserState(INITIAL_BROWSER_STATE)).toBe(true);
  });

  it("navigates with a loading state, then records a known page in the history once", () => {
    let state = run([{ type: "navigate", url: LIBRARY }]);
    expect(activeTab(state).status).toBe("loading");
    expect(state.history).toEqual([]);
    state = settle(state);
    expect(activeTab(state).status).toBe("ready");
    expect(state.history).toEqual([LIBRARY]);
    // A second "loaded" for the same navigation changes nothing.
    expect(browserReducer(state, { type: "loaded", tabId: activeTab(state).id })).toBe(state);
  });

  it("does not put internal pages or error pages into the history", () => {
    const state = settle(run([{ type: "navigate", url: "about:history" }]));
    const bad = settle(run([{ type: "navigate", url: "https://nowhere.example/" }], state));
    expect(bad.history).toEqual([]);
  });

  it("goes back and forward inside one tab and drops the pages after a new navigation", () => {
    let state = settle(run([{ type: "navigate", url: PORTAL }]));
    state = settle(run([{ type: "navigate", url: LIBRARY }], state));
    expect(canGoBack(activeTab(state))).toBe(true);
    state = settle(run([{ type: "back" }], state));
    expect(currentUrl(activeTab(state))).toBe(PORTAL);
    expect(canGoForward(activeTab(state))).toBe(true);
    state = settle(run([{ type: "forward" }], state));
    expect(currentUrl(activeTab(state))).toBe(LIBRARY);
    state = settle(run([{ type: "back" }, { type: "navigate", url: FEE }], settle(state)));
    expect(activeTab(state).entries.at(-1)).toBe(FEE);
    expect(canGoForward(activeTab(state))).toBe(false);
  });

  it("back at the first page and forward at the last page do nothing", () => {
    const state = createBrowserState();
    expect(browserReducer(state, { type: "back" })).toBe(state);
    expect(browserReducer(state, { type: "forward" })).toBe(state);
  });

  it("opens, selects and closes tabs, and never leaves zero tabs", () => {
    let state = run([{ type: "newTab" }, { type: "newTab", url: LIBRARY }]);
    expect(state.tabs).toHaveLength(3);
    const [first, second, third] = state.tabs;
    expect(state.activeTabId).toBe(third.id);
    state = run([{ type: "selectTab", id: first.id }], state);
    expect(state.activeTabId).toBe(first.id);
    state = run([{ type: "closeTab", id: second.id }], state);
    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabId).toBe(first.id);
    state = run([{ type: "closeTab", id: first.id }], state);
    expect(state.activeTabId).toBe(third.id);
    state = run([{ type: "closeTab", id: third.id }], state);
    expect(state.tabs).toHaveLength(1);
    expect(currentUrl(activeTab(state))).toBe("about:newtab");
  });

  it("keeps a route and a scroll position per tab", () => {
    let state = settle(run([{ type: "navigate", url: LIBRARY }]));
    const a = activeTab(state).id;
    state = run([{ type: "scroll", tabId: a, top: 120.4 }, { type: "newTab" }], state);
    const b = activeTab(state).id;
    state = settle(run([{ type: "navigate", url: PORTAL }], state));
    expect(state.tabs.find((tab) => tab.id === a)).toMatchObject({ scrollTop: 120, entries: ["about:newtab", LIBRARY] });
    expect(state.tabs.find((tab) => tab.id === b)).toMatchObject({ scrollTop: 0 });
    expect(currentUrl(state.tabs.find((tab) => tab.id === b)!)).toBe(PORTAL);
  });

  describe("links from other apps", () => {
    it("reuse an empty New Tab", () => {
      const state = run([{ type: "openLink", url: FEE }]);
      expect(state.tabs).toHaveLength(1);
      expect(currentUrl(activeTab(state))).toBe(FEE);
    });

    it("open a new tab when the active tab has a page, and do not create a duplicate for the same address", () => {
      let state = settle(run([{ type: "navigate", url: LIBRARY }, { type: "openLink", url: FEE }]));
      expect(state.tabs).toHaveLength(2);
      state = run([{ type: "selectTab", id: state.tabs[0].id }, { type: "openLink", url: FEE }], state);
      expect(state.tabs).toHaveLength(2);
      expect(currentUrl(activeTab(state))).toBe(FEE);
      // The same page spelled differently is the same page.
      state = run([{ type: "openLink", url: `${FEE}/?ref=mail` }], state);
      expect(state.tabs).toHaveLength(2);
    });
  });

  it("bookmarks only known pages, and toggles", () => {
    let state = run([{ type: "toggleBookmark", url: FEE }]);
    expect(state.bookmarks).toContain(FEE);
    state = run([{ type: "toggleBookmark", url: FEE }], state);
    expect(state.bookmarks).not.toContain(FEE);
    expect(run([{ type: "toggleBookmark", url: "https://nowhere.example/" }])).toEqual(createBrowserState());
    expect(run([{ type: "toggleBookmark", url: "about:newtab" }])).toEqual(createBrowserState());
  });

  it("clears the history and goes home to the New Tab page", () => {
    let state = settle(run([{ type: "navigate", url: LIBRARY }]));
    expect(state.history).toHaveLength(1);
    state = run([{ type: "clearHistory" }, { type: "home" }], state);
    expect(state.history).toEqual([]);
    expect(currentUrl(activeTab(state))).toBe("about:newtab");
  });

  it("ignores progress for a tab that finished and moves progress only forward", () => {
    let state = run([{ type: "navigate", url: LIBRARY }]);
    const id = activeTab(state).id;
    state = run([{ type: "progress", tabId: id, value: 0.7 }, { type: "progress", tabId: id, value: 0.3 }], state);
    expect(activeTab(state).progress).toBe(0.7);
    state = settle(state);
    expect(browserReducer(state, { type: "progress", tabId: id, value: 0.2 })).toBe(state);
  });

  it("never mutates the state it was given", () => {
    const state = settle(run([{ type: "navigate", url: LIBRARY }]));
    const copy = JSON.parse(JSON.stringify(state)) as BrowserState;
    run([{ type: "newTab" }, { type: "back" }, { type: "toggleBookmark", url: LIBRARY }, { type: "clearHistory" }], state);
    expect(state).toEqual(copy);
  });
});
