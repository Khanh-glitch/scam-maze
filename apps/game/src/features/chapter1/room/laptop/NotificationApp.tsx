// Notification app of the laptop overlay: the alert in a list, its details and the dismiss action.
// Addresses and numbers are plain text spans: no link, no input, no form, no network.
import React from "react";
import { Bell, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CoreAction } from "../../../../game/narrative/types";
import { UI } from "../../theme";
import type { NotificationAppView } from "./laptopView";

export interface NotificationAppProps {
  view: NotificationAppView;
  dispatch: (action: CoreAction) => void;
}

export const NotificationApp: React.FC<NotificationAppProps> = ({ view, dispatch }) => {
  const { t } = useTranslation("chapter1");
  const run = (deviceActionId: NonNullable<NotificationAppView["openAction"]>) =>
    dispatch({ type: "DEVICE_ACTION", deviceActionId });

  const badge =
    view.state === "dismissed"
      ? t("laptop.notification.badgeDismissed")
      : view.state === "opened"
        ? t("laptop.notification.badgeRead")
        : t("laptop.notification.badgeNew");

  return (
    <section aria-labelledby="laptop-notifications-heading" className="space-y-4">
      <h3 id="laptop-notifications-heading" className={`${UI.label} flex items-center gap-2`}>
        <Bell className="h-4 w-4" aria-hidden="true" />
        {t("laptop.notification.centerHeading")}
      </h3>

      {!view.listed ? (
        <p className={UI.body}>{t("laptop.notification.empty")}</p>
      ) : (
        <ul className="space-y-3">
          <li className={`${UI.card} space-y-2`} data-testid="laptop-notification-item">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#f7f5ff]">
                <ShieldAlert className={`h-4 w-4 ${UI.textWarning}`} aria-hidden="true" />
                {t("laptop.notification.alertTitle")}
              </p>
              <span className={`${UI.label} shrink-0`}>{badge}</span>
            </div>
            <p className={UI.textMuted + " text-xs"}>
              <span>{t("laptop.notification.alertSender")}</span> · <span>{t("laptop.notification.alertTime")}</span>
            </p>
            <p className={UI.body}>{t("laptop.notification.alertText")}</p>
            {view.state === "dismissed" ? <p className={UI.body}>{t("laptop.notification.historyNote")}</p> : null}
            <div className="flex flex-wrap gap-2">
              {view.openAction ? (
                <button type="button" className={UI.buttonPrimary} onClick={() => run(view.openAction!)}>
                  {view.state === "dismissed" ? t("laptop.notification.reopen") : t("laptop.notification.details")}
                </button>
              ) : null}
              {view.dismissAction ? (
                <button type="button" className={UI.buttonSecondary} onClick={() => run(view.dismissAction!)}>
                  {t("laptop.notification.dismiss")}
                </button>
              ) : null}
            </div>
          </li>
        </ul>
      )}

      {view.detailsOpen ? (
        <div className={`${UI.card} space-y-3`} role="group" aria-labelledby="laptop-notification-details-heading">
          <h4 id="laptop-notification-details-heading" className={UI.label}>
            {t("laptop.notificationDetails.heading")}
          </h4>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className={UI.textMuted}>{t("laptop.notificationDetails.senderLabel")}</dt>
              <dd>
                <span>{t("laptop.notificationDetails.senderValue")}</span>
              </dd>
            </div>
            <div>
              <dt className={UI.textMuted}>{t("laptop.notificationDetails.appLabel")}</dt>
              <dd>
                <span>{t("laptop.notificationDetails.appValue")}</span>
              </dd>
            </div>
            {view.originInspected ? (
              <div>
                <dt className={UI.textMuted}>{t("laptop.notificationDetails.originLabel")}</dt>
                <dd>
                  <span className={UI.textWarning}>{t("laptop.notificationDetails.originValue")}</span>
                </dd>
              </div>
            ) : null}
            {view.caseReference !== null ? (
              <div>
                <dt className={UI.textMuted}>{t("laptop.notificationDetails.caseLabel")}</dt>
                <dd>
                  <span>{t("laptop.notificationDetails.caseValue", { caseId: view.caseReference })}</span>
                </dd>
              </div>
            ) : null}
            {view.contactNumber !== null ? (
              <div>
                <dt className={UI.textMuted}>{t("laptop.notificationDetails.contactLabel")}</dt>
                <dd>
                  <span>{t("laptop.notificationDetails.contactValue", { number: view.contactNumber })}</span>
                </dd>
              </div>
            ) : null}
          </dl>
          {view.originInspected ? (
            <p className={UI.body}>{t("laptop.notificationDetails.inspected")}</p>
          ) : null}
          {view.inspectAction ? (
            <button type="button" className={UI.buttonSecondary} onClick={() => run(view.inspectAction!)}>
              {t("laptop.notificationDetails.inspect")}
            </button>
          ) : null}
          <p className={UI.body}>{t("laptop.status.addressNote")}</p>
        </div>
      ) : null}
    </section>
  );
};
