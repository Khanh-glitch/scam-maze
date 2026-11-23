import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import type { GameSettings } from "@scammaze/shared-types";
import OpenWorldApp from "./openworld/OpenWorldApp";

interface TestBusPageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
}

/** Prototype route `/testbus`: Saigon 3D open world (hauek `arena/cfd756dc-hauek` snapshot, no commit history). */
export const TestBusPage: React.FC<TestBusPageProps> = ({ onBackToMenu }) => {
  const { t } = useTranslation("worlds");
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <OpenWorldApp />
      <button
        type="button"
        onClick={onBackToMenu}
        className="absolute bottom-3 left-3 z-[100] flex cursor-pointer items-center gap-1.5 rounded-md border border-white/15 bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t("testbus.backToMenu")}
      </button>
    </div>
  );
};
