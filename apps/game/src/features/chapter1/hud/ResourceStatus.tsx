// Chapter status bar: the six resources of "LAST SUBMISSION: 72 GIỜ CUỐI" (time, thesis, cash,
// digital security, support network, evidence). Presentation only: it reads `ChapterState.resources`
// and never writes. Every value is text, so no status depends on color or an icon alone.
import React from "react";
import { Clock, FileSearch, GraduationCap, Moon, ShieldCheck, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameLocale } from "../../../i18n";
import { simulatedClock } from "../../../game/narrative/resources";
import type { ChapterResources } from "../../../game/narrative/resources";
import type { FatigueLevel } from "../../../game/narrative/fatigue";
import { UI } from "../theme";
import { formatSpan, type Tx } from "../device/deviceFormat";

const WEEKDAY_KEYS = [
  "hud.status.weekday.1",
  "hud.status.weekday.2",
  "hud.status.weekday.3",
  "hud.status.weekday.4",
  "hud.status.weekday.5",
  "hud.status.weekday.6",
  "hud.status.weekday.7",
] as const;

export interface ResourceStatusProps {
  resources: ChapterResources;
  /** Present when the scenario has fatigue rules. The level is written as text, not only as a number. */
  fatigueLevel?: FatigueLevel;
}

const Item: React.FC<{ icon: LucideIcon; label: string; value: string; testId: string }> = ({
  icon: Icon,
  label,
  value,
  testId,
}) => (
  <li className="flex items-center gap-2" data-testid={testId}>
    <Icon className="h-4 w-4 shrink-0 text-[#b9a5f5]" aria-hidden="true" />
    <span className="text-xs text-[#a9a4c4]">{label}</span>
    <span className="ml-auto pl-3 text-xs font-semibold tabular-nums text-[#f7f5ff]">{value}</span>
  </li>
);

export const ResourceStatus: React.FC<ResourceStatusProps> = ({ resources, fatigueLevel }) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  const clock = simulatedClock(resources.timeMinutes);
  const clockText = `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
  const text = t as unknown as Tx;
  const percent = (value: number): string => t("hud.status.percent", { value });
  return (
    <section
      aria-label={t("hud.status.label")}
      data-testid="resource-status"
      className={`${UI.hudPanel} w-72`}
    >
      <ul className="space-y-1">
        <Item
          icon={Clock}
          testId="resource-time"
          label={t("hud.status.time")}
          value={t("hud.status.timeValue", {
            time: formatSpan(text, resources.timeMinutes),
            day: t(WEEKDAY_KEYS[clock.isoWeekday - 1]),
            clock: clockText,
          })}
        />
        <Item icon={GraduationCap} testId="resource-thesis" label={t("hud.status.thesis")} value={percent(resources.thesisProgress)} />
        <Item
          icon={Wallet}
          testId="resource-cash"
          label={t("hud.status.cash")}
          value={t("hud.status.cashValue", { amount: new Intl.NumberFormat(locale).format(resources.cash) })}
        />
        <Item icon={ShieldCheck} testId="resource-security" label={t("hud.status.security")} value={percent(resources.digitalSecurity)} />
        <Item icon={Users} testId="resource-support" label={t("hud.status.support")} value={percent(resources.supportNetwork)} />
        <Item icon={FileSearch} testId="resource-evidence" label={t("hud.status.evidence")} value={String(resources.evidence)} />
        {fatigueLevel !== undefined && (
          <Item
            icon={Moon}
            testId="resource-fatigue"
            label={t("hud.status.fatigue")}
            value={t("hud.status.fatigueValue", { level: t(`hud.status.fatigueLevel.${fatigueLevel}`), value: resources.fatigue })}
          />
        )}
      </ul>
    </section>
  );
};
