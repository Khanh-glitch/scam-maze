// Saved "Northgate Mobile" app on the laptop: home, activity, contacts and messages screens.
// Screen text comes from the view. Opening the app or a screen dispatches the matching device
// action once. Numbers are plain text spans: no link, no input, no form, no network.
import React, { useEffect, useRef, useState } from "react";
import { Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CoreAction } from "../../../../game/narrative/types";
import { UI } from "../../theme";
import type { BankAppView } from "./laptopView";

export interface BankAppProps {
  view: BankAppView;
  dispatch: (action: CoreAction) => void;
}

const TAB_KEYS = ["home", "activity", "contacts", "messages"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(id: string): id is TabKey {
  return (TAB_KEYS as readonly string[]).includes(id);
}

export const BankApp: React.FC<BankAppProps> = ({ view, dispatch }) => {
  const { t } = useTranslation("chapter1");
  const [selected, setSelected] = useState<string>("home");
  const sent = useRef<Set<string>>(new Set());

  const send = (deviceActionId: NonNullable<BankAppView["openAppAction"]>) => {
    if (sent.current.has(deviceActionId)) return;
    sent.current.add(deviceActionId);
    dispatch({ type: "DEVICE_ACTION", deviceActionId });
  };

  // Opening the app is one action, sent once when the app is first shown.
  useEffect(() => {
    if (view.openAppAction) send(view.openAppAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.openAppAction]);

  // Viewing a screen sends its action once.
  useEffect(() => {
    if (selected === "activity" && view.activityAction) send(view.activityAction);
    if (selected === "contacts" && view.contactsAction) send(view.contactsAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, view.activityAction, view.contactsAction]);

  const current = view.screens.find((screen) => screen.id === selected) ?? view.screens[0] ?? null;

  return (
    <section aria-labelledby="laptop-bank-heading" className="space-y-4">
      <h3 id="laptop-bank-heading" className={`${UI.label} flex items-center gap-2`}>
        <Landmark className="h-4 w-4" aria-hidden="true" />
        {t("laptop.bank.heading")}
      </h3>
      <p className={`${UI.textMuted} text-xs`}>{t("laptop.bank.savedLabel")}</p>

      {!view.opened || current === null ? (
        <p className={UI.body}>{t("laptop.bank.opening")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("laptop.bank.heading")}>
            {view.screens.map((screen) => (
              <button
                key={screen.id}
                type="button"
                aria-pressed={screen.id === current.id}
                className={screen.id === current.id ? UI.buttonPrimary : UI.buttonSecondary}
                onClick={() => setSelected(screen.id)}
              >
                {isTabKey(screen.id) ? t(`laptop.bank.tabs.${screen.id}`) : screen.title}
              </button>
            ))}
          </div>
          <div className={`${UI.card} space-y-2`} data-testid={`laptop-bank-screen-${current.id}`}>
            <h4 className={UI.label}>{current.title}</h4>
            <p className={`${UI.body} whitespace-pre-line`}>
              <span>{current.body}</span>
            </p>
          </div>
          <p className={UI.body}>{t("laptop.status.addressNote")}</p>
        </>
      )}
    </section>
  );
};
