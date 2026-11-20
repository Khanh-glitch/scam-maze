// Laptop overlay: a modal dialog styled as an OS app window. A vertical sidebar (ARIA tablist) lists
// the apps with an icon and a label; the main pane shows the selected app under a window title.
// The notification app is built in; the bank app, the compare view and Review Security (task 9.3)
// arrive through `extraTabs`.
// Escape and the close button call `onClose`; focus moves in on open and returns to the opener
// on unmount. No inputs, no forms, no links: addresses are plain text.
import React, { useEffect, useId, useRef, useState } from "react";
import { AppWindow, Bell, BellRing, CalendarDays, Columns2, FolderOpen, GraduationCap, Globe, Home, Landmark, Laptop, Mail, ShieldCheck, Briefcase, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LaptopView } from "../../../../game/narrative/selectors";
import type { CoreAction } from "../../../../game/narrative/types";
import { trapTabKey } from "../../focusTrap";
import type { BrowserAction, BrowserState } from "../desktop/browser/browserState";
import { CINE, UI } from "../../theme";
import { ScreenSurface } from "../ScreenSurface";
import { useScreenQuad } from "../useScreenQuad";
import { NotificationApp } from "./NotificationApp";
import { buildNotificationAppView } from "./laptopView";

export interface LaptopExtraTab {
  id: string;
  /** Already translated tab label. */
  label: string;
  /** Unread count shown on the desktop icon. Unused by the sidebar layout. */
  badge?: number;
  content: React.ReactNode;
  /**
   * Interactive desktop only: draws the app from the desktop's UI state (for example the Browser
   * window, which shows the address a link sent it to). When set it replaces `content`.
   */
  render?: (context: { browser: BrowserState; dispatchBrowser: (action: BrowserAction) => void }) => React.ReactNode;
}

export interface LaptopOverlayProps {
  /** From `selectLaptopView(state, scenario)`. */
  view: LaptopView;
  dispatch: (action: CoreAction) => void;
  onClose: () => void;
  /** Apps added by task 9.3. */
  extraTabs?: readonly LaptopExtraTab[];
  /** The built-in notification app of the parked story. Default true; the chapter foundation turns it off. */
  showNotifications?: boolean;
  /** The time shown in the window bar. Default: the fixed text of the parked story. */
  clockText?: string;
}

const NOTIFICATIONS_TAB = "notifications";
const SECURITY_TAB = "security";

export type TabIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** Sidebar icon per app id; unknown ids get a generic window icon. */
export const TAB_ICONS: Readonly<Record<string, TabIcon>> = {
  [NOTIFICATIONS_TAB]: Bell,
  bank: Landmark,
  compare: Columns2,
  [SECURITY_TAB]: ShieldCheck,
  thesis: GraduationCap,
  browser: Globe,
  "device-mail": Mail,
  "device-bank": Landmark,
  "device-calendar": CalendarDays,
  "device-housing": Home,
  "device-jobs": Briefcase,
  "device-files": FolderOpen,
};

