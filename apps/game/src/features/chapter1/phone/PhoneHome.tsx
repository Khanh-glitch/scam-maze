// Phone home screen: the day and time, an app grid and a dock. Each app is a button with its own
// colored tile and a visible label, so it works with mouse and keyboard. Opening an app only
// changes the screen; it never dispatches a game action.
import React from "react";
import { useTranslation } from "react-i18next";
import { Scale } from "lucide-react";
import { formatNumber } from "../../../i18n/format";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { UI } from "../theme";
import { PhoneAppTile } from "./PhoneAppIcon";
import { PhoneCloseButton } from "./PhoneChrome";
import type { PhoneAppId } from "./phoneRoutes";
import { PHONE_COLORS } from "./phoneTheme";

export type { PhoneAppId } from "./phoneRoutes";

/** An app of the shared device content (mail, bank, map, calendar, housing, jobs, files). */
export interface PhoneExtraApp {
  id: string;
  label: string;
  /** Unread items; the badge is hidden at 0. */
  badge: number;
}

export interface PhoneHomeProps {
  extraApps?: readonly PhoneExtraApp[];
  /** False hides the Voicemail app (a scenario without voicemail). Default true. */
  showVoicemail?: boolean;
  /** Shows the Browser app. Default false. */
  showBrowser?: boolean;
  onOpenExtra?: (id: string) => void;
  /** Number of unread messages; shown on the Messages app. */
  unreadCount: number;
  onOpenApp: (app: PhoneAppId) => void;
  time: string;
  weekday: string | null;
  onClose: () => void;
  /** Opens the decision panel; set only while the decision is offered. */
  onDecide?: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

/** Apps that sit in the dock when the device has them. The rest fill the grid. */
const DOCK_EXTRA = "mail";

interface Slot {
  key: string;
  /** Theme key of the app. */
  app: string;
  label: string;
  badge: number;
  /** Text that replaces the plain count in the badge for screen readers. */
  badgeText: string;
  testId?: string;
  onOpen: () => void;
}

const Badge: React.FC<{ count: number; text: string }> = ({ count, text }) => (
  <>
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold leading-none"
      style={{ background: PHONE_COLORS.badge, color: PHONE_COLORS.badgeText }}
    >
      {count}
    </span>
    <span className="sr-only">{text}</span>
  </>
);

export const PhoneHome: React.FC<PhoneHomeProps> = ({
  unreadCount,
  onOpenApp,
  extraApps = [],
  onOpenExtra,
  showVoicemail = true,
  showBrowser = false,
  time,
  weekday,
  onClose,
  onDecide,
  headingRef,
}) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  const unreadText = (count: number) => t("phone.home.unread", { count, number: formatNumber(locale, count) });
  const extraUnreadText = (count: number) => t("device.unread", { count, number: formatNumber(locale, count) });

  const base: Slot[] = [
    { key: "calls", app: "calls", label: t("phone.home.calls"), badge: 0, badgeText: "", onOpen: () => onOpenApp("calls") },
    {
      key: "messages",
      app: "messages",
      label: t("phone.home.messages"),
      badge: unreadCount,
      badgeText: unreadText(unreadCount),
      onOpen: () => onOpenApp("messages"),
    },
  ];
  if (showVoicemail) {
    base.push({ key: "voicemail", app: "voicemail", label: t("room.records.tabs.voicemail"), badge: 0, badgeText: "", onOpen: () => onOpenApp("voicemail") });
  }
  const extras: Slot[] = extraApps.map((app) => ({
    key: app.id,
    app: app.id,
    label: app.label,
    badge: app.badge,
    badgeText: extraUnreadText(app.badge),
    testId: `phone-app-${app.id}`,
    onOpen: () => onOpenExtra?.(app.id),
  }));
  const mail = extras.find((slot) => slot.key === DOCK_EXTRA);
  const dock = mail ? [...base, mail] : base;
  const browserSlot: Slot[] = showBrowser
    ? [{ key: "browser", app: "browser", label: t("phone.home.browser"), badge: 0, badgeText: "", testId: "phone-app-browser", onOpen: () => onOpenApp("browser") }]
    : [];
  const grid = [...extras.filter((slot) => slot !== mail), ...browserSlot];

  const tile = (slot: Slot, size: number) => (
    <button
      key={slot.key}
      type="button"
      data-testid={slot.testId}
      onClick={slot.onOpen}
      className="group flex w-full flex-col items-center gap-1 rounded-xl py-1 text-center cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
    >
      <span className="relative motion-safe:transition-transform group-hover:scale-105 group-active:scale-95">
        <PhoneAppTile app={slot.app} size={size} />
        {slot.badge > 0 && <Badge count={slot.badge} text={slot.badgeText} />}
      </span>
      <span className="line-clamp-2 w-full break-words text-[12px] font-medium leading-tight" style={{ color: PHONE_COLORS.text }}>
        {slot.label}
      </span>
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-2" data-testid="phone-home">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {t("phone.home.heading")}
      </h2>
      <div className="flex items-start justify-between gap-2 px-1">
        <div style={{ color: PHONE_COLORS.text }}>
          {weekday !== null && (
            <p className="text-sm font-medium" style={{ color: PHONE_COLORS.textMuted }}>
              {weekday}
            </p>
          )}
          <p className="text-4xl font-light leading-none tabular-nums" data-testid="phone-home-time">
            {time}
          </p>
        </div>
        <PhoneCloseButton onClose={onClose} />
      </div>
      <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
        <ul className="grid grid-cols-4 gap-x-1 gap-y-3" data-testid="phone-grid">
          {grid.map((slot) => (
            <li key={slot.key}>{tile(slot, 52)}</li>
          ))}
        </ul>
      </div>
      {onDecide && (
        <div
          className="mb-2 space-y-2 rounded-2xl border p-3"
          style={{ background: PHONE_COLORS.glass, borderColor: PHONE_COLORS.glassBorder }}
        >
          <p className="text-sm leading-snug" style={{ color: PHONE_COLORS.text }}>
            {t("phone.overlay.decidePrompt")}
          </p>
          <button type="button" onClick={onDecide} className={`${UI.buttonPrimary} w-full`}>
            <Scale className="h-4 w-4" aria-hidden="true" />
            {t("phone.overlay.decide")}
          </button>
        </div>
      )}
      <ul
        className="grid shrink-0 gap-1 rounded-3xl border px-2 py-2"
        style={{
          gridTemplateColumns: `repeat(${dock.length}, minmax(0, 1fr))`,
          background: PHONE_COLORS.glass,
          borderColor: PHONE_COLORS.glassBorder,
        }}
        data-testid="phone-dock"
      >
        {dock.map((slot) => (
          <li key={slot.key}>{tile(slot, 50)}</li>
        ))}
      </ul>
    </div>
  );
};
