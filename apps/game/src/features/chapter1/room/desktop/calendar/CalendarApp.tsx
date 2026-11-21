// Calendar of the laptop desktop: a light coral-and-white agenda. The deadline card (time left,
// thesis progress, submission) and the appointments come from the game's device items; the status of
// each appointment (happening now, upcoming, past) follows the game clock. Reading the calendar
// changes nothing.
import React from "react";
import { CalendarClock, CalendarDays, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DeviceItemView, DeviceView } from "../../../../../game/narrative/device";
import { formatSpan, formatWhen, type Tx } from "../../../device/deviceFormat";

export interface CalendarAppProps {
  view: DeviceView;
}

const INK = "#3a1e1a";
const MUTED = "#7b5a54";
const LINE = "#f0d9d4";
const CORAL = "#d9503f";
const SOFT = "#fdeeea";

type Status = "past" | "now" | "upcoming";

function statusOf(item: DeviceItemView, now: number): Status {
  const start = item.startsAtMinute ?? 0;
  if (now < start) return "upcoming";
  if (item.endsAtMinute !== null && now >= item.endsAtMinute) return "past";
  return "now";
}

export const CalendarApp: React.FC<CalendarAppProps> = ({ view }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const { calendar } = view;
  const items = view.apps.calendar;
  const groups: ReadonlyArray<{ status: Status; label: string }> = [
    { status: "now", label: t("device.calendar.happeningNow") },
    { status: "upcoming", label: t("device.calendar.upcoming") },
    { status: "past", label: t("device.calendar.past") },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain" data-testid="calendar-app" style={{ background: "#fffaf8", color: INK }} onWheel={(event) => event.stopPropagation()}>
      <header className="shrink-0 border-b px-4 py-3" style={{ borderColor: LINE, background: SOFT }}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2 text-sm font-bold" style={{ color: CORAL }} data-testid="calendar-deadline">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {t("device.calendar.deadline")}
          </span>
          <span className="text-sm font-semibold" data-testid="calendar-time-left">
            {t("device.calendar.timeLeft", { time: formatSpan(t, calendar.minutesLeft) })}
          </span>
          <span className="text-sm" style={{ color: MUTED }}>
            {t("device.calendar.thesis", { value: calendar.thesisProgress })}
          </span>
          <span className="text-sm" style={{ color: MUTED }} data-testid="calendar-submission">
            {t("device.calendar.submission", { status: t(`device.calendar.status.${calendar.submission}`) })}
          </span>
        </div>
      </header>
      <div className="space-y-5 p-4">
        {items.length === 0 ? (
          <p className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: LINE, color: MUTED }} data-testid="calendar-empty">
            {t("device.empty")}
          </p>
        ) : (
          groups.map(({ status, label }) => {
            const list = items.filter((item) => statusOf(item, calendar.now) === status);
            if (list.length === 0) return null;
            return (
              <section key={status} aria-label={label} data-testid={`calendar-group-${status}`}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: status === "now" ? CORAL : MUTED }}>
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </h3>
                <ul className="space-y-2">
                  {list.map((item) => (
                    <li key={item.id} className="flex gap-3 rounded-xl border bg-white p-3" style={{ borderColor: status === "now" ? CORAL : LINE, opacity: status === "past" ? 0.7 : 1 }} data-testid={`calendar-item-${item.id}`}>
                      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: SOFT, color: CORAL }}>
                        <Clock className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold">{item.title}</span>
                        <span className="block text-xs" style={{ color: MUTED }}>
                          {item.startsAtMinute !== null ? formatWhen(t, item.startsAtMinute) : ""}
                          {item.detail ? ` | ${item.detail}` : ""}
                        </span>
                        {item.body && (
                          <span className="mt-1 block break-words text-xs" style={{ color: MUTED }}>
                            {item.body}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};
