import { passages } from './q10-plan';
import { clamp, type BusRouteController, type DoorId } from './transit';

export type Point = { x: number; z: number };
export type Solid = { x0: number; x1: number; z0: number; z1: number };
export type PassengerSeat = { id: string; x: number; z: number; aisleZ: number };

export const HALF = 1.25;
export const LENGTH = 5.52;
export const EYE = 1.65;
export const RADIUS = 0.235;
export const CURB_HEIGHT = 0.16;
export const BUS_FLOOR = 0.62;
export const BUS_DOORS: Record<DoorId, { min: number; max: number }> = {
  front: { min: -5.21, max: -3.70 },
  rear: { min: 0.33, max: 1.80 },
};
export const DOOR_IDS = ['front', 'rear'] as const;
export const STOP_SIGN = { x: 1.87, z: -5.67 };
export const ROUTE_BOARD = { x: 3.91, z: -1.48 };
export const VALIDATOR = { x: 0.49, z: -3.51 };
export const START = { x: 2.45, z: -8.65, yaw: 2.67 };

export function rect(x: number, z: number, width: number, depth: number): Solid {
  return { x0: x - width / 2, x1: x + width / 2, z0: z - depth / 2, z1: z + depth / 2 };
}

const gap = (a: number, b: number) => rect(HALF, (a + b) / 2, 0.125, b - a);
const body = [
  rect(-HALF, 0, 0.13, 2 * LENGTH), rect(0, -LENGTH, 2.50, 0.12), rect(0, LENGTH, 2.50, 0.12),
  gap(-LENGTH, BUS_DOORS.front.min), gap(BUS_DOORS.front.max, BUS_DOORS.rear.min), gap(BUS_DOORS.rear.max, LENGTH),
  rect(-0.716, -4.76, 0.88, 1.42), rect(-0.57, -5.24, 1.05, 0.37),
  rect(0.98, -2.85, 0.43, 0.95), rect(-0.98, -2.85, 0.43, 0.95),
];

const seatRows: [number, number][] = [[-1, -2.89], [-1, -1.91], [-1, -0.89], [1, -1.67], [1, -0.66], [-1, 0.31], [-1, 1.32], [-1, 2.47], [1, 2.47], [-1, 3.51], [1, 3.51], [-1, 4.62], [1, 4.62]];
export const seats: PassengerSeat[] = seatRows.flatMap(([side, z], i) => [0.604, 1.004].map((x, j) => ({ id: `${i + 1}${j === 0 ? 'A' : 'B'}`, x: x * side, z, aisleZ: z - 0.36 })));
for (const [side, z] of seatRows) body.push(rect(side * 0.799, z + 0.015, 0.79, 0.52));
for (const side of [-1, 1]) for (const z of [-3.47, -1.93, -0.96, 0.28, 1.86, 3.13, 4.16, 5.04]) {
  if (side !== 1 || z !== 0.28) body.push(rect(side * 0.447, z, 0.055, 0.055));
}
body.push(rect(VALIDATOR.x, VALIDATOR.z, 0.082, 0.081));

export function toLocal(p: Point, bus: Point & { yaw: number }): Point {
  const c = Math.cos(bus.yaw), s = Math.sin(bus.yaw), x = p.x - bus.x, z = p.z - bus.z;
  return { x: c * x - s * z, z: s * x + c * z };
}

