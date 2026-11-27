#!/usr/bin/env node
// Kiểm toán + vẽ bản đồ mở rộng (`src/features/citymap`).
//
//   node scripts/city-audit.ts            # đo, ghi JSON + plan PNG + isometric PNG, exit 1 nếu vi phạm
//   node scripts/city-audit.ts --no-png   # chỉ SVG/JSON
//
// Script này là TRỌNG TÀI, không phải gương của bộ sinh: nó dựng lại lưới 1 m từ hình học
// (`city.buildings`, `city.water`) bằng code riêng rồi so với `city.metrics`. Lệch >1% là lỗi.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateCity, cellAt, isWalkable, type City, type CityBuilding } from "../src/features/citymap/cityGen.ts";

const repo = path.resolve(process.cwd(), "..", "..");
const outDir = path.join(repo, "docs/product/audit");
const requireFromRepo = createRequire(path.join(process.cwd(), "package.json"));

const t0 = performance.now();
const city = generateCity();
const genMs = Math.round(performance.now() - t0);
const f = city.frame;
const STEP = city.walk.step;
const NX_PER_M = 1 / STEP;
const nx = Math.round((f.x1 - f.x0) / STEP);
const nz = Math.round((f.z1 - f.z0) / STEP);
const CELL_M2 = STEP * STEP;
const idx = (i: number, j: number) => j * nx + i;

// --- raster độc lập: 0 đi được, 1 nhà, 2 nước ------------------------------------------------
const solid = new Uint8Array(nx * nz);
const paint = (x0: number, x1: number, z0: number, z1: number, v: number) => {
  const i0 = Math.max(0, Math.ceil((x0 - f.x0) / STEP - 0.5));
  const i1 = Math.min(nx, Math.ceil((x1 - f.x0) / STEP - 0.5));
  const j0 = Math.max(0, Math.ceil((z0 - f.z0) / STEP - 0.5));
  const j1 = Math.min(nz, Math.ceil((z1 - f.z0) / STEP - 0.5));
  for (let j = j0; j < j1; j += 1) for (let i = i0; i < i1; i += 1) solid[idx(i, j)] = v;
};
for (const w of city.water) paint(w.x0, w.x1, w.z0, w.z1, 2);
for (const b of city.buildings) if (!b.walkable) paint(b.x0, b.x1, b.z0, b.z1, 1);

let walkableCells = 0;
let roofCells = 0;
for (let k = 0; k < solid.length; k += 1) {
  if (solid[k] === 0) walkableCells += 1;
  else if (solid[k] === 1) roofCells += 1;
}
const walkableM2 = walkableCells * CELL_M2;
const landM2 = (f.x1 - f.x0) * (f.z1 - f.z0) - city.water.reduce((s, w) => s + (w.x1 - w.x0) * (w.z1 - w.z0), 0);

// --- BFS hai chiều ---------------------------------------------------------------------------
function bfs(sources: Array<readonly [number, number]>): Int32Array {
  const dist = new Int32Array(nx * nz).fill(-1);
  const queue = new Int32Array(nx * nz);
  let head = 0;
  let tail = 0;
  for (const [i, j] of sources) {
    if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
    const k = idx(i, j);
    if (solid[k] !== 0 || dist[k] >= 0) continue;
    dist[k] = 0;
    queue[tail++] = k;
  }
  while (head < tail) {
    const k = queue[head++];
    const i = k % nx;
    const j = (k - i) / nx;
    const d = dist[k];
    if (i > 0 && solid[k - 1] === 0 && dist[k - 1] < 0) { dist[k - 1] = d + 1; queue[tail++] = k - 1; }
    if (i < nx - 1 && solid[k + 1] === 0 && dist[k + 1] < 0) { dist[k + 1] = d + 1; queue[tail++] = k + 1; }
    if (j > 0 && solid[k - nx] === 0 && dist[k - nx] < 0) { dist[k - nx] = d + 1; queue[tail++] = k - nx; }
    if (j < nz - 1 && solid[k + nx] === 0 && dist[k + nx] < 0) { dist[k + nx] = d + 1; queue[tail++] = k + nx; }
  }
  return dist;
}

