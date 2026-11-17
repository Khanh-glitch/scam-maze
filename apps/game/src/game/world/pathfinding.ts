// Grid path finding for the quest guide trail. Pure TypeScript (no three): the world supplies a
// walkability test, this module builds the grid once and finds smooth paths on it.

export interface NavGrid {
  /** Cell size (m). */
  cell: number;
  /** World position of the grid's corner. */
  x0: number;
  z0: number;
  w: number;
  h: number;
  /** 1 = walkable, 0 = blocked. Index = iz * w + ix. */
  walk: Uint8Array;
}

export interface Point {
  x: number;
  z: number;
  /** Height, when the path climbs (stairs); carried through resampling. */
  y?: number;
}

/** Samples `isWalkable` at the center of every cell. */
export function buildGrid(x0: number, z0: number, x1: number, z1: number, cell: number, isWalkable: (x: number, z: number) => boolean): NavGrid {
  const w = Math.ceil((x1 - x0) / cell);
  const h = Math.ceil((z1 - z0) / cell);
  const walk = new Uint8Array(w * h);
  for (let iz = 0; iz < h; iz++) {
    for (let ix = 0; ix < w; ix++) walk[iz * w + ix] = isWalkable(x0 + (ix + 0.5) * cell, z0 + (iz + 0.5) * cell) ? 1 : 0;
  }
  return { cell, x0, z0, w, h, walk };
}

const inside = (g: NavGrid, ix: number, iz: number) => ix >= 0 && iz >= 0 && ix < g.w && iz < g.h;
const cellX = (g: NavGrid, x: number) => Math.floor((x - g.x0) / g.cell);
const cellZ = (g: NavGrid, z: number) => Math.floor((z - g.z0) / g.cell);

/** Index of the walkable cell nearest to (x, z), searching rings up to `maxRing` cells out; -1 when none. */
export function nearestWalkable(g: NavGrid, x: number, z: number, maxRing = 12): number {
  const cx = Math.min(g.w - 1, Math.max(0, cellX(g, x)));
  const cz = Math.min(g.h - 1, Math.max(0, cellZ(g, z)));
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r <= maxRing; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ix = cx + dx, iz = cz + dz;
        if (!inside(g, ix, iz) || !g.walk[iz * g.w + ix]) continue;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = iz * g.w + ix; }
      }
    }
    // A hit in ring r can still lose to a diagonal cell of ring r + 1 only by a hair; stop at the first ring with a hit.
    if (best >= 0) break;
  }
  return best;
}

/** Binary min-heap of cell indices ordered by `score`. */
class Heap {
  private items: number[] = [];
  private score: Float32Array;
  constructor(score: Float32Array) {
    this.score = score;
  }
  get size() { return this.items.length; }
  push(i: number) {
    const a = this.items;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.score[a[p]] <= this.score[a[k]]) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop() as number;
    if (a.length) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < a.length && this.score[a[l]] < this.score[a[m]]) m = l;
        if (r < a.length && this.score[a[r]] < this.score[a[m]]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top;
  }
}

const STEPS: readonly [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** True when the straight segment between two world points only crosses walkable cells. */
export function lineWalkable(g: NavGrid, a: Point, b: Point): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / (g.cell * 0.5)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ix = cellX(g, a.x + (b.x - a.x) * t), iz = cellZ(g, a.z + (b.z - a.z) * t);
    if (!inside(g, ix, iz) || !g.walk[iz * g.w + ix]) return false;
  }
  return true;
}

/** Shortest walkable path between two world points, smoothed; null when the grid has no route. */
export function findPath(g: NavGrid, from: Point, to: Point): Point[] | null {
  const s = nearestWalkable(g, from.x, from.z);
  const e = nearestWalkable(g, to.x, to.z);
  if (s < 0 || e < 0) return null;
  const n = g.w * g.h;
  const gScore = new Float32Array(n).fill(Infinity);
  const f = new Float32Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const ex = e % g.w, ez = (e / g.w) | 0;
  const h = (i: number) => Math.hypot((i % g.w) - ex, ((i / g.w) | 0) - ez);
  const open = new Heap(f);
  gScore[s] = 0;
  f[s] = h(s);
  open.push(s);
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    if (cur === e) break;
    closed[cur] = 1;
    const cx = cur % g.w, cz = (cur / g.w) | 0;
    for (const [dx, dz, cost] of STEPS) {
      const nx = cx + dx, nz = cz + dz;
      if (!inside(g, nx, nz)) continue;
      const ni = nz * g.w + nx;
      if (!g.walk[ni] || closed[ni]) continue;
      // No corner cutting between two blocked cells.
      if (dx !== 0 && dz !== 0 && (!g.walk[cz * g.w + nx] || !g.walk[nz * g.w + cx])) continue;
      const ng = gScore[cur] + cost;
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        f[ni] = ng + h(ni);
        parent[ni] = cur;
        open.push(ni);
      }
    }
  }
  if (s !== e && parent[e] < 0) return null;
  const cells: Point[] = [];
  for (let i = e; i >= 0; i = parent[i]) {
    cells.push({ x: g.x0 + ((i % g.w) + 0.5) * g.cell, z: g.z0 + (((i / g.w) | 0) + 0.5) * g.cell });
    if (i === s) break;
  }
  cells.reverse();
  // The path starts and ends at the real points, then is pulled straight where the way is clear.
  const pts: Point[] = [{ x: from.x, z: from.z }, ...cells, { x: to.x, z: to.z }];
  const out: Point[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineWalkable(g, pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** Total length (m) of a polyline. */
export function pathLength(path: readonly Point[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  return len;
}

/** Points along a polyline every `step` meters (first and last included), with the distance from the start. */
export function resamplePath(path: readonly Point[], step: number): { x: number; z: number; y?: number; d: number }[] {
  const out: { x: number; z: number; y?: number; d: number }[] = [];
  if (!path.length) return out;
  let d = 0;
  out.push({ ...path[0], d: 0 });
  let next = step;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    while (seg > 0 && next <= d + seg) {
      const t = (next - d) / seg;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ...(a.y !== undefined && b.y !== undefined ? { y: a.y + (b.y - a.y) * t } : {}), d: next });
      next += step;
    }
    d += seg;
  }
  const last = path[path.length - 1];
  if (out[out.length - 1].d < d - 1e-6) out.push({ ...last, d });
  return out;
}

/** The path without its last `meters`, so a trail stops short of the person it leads to. */
export function trimEnd(path: readonly Point[], meters: number): Point[] {
  const total = pathLength(path);
  if (total <= meters + 0.1) return path.slice(0, 1) as Point[];
  const target = total - meters;
  const out: Point[] = [path[0]];
  let d = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (d + seg >= target) {
      const t = seg > 0 ? (target - d) / seg : 0;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ...(a.y !== undefined && b.y !== undefined ? { y: a.y + (b.y - a.y) * t } : {}) });
      return out;
    }
    out.push(b);
    d += seg;
  }
  return out;
}