export function toWorld(p: Point, bus: Point & { yaw: number }): Point {
  const c = Math.cos(bus.yaw), s = Math.sin(bus.yaw);
  return { x: bus.x + c * p.x + s * p.z, z: bus.z - s * p.x + c * p.z };
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const isInside = (p: Point) => Math.abs(p.x) < HALF - 0.012 && Math.abs(p.z) < LENGTH;
export const deck = (z: number) => z > 2.40 ? 0.92 : z > 2.03 ? 0.77 : BUS_FLOOR;
export const seatBase = (z: number) => deck(z) + (z < -2.70 ? 0.32 : 0);
export const ROAD_WIDTH = 12.8;
export const sidewalkAt = (p: Point) => p.x >= 0 || p.x <= -ROAD_WIDTH;
export const inDoorArc = (p: Point, door: DoorId) => {
  const { min, max } = BUS_DOORS[door];
  return p.x > 0.79 && p.x < 1.65 && p.z > min - 0.14 && p.z < max + 0.14;
};

export function floorAt(p: Point, local: Point) {
  if (DOOR_IDS.some((id) => local.z > BUS_DOORS[id].min + 0.02 && local.z < BUS_DOORS[id].max - 0.02) && local.x > 0.82 && local.x < 1.42) {
    return local.x > 1.10 ? 0.32 : 0.47;
  }
  if (isInside(local)) return deck(local.z);
  return sidewalkAt(p) ? CURB_HEIGHT : 0;
}

function hits(p: Point, solid: Solid) {
  const x = clamp(p.x, solid.x0, solid.x1), z = clamp(p.z, solid.z0, solid.z1);
  return (p.x - x) ** 2 + (p.z - z) ** 2 < RADIUS ** 2;
}

export function blocksBus(p: Point, route: BusRouteController) {
  if (Math.abs(p.x) > 1.68 || Math.abs(p.z) > LENGTH + 0.45) return false;
  if (body.some((wall) => hits(p, wall))) return true;
  return DOOR_IDS.some((id) => {
    const d = BUS_DOORS[id];
    if (!route.doors[id].passable || route.phase === 'departing' || route.phase === 'driving' || route.phase === 'approaching') return hits(p, gap(d.min, d.max));
    // Plug-slide leaves sit outboard against the adjacent glazing when open.
    const width = (d.max - d.min) / 2;
    const edge = (1 - route.doors[id].amount) * width;
    return hits(p, rect(1.33, d.min - width / 2 + edge, 0.07, width)) || hits(p, rect(1.33, d.max + width / 2 - edge, 0.07, width));
  });
}

export class BusBoardingController {
  position: Point = { x: START.x, z: START.z };
  onboard = false;
  seat: PassengerSeat | null = null;
  private exitedAtDestination = false;

  readonly route: BusRouteController;
  readonly street: Solid[];
  private trafficClear: (p: Point) => boolean;
  constructor(route: BusRouteController, street: Solid[], trafficClear: (p: Point) => boolean = () => true) {
    this.route = route; this.street = street; this.trafficClear = trafficClear;
  }

  get local() { return toLocal(this.position, this.route); }

  carry(local: Point) {
    if (this.onboard) this.position = toWorld(local, this.route);
  }

  move(x: number, z: number) {
    if (this.seat) return;
    const increments = Math.max(1, Math.ceil(Math.hypot(x, z) / 0.065));
    for (let i = 0; i < increments; i++) {
      this.tryMove(x / increments, 0);
      this.tryMove(0, z / increments);
    }
    const now = isInside(this.local);
    if (this.onboard !== now) {
      this.onboard = now;
      this.exitedAtDestination = !now && this.route.phase === 'arrived';
      this.route.passengerCrossed(now, this.exitedAtDestination && this.position.x >= 0.05);
    }
    if (this.exitedAtDestination && this.position.x >= 0.05) this.route.reachSidewalk();
  }

  private tryMove(x: number, z: number) {
    if (!x && !z) return;
    const next = { x: this.position.x + x, z: this.position.z + z };
    // Local access only inside the two residential passages (party-wall colliders still apply).
    const passage = passages.find(p => next.z > p.start && next.z < p.end);
    if (next.x < -ROAD_WIDTH - (passage?.side===-1?10.9:4.3) || next.x > (passage?.side===1?11.75:6.2) || next.z < -161 || next.z > 41) return;
    if (!this.onboard && (!this.trafficClear(next) || this.street.some((solid) => hits(next, solid)))) return;
    if (blocksBus(toLocal(next, this.route), this.route)) return;
    this.position = next;
  }

  sit(seat: PassengerSeat) {
    if (!this.onboard || this.seat) return false;
    const local = this.local;
    if (Math.abs(local.x) > 0.38 || Math.abs(local.z - seat.aisleZ) > 0.78) return false;
    const egress = { x: 0, z: seat.aisleZ };
    if (blocksBus(egress, this.route)) return false;
    this.seat = seat;
    this.position = toWorld({ x: seat.x, z: seat.z - 0.10 }, this.route);
    return true;
  }

  stand() {
    if (!this.seat) return;
    this.position = toWorld({ x: 0, z: this.seat.aisleZ }, this.route);
    this.seat = null;
  }
}