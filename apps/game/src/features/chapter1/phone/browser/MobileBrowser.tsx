// The phone's web browser: an address bar on top, the page in the middle and a bar of large buttons
// at the bottom (back, forward, home, bookmarks, history). Tabs and bookmarks open as a list over the
// page. It uses the same virtual websites, router, loading behavior and browser state as the laptop
// browser (`BrowserContent`, `browserState`, `sites`); only the window around the page is made for a
// narrow touch screen. It shows only the game's own pages: no address is fetched and no real site is
// contacted. All of its state is UI state; the only story actions are the ones a page offers, each a
// step the player takes on the page itself.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Clock, Globe, Home, Layers, Loader2, Plus, RotateCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceView } from "../../../../game/narrative/device";
import { useGameLocale } from "../../../../i18n/useGameLocale";
import { actionLabel, type Tx } from "../../device/deviceFormat";
import { BrowserPage, DEFAULT_LOAD_MS, addressSaveAction, useBrowserLoading } from "../../room/desktop/browser/BrowserContent";
import { INK, LINE, MUTED, pageTitle } from "../../room/desktop/browser/BrowserPages";
import { activeTab, canGoBack, canGoForward, currentUrl, type BrowserAction, type BrowserState } from "../../room/desktop/browser/browserState";
import { isKnownPage } from "../../room/desktop/browser/sites";
import type { PortalFacts } from "../../room/desktop/browser/ueh/PortalSite";
import { HISTORY_URL, NEW_TAB_URL, displayAddress } from "../../room/desktop/browser/urls";

export interface MobileBrowserProps {
  state: BrowserState;
  dispatch: (action: BrowserAction) => void;
  view: DeviceView;
  facts: PortalFacts;
  onOpenItem: (itemId: string) => void;
  onUseItem: (itemId: string, actionId: string) => void;
  /** How long a page takes to load, in milliseconds. 0 shows the page at once. */
  loadMs?: number;
}

