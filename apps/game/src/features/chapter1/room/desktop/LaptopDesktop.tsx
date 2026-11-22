// Interactive desktop of the laptop: a wallpaper home screen of app icons, windows that open, go
// back, minimize and close, and a taskbar with the running apps and the game clock.
//
// The desktop is presentation only. Which window is open lives in `desktopState` (UI state, not
// saved). Launching, closing or minimizing an app dispatches nothing to the game core; only what the
// player does inside an app does. Apps may ask the desktop to open another app (a mail link opens
// the Browser window) through `DesktopNavProvider`. Colors come from `desktopTheme`: one theme per
// app, static gradients and plain shadows only.
//
// Keys: Escape goes back to the desktop, and closes the laptop when already there. The story layer
// handles Escape first (capture phase), so it asks the desktop through `registerEscape`.
// Arrow keys move between icons, Enter opens one, 1 to 9 open the nth icon, Tab reaches everything.
import React, { useCallback, useEffect, useId, useMemo, useReducer, useRef } from "react";
import { AppWindow, ArrowLeft, Laptop, LayoutGrid, Minus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trapTabKey } from "../../focusTrap";
import { CINE, UI } from "../../theme";
import { ScreenSurface } from "../ScreenSurface";
import { useScreenQuad } from "../useScreenQuad";
import { TAB_ICONS, type LaptopExtraTab, type TabIcon } from "../laptop/LaptopOverlay";
import { DesktopNavProvider, type DesktopNav } from "./desktopNav";
import {
  appStatus,
  desktopEscape,
  desktopReducer,
  INITIAL_DESKTOP_STATE,
  isRunning,
  type DesktopState,
} from "./desktopState";
import { DESKTOP_COLORS, themeFor } from "./desktopTheme";
import type { BrowserAction } from "./browser/browserState";

export interface LaptopDesktopProps {
  /** The apps on the laptop (the same list the sidebar layout shows as tabs). */
  apps: readonly LaptopExtraTab[];
  /** Closes the laptop (the taskbar button and Escape on the desktop). */
  onClose: () => void;
  /** Game time of day, already formatted. */
  clockText?: string;
  /** UI state to start from, so the open windows survive closing and reopening the laptop. */
  initialState?: DesktopState;
  onStateChange?: (state: DesktopState) => void;
  /**
   * Lets the story layer ask the desktop to use Escape first. The handler returns true when it went
   * back to the desktop (the key is used up), false when the laptop should close.
   */
  registerEscape?: (handler: (() => boolean) | null) => void;
  /** The app the current task step happens in: its icon and taskbar button carry the task marker. */
  taskAppId?: string | null;
}

const ICON_TASK_TARGET = "/assets/ui/hud/scammaze-quest-icon-512.png";

function iconFor(id: string): TabIcon {
  return Object.hasOwn(TAB_ICONS, id) ? TAB_ICONS[id] : AppWindow;
}

const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]";
const BAR_BUTTON = `relative flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs font-medium motion-safe:transition-colors ${FOCUS_RING}`;

