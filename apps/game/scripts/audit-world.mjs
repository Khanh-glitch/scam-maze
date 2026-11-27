#!/usr/bin/env node
// World audit: reads the same footprint data the game walks on (`openWorldBounds.json`) plus the
// roads the minimap draws (`saigonRoads.ts`), measures the map, and renders a top-down plan to
// `docs/product/audit/`. Exits non-zero on a hole, a split map, an unreachable POI or a drawn road
// with no ground under it.
//
//   node scripts/audit-world.mjs           # measure + write SVG/PNG/JSON
//   node scripts/audit-world.mjs --no-png  # SVG + JSON only
//
// The numbers it prints are the ones the docs must quote. Nothing here touches the 3D renderer: this
// is a plan view built from the map's own data, used to catch holes, dead pockets and drawn-but-
// blocked roads before they reach a player.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repo = path.resolve(root, "..", "..");
const outDir = path.join(repo, "docs/product/audit");

const bounds = JSON.parse(readFileSync(path.join(root, "src/features/testbus/openworld/world/openWorldBounds.json"), "utf8"));
const roadSource = readFileSync(path.join(root, "src/features/chapter1/hud/saigonRoads.ts"), "utf8");
const rects = bounds.rects;
const pois = bounds.pois;

const inside = (x, z) => rects.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
const bbox = {
  x0: Math.min(...rects.map((r) => r.x0)),
  x1: Math.max(...rects.map((r) => r.x1)),
  z0: Math.min(...rects.map((r) => r.z0)),
  z1: Math.max(...rects.map((r) => r.z1)),
};

// --- Walkable grid (0.5 m): area, connectivity, paths -------------------------------------------
const STEP = 0.5;
const nx = Math.round((bbox.x1 - bbox.x0) / STEP);
const nz = Math.round((bbox.z1 - bbox.z0) / STEP);
const cells = new Set();
const key = (i, j) => i * 100000 + j;
for (let i = 0; i < nx; i += 1) {
  for (let j = 0; j < nz; j += 1) {
    const x = bbox.x0 + (i + 0.5) * STEP;
    const z = bbox.z0 + (j + 0.5) * STEP;
    if (inside(x, z)) cells.add(key(i, j));
  }
}
const cellX = (i) => bbox.x0 + (i + 0.5) * STEP;
const cellZ = (j) => bbox.z0 + (j + 0.5) * STEP;
const toCell = (x, z) => [Math.floor((x - bbox.x0) / STEP), Math.floor((z - bbox.z0) / STEP)];
const nearestCell = (x, z) => {
  const [i0, j0] = toCell(x, z);
  if (cells.has(key(i0, j0))) return [i0, j0];
  for (let rad = 1; rad < 60; rad += 1) {
    for (let di = -rad; di <= rad; di += 1) {
      for (let dj = -rad; dj <= rad; dj += 1) {
        if (cells.has(key(i0 + di, j0 + dj))) return [i0 + di, j0 + dj];
      }
    }
  }
  return null;
};

// Components.
const seen = new Set();
const components = [];
for (const cell of cells) {
  if (seen.has(cell)) continue;
  const queue = [cell];
  seen.add(cell);
  let size = 0;
  while (queue.length) {
    const current = queue.pop();
    size += 1;
    const i = Math.floor(current / 100000);
    const j = current - i * 100000;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = key(i + di, j + dj);
      if (cells.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  components.push(size);
}

// BFS with parents, from the room.
const start = nearestCell(22, -16.8);
const dist = new Map([[key(...start), 0]]);
const parent = new Map();
const queue = [start];
const startKey = key(...start);
const parents = new Map();
while (queue.length) {
  const [i, j] = queue.shift();
  const d = dist.get(key(i, j));
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nk = key(i + di, j + dj);
    if (!cells.has(nk) || dist.has(nk)) continue;
    dist.set(nk, d + 1);
    parents.set(nk, key(i, j));
    queue.push([i + di, j + dj]);
  }
}
const pathTo = (x, z) => {
  const target = nearestCell(x, z);
  if (!target) return null;
  let k = key(...target);
  if (!dist.has(k)) return null;
  const points = [];
  while (k !== undefined && k !== startKey) {
    const i = Math.floor(k / 100000);
    const j = k - i * 100000;
    points.push([cellX(i), cellZ(j)]);
    k = parents.get(k);
  }
  points.reverse();
  return points;
};

const poiCells = pois.map((p) => ({ ...p, cell: nearestCell(p.x, p.z) }));
const reach = Object.fromEntries(
  poiCells.map((p) => {
    const d = dist.get(key(...p.cell));
    return [p.id, d === undefined ? null : { metres: Math.round(d * STEP), minutes: +(d * STEP / bounds.walkSpeedMetresPerSecond / 60).toFixed(1) }];
  }),
);
// Nearest-POI walking distance (multi-source BFS from every POI): how much of the map is worth
// standing on. 1.4 m/s → 45 s of walking is 63 m.
const poiDist = new Map();
{
  const q = [];
  for (const p of poiCells) {
    const c = p.cell;
    if (!c) continue;
    const k = key(...c);
    if (!poiDist.has(k)) {
      poiDist.set(k, 0);
      q.push(c);
    }
  }
  for (let head = 0; head < q.length; head += 1) {
    const [i, j] = q[head];
    const d = poiDist.get(key(i, j));
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = key(i + di, j + dj);
      if (!cells.has(nk) || poiDist.has(nk)) continue;
      poiDist.set(nk, d + 1);
      q.push([i + di, j + dj]);
    }
  }
}
const poiMetres = [...poiDist.values()].map((d) => d * STEP);
const coveredWithin = (metres) => poiMetres.filter((d) => d <= metres).length * STEP * STEP;
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const FORTY_FIVE_SECONDS_M = 45 * bounds.walkSpeedMetresPerSecond;

