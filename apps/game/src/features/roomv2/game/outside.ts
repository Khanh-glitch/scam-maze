import type { LaptopFrame, PhoneMode } from './screens';

/** Props a story host can listen to. Every other prop keeps the room's own behavior. */
export const ROOM_PROP_IDS = ['phone', 'laptop', 'note', 'receipts', 'calendar', 'photo', 'mug', 'door'] as const;
export type RoomPropId = (typeof ROOM_PROP_IDS)[number];
export const isRoomPropId = (id: string): id is RoomPropId => (ROOM_PROP_IDS as readonly string[]).includes(id);

/**
 * Port that lets an external story host (the chapter layer) drive the room. The engine only reports
 * what the player did and asks for text; it never reads story state. Without `RoomOptions.story` the
 * room behaves exactly as the standalone `/roomv2` page.
 */
export interface RoomStoryPort {
  /** Player pressed E on a story prop. `inspect-ready` fires when the camera pose is reached, `inspect-end` when the player leaves it. */
  onProp(id: RoomPropId, phase: 'interact' | 'inspect-ready' | 'inspect-end'): void;
  /** F, R, ... pressed (or a click) in an inspect pose. Returns true when handled. */
  onInspectKey(id: RoomPropId, key: string): boolean;
  /** Dynamic prompt text. `null` means "use the default translation". */
  label(id: string): string | null;
  /** Caption lines shown while inspecting. `null` means "use the default lines". */
  inspectLines(id: string): string[] | null;
  /** Key hints shown while inspecting. `null` means "use the default actions". */
  actions(id: string): Array<{ key: string; label: string }> | null;
  /** False keeps the player in the inspect pose (for example while the phone rings). */
  canLeaveInspect(id: string): boolean;
  /** True while the front door must stay shut. Optional; absent means unlocked. */
  doorLocked?(): boolean;
}

/** Presentation commands the engine accepts from a story host. */
export interface RoomStoryCommands {
  setPhoneMode(mode: PhoneMode): void;
  /** Vibration and ringtone on (true) or off (false). */
  ring(on: boolean): void;
  /** `LaptopFrame` text is drawn as given, so the host passes already translated text. `null` clears it. */
  setLaptopFrame(frame: LaptopFrame | null): void;
  /** Short notification sound at the laptop. */
  chime(): void;
  setMood(mood: 'calm' | 'quiet' | 'tense'): void;
  /** Leaves the inspect pose even when `canLeaveInspect` says no. */
  closeInspect(): void;
}

/**
 * How the room is joined to the neighborhood when it is entered from house no. 59.
 * The room is its own engine; the neighborhood builds it ahead of time ("standby"), shows it when
 * the player walks through the white doorway, and hears back when the player leaves.
 */
export interface RoomOptions {
  /**
   * Build and compile everything but do not run or draw until `Engine.activate()`; the neighborhood
   * does this while the player walks to the door, so the room is ready the moment it is needed.
   */
  standby?: boolean;
  /** The player chose the room's door; the neighborhood starts its white-out. */
  onExitStart?: () => void;
  /** The white-out is done (about 0.6 s later): switch back to the neighborhood. */
  onExit?: () => void;
  /** External story host. When set, the room's own phone-call timeline is off (`story = 'external'`). */
  story?: RoomStoryPort;
}
