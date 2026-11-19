// Phone home screen with the three apps: Messages, Calls and Voicemail (Requirement 5.5).
// Each app is a button with an icon and visible text, so it works with mouse and keyboard.

import React from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Phone, Voicemail, type LucideIcon } from "lucide-react";
import { formatNumber } from "../../../i18n/format";
import { useGameLocale } from "../../../i18n/useGameLocale";

export type PhoneAppId = "messages" | "calls" | "voicemail";

/** An app of the shared device content (mail, bank, map, calendar, housing, jobs, files). */
export interface PhoneExtraApp {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Unread items; the badge is hidden at 0. */
  badge: number;
}
export interface PhoneHomeProps {
  extraApps?: readonly PhoneExtraApp[];
  /** False hides the Voicemail app (a scenario without voicemail). Default true. */
  showVoicemail?: boolean;
  onOpenExtra?: (id: string) => void;
  /** Number of unread messages; shown as text on the Messages app. */
  unreadCount: number;
  onOpenApp: (app: PhoneAppId) => void;
}

const APP_BUTTON =
  "flex w-full items-center gap-3 rounded-xl border border-[#38344f] bg-[#171521] px-4 py-3 text-left text-sm font-medium text-[#f7f5ff] motion-safe:transition-colors hover:border-[#7654d6] hover:bg-[#26233a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer";

const APP_ICON = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7654d6] text-white";

export const PhoneHome: React.FC<PhoneHomeProps> = ({ unreadCount, onOpenApp, extraApps = [], onOpenExtra, showVoicemail = true }) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  return (
    <div className="space-y-3">
      <h3 className="sr-only">{t("phone.home.heading")}</h3>
      <ul className="space-y-2">
        <li>
          <button type="button" className={APP_BUTTON} onClick={() => onOpenApp("messages")}>
            <span className={APP_ICON}>
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">{t("phone.home.messages")}</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#f2b24b] px-2 py-0.5 text-xs font-bold text-[#171521]">
                {t("phone.home.unread", { count: unreadCount, number: formatNumber(locale, unreadCount) })}
              </span>
            )}
          </button>
        </li>
        <li>
          <button type="button" className={APP_BUTTON} onClick={() => onOpenApp("calls")}>
            <span className={APP_ICON}>
              <Phone className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">{t("phone.home.calls")}</span>
          </button>
        </li>
        {showVoicemail && <li>
          <button type="button" className={APP_BUTTON} onClick={() => onOpenApp("voicemail")}>
            <span className={APP_ICON}>
              <Voicemail className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">{t("room.records.tabs.voicemail")}</span>
          </button>
        </li>}
        {extraApps.map((app) => (
          <li key={app.id}>
            <button type="button" className={APP_BUTTON} data-testid={`phone-app-${app.id}`} onClick={() => onOpenExtra?.(app.id)}>
              <span className={APP_ICON}>
                <app.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex-1">{app.label}</span>
              {app.badge > 0 && (
                <span className="rounded-full bg-[#f2b24b] px-2 py-0.5 text-xs font-bold text-[#171521]">
                  {t("device.unread", { count: app.badge, number: formatNumber(locale, app.badge) })}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