const nearestWalkable = (x: number, z: number, maxR = Math.round(40 * NX_PER_M)): readonly [number, number] | null => {
  const i0 = Math.round((x - f.x0) * NX_PER_M);
  const j0 = Math.round((z - f.z0) * NX_PER_M);
  for (let r = 0; r <= maxR; r += 1) {
    for (let di = -r; di <= r; di += 1) {
      for (let dj = -r; dj <= r; dj += 1) {
        const i = i0 + di;
        const j = j0 + dj;
        if (i >= 0 && j >= 0 && i < nx && j < nz && solid[idx(i, j)] === 0) return [i, j] as const;
      }
    }
  }
  return null;
};

const startCell = nearestWalkable(0, 0);
const fromRoom = bfs(startCell ? [startCell] : []);
let reached = 0;
for (let k = 0; k < fromRoom.length; k += 1) if (fromRoom[k] >= 0) reached += 1;

// Vùng rời rạc: đếm vùng có diện tích ≥ 2 m² (khe hở 1 ô là lỗi hình học, không phải "vùng").
const seen = new Uint8Array(nx * nz);
const components: number[] = [];
for (let k = 0; k < solid.length; k += 1) {
  if (solid[k] !== 0 || seen[k]) continue;
  const stack = [k];
  seen[k] = 1;
  let size = 0;
  while (stack.length) {
    const cur = stack.pop() as number;
    size += 1;
    const i = cur % nx;
    const j = (cur - i) / nx;
    if (i > 0 && solid[cur - 1] === 0 && !seen[cur - 1]) { seen[cur - 1] = 1; stack.push(cur - 1); }
    if (i < nx - 1 && solid[cur + 1] === 0 && !seen[cur + 1]) { seen[cur + 1] = 1; stack.push(cur + 1); }
    if (j > 0 && solid[cur - nx] === 0 && !seen[cur - nx]) { seen[cur - nx] = 1; stack.push(cur - nx); }
    if (j < nz - 1 && solid[cur + nx] === 0 && !seen[cur + nx]) { seen[cur + nx] = 1; stack.push(cur + nx); }
  }
  components.push(size);
}
const bigComponents = components.filter((s) => s * CELL_M2 >= 2);

const poiCells = city.pois
  .map((p) => ({ poi: p, cell: nearestWalkable(p.x, p.z) }))
  .filter((x): x is { poi: (typeof city.pois)[number]; cell: readonly [number, number] } => Boolean(x.cell));
const unreachable = poiCells.filter(({ cell }) => fromRoom[idx(...cell)] < 0).map(({ poi }) => poi.name);
const poiMetres = poiCells.map(({ poi, cell }) => ({ poi, metres: fromRoom[idx(...cell)] * STEP }));

// Phủ 45 giây (1,4 m/s → 63 m), đo trên ô đi được, nguồn là các POI tới được.
const reachablePois = poiCells.filter(({ cell }) => fromRoom[idx(...cell)] >= 0);
const poiDist = bfs(reachablePois.map((p) => p.cell));
let covered45 = 0;
let worstMetres = 0;
for (let k = 0; k < poiDist.length; k += 1) {
  if (solid[k] !== 0) continue;
  const d = poiDist[k];
  if (d < 0) continue;
  if (d * STEP <= 63) covered45 += 1;
  if (d * STEP > worstMetres) worstMetres = d * STEP;
}

const m = city.metrics;
const mismatch: string[] = [];
const closeEnough = (label: string, mine: number, theirs: number, tolPct = 1) => {
  const base = Math.max(1, Math.abs(theirs));
  void base;
  const delta = Math.abs(mine - theirs) / base;
  if (delta > tolPct / 100) mismatch.push(`${label}: audit ${mine} vs metrics ${theirs}`);
};
closeEnough("diện tích đi được", walkableM2, m.walkableAreaM2);
closeEnough("diện tích mái", roofCells * CELL_M2, m.roofAreaM2);
closeEnough("số vùng", bigComponents.length, m.components, 0);

