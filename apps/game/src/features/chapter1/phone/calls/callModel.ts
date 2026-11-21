// What the Calls app needs from the device content: the contacts, which of them were called, the
// turns of a call and the numbers typed on the keypad. Pure TypeScript.
// A call to a contact is a conversation made of scenario actions: the action `call` is the start of
// the call (the line picks up), and every other action that speaks is one turn of Alex. Nothing here
// changes game state; the screens only report which action the player chose.
import type { DeviceActionView, DeviceItemView, DeviceView } from "../../../../game/narrative/device";

/** The action that starts a call to a contact. */
export const OPENING_ACTION = "call";

export function contactsOf(view: DeviceView): DeviceItemView[] {
  return view.apps.contacts;
}

/** The action that starts the call, when this contact has one and it can be used now. */
export function availableOpener(item: DeviceItemView): DeviceActionView | undefined {
  return item.actions.find((action) => action.id === OPENING_ACTION && action.available);
}

/** The turns Alex can take now, once the call is connected. Turns that were taken are in the transcript. */
export function callTurns(item: DeviceItemView): DeviceActionView[] {
  return item.actions.filter((action) => action.speaks && action.id !== OPENING_ACTION && action.blocked !== "done");
}

export interface MadeCall {
  item: DeviceItemView;
  /** Simulated minute at which the call was made. */
  atMinute: number;
}

/** The contacts that Alex called, the most recent first. A call is made once its opening action is done. */
export function callsMade(contacts: readonly DeviceItemView[]): MadeCall[] {
  const made: MadeCall[] = [];
  for (const item of contacts) {
    const first = item.conversation.find((line) => line.key.startsWith(`${item.id}/${OPENING_ACTION}/`));
    if (first !== undefined) made.push({ item, atMinute: first.atMinute });
  }
  return made.sort((a, b) => b.atMinute - a.atMinute);
}

/** Digits of a number: spaces, dashes and a leading plus sign do not matter when matching. */
export function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

/** The contact whose saved number is exactly the typed number, or null. */
export function findContactByNumber(contacts: readonly DeviceItemView[], typed: string): DeviceItemView | null {
  const dialed = digitsOf(typed);
  if (dialed === "") return null;
  return contacts.find((item) => item.detail !== null && digitsOf(item.detail) === dialed) ?? null;
}

/** "03:07" for whole seconds. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
