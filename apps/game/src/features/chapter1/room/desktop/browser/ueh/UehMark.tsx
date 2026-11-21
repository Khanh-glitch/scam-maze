// The mark of the simulated UEH sites: the UEH University wordmark (see `UehLogo`) and the school's
// name. On the colored portal header the logo sits on a white chip, so its dark teal stays readable.
import React from "react";
import { useTranslation } from "react-i18next";
import { UehLogo } from "./UehLogo";
import type { SiteColors } from "./uehTheme";

export interface UehMarkProps {
  colors: SiteColors;
  /** On a colored header: the logo sits on a white chip and the name is white. */
  onDark?: boolean;
  /** Show the full school name next to the logo. */
  showName?: boolean;
}

export const UehMark: React.FC<UehMarkProps> = ({ colors, onDark = false, showName = true }) => {
  const { t } = useTranslation("chapter1");
  return (
    <span className="flex min-w-0 items-center gap-3" data-testid="ueh-mark">
      <span className={onDark ? "flex shrink-0 items-center rounded-lg bg-white px-2 py-1" : "flex shrink-0 items-center"}>
        <UehLogo height={onDark ? 30 : 36} />
      </span>
      {showName && (
        <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-wide" style={{ color: onDark ? colors.white : colors.tealDark }}>
          {t("ueh.brand.fullName")}
        </span>
      )}
    </span>
  );
};
