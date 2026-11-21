// Persistent list of active objectives, inside a polite live region (Requirement 6.10).
// New list items are announced when objectives activate. Completions remove items, which live
// regions do not announce, so the page passes the completion text as `announcement`.

import React, { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";
import { selectCurrentAct } from "../../../game/narrative/selectors";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, Objective, ScenarioDefinition } from "../../../game/narrative/types";
import { CINE } from "../theme";
import { Accent, SHADOW } from "../../prologue/PrologueHud";
import { useChapterState } from "../useChapterState";

export interface ObjectiveTrackerProps {
  /** Active objectives in objective order, for example from `selectActiveObjectives`. */
  objectives: readonly Objective[];
  /** Screen-reader-only text for the latest change that the list itself does not show. */
  announcement?: string | null;
  /** Chapter store. With `scenario`, the tracker shows the current act label. */
  store?: ChapterStore;
  /** Display scenario from `useDisplayScenario`, so the act title is localized. */
  scenario?: ScenarioDefinition;
  /** The latest completed objective, shown checked below the active ones. */
  completed?: readonly Objective[];
  /** Hint of the current objective. Shown as one dim line only while `hintOn` is true. */
  hint?: string | null;
  hintOn?: boolean;
}

const ICON_QUEST = "/assets/ui/hud/scammaze-quest-icon-512.png";
/** Left inset (px) of the lines under the current objective: they line up with its text. */
export const OBJECTIVE_INDENT_PX = 34;

const ActLabel: React.FC<{ store: ChapterStore; scenario: ScenarioDefinition }> = ({ store, scenario }) => {
  const { t } = useTranslation("chapter1");
  const act = useChapterState(
    store,
    useCallback((state: ChapterState) => selectCurrentAct(state, scenario), [scenario]),
  );
  const number = scenario.acts.findIndex((a) => a.id === act.id) + 1;
  return (
    <p className="ml-auto pl-3 font-menu text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{t("hud.act.label", { number, title: act.title })}</p>
  );
};

export const ObjectiveTracker: React.FC<ObjectiveTrackerProps> = ({
  objectives,
  announcement,
  store,
  scenario,
  completed = [],
  hint = null,
  hintOn = false,
}) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = useReducedMotion();
  const [idle, setIdle] = useState(false);
  const [hovered, setHovered] = useState(false);
  // The tracker fades down when the objectives have not changed for a while, and wakes on change.
  const objectiveKey = objectives.map((objective) => objective.id).join("|");
  useEffect(() => {
    setIdle(false);
    const id = window.setTimeout(() => setIdle(true), CINE.motion.idleFadeAfterMs);
    return () => window.clearTimeout(id);
  }, [objectiveKey]);
  const dimmed = idle && !hovered;
  return (
    <section
      aria-labelledby="objective-tracker-heading"
      data-testid="objective-tracker"
      data-idle={dimmed ? "true" : "false"}
      className={`pointer-events-auto ${SHADOW}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        maxWidth: CINE.widthPx.tracker,
        opacity: dimmed && !reducedMotion ? CINE.motion.idleOpacity : 1,
        transition: reducedMotion ? "none" : `opacity ${CINE.motion.slideMs}ms ${CINE.motion.ease}`,
      }}
    >
      <div className="flex items-baseline">
        <h2 id="objective-tracker-heading" className="flex items-center gap-2.5 font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#c9bbf7]">
          <Accent />
          {t("objectives.card")}
        </h2>
        {store && scenario && scenario.acts.length > 0 && <ActLabel store={store} scenario={scenario} />}
      </div>
      <div aria-live="polite" aria-atomic="false">
        {objectives.length === 0 ? (
          <p className="mt-1.5 font-menu text-base text-zinc-400">{t("objectives.empty")}</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {objectives.map((objective, index) =>
              index === 0 ? (
                <li key={objective.id} data-testid="objective-current" className="flex items-start gap-2.5">
                  <img src={ICON_QUEST} alt="" aria-hidden="true" width={24} height={24} draggable={false} className="mt-0.5 h-6 w-6 shrink-0 select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
                  <span className="font-menu text-lg font-semibold leading-snug tracking-[0.02em] text-[#f3efe4]">{objective.text}</span>
                </li>
              ) : (
                <li key={objective.id} data-testid="objective-other" className="flex items-start gap-2" style={{ paddingLeft: OBJECTIVE_INDENT_PX }}>
                  <span aria-hidden="true" className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#b9a5f5]" />
                  <span className="font-menu text-sm leading-snug tracking-[0.02em] text-zinc-300">{objective.text}</span>
                </li>
              ),
            )}
            {completed.map((objective) => (
              <li key={objective.id} data-testid="objective-done" className="flex items-start gap-2" style={{ paddingLeft: OBJECTIVE_INDENT_PX }}>
                <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6fe0a8]" strokeWidth={3} />
                <span className="font-menu text-sm leading-snug tracking-[0.02em] text-zinc-400 line-through decoration-zinc-500">
                  <span className="sr-only">{t("objectives.doneLabel")} </span>
                  {objective.text}
                </span>
              </li>
            ))}
          </ul>
        )}
        {hintOn && (
          <p
            role="note"
            aria-label={t("room.hud.hintPanelLabel")}
            data-testid="room-hint"
            className="mt-1.5 font-menu text-sm italic leading-snug text-zinc-400"
            style={{ paddingLeft: OBJECTIVE_INDENT_PX }}
          >
            {hint ?? t("room.hints.none")}
          </p>
        )}
        {announcement && <p className="sr-only">{announcement}</p>}
      </div>
    </section>
  );
};