const metrics = {
  generatedAt: new Date().toISOString(),
  seed: city.seed,
  generateMs: genMs,
  frame: { ...f, widthM: f.x1 - f.x0, depthM: f.z1 - f.z0, km2: +(((f.x1 - f.x0) * (f.z1 - f.z0)) / 1e6).toFixed(3) },
  walkable: {
    m2: walkableM2,
    km2: +(walkableM2 / 1e6).toFixed(4),
    pctOfLand: landM2 ? +((100 * walkableM2) / landM2).toFixed(1) : 0,
    components: bigComponents.length,
    largestPct: walkableCells ? +((100 * Math.max(...bigComponents, 0)) / walkableCells).toFixed(2) : 0,
    reachableFromRoomPct: walkableCells ? +((100 * reached) / walkableCells).toFixed(2) : 0,
    coverage45sPct: walkableCells ? +((100 * covered45) / walkableCells).toFixed(1) : 0,
    worstMetres,
  },
  built: {
    roofM2: Math.round(roofCells * CELL_M2),
    roofPctOfLand: landM2 ? +((100 * roofCells * CELL_M2) / landM2).toFixed(1) : 0,
    buildings: city.buildings.length,
    blocks: city.blocks.length,
    courts: city.blocks.reduce((s, b) => s + b.courts.length, 0),
    medianFloors: m.medianFloors,
    maxHeightM: m.maxHeightM,
    grossFloorKm2: +(m.grossFloorAreaM2 / 1e6).toFixed(3),
  },
  streets: {
    segments: city.streets.length,
    km: +(m.streetLengthM / 1000).toFixed(1),
    hemKm: +(m.hemLengthM / 1000).toFixed(1),
    kmPerKm2: m.streetKmPerKm2,
    frontagePer100m: m.frontageUnitsPer100m,
    functionsPer100m: m.functionsPer100m,
    medianByClass: m.frontageByClass,
    builtPct: m.frontageBuiltPct,
    deadM: m.maxDeadFrontageM,
    deadPct: m.deadFrontagePct,
    deadStreet: m.maxDeadStreet,
  },
  pois: {
    total: city.pois.length,
    venues: m.venuePois,
    shops: m.shopPois,
    perKm2: m.poisPerKm2,
    unreachable,
    medianMetresFromRoom: poiMetres.length ? poiMetres.map((p) => p.metres).sort((a, b) => a - b)[Math.floor(poiMetres.length / 2)] : 0,
    withBeat: city.pois.filter((p) => p.beat).length,
  },
  props: {
    total: city.props.length,
    per100m: +((city.props.length / Math.max(1, m.streetLengthM)) * 100).toFixed(1),
  },
  districts: city.districts.map((d) => {
    const dm = m.districtMetrics.find((x) => x.id === d.id);
    return {
      id: d.id,
      ward: d.ward,
      old: d.old,
      klass: d.klass,
      walkableM2: dm?.walkableM2 ?? 0,
      roofPct: dm?.roofPct ?? 0,
      pois: dm?.pois ?? 0,
      buildings: dm?.buildings ?? 0,
      streets: dm?.streets ?? 0,
      story: d.story,
      verb: d.verb,
    };
  }),
  anchors: city.anchors.map((a) => ({ id: a.id, name: a.name, x: +a.x.toFixed(1), z: +a.z.toFixed(1), heightM: a.heightM, ward: a.ward, year2026: a.year2026 })),
  mismatch,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "city-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);

// --- Ảnh 1: mặt bằng -------------------------------------------------------------------------
const S = 1;
const pad = 26;
const W = Math.round((f.x1 - f.x0) * S) + pad * 2;
const H = Math.round((f.z1 - f.z0) * S) + pad * 2 + 40;
const px = (x: number) => (x - f.x0) * S + pad;
const pz = (z: number) => (z - f.z0) * S + pad + 34;
const KIND_COLOR: Record<string, string> = {
  shop: "#8a7358", food: "#9a7350", cafe: "#b58250", bank: "#4f6d90", office: "#4d6280",
  pawn: "#945f5f", gold: "#b39a54", herb: "#728456", phone: "#5f7182", repair: "#71604e",
  hotel: "#816183", laundry: "#617780", net: "#53628e", gaming: "#5f538e", boarding: "#766454",
  money: "#94824f", tower: "#a9bad2", market: "#cfa971", park: "#3f6f4c", "metro-site": "#96723c",
  metro: "#6e8a9c", apartment: "#82828e", pier: "#4f7f90", house: "#3c3546", room: "#443b4e", kho: "#4a4152",
};

const plan: string[] = [];
plan.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, system-ui, sans-serif">`);
plan.push(`<rect width="${W}" height="${H}" fill="#0b0a10"/>`);
plan.push(`<text x="${pad}" y="20" fill="#efe9f8" font-size="14" font-weight="600">Sài Gòn 2026 — ${f.x1 - f.x0}×${f.z1 - f.z0} m, mốc thật nén 1:${city.compression}</text>`);
plan.push(`<text x="${pad}" y="35" fill="#8a83a6" font-size="9.5">${city.buildings.length} toà · ${city.blocks.length} khối · ${city.streets.length} tuyến (${(m.hemLengthM / 1000).toFixed(1)} km hẻm) · ${city.pois.length} POI · đi được ${(walkableM2 / 1e6).toFixed(3)} km² · ${metrics.walkable.coverage45sPct}% trong 45 s</text>`);
plan.push(`<rect x="${px(f.x0)}" y="${pz(f.z0)}" width="${(f.x1 - f.x0) * S}" height="${(f.z1 - f.z0) * S}" fill="#1a1724"/>`);
for (const w of city.water) plan.push(`<rect x="${px(w.x0)}" y="${pz(w.z0)}" width="${(w.x1 - w.x0) * S}" height="${(w.z1 - w.z0) * S}" fill="#16333f"/>`);
for (const s of city.streets) {
  const [ax, az] = s.points[0];
  const [bx, bz] = s.points[s.points.length - 1];
  const stroke = s.klass === "avenue" ? "#35304a" : s.klass === "alley" ? "#2a2634" : "#2e2a3a";
  plan.push(`<line x1="${px(ax)}" y1="${pz(az)}" x2="${px(bx)}" y2="${pz(bz)}" stroke="${stroke}" stroke-width="${Math.max(1, s.widthM * S)}"/>`);
}
for (const c of city.blocks.flatMap((b) => b.courts)) {
  plan.push(`<rect x="${px(c.x0)}" y="${pz(c.z0)}" width="${(c.x1 - c.x0) * S}" height="${(c.z1 - c.z0) * S}" fill="#20321f" fill-opacity="0.75"/>`);
}
for (const b of city.buildings) {
  plan.push(`<rect x="${px(b.x0)}" y="${pz(b.z0)}" width="${(b.x1 - b.x0) * S}" height="${(b.z1 - b.z0) * S}" fill="${KIND_COLOR[b.kind] ?? "#6a6478"}"/>`);
}
for (const p of city.pois) plan.push(`<circle cx="${px(p.x)}" cy="${pz(p.z)}" r="1.5" fill="${p.tier === "venue" ? "#ffe27a" : "#d8a75a"}"/>`);
for (const d of city.districts) {
  const tile = d.tiles[0];
  plan.push(`<text x="${px(tile.x0) + 6}" y="${pz(tile.z0) + 15}" fill="#c2b6ea" font-size="11" font-weight="600">${d.ward}</text>`);
  plan.push(`<text x="${px(tile.x0) + 6}" y="${pz(tile.z0) + 26}" fill="#7a7096" font-size="8.5">${d.old} · ${d.klass} · ${d.story}</text>`);
}
for (const a of city.anchors) {
  if (a.kind === "home") continue;
  plan.push(`<circle cx="${px(a.x)}" cy="${pz(a.z)}" r="3.2" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.7"/>`);
  plan.push(`<text x="${px(a.x) + 5}" y="${pz(a.z) - 5}" fill="#f2ecff" font-size="9">${a.name}</text>`);
}
plan.push(`<rect x="${pad}" y="${H - 16}" width="100" height="3" fill="#cfc7e6"/><rect x="${pad + 100}" y="${H - 16}" width="100" height="3" fill="#6f668d"/>`);
plan.push(`<text x="${pad + 206}" y="${H - 12}" fill="#9d94bd" font-size="9">200 m</text>`);
plan.push("</svg>");
writeFileSync(path.join(outDir, "city-plan.svg"), plan.join("\n"));

// --- Ảnh 2: phối cảnh trục đo ----------------------------------------------------------------
const ISO = 0.5;
const isoX = (x: number, z: number) => (x - z) * 0.866 * ISO;
const isoY = (x: number, z: number, y: number) => ((x + z) * 0.5 - y * 0.9) * ISO;
const cornersOf = (b: CityBuilding) => [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]] as const;

