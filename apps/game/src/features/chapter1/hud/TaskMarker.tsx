// Task marker drawn over the prop of the current step (the laptop or the phone). On screen it floats
// above the prop with the distance under it; off screen it sits on the edge with an arrow toward the
// prop. The engine projects the point (`watchTaskMarker`) every frame while the camera turns, so the
// marker writes its position straight to the DOM: no React render per frame. The host only hears
// the distance in whole metres (for the tracker), which changes rarely.
// Visual only: the tracker already says where the step happens, so it is hidden from screen readers.
import React, { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScreenDeviceId } from "../../roomv2/game/screenProjection";
import type { TaskMarker as TaskMarkerState } from "../../roomv2/game/outside";
import { SHADOW } from "../../prologue/PrologueHud";
import type { Tx } from "../device/deviceFormat";
import { formatMeters } from "./taskText";

const ICON_QUEST = "/assets/ui/hud/scammaze-quest-icon-512.png";
const ICON_PX = 30;
/** Under this distance the marker hides its distance line (the prop is right there). */
const NEAR_M = 1.2;

/** Where the marker reads its placement from: the engine's `watchTaskMarker`. Returns the unsubscribe. */
export type TaskMarkerSource = (prop: ScreenDeviceId, listener: (marker: TaskMarkerState | null) => void) => () => void;

export interface TaskMarkerProps {
  target: ScreenDeviceId;
  source: TaskMarkerSource;
  /** Whole metres to the prop, or null while the marker is hidden. Called only when the value changes. */
  onDistance?: (metres: number | null) => void;
}

export const TaskMarker: React.FC<TaskMarkerProps> = ({ target, source, onDistance }) => {
  const { t } = useTranslation("chapter1");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  const distanceRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef(t as unknown as Tx);
  textRef.current = t as unknown as Tx;
  const onDistanceRef = useRef(onDistance);
  onDistanceRef.current = onDistance;

  useEffect(() => {
    let lastMetres: number | null | undefined;
    let lastLabel = "";
    const report = (metres: number | null) => {
      if (metres === lastMetres) return;
      lastMetres = metres;
      onDistanceRef.current?.(metres);
    };
    const stopWatching = source(target, (marker) => {
      const root = rootRef.current;
      const arrow = arrowRef.current;
      const distance = distanceRef.current;
      if (!root || !arrow || !distance) return;
      if (marker === null) {
        root.style.visibility = "hidden";
        report(null);
        return;
      }
      root.style.visibility = "visible";
      root.style.transform = `translate3d(${marker.x.toFixed(1)}px, ${marker.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      root.dataset.onScreen = marker.onScreen ? "true" : "false";
      arrow.style.display = marker.onScreen ? "none" : "flex";
      if (!marker.onScreen) arrow.style.transform = `translate(-50%, -50%) rotate(${marker.angle.toFixed(3)}rad)`;
      const label = marker.distance >= NEAR_M ? formatMeters(textRef.current, marker.distance) : "";
      if (label !== lastLabel) {
        lastLabel = label;
        distance.textContent = label;
        distance.style.display = label === "" ? "none" : "block";
      }
      report(Math.max(1, Math.round(marker.distance)));
    });
    return () => {
      stopWatching();
      report(null);
    };
  }, [source, target]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-testid="task-marker"
      className="pointer-events-none absolute left-0 top-0 z-[5] flex flex-col items-center will-change-transform"
      style={{ visibility: "hidden" }}
    >
      <div className="relative" style={{ width: ICON_PX, height: ICON_PX }}>
        <img src={ICON_QUEST} alt="" draggable={false} className="task-marker-bob h-full w-full select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]" />
        <span ref={arrowRef} className="absolute left-1/2 top-1/2 items-center justify-center" style={{ display: "none", width: ICON_PX * 2, height: ICON_PX * 2 }}>
          <ChevronRight className="ml-auto h-5 w-5 text-[#c9bbf7] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" strokeWidth={3} />
        </span>
      </div>
      <span ref={distanceRef} className={`mt-1 font-menu text-xs font-semibold tracking-[0.08em] text-[#f3efe4] ${SHADOW}`} style={{ display: "none" }} />
    </div>
  );
};
