import { describe, expect, it } from "vitest";
import { createLcg } from "../../../test/seededRandom";
import { ROOM } from "./apartment";
import { DOOR_OPENING, DOOR_OPEN_ANGLE, ENTRANCE_TOTAL_S, HALL, HANDOFF, entranceFrame } from "./entranceShot";

const CASES = Number(process.env.SCAMMAZE_PBT_RUNS ?? 200);
const BASE_SEED = 20261119;
/** Player radius used by the room's collision (engine.ts movePlayer). */
const R = 0.24;
const EPS = 1e-9;

/** Sorted random times from t = -0.5 to a little after the end, as a seeded list. */
function times(seed: number): number[] {
  const next = createLcg(seed);
  const n = 8 + Math.floor(next() * 40);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(-0.5 + next() * (ENTRANCE_TOTAL_S + 1));
  return out.sort((a, b) => a - b);
}

describe("entrance shot properties", () => {
  it("progress is monotonic: the camera only moves in, the fade only rises, the door opens before it closes (200 seeded cases)", () => {
    for (let c = 0; c < CASES; c += 1) {
      const seed = BASE_SEED + c;
      const ts = times(seed);
      let prev = entranceFrame(ts[0]);
      let closing = false;
      for (const t of ts.slice(1)) {
        const f = entranceFrame(t);
        const where = `seed=${seed} t=${t}`;
        expect(f.z, where).toBeLessThanOrEqual(prev.z + EPS);
        expect(f.fade, where).toBeGreaterThanOrEqual(prev.fade - EPS);
        if (prev.done) expect(f.done, where).toBe(true);
        // The door angle rises to full, then only falls.
        if (f.doorAngle < prev.doorAngle - EPS) closing = true;
        if (closing) expect(f.doorAngle, where).toBeLessThanOrEqual(prev.doorAngle + EPS);
        prev = f;
      }
    }
  });

  it("stays on the hall, doorway, room path and never crosses the wall outside the opening (200 seeded cases)", () => {
    for (let c = 0; c < CASES; c += 1) {
      const seed = BASE_SEED + 1000 + c;
      for (const t of times(seed)) {
        const f = entranceFrame(t);
        const where = `seed=${seed} t=${t} f=${JSON.stringify(f)}`;
        expect(f.y, where).toBe(1.62);
        expect(f.z, where).toBeLessThanOrEqual(HALL.zFar);
        expect(f.z, where).toBeGreaterThan(ROOM.z0);
        if (f.z > ROOM.z1 - R) {
          // On or beyond the wall line (with the body radius): the body fits through the opening and the hall.
          expect(f.x, where).toBeGreaterThanOrEqual(DOOR_OPENING.x0 + R);
          expect(f.x, where).toBeLessThanOrEqual(DOOR_OPENING.x1 - R);
          expect(f.x, where).toBeGreaterThanOrEqual(HALL.x0);
          expect(f.x, where).toBeLessThanOrEqual(HALL.x1);
        } else {
          expect(f.x, where).toBeGreaterThanOrEqual(ROOM.x0 + R);
          expect(f.x, where).toBeLessThanOrEqual(ROOM.x1 - R);
        }
        // The door is fully open from 0.5 m outside to 0.3 m inside the wall, so the leaf never blocks the eye.
        if (f.z < ROOM.z1 + 0.5 && f.z > ROOM.z1 - 0.3) expect(f.doorAngle, where).toBeGreaterThan(DOOR_OPEN_ANGLE * 0.95);
        expect(f.doorAngle, where).toBeGreaterThanOrEqual(0);
        expect(f.doorAngle, where).toBeLessThanOrEqual(DOOR_OPEN_ANGLE + EPS);
        expect(f.fade, where).toBeGreaterThanOrEqual(0);
        expect(f.fade, where).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is done exactly at the hand-off pose with the door closed, and only then (200 seeded cases)", () => {
    for (let c = 0; c < CASES; c += 1) {
      const seed = BASE_SEED + 2000 + c;
      for (const t of times(seed)) {
        const f = entranceFrame(t);
        const where = `seed=${seed} t=${t}`;
        expect(f.done, where).toBe(t >= ENTRANCE_TOTAL_S);
        if (f.done) expect(f, where).toEqual({ ...HANDOFF, doorAngle: 0, fade: 1, done: true });
      }
    }
  });

  it("reduced motion never moves the camera or the door and always fades up to done (200 seeded cases)", () => {
    for (let c = 0; c < CASES; c += 1) {
      const seed = BASE_SEED + 3000 + c;
      let prevFade = 0;
      for (const t of times(seed)) {
        const f = entranceFrame(t, true);
        const where = `seed=${seed} t=${t}`;
        expect({ x: f.x, y: f.y, z: f.z, yaw: f.yaw, pitch: f.pitch }, where).toEqual({ x: HANDOFF.x, y: HANDOFF.y, z: HANDOFF.z, yaw: HANDOFF.yaw, pitch: HANDOFF.pitch });
        expect(f.doorAngle, where).toBe(0);
        expect(f.fade, where).toBeGreaterThanOrEqual(prevFade - EPS);
        prevFade = f.fade;
      }
      expect(entranceFrame(10, true).done).toBe(true);
    }
  });
});
