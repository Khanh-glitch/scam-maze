// Formats whole minutes for the schedule. One complete string per shape (no concatenation).
export type DurationText = (key: string, options: Record<string, unknown>) => string;

export function formatDuration(text: DurationText, totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return text("planner.duration.minutes", { minutes: rest });
  if (rest === 0) return text("planner.duration.hours", { hours });
  return text("planner.duration.hoursMinutes", { hours, minutes: rest });
}