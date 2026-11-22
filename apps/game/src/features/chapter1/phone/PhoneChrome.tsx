// Small controls that every phone screen shares: the close button and the home indicator.
import React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { PHONE_COLORS } from "./phoneTheme";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]";

/**
 * True on the phone held with P: it has no Close button, because P (or Escape) puts it away, as on
 * a phone in the hand (owner).
 */
export const PhoneCloseHiddenContext = React.createContext(false);
/** Closes the phone (the player puts it down). The accessible name stays "Close phone". */
export const PhoneCloseButton: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation("chapter1");
  const hidden = React.useContext(PhoneCloseHiddenContext);
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t("phone.overlay.close")}
      data-testid="phone-close"
      className={`flex h-8 shrink-0 items-center gap-1 rounded-full bg-black/25 px-2.5 text-xs font-semibold text-[#f2f7fb] motion-safe:transition-colors hover:bg-black/45 cursor-pointer ${FOCUS}`}
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
      <span aria-hidden="true">{t("phone.overlay.closeLabel")}</span>
    </button>
  );
};

/** The bar at the bottom of an app. Pressing it returns to the home screen. */
export const PhoneHomeIndicator: React.FC<{ onHome: () => void }> = ({ onHome }) => {
  const { t } = useTranslation("chapter1");
  return (
    <button
      type="button"
      onClick={onHome}
      aria-label={t("phone.nav.home")}
      data-testid="phone-home-indicator"
      className={`group flex h-7 w-full shrink-0 items-center justify-center cursor-pointer ${FOCUS}`}
      style={{ background: "rgba(0,0,0,0.28)" }}
    >
      <span
        aria-hidden="true"
        className="block h-1 w-24 rounded-full motion-safe:transition-transform group-hover:scale-x-110"
        style={{ background: PHONE_COLORS.indicator }}
      />
    </button>
  );
};
