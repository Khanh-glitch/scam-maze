/**
 * The entrance shot: the camera stands in the hall outside the apartment door, the door swings
 * open into the room, and the camera walks in to the usual hand-off pose near the spawn.
 *
 * Pure and time-driven (no three.js, no clock, no randomness): `entranceFrame(t)` is the whole
 * script. The room engine applies it frame by frame while player input is ignored.
 *
 * Coordinates are the room's: the entrance wall is z = 2.1 (`ROOM.z1`), the door opening is
 * x 0.75 to 1.65, and the hall lies at z > 2.1. The numbers are duplicated here on purpose so the
 * module stays free of three.js; a test checks them against `ROOM`.
 */

/** The wall that holds the door (ROOM.z1). */
export const ENTRANCE_WALL_Z = 2.1;
/** Door opening between the frame posts (x range, metres). */
export const DOOR_OPENING = { x0: 0.75, x1: 1.65 } as const;
/** The door leaf swings open to this angle (radians, about 95 degrees), into the room. */
export const DOOR_OPEN_ANGLE = 1.658;
/** Hall extent outside the door: the camera never leaves this box. */
export const HALL = { x0: 0.0, x1: 2.4, zFar: 3.3 } as const;

/** Where control is handed to the player (the spawn of a plain `activate()`). */
export const HANDOFF = { x: 1.3, y: 1.62, z: 1.55, yaw: 0.62, pitch: -0.08 } as const;
/** Camera at t = 0: in the hall, 0.85 m from the door, looking in with a slight turn toward the room's centre. */
export const START = { x: 1.2, y: 1.62, z: 2.95, yaw: 0.1, pitch: -0.03 } as const;

/** Seconds. */
export const FADE_IN_S = 0.45;
export const DOOR_OPEN_AT_S = 0.25;
export const DOOR_OPEN_S = 0.8;
export const MOVE_START_S = 0.85;
export const MOVE_S = 1.3;
export const DOOR_CLOSE_S = 0.6;
/** The door starts to close once the eye is this far inside the wall (the spawn is 0.55 m inside). */
export const CLOSE_AFTER_INSIDE_M = 0.45;
/** Reduced motion: a plain fade up at the hand-off pose, nothing moves. */
export const REDUCED_TOTAL_S = FADE_IN_S;

export interface EntranceFrame {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** How far the door leaf is open, radians: 0 closed, `DOOR_OPEN_ANGLE` fully open. */
  doorAngle: number;
  /** Brightness multiplier of the final pass, 0 (black) to 1. */
  fade: number;
  /** The shot is over: the pose is the hand-off pose and control is released. */
  done: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Walk progress: half linear, half smoothstep, so the pace ramps up and down without a standstill. */
const walk = (u: number) => 0.5 * clamp01(u) + 0.5 * smooth(u);

/** Moment the eye is `CLOSE_AFTER_INSIDE_M` inside the wall (found once by bisection; `walk` is monotonic). */
function findCloseAt(): number {
  const targetZ = ENTRANCE_WALL_Z - CLOSE_AFTER_INSIDE_M;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (lerp(START.z, HANDOFF.z, walk(mid)) > targetZ) lo = mid;
    else hi = mid;
  }
  return MOVE_START_S + hi * MOVE_S;
}
export const DOOR_CLOSE_AT_S = findCloseAt();
/** Total length of the full shot, seconds. */
export const ENTRANCE_TOTAL_S = Math.round((DOOR_CLOSE_AT_S + DOOR_CLOSE_S) * 100) / 100 + 0.05;

/** The camera and door at time `t` seconds after the shot starts. */
export function entranceFrame(t: number, reducedMotion = false): EntranceFrame {
  const time = t > 0 ? t : 0; // NaN and negative times are the start
  const fade = smooth(time / FADE_IN_S);
  if (reducedMotion) {
    return { ...HANDOFF, doorAngle: 0, fade, done: time >= REDUCED_TOTAL_S };
  }
  if (time >= ENTRANCE_TOTAL_S) return { ...HANDOFF, doorAngle: 0, fade: 1, done: true };
  const u = clamp01((time - MOVE_START_S) / MOVE_S);
  const s = walk(u);
  const look = smooth((u - 0.2) / 0.8);
  const w = clamp01((time - DOOR_OPEN_AT_S) / DOOR_OPEN_S);
  const open = DOOR_OPEN_ANGLE * (1 - (1 - w) ** 3);
  const closing = smooth((time - DOOR_CLOSE_AT_S) / DOOR_CLOSE_S);
  return {
    x: lerp(START.x, HANDOFF.x, s),
    y: START.y,
    z: lerp(START.z, HANDOFF.z, s),
    yaw: lerp(START.yaw, HANDOFF.yaw, look),
    pitch: lerp(START.pitch, HANDOFF.pitch, s),
    doorAngle: open * (1 - closing),
    fade,
    done: false,
  };
}
