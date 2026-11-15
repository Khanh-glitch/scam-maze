// Laptop overlay: a modal dialog with app tabs. The notification app is built in; the bank app,
// the compare view and Review Security (task 9.3) arrive through `extraTabs`.
// Escape and the close button call `onClose`; focus moves in on open and returns to the opener
// on unmount. No inputs, no forms, no links: addresses are plain text.
import React, { useEffect, useId, useRef, useState } from "react";
import { Laptop, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LaptopView } from "../../../../game/narrative/selectors";
import type { CoreAction } from "../../../../game/narrative/types";
import { trapTabKey } from "../../focusTrap";
import { UI } from "../../theme";
import { ScreenSurface } from "../ScreenSurface";
import { useScreenQuad } from "../useScreenQuad";
import { NotificationApp } from "./NotificationApp";
import { buildNotificationAppView } from "./laptopView";

export interface LaptopExtraTab {
  id: string;
  /** Already translated tab label. */
  label: string;
  content: React.ReactNode;
}

export interface LaptopOverlayProps {
  /** From `selectLaptopView(state, scenario)`. */
  view: LaptopView;
  dispatch: (action: CoreAction) => void;
  onClose: () => void;
  /** Apps added by task 9.3. */
  extraTabs?: readonly LaptopExtraTab[];
}

const NOTIFICATIONS_TAB = "notifications";

export const LaptopOverlay: React.FC<LaptopOverlayProps> = ({ view, dispatch, onClose, extraTabs = [] }) => {
  const { t } = useTranslation("chapter1");
  const baseId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [active, setActive] = useState<string>(NOTIFICATIONS_TAB);
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
    {
      id: NOTIFICATIONS_TAB,
      label: t("laptop.apps.notifications"),
      content: <NotificationApp view={buildNotificationAppView(view)} dispatch={dispatch} />,
    },
    ...extraTabs,
  ];
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  const tabClass = (selected: boolean) =>
    onScreen
      ? `flex items-center rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#b9a5f5] ${
          selected ? "border-[#7654d6]/60 bg-[#1d1b2b] text-white" : "border-transparent text-[#a9a4c4] hover:bg-[#1d1b2b]/60 hover:text-white"
        }`
      : selected
        ? UI.buttonPrimary
        : UI.buttonSecondary;

  return (
    <ScreenSurface layout={layout} device="laptop" panelWrapperClassName={UI.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("laptop.dialogLabel")}
        className={
          onScreen
            ? "flex h-full w-full flex-col bg-[#12101c] text-[#f7f5ff]"
            : `${UI.panel} flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-4`
        }
      >
        <div
          className={
            onScreen
              ? "flex items-center justify-between gap-3 border-b border-[#38344f] bg-[#171521] px-4 py-2"
              : "flex items-center justify-between gap-3"
          }
        >
          <h2 ref={headingRef} tabIndex={-1} className={`${UI.heading} flex items-center gap-2`}>
            <Laptop className="h-5 w-5 text-[#b9a5f5]" aria-hidden="true" />
            {t("laptop.title")}
          </h2>
          <span className={`${UI.textMuted} ${onScreen ? "ml-auto" : ""}`}>{t("laptop.clock")}</span>
          <button type="button" className={onScreen ? `${UI.buttonSecondary} !px-3 !py-1.5` : UI.buttonSecondary} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("laptop.close")}
          </button>
        </div>

        <div
          role="tablist"
          aria-label={t("laptop.appsLabel")}
          className={onScreen ? "flex flex-wrap gap-1 border-b border-[#38344f] bg-[#171521] px-4 pt-2" : "flex flex-wrap gap-2"}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={tab.id === current.id}
              aria-controls={`${baseId}-panel`}
              className={tabClass(tab.id === current.id)}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${current.id}`}
          className={`min-h-0 flex-1 overflow-y-auto ${onScreen ? "bg-[#1d1b2b] p-4" : "pr-1"}`}
        >
          {current.content}
        </div>
      </div>
    </ScreenSurface>
  );
};
