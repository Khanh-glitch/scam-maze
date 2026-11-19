// Schedule overlay: events that wait for an answer (respond now, postpone, ignore), open goals with
// their deadlines, and thesis work. It shows facts and costs only. There is no score, and no
// response is marked as right or wrong.
import React, { useEffect, useRef } from "react";
import { CalendarClock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../../i18n/format";
import { useGameLocale } from "../../../i18n/useGameLocale";
import type { MissionView, PendingEventView } from "../../../game/narrative/world";
import { UI } from "../theme";
import { formatDuration, type DurationText } from "./formatDuration";
import { ThesisPanel, type ThesisPanelProps } from "./ThesisPanel";

export interface PlannerOverlayProps {
  events: readonly PendingEventView[];
  missions: readonly MissionView[];
  thesis: ThesisPanelProps;
  onRespond: (eventId: string, responseId: string) => void;
  onClose: () => void;
}

export const PlannerOverlay: React.FC<PlannerOverlayProps> = ({ events, missions, thesis, onRespond, onClose }) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as DurationText;
  const locale = useGameLocale();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div className={UI.backdrop}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-heading"
        data-testid="planner-overlay"
        className={`${UI.panel} flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col gap-4 overflow-y-auto`}
      >
        <header className="flex items-center justify-between gap-3">
          <h2 id="planner-heading" ref={headingRef} tabIndex={-1} className={`${UI.heading} flex items-center gap-2`}>
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
            {t("planner.heading")}
          </h2>
          <button type="button" onClick={onClose} className={UI.buttonSecondary} aria-label={t("planner.close")}>
            <X className="h-4 w-4" aria-hidden="true" />
            <span>{t("planner.close")}</span>
          </button>
        </header>

        <div>
          <h3 className={UI.label}>{t("planner.eventsHeading")}</h3>
          {events.length === 0 ? (
            <p className={`${UI.body} mt-2`} data-testid="planner-no-events">
              {t("planner.noEvents")}
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {events.map((event) => (
                <li key={event.id} className={UI.card} data-testid={`planner-event-${event.id}`}>
                  <p className="text-xs text-[#a9a4c4]">
                    {t(`planner.channel.${event.channel}`)}
                    {event.optional ? ` · ${t("planner.optional")}` : ""}
                  </p>
                  <h4 className="mt-1 text-sm font-bold text-[#f7f5ff]">{event.title}</h4>
                  <p className={`${UI.body} mt-1`}>{event.body}</p>
                  <p className="mt-2 text-xs text-[#a9a4c4]">
                    {event.minutesLeft === null ? null : t("planner.expires", { time: formatDuration(text, event.minutesLeft) })}
                    {event.postponed > 0 ? `${event.minutesLeft === null ? "" : " · "}${t("planner.postponed", { count: event.postponed, number: formatNumber(locale, event.postponed) })}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.responses.map((response) => (
                      <button
                        key={response.id}
                        type="button"
                        className={UI.buttonSecondary}
                        data-testid={`planner-response-${event.id}-${response.id}`}
                        onClick={() => onRespond(event.id, response.id)}
                      >
                        {response.timeCostMinutes > 0
                          ? t("planner.responseWithCost", { label: response.label, time: formatDuration(text, response.timeCostMinutes) })
                          : response.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className={UI.label}>{t("planner.missionsHeading")}</h3>
          {missions.length === 0 ? (
            <p className={`${UI.body} mt-2`} data-testid="planner-no-missions">
              {t("planner.noMissions")}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {missions.map((mission) => (
                <li key={mission.id} className={UI.card} data-testid={`planner-mission-${mission.id}`}>
                  <p className="text-sm font-bold text-[#f7f5ff]">
                    {mission.title}
                    {mission.optional ? <span className="ml-2 text-xs font-normal text-[#a9a4c4]">{t("planner.optional")}</span> : null}
                  </p>
                  <p className={`${UI.body} mt-1`}>{mission.objective}</p>
                  <p className="mt-1 text-xs text-[#a9a4c4]">
                    {mission.minutesLeft === null ? t("planner.noDeadline") : t("planner.due", { time: formatDuration(text, mission.minutesLeft) })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ThesisPanel {...thesis} />
      </section>
    </div>
  );
};