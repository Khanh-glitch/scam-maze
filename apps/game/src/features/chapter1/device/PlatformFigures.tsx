// The money figures of an online platform page (job or investment). It keeps four kinds of money
// apart, each with its own text label: real money in the bank, the balance the page shows (not
// money), what can be withdrawn, and what Alex sent that the page keeps. Facts only: no color or
// icon carries the meaning alone, and no figure is called good or bad.
import React from "react";
import { useTranslation } from "react-i18next";
import type { DeviceItemView } from "../../../game/narrative/device";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { UI } from "../theme";
import { formatAmount, type Tx } from "./deviceFormat";

export const PlatformFigures: React.FC<{ figures: NonNullable<DeviceItemView["figures"]> }> = ({ figures }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  return (
    <section aria-labelledby="platform-figures-heading" data-testid="platform-figures" className={UI.card}>
      <h4 id="platform-figures-heading" className={UI.label}>
        {t("device.figures.heading")}
      </h4>
      <dl className="mt-2 space-y-2">
        {figures.map((figure) => (
          <div key={figure.kind} className="flex items-start justify-between gap-3" data-testid={`platform-figure-${figure.kind}`}>
            <dt className="text-xs text-[#a9a4c4]">{t(`device.figures.${figure.kind}`)}</dt>
            <dd className="shrink-0 text-sm font-semibold tabular-nums text-[#f7f5ff]">
              {figure.amountVnd < 0 ? "-" : ""}
              {t("device.amount", { amount: formatAmount(locale, Math.abs(figure.amountVnd)) })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
