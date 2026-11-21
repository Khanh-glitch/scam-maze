// The pages the in-game browser can show: the New Tab page, History, error pages, the plain text pages
// of the virtual sites, and the story's payment-link page. Light surface, neutral gray and white.
// Pages carry no verdict: nothing here says an address or a page is safe or unsafe.
import React from "react";
import { Bookmark, Clock, Globe, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Tx } from "../../../device/deviceFormat";
import { resolveRoute, type Route, type VirtualPage } from "./sites";

export const INK = "#1f2530";
export const MUTED = "#5d6673";
export const LINE = "#d5d9df";
export const ACCENT = "#2a7f86";
export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a7f86]";
const BUTTON_PRIMARY = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#374151] px-4 py-2 text-sm font-semibold text-white motion-safe:transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:bg-[#cfd4db] disabled:text-[#6b7280] ${FOCUS}`;
const BUTTON_QUIET = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#c9ced6] bg-white px-4 py-2 text-sm font-medium text-[#1f2530] motion-safe:transition-colors hover:bg-[#f1f3f5] ${FOCUS}`;

/** The title of the page an address leads to, in the player's language. Used by tabs, bookmarks and history. */
export function pageTitle(t: Tx, url: string): string {
  const route = resolveRoute(url);
  if (route.type === "internal") return route.id === "newtab" ? t("laptop.browser.newTab") : t("laptop.browser.history");
  if (route.type === "page") {
    const { page } = route;
    if (page.kind === "portal") return page.section === "dashboard" || !page.section ? t("ueh.portal.title") : t(`ueh.portal.nav.${page.section}`);
    if (page.kind === "clearance") return t("ueh.clearance.siteTitle");
    return t(`laptop.browser.sites.${page.id}.title`);
  }
  return route.reason === "invalid" ? t("laptop.browser.error.invalidTitle") : t("laptop.browser.error.unreachableTitle");
}

export const Notice: React.FC<{ icon?: "globe" | "alert"; title: string; body: string; testId: string; children?: React.ReactNode }> = ({
  icon = "globe",
  title,
  body,
  testId,
  children,
}) => {
  const Icon = icon === "alert" ? TriangleAlert : Globe;
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center" data-testid={testId} role={icon === "alert" ? "alert" : undefined}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "#eceef1", color: "#4b5563" }}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold" style={{ color: INK }}>
        {title}
      </h2>
      <p className="max-w-sm break-words text-sm" style={{ color: MUTED }}>
        {body}
      </p>
      {children}
    </div>
  );
};

const AddressRow: React.FC<{ url: string; title: string; onOpen: (url: string) => void; testId: string }> = ({ url, title, onOpen, testId }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={() => onOpen(url)}
    className={`flex w-full cursor-pointer flex-col rounded-lg border border-transparent px-3 py-2 text-left motion-safe:transition-colors hover:border-[#d5d9df] hover:bg-[#f4f5f7] ${FOCUS}`}
  >
    <span className="truncate text-sm font-medium" style={{ color: INK }}>
      {title}
    </span>
    <span className="truncate text-xs" style={{ color: MUTED }}>
      {url}
    </span>
  </button>
);

export interface NewTabPageProps {
  bookmarks: readonly string[];
  history: readonly string[];
  onOpen: (url: string) => void;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({ bookmarks, history, onOpen }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  return (
    <div className="mx-auto max-w-xl px-6 py-8" data-testid="browser-newtab">
      <h2 className="text-xl font-bold" style={{ color: INK }}>
        {t("laptop.browser.newTabPage.heading")}
      </h2>
      <section className="mt-5" aria-label={t("laptop.browser.newTabPage.bookmarks")}>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          {t("laptop.browser.newTabPage.bookmarks")}
        </h3>
        {bookmarks.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: MUTED }} data-testid="newtab-bookmarks-empty">
            {t("laptop.browser.noBookmarks")}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {bookmarks.map((url) => (
              <li key={url}>
                <AddressRow url={url} title={pageTitle(t, url)} onOpen={onOpen} testId={`newtab-bookmark-${url}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6" aria-label={t("laptop.browser.newTabPage.recent")}>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {t("laptop.browser.newTabPage.recent")}
        </h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: MUTED }} data-testid="newtab-recent-empty">
            {t("laptop.browser.newTabPage.none")}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {history.slice(0, 5).map((url) => (
              <li key={url}>
                <AddressRow url={url} title={pageTitle(t, url)} onOpen={onOpen} testId={`newtab-recent-${url}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export interface HistoryPageProps {
  history: readonly string[];
  onOpen: (url: string) => void;
  onClear: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ history, onOpen, onClear }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  return (
    <div className="mx-auto max-w-xl px-6 py-8" data-testid="browser-history">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ color: INK }}>
          {t("laptop.browser.historyPage.heading")}
        </h2>
        <button type="button" className={BUTTON_QUIET} disabled={history.length === 0} onClick={onClear} data-testid="history-clear">
          {t("laptop.browser.historyPage.clear")}
        </button>
      </div>
      {history.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: MUTED }} data-testid="history-empty">
          {t("laptop.browser.historyPage.empty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-1">
          {history.map((url, index) => (
            <li key={`${url}-${index}`}>
              <AddressRow url={url} title={pageTitle(t, url)} onOpen={onOpen} testId={`history-entry-${index}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ErrorPage: React.FC<{ route: Extract<Route, { type: "error" }>; onRetry: () => void; onHome: () => void }> = ({ route, onRetry, onHome }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const invalid = route.reason === "invalid";
  return (
    <Notice
      testId="browser-error"
      icon="alert"
      title={invalid ? t("laptop.browser.error.invalidTitle") : t("laptop.browser.error.unreachableTitle")}
      body={invalid ? t("laptop.browser.error.invalidBody") : t("laptop.browser.error.unreachableBody", { url: route.url })}
    >
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={BUTTON_PRIMARY} onClick={onRetry} data-testid="error-retry">
          {t("laptop.browser.error.retry")}
        </button>
        <button type="button" className={BUTTON_QUIET} onClick={onHome} data-testid="error-home">
          {t("laptop.browser.error.goHome")}
        </button>
      </div>
    </Notice>
  );
};

export const StaticSitePage: React.FC<{ page: VirtualPage }> = ({ page }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const lines = ["p1", "p2", "p3"].map((key) => t(`laptop.browser.sites.${page.id}.${key}`, { defaultValue: "" })).filter((line) => line !== "");
  return (
    <article className="mx-auto max-w-xl px-6 py-8" data-testid={`browser-site-${page.id}`} aria-label={t("laptop.browser.pageLabel")}>
      <p className="text-xs" style={{ color: MUTED }}>
        {t(`laptop.browser.sites.${page.id}.title`)}
      </p>
      <h2 className="mt-1 break-words text-2xl font-bold" style={{ color: INK }}>
        {t(`laptop.browser.sites.${page.id}.heading`)}
      </h2>
      {lines.map((line) => (
        <p key={line} className="mt-3 break-words text-sm leading-relaxed" style={{ color: INK }}>
          {line}
        </p>
      ))}
    </article>
  );
};
