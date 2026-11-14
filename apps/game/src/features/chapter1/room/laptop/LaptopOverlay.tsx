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

  return (
    <div className={UI.backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("laptop.dialogLabel")}
        className={`${UI.panel} flex max-h-[90vh] max-w-3xl flex-col gap-4`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 ref={headingRef} tabIndex={-1} className={`${UI.heading} flex items-center gap-2`}>
            <Laptop className="h-5 w-5 text-[#b9a5f5]" aria-hidden="true" />
            {t("laptop.title")}
          </h2>
          <span className={UI.textMuted}>{t("laptop.clock")}</span>
          <button type="button" className={UI.buttonSecondary} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("laptop.close")}
          </button>
        </div>

        <div role="tablist" aria-label={t("laptop.appsLabel")} className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={tab.id === current.id}
              aria-controls={`${baseId}-panel`}
              className={tab.id === current.id ? UI.buttonPrimary : UI.buttonSecondary}
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
          className="min-h-0 flex-1 overflow-y-auto pr-1"
        >
          {current.content}
        </div>
      </div>
    </div>
  );
};
