// Lock screen of the phone: the in-game time and day, the unread notifications as cards, and a
// swipe-up or click control. Opening a notification unlocks the phone and goes straight to its
// content. Nothing here changes game state: the callbacks only move the player through the UI.
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp } from "lucide-react";
import type { Tx } from "../device/deviceFormat";
import { PhoneAppTile } from "./PhoneAppIcon";
import { PhoneCloseButton } from "./PhoneChrome";
import type { PhoneNotification } from "./phoneNotifications";
import { PHONE_COLORS } from "./phoneTheme";

/** The lock screen shows at most this many cards; the rest are counted. */
export const MAX_LOCK_NOTIFICATIONS = 3;
/** Upward drag, in screen px, that counts as a swipe. */
const SWIPE_PX = 36;

export interface PhoneLockScreenProps {
  time: string;
  weekday: string | null;
  notifications: readonly PhoneNotification[];
  onOpenNotification: (notification: PhoneNotification) => void;
  onUnlock: () => void;
  onClose: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

/** Text of a card: the app label, the main line and an optional second line. */
function cardText(n: PhoneNotification, t: Tx): { app: string; title: string; detail: string | null } {
  if (n.kind === "voicemail") {
    return {
      app: t("room.records.tabs.voicemail"),
      title: n.summary ? t("phone.notification.summaryTitle") : t("phone.notification.voicemailTitle"),
      detail: n.title,
    };
  }
  if (n.kind === "message") return { app: t("device.apps.messages"), title: n.title, detail: n.preview };
  return {
    app: t(`device.apps.${n.app}`),
    title: n.title,
    detail: n.sender === null ? null : t("device.from", { name: n.sender }),
  };
}

export const PhoneLockScreen: React.FC<PhoneLockScreenProps> = ({
  time,
  weekday,
  notifications,
  onOpenNotification,
  onUnlock,
  onClose,
  headingRef,
}) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const startY = useRef<number | null>(null);
  const shown = notifications.slice(0, MAX_LOCK_NOTIFICATIONS);
  const more = notifications.length - shown.length;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col px-4 pb-3"
      data-testid="phone-lock"
      onPointerDown={(event) => {
        startY.current = event.clientY;
      }}
      onPointerMove={(event) => {
        if (startY.current !== null && startY.current - event.clientY >= SWIPE_PX) {
          startY.current = null;
          onUnlock();
        }
      }}
      onPointerUp={() => {
        startY.current = null;
      }}
      onPointerCancel={() => {
        startY.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onUnlock();
        }
      }}
    >
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {t("phone.lock.heading")}
      </h2>
      <div className="flex justify-end">
        <PhoneCloseButton onClose={onClose} />
      </div>
      <div className="pt-4 text-center" style={{ color: PHONE_COLORS.text }}>
        {weekday !== null && (
          <p className="text-sm font-medium" style={{ color: PHONE_COLORS.textMuted }} data-testid="phone-lock-day">
            {weekday}
          </p>
        )}
        <p className="text-[56px] font-light leading-none tabular-nums" data-testid="phone-lock-time">
          {time}
        </p>
      </div>
      <section aria-label={t("phone.lock.notifications")} className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="pt-2 text-center text-sm" style={{ color: PHONE_COLORS.textMuted }} data-testid="phone-lock-empty">
            {t("phone.lock.noNotifications")}
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((notification) => {
              const text = cardText(notification, t);
              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    data-testid={`phone-notification-${notification.id}`}
                    aria-label={t("phone.notification.open", { app: text.app, title: text.title })}
                    onClick={() => onOpenNotification(notification)}
                    className="flex w-full items-start gap-2.5 rounded-2xl border p-2.5 text-left motion-safe:transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
                    style={{ background: PHONE_COLORS.glass, borderColor: PHONE_COLORS.glassBorder, color: PHONE_COLORS.text }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = PHONE_COLORS.glassHover;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = PHONE_COLORS.glass;
                    }}
                  >
                    <PhoneAppTile app={notification.app} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold uppercase tracking-wide" style={{ color: PHONE_COLORS.textMuted }}>
                        {text.app}
                      </span>
                      <span className="line-clamp-2 break-words text-sm font-bold leading-snug">{text.title}</span>
                      {text.detail !== null && (
                        <span className="line-clamp-2 break-words text-[13px] leading-snug" style={{ color: PHONE_COLORS.textMuted }}>
                          {text.detail}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {more > 0 && (
          <p className="text-center text-xs font-semibold" style={{ color: PHONE_COLORS.textMuted }} data-testid="phone-lock-more">
            {t("phone.lock.more", { count: more })}
          </p>
        )}
      </section>
      <button
        type="button"
        onClick={onUnlock}
        data-testid="phone-unlock"
        aria-label={t("phone.lock.unlock")}
        className="mt-3 flex w-full shrink-0 flex-col items-center gap-0.5 rounded-xl py-2 motion-safe:transition-colors cursor-pointer hover:bg-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
        style={{ color: PHONE_COLORS.text }}
      >
        <ChevronUp className="h-5 w-5" aria-hidden="true" />
        <span className="text-xs font-medium" aria-hidden="true">
          {t("phone.lock.hint")}
        </span>
      </button>
    </div>
  );
};
