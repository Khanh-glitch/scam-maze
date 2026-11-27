// Locks the shape of the open world so the numbers in `docs/product/MAP_AUDIT.md` stay true.
//
// The footprint is data (`openWorldBounds.json`); this test walks the same grid the audit script
// walks, at the same 0.5 m, and fails on a hole, a split map, an unreachable POI, a teleport-sized
// overlap between districts, or a road the minimap draws over ground nobody can stand on.
// If a change here is intentional: run `node scripts/audit-world.mjs`, then update the doc.
import { describe, expect, it } from "vitest";
import {
  OPEN_WORLD_BOUNDS,
  insideRect,
  isWithinOpenWorld,
  openWorldBoundingBox,
  rectArea,
  rectOverlapArea,
} from "./openWorldBounds";
import { SAIGON_ROADS } from "../../../chapter1/hud/saigonRoads";

const STEP = 0.5;
const rects = OPEN_WORLD_BOUNDS.rects;
const pois = OPEN_WORLD_BOUNDS.pois;
const bbox = openWorldBoundingBox();
const key = (i: number, j: number) => `${i},${j}`;
const toCell = (x: number, z: number): [number, number] => [
  Math.floor((x - bbox.x0) / STEP),
  Math.floor((z - bbox.z0) / STEP),
];

// One grid shared by the tests below.
const cells = new Set<string>();
for (let x = bbox.x0; x < bbox.x1; x += STEP) {
  for (let z = bbox.z0; z < bbox.z1; z += STEP) {
    if (isWithinOpenWorld(x + STEP / 2, z + STEP / 2)) cells.add(key(...toCell(x, z)));
  }
}
const walkableAreaM2 = cells.size * STEP * STEP;

/** Breadth-first walk over the grid from one cell, returning distance in cells per visited cell. */
function flood(startCell: [number, number]): Map<string, number> {
  const dist = new Map<string, number>([[key(...startCell), 0]]);
  const queue: [number, number][] = [startCell];
  for (let head = 0; head < queue.length; head += 1) {
    const [i, j] = queue[head];
    const d = dist.get(key(i, j)) as number;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nb = key(i + di, j + dj);
      if (!cells.has(nb) || dist.has(nb)) continue;
      dist.set(nb, d + 1);
      queue.push([i + di, j + dj]);
    }
  }
  return dist;
}

const nearestCell = (x: number, z: number): [number, number] | null => {
  const [i0, j0] = toCell(x, z);
  if (cells.has(key(i0, j0))) return [i0, j0];
  for (let rad = 1; rad < 40; rad += 1) {
    for (let di = -rad; di <= rad; di += 1) {
      for (let dj = -rad; dj <= rad; dj += 1) {
        if (cells.has(key(i0 + di, j0 + dj))) return [i0 + di, j0 + dj];
      }
    }
  }
  return null;
};

const roomCell = nearestCell(22, -16.8) as [number, number];
const fromRoom = flood(roomCell);

describe("open world footprint", () => {
  it("is 186 x 448 m — the box quoted in the docs", () => {
    expect(bbox.width).toBe(186);
    expect(bbox.depth).toBe(448);
    expect((bbox.width * bbox.depth) / 1e6).toBeCloseTo(0.0833, 4);
  });

  it("is 0.0364 km² of walkable ground, 43.7% of that box", () => {
    // Fair band, not a snapshot: an edit that moves more than ~1% of the map must come with a
    // fresh audit and a doc update, which is exactly the drift this test is here to stop.
    expect(walkableAreaM2).toBeGreaterThan(35_500);
    expect(walkableAreaM2).toBeLessThan(37_500);
    const share = (100 * walkableAreaM2) / (bbox.width * bbox.depth);
    expect(share).toBeGreaterThan(42);
    expect(share).toBeLessThan(45);
  });

  it("has no split-off islands", () => {
    expect(fromRoom.size).toBe(cells.size);
  });

  it("does not stack districts on top of each other", () => {
    let overlap = 0;
    for (let a = 0; a < rects.length; a += 1) {
      for (let b = a + 1; b < rects.length; b += 1) overlap += rectOverlapArea(rects[a], rects[b]);
    }
    // 1,750 m² of intentional overlap at the junctions; more than that is double-counted area and a
    // footprint that no longer matches the geometry.
    expect(overlap).toBeLessThan(2_500);
    expect(rects.reduce((sum, rect) => sum + rectArea(rect), 0) - walkableAreaM2).toBeLessThan(2_500);
  });

  it("has rectangles with real area and unique ids", () => {
    expect(new Set(rects.map((r) => r.id)).size).toBe(rects.length);
    for (const rect of rects) {
      expect(rectArea(rect)).toBeGreaterThan(100);
      expect(rect.x0).toBeLessThan(rect.x1);
      expect(rect.z0).toBeLessThan(rect.z1);
    }
  });
});

