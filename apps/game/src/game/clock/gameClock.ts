// In-game wall clock shared by the room engine (clock hands, laptop) and the phone status bar.
// Pure TypeScript. The room starts at 23:08; the engine reports the seconds elapsed since the
// room started, and readers format the same value so the phone and the wall clock never differ.
export const GAME_START_SECONDS = 23 * 3600 + 8 * 60;

let elapsedSeconds = 0;
/** Seconds of the day set by a story host (the simulated clock of the chapter). `null`: the room's own clock. */
let storySeconds: number | null = null;

/** Lets the chapter show its simulated time everywhere the room clock is read. `null` restores the room clock. */
export function setGameClockOverride(secondsOfDay: number | null): void {
  storySeconds = secondsOfDay !== null && Number.isFinite(secondsOfDay) ? secondsOfDay : null;
}

/** Called by the room engine every frame with the seconds since the room started. */
export function setGameElapsedSeconds(seconds: number): void {
  elapsedSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/** Formats a time of day as HH:MM (24 h), wrapping past midnight. */
export function formatClock(totalSeconds: number): string {
  const day = ((Math.floor(totalSeconds) % 86400) + 86400) % 86400;
  const h = Math.floor(day / 3600);
  const m = Math.floor((day % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The current in-game time as HH:MM. */
export function gameClockText(): string {
  return formatClock(storySeconds ?? GAME_START_SECONDS + elapsedSeconds);
}
