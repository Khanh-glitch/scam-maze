// Pure mapping from Chapter_State to room presentation. No React, three or i18n imports.
// The result depends only on state and scenario. Laptop text is given as i18n keys; the React layer
// translates them before it calls the engine. See
// .kiro/specs/chapter-01-double-deception/design.md, "Room_Host presentation commands".
import type { ChapterState, ScenarioDefinition } from "../../../game/narrative/types";
import { selectLaptopView } from "../../../game/narrative/selectors";

export type PresentationPhoneMode = "lock" | "ringing" | "call";
export type PresentationMood = "calm" | "quiet" | "tense";

/** Translation keys for the laptop status card. */
export const LAPTOP_FRAME_KEYS = {
  new: { badgeKey: "room.laptop.badge.new", headlineKey: "room.laptop.headline.new" },
  opened: { badgeKey: "room.laptop.badge.opened", headlineKey: "room.laptop.headline.opened" },
} as const;

export interface LaptopFrameKeys {
  badgeKey: string;
  headlineKey: string;
}

export interface RoomPresentation {
  phoneMode: PresentationPhoneMode;
  /** True exactly while the call status is `ringing`. */
  ringing: boolean;
  /** `null` while no notification exists. Badge is "new" until the notification is handled. */
  laptopFrame: LaptopFrameKeys | null;
  mood: PresentationMood;
}

/** Commands the host applies. The laptop frame still carries keys; the React layer adapts it. */
export interface PresentationSink {
  setPhoneMode(mode: PresentationPhoneMode): void;
  ring(on: boolean): void;
  setLaptopFrame(frame: LaptopFrameKeys | null): void;
  chime(): void;
  setMood(mood: PresentationMood): void;
}

export function roomPresentation(state: ChapterState, scenario: ScenarioDefinition): RoomPresentation {
  const status = state.call.status;
  const ringing = status === "ringing";
  const phoneMode: PresentationPhoneMode = status === "active" ? "call" : ringing ? "ringing" : "lock";

  const notification = selectLaptopView(state, scenario).notification;
  let laptopFrame: LaptopFrameKeys | null = null;
  if (state.flags.notification_delivered === true) {
    laptopFrame = notification.handled ? LAPTOP_FRAME_KEYS.opened : LAPTOP_FRAME_KEYS.new;
  }

  let mood: PresentationMood = "calm";
  if (state.outcome !== null || state.status === "ended" || state.status === "finished") mood = "quiet";
  else if (ringing || status === "active" || state.pressure >= 2) mood = "tense";

  return { phoneMode, ringing, laptopFrame, mood };
}

function sameFrame(a: LaptopFrameKeys | null, b: LaptopFrameKeys | null): boolean {
  if (a === null || b === null) return a === b;
  return a.badgeKey === b.badgeKey && a.headlineKey === b.headlineKey;
}

/**
 * Issues only the commands whose value changed. `prev` is `null` for the first call, which sends
 * everything except the chime. The chime fires when the "new" notification card appears.
 */
export function applyPresentation(
  prev: RoomPresentation | null,
  next: RoomPresentation,
  commands: PresentationSink,
): void {
  if (prev === null || prev.phoneMode !== next.phoneMode) commands.setPhoneMode(next.phoneMode);
  if (prev === null || prev.ringing !== next.ringing) commands.ring(next.ringing);
  if (prev === null || !sameFrame(prev.laptopFrame, next.laptopFrame)) commands.setLaptopFrame(next.laptopFrame);
  if (prev !== null && next.laptopFrame?.badgeKey === LAPTOP_FRAME_KEYS.new.badgeKey && prev.laptopFrame?.badgeKey !== next.laptopFrame.badgeKey) {
    commands.chime();
  }
  if (prev === null || prev.mood !== next.mood) commands.setMood(next.mood);
}
