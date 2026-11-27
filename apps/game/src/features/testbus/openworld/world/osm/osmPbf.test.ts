// Proves the OSM reader on real bytes — not on a fixture invented to fit the code.
//
// Fixture: `scripts/fixtures/osm/helsinki.osm.pbf` (Kamppi, 1.7 km², © OpenStreetMap contributors,
// ODbL). If this test fails, the extractor is wrong; if it passes, the same code can read a Saigon
// extract without changes.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractOsmWorld, project, roadWidthM } from "./osmPbf";

// vitest runs from `apps/game`, so the fixture path is anchored on the cwd, with one fallback for a
// repo-root run.
const fixture = (name: string) => {
  const fromApp = path.resolve(process.cwd(), "scripts/fixtures/osm", name);
  if (existsSync(fromApp)) return fromApp;
  return path.resolve(process.cwd(), "apps/game/scripts/fixtures/osm", name);
};

const KAMPPI = { south: 60.1641, west: 24.9351, north: 60.1792, east: 24.9535 };
const bytes = new Uint8Array(readFileSync(fixture("helsinki.osm.pbf")));
const inflate = (b: Uint8Array) => new Uint8Array(inflateSync(b));
const world = extractOsmWorld(bytes, KAMPPI, inflate);

describe("osm pbf reader", () => {
  it("reads every blob and does not skip any", () => {
    expect(world.counts.blobs).toBeGreaterThan(2);
    expect(world.counts.skippedBlobs).toBe(0);
    expect(world.counts.nodes).toBeGreaterThan(20_000);
    expect(world.counts.ways).toBeGreaterThan(4_000);
  });

  it("finds the street network of a real shopping district", () => {
    expect(world.counts.roads).toBeGreaterThan(2_000);
    const kinds = Object.keys(world.tags.highway);
    expect(kinds).toEqual(expect.arrayContaining(["footway", "residential", "secondary", "primary"]));
    // Most ways in the extract must resolve to geometry, or the node join is broken.
    expect(world.counts.unresolvedWays / world.counts.ways).toBeLessThan(0.05);
  });

  it("builds footprints with sane areas and closed rings", () => {
    expect(world.counts.buildings).toBeGreaterThan(500);
    for (const building of world.buildings.slice(0, 200)) {
      expect(building.ring.length).toBeGreaterThanOrEqual(3);
      for (const [x, z] of building.ring) expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true);
      expect(building.areaM2).toBeGreaterThan(8);
      expect(building.areaM2).toBeLessThan(120_000);
    }
    // A Northern European block is 500-2,500 m²; a median far outside that means bad geometry.
    const areas = world.buildings.map((b) => b.areaM2).sort((a, b) => a - b);
    const median = areas[Math.floor(areas.length / 2)];
    expect(median).toBeGreaterThan(150);
    expect(median).toBeLessThan(1_500);
  });

  it("resolves multipolygon buildings (malls, landmarks live in relations)", () => {
    expect(world.counts.multipolygonBuildings).toBeGreaterThan(20);
    const multi = world.buildings.filter((b) => b.kind.includes("multipolygon"));
    expect(multi.length).toBe(world.counts.multipolygonBuildings);
    for (const b of multi) expect(b.ring.length).toBeGreaterThan(3);
  });

  it("keeps named points of interest, with their shop/amenity class", () => {
    expect(world.counts.pois).toBeGreaterThan(1_000);
    expect(world.pois.filter((p) => p.name).length).toBeGreaterThan(900);
    expect(world.tags.shop.clothes ?? 0).toBeGreaterThan(20);
    expect(world.tags.amenity.restaurant ?? 0).toBeGreaterThan(50);
  });

  it("projects into local metres around the bbox centre", () => {
    const { toXZ } = project(KAMPPI);
    const centre = toXZ((KAMPPI.west + KAMPPI.east) / 2, (KAMPPI.south + KAMPPI.north) / 2);
    expect(centre[0]).toBeCloseTo(0, 6);
    expect(centre[1]).toBeCloseTo(0, 6);
    // North of the centre is negative z (z grows south), matching the game's world.
    const north = toXZ(KAMPPI.west, KAMPPI.north);
    expect(north[1]).toBeLessThan(0);
    // 0.001° of latitude is ~110 m.
    const centreLat = (KAMPPI.south + KAMPPI.north) / 2;
    const oneMilli = toXZ(KAMPPI.west, centreLat + 0.001);
    expect(Math.abs(oneMilli[1])).toBeGreaterThan(105);
    expect(Math.abs(oneMilli[1])).toBeLessThan(115);
  });

  it("respects the bbox: a 200 m square inside the extract keeps far less", () => {
    const small = { south: 60.169, west: 24.940, north: 60.1708, east: 24.9423 };
    const clipped = extractOsmWorld(bytes, small, inflate);
    expect(clipped.counts.buildings).toBeGreaterThan(5);
    expect(clipped.counts.buildings).toBeLessThan(world.counts.buildings / 3);
    // A kept building must touch the requested box; its centroid may sit outside (big blocks are
    // clipped at the edge rather than dropped).
    const halfX = ((small.east - small.west) * 111_320 * Math.cos((60.1695 * Math.PI) / 180)) / 2;
    const halfZ = ((small.north - small.south) * 110_540) / 2;
    for (const b of clipped.buildings) {
      const touches = b.ring.some(([x, z]) => Math.abs(x) <= halfX + 10 && Math.abs(z) <= halfZ + 10);
      expect(touches, `toà ${b.id} nằm ngoài khung`).toBe(true);
      expect(Math.abs(b.centroid[0])).toBeLessThan(halfX + 120);
      expect(Math.abs(b.centroid[1])).toBeLessThan(halfZ + 120);
    }
  });

  it("derives street widths from the highway class instead of one constant", () => {
    expect(roadWidthM("trunk")).toBeGreaterThan(roadWidthM("residential"));
    expect(roadWidthM("residential")).toBeGreaterThan(roadWidthM("footway"));
  });

  it("is deterministic", () => {
    const again = extractOsmWorld(bytes, KAMPPI, inflate);
    expect(again.counts.buildings).toBe(world.counts.buildings);
    expect(again.buildings[0].id).toBe(world.buildings[0].id);
    expect(again.buildings[0].areaM2).toBeCloseTo(world.buildings[0].areaM2, 3);
  });
}, 60_000);
