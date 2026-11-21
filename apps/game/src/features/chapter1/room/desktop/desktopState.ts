// UI state of the laptop's interactive desktop. Pure: no React, no game state, no i18n.
// It only knows which apps are open, which window is on screen and what the browser shows. Opening,
// closing or minimizing a window never touches the story: the game core only hears about what the
// player does INSIDE an app (reading a mail, paying, verifying), never about the desktop itself.
import { browserReducer, createBrowserState, isBrowserState, type BrowserAction, type BrowserState } from "./browser/browserState";

export interface DesktopWindow {
  /** The app id, the same as the laptop tab id. One window per app. */
  id: string;
  /** Sent to the taskbar with the minimize button. The app keeps running. */
  minimized: boolean;
}

/** A link in another app. UI navigation only: following it changes no game state. */
export interface BrowserTarget {
  /** The address to show. Plain text, never fetched or followed. */
  url: string;
}

export interface DesktopState {
  /** Open apps in the order they were launched. */
  windows: readonly DesktopWindow[];
  /** The window on screen, or null for the desktop home screen. */
  activeId: string | null;
  /** Tabs, bookmarks and history of the browser. They outlive the Browser window's own tabs being closed. */
  browser: BrowserState;
}

export type DesktopAction =
  /** Launches an app, or brings its window back. */
  | { type: "open"; id: string }
  /** Opens the Browser window on an address (a link in another app). */
  | { type: "navigate"; target: BrowserTarget }
  /** A change inside the Browser: new tab, navigation, bookmark. */
  | { type: "browser"; action: BrowserAction }
  /** Quits the app: its window and its taskbar entry go away. */
  | { type: "close"; id: string }
  /** Hides the window and shows the desktop. The app stays in the taskbar. */
  | { type: "minimize"; id: string }
  /** Leaves the window for the desktop without minimizing it ("Back"). */
  | { type: "home" }
  /** Drops windows of apps that are no longer on the laptop. */
  | { type: "sync"; validIds: readonly string[] };

export const BROWSER_APP_ID = "browser";

export function createDesktopState(): DesktopState {
  return { windows: [], activeId: null, browser: createBrowserState() };
}

export const INITIAL_DESKTOP_STATE: DesktopState = Object.freeze(createDesktopState());

export function isDesktopState(value: unknown): value is DesktopState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { windows?: unknown; activeId?: unknown; browser?: unknown };
  return (
    Array.isArray(candidate.windows) &&
    candidate.windows.every(
      (entry) => typeof entry === "object" && entry !== null && typeof (entry as DesktopWindow).id === "string" && typeof (entry as DesktopWindow).minimized === "boolean",
    ) &&
    (candidate.activeId === null || typeof candidate.activeId === "string") &&
    isBrowserState(candidate.browser)
  );
}

export function isRunning(state: DesktopState, id: string): boolean {
  return state.windows.some((window) => window.id === id);
}

export function desktopReducer(state: DesktopState, action: DesktopAction): DesktopState {
  switch (action.type) {
    case "open": {
      const known = isRunning(state, action.id);
      const windows = known
        ? state.windows.map((window) => (window.id === action.id ? { ...window, minimized: false } : window))
        : [...state.windows, { id: action.id, minimized: false }];
      return { ...state, windows, activeId: action.id };
    }
    case "navigate": {
      const opened = desktopReducer(state, { type: "open", id: BROWSER_APP_ID });
      return { ...opened, browser: browserReducer(opened.browser, { type: "openLink", url: action.target.url }) };
    }
    case "browser": {
      const browser = browserReducer(state.browser, action.action);
      return browser === state.browser ? state : { ...state, browser };
    }
    case "close": {
      if (!isRunning(state, action.id)) return state;
      // Quitting the browser closes its tabs; the bookmarks and the history stay, as in a real browser.
      const browser =
        action.id === BROWSER_APP_ID
          ? { ...createBrowserState(), bookmarks: state.browser.bookmarks, history: state.browser.history }
          : state.browser;
      return {
        ...state,
        windows: state.windows.filter((window) => window.id !== action.id),
        activeId: state.activeId === action.id ? null : state.activeId,
        browser,
      };
    }
    case "minimize": {
      if (!isRunning(state, action.id)) return state;
      return {
        ...state,
        windows: state.windows.map((window) => (window.id === action.id ? { ...window, minimized: true } : window)),
        activeId: state.activeId === action.id ? null : state.activeId,
      };
    }
    case "home":
      return state.activeId === null ? state : { ...state, activeId: null };
    case "sync": {
      const valid = new Set(action.validIds);
      const windows = state.windows.filter((window) => valid.has(window.id));
      const activeId = state.activeId !== null && valid.has(state.activeId) ? state.activeId : null;
      return windows.length === state.windows.length && activeId === state.activeId ? state : { ...state, windows, activeId };
    }
    default:
      return state;
  }
}

/**
 * What Escape does on the desktop. With a window on screen it goes back to the desktop and the key
 * is used up; on the desktop itself nothing is left to close, so the laptop closes (`consumed` false).
 */
export function desktopEscape(state: DesktopState): { state: DesktopState; consumed: boolean } {
  if (state.activeId === null) return { state, consumed: false };
  return { state: desktopReducer(state, { type: "home" }), consumed: true };
}

/** Taskbar status of an app, for the indicator and for screen readers. */
export type DesktopAppStatus = "active" | "open" | "minimized" | "closed";

export function appStatus(state: DesktopState, id: string): DesktopAppStatus {
  const window = state.windows.find((entry) => entry.id === id);
  if (!window) return "closed";
  if (state.activeId === id) return "active";
  return window.minimized ? "minimized" : "open";
}
