// The in-game web browser of the laptop: tabs, an address bar, back, forward, reload and home,
// bookmarks, history, a loading bar and error pages. It shows only the virtual sites of the game
// (`sites.ts`); no address is ever fetched, no iframe is used, and no real domain is contacted.
//
// All of its state is UI state (`browserState`, kept by the desktop): which tabs are open, where
// each tab is, the bookmarks and the history. Opening a tab or following a link changes nothing in
// the story. The only story actions on a page are the ones the game's own page item offers
// (`FeePage`), each a separate step the player takes. The browser has no "do everything" button and
// no verdict about any address or page.
//
// Keys: Alt+T new tab, Alt+W close tab, Alt+L the address bar, Alt+Left and Alt+Right back and
// forward, F5 reload, Left and Right between tabs, Escape closes a menu or leaves the address bar.
// Ctrl is not used: the room reads it as "use the mouse".
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Clock, Copy, Home, Loader2, Plus, RotateCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceView } from "../../../../../game/narrative/device";
import { actionLabel, type Tx } from "../../../device/deviceFormat";
import { useGameLocale } from "../../../../../i18n/useGameLocale";
import { useDesktopEscape } from "../desktopNav";
import {
  activeTab,
  canGoBack,
  canGoForward,
  currentUrl,
  type BrowserAction,
  type BrowserState,
  type BrowserTab,
} from "./browserState";
import { BrowserPage, DEFAULT_LOAD_MS, addressSaveAction, useBrowserLoading } from "./BrowserContent";
import { FOCUS, INK, LINE, MUTED, pageTitle, ACCENT } from "./BrowserPages";
import type { PortalFacts } from "./ueh/PortalSite";
import { isKnownPage } from "./sites";
import { HISTORY_URL, NEW_TAB_URL, displayAddress } from "./urls";

export interface BrowserAppProps {
  state: BrowserState;
  dispatch: (action: BrowserAction) => void;
  view: DeviceView;
  /** What the portal shows about the story: access, draft and thesis tasks. Read from the game, never written. */
  facts: PortalFacts;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
  /** How long a page takes to load, in milliseconds. 0 shows the page at once. */
  loadMs?: number;
}


const TOOL_BUTTON = `flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#374151] motion-safe:transition-colors hover:bg-[#e3e6ea] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${FOCUS}`;


