#!/usr/bin/env node
// Turn a real `.osm.pbf` extract into the world data this game can build geometry from, and render a
// plan of it so the result can be looked at instead of trusted.
//
//   node scripts/osm-extract.ts <file.osm.pbf> --auto
//   node scripts/osm-extract.ts vietnam-latest.osm.pbf --bbox=10.746,106.652,10.800,106.720
//   node scripts/osm-extract.ts file.pbf --auto --out=docs/product/audit
//
// Output: <out>/osm-<name>.json (buildings, roads, pois, tag histograms, metres from the bbox centre)
//         <out>/osm-<name>.svg  (plan)
//         <out>/osm-<name>.png  (same, rasterised with sharp)
//
// Needs no dependency beyond Node itself; sharp is optional and only used for the PNG.

import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractOsmWorld, project, type OsmBbox, type OsmWorld } from "../src/features/testbus/openworld/world/osm/osmPbf.ts";

/** Same projection the extractor used, keyed off the world origin. */
const projectLike = (origin: { lon: number; lat: number }) => {
  const mPerDegLat = 110_540;
  const mPerDegLon = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return (lon: number, lat: number): [number, number] => [(lon - origin.lon) * mPerDegLon, -(lat - origin.lat) * mPerDegLat];
};

const requireFromRepo = createRequire(path.join(process.cwd(), "package.json"));

function parseArgs(argv: string[]) {
  const file = argv.find((a) => a.endsWith(".pbf")) ?? "";
  const auto = argv.includes("--auto");
  const bboxArg = argv.find((a) => a.startsWith("--bbox="));
  const outArg = argv.find((a) => a.startsWith("--out="));
  let bbox: OsmBbox | null = null;
  if (bboxArg) {
    const [s, w, n, e] = bboxArg.slice("--bbox=".length).split(",").map(Number);
    if ([s, w, n, e].some((v) => !Number.isFinite(v))) throw new Error("--bbox=south,west,north,east");
    bbox = { south: s, west: w, north: n, east: e };
  }
  return { file, auto, bbox, out: outArg ? outArg.slice("--out=".length) : "docs/product/audit" };
}

