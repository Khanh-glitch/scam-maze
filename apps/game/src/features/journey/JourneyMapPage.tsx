/**
 * `/journey`: the visual map of Chapter 1 "LAST SUBMISSION: 72 GIỜ CUỐI".
 *
 * The page is a reader, not a copy of the story: `buildScenarioJourney` derives everything from the
 * display scenario, so a mission added to `game/narrative/chapter1/` appears here after a reload and
 * a mission removed disappears. It is a development and design aid (like `/testmove`), reachable by
 * URL, and it never touches the chapter store, a save or the clock.
 */
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  Code2,
  Flag,
  Gauge,
  ScrollText,
  Target,
  Users,
} from "lucide-react";
import type { GameLocale } from "@scammaze/shared-types";
import { useGameLocale } from "../../i18n";
import { useDisplayScenario } from "../../i18n/narrative";
import {
  buildScenarioJourney,
  journeyClock,
  type JourneyCastMember,
  type JourneyEvent,
  type JourneyMission,
  type JourneyPath,
  type JourneyResource,
} from "../../game/narrative/chapter1/journey";

export interface JourneyMapPageProps {
  onBackToMenu?: () => void;
}

type Tx = (key: string, options?: Record<string, unknown>) => string;

const SURFACE = "rounded-2xl border border-white/10 bg-[#161322]/80";
const CHIP = "inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] leading-5 text-[#c9bbf7]";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.22em] text-[#a9a4c4]";

const KIND_COLOR: Record<string, string> = {
  mission: "bg-[#7654d6]",
  optional: "bg-[#2f7f68]",
  event: "bg-[#d79b4a]",
  appointment: "bg-[#4c8fd6]",
};

function formatNumber(locale: GameLocale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** "Wednesday 06:00" in the player's language, from the scenario's own clock. */
function clockText(t: Tx, minutes: number): string {
  const clock = journeyClock(minutes);
  const weekday = t(`hud.status.weekday.${clock.isoWeekday}`);
  const hh = String(clock.hour).padStart(2, "0");
  const mm = String(clock.minute).padStart(2, "0");
  return `${weekday} ${hh}:${mm}`;
}

const Section: React.FC<{
  icon: React.ElementType;
  title: string;
  body: string;
  id: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, body, id, children }) => (
  <section aria-labelledby={`${id}-heading`} className={`${SURFACE} p-5 sm:p-6`}>
    <header className="mb-4 flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#b9a5f5]" aria-hidden="true" />
      <div>
        <h2 id={`${id}-heading`} className="font-display text-xl font-semibold text-[#f3efe4] sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#a9a4c4]">{body}</p>
      </div>
    </header>
    {children}
  </section>
);

const Legend: React.FC<{ t: Tx }> = ({ t }) => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#c9c4dd]">
    {(
      [
        ["mission", "mission"],
        ["optional", "optional"],
        ["event", "event"],
        ["appointment", "appointment"],
        ["planned", "planned"],
      ] as const
    ).map(([key, kind]) => (
      <li key={key} className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-2.5 w-6 rounded-sm ${
            kind === "planned" ? "border border-dashed border-[#a1a1aa] bg-transparent" : KIND_COLOR[kind]
          }`}
        />
        {t(`journey.legend.${key}`)}
      </li>
    ))}
  </ul>
);

/** One horizontal track with the four day bands behind everything else. */
const Track: React.FC<{
  duration: number;
  days: Array<{ isoWeekday: number; startMinute: number; endMinute: number }>;
  children: React.ReactNode;
  className?: string;
}> = ({ duration, days, children, className = "h-6" }) => (
  <div className={`relative w-full overflow-hidden rounded-md bg-white/5 ${className}`}>
    {days.map((day) => (
      <span
        key={`${day.isoWeekday}-${day.startMinute}`}
        aria-hidden="true"
        className="absolute inset-y-0 border-l border-white/10 first:border-l-0"
        style={{ left: `${(day.startMinute / duration) * 100}%`, width: `${((day.endMinute - day.startMinute) / duration) * 100}%` }}
      />
    ))}
    {children}
  </div>
);

const DayHeader: React.FC<{ duration: number; days: Array<{ isoWeekday: number; startMinute: number; endMinute: number }>; t: Tx }> = ({
  duration,
  days,
  t,
}) => (
  <div className="mb-2 flex w-full text-[11px] text-[#a9a4c4]" aria-hidden="true">
    {days.map((day) => (
      <span
        key={`${day.isoWeekday}-${day.startMinute}`}
        className="-ml-px border-l border-white/10 pl-2 first:border-l-0 first:pl-0"
        style={{ width: `${((day.endMinute - day.startMinute) / duration) * 100}%` }}
      >
        {t(`hud.status.weekday.${day.isoWeekday}`)}
      </span>
    ))}
  </div>
);

const StepChip: React.FC<{ label: string; target: string | null; app: string | null; optional: boolean; t: Tx }> = ({
  label,
  target,
  app,
  optional,
  t,
}) => (
  <li className="flex flex-wrap items-baseline gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-sm text-[#e7e3f5]">
    <span className="min-w-0 flex-1">{label}</span>
    {optional && <span className={CHIP}>{t("journey.labels.optional")}</span>}
    {target !== null && (
      <span className={CHIP}>
        {t(`taskSystem.where.${target}`)}
        {app !== null && ` · ${app === "thesis" ? t("laptop.apps.thesis") : t(`device.apps.${app}`)}`}
      </span>
    )}
  </li>
);

const PathBlock: React.FC<{ path: JourneyPath; t: Tx }> = ({ path, t }) => (
  <div className="mt-3 first:mt-0">
    <div className="flex items-center gap-2">
      <span className={LABEL}>{t("journey.labels.path")}</span>
      <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-[#c9bbf7]">{path.id}</code>
    </div>
    <p className="mt-1 text-sm leading-relaxed text-[#e7e3f5]">{path.objective}</p>
    {path.steps.length === 0 ? (
      <p className="mt-2 text-xs italic text-[#a9a4c4]">{t("journey.labels.noSteps")}</p>
    ) : (
      <ul className="mt-2 space-y-1.5">
        {path.steps.map((step) => (
          <StepChip key={step.id} label={step.label} target={step.target} app={step.app} optional={step.optional} t={t} />
        ))}
      </ul>
    )}
  </div>
);

const MissionCard: React.FC<{ mission: JourneyMission; t: Tx }> = ({ mission, t }) => (
  <article
    data-testid={`journey-mission-${mission.id}`}
    className={`${SURFACE} flex flex-col gap-3 p-4 ${mission.optional ? "border-[#2f7f68]/50" : "border-[#7654d6]/40"}`}
  >
    <header className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-[#f3efe4]">{mission.title}</h3>
        {mission.optional && <span className={`${CHIP} border-[#2f7f68] text-[#8fe3c4]`}>{t("journey.labels.optional")}</span>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#a9a4c4]">
        <span>
          {t("journey.labels.opens")}: {mission.startMinute === null ? t("journey.labels.noDeadline") : clockText(t, mission.startMinute)}
        </span>
        <span>
          {t("journey.labels.deadline")}: {mission.deadlineMinute === null ? t("journey.labels.noDeadline") : clockText(t, mission.deadlineMinute)}
        </span>
        <span className="text-[#7f7995]">{mission.id}</span>
      </div>
    </header>
    <div className="divide-y divide-white/10">
      {mission.paths.map((path) => (
        <div key={path.id} className="py-3 first:pt-0 last:pb-0">
          <PathBlock path={path} t={t} />
        </div>
      ))}
    </div>
    {mission.onFail.length > 0 && (
      <footer className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className={LABEL}>{t("journey.labels.onFail")}</span>
        {mission.onFail.map((line) => (
          <code key={line} className={`${CHIP} border-[#d79b4a]/50 text-[#f0c48a]`}>
            {line}
          </code>
        ))}
      </footer>
    )}
  </article>
);

const EventRow: React.FC<{ event: JourneyEvent; t: Tx; locale: GameLocale }> = ({ event, t, locale }) => (
  <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-white/5 py-1.5 text-xs first:border-t-0">
    <span className="w-40 shrink-0 font-mono text-[11px] text-[#c9bbf7]">
      {event.atMinute === null ? t("journey.labels.afterAction") : clockText(t, event.atMinute)}
    </span>
    <span className="min-w-0 flex-1 text-[#e7e3f5]">{event.title}</span>
    {event.afterAction !== null && <code className="font-mono text-[10px] text-[#7f7995]">{event.afterAction}</code>}
    {event.optional && <span className={CHIP}>{t("journey.labels.optional")}</span>}
    {event.autoResolve && <span className={CHIP}>{t("journey.labels.auto")}</span>}
    {event.urgent && <span className={`${CHIP} border-[#d79b4a]/50 text-[#f0c48a]`}>{t("journey.labels.urgent")}</span>}
    {event.responses > 0 && (
      <span className={CHIP}>
        {t("journey.labels.responses")}: {formatNumber(locale, event.responses)}
      </span>
    )}
  </li>
);

const CastCard: React.FC<{ member: JourneyCastMember; t: Tx }> = ({ member, t }) => (
  <li className={`${SURFACE} p-3`}>
    <p className="font-display text-sm font-semibold text-[#f3efe4]">{member.name}</p>
    <p className="mt-0.5 text-xs text-[#a9a4c4]">{member.role}</p>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {member.missions.map((number) => (
        <span key={number} className={CHIP}>
          M{String(number).padStart(2, "0")}
        </span>
      ))}
      <span className={`${CHIP} ${member.inStreet ? "border-[#4c8fd6]/60 text-[#9ec9f2]" : ""}`}>
        {member.inStreet ? t("journey.labels.inStreet") : t("journey.labels.phoneOnly")}
      </span>
      {member.district !== null && (
        <span className="sr-only">{member.district}</span>
      )}
    </div>
    {member.district !== null && <p className="mt-1.5 font-mono text-[10px] text-[#7f7995]">{member.district}</p>}
  </li>
);

const resourceLabel = (t: Tx, resource: JourneyResource): string => {
  switch (resource.id) {
    case "timeMinutes":
      return t("journey.labels.timeLeft");
    case "thesisProgress":
      return t("journey.labels.thesis");
    case "cash":
      return t("hud.status.cash");
    case "digitalSecurity":
      return t("hud.status.security");
    case "supportNetwork":
      return t("hud.status.support");
    case "evidence":
      return t("journey.labels.evidence");
    case "fatigue":
      return t("hud.status.fatigue");
  }
};

const resourceText = (t: Tx, locale: GameLocale, resource: JourneyResource): string => {
  switch (resource.id) {
    case "timeMinutes":
      return t("journey.labels.hours", { value: formatNumber(locale, Math.round(resource.start / 60)) });
    case "cash":
      return `${formatNumber(locale, resource.start)} ${t("hud.status.cashUnit")}`;
    default:
      return t("hud.status.percent", { value: formatNumber(locale, resource.start) });
  }
};

/** Bar width 0-100 for a value; time and cash get their own scale so the bar means something. */
const resourceWidth = (resource: JourneyResource): number => {
  if (resource.id === "timeMinutes") return 100;
  if (resource.id === "cash") return Math.max(4, Math.min(100, (resource.start / 5_000_000) * 100));
  return Math.max(2, Math.min(100, resource.start));
};

export const JourneyMapPage: React.FC<JourneyMapPageProps> = ({ onBackToMenu }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const scenario = useDisplayScenario();
  const journey = useMemo(() => buildScenarioJourney(scenario, locale), [scenario, locale]);

  const required = journey.missions.filter((mission) => !mission.optional);
  const optional = journey.missions.filter((mission) => mission.optional);
  const { counts } = journey;

  const summary = [
    ["missions", counts.missions],
    ["optional", counts.optionalMissions],
    ["events", counts.scheduledEvents],
    ["planned", counts.planned],
    ["written", counts.writtenFlags],
    ["reserved", counts.reservedFlags],
  ] as const;

  return (
    <div
      data-testid="journey-page"
      className="h-screen w-screen overflow-y-auto overscroll-contain bg-[#0f0d18] text-[#f3efe4]"
    >
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0f0d18]/92 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3">
          {onBackToMenu && (
            <button
              type="button"
              onClick={onBackToMenu}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[#e7e3f5] transition-colors hover:border-[#b9a5f5] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("journey.back")}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className={LABEL}>{t("journey.badge")} · Chapter 1</p>
            <h1 className="truncate font-display text-lg font-semibold sm:text-2xl">{journey.title}</h1>
            <p className="truncate text-xs text-[#a9a4c4] sm:text-sm">{journey.subtitle}</p>
          </div>
          <p className="hidden max-w-xs text-right text-xs leading-relaxed text-[#a9a4c4] lg:block">
            {t("intro.last.p1", {
              age: formatNumber(locale, journey.protagonist.age),
              progress: formatNumber(locale, journey.resources.find((resource) => resource.id === "thesisProgress")?.start ?? 0),
            })}
          </p>
        </div>
        <dl className="mx-auto mt-3 grid w-full max-w-7xl grid-cols-3 gap-2 sm:grid-cols-6">
          {summary.map(([key, value]) => (
            <div key={key} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
              <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7f7995]">{t(`journey.counts.${key}`)}</dt>
              <dd className="font-display text-lg leading-tight text-[#f3efe4]">{formatNumber(locale, value)}</dd>
            </div>
          ))}
        </dl>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <p className="text-sm leading-relaxed text-[#a9a4c4]">{t("journey.intro")}</p>

        <Section id="timeline" icon={Clock3} title={t("journey.sections.timeline")} body={t("journey.sections.timelineBody")}>
          <div className="mb-3">
            <Legend t={t} />
          </div>
          <DayHeader duration={journey.durationMinutes} days={journey.days} t={t} />
          <div className="space-y-3">
            <div>
              <p className={`${LABEL} mb-1.5`}>{t("journey.counts.missions")}</p>
              <ul className="space-y-1.5">
                {journey.missions.map((mission) => {
                  const start = mission.startMinute ?? 0;
                  const end = mission.deadlineMinute ?? start;
                  return (
                    <li key={mission.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 sm:grid-cols-[minmax(0,16rem)_1fr]">
                      <span className="truncate text-xs text-[#c9c4dd]" title={mission.title}>
                        {mission.title}
                      </span>
                      <Track duration={journey.durationMinutes} days={journey.days}>
                        <span
                          title={`${mission.title} · ${clockText(t, start)} → ${end === start ? "—" : clockText(t, end)}`}
                          className={`absolute inset-y-1 rounded-sm ${
                            mission.optional ? KIND_COLOR.optional : KIND_COLOR.mission
                          }`}
                          style={{
                            left: `${(start / journey.durationMinutes) * 100}%`,
                            width: `${Math.max(0.6, ((end - start) / journey.durationMinutes) * 100)}%`,
                          }}
                        />
                      </Track>
                    </li>
                  );
                })}
              </ul>
            </div>

            {journey.plannedMissions.length > 0 && (
              <div>
                <p className={`${LABEL} mb-1.5`}>{t("journey.counts.planned")}</p>
                <ul className="space-y-1.5">
                  {journey.plannedMissions.map((planned) => (
                    <li key={planned.number} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 sm:grid-cols-[minmax(0,16rem)_1fr]">
                      <span className="truncate text-xs text-[#a9a4c4]">
                        M{String(planned.number).padStart(2, "0")} · {clockText(t, planned.openMinute)}
                      </span>
                      <Track duration={journey.durationMinutes} days={journey.days}>
                        <span
                          title={`M${planned.number} · ${clockText(t, planned.openMinute)}`}
                          className="absolute inset-y-1 rounded-sm border border-dashed border-[#a1a1aa]"
                          style={{ left: `${(planned.openMinute / journey.durationMinutes) * 100}%`, width: "0.6%" }}
                        />
                      </Track>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {journey.appointments.length > 0 && (
              <div>
                <p className={`${LABEL} mb-1.5`}>{t("journey.legend.appointment")}</p>
                <ul className="space-y-1.5">
                  {journey.appointments.map((appointment) => (
                    <li key={appointment.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 sm:grid-cols-[minmax(0,16rem)_1fr]">
                      <span className="truncate text-xs text-[#c9c4dd]" title={appointment.label}>
                        {appointment.label}
                      </span>
                      <Track duration={journey.durationMinutes} days={journey.days}>
                        <span
                          title={`${appointment.label} · ${clockText(t, appointment.startMinute)}`}
                          className={`absolute inset-y-1.5 rounded-sm ${KIND_COLOR.appointment}`}
                          style={{
                            left: `${(appointment.startMinute / journey.durationMinutes) * 100}%`,
                            width: `${Math.max(0.5, (((appointment.endMinute ?? appointment.startMinute) - appointment.startMinute) / journey.durationMinutes) * 100)}%`,
                          }}
                        />
                      </Track>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {journey.events.length > 0 && (
              <div>
                <p className={`${LABEL} mb-1.5`}>{t("journey.legend.event")}</p>
                <Track duration={journey.durationMinutes} days={journey.days} className="h-5">
                  {journey.events
                    .filter((event) => event.atMinute !== null)
                    .map((event) => (
                      <span
                        key={event.id}
                        title={`${event.title} · ${clockText(t, event.atMinute ?? 0)}`}
                        aria-label={`${event.title} · ${clockText(t, event.atMinute ?? 0)}`}
                        className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ${KIND_COLOR.event}`}
                        style={{ left: `${((event.atMinute ?? 0) / journey.durationMinutes) * 100}%` }}
                      />
                    ))}
                </Track>
              </div>
            )}

            {journey.events.length > 0 && (
              <ul className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                {journey.events.map((event) => (
                  <EventRow key={event.id} event={event} t={t} locale={locale} />
                ))}
              </ul>
            )}
          </div>
        </Section>

        <Section id="now" icon={Target} title={t("journey.sections.now")} body={t("journey.sections.nowBody")}>
          <div className="grid gap-4 lg:grid-cols-2">
            {required.map((mission) => (
              <MissionCard key={mission.id} mission={mission} t={t} />
            ))}
          </div>
          {optional.length > 0 && (
            <div className="mt-5">
              <h3 className={`${LABEL} mb-2`}>{t("journey.legend.optional")}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {optional.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} t={t} />
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section id="planned" icon={ScrollText} title={t("journey.sections.planned")} body={t("journey.sections.plannedBody")}>
          <ul className="grid gap-3 md:grid-cols-3">
            {journey.plannedMissions.map((planned) => {
              const cast = journey.cast.filter((member) => planned.cast.includes(member.id));
              return (
                <li
                  key={planned.number}
                  data-testid={`journey-planned-${planned.number}`}
                  className="rounded-xl border border-dashed border-[#a1a1aa]/50 bg-black/20 p-4"
                >
                  <p className={LABEL}>
                    M{String(planned.number).padStart(2, "0")} · {t("journey.counts.planned")}
                  </p>
                  <h3 className="mt-1 font-display text-base font-semibold uppercase tracking-wide text-[#e7e3f5]">
                    {t(`journey.labels.plannedTitle.m${planned.number}`)}
                  </h3>
                  <p className="mt-1 font-mono text-[11px] text-[#c9bbf7]">{clockText(t, planned.openMinute)}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[#a9a4c4]">
                    {t(`journey.labels.plannedNote.m${planned.number}`)}
                  </p>
                  <p className={`${LABEL} mt-3`}>{t("journey.labels.cast")}</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {cast.map((member) => (
                      <li key={member.id} className={CHIP}>
                        {member.name}
                      </li>
                    ))}
                  </ul>
                  {planned.reads.length > 0 && (
                    <>
                      <p className={`${LABEL} mt-3`}>{t("journey.labels.reads")}</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {planned.reads.map((flag) => (
                          <li key={flag} className={CHIP}>
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        <Section id="cast" icon={Users} title={t("journey.sections.cast")} body={t("journey.sections.castBody")}>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {journey.cast.map((member) => (
              <CastCard key={member.id} member={member} t={t} />
            ))}
          </ul>
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section id="devices" icon={Gauge} title={t("journey.sections.devices")} body={t("journey.sections.devicesBody")}>
            <ul className="space-y-2">
              {journey.apps.map((app) => (
                <li key={app.app} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs">
                  <span className="truncate text-[#c9c4dd]">{t(`device.apps.${app.app}`)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-[#7654d6]"
                      style={{ width: `${(app.items / Math.max(...journey.apps.map((entry) => entry.items), 1)) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-[#a9a4c4]">{formatNumber(locale, app.items)}</span>
                </li>
              ))}
            </ul>
            {journey.thesisTasks.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className={`${LABEL} mb-2`}>{t("journey.labels.thesisLabel")}</p>
                <ul className="space-y-2">
                  {journey.thesisTasks.map((task) => (
                    <li key={task.id} className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-[#e7e3f5]">
                      {task.label}
                      <span className="ml-2 font-mono text-[11px] text-[#a9a4c4]">
                        {task.minutes !== null && t("journey.labels.minutes", { value: formatNumber(locale, task.minutes) })}
                        {" · "}
                        {t("journey.labels.gain", { value: formatNumber(locale, task.gain) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {journey.interactables.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className={`${LABEL} mb-2`}>{t("journey.labels.interactables")}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {journey.interactables.map((item) => (
                    <li key={item.id} className={CHIP}>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section id="resources" icon={Gauge} title={t("journey.sections.resources")} body={t("journey.sections.resourcesBody")}>
            <ul className="space-y-2.5">
              {journey.resources.map((resource) => (
                <li key={resource.id} className="grid grid-cols-[8rem_1fr_auto] items-center gap-2 text-xs">
                  <span className="truncate text-[#c9c4dd]">{resourceLabel(t, resource)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[#2f7f68]" style={{ width: `${resourceWidth(resource)}%` }} />
                  </span>
                  <span className="w-28 text-right font-mono text-[#a9a4c4]">{resourceText(t, locale, resource)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <Section id="flags" icon={Flag} title={t("journey.sections.flags")} body={t("journey.sections.flagsBody")}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className={`${LABEL} mb-2`}>
                {t("journey.counts.written")} · {formatNumber(locale, journey.flags.written.length)}
              </p>
              <ul data-testid="journey-flags-written" className="flex flex-wrap gap-1.5">
                {journey.flags.written.map((flag) => (
                  <li key={flag} className={`${CHIP} border-[#2f7f68]/60 text-[#8fe3c4]`}>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={`${LABEL} mb-2`}>
                {t("journey.counts.reserved")} · {formatNumber(locale, journey.flags.reserved.length)}
              </p>
              <ul data-testid="journey-flags-reserved" className="flex flex-wrap gap-1.5">
                {journey.flags.reserved.map((flag) => (
                  <li key={flag} className={CHIP}>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section id="code" icon={Code2} title={t("journey.sections.code")} body={t("journey.sections.codeBody")}>
          <ul data-testid="journey-code-map" className="divide-y divide-white/10">
            {journey.codeMap.map((entry) => (
              <li key={entry.path} className="grid gap-1 py-2 text-sm md:grid-cols-[minmax(0,22rem)_1fr] md:gap-4">
                <code className="font-mono text-[11px] leading-5 text-[#b9a5f5]">{entry.path}</code>
                <span className="text-[#c9c4dd]">{entry.owns}</span>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="flex items-center gap-2 pb-8 pt-2 text-xs text-[#7f7995]">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {t("journey.intro")}
        </footer>
      </main>
    </div>
  );
};
