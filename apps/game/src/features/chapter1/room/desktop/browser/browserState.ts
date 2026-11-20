// UI state of the in-game browser: tabs, each with its own history and scroll position, the
// bookmarks and the history of visited pages. Pure: no React, no game state, no i18n, no network.
//
// This is navigation state only. Opening a tab or following a link changes what is on screen and
// nothing else: it never costs time or money and never records evidence or risk. What the player
// does ON a page (an action of the story) goes through the game core, not through this reducer.
import { canonicalPageUrl, defaultBookmarks, isKnownPage } from "./sites";
import { canonicalAddress, NEW_TAB_URL } from "./urls";

export type TabStatus = "loading" | "ready";

export interface BrowserTab {
  id: string;
  /** Pages this tab went through, oldest first. */
  entries: readonly string[];
  /** The entry on screen. */
  index: number;
  status: TabStatus;
  /** 0 to 1 while loading. */
  progress: number;
  /** Changes with every navigation, so a timer of an earlier navigation can tell it is stale. */
  loadKey: number;
  /** Scroll position of the page in this tab, kept while another tab or app is shown. */
  scrollTop: number;
  /**
   * What the player filled into the forms of the pages in this tab (field id to value). Form fields
   * are filled with the game's fictional data; this is UI state, and nothing is sent anywhere.
   */
  fields: Readonly<Record<string, string>>;
}

export interface BrowserState {
  tabs: readonly BrowserTab[];
  activeTabId: string;
  /** Addresses of known pages, in the order they were bookmarked. */
  bookmarks: readonly string[];
  /** Known pages that finished loading, newest first, one entry per consecutive visit. */
  history: readonly string[];
  /** Counter for tab ids and load keys. */
  counter: number;
}

export type BrowserAction =
  /** A link in another app: shows the address in a tab that already has it, else in an empty tab, else in a new tab. */
  | { type: "openLink"; url: string }
  | { type: "newTab"; url?: string }
  | { type: "closeTab"; id: string }
  | { type: "selectTab"; id: string }
  /** Goes to an address in a tab (the active one by default); typed text is made canonical here. */
  | { type: "navigate"; url: string; tabId?: string }
  | { type: "back" }
  | { type: "forward" }
  | { type: "reload" }
  | { type: "home" }
  | { type: "progress"; tabId: string; value: number }
  | { type: "loaded"; tabId: string }
  | { type: "scroll"; tabId: string; top: number }
  /** Fills form fields of a tab. Only UI state: submitting a form is a story action, taken on the page. */
  | { type: "setFields"; tabId: string; fields: Readonly<Record<string, string>> }
  | { type: "toggleBookmark"; url: string }
  | { type: "clearHistory" };

const MAX_HISTORY = 100;

function freshTab(counter: number, url: string): BrowserTab {
  return { id: `tab-${counter}`, entries: [url], index: 0, status: "loading", progress: 0, loadKey: counter, scrollTop: 0, fields: {} };
}

export function createBrowserState(): BrowserState {
  const tab: BrowserTab = { ...freshTab(1, NEW_TAB_URL), status: "ready", progress: 1 };
  return { tabs: [tab], activeTabId: tab.id, bookmarks: defaultBookmarks(), history: [], counter: 1 };
}

export const INITIAL_BROWSER_STATE: BrowserState = Object.freeze(createBrowserState());

export function currentUrl(tab: BrowserTab): string {
  return tab.entries[tab.index];
}

export function activeTab(state: BrowserState): BrowserTab {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];
}

function mapTab(state: BrowserState, id: string, change: (tab: BrowserTab) => BrowserTab): BrowserState {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    if (tab.id !== id) return tab;
    const next = change(tab);
    if (next !== tab) changed = true;
    return next;
  });
  return changed ? { ...state, tabs } : state;
}

/** Shows `url` in a tab: the pages after the current one are dropped, as in a real browser. */
function go(state: BrowserState, tabId: string, input: string): BrowserState {
  const url = canonicalPageUrl(canonicalAddress(input));
  const counter = state.counter + 1;
  return {
    ...mapTab(state, tabId, (tab) => {
      const entries = [...tab.entries.slice(0, tab.index + 1), url];
      return { ...tab, entries, index: entries.length - 1, status: "loading", progress: 0, loadKey: counter, scrollTop: 0 };
    }),
    counter,
  };
}

function startLoading(state: BrowserState, tabId: string): BrowserState {
  const counter = state.counter + 1;
  return { ...mapTab(state, tabId, (tab) => ({ ...tab, status: "loading", progress: 0, loadKey: counter })), counter };
}