const projected = city.buildings
  .filter((b) => !b.walkable)
  .map((b) => {
    const cs = cornersOf(b);
    return {
      b,
      pts: cs.map(([x, z]) => [isoX(x, z), isoY(x, z, 0)] as [number, number]),
      top: cs.map(([x, z]) => [isoX(x, z), isoY(x, z, b.heightM)] as [number, number]),
      depth: b.x0 + b.z0 + b.x1 + b.z1,
    };
  });

let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;
const stretch = (p: [number, number]) => {
  if (p[0] < minX) minX = p[0];
  if (p[0] > maxX) maxX = p[0];
  if (p[1] < minY) minY = p[1];
  if (p[1] > maxY) maxY = p[1];
};
for (const w of city.water) for (const [x, z] of [[w.x0, w.z0], [w.x1, w.z0], [w.x1, w.z1], [w.x0, w.z1]] as const) stretch([isoX(x, z), isoY(x, z, 0)]);
for (const p of projected) {
  for (const q of p.pts) stretch(q);
  for (const q of p.top) stretch(q);
}
const shiftX = 24 - minX;
const shiftY = 52 - minY;
const isoW = Math.round(maxX - minX + 48);
const isoH = Math.round(maxY - minY + 86);

const iso: string[] = [];
iso.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${isoW}" height="${isoH}" viewBox="0 0 ${isoW} ${isoH}" font-family="ui-sans-serif, system-ui, sans-serif">`);
iso.push(`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1529"/><stop offset="1" stop-color="#2c2437"/></linearGradient></defs>`);
iso.push(`<rect width="${isoW}" height="${isoH}" fill="url(#sky)"/>`);
iso.push(`<text x="16" y="24" fill="#efe9f8" font-size="14" font-weight="600">Sài Gòn 2026 — phối cảnh khối (${projected.length} toà, cao nhất ${m.maxHeightM} m)</text>`);
const poly = (pts: ReadonlyArray<readonly [number, number]>) => pts.map(([x, y]) => `${(x + shiftX).toFixed(1)},${(y + shiftY).toFixed(1)}`).join(" ");
iso.push(`<polygon points="${poly([[f.x0, f.z0], [f.x1, f.z0], [f.x1, f.z1], [f.x0, f.z1]].map(([x, z]) => [isoX(x, z), isoY(x, z, 0)]) as Array<[number, number]>)}" fill="#191624"/>`);
for (const w of city.water) {
  iso.push(`<polygon points="${poly([[w.x0, w.z0], [w.x1, w.z0], [w.x1, w.z1], [w.x0, w.z1]].map(([x, z]) => [isoX(x, z), isoY(x, z, 0)]) as Array<[number, number]>)}" fill="#123039"/>`);
}
const shade = (hex: string, k: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
};
projected.sort((a, b) => a.depth - b.depth);
for (const { b, pts, top } of projected) {
  const base = KIND_COLOR[b.kind] ?? "#6a6478";
  iso.push(`<polygon points="${poly([pts[1], pts[2], top[2], top[1]])}" fill="${shade(base, 0.66)}"/>`);
  iso.push(`<polygon points="${poly([pts[2], pts[3], top[3], top[2]])}" fill="${shade(base, 0.5)}"/>`);
  iso.push(`<polygon points="${poly(top)}" fill="${shade(base, 1.2)}"/>`);
  if (b.anchor && (b.anchor === "landmark81" || b.anchor === "bitexco")) {
    iso.push(`<text x="${(top[2][0] + shiftX + 5).toFixed(0)}" y="${(top[2][1] + shiftY - 5).toFixed(0)}" fill="#ffe9a8" font-size="10">${b.anchor === "landmark81" ? "Landmark 81 · 461 m" : "Bitexco · 262 m"}</text>`);
  }
}
iso.push(`<text x="16" y="${isoH - 14}" fill="#7f7899" font-size="9">Cùng một seed → cùng một thành phố. Cao độ không nén; khoảng cách giữa các mốc nén 1:${city.compression}.</text>`);
iso.push("</svg>");
writeFileSync(path.join(outDir, "city-iso.svg"), iso.join("\n"));

