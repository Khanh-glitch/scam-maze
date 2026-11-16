/**
 * The four cinematic UI modes of Chapter 1, derived from state that already exists. Pure: it holds
 * no state and has no side effects.
 *
 * - `exploration`: the room is free, only the small HUD is shown.
 * - `call`: a call rings or is active and no reply is on offer (the caller speaks).
 * - `decision`: an active call stands at a node with reply options.
 * - `investigation`: the player inspects the laptop or the phone records.
 */
export type UiMode = "exploration" | "call" | "decision" | "investigation";

export interface UiModeInput {
  /** `state.call.status`. */
  callStatus: "idle" | "ringing" | "active" | "ended" | string;
  /** The dialogue view linked to the current call has at least one option. */
  hasReplyOptions: boolean;
  /** Kind of the top overlay (`laptop`, `phone`, `journal`, ...), or null. */
  overlayKind: string | null;
  /** The device the player is inspecting in 3D (`laptop`, `phone`, a prop id), or null. */
  inspecting: string | null;
}

export function deriveUiMode(input: UiModeInput): UiMode {
  if (input.callStatus === "active") return input.hasReplyOptions ? "decision" : "call";
  if (input.callStatus === "ringing") return "call";
  if (input.overlayKind === "laptop" || input.overlayKind === "phone") return "investigation";
  if (input.inspecting === "laptop" || input.inspecting === "phone") return "investigation";
  return "exploration";
}