function pushHistory(history: readonly string[], url: string): readonly string[] {
  if (history[0] === url) return history;
  return [url, ...history].slice(0, MAX_HISTORY);
}

export function browserReducer(state: BrowserState, action: BrowserAction): BrowserState {
  switch (action.type) {
    case "openLink": {
      const url = canonicalPageUrl(canonicalAddress(action.url));
      const showing = state.tabs.find((tab) => currentUrl(tab) === url);
      if (showing) return state.activeTabId === showing.id ? state : { ...state, activeTabId: showing.id };
      const active = activeTab(state);
      if (currentUrl(active) === NEW_TAB_URL) return go(state, active.id, url);
      return browserReducer(state, { type: "newTab", url });
    }
    case "newTab": {
      const counter = state.counter + 1;
      const url = action.url === undefined ? NEW_TAB_URL : canonicalPageUrl(canonicalAddress(action.url));
      const tab = url === NEW_TAB_URL ? { ...freshTab(counter, url), status: "ready" as const, progress: 1 } : freshTab(counter, url);
      return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.id, counter };
    }
    case "closeTab": {
      const index = state.tabs.findIndex((tab) => tab.id === action.id);
      if (index < 0) return state;
      if (state.tabs.length === 1) {
        // The last tab never disappears: a New Tab takes its place.
        const counter = state.counter + 1;
        const tab: BrowserTab = { ...freshTab(counter, NEW_TAB_URL), status: "ready", progress: 1 };
        return { ...state, tabs: [tab], activeTabId: tab.id, counter };
      }
      const tabs = state.tabs.filter((tab) => tab.id !== action.id);
      const activeTabId = state.activeTabId === action.id ? tabs[Math.min(index, tabs.length - 1)].id : state.activeTabId;
      return { ...state, tabs, activeTabId };
    }
    case "selectTab":
      return state.tabs.some((tab) => tab.id === action.id) && state.activeTabId !== action.id ? { ...state, activeTabId: action.id } : state;
    case "navigate":
      return go(state, action.tabId ?? state.activeTabId, action.url);
    case "back":
    case "forward": {
      const tab = activeTab(state);
      const target = tab.index + (action.type === "back" ? -1 : 1);
      if (target < 0 || target >= tab.entries.length) return state;
      const counter = state.counter + 1;
      return { ...mapTab(state, tab.id, (t) => ({ ...t, index: target, status: "loading", progress: 0, loadKey: counter, scrollTop: 0 })), counter };
    }
    case "reload":
      return startLoading(state, state.activeTabId);
    case "home":
      return go(state, state.activeTabId, NEW_TAB_URL);
    case "progress":
      return mapTab(state, action.tabId, (tab) =>
        tab.status === "loading" && action.value > tab.progress ? { ...tab, progress: Math.min(1, action.value) } : tab,
      );
    case "loaded": {
      const tab = state.tabs.find((entry) => entry.id === action.tabId);
      if (!tab || tab.status === "ready") return state;
      const url = currentUrl(tab);
      const next = mapTab(state, tab.id, (t) => ({ ...t, status: "ready", progress: 1 }));
      return isKnownPage(url) ? { ...next, history: pushHistory(next.history, url) } : next;
    }
    case "scroll":
      return mapTab(state, action.tabId, (tab) => (tab.scrollTop === action.top ? tab : { ...tab, scrollTop: Math.max(0, Math.round(action.top)) }));
    case "setFields":
      return mapTab(state, action.tabId, (tab) => {
        const entries = Object.entries(action.fields);
        return entries.every(([key, value]) => tab.fields[key] === value) ? tab : { ...tab, fields: { ...tab.fields, ...action.fields } };
      });
    case "toggleBookmark": {
      const url = canonicalPageUrl(canonicalAddress(action.url));
      if (!isKnownPage(url)) return state;
      return state.bookmarks.includes(url)
        ? { ...state, bookmarks: state.bookmarks.filter((entry) => entry !== url) }
        : { ...state, bookmarks: [...state.bookmarks, url] };
    }
    case "clearHistory":
      return state.history.length === 0 ? state : { ...state, history: [] };
    default:
      return state;
  }
}

export function canGoBack(tab: BrowserTab): boolean {
  return tab.index > 0;
}

export function canGoForward(tab: BrowserTab): boolean {
  return tab.index < tab.entries.length - 1;
}

export function isBrowserState(value: unknown): value is BrowserState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BrowserState>;
  return (
    Array.isArray(candidate.tabs) &&
    candidate.tabs.length > 0 &&
    typeof candidate.activeTabId === "string" &&
    Array.isArray(candidate.bookmarks) &&
    Array.isArray(candidate.history) &&
    typeof candidate.counter === "number"
  );
}