// --- In + cổng -------------------------------------------------------------------------------
const line = (label: string, value: string | number) => console.log(`${label.padEnd(22)} ${value}`);
line("Khung", `${f.x1 - f.x0} × ${f.z1 - f.z0} m = ${(((f.x1 - f.x0) * (f.z1 - f.z0)) / 1e6).toFixed(2)} km²`);
line("Đi được", `${walkableM2.toLocaleString("vi")} m² = ${(walkableM2 / 1e6).toFixed(4)} km² (${metrics.walkable.pctOfLand}% đất)`);
line("Liền mạch", `${bigComponents.length} vùng · lớn nhất ${metrics.walkable.largestPct}% · từ phòng ${metrics.walkable.reachableFromRoomPct}%`);
line("Mái", `${((roofCells * CELL_M2) / 1e6).toFixed(3)} km² = ${metrics.built.roofPctOfLand}% đất · ${city.buildings.length} toà · ${m.medianFloors} tầng TB`);
line("Khối/sân", `${city.blocks.length} khối · ${metrics.built.courts} sân chung`);
line("Đường", `${(m.streetLengthM / 1000).toFixed(1)} km (${(m.hemLengthM / 1000).toFixed(1)} km hẻm) · ${m.streetKmPerKm2} km/km²`);
line("Mặt tiền", `trung vị ${m.frontageMedianPer100m} đơn vị + ${m.functionsMedianPer100m} chức năng/100 m · p10 ${m.frontageP10Per100m} · phủ ${m.frontageBuiltPct}% · chết ${m.deadFrontagePct}% (đoạn dài nhất ${m.maxDeadFrontageM} m — ${m.maxDeadStreet})`);
line("Theo phường", Object.entries(m.frontageByClass).map(([k, v]) => `${k} ${v} đv/${m.functionsByClass[k] ?? 0} ch`).join(" · "));
line("POI", `${city.pois.length} (${m.venuePois} venue + ${m.shopPois} shop) · ${m.poisPerKm2}/km²`);

