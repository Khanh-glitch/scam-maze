// Stunt and revving motion of the reckless rider. Pure TypeScript (no three): the bike class feeds
// the numbers into the model. All angles are radians, all lengths meters, times seconds.

/** The two stunts. A wheelie lifts the front wheel; a weave swings across the lane. */
export type StuntKind = "wheelie" | "weave";

export const WHEELIE_SECONDS = 3.2;
export const WEAVE_SECONDS = 3.6;
/** Pitch of a full wheelie (about 32 degrees). */
export const WHEELIE_PITCH = 0.56;
/** Sideways swing of a weave, each way (m). */
export const WEAVE_AMPLITUDE = 0.75;
/** Number of full left-right swings in a weave. */
export const WEAVE_SWINGS = 3;

/** Smooth 0..1 ramp. */
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Front wheel lift at `t` seconds into a wheelie: up in 0.8 s, held, down in 0.9 s. */
export function wheeliePitch(t: number): number {
  if (t <= 0 || t >= WHEELIE_SECONDS) return 0;
  return WHEELIE_PITCH * Math.min(smooth(t / 0.8), smooth((WHEELIE_SECONDS - t) / 0.9));
}

/** Sideways offset at `t` seconds into a weave; 0 at both ends, so the bike returns to its lane. */
export function weaveOffset(t: number): number {
  if (t <= 0 || t >= WEAVE_SECONDS) return 0;
  const envelope = Math.min(smooth(t / 0.5), smooth((WEAVE_SECONDS - t) / 0.5));
  return WEAVE_AMPLITUDE * envelope * Math.sin((t / WEAVE_SECONDS) * Math.PI * 2 * WEAVE_SWINGS);
}

/** Seconds a stunt of this kind lasts. */
export const stuntSeconds = (kind: StuntKind) => (kind === "wheelie" ? WHEELIE_SECONDS : WEAVE_SECONDS);

/** Seconds of calm riding between two stunts: [min, max]. */
export const STUNT_PAUSE: [number, number] = [3, 8];
/** A stunt starts only with at least this much free road ahead (m) of the player and of the next bike in its way. */
export const STUNT_FREE_PLAYER = 22;
export const STUNT_FREE_BIKE = 14;
/** Share of stunts that are wheelies. */
export const WHEELIE_SHARE = 0.35;

/** Picks the next stunt from a random number in [0, 1). */
export const pickStunt = (random: number): StuntKind => (random < WHEELIE_SHARE ? "wheelie" : "weave");

/** Sideways offset (m, toward the road center) a bike takes to pass a slower bike. */
export const PASS_OFFSET = 1.8;

/** Engine shake while revving: small vertical jitter (m) and pitch rock (rad) at time `t`. */
export function revShake(t: number): { lift: number; rock: number } {
  return { lift: 0.012 * Math.sin(t * 95) + 0.006 * Math.sin(t * 61), rock: 0.018 * Math.sin(t * 47) };
}
