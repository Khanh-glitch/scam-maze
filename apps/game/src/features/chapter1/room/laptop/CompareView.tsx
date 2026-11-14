// Compare view: the notification and the saved records side by side. The rows come from the core,
// which never says whether two values match. This view shows no verdict and no match marker; the
// player compares. The result sentences appear only after the player runs the compare action.
import React from "react";
import { Columns2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CoreAction } from "../../../../game/narrative/types";
import { UI } from "../../theme";
import type { CompareViewModel } from "./laptopView";

export interface CompareViewProps {
  view: CompareViewModel;
  dispatch: (action: CoreAction) => void;
}

const ROW_LABELS = {
  domain: "domain",
  contact: "contact",
  app: "app",
  case: "caseRef",
} as const;

function isRowKey(key: string): key is keyof typeof ROW_LABELS {
  return Object.hasOwn(ROW_LABELS, key);
}

export const CompareView: React.FC<CompareViewProps> = ({ view, dispatch }) => {
  const { t } = useTranslation("chapter1");
  const run = (deviceActionId: NonNullable<CompareViewModel["caseAction"]>) =>
    dispatch({ type: "DEVICE_ACTION", deviceActionId });
  const rows = view.rows.filter((row) => isRowKey(row.key));

  return (
    <section aria-labelledby="laptop-compare-heading" className="space-y-4">
      <h3 id="laptop-compare-heading" className={`${UI.label} flex items-center gap-2`}>
        <Columns2 className="h-4 w-4" aria-hidden="true" />
        {t("laptop.compare.heading")}
      </h3>

      {rows.length === 0 ? (
        <p className={UI.body}>{t("laptop.compare.noRecords")}</p>
      ) : (
        <>
          <p className={UI.body}>{t("laptop.compare.intro")}</p>
          <table className="w-full text-left text-sm" data-testid="laptop-compare-table">
            <thead>
              <tr>
                <th scope="col" className={UI.textMuted}>
                  <span className="sr-only">{t("laptop.compare.heading")}</span>
                </th>
                <th scope="col" className={UI.label}>
                  {t("laptop.compare.notificationColumn")}
                </th>
                <th scope="col" className={UI.label}>
                  {t("laptop.compare.savedColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} data-testid={`laptop-compare-row-${row.key}`}>
                  <th scope="row" className={UI.textMuted}>
                    {t(`laptop.compare.rows.${ROW_LABELS[row.key as keyof typeof ROW_LABELS]}`)}
                  </th>
                  <td>
                    <span>{row.notification ?? t("laptop.compare.notFound")}</span>
                  </td>
                  <td>
                    <span>{row.reference ?? t("laptop.compare.notFound")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-2">
            {view.caseAction ? (
              <button type="button" className={UI.buttonSecondary} onClick={() => run(view.caseAction!)}>
                {t("laptop.compare.compareCase")}
              </button>
            ) : null}
            {view.contactsAction ? (
              <button type="button" className={UI.buttonSecondary} onClick={() => run(view.contactsAction!)}>
                {t("laptop.compare.compareContacts")}
              </button>
            ) : null}
          </div>
          {view.caseCompared ? <p className={UI.body}>{t("laptop.compare.caseResult")}</p> : null}
          {view.contactsCompared ? <p className={UI.body}>{t("laptop.compare.contactResult")}</p> : null}
          <p className={UI.body}>{t("laptop.status.addressNote")}</p>
        </>
      )}
    </section>
  );
};