/** Index of the tab to select after an arrow, Home or End key, or null for other keys. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowDown" || key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowUp" || key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export const LaptopOverlay: React.FC<LaptopOverlayProps> = ({ view, dispatch, onClose, extraTabs = [], showNotifications = true, clockText }) => {
  const { t } = useTranslation("chapter1");
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [active, setActive] = useState<string>(showNotifications ? NOTIFICATIONS_TAB : (extraTabs[0]?.id ?? NOTIFICATIONS_TAB));
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // On the projected laptop display when the 3D screen is visible; otherwise the flat panel.
  const layout = useScreenQuad("laptop");
  const onScreen = layout.mode === "surface";

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab" && dialogRef.current) {
        trapTabKey(dialogRef.current, event);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const tabs: LaptopExtraTab[] = [
    ...(showNotifications ? [{
      id: NOTIFICATIONS_TAB,
      label: t("laptop.apps.notifications"),
      content: (
        <NotificationApp
          view={buildNotificationAppView(view)}
          dispatch={dispatch}
          onOpenSecurity={extraTabs.some((tab) => tab.id === SECURITY_TAB) ? () => setActive(SECURITY_TAB) : undefined}
        />
      ),
    }] : []),
    ...extraTabs,
  ];
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const currentIndex = tabs.indexOf(current);
  const unread = showNotifications && view.notification.state === "new";

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const next = nextTabIndex(event.key, currentIndex, tabs.length);
    if (next === null) return;
    event.preventDefault();
    setActive(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  };

  const tabClass = (selected: boolean) =>
    `relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium cursor-pointer motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#b9a5f5] ${
      selected ? "text-white" : "text-[#a9a4c4] hover:bg-white/5 hover:text-white"
    }`;
  const tabStyle = (selected: boolean): React.CSSProperties =>
    selected ? { background: CINE.color.sidebarSelectedBg, boxShadow: `inset 3px 0 0 ${CINE.color.accentText}` } : {};

  return (
    <ScreenSurface layout={layout} device="laptop" panelWrapperClassName={UI.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("laptop.dialogLabel")}
        className={
          onScreen
            ? "flex h-full w-full flex-col overflow-hidden text-[#f7f5ff]"
            : "flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden border text-[#f7f5ff] shadow-2xl"
        }
        style={{
          background: CINE.color.laptopBody,
          borderColor: CINE.color.borderStrong,
          borderRadius: onScreen ? 0 : CINE.radiusPx.panel,
        }}
      >
        {/* Window chrome: three dots, the window title, the clock and Close. */}
        <div
          className="flex items-center gap-3 border-b px-3 py-1.5"
          style={{ background: CINE.color.laptopBar, borderColor: CINE.color.border }}
        >
          <span aria-hidden="true" className="flex gap-1.5">
            {CINE.color.laptopDots.map((color) => (
              <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            ))}
          </span>
          <h2 ref={headingRef} tabIndex={-1} className="flex items-center gap-2 text-sm font-semibold text-[#f7f5ff] outline-none">
            <Laptop className="h-4 w-4 text-[#b9a5f5]" aria-hidden="true" />
            {t("laptop.title")}
          </h2>
          <span className="ml-auto text-sm tabular-nums" style={{ color: CINE.color.textMuted }}>
            {clockText ?? t("laptop.clock")}
          </span>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium text-[#f7f5ff] motion-safe:transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5]"
            style={{ borderColor: CINE.color.border }}
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t("laptop.close")}
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={t("laptop.appsLabel")}
            data-testid="laptop-sidebar"
            className="flex shrink-0 flex-col gap-1 border-r p-2"
            style={{ width: CINE.laptop.sidebarPx, background: CINE.color.sidebarBg, borderColor: CINE.color.border }}
            onKeyDown={onTabKeyDown}
          >
            {tabs.map((tab) => {
              const selected = tab.id === current.id;
              const showUnread = tab.id === NOTIFICATIONS_TAB && unread;
              const Icon: TabIcon = tab.id === NOTIFICATIONS_TAB && unread ? BellRing : Object.hasOwn(TAB_ICONS, tab.id) ? TAB_ICONS[tab.id] : AppWindow;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  className={tabClass(selected)}
                  style={tabStyle(selected)}
                  onClick={() => setActive(tab.id)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words">{tab.label}</span>
                  {showUnread ? (
                    <span
                      aria-hidden="true"
                      data-testid="laptop-unread-dot"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: CINE.color.unreadDot }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <p
              data-testid="laptop-window-title"
              className="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold"
              style={{ borderColor: CINE.color.border, color: CINE.color.text }}
            >
              <Landmark className="h-4 w-4" style={{ color: CINE.color.accentText }} aria-hidden="true" />
              {current.id === NOTIFICATIONS_TAB ? t("laptop.windowTitle") : current.label}
            </p>
            <div
              role="tabpanel"
              id={`${baseId}-panel`}
              aria-labelledby={`${baseId}-tab-${current.id}`}
              className="min-h-0 flex-1 overflow-y-auto p-4"
            >
              {current.content}
            </div>
          </div>
        </div>
      </div>
    </ScreenSurface>
  );
};