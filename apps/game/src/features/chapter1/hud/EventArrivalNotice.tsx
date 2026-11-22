// Small notice that an event arrived. It never takes focus or blocks play; the live region of the
// layer announces the same text once.
import React, { useEffect } from "react";
import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CINE, CINE_KEYCAP_STYLE, cinePanelStyle } from "../theme";

export interface EventArrivalNoticeProps {
  title: string;
  onDismiss: () => void;
  /** Milliseconds before it dismisses itself. */
  durationMs?: number;
  /** The key that brings up the device it arrived on (P for the carried phone), shown as a key cap. */
  keyHint?: { key: string; label: string };
}

export const EventArrivalNotice: React.FC<EventArrivalNoticeProps> = ({ title, onDismiss, durationMs = 6000, keyHint }) => {
  const { t } = useTranslation("chapter1");
  useEffect(() => {
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [onDismiss, durationMs, title]);
  return (
    <p
      className="flex items-center gap-2 px-3 py-2"
      style={{ ...cinePanelStyle(), fontSize: CINE.fontPx.body, maxWidth: CINE.widthPx.toast }}
      data-testid="event-arrival-notice"
    >
      <BellRing className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t("planner.arrival", { title })}</span>
      {keyHint && (
        <span className="ml-2 flex shrink-0 items-center gap-1.5 opacity-90" data-testid="event-arrival-key">
          <kbd aria-hidden="true" className="inline-flex items-center justify-center font-mono" style={CINE_KEYCAP_STYLE}>
            {keyHint.key}
          </kbd>
          <span>{keyHint.label}</span>
        </span>
      )}
    </p>
  );
};