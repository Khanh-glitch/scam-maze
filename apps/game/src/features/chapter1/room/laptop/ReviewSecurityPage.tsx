// Review Security page: shows the queued case and the fictional procedure text. No input, no link,
// no navigation. Opening it dispatches `dev.review-security` once.
import React, { useEffect, useRef } from "react";
import { ShieldQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CoreAction } from "../../../../game/narrative/types";
import { UI } from "../../theme";
import type { ReviewSecurityView } from "./laptopView";

export interface ReviewSecurityPageProps {
  view: ReviewSecurityView;
  dispatch: (action: CoreAction) => void;
}

export const ReviewSecurityPage: React.FC<ReviewSecurityPageProps> = ({ view, dispatch }) => {
  const { t } = useTranslation("chapter1");
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !view.openAction) return;
    sent.current = true;
    dispatch({ type: "DEVICE_ACTION", deviceActionId: view.openAction });
  }, [view.openAction, dispatch]);

  return (
    <section aria-labelledby="laptop-security-heading" className="space-y-4">
      <h3 id="laptop-security-heading" className={`${UI.label} flex items-center gap-2`}>
        <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
        {t("laptop.security.heading")}
      </h3>
      {!view.available ? (
        <p className={UI.body}>{t("laptop.notification.empty")}</p>
      ) : (
        <div className={`${UI.card} space-y-3`}>
          <p className={UI.body}>
            {view.contactNumber !== null ? (
              <span>{t("laptop.security.status", { number: view.contactNumber })}</span>
            ) : (
              <span>{t("laptop.security.statusNoNumber")}</span>
            )}
          </p>
          <h4 className={UI.label}>{t("laptop.security.stepsHeading")}</h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>{t("laptop.security.step1")}</li>
            <li>{t("laptop.security.step2")}</li>
            <li>{t("laptop.security.step3")}</li>
            <li>{t("laptop.security.step4")}</li>
          </ol>
          <p className={UI.textMuted + " text-xs"}>{t("laptop.security.noInput")}</p>
        </div>
      )}
    </section>
  );
};