const TEAL = "#2a7f86";
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7f86]";
const BAR_BUTTON = `flex h-11 min-w-11 flex-1 cursor-pointer items-center justify-center rounded-lg text-[#374151] motion-safe:transition-colors hover:bg-[#e3e6ea] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${FOCUS}`;
const SHEET_BUTTON = `flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left motion-safe:transition-colors hover:bg-[#f1f3f5] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

type Sheet = "tabs" | "bookmarks" | null;

export const MobileBrowser: React.FC<MobileBrowserProps> = ({ state, dispatch, view, facts, onOpenItem, onUseItem, loadMs = DEFAULT_LOAD_MS }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const tab = activeTab(state);
  const url = currentUrl(tab);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState<string | null>(null);
  useBrowserLoading(state, dispatch, loadMs);

  const shownAddress = draft ?? displayAddress(url);
  useEffect(() => setDraft(null), [tab.id, url]);
  const navigate = useCallback((address: string) => dispatch({ type: "navigate", url: address }), [dispatch]);
  const submitAddress = () => {
    const text = (draft ?? "").trim();
    inputRef.current?.blur();
    setDraft(null);
    if (text !== "") navigate(text);
  };

  // The scroll position of each tab is noted as the page scrolls and handed to the state a moment later.
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

  const bookmarked = state.bookmarks.includes(url);
  const canBookmark = isKnownPage(url);
  const saving = addressSaveAction(view, url);
  const tabLabel = (id: string) => {
    const entry = state.tabs.find((candidate) => candidate.id === id);
    if (entry === undefined) return "";
    return entry.status === "loading" ? t("laptop.browser.loading") : pageTitle(t, currentUrl(entry));
  };
  const closeSheet = () => setSheet(null);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-testid="browser-app" data-touch style={{ background: "#ffffff", color: INK }}>
      {/* Address bar */}
      <div className="flex shrink-0 items-center gap-1.5 border-b px-2 py-2" style={{ borderColor: LINE, background: "#e9ecf0" }}>
        <div className="flex min-w-0 flex-1 items-center rounded-full border bg-white pl-3 focus-within:border-[#2a7f86] focus-within:shadow-[0_0_0_2px_rgba(42,127,134,0.25)]" style={{ borderColor: "#c9ced6" }}>
          <Globe className="h-4 w-4 shrink-0" style={{ color: MUTED }} aria-hidden="true" />
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
            enterKeyHint="go"
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
            className="min-h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[#8a929e]"
            style={{ color: INK }}
          />
          <button type="button" className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-[#eef0f3] ${FOCUS}`} data-testid="browser-reload" aria-label={t("laptop.browser.reload")} title={t("laptop.browser.reload")} onClick={() => dispatch({ type: "reload" })}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-[#eef0f3] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
            data-testid="browser-star"
            disabled={!canBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? t("laptop.browser.removeBookmark") : t("laptop.browser.bookmarkThis")}
            title={bookmarked ? t("laptop.browser.removeBookmark") : t("laptop.browser.bookmarkThis")}
            onClick={() => dispatch({ type: "toggleBookmark", url })}
          >
            {bookmarked ? <BookmarkCheck className="h-4 w-4" style={{ color: TEAL }} aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <button
          type="button"
          className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-white hover:bg-[#f1f3f5] ${FOCUS}`}
          style={{ borderColor: "#c9ced6", color: INK }}
          data-testid="browser-tabs-button"
          aria-label={t("phone.mobileBrowser.tabsButton", { count: state.tabs.length })}
          title={t("phone.mobileBrowser.tabsTitle")}
          onClick={() => setSheet("tabs")}
        >
          <Layers className="h-5 w-5" aria-hidden="true" />
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold text-white" style={{ background: TEAL }}>
            {state.tabs.length}
          </span>
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
            style={{ background: TEAL, transform: `scaleX(${Math.max(0.05, tab.progress)})` }}
          />
        )}
      </div>
      {/* The page scrolls on its own. */}
      <div
        ref={viewportRef}
        data-testid="browser-viewport"
        role="region"
        aria-label={t("laptop.browser.pageLabel")}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(event) => {
          pendingScroll.current[tab.id] = event.currentTarget.scrollTop;
          if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
          scrollTimer.current = window.setTimeout(flushScroll, 160);
        }}
        onWheel={(event) => event.stopPropagation()}
      >
        <BrowserPage state={state} tab={tab} dispatch={dispatch} view={view} facts={facts} navigate={navigate} onOpenItem={onOpenItem} onUseItem={onUseItem} />
      </div>
      {/* Bottom bar */}
      <nav className="flex shrink-0 items-center gap-0.5 border-t px-1 py-1" style={{ borderColor: LINE, background: "#f3f4f6" }} aria-label={t("laptop.browser.tabsLabel")}>
        <button type="button" className={BAR_BUTTON} data-testid="browser-back" disabled={!canGoBack(tab)} aria-label={t("laptop.browser.back")} title={t("laptop.browser.back")} onClick={() => dispatch({ type: "back" })}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" className={BAR_BUTTON} data-testid="browser-forward" disabled={!canGoForward(tab)} aria-label={t("laptop.browser.forward")} title={t("laptop.browser.forward")} onClick={() => dispatch({ type: "forward" })}>
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" className={BAR_BUTTON} data-testid="browser-home" disabled={url === NEW_TAB_URL} aria-label={t("laptop.browser.home")} title={t("laptop.browser.home")} onClick={() => dispatch({ type: "home" })}>
          <Home className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" className={BAR_BUTTON} data-testid="browser-bookmarks" aria-haspopup="dialog" aria-label={t("laptop.browser.bookmarks")} title={t("laptop.browser.bookmarks")} onClick={() => setSheet("bookmarks")}>
          <Bookmark className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" className={BAR_BUTTON} data-testid="browser-history-button" aria-label={t("laptop.browser.history")} title={t("laptop.browser.history")} onClick={() => dispatch({ type: "openLink", url: HISTORY_URL })}>
          <Clock className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>
      {/* Lists over the page */}
      {sheet !== null && (
        <div
          role="dialog"
          aria-label={sheet === "tabs" ? t("phone.mobileBrowser.tabsTitle") : t("laptop.browser.bookmarks")}
          data-testid={`browser-sheet-${sheet}`}
          className="absolute inset-0 z-10 flex flex-col motion-safe:animate-[phoneAppIn_160ms_ease-out_both]"
          style={{ background: "#ffffff" }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: LINE, background: "#f3f4f6" }}>
            <h3 className="text-base font-bold" style={{ color: INK }}>
              {sheet === "tabs" ? t("phone.mobileBrowser.tabsTitle") : t("laptop.browser.bookmarks")}
            </h3>
            <button type="button" className={`flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold hover:bg-[#e3e6ea] ${FOCUS}`} data-testid="browser-sheet-close" onClick={closeSheet}>
              <X className="h-4 w-4" aria-hidden="true" />
              {t("phone.mobileBrowser.closeSheet")}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" onWheel={(event) => event.stopPropagation()}>
            {sheet === "tabs" ? (
              <ul className="space-y-1">
                {state.tabs.map((entry) => {
                  const selected = entry.id === tab.id;
                  return (
                    <li key={entry.id} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        data-testid={`browser-tab-${entry.id}`}
                        aria-current={selected}
                        className={`${SHEET_BUTTON} min-w-0 flex-1 flex-col !items-start !gap-0 border ${selected ? "bg-[#e8f3f4]" : ""}`}
                        style={{ borderColor: selected ? TEAL : LINE }}
                        onClick={() => {
                          dispatch({ type: "selectTab", id: entry.id });
                          closeSheet();
                        }}
                      >
                        <span className="flex w-full items-center gap-1.5 text-sm font-semibold" style={{ color: INK }}>
                          {entry.status === "loading" && <Loader2 className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}
                          <span className="line-clamp-1 break-words">{tabLabel(entry.id)}</span>
                        </span>
                        <span className="line-clamp-1 w-full break-all text-xs" style={{ color: MUTED }}>
                          {displayAddress(currentUrl(entry))}
                        </span>
                      </button>
                      <button
                        type="button"
                        data-testid={`browser-tab-close-${entry.id}`}
                        aria-label={t("laptop.browser.closeTab", { title: tabLabel(entry.id) })}
                        title={t("laptop.browser.closeTab", { title: tabLabel(entry.id) })}
                        className={`flex w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border hover:bg-[#f1f3f5] ${FOCUS}`}
                        style={{ borderColor: LINE }}
                        onClick={() => dispatch({ type: "closeTab", id: entry.id })}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    data-testid="browser-new-tab"
                    className={`${SHEET_BUTTON} font-semibold`}
                    style={{ color: TEAL }}
                    onClick={() => {
                      dispatch({ type: "newTab" });
                      closeSheet();
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t("laptop.browser.newTabButton")}
                  </button>
                </li>
              </ul>
            ) : (
              <div data-testid="browser-bookmarks-menu">
                <button type="button" disabled={!canBookmark} data-testid="menu-toggle-bookmark" className={`${SHEET_BUTTON} text-sm font-semibold`} onClick={() => dispatch({ type: "toggleBookmark", url })}>
                  {bookmarked ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
                  {bookmarked ? t("laptop.browser.removeBookmark") : t("laptop.browser.bookmarkThis")}
                </button>
                <hr style={{ borderColor: LINE }} />
                {state.bookmarks.length === 0 ? (
                  <p className="px-3 py-3 text-sm" style={{ color: MUTED }}>
                    {t("laptop.browser.noBookmarks")}
                  </p>
                ) : (
                  state.bookmarks.map((address) => (
                    <button
                      key={address}
                      type="button"
                      data-testid={`menu-bookmark-${address}`}
                      className={`${SHEET_BUTTON} flex-col !items-start !gap-0`}
                      onClick={() => {
                        closeSheet();
                        navigate(address);
                      }}
                    >
                      <span className="line-clamp-1 break-words text-sm font-medium" style={{ color: INK }}>
                        {pageTitle(t, address)}
                      </span>
                      <span className="line-clamp-1 break-all text-xs" style={{ color: MUTED }}>
                        {address}
                      </span>
                    </button>
                  ))
                )}
                {saving !== null && (
                  <>
                    <hr style={{ borderColor: LINE }} />
                    <button
                      type="button"
                      data-testid="menu-save-address"
                      disabled={!saving.saveAddress.available}
                      className={`${SHEET_BUTTON} text-sm`}
                      onClick={() => {
                        closeSheet();
                        onUseItem(saving.addressItem.id, saving.saveAddress.id);
                      }}
                    >
                      {saving.saveAddress.blocked === "done" ? t("laptop.browser.addressSaved") : actionLabel(t, locale, saving.saveAddress)}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
