// App navigation inside the laptop desktop. An app (for example Mail) asks the desktop to open
// another app through this context; the desktop updates its UI state. Nothing here reaches the game
// core: following a link only shows a window. Outside the desktop (the phone, the parked story's
// overlay) there is no provider, `useDesktopNav` returns null, and apps show links as plain text.
import { createContext, useContext, useEffect, useRef } from "react";
import type { BrowserTarget } from "./desktopState";

export interface DesktopNav {
  /** Opens the Browser on an address. The address is only shown in the in-game browser, never loaded from the Internet. */
  openBrowser: (target: BrowserTarget) => void;
  /** Brings an app of the laptop to the front (for example "Open in Mail"). Only shows the window. */
  openApp: (id: string) => void;
  /**
   * An app that has a layer of its own to close (an open menu, a half-typed address) registers a
   * handler here. Escape calls it before the desktop goes back: it returns true when it used the key.
   */
  setEscapeHandler: (handler: (() => boolean) | null) => void;
}

const DesktopNavContext = createContext<DesktopNav | null>(null);

export const DesktopNavProvider = DesktopNavContext.Provider;

export function useDesktopNav(): DesktopNav | null {
  return useContext(DesktopNavContext);
}

/** Registers `handler` for Escape while the calling component is mounted. */
export function useDesktopEscape(handler: () => boolean): void {
  const nav = useDesktopNav();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!nav) return undefined;
    nav.setEscapeHandler(() => ref.current());
    return () => nav.setEscapeHandler(null);
  }, [nav]);
}