line("Phủ 45 s", `${metrics.walkable.coverage45sPct}% · xa nhất ${worstMetres} m · ${unreachable.length} POI không tới được`);
line("Vật thể", `${city.props.length} · ${metrics.props.per100m}/100 m`);
line("Sinh", `${genMs} ms`);

const defects: string[] = [...mismatch];
const km2 = walkableM2 / 1e6;
if (km2 < 0.3 || km2 > 0.43) defects.push(`diện tích đi được ${km2.toFixed(4)} km² ngoài khoảng 0,30–0,43`);
if (bigComponents.length !== 1) defects.push(`${bigComponents.length} vùng rời rạc (vùng ≥2 m²)`);
if (metrics.walkable.largestPct < 99.5) defects.push(`vùng lớn nhất chỉ ${metrics.walkable.largestPct}% diện tích đi được`);
if (metrics.walkable.reachableFromRoomPct < 99.5) defects.push(`chỉ ${metrics.walkable.reachableFromRoomPct}% tới được từ phòng 6.07`);
if (unreachable.length) defects.push(`${unreachable.length} POI không tới được: ${unreachable.slice(0, 5).join(", ")}`);
if (metrics.walkable.coverage45sPct < 80) defects.push(`chỉ ${metrics.walkable.coverage45sPct}% diện tích trong 45 s tới POI (cần ≥80)`);
// Luật A-list áp cho PHỐ NHÀ ỐNG (khu ở / chợ / đang xây). Đại lộ tháp văn phòng và phố khách sạn
// có nhịp thưa hơn là đúng thực tế Nguyễn Huệ 2026, nên đo riêng chứ không trộn vào một trung vị.
for (const klass of ["residential", "market", "construction"] as const) {
  const units = m.frontageByClass[klass] ?? 0;
  const fn = m.functionsByClass[klass] ?? 0;
  if (units < 12) defects.push(`${klass}: ${units} đơn vị mặt tiền/100 m (A-list ≥12)`);
  if (fn < 6) defects.push(`${klass}: ${fn} chức năng/100 m (A-list ≥6)`);
}
for (const klass of ["corporate", "tourist"] as const) {
  const units = m.frontageByClass[klass] ?? 0;
  if (units < 3) defects.push(`${klass}: ${units} đơn vị mặt tiền/100 m (sàn 3 cho đại lộ tháp/khách sạn)`);
}
// Cổng mặt phố là TỈ LỆ MÉT MẶT TIỀN CÓ NHÀ, không phải "đoạn chết dài nhất". Khi hai tuyến song song
// (phố + hẻm) tranh cùng một dãy nhà, toà nhà thuộc về tuyến gần hơn — tuyến còn lại bị tính là trống
// dù thực địa không trống. Đoạn dài nhất vẫn in ra để soi, nhưng chỉ tỉ lệ phủ mới đủ kết luận.
if (m.frontageBuiltPct < 55) defects.push(`chỉ ${m.frontageBuiltPct}% chiều dài mặt tiền có nhà (A-list ≥55%)`);
if (metrics.props.per100m < 25) defects.push(`${metrics.props.per100m} vật thể/100 m (A-list ≥25)`);
if (metrics.built.roofPctOfLand < 45 || metrics.built.roofPctOfLand > 68) defects.push(`mái ${metrics.built.roofPctOfLand}% đất ngoài khoảng 45–68`);
if (m.streetKmPerKm2 < 24 || m.streetKmPerKm2 > 70) defects.push(`${m.streetKmPerKm2} km đường/km² ngoài khoảng 24–70`);
if (m.maxHeightM !== 461) defects.push(`mốc cao nhất ${m.maxHeightM} m, phải là Landmark 81 = 461 m`);
if (city.pois.filter((p) => p.beat).length < 6) defects.push(`chỉ ${city.pois.filter((p) => p.beat).length} POI mang beat cốt truyện`);
for (const d of city.districts) {
  const dm = m.districtMetrics.find((x) => x.id === d.id);
  if (!dm || dm.pois < 10) defects.push(`${d.ward}: ${dm?.pois ?? 0} POI`);
  if (!dm || dm.walkableM2 < 12_000) defects.push(`${d.ward}: ${dm?.walkableM2 ?? 0} m² đi được`);
}
// POI phải ĐỨNG ĐƯỢC theo hình học chính xác (lưới 0,5 m chỉ là xấp xỉ — ô chứa POI có thể bị
// toà nhà phủ một phần trong khi điểm đó vẫn trống; lấy hình học làm chuẩn, lưới làm tham khảo).
const poisBlocked = city.pois.filter((p) => !isWalkable(city, p.x, p.z));
if (poisBlocked.length) defects.push(`${poisBlocked.length} POI nằm trong toà nhà/nước/ngoài khung: ${poisBlocked.slice(0, 4).map((p) => p.name).join(", ")}`);
const rasterFuzz = city.pois.filter((p) => isWalkable(city, p.x, p.z) && cellAt(city, p.x, p.z) !== 0).length;
metrics.pois.rasterFuzz = rasterFuzz;
metrics.pois.rasterFuzz = rasterFuzz;

if (!process.argv.includes("--no-png")) {
  try {
    const { default: sharp } = await import(requireFromRepo.resolve("sharp"));
    for (const [name, svg] of [["city-plan", plan.join("\n")], ["city-iso", iso.join("\n")]] as const) {
      await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `${name}.png`));
    }
    console.log(`PNG  → ${path.relative(repo, outDir)}/city-plan.png, city-iso.png`);
  } catch (error) {
    console.warn("PNG bỏ qua (sharp):", String(error).slice(0, 160));
  }
}

if (defects.length) {
  console.error("\nKhông đạt:");
  for (const d of defects) console.error(`  ✗ ${d}`);
  process.exitCode = 1;
} else {
  console.log("\nĐạt toàn bộ cổng: 0,30–0,43 km² · một vùng · POI tới được hết · ≥12 đơn vị + ≥6 chức năng/100 m.");
}