const top = (counts: Record<string, number>, n = 8) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k}×${v}`)
    .join(" · ") || "—";

function planSvg(world: OsmWorld, title: string): string {
  // Fit every kept shape.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const visit = ([x, z]: [number, number]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  };
  for (const b of world.buildings) for (const p of b.ring) visit(p);
  for (const r of world.roads) for (const p of r.points) visit(p);
  if (!Number.isFinite(minX)) {
    minX = -10;
    maxX = 10;
    minZ = -10;
    maxZ = 10;
  }
  const padM = 20;
  const spanX = Math.max(1, maxX - minX + padM * 2);
  const spanZ = Math.max(1, maxZ - minZ + padM * 2);
  const width = 900;
  const scale = width / spanX;
  const height = Math.round(spanZ * scale) + 70;
  const sx = (x: number) => (x - minX + padM) * scale;
  const sy = (z: number) => (z - minZ + padM) * scale + 52;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-sans-serif, system-ui, sans-serif">`);
  out.push(`<rect width="${width}" height="${height}" fill="#0e0d14"/>`);
  out.push(`<text x="18" y="24" fill="#ece8f7" font-size="14" font-weight="600">${title}</text>`);
  out.push(
    `<text x="18" y="40" fill="#8a83a6" font-size="10">${world.counts.buildings} toà · ${world.counts.roads} đường · ${world.counts.pois} POI · khung ${spanX.toFixed(0)}×${spanZ.toFixed(0)} m · OSM thật</text>`,
  );
  for (const r of world.roads) {
    const d = r.points.map(([x, z], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(z).toFixed(1)}`).join(" ");
    out.push(`<path d="${d}" fill="none" stroke="#4b4760" stroke-width="${Math.max(1.5, r.widthM * scale)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`);
  }
  for (const b of world.buildings) {
    const d = b.ring.map(([x, z], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(z).toFixed(1)}`).join(" ") + "Z";
    const fill = b.tags.shop || b.tags.amenity ? "#c8a26a" : b.kind === "yes" ? "#2c3247" : "#39405c";
    out.push(`<path d="${d}" fill="${fill}" fill-opacity="0.92" stroke="#6a6a8f" stroke-width="0.5"/>`);
  }
  // Named POIs are what a player can actually walk up to; draw the ones that carry a name.
  const proj = projectLike(world.origin);
  for (const p of world.pois) {
    if (!p.name) continue;
    const [x, z] = proj(p.lon, p.lat);
    out.push(`<circle cx="${sx(x).toFixed(1)}" cy="${sy(z).toFixed(1)}" r="1.8" fill="#f3d27a"/>`);
  }
  // Scale bar: 100 m.
  const barPx = 100 * scale;
  out.push(`<rect x="18" y="${height - 22}" width="${barPx / 2}" height="3" fill="#cfc7e6"/>`);
  out.push(`<rect x="${18 + barPx / 2}" y="${height - 22}" width="${barPx / 2}" height="3" fill="#6f668d"/>`);
  out.push(`<text x="${18 + barPx + 6}" y="${height - 18}" fill="#9d94bd" font-size="9">100 m</text>`);
  out.push("</svg>");
  return out.join("\n");
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error("usage: node scripts/osm-extract.ts <file.osm.pbf> (--auto | --bbox=s,w,n,e) [--out=dir]");
  process.exit(2);
}

const started = Date.now();
const bytes = new Uint8Array(readFileSync(args.file));

let bbox = args.bbox;
if (!bbox) {
  if (!args.auto) throw new Error("give --auto or --bbox=south,west,north,east");
  // A world-sized bbox parses the file once to discover where its data actually is.
  const probe = extractOsmWorld(bytes, { south: -89, west: -179, north: 89, east: 179 }, (b) => new Uint8Array(inflateSync(b)));
  bbox = {
    south: Math.floor(probe.extent.south * 1e4) / 1e4,
    west: Math.floor(probe.extent.west * 1e4) / 1e4,
    north: Math.ceil(probe.extent.north * 1e4) / 1e4,
    east: Math.ceil(probe.extent.east * 1e4) / 1e4,
  };
}

const world = extractOsmWorld(bytes, bbox, (b) => new Uint8Array(inflateSync(b)));
const name = path.basename(args.file).replace(/\.(osm\.)?pbf$/i, "");
const outDir = args.out;
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, `osm-${name}.json`), `${JSON.stringify(world, null, 1)}\n`);
writeFileSync(path.join(outDir, `osm-${name}.svg`), planSvg(world, `OSM thật · ${name}`));

const areaM2 = world.buildings.reduce((s, b) => s + b.areaM2, 0);
const km2 = (bbox.north - bbox.south) * 110.54 * ((bbox.east - bbox.west) * 111.32 * Math.cos((bbox.south * Math.PI) / 180));
console.log(`file            ${args.file} (${(bytes.length / 1024).toFixed(0)} KB, ${world.counts.blobs} blob, ${world.counts.skippedBlobs} blob bị bỏ)`);
console.log(`bbox            ${bbox.south.toFixed(4)},${bbox.west.toFixed(4)} → ${bbox.north.toFixed(4)},${bbox.east.toFixed(4)}  (${km2.toFixed(2)} km²)`);
console.log(`đọc             ${world.counts.nodes.toLocaleString("vi")} node · ${world.counts.ways.toLocaleString("vi")} way · ${world.counts.nodesInBbox.toLocaleString("vi")} node trong khung`);
console.log(`toà nhà         ${world.counts.buildings} · tổng ${Math.round(areaM2).toLocaleString("vi")} m² · TB ${Math.round(areaM2 / Math.max(1, world.counts.buildings))} m²/toà`);
console.log(
  `mật độ          ${(world.counts.buildings / Math.max(0.0001, km2)).toFixed(0)} toà/km² · ` +
    `${((100 * areaM2) / Math.max(1, km2 * 1e6)).toFixed(1)}% diện tích có mái · ${world.counts.multipolygonBuildings} toà multipolygon`,
);
console.log(`đường           ${world.counts.roads} · way không giải được ref: ${world.counts.unresolvedWays}`);
console.log(`POI có tên      ${world.pois.filter((p) => p.name).length}/${world.counts.pois}`);
console.log(`building        ${top(world.tags.building)}`);
console.log(`highway         ${top(world.tags.highway)}`);
console.log(`shop            ${top(world.tags.shop)}`);
console.log(`amenity         ${top(world.tags.amenity)}`);
console.log(`JSON/SVG        ${path.join(outDir, `osm-${name}.json`)}`);

try {
  const { default: sharp } = await import(requireFromRepo.resolve("sharp"));
  await sharp(Buffer.from(readFileSync(path.join(outDir, `osm-${name}.svg`))))
    .png()
    .toFile(path.join(outDir, `osm-${name}.png`));
  console.log(`PNG             ${path.join(outDir, `osm-${name}.png`)}`);
} catch (error) {
  console.warn("PNG bỏ qua (sharp):", String(error).slice(0, 160));
}
console.log(`xong sau ${Date.now() - started} ms`);
