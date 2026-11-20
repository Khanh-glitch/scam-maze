import * as THREE from 'three';
import { HumanLibrary, type HumanActor, type HumanModelId } from '../khupho/world/humans';
import { loadBaoThu, loadBikeRider, type BikeRiderTemplate } from '../khupho/world/bikeRider';
import { hasProp, loadStreetFurniture, type PropKind } from '../khupho/world/streetFurniture';
import { seatBase, seats, type Point, type Solid, rect } from './sim/boarding';
import { ROUTE } from './sim/transit';

/**
 * Real models for the bus scene (replaces the blocky riders, scooters and driver of the procedural
 * version): the street NPCs and scooter riders of the neighborhood world, loaded from the same files.
 * Everything here is optional: a model that fails to load leaves its procedural stand-in in place.
 */
export interface TestBusAssets {
  humans: HumanLibrary | null;
  rider: BikeRiderTemplate | null;
  baothu: BikeRiderTemplate | null;
  /** Parked scooter models that loaded (empty = keep the procedural parked scooters). */
  parkedBikes: PropKind[];
}

const PEOPLE: HumanModelId[] = ['juno3', 'npcAlan', 'npcAlice', 'npcArthur', 'npcLinMei', 'npcNapole', 'npcSofia', 'npcYoshida', 'npcFreya', 'npcNguoiGia', 'npcBlackGuy'];
const PARKED: PropKind[] = ['bike-cg125', 'bike-supercub', 'bike-pcx'];

export async function loadTestBusAssets(): Promise<TestBusAssets> {
  const [humans, rider, baothu] = await Promise.all([
    HumanLibrary.load(PEOPLE).catch(() => null),
    loadBikeRider().catch(() => null),
    loadBaoThu().catch(() => null),
    loadStreetFurniture().catch(() => undefined),
  ]);
  return { humans, rider, baothu, parkedBikes: PARKED.filter(hasProp) };
}

const TAU = Math.PI * 2;
const turnToward = (from: number, to: number, rate: number) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + d * Math.min(1, rate);
};
const SHIRTS = [0x3d5a80, 0xb5543c, 0x5b7f5a, 0xd6c27a, 0x7a4a6a, 0xcfcfc4, 0x2f3b45];
const PANTS = [0x2c3438, 0x4a3f33, 0x1f2a3a, 0x59554c];

interface Walker {
  actor: HumanActor;
  z0: number; z1: number; x: number;
  /** +1 toward +z, -1 toward -z. */
  dir: 1 | -1;
  speed: number;
  yaw: number;
  waiting: number;
}