const farthest = [...dist.entries()].reduce((best, [k, d]) => (d > best.d ? { k, d } : best), { k: null, d: 0 });

// Rect adjacency (edges where rectangles share a boundary or overlap).
const shares = (a, b) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const d = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  return (w > 0 && d >= 0) || (d > 0 && w >= 0);
};
const edges = [];
for (let i = 0; i < rects.length; i += 1) {
  for (let j = i + 1; j < rects.length; j += 1) {
    if (shares(rects[i], rects[j])) edges.push([rects[i].id, rects[j].id]);
  }
}

// --- Roads the minimap draws ----------------------------------------------------------------
const roadsBlock = roadSource.split("export const SAIGON_ROADS")[1]?.split("];")[0] ?? "";
const roads = [...roadsBlock.matchAll(/\{\s*x0:\s*(-?[\d.]+),\s*z0:\s*(-?[\d.]+),\s*x1:\s*(-?[\d.]+),\s*z1:\s*(-?[\d.]+),\s*widthM:\s*([\d.]+),\s*kind:\s*"(\w+)"/g)].map((m) => ({
  x0: +m[1],
  z0: +m[2],
  x1: +m[3],
  z1: +m[4],
  width: +m[5],
  kind: m[6],
}));

// Drawn road, blocked ground: sample the centreline; a gap longer than 3 m is a defect.
const blockedRuns = [];
for (const road of roads) {
  const length = Math.hypot(road.x1 - road.x0, road.z1 - road.z0);
  const steps = Math.ceil(length / 0.5);
  let runStart = null;
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const x = road.x0 + (road.x1 - road.x0) * t;
    const z = road.z0 + (road.z1 - road.z0) * t;
    const ok = inside(x, z);
    if (!ok && runStart === null) runStart = t;
    if (ok && runStart !== null) {
      const from = { x: road.x0 + (road.x1 - road.x0) * runStart, z: road.z0 + (road.z1 - road.z0) * runStart };
      const to = { x, z };
      const gap = Math.hypot(to.x - from.x, to.z - from.z);
      if (gap > 3) blockedRuns.push({ road: road.kind, from, to, metres: +gap.toFixed(1) });
      runStart = null;
    }
  }
  if (runStart !== null) {
    const from = { x: road.x0 + (road.x1 - road.x0) * runStart, z: road.z0 + (road.z1 - road.z0) * runStart };
    const to = { x: road.x1, z: road.z1 };
    const gap = Math.hypot(to.x - from.x, to.z - from.z);
    if (gap > 3) blockedRuns.push({ road: road.kind, from, to, metres: +gap.toFixed(1) });
  }
}

