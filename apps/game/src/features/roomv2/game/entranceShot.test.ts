import { describe, expect, it } from "vitest";
import { ROOM } from "./apartment";
import {
  DOOR_CLOSE_AT_S,
  DOOR_CLOSE_S,
  DOOR_OPENING,
  DOOR_OPEN_ANGLE,
  ENTRANCE_TOTAL_S,
  ENTRANCE_WALL_Z,
  HANDOFF,
  MOVE_S,
  MOVE_START_S,
  REDUCED_TOTAL_S,
  START,
  entranceFrame,
} from "./entranceShot";

describe("entrance shot script", () => {
  it("uses the room's own entrance wall and the door's frame", () => {
    expect(ENTRANCE_WALL_Z).toBe(ROOM.z1);
    // The door opening is the frame at x = 1.2 +- 0.45 (apartment.ts, ENTRANCE).
    expect(DOOR_OPENING.x0).toBeCloseTo(1.2 - 0.45, 6);
    expect(DOOR_OPENING.x1).toBeCloseTo(1.2 + 0.45, 6);
  });

  it("starts outside the door, dark, with the door closed, looking into the room", () => {
    const f = entranceFrame(0);
    expect(f).toMatchObject({ x: START.x, y: 1.62, z: START.z, doorAngle: 0, fade: 0, done: false });
    expect(f.z).toBeGreaterThan(ROOM.z1);
    expect(f.x).toBeGreaterThan(DOOR_OPENING.x0);
    expect(f.x).toBeLessThan(DOOR_OPENING.x1);
    // Slight turn toward the room's centre (positive yaw looks toward -x), far less than the spawn yaw.
    expect(f.yaw).toBeGreaterThan(0);
    expect(f.yaw).toBeLessThan(HANDOFF.yaw);
  });

  it("keeps the door closed for the first 0.25 s, then opens it about 95 degrees", () => {
    expect(entranceFrame(0.24).doorAngle).toBe(0);
    expect(entranceFrame(0.5).doorAngle).toBeGreaterThan(0);
    expect(entranceFrame(1.1).doorAngle).toBeCloseTo(DOOR_OPEN_ANGLE, 6);
    expect((DOOR_OPEN_ANGLE * 180) / Math.PI).toBeGreaterThan(90);
    expect((DOOR_OPEN_ANGLE * 180) / Math.PI).toBeLessThan(100);
  });

  it("walks at about 1 m/s and the whole shot lasts 2.2 to 2.8 s", () => {
    const length = Math.hypot(START.x - HANDOFF.x, START.z - HANDOFF.z);
    expect(length / MOVE_S).toBeGreaterThan(0.95);
    expect(length / MOVE_S).toBeLessThan(1.25);
    expect(ENTRANCE_TOTAL_S).toBeGreaterThanOrEqual(2.2);
    expect(ENTRANCE_TOTAL_S).toBeLessThanOrEqual(2.8);
    expect(MOVE_START_S + MOVE_S).toBeLessThan(ENTRANCE_TOTAL_S);
  });

  it("fades up from the room's dark frame in about 0.45 s", () => {
    expect(entranceFrame(0).fade).toBe(0);
    expect(entranceFrame(0.45).fade).toBe(1);
    expect(entranceFrame(0.1).fade).toBeLessThan(0.2);
  });

  it("ends at the hand-off pose with the door closed", () => {
    const end = entranceFrame(ENTRANCE_TOTAL_S);
    expect(end).toEqual({ ...HANDOFF, doorAngle: 0, fade: 1, done: true });
    expect(DOOR_CLOSE_AT_S + DOOR_CLOSE_S).toBeLessThanOrEqual(ENTRANCE_TOTAL_S);
    expect(entranceFrame(DOOR_CLOSE_AT_S + DOOR_CLOSE_S).doorAngle).toBe(0);
    // Closing starts only once the eye is inside the wall.
    expect(entranceFrame(DOOR_CLOSE_AT_S - 0.01).z).toBeLessThan(ROOM.z1 - 0.4);
    expect(entranceFrame(DOOR_CLOSE_AT_S - 0.01).doorAngle).toBeGreaterThan(DOOR_OPEN_ANGLE * 0.99);
  });

  it("hands over exactly at the spawn used by a plain activate()", () => {
    expect(HANDOFF).toEqual({ x: 1.3, y: 1.62, z: 1.55, yaw: 0.62, pitch: -0.08 });
  });

  it("reduced motion is a plain fade at the hand-off pose", () => {
    const first = entranceFrame(0, true);
    expect(first).toMatchObject({ ...HANDOFF, doorAngle: 0, fade: 0, done: false });
    expect(entranceFrame(REDUCED_TOTAL_S / 2, true)).toMatchObject({ ...HANDOFF, doorAngle: 0, done: false });
    expect(entranceFrame(REDUCED_TOTAL_S, true)).toEqual({ ...HANDOFF, doorAngle: 0, fade: 1, done: true });
  });

  it("treats bad times as the start", () => {
    for (const t of [-1, Number.NaN, Number.NEGATIVE_INFINITY]) expect(entranceFrame(t)).toEqual(entranceFrame(0));
    expect(entranceFrame(Number.POSITIVE_INFINITY).done).toBe(true);
  });
});