/** People of the scene: the driver, seated passengers, people waiting at the stops and pedestrians. */
export function buildActors(scene: THREE.Scene, bus: THREE.Object3D, assets: TestBusAssets) {
  const humans = assets.humans;
  const all: HumanActor[] = [];
  const walkers: Walker[] = [];
  const solids: Solid[] = [];
  /** Seats taken by a passenger: the player cannot sit there. */
  const occupied = new Set<string>();
  if (!humans) return { update() {}, clear: () => true, solids, occupied, walkers: [] as Walker[] };

  let n = 0;
  const pick = (ids: HumanModelId[]) => ids[n++ % ids.length];
  const outfit = () => ({ top: SHIRTS[n % SHIRTS.length], bottom: PANTS[(n >> 1) % PANTS.length] });
  const spawn = (id: HumanModelId, parent: THREE.Object3D) => {
    if (!humans.has(id)) return null;
    const actor = humans.spawn(id, outfit());
    if (!actor) return null;
    parent.add(actor.object);
    all.push(actor);
    return actor;
  };

  // Bus driver, seated behind the wheel and looking down the road (bus-local -Z).
  const driver = spawn('npcAlan', bus);
  if (driver) {
    // Seat cushion top is at y = 1.086; the pose sits 0.42 m above the actor's feet.
    driver.object.position.set(-0.652, 1.086 - 0.42, -4.62);
    driver.object.rotation.y = Math.PI;
    driver.play(driver.can('sitHigh') ? 'sitHigh' : 'idle', { fade: 0 });
  }

  // Passengers in a few seats behind the doors (the seat cushions face -Z).
  const passengerSeats = ['4A', '4B', '6B', '9A', '10B', '12A', '13B'];
  for (const id of passengerSeats) {
    const seat = seats.find((s) => s.id === id);
    if (!seat) continue;
    const actor = spawn(pick(PEOPLE.slice(1)), bus);
    if (!actor) continue;
    actor.object.position.set(seat.x, seatBase(seat.z) + 0.53 - 0.42, seat.z + 0.02);
    actor.object.rotation.y = Math.PI;
    actor.play(actor.can('sitHigh') ? 'sitHigh' : 'idle', { fade: 0 });
    occupied.add(id);
  }

  // People waiting at the two stops, under and beside the shelter.
  const waiting: [number, number, number][] = [
    [ROUTE.originZ + 0.9, 3.05, 2.2], [ROUTE.originZ + 2.6, 3.3, 1.9], [ROUTE.originZ - 1.5, 2.9, 2.6],
    [ROUTE.destinationZ + 1.1, 3.1, 2.3], [ROUTE.destinationZ - 1.2, 2.9, 2.0],
  ];
  for (const [z, x, yaw] of waiting) {
    const actor = spawn(pick(PEOPLE.slice(1)), scene);
    if (!actor) continue;
    actor.object.position.set(x, 0.167, z);
    actor.object.rotation.y = yaw;
    actor.play('idle', { fade: 0 });
    solids.push(rect(x, z, 0.5, 0.5));
  }

  // Pedestrians on the sidewalk, walking up and down their stretch (clear of both stops).
  const routes: [number, number, number][] = [[12, 48, 2.55], [-60, -16, 2.35], [-112, -66, 2.7], [16, 44, 1.75], [-54, -20, 1.8], [-180, -144, 2.4]];
  routes.forEach(([a, b, x], i) => {
    const actor = spawn(pick(PEOPLE.slice(1)), scene);
    if (!actor || !actor.can('walk')) return;
    const dir = i % 2 ? 1 : -1;
    const z = a + (b - a) * ((i * 0.37) % 1);
    actor.object.position.set(x, 0.167, z);
    actor.play('walk', { fade: 0 });
    walkers.push({ actor, z0: a, z1: b, x, dir, speed: Math.max(0.9, actor.walkSpeed || 1.3), yaw: dir > 0 ? 0 : Math.PI, waiting: 0 });
  });

  const camera = new THREE.Vector3();
  const world = new THREE.Vector3();
  return {
    solids, occupied, walkers,
    /** False when `p` is inside a pedestrian (the player cannot walk through people). */
    clear(p: Point) {
      return !walkers.some(({ actor }) => Math.abs(actor.object.position.x - p.x) < 0.42 && Math.abs(actor.object.position.z - p.z) < 0.42);
    },
    update(dt: number, player: Point, cameraPosition: THREE.Vector3) {
      camera.copy(cameraPosition);
      for (const w of walkers) {
        const p = w.actor.object.position;
        const toPlayer = (player.z - p.z) * w.dir;
        const blocked = Math.abs(player.x - p.x) < 0.8 && toPlayer > 0 && toPlayer < 1.4;
        if (blocked) { w.actor.play('idle'); }
        else {
          w.actor.play('walk');
          p.z += w.dir * w.speed * dt;
          if ((w.dir > 0 && p.z > w.z1) || (w.dir < 0 && p.z < w.z0)) w.dir = w.dir > 0 ? -1 : 1;
        }
        w.yaw = turnToward(w.yaw, w.dir > 0 ? 0 : Math.PI, dt * 6);
        w.actor.object.rotation.y = w.yaw % TAU;
      }
      for (const a of all) {
        a.object.getWorldPosition(world);
        a.update(dt, world.distanceTo(camera));
      }
    },
  };
}

export type BusActors = ReturnType<typeof buildActors>;