// --- Metrics -----------------------------------------------------------------------------------
const walkableArea = cells.size * STEP * STEP;
const bboxArea = (bbox.x1 - bbox.x0) * (bbox.z1 - bbox.z0);
const rectAreaSum = rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
const metrics = {
  generatedAt: new Date().toISOString(),
  units: bounds.units,
  bbox: {
    x0: bbox.x0,
    x1: bbox.x1,
    z0: bbox.z0,
    z1: bbox.z1,
    width: bbox.x1 - bbox.x0,
    depth: bbox.z1 - bbox.z0,
    areaKm2: +(bboxArea / 1e6).toFixed(4),
  },
  walkable: {
    areaM2: Math.round(walkableArea),
    areaKm2: +(walkableArea / 1e6).toFixed(4),
    percentOfBbox: +((100 * walkableArea) / bboxArea).toFixed(1),
    components: components.length,
    largestComponentM2: Math.round(Math.max(...components) * STEP * STEP),
    rectAreaSumM2: Math.round(rectAreaSum),
    doubleCountedM2: Math.round(rectAreaSum - walkableArea),
  },
  rectGraph: { nodes: rects.length, edges: edges.length, cycleRank: edges.length - rects.length + 1, edges },
  pois: reach,
  farthestFromRoomMetres: Math.round(farthest.d * STEP),
  poiDensityPerKm2: +((pois.length / (walkableArea / 1e6))).toFixed(1),
  meanPoiSpacingMetres: +Math.sqrt(walkableArea / pois.length).toFixed(0),
  poiCoverage: {
    fortyFiveSecondsMetres: +FORTY_FIVE_SECONDS_M.toFixed(1),
    within30mM2: Math.round(coveredWithin(30)),
    within45sM2: Math.round(coveredWithin(FORTY_FIVE_SECONDS_M)),
    within90mM2: Math.round(coveredWithin(90)),
    pctWithin45s: +((100 * coveredWithin(FORTY_FIVE_SECONDS_M)) / walkableArea).toFixed(0),
    uncoveredM2: Math.round(walkableArea - coveredWithin(FORTY_FIVE_SECONDS_M)),
    medianNearestPoiMetres: +median(poiMetres).toFixed(1),
    meanNearestPoiMetres: +(poiMetres.reduce((a, b) => a + b, 0) / poiMetres.length).toFixed(1),
    worstNearestPoiMetres: +poiMetres.reduce((a, b) => Math.max(a, b), 0).toFixed(1),
  },
  roads: { count: roads.length, blockedRuns },
};

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "openworld-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);

// --- SVG plan -----------------------------------------------------------------------------------
const SCALE = 2; // px per metre
const pad = 34;
const top = 58; // room for the title block above the map
const W = Math.round((bbox.x1 - bbox.x0) * SCALE) + pad * 2;
const H = Math.round((bbox.z1 - bbox.z0) * SCALE) + top + pad + 30;
const sx = (x) => (x - bbox.x0) * SCALE + pad;
const sy = (z) => (z - bbox.z0) * SCALE + top;
const lines = [];
lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, sans-serif">`);
lines.push(`<rect width="${W}" height="${H}" fill="#0f0e16"/>`);
lines.push(`<text x="${pad}" y="24" fill="#e7e3f5" font-size="13" font-weight="600">SCAMMAZE · Sài Gòn mở — bản đồ đo được</text>`);
lines.push(`<text x="${pad}" y="39" fill="#7f7899" font-size="9.5">1 px = 0.5 m · dựng từ openWorldBounds.json</text>`);

// Footprint: neutral, so the red "walking for nothing" wash reads clearly on top.
for (const r of rects) {
  lines.push(
    `<rect x="${sx(r.x0)}" y="${sy(r.z0)}" width="${(r.x1 - r.x0) * SCALE}" height="${(r.z1 - r.z0) * SCALE}" fill="#232a3a" stroke="#46527a" stroke-width="1"/>`,
  );
}

// Uncovered ground: walkable area further than 45 s of walking from the nearest POI. Run-length
// merged per 2 m row so the SVG stays small.
const HEAT = 2;
const heatRows = [];
for (let z = bbox.z0; z < bbox.z1; z += HEAT) {
  let runStart = null;
  for (let x = bbox.x0; x <= bbox.x1; x += HEAT) {
    const px = x + HEAT / 2;
    const pz = z + HEAT / 2;
    if (!inside(px, pz)) {
      if (runStart !== null) {
        heatRows.push({ x: runStart, z, w: px - runStart });
        runStart = null;
      }
      continue;
    }
    const far = (poiDist.get(key(...toCell(px, pz))) ?? Infinity) * STEP > FORTY_FIVE_SECONDS_M;
    if (far && runStart === null) runStart = x;
    if (!far && runStart !== null) {
      heatRows.push({ x: runStart, z, w: x - runStart });
      runStart = null;
    }
  }
  if (runStart !== null) heatRows.push({ x: runStart, z, w: bbox.x1 - runStart });
}
for (const row of heatRows) {
  lines.push(
    `<rect x="${sx(row.x)}" y="${sy(row.z)}" width="${row.w * SCALE}" height="${HEAT * SCALE}" fill="#f87171" fill-opacity="0.16"/>`,
  );
}

