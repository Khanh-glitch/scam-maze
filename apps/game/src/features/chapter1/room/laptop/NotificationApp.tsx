// Notification app of the laptop overlay: the alert in a list, its details and the dismiss action.
// Addresses and numbers are plain text spans: no link, no input, no form, no network.
import React from "react";
import { Bell, ShieldCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CoreAction } from "../../../../game/narrative/types";
import { CINE, UI } from "../../theme";
import type { NotificationAppView } from "./laptopView";

export interface NotificationAppProps {
  view: NotificationAppView;
  dispatch: (action: CoreAction) => void;
  /**
   * Opens the Review Security page. The page sends `dev.review-security` itself when it opens, so
   * this button runs the same device action path as the Review Security app. When absent, the
   * button is not shown.
   */
  onOpenSecurity?: () => void;
}

export const NotificationApp: React.FC<NotificationAppProps> = ({ view, dispatch, onOpenSecurity }) => {
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
          <li
            className="overflow-hidden"
            data-testid="laptop-notification-item"
            style={{ border: `1px solid ${CINE.color.cardBorder}`, borderRadius: CINE.radiusPx.card, background: CINE.color.laptopDock }}
          >
            <div
              data-testid="laptop-alert-banner"
              className="flex items-center justify-between gap-3 px-3 py-2"
              style={{ background: CINE.color.alertBg, color: CINE.color.alertText }}
            >
              <p className="flex items-center gap-2 text-sm font-bold">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("laptop.notification.alertTitle")}
              </p>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wider">{badge}</span>
            </div>
            <div className="space-y-2 p-3">
              <p className={UI.textMuted + " text-xs"}>
                <span>{t("laptop.notification.alertSender")}</span> · <span>{t("laptop.notification.alertTime")}</span>
              </p>
              <p className={UI.body}>{t("laptop.notification.alertText")}</p>
              {view.state === "dismissed" ? <p className={UI.body}>{t("laptop.notification.historyNote")}</p> : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onOpenSecurity ? (
                  <button type="button" data-testid="laptop-review-security" className={UI.buttonPrimary} onClick={onOpenSecurity}>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {t("laptop.notification.reviewSecurity")}
                  </button>
                ) : null}
                {view.openAction ? (
                  <button type="button" className={UI.buttonSecondary} onClick={() => run(view.openAction!)}>
                    {view.state === "dismissed" ? t("laptop.notification.reopen") : t("laptop.notification.details")}
                  </button>
                ) : null}
                {view.dismissAction ? (
                  <button type="button" className={UI.buttonSecondary} onClick={() => run(view.dismissAction!)}>
                    {t("laptop.notification.dismiss")}
                  </button>
                ) : null}
              </div>
            </div>
          </li>        </ul>
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