export const BrowserApp: React.FC<BrowserAppProps> = ({ state, dispatch, view, facts, onOpenItem, onUseItem, loadMs = DEFAULT_LOAD_MS }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const tab = activeTab(state);
  const url = currentUrl(tab);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useBrowserLoading(state, dispatch, loadMs);
  // --- Address bar --------------------------------------------------------------------------------
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shownAddress = draft ?? displayAddress(url);
  useEffect(() => setDraft(null), [tab.id, url]);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const navigate = useCallback((address: string) => dispatch({ type: "navigate", url: address }), [dispatch]);
  const submitAddress = () => {
    const text = (draft ?? "").trim();
    inputRef.current?.blur();
    setDraft(null);
    if (text !== "") navigate(text);
  };
  const copyAddress = () => {
    const text = displayAddress(url);
    if (text === "") return;
    try {
      void navigator.clipboard?.writeText(text).then(
        () => setCopied(true),
        () => undefined,
      );
    } catch {
      /* no clipboard: the address can still be selected in the bar */
    }
  };

  // --- Menus --------------------------------------------------------------------------------------
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-browser-menu]")) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // Escape closes the menu, then leaves the address bar, and only then goes back to the desktop.
  useDesktopEscape(() => {
    if (menuOpen) {
      setMenuOpen(false);
      return true;
    }
    if (draft !== null) {
      setDraft(null);
      inputRef.current?.blur();
      return true;
    }
    return false;
  });

  // The page of the story's payment link offers to save its address as evidence: by choice, never by looking.
  const saving = addressSaveAction(view, url);
  const addressItem = saving?.addressItem ?? null;
  const saveAddress = saving?.saveAddress ?? null;
  const bookmarked = state.bookmarks.includes(url);
  const canBookmark = isKnownPage(url);
  const openHistory = () => {
    setMenuOpen(false);
    dispatch({ type: "openLink", url: HISTORY_URL });
  };

  // --- Scroll: kept per tab, and the wheel never reaches the room ------------------------------------
  // The scroll position of each tab is noted as the page scrolls and handed to the state a moment
  // later, when the tab changes and when the browser closes: no state change per scroll frame.
  const scrollTimer = useRef<number | null>(null);
  const pendingScroll = useRef<Record<string, number>>({});
  const flushScroll = useCallback(() => {
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = null;
    for (const [tabId, top] of Object.entries(pendingScroll.current)) dispatch({ type: "scroll", tabId, top });
    pendingScroll.current = {};
  }, [dispatch]);
  useLayoutEffect(() => {
    if (viewportRef.current && tab.status === "ready") viewportRef.current.scrollTop = tab.scrollTop;
    // Restore when the tab or the page changes, not on every scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, tab.status, tab.loadKey]);
  useEffect(() => {
    flushScroll();
  }, [tab.id, flushScroll]);
  useEffect(() => flushScroll, [flushScroll]);
  const onViewportScroll = (event: React.UIEvent<HTMLDivElement>) => {
    pendingScroll.current[tab.id] = event.currentTarget.scrollTop;
    if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(flushScroll, 160);
  };

  // --- Keys ---------------------------------------------------------------------------------------
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "F5") {
      event.preventDefault();
      dispatch({ type: "reload" });
      return;
    }
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "t") dispatch({ type: "newTab" });
    else if (key === "w") dispatch({ type: "closeTab", id: tab.id });
    else if (key === "l") inputRef.current?.focus();
    else if (event.key === "ArrowLeft") dispatch({ type: "back" });
    else if (event.key === "ArrowRight") dispatch({ type: "forward" });
    else return;
    event.preventDefault();
  };

  const onTabsKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
    const index = state.tabs.findIndex((entry) => entry.id === tab.id);
    const count = state.tabs.length;
    const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : (index + (event.key === "ArrowRight" ? 1 : count - 1)) % count;
    event.preventDefault();
    dispatch({ type: "selectTab", id: state.tabs[next].id });
    window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>(`[data-testid="browser-tab-${state.tabs[next].id}"]`)?.focus(), 0);
  };

  const content = <BrowserPage state={state} tab={tab} dispatch={dispatch} view={view} facts={facts} navigate={navigate} onOpenItem={onOpenItem} onUseItem={onUseItem} />;
  const tabLabel = (entry: BrowserTab) => (entry.status === "loading" ? t("laptop.browser.loading") : pageTitle(t, currentUrl(entry)));

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col" data-testid="browser-app" style={{ background: "#ffffff", color: INK }} onKeyDown={onKeyDown}>
      {/* Tab strip */}
      <div className="flex shrink-0 items-end gap-1 px-2 pt-1.5" style={{ background: "#d9dde3" }}>
        <div role="tablist" aria-label={t("laptop.browser.tabsLabel")} className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto" onKeyDown={onTabsKeyDown}>
          {state.tabs.map((entry) => {
            const selected = entry.id === tab.id;
            const label = tabLabel(entry);
            return (
              <div
                key={entry.id}
                className="group relative flex h-8 min-w-[6rem] max-w-[11rem] flex-1 items-center rounded-t-lg"
                style={{ background: selected ? "#ffffff" : "#c9ced6", boxShadow: selected ? `inset 0 2px 0 ${ACCENT}` : undefined }}
              >
                <button
                  type="button"
                  role="tab"
                  id={`browser-tab-${entry.id}`}
                  data-testid={`browser-tab-${entry.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  title={`${label}\n${displayAddress(currentUrl(entry))}`}
                  onClick={() => dispatch({ type: "selectTab", id: entry.id })}
                  className={`flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-t-lg pl-2.5 pr-1 text-left text-xs ${selected ? "font-semibold" : "font-medium"} ${FOCUS}`}
                  style={{ color: selected ? INK : "#3b4350" }}
                >
                  {entry.status === "loading" && <Loader2 className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}
                  <span className="truncate">{label}</span>
                </button>
                <button
                  type="button"
                  data-testid={`browser-tab-close-${entry.id}`}
                  aria-label={t("laptop.browser.closeTab", { title: label })}
                  title={t("laptop.browser.closeTab", { title: label })}
                  onClick={() => dispatch({ type: "closeTab", id: entry.id })}
                  className={`mr-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded motion-safe:transition-colors hover:bg-black/10 ${FOCUS}`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          data-testid="browser-new-tab"
          aria-label={t("laptop.browser.newTabButton")}
          title={t("laptop.browser.newTabButton")}
          onClick={() => dispatch({ type: "newTab" })}
          className={`mb-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#374151] motion-safe:transition-colors hover:bg-black/10 ${FOCUS}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="relative flex shrink-0 items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: LINE, background: "#f3f4f6" }}>
        <button type="button" className={TOOL_BUTTON} data-testid="browser-back" disabled={!canGoBack(tab)} aria-label={t("laptop.browser.back")} title={t("laptop.browser.back")} onClick={() => dispatch({ type: "back" })}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={TOOL_BUTTON} data-testid="browser-forward" disabled={!canGoForward(tab)} aria-label={t("laptop.browser.forward")} title={t("laptop.browser.forward")} onClick={() => dispatch({ type: "forward" })}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={TOOL_BUTTON} data-testid="browser-reload" aria-label={t("laptop.browser.reload")} title={t("laptop.browser.reload")} onClick={() => dispatch({ type: "reload" })}>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={TOOL_BUTTON} data-testid="browser-home" disabled={url === NEW_TAB_URL} aria-label={t("laptop.browser.home")} title={t("laptop.browser.home")} onClick={() => dispatch({ type: "home" })}>
          <Home className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 items-center rounded-full border bg-white pl-4 pr-1 focus-within:border-[#2a7f86] focus-within:shadow-[0_0_0_2px_rgba(42,127,134,0.25)]" style={{ borderColor: "#c9ced6" }}>
          <input
            ref={inputRef}
            type="text"
            value={shownAddress}
            data-testid="browser-address"
            aria-label={t("laptop.browser.address")}
            placeholder={t("laptop.browser.addressPlaceholder")}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            onFocus={(event) => {
              setDraft(displayAddress(url));
              event.currentTarget.select();
            }}
            onBlur={() => setDraft(null)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitAddress();
              }
            }}
            className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[#8a929e]"
            style={{ color: INK }}
          />
          <button
            type="button"
            className={TOOL_BUTTON}
            data-testid="browser-copy"
            disabled={displayAddress(url) === ""}
            aria-label={copied ? t("laptop.browser.copied") : t("laptop.browser.copyAddress")}
            title={t("laptop.browser.copyAddress")}
            onClick={copyAddress}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={TOOL_BUTTON}
            data-testid="browser-star"
            disabled={!canBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? t("laptop.browser.removeBookmark") : t("laptop.browser.bookmarkThis")}
            title={bookmarked ? t("laptop.browser.removeBookmark") : t("laptop.browser.bookmarkThis")}
            onClick={() => dispatch({ type: "toggleBookmark", url })}
          >
            {bookmarked ? <BookmarkCheck className="h-4 w-4" style={{ color: ACCENT }} aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <span className="sr-only" role="status" data-testid="browser-copy-status">
          {copied ? t("laptop.browser.copied") : ""}
        </span>
        <div className="relative" data-browser-menu>
          <button
            type="button"
            className={TOOL_BUTTON}
            data-testid="browser-bookmarks"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("laptop.browser.bookmarks")}
            title={t("laptop.browser.bookmarks")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label={t("laptop.browser.bookmarks")}
              data-testid="browser-bookmarks-menu"
              className="absolute right-0 top-9 z-10 max-h-64 w-64 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg"
              style={{ borderColor: "#c9ced6" }}
            >
              <button
                type="button"
                role="menuitem"
                disabled={!canBookmark}
                data-testid="menu-toggle-bookmark"
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#f1f3f5] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
                onClick={() => dispatch({ type: "toggleBookmark", url })}
              >
                {bookmarked ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
                {bookmarked ? t("laptop.browser.removeBookmark") : t("laptop.browser.bookmarkThis")}
              </button>
              <hr style={{ borderColor: LINE }} />
              {state.bookmarks.length === 0 ? (
                <p className="px-3 py-2 text-sm" style={{ color: MUTED }}>
                  {t("laptop.browser.noBookmarks")}
                </p>
              ) : (
                state.bookmarks.map((address) => (
                  <button
                    key={address}
                    type="button"
                    role="menuitem"
                    data-testid={`menu-bookmark-${address}`}
                    className={`flex w-full cursor-pointer flex-col px-3 py-2 text-left hover:bg-[#f1f3f5] ${FOCUS}`}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(address);
                    }}
                  >
                    <span className="truncate text-sm font-medium">{pageTitle(t, address)}</span>
                    <span className="truncate text-xs" style={{ color: MUTED }}>
                      {address}
                    </span>
                  </button>
                ))
              )}
              {addressItem !== null && saveAddress !== null && (
                <>
                  <hr style={{ borderColor: LINE }} />
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="menu-save-address"
                    disabled={!saveAddress.available}
                    className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#f1f3f5] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onUseItem(addressItem.id, saveAddress.id);
                    }}
                  >
                    {saveAddress.blocked === "done" ? t("laptop.browser.addressSaved") : actionLabel(t, locale, saveAddress)}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <button type="button" className={TOOL_BUTTON} data-testid="browser-history-button" aria-label={t("laptop.browser.history")} title={t("laptop.browser.history")} onClick={openHistory}>
          <Clock className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Loading bar */}
      <div className="h-0.5 shrink-0" style={{ background: tab.status === "loading" ? "#dfe9ea" : "transparent" }}>
        {tab.status === "loading" && (
          <div
            role="progressbar"
            aria-label={t("laptop.browser.loading")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(tab.progress * 100)}
            data-testid="browser-progress"
            className="h-full origin-left motion-safe:transition-transform"
            style={{ background: ACCENT, transform: `scaleX(${Math.max(0.05, tab.progress)})` }}
          />
        )}
      </div>

      {/* Page viewport: scrolls on its own and keeps the wheel to itself. */}
      <div
        ref={viewportRef}
        data-testid="browser-viewport"
        role="region"
        aria-label={t("laptop.browser.pageLabel")}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={onViewportScroll}
        onWheel={(event) => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
};
