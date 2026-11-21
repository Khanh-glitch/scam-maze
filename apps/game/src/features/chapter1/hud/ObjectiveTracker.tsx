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
import { CINE, cinePanelStyle } from "../theme";
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

/** Square checkbox of the objective card. Decorative: the state is also in the text for screen readers. */
const Checkbox: React.FC<{ checked: boolean; small?: boolean }> = ({ checked, small = false }) => (
  <span
    aria-hidden="true"
    data-testid="objective-checkbox"
    data-checked={checked ? "true" : "false"}
    className="inline-flex shrink-0 items-center justify-center"
    style={{
      width: small ? CINE.objective.smallBoxPx : CINE.objective.boxPx,
      height: small ? CINE.objective.smallBoxPx : CINE.objective.boxPx,
      borderRadius: 3,
      border: `1.5px solid ${checked ? CINE.color.accentText : CINE.color.checkboxBorder}`,
      background: checked ? CINE.color.selectedBg : "transparent",
      color: CINE.color.accentText,
    }}
  >
    {checked ? <Check style={{ width: "80%", height: "80%" }} strokeWidth={3} /> : null}
  </span>
);

const ActLabel: React.FC<{ store: ChapterStore; scenario: ScenarioDefinition }> = ({ store, scenario }) => {
  const { t } = useTranslation("chapter1");
  const act = useChapterState(
    store,
    useCallback((state: ChapterState) => selectCurrentAct(state, scenario), [scenario]),
  );
  const number = scenario.acts.findIndex((a) => a.id === act.id) + 1;
  return (
    <p className="ml-auto" style={{ fontSize: CINE.fontPx.small - 2, color: CINE.color.textMuted }}>
      {t("hud.act.label", { number, title: act.title })}
    </p>
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
      className="px-3 py-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        ...cinePanelStyle(),
        maxWidth: CINE.widthPx.tracker,
        fontSize: CINE.fontPx.body,
        opacity: dimmed && !reducedMotion ? CINE.motion.idleOpacity : 1,
        transition: reducedMotion ? "none" : `opacity ${CINE.motion.slideMs}ms ${CINE.motion.ease}`,
      }}
    >
      <div className="flex items-baseline gap-2">
        <h2
          id="objective-tracker-heading"
          className="font-semibold uppercase"
          style={{ fontSize: CINE.fontPx.small - 2, letterSpacing: "0.14em", color: CINE.color.textMuted }}
        >
          {t("objectives.card")}
        </h2>
        {store && scenario && scenario.acts.length > 0 && <ActLabel store={store} scenario={scenario} />}
      </div>
      <div aria-live="polite" aria-atomic="false">
        {objectives.length === 0 ? (
          <p className="mt-1.5" style={{ color: CINE.color.textMuted }}>
            {t("objectives.empty")}
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {objectives.map((objective, index) => (
              <li key={objective.id} data-testid={index === 0 ? "objective-current" : "objective-other"}>
                <p
                  className="flex items-start gap-2"
                  style={index === 0 ? undefined : { marginLeft: CINE.objective.indentPx, fontSize: CINE.fontPx.small, color: CINE.color.textMuted }}
                >
                  <span className="mt-[3px]">
                    <Checkbox checked={false} small={index !== 0} />
                  </span>
                  <span>{objective.text}</span>
                </p>
              </li>
            ))}
            {completed.map((objective) => (
              <li key={objective.id} data-testid="objective-done">
                <p
                  className="flex items-start gap-2"
                  style={{ marginLeft: CINE.objective.indentPx, fontSize: CINE.fontPx.small, color: CINE.color.textMuted }}
                >
                  <span className="mt-[3px]">
                    <Checkbox checked small />
                  </span>
                  <span>
                    <span className="sr-only">{t("objectives.doneLabel")} </span>
                    {objective.text}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
        {hintOn && (
          <p
            role="note"
            aria-label={t("room.hud.hintPanelLabel")}
            data-testid="room-hint"
            className="mt-1.5"
            style={{ marginLeft: CINE.objective.indentPx, fontSize: CINE.fontPx.small, color: CINE.color.textMuted }}
          >
            {hint ?? t("room.hints.none")}
          </p>
        )}
        {announcement && <p className="sr-only">{announcement}</p>}
      </div>    </section>
  );
};