// Roads the minimap draws (on top of the footprint, so a road with no ground under it is visible).
for (const r of roads) {
  lines.push(
    `<line x1="${sx(r.x0)}" y1="${sy(r.z0)}" x2="${sx(r.x1)}" y2="${sy(r.z1)}" stroke="#5b5a70" stroke-width="${Math.max(2, r.width * SCALE)}" stroke-linecap="butt" opacity="0.55"/>`,
  );
}

// Routes.
const routes = [
  { poi: "landmark81", color: "#a78bfa" },
  { poi: "bitexco", color: "#38bdf8" },
];
for (const route of routes) {
  const poi = pois.find((p) => p.id === route.poi);
  const path = pathTo(poi.x, poi.z);
  if (!path || path.length < 2) continue;
  const simplified = path.filter((_, index) => index % 6 === 0 || index === path.length - 1);
  const d = simplified.map(([x, z], index) => `${index === 0 ? "M" : "L"}${sx(x).toFixed(1)} ${sy(z).toFixed(1)}`).join(" ");
  lines.push(`<path d="${d}" fill="none" stroke="${route.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>`);
}
// Blocked runs on drawn roads.
for (const run of blockedRuns) {
  lines.push(
    `<line x1="${sx(run.from.x)}" y1="${sy(run.from.z)}" x2="${sx(run.to.x)}" y2="${sy(run.to.z)}" stroke="#f87171" stroke-width="4" stroke-dasharray="4 3"/>`,
  );
  lines.push(
    `<text x="${sx((run.from.x + run.to.x) / 2) + 5}" y="${sy((run.from.z + run.to.z) / 2) - 5}" fill="#fca5a5" font-size="10">tường vô hình ${run.metres} m</text>`,
  );
}
// POIs.
for (const p of pois) {
  lines.push(`<circle cx="${sx(p.x)}" cy="${sy(p.z)}" r="4.5" fill="#fde68a" stroke="#1b1725" stroke-width="1.5"/>`);
  const flip = p.x > (bbox.x0 + bbox.x1) / 2;
  lines.push(
    `<text x="${sx(p.x) + (flip ? -7 : 7)}" y="${sy(p.z) + 4}" fill="#f5f1e8" font-size="10" text-anchor="${flip ? "end" : "start"}">${p.name}</text>`,
  );
}
// Labels: one per rectangle. Tall thin strips get a rotated label down their middle; squat ones get a
// two-line label kept inside the shape; anything that would collide is nudged or dropped.
const placed = [];
const collides = (x, y, w) => placed.some((p) => Math.abs(p.x - x) < (w + p.w) / 2 + 4 && Math.abs(p.y - y) < 12);
for (const r of rects) {
  const w = (r.x1 - r.x0) * SCALE;
  const h = (r.z1 - r.z0) * SCALE;
  const name = r.name ?? r.id;
  if (w * h < 90) continue;
  if (h > w * 1.8) {
    const cx = sx(r.x0) + 12;
    const cz = sy(r.z0) + h / 2;
    const text = `${name}`;
    lines.push(
      `<text x="${cx}" y="${cz}" fill="#8f96b0" font-size="9" opacity="0.9" transform="rotate(-90 ${cx} ${cz})" text-anchor="middle">${text}</text>`,
    );
    continue;
  }
  const x = sx(r.x0) + 5;
  let y = sy(r.z0) + 13;
  if (collides(x, y, 120)) y = sy(r.z1) - 4;
  if (collides(x, y, 120)) continue;
  placed.push({ x, y, w: 120 });
  lines.push(`<text x="${x}" y="${y}" fill="#8f96b0" font-size="9" opacity="0.9">${name}</text>`);
  if (h > 46) {
    lines.push(`<text x="${x}" y="${y + 10}" fill="#66607f" font-size="8.5">${r.district}</text>`);
  }
}

