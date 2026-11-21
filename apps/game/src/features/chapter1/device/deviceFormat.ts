// Formatting for the phone and laptop apps. One complete string per shape (no concatenation).
import { clockAtMinute } from "../../../game/narrative/device";
import type { DeviceActionView } from "../../../game/narrative/device";

export type Tx = (key: string, options?: Record<string, unknown>) => string;

const WEEKDAY_KEYS = [
  "hud.status.weekday.1",
  "hud.status.weekday.2",
  "hud.status.weekday.3",
  "hud.status.weekday.4",
  "hud.status.weekday.5",
  "hud.status.weekday.6",
  "hud.status.weekday.7",
] as const;

/** "Wednesday 08:00" for `minutes` since the chapter started. */
export function formatWhen(t: Tx, minutes: number): string {
  const { isoWeekday, hour, minute } = clockAtMinute(minutes);
  const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return t("device.when", { day: t(WEEKDAY_KEYS[isoWeekday - 1]), clock });
}

/** "1 h 30 min" for whole minutes. */
export function formatSpan(t: Tx, totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return t("planner.duration.minutes", { minutes: rest });
  if (rest === 0) return t("planner.duration.hours", { hours });
  return t("planner.duration.hoursMinutes", { hours, minutes: rest });
}

export function formatAmount(locale: string, amount: number): string {
  return new Intl.NumberFormat(locale).format(amount);
}

/** The label of an action with its time and cash cost, when it has any. */
export function actionLabel(t: Tx, locale: string, action: DeviceActionView): string {
  if (action.timeCostMinutes <= 0 && action.cashCost <= 0) return action.label;
  const time = formatSpan(t, action.timeCostMinutes);
  const amount = formatAmount(locale, action.cashCost);
  const cost =
    action.timeCostMinutes > 0 && action.cashCost > 0
      ? t("device.cost.both", { time, amount })
      : action.cashCost > 0
        ? t("device.cost.cash", { amount })
        : t("device.cost.time", { time });
  return t("device.actionWithCost", { label: action.label, cost });
}