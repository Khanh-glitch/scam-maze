// The chapter clock. One pure rule, used by the room host, so "does the world wait for me?" is a
// named decision with a test instead of a boolean buried in a hook.
//
// The line is not "which screen is open" but "is this a thing in the world, or the game's own
// bookkeeping?":
//
//   - the phone and the laptop are devices Alex uses inside the world, so time passes while they
//     are up. Mission 02's premise depends on it: the counter closes at 13:30 whether Alex is
//     reading the parcel page or not;
//   - a ringing call is the moment that must not wait. Answering, declining and letting it ring
//     are decisions made in the world's time, and hesitating costs minutes;
//   - the schedule, the journal, the task list, the inspection panel, the pause menu and an
//     ending are the game's own screens, not objects in Saigon. They stop the clock, like any
//     map screen in this genre.
//
// A call that is *in progress* stops it too: an answered conversation owns the player's hands and
// the phone screen, exactly as the opening narration owns the first minute.

/** Overlays during which the world keeps moving: the devices Alex actually uses. */
export const CLOCK_RUNNING_OVERLAYS = ["phone", "laptop"] as const;

export interface ClockDecision {
  /** Engine loaded and the chapter accepted. */
  started: boolean;
  /** Chapter status is `playing`. */
  playing: boolean;
  /** The host has paused the game (its own menu or settings sheet). */
  hostPaused: boolean;
  /** The opening narration is on screen. */
  introOpen: boolean;
  /** The player is inspecting a prop. */
  inspecting: boolean;
  /** An extension overlay (a screen the host owns) is open. */
  extensionBlocking: boolean;
  /** Overlay kinds currently on the stack, bottom first. */
  overlays: readonly string[];
  /** A call is ringing or active. */
  callOpen: boolean;
  /** A call has been answered and is in progress (not merely ringing). */
  callActive: boolean;
  /**
   * The parked story ("The Urgent Call") runs on a fixed room clock and its own scripted call, so
   * it keeps the original rule: only an empty, free room moves time. The scheduled chapter does
   * not set this.
   */
  legacyTimedStory: boolean;
  /** No intro, overlay, inspection or call: the player is free in the room. */
  freeRoam: boolean;
}

/**
 * Does the world clock tick now?
 *
 * Ringing is intentionally not a stop: the ring is the moment the world must not wait.
 */
export function clockRunsNow(decision: ClockDecision): boolean {
  if (decision.legacyTimedStory) {
    return decision.started && decision.playing && !decision.hostPaused && decision.freeRoam && !decision.callOpen;
  }
  if (!decision.started || !decision.playing) return false;
  if (decision.hostPaused || decision.introOpen || decision.inspecting) return false;
  if (decision.extensionBlocking) return false;
  // An answered call holds the clock; a ringing one does not.
  if (decision.callActive) return false;
  // Every open overlay must be a device in the world; anything else is a game screen.
  for (const kind of decision.overlays) {
    if (!(CLOCK_RUNNING_OVERLAYS as readonly string[]).includes(kind)) return false;
  }
  return true;
}