// Scale bar and north arrow.
const barM = 50;
const barPx = barM * SCALE;
const barY = H - 44;
lines.push(`<rect x="${pad}" y="${barY}" width="${barPx / 2}" height="4" fill="#cfc7e6"/>`);
lines.push(`<rect x="${pad + barPx / 2}" y="${barY}" width="${barPx / 2}" height="4" fill="#6f668d"/>`);
lines.push(`<text x="${pad}" y="${barY - 5}" fill="#9d94bd" font-size="9">0</text>`);
lines.push(`<text x="${pad + barPx - 8}" y="${barY - 5}" fill="#9d94bd" font-size="9">${barM} m</text>`);
lines.push(`<text x="${W - pad - 30}" y="${top - 12}" fill="#9d94bd" font-size="10">Bắc ↑</text>`);
lines.push(
  `<text x="${pad}" y="${H - 26}" fill="#f0a3a3" font-size="9.5">vùng đỏ nhạt: đi bộ > 45 s (${metrics.poiCoverage.fortyFiveSecondsMetres} m) không tới POI nào ` +
    `— ${metrics.poiCoverage.uncoveredM2} m² (${100 - metrics.poiCoverage.pctWithin45s}% diện tích)</text>`,
);
lines.push(`<text x="${pad}" y="${H - 10}" fill="#7f7899" font-size="9.5">Đo: ${metrics.walkable.areaKm2} km² đi được / ${metrics.bbox.areaKm2} km² bao (${metrics.walkable.percentOfBbox}%) · ${rects.length} vùng · ${metrics.rectGraph.cycleRank} vòng · ${metrics.poiCoverage.pctWithin45s}% trong 45 s</text>`);
lines.push(`</svg>`);
const svg = lines.join("\n");
writeFileSync(path.join(outDir, "openworld-plan.svg"), svg);

if (!process.argv.includes("--no-png")) {
  try {
    const requireFromRepo = createRequire(path.join(repo, "package.json"));
    const { default: sharp } = await import(requireFromRepo.resolve("sharp"));
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, "openworld-plan.png"));
    console.log(`PNG  docs/product/audit/openworld-plan.png (${W}×${H})`);
  } catch (error) {
    console.warn("Không tạo được PNG (sharp):", String(error));
  }
}

console.log(`SVG  docs/product/audit/openworld-plan.svg`);
console.log(`JSON docs/product/audit/openworld-metrics.json`);
console.log(
  `Diện tích đi được: ${metrics.walkable.areaM2} m² = ${metrics.walkable.areaKm2} km² ` +
    `(${metrics.walkable.percentOfBbox}% của bao ${metrics.bbox.width}×${metrics.bbox.depth} m)`,
);
console.log(`Vùng: ${components.length} · vòng: ${metrics.rectGraph.cycleRank} · POI: ${pois.length} (TB ${metrics.meanPoiSpacingMetres} m)`);
console.log(`Xa nhất từ phòng: ${metrics.farthestFromRoomMetres} m`);
for (const [id, value] of Object.entries(reach)) console.log(`  → ${id}: ${value?.metres ?? "KHÔNG TỚI ĐƯỢC"} m (${value?.minutes ?? "-"} phút)`);
console.log(
  `Tới POI trong 45 s (${metrics.poiCoverage.fortyFiveSecondsMetres} m): ${metrics.poiCoverage.pctWithin45s}% diện tích` +
    ` · xa nhất ${metrics.poiCoverage.worstNearestPoiMetres} m · trung vị ${metrics.poiCoverage.medianNearestPoiMetres} m`,
);
console.log(`Đường vẽ trên minimap: ${metrics.roads.count} · đoạn bị chặn: ${blockedRuns.length}`);
for (const run of blockedRuns) console.log(`  ✗ ${run.road}: ${run.metres} m bị chặn (${run.from.x.toFixed(1)},${run.from.z.toFixed(1)}) → (${run.to.x.toFixed(1)},${run.to.z.toFixed(1)})`);

// --- Gate ----------------------------------------------------------------------------------------
// The audit is only useful if it can fail. Anything that would put a player in front of a wall,
// a hole, or a road that goes nowhere exits non-zero.
const defects = [];
if (roads.length < 8) defects.push(`chỉ đọc được ${roads.length} đoạn đường từ saigonRoads.ts`);
if (components.length !== 1) defects.push(`${components.length} vùng rời rạc (phải là 1)`);
for (const [id, value] of Object.entries(reach)) {
  if (!value) defects.push(`POI ${id} không tới được từ phòng 6.07`);
}
for (const run of blockedRuns) defects.push(`${run.road}: ${run.metres} m đường vẽ chồng lên vùng không đi được`);
if (metrics.walkable.areaM2 < 34000 || metrics.walkable.areaM2 > 39000) {
  defects.push(`diện tích đi được ${metrics.walkable.areaM2} m² nằm ngoài khoảng ${"34 000–39 000"} m² đã chốt`);
}
if (defects.length) {
  console.error("\nKhông đạt:");
  for (const d of defects) console.error(`  ✗ ${d}`);
  process.exitCode = 1;
} else {
  console.log("\nĐạt: liền mạch, mọi POI tới được, không có đoạn đường nào bị chặn.");
}