describe("points of interest", () => {
  it("sits inside the footprint, not on its edge", () => {
    for (const poi of pois) {
      expect(isWithinOpenWorld(poi.x, poi.z), `${poi.id} nằm ngoài vùng đi được`).toBe(true);
      const inset = rects.some((rect) => insideRect(rect, poi.x, poi.z) && poi.x - rect.x0 >= 0.4 && rect.x1 - poi.x >= 0.4 && poi.z - rect.z0 >= 0.4 && rect.z1 - poi.z >= 0.4);
      expect(inset, `${poi.id} dính sát mép vùng đi được`).toBe(true);
    }
  });

  it("is reachable on foot from room 6.07, within a walk a player will accept", () => {
    for (const poi of pois) {
      const cell = nearestCell(poi.x, poi.z);
      expect(cell, `${poi.id} không có ô đi được nào`).not.toBeNull();
      const distance = fromRoom.get(key(...(cell as [number, number])));
      expect(distance, `${poi.id} không tới được từ phòng 6.07`).toBeDefined();
      expect((distance as number) * STEP, `${poi.id} quá xa`).toBeLessThan(600);
    }
  });

  it("keeps the room-to-landmark trip honest (< 400 m, i.e. under 5 minutes at 1.4 m/s)", () => {
    const landmark = pois.find((poi) => poi.id === "landmark81");
    expect(landmark).toBeDefined();
    const cell = nearestCell(landmark!.x, landmark!.z) as [number, number];
    const metres = (fromRoom.get(key(...cell)) as number) * STEP;
    expect(metres).toBeGreaterThan(300);
    expect(metres).toBeLessThan(400);
  });
});

describe("roads the minimap draws", () => {
  it("is the documented street network", () => {
    expect(SAIGON_ROADS.length).toBe(8);
  });

  it("never leaves the walkable footprint for more than 3 m", () => {
    for (const road of SAIGON_ROADS) {
      const length = Math.hypot(road.x1 - road.x0, road.z1 - road.z0);
      const steps = Math.max(1, Math.ceil(length / 0.5));
      let run = 0;
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const x = road.x0 + (road.x1 - road.x0) * t;
        const z = road.z0 + (road.z1 - road.z0) * t;
        if (isWithinOpenWorld(x, z)) {
          run = 0;
        } else {
          run += length / steps;
          expect(run, `${road.kind} (${road.x0},${road.z0})→(${road.x1},${road.z1}) bị chặn ${run.toFixed(1)} m`).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it("never draws asphalt through the Landmark 81 tower base", () => {
    // The tower's paver slab, from `saigonDistricts`: 64 x 62 m centred on (26, -356).
    const tower = { x0: 26 - 32, x1: 26 + 32, z0: -356 - 31, z1: -356 + 31 };
    for (const road of SAIGON_ROADS) {
      const length = Math.hypot(road.x1 - road.x0, road.z1 - road.z0);
      const steps = Math.max(1, Math.ceil(length / 0.5));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const x = road.x0 + (road.x1 - road.x0) * t;
        const z = road.z0 + (road.z1 - road.z0) * t;
        const insideTower = x > tower.x0 && x < tower.x1 && z > tower.z0 && z < tower.z1;
        expect(insideTower, `${road.kind} chạy qua chân tháp Landmark 81 tại (${x}, ${z})`).toBe(false);
      }
    }
  });
});
