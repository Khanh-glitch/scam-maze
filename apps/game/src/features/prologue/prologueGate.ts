import type { ChapterSession } from "../../game/chapters/chapterSession";

/**
 * The neighborhood prologue (explore, rain, walk home to the room) belongs to the parked story
 * "The Urgent Call". "LAST SUBMISSION: 72 GIỜ CUỐI" starts in Alex's dorm room, so a new game goes
 * straight to the room. The prologue code stays and can be switched back on here.
 */
export const PROLOGUE_IN_ROUTING = false;

/** Saved games always skip the prologue. `?skip-prologue` skips it when it is in the routing. */
export function shouldPlayPrologue(session: Pick<ChapterSession, "origin">, search: string): boolean {
  if (!PROLOGUE_IN_ROUTING) return false;
  if (session.origin !== "new-game") return false;
  return !new URLSearchParams(search).has("skip-prologue");
}
