// Shared wording of the task system: where a step happens ("Laptop · Mail") and the distance line.
import type { MissionStepView } from "../../../game/narrative/world";
import type { Tx } from "../device/deviceFormat";

/** "Laptop · Thesis", "Phone · Messages", "Laptop", or null when the step names no place. */
export function stepPlace(t: Tx, step: Pick<MissionStepView, "target" | "app">): string | null {
  if (step.target === null) return null;
  const device = t(`taskSystem.where.${step.target}`);
  if (step.app === null) return device;
  const app = step.app === "thesis" ? t("laptop.apps.thesis") : t(`device.apps.${step.app}`);
  return `${device} · ${app}`;
}

/** Whole metres, at least 1. */
export const formatMeters = (t: Tx, metres: number): string => t("taskSystem.distance", { meters: Math.max(1, Math.round(metres)) });
