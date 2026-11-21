// Task marker drawn over the prop of the current step (the laptop or the phone). On screen it floats
// above the prop with the distance under it; off screen it sits on the edge with an arrow toward the
// prop. The engine projects the point (`watchTaskMarker`); this only draws it. Visual only: the
// tracker already says where the step happens, so the marker is hidden from screen readers.
import React from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskMarker as TaskMarkerState } from "../../roomv2/game/outside";
import { SHADOW } from "../../prologue/PrologueHud";
import type { Tx } from "../device/deviceFormat";
import { formatMeters } from "./taskText";

const ICON_QUEST = "/assets/ui/hud/scammaze-quest-icon-512.png";
const ICON_PX = 30;
/** Under this distance the marker hides its distance line (the prop is right there). */
const NEAR_M = 1.2;

export const TaskMarker: React.FC<{ marker: TaskMarkerState }> = ({ marker }) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as Tx;
  return (
    <div
      aria-hidden="true"
      data-testid="task-marker"
      data-on-screen={marker.onScreen ? "true" : "false"}
      className="pointer-events-none absolute z-[5] flex flex-col items-center"
      style={{ left: marker.x, top: marker.y, transform: "translate(-50%, -50%)" }}
    >
      <div className="relative" style={{ width: ICON_PX, height: ICON_PX }}>
        <img src={ICON_QUEST} alt="" draggable={false} className="task-marker-bob h-full w-full select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]" />
        {!marker.onScreen && (
          <span
            className="absolute left-1/2 top-1/2 flex items-center justify-center"
            style={{ width: ICON_PX * 2, height: ICON_PX * 2, transform: `translate(-50%, -50%) rotate(${marker.angle}rad)` }}
          >
            <ChevronRight className="ml-auto h-5 w-5 text-[#c9bbf7] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={3} />
          </span>
        )}
      </div>
      {marker.distance >= NEAR_M && (
        <span className={`mt-1 font-menu text-xs font-semibold tracking-[0.08em] text-[#f3efe4] ${SHADOW}`}>{formatMeters(text, marker.distance)}</span>
      )}
    </div>
  );
};