export const LaptopDesktop: React.FC<LaptopDesktopProps> = ({ apps, onClose, clockText, initialState, onStateChange, registerEscape, taskAppId = null }) => {
  const { t } = useTranslation("chapter1");
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const homeHeadingRef = useRef<HTMLHeadingElement>(null);
  const windowHeadingRef = useRef<HTMLHeadingElement>(null);
  const [state, dispatch] = useReducer(desktopReducer, initialState ?? INITIAL_DESKTOP_STATE);
  /** Escape handler of the app on screen (see `useDesktopEscape`). */
  const appEscapeRef = useRef<(() => boolean) | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const layout = useScreenQuad("laptop");
  const onScreen = layout.mode === "surface";

  // Report UI state changes (the layer keeps them for the next time the laptop opens).
  useEffect(() => {
    onStateChangeRef.current?.(state);
  }, [state]);

  // An app that left the laptop cannot stay open.
  const appKey = apps.map((app) => app.id).join("|");
  useEffect(() => {
    dispatch({ type: "sync", validIds: appKey === "" ? [] : appKey.split("|") });
  }, [appKey]);

  // Escape: the story layer calls this first. One press goes back one level.
  const handleEscape = useCallback((): boolean => {
    // An app with a layer of its own (an open menu, a half-typed address) uses the key first.
    if (appEscapeRef.current?.()) return true;
    const result = desktopEscape(stateRef.current);
    if (result.consumed) dispatch({ type: "home" });
    return result.consumed;
  }, []);
  useEffect(() => {
    if (!registerEscape) return undefined;
    registerEscape(handleEscape);
    return () => registerEscape(null);
  }, [handleEscape, registerEscape]);

  // Without a story layer (tests, standalone use) the desktop handles Escape itself.
  useEffect(() => {
    if (registerEscape) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!handleEscape()) onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleEscape, registerEscape]);

  // Focus: the window title when a window opens, the desktop title when it returns, the opener on unmount.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const activeId = state.activeId;
  useEffect(() => {
    (activeId === null ? homeHeadingRef : windowHeadingRef).current?.focus({ preventScroll: true });
  }, [activeId]);

  const nav = useMemo<DesktopNav>(
    () => ({
      openBrowser: (target) => dispatch({ type: "navigate", target }),
      openApp: (id) => dispatch({ type: "open", id }),
      setEscapeHandler: (handler) => {
        appEscapeRef.current = handler;
      },
    }),
    [],
  );
  const dispatchBrowser = useCallback((action: BrowserAction) => dispatch({ type: "browser", action }), []);

  const activeApp = activeId === null ? null : (apps.find((app) => app.id === activeId) ?? null);
  const activeTheme = themeFor(activeApp?.id ?? "");

  const onDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Tab" && dialogRef.current) {
      trapTabKey(dialogRef.current, event.nativeEvent);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (activeId === null && /^[1-9]$/.test(event.key)) {
      const app = apps[Number(event.key) - 1];
      if (app) {
        event.preventDefault();
        dispatch({ type: "open", id: app.id });
      }
    }
  };

  const onIconsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-desktop-icon]"));
    if (buttons.length === 0) return;
    const index = Math.max(0, buttons.indexOf(document.activeElement as HTMLButtonElement));
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (forward ? 1 : buttons.length - 1)) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
  };

  const statusText = (id: string): string => {
    const status = appStatus(state, id);
    if (status === "active") return t("laptop.desktop.statusActive");
    if (status === "open") return t("laptop.desktop.statusOpen");
    if (status === "minimized") return t("laptop.desktop.statusMinimized");
    return "";
  };

  const ActiveIcon = activeApp ? iconFor(activeApp.id) : AppWindow;
  const windowButton = (theme: ReturnType<typeof themeFor>) =>
    `${BAR_BUTTON} w-8 justify-center px-0 ${theme.light ? "hover:bg-black/10" : "hover:bg-white/10"}`;

  return (
    <ScreenSurface layout={layout} device="laptop" panelWrapperClassName={UI.backdrop}>
      <DesktopNavProvider value={nav}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("laptop.dialogLabel")}
          data-testid="laptop-desktop"
          className={
            onScreen
              ? "flex h-full w-full flex-col overflow-hidden"
              : "flex h-[min(34rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden border shadow-2xl"
          }
          style={{
            background: "#0a1a2e",
            color: DESKTOP_COLORS.text,
            borderColor: CINE.color.borderStrong,
            borderRadius: onScreen ? 0 : CINE.radiusPx.panel,
          }}
          onKeyDown={onDialogKeyDown}
        >
          {/* Wallpaper and the area for icons or one window. A short fade marks a window change; motion-reduce skips it. */}
          <div key={activeId ?? "home"} className="relative min-h-0 flex-1 motion-safe:animate-[appFade_140ms_ease-out]" style={{ background: DESKTOP_COLORS.wallpaper }}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[28%] h-px" style={{ background: DESKTOP_COLORS.wallpaperLine }} />
            {activeApp === null ? (
              <div className="absolute inset-0 flex flex-col overflow-y-auto p-5" data-testid="desktop-home">
                <h2 ref={homeHeadingRef} tabIndex={-1} className="flex items-center gap-2 text-sm font-semibold outline-none" style={{ color: DESKTOP_COLORS.text }}>
                  <Laptop className="h-4 w-4" style={{ color: DESKTOP_COLORS.indicator }} aria-hidden="true" />
                  {t("laptop.desktop.homeLabel")}
                </h2>
                <p className="mt-1 text-xs" style={{ color: DESKTOP_COLORS.textMuted }}>
                  {t("laptop.desktop.hint")}
                </p>
                {apps.length === 0 ? (
                  <p className={`${UI.body} mt-6`}>{t("laptop.desktop.empty")}</p>
                ) : (
                  <div
                    role="group"
                    aria-label={t("laptop.desktop.appsGroup")}
                    className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-x-2 gap-y-4"
                    onKeyDown={onIconsKeyDown}
                  >
                    {apps.map((app) => {
                      const Icon = iconFor(app.id);
                      const theme = themeFor(app.id);
                      const running = isRunning(state, app.id);
                      const unread = app.badge ?? 0;
                      const target = app.id === taskAppId;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          data-desktop-icon
                          data-testid={`desktop-icon-${app.id}`}
                          data-task-target={target ? "true" : undefined}
                          aria-label={[
                            t("laptop.desktop.launch", { app: app.label }),
                            target ? t("laptop.desktop.taskTarget") : "",
                            unread > 0 ? t("laptop.desktop.unread", { count: unread }) : "",
                            running ? statusText(app.id) : "",
                          ]
                            .filter(Boolean)
                            .join(", ")}
                          onClick={() => dispatch({ type: "open", id: app.id })}
                          className={`group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1.5 pb-3 pt-2 text-xs font-medium motion-safe:transition-colors hover:bg-white/10 ${FOCUS_RING}`}
                          style={{ color: DESKTOP_COLORS.text }}
                        >
                          <span
                            aria-hidden="true"
                            className="relative flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[14px] motion-safe:transition-transform group-hover:-translate-y-0.5"
                            style={{
                              background: `linear-gradient(150deg, ${theme.tileFrom}, ${theme.tileTo})`,
                              boxShadow: `${DESKTOP_COLORS.iconShadow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
                            }}
                          >
                            <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                            {target && (
                              <>
                                <span className="task-target-pulse pointer-events-none absolute -inset-1 rounded-[17px]" />
                                <img
                                  src={ICON_TASK_TARGET}
                                  alt=""
                                  draggable={false}
                                  className="task-marker-bob pointer-events-none absolute -left-2.5 -top-3 h-6 w-6 select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                                />
                              </>
                            )}
                            {unread > 0 && (
                              <span
                                data-testid={`desktop-badge-${app.id}`}
                                className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-[#171521]"
                                style={{ background: DESKTOP_COLORS.badge, boxShadow: "0 0 0 2px #0f2540" }}
                              >
                                {unread}
                              </span>
                            )}
                          </span>
                          <span aria-hidden="true" className="max-w-full break-words text-center leading-tight" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                            {app.label}
                          </span>
                          {running && (
                            <span
                              aria-hidden="true"
                              data-testid={`desktop-running-${app.id}`}
                              className="absolute bottom-1 h-1 w-4 rounded-full"
                              style={{ background: DESKTOP_COLORS.indicator }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <section
                className="absolute inset-1.5 flex min-h-0 flex-col overflow-hidden rounded-xl border sm:inset-2.5"
                data-testid="desktop-window"
                data-app={activeApp.id}
                data-theme={activeTheme.light ? "light" : "dark"}
                aria-label={t("laptop.desktop.windowLabel", { app: activeApp.label })}
                style={{ background: activeTheme.bodyBg, borderColor: DESKTOP_COLORS.windowBorder, boxShadow: DESKTOP_COLORS.windowShadow }}
              >
                <div
                  className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5"
                  style={{ background: activeTheme.chromeBg, color: activeTheme.chromeText, borderColor: activeTheme.chromeBorder }}
                >
                  <button
                    type="button"
                    data-testid="desktop-back"
                    className={windowButton(activeTheme)}
                    style={{ borderColor: activeTheme.chromeBorder }}
                    aria-label={t("laptop.desktop.backToDesktop")}
                    title={t("laptop.desktop.backToDesktop")}
                    onClick={() => dispatch({ type: "home" })}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `linear-gradient(150deg, ${activeTheme.tileFrom}, ${activeTheme.tileTo})` }}
                  >
                    <ActiveIcon className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  </span>
                  <h2 ref={windowHeadingRef} tabIndex={-1} className="min-w-0 truncate text-sm font-semibold outline-none">
                    {activeApp.label}
                  </h2>
                  <span className="ml-auto flex gap-1.5">
                    <button
                      type="button"
                      data-testid="desktop-minimize"
                      className={windowButton(activeTheme)}
                      style={{ borderColor: activeTheme.chromeBorder }}
                      aria-label={t("laptop.desktop.minimize")}
                      title={t("laptop.desktop.minimize")}
                      onClick={() => dispatch({ type: "minimize", id: activeApp.id })}
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      data-testid="desktop-close-app"
                      className={windowButton(activeTheme)}
                      style={{ borderColor: activeTheme.chromeBorder }}
                      aria-label={t("laptop.desktop.closeApp", { app: activeApp.label })}
                      title={t("laptop.desktop.closeApp", { app: activeApp.label })}
                      onClick={() => dispatch({ type: "close", id: activeApp.id })}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </div>
                <div
                  id={`${baseId}-window`}
                  className={`min-h-0 flex-1 ${activeTheme.light ? "overflow-hidden" : "overflow-y-auto p-4"}`}
                  style={{ color: activeTheme.light ? "#14233d" : "#f7f5ff" }}
                >
                  {activeApp.render ? activeApp.render({ browser: state.browser, dispatchBrowser }) : activeApp.content}
                </div>
              </section>
            )}
          </div>

          {/* Taskbar: home, the running apps, the game clock and the laptop's own close button. */}
          <nav
            aria-label={t("laptop.desktop.taskbar")}
            data-testid="desktop-taskbar"
            className="flex shrink-0 items-center gap-1.5 border-t px-2 py-1.5"
            style={{ background: DESKTOP_COLORS.taskbarBg, borderColor: DESKTOP_COLORS.taskbarBorder }}
          >
            <button
              type="button"
              data-testid="taskbar-home"
              aria-pressed={activeId === null}
              className={`${BAR_BUTTON} hover:bg-white/10`}
              style={{
                color: DESKTOP_COLORS.text,
                borderColor: activeId === null ? DESKTOP_COLORS.taskbarActiveBorder : DESKTOP_COLORS.taskbarBorder,
                background: activeId === null ? DESKTOP_COLORS.taskbarActiveBg : undefined,
              }}
              onClick={() => dispatch({ type: "home" })}
            >
              <LayoutGrid className="h-4 w-4" style={{ color: DESKTOP_COLORS.indicator }} aria-hidden="true" />
              <span className="hidden sm:inline">{t("laptop.desktop.showDesktop")}</span>
              <span className="sr-only sm:hidden">{t("laptop.desktop.showDesktop")}</span>
            </button>
            <span aria-hidden="true" className="mx-1 h-5 w-px" style={{ background: DESKTOP_COLORS.taskbarBorder }} />
            {state.windows.map((window) => {
              const app = apps.find((entry) => entry.id === window.id);
              if (!app) return null;
              const Icon = iconFor(app.id);
              const theme = themeFor(app.id);
              const status = appStatus(state, app.id);
              return (
                <button
                  key={app.id}
                  type="button"
                  data-testid={`taskbar-app-${app.id}`}
                  data-status={status}
                  aria-pressed={status === "active"}
                  aria-label={`${app.label}, ${statusText(app.id)}`}
                  className={`${BAR_BUTTON} hover:bg-white/10 ${status === "minimized" ? "opacity-70" : ""}`}
                  style={{
                    color: DESKTOP_COLORS.text,
                    borderColor: status === "active" ? DESKTOP_COLORS.taskbarActiveBorder : DESKTOP_COLORS.taskbarBorder,
                    background: status === "active" ? DESKTOP_COLORS.taskbarActiveBg : undefined,
                  }}
                  onClick={() => (status === "active" ? dispatch({ type: "minimize", id: app.id }) : dispatch({ type: "open", id: app.id }))}
                >
                  <span
                    aria-hidden="true"
                    className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded"
                    style={{ background: `linear-gradient(150deg, ${theme.tileFrom}, ${theme.tileTo})` }}
                  >
                    <Icon className="h-3 w-3 text-white" aria-hidden="true" />
                    {app.id === taskAppId && status !== "active" && (
                      <img src={ICON_TASK_TARGET} alt="" draggable={false} data-testid={`taskbar-task-${app.id}`} className="pointer-events-none absolute -right-2 -top-2 h-3.5 w-3.5 select-none" />
                    )}
                  </span>
                  <span className="max-w-24 truncate" aria-hidden="true">
                    {app.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 bottom-0.5 h-0.5 rounded-full"
                    style={{ background: status === "active" ? DESKTOP_COLORS.indicator : DESKTOP_COLORS.indicatorDim }}
                  />
                </button>
              );
            })}
            <span className="ml-auto text-sm tabular-nums" data-testid="desktop-clock" style={{ color: DESKTOP_COLORS.textMuted }}>
              {clockText ?? t("laptop.clock")}
            </span>
            <button
              type="button"
              data-testid="desktop-close-laptop"
              className={`${BAR_BUTTON} hover:bg-white/10`}
              style={{ color: DESKTOP_COLORS.text, borderColor: DESKTOP_COLORS.taskbarBorder }}
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t("laptop.close")}
            </button>
          </nav>
        </div>
      </DesktopNavProvider>
    </ScreenSurface>
  );
};
