// Minimal, dependency-free OpenStreetMap PBF reader, and a bbox extractor that turns real OSM bytes
// into the data this game places geometry from (building footprints, street centrelines, named POIs).
//
// Why not a library: the game ships to the browser, this runs in Node during authoring, and the whole
// surface we need is ~350 lines of protobuf. `osmium`/`pyrosm` would add a native toolchain to a repo
// that has none.
//
// Format reference: https://wiki.openstreetmap.org/wiki/PBF_Format
//   file   = repeated ( int32be headerLength, BlobHeader, Blob )
//   Blob   = raw | zlib_data ;  PrimitiveBlock.granularity defaults to 100 nanodegrees.
//   DenseNodes/PackedWays store ids and coordinates as delta-encoded zigzag varints.
//
// Anything unsupported (LZMA blobs, relations) is skipped and counted, never silently guessed.

/** Decompressor for zlib blobs. Injected so this module stays free of Node imports (it is game code). */
export type Inflate = (data: Uint8Array) => Uint8Array;

export interface OsmBbox {
  /** Degrees. */
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OsmPoint {
  lon: number;
  lat: number;
}

export interface OsmBuilding {
  id: number;
  kind: string;
  name?: string;
  levels?: number;
  heightM?: number;
  /** Square metres, projected. */
  areaM2: number;
  /** Local metres: x east, z south, origin = bbox centre (see `project`). */
  centroid: [number, number];
  ring: Array<[number, number]>;
  tags: Record<string, string>;
}

export interface OsmRoad {
  id: number;
  highway: string;
  name?: string;
  oneway: boolean;
  widthM: number;
  /** Local metres. */
  points: Array<[number, number]>;
}

export interface OsmPoi {
  id: number;
  kind: string;
  name: string;
  lon: number;
  lat: number;
  tags: Record<string, string>;
}

export interface OsmWorld {
  bbox: OsmBbox;
  /** Extent of the nodes actually kept — lets `--auto` discover a file's footprint. */
  extent: OsmBbox;
  origin: { lon: number; lat: number };
  counts: {
    blobs: number;
    nodes: number;
    ways: number;
    nodesInBbox: number;
    buildings: number;
    roads: number;
    pois: number;
    skippedBlobs: number;
    unresolvedWays: number;
    relations: number;
    multipolygonBuildings: number;
  };
  buildings: OsmBuilding[];
  roads: OsmRoad[];
  pois: OsmPoi[];
  tags: { building: Record<string, number>; highway: Record<string, number>; shop: Record<string, number>; amenity: Record<string, number> };
}

// --- protobuf primitives -------------------------------------------------------------------------

class Reader {
  readonly bytes: Uint8Array;
  pos = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  get done(): boolean {
    return this.pos >= this.bytes.length;
  }

  varint(): number {
    let result = 0;
    let shift = 1;
    for (let i = 0; i < 10; i += 1) {
      const byte = this.bytes[this.pos];
      if (byte === undefined) throw new Error("truncated varint");
      this.pos += 1;
      result += (byte & 0x7f) * shift;
      if ((byte & 0x80) === 0) return result;
      shift *= 128;
    }
    throw new Error("varint too long");
  }

  /** int64 that may be negative (two's complement) — used only for offsets. */
  int64(): number {
    const lo = this.varint();
    return lo >= 0x8000000000000000 ? lo - 0x10000000000000000 : lo;
  }

  /** sint64 zigzag. */
  svarint(): number {
    const n = this.varint();
    return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
  }

  lengthDelimited(): Uint8Array {
    const length = this.varint();
    const out = this.bytes.subarray(this.pos, this.pos + length);
    if (out.length !== length) throw new Error("truncated length-delimited field");
    this.pos += length;
    return out;
  }

  skip(wire: number): void {
    switch (wire) {
      case 0:
        this.varint();
        return;
      case 1:
        this.pos += 8;
        return;
      case 2:
        this.pos += this.varint();
        return;
      case 5:
        this.pos += 4;
        return;
      default:
        throw new Error(`unsupported wire type ${wire}`);
    }
  }
}

interface Field {
  field: number;
  wire: number;
  value?: number;
  bytes?: Uint8Array;
}

function* fields(bytes: Uint8Array): Generator<Field> {
  const reader = new Reader(bytes);
  while (!reader.done) {
    const key = reader.varint();
    const field = key >>> 3;
    const wire = key & 7;
    if (wire === 0) yield { field, wire, value: reader.varint() };
    else if (wire === 2) yield { field, wire, bytes: reader.lengthDelimited() };
    else {
      reader.skip(wire);
      yield { field, wire };
    }
  }
}

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const zigzag = (n: number): number => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);

/** Packed varints (sint64 or uint32) into a plain array. */
function packed(bytes: Uint8Array, zigzag: boolean): number[] {
  const out: number[] = [];
  const reader = new Reader(bytes);
  while (!reader.done) out.push(zigzag ? reader.svarint() : reader.varint());
  return out;
}

// --- PBF container -------------------------------------------------------------------------------

interface BlobRef {
  type: string;
  data: Uint8Array;
}

function readBlobs(file: Uint8Array, inflate: Inflate): { blobs: BlobRef[]; skipped: number } {
  const blobs: BlobRef[] = [];
  let skipped = 0;
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let pos = 0;
  while (pos + 4 <= file.length) {
    const headerLength = view.getInt32(pos, false);
    pos += 4;
    const header = new Reader(file.subarray(pos, pos + headerLength));
    pos += headerLength;
    let type = "";
    let dataSize = 0;
    for (const f of fields(header.bytes)) {
      if (f.field === 1 && f.bytes) type = text(f.bytes);
      if (f.field === 3 && f.value !== undefined) dataSize = f.value;
    }
    const blobBytes = file.subarray(pos, pos + dataSize);
    pos += dataSize;

    let raw: Uint8Array | undefined;
    let rawSize = 0;
    let zlib: Uint8Array | undefined;
    for (const f of fields(blobBytes)) {
      if (f.field === 1 && f.bytes) raw = f.bytes;
      else if (f.field === 2 && f.value !== undefined) rawSize = f.value;
      else if (f.field === 3 && f.bytes) zlib = f.bytes;
    }
    if (raw) blobs.push({ type, data: raw });
    else if (zlib) {
      const inflated = inflate(zlib);
      if (rawSize && inflated.length !== rawSize) throw new Error("zlib blob size mismatch");
      blobs.push({ type, data: inflated });
    } else skipped += 1;
  }
  return { blobs, skipped };
}

// --- PrimitiveBlock ------------------------------------------------------------------------------

const HIGHWAY_WIDTH_M: Record<string, number> = {
  motorway: 15,
  motorway_link: 7,
  trunk: 13,
  trunk_link: 7,
  primary: 11,
  primary_link: 6,
  secondary: 9,
  secondary_link: 6,
  tertiary: 8,
  tertiary_link: 5,
  unclassified: 6,
  residential: 6,
  living_street: 5,
  service: 4,
  pedestrian: 6,
  footway: 2.4,
  path: 2,
  cycleway: 2.4,
  steps: 2,
  track: 3,
};

export function roadWidthM(highway: string): number {
  return HIGHWAY_WIDTH_M[highway] ?? 5;
}

interface ParseState {
  nodes: Map<number, OsmPoint>;
  wayRefs: Map<number, number[]>;
  pendingRelations: Array<{ tags: Record<string, string>; outer: number[]; inner: number[] }>;
  world: OsmWorld;
  onBuilding: (b: OsmBuilding) => void;
  onRoad: (r: OsmRoad) => void;
  onPoi: (p: OsmPoi) => void;
}

interface ParseTarget {
  /** Padded bbox used to decide what to keep (degrees). */
  keep: OsmBbox;
  /** Strict bbox for the final output. */
  bbox: OsmBbox;
}

/** Parse degrees → local metres around the bbox centre. */
export function project(bbox: OsmBbox) {
  const lon0 = (bbox.west + bbox.east) / 2;
  const lat0 = (bbox.south + bbox.north) / 2;
  const mPerDegLat = 110_540;
  const mPerDegLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return {
    origin: { lon: lon0, lat: lat0 },
    toXZ(lon: number, lat: number): [number, number] {
      return [(lon - lon0) * mPerDegLon, -(lat - lat0) * mPerDegLat];
    },
  };
}

const inBbox = (lon: number, lat: number, b: OsmBbox): boolean =>
  lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

/** Read one PrimitiveBlock, calling back with tagged nodes and complete ways. */
function readBlock(data: Uint8Array, target: ParseTarget, state: ParseState): void {
  let granularity = 100;
  let latOffset = 0;
  let lonOffset = 0;
  let stringTable: string[] = [];
  const groups: Uint8Array[] = [];

  for (const f of fields(data)) {
    if (f.field === 1 && f.bytes) {
      stringTable = [];
      for (const s of fields(f.bytes)) if (s.field === 1 && s.bytes) stringTable.push(s.bytes.length ? text(s.bytes) : "");
    } else if (f.field === 2 && f.bytes) groups.push(f.bytes);
    else if (f.field === 17 && f.value !== undefined) granularity = f.value;
    else if (f.field === 19 && f.value !== undefined) latOffset = f.value;
    else if (f.field === 20 && f.value !== undefined) lonOffset = f.value;
  }

  const decode = (rawLat: number, rawLon: number): OsmPoint => ({
    lat: 1e-9 * (latOffset + granularity * rawLat),
    lon: 1e-9 * (lonOffset + granularity * rawLon),
  });

  const tagsOf = (keys: number[], vals: number[]): Record<string, string> => {
    const out: Record<string, string> = {};
    for (let i = 0; i < keys.length; i += 1) {
      const k = stringTable[keys[i]];
      const v = stringTable[vals[i]];
      if (k && v) out[k] = v;
    }
    return out;
  };

  for (const group of groups) {
    for (const f of fields(group)) {
      // 1: Node (non-dense)
      if (f.field === 1 && f.bytes) {
        let id = 0;
        let rawLat = 0;
        let rawLon = 0;
        const keys: number[] = [];
        const vals: number[] = [];
        for (const nf of fields(f.bytes)) {
          if (nf.field === 1 && nf.value !== undefined) id = nf.value;
          else if (nf.field === 8 && nf.wire === 0) rawLat = zigzag(nf.value as number);
          else if (nf.field === 9 && nf.wire === 0) rawLon = zigzag(nf.value as number);
          else if (nf.field === 2 && nf.bytes) keys.push(...packed(nf.bytes, false));
          else if (nf.field === 3 && nf.bytes) vals.push(...packed(nf.bytes, false));
        }
        const p = decode(rawLat, rawLon);
        state.world.counts.nodes += 1;
        if (inBbox(p.lon, p.lat, target.keep)) {
          state.nodes.set(id, p);
          state.world.counts.nodesInBbox += 1;
          const e = state.world.extent;
          if (p.lat < e.south) e.south = p.lat;
          if (p.lat > e.north) e.north = p.lat;
          if (p.lon < e.west) e.west = p.lon;
          if (p.lon > e.east) e.east = p.lon;
        }
        if (keys.length && inBbox(p.lon, p.lat, target.bbox)) {
          const tags = tagsOf(keys, vals);
          const kind = tags.shop ? `shop=${tags.shop}` : tags.amenity ? `amenity=${tags.amenity}` : tags.tourism ? `tourism=${tags.tourism}` : "";
          if (kind) {
            const name = tags.name ?? tags["name:vi"] ?? "";
            state.onPoi({ id, kind, name, lon: p.lon, lat: p.lat, tags });
          }
        }
        continue;
      }

      // 2: DenseNodes
      if (f.field === 2 && f.bytes) {
        const ids: number[] = [];
        const lats: number[] = [];
        const lons: number[] = [];
        const keyVals: number[] = [];
        for (const nf of fields(f.bytes)) {
          if (nf.field === 1 && nf.bytes) ids.push(...packed(nf.bytes, true));
          else if (nf.field === 8 && nf.bytes) lats.push(...packed(nf.bytes, true));
          else if (nf.field === 9 && nf.bytes) lons.push(...packed(nf.bytes, true));
          else if (nf.field === 10 && nf.bytes) keyVals.push(...packed(nf.bytes, false));
        }
        let id = 0;
        let rawLat = 0;
        let rawLon = 0;
        let kv = 0;
        for (let i = 0; i < ids.length; i += 1) {
          id += ids[i];
          rawLat += lats[i] ?? 0;
          rawLon += lons[i] ?? 0;
          state.world.counts.nodes += 1;
          const p = decode(rawLat, rawLon);
          const keep = inBbox(p.lon, p.lat, target.keep);
          if (keep) {
            state.nodes.set(id, p);
            state.world.counts.nodesInBbox += 1;
            const e = state.world.extent;
            if (p.lat < e.south) e.south = p.lat;
            if (p.lat > e.north) e.north = p.lat;
            if (p.lon < e.west) e.west = p.lon;
            if (p.lon > e.east) e.east = p.lon;
          }
          // Tags, in the same order, terminated by a zero key per node.
          const keys: number[] = [];
          const vals: number[] = [];
          while (kv < keyVals.length && keyVals[kv] !== 0) {
            keys.push(keyVals[kv]);
            vals.push(keyVals[kv + 1] ?? 0);
            kv += 2;
          }
          kv += 1; // skip the 0 terminator
          if (keys.length && inBbox(p.lon, p.lat, target.bbox)) {
            const tags = tagsOf(keys, vals);
            const kind = tags.shop ? `shop=${tags.shop}` : tags.amenity ? `amenity=${tags.amenity}` : tags.tourism ? `tourism=${tags.tourism}` : "";
            if (kind) {
              const name = tags.name ?? tags["name:vi"] ?? "";
              state.onPoi({ id, kind, name, lon: p.lon, lat: p.lat, tags });
            }
          }
        }
        continue;
      }

      // 3: Way
      if (f.field === 3 && f.bytes) {
        let id = 0;
        const keys: number[] = [];
        const vals: number[] = [];
        const refs: number[] = [];
        for (const wf of fields(f.bytes)) {
          if (wf.field === 1 && wf.value !== undefined) id = wf.value;
          else if (wf.field === 2 && wf.bytes) keys.push(...packed(wf.bytes, false));
          else if (wf.field === 3 && wf.bytes) vals.push(...packed(wf.bytes, false));
          else if (wf.field === 8 && wf.bytes) {
            // refs are sint64 delta-encoded
            const reader = new Reader(wf.bytes);
            let prev = 0;
            while (!reader.done) {
              prev += reader.svarint();
              refs.push(prev);
            }
          }
        }
        state.world.counts.ways += 1;
        if (refs.length >= 2) state.wayRefs.set(id, refs);
        const tags = tagsOf(keys, vals);
        const isBuilding = "building" in tags || "building:part" in tags;
        const isRoad = "highway" in tags;
        if (!isBuilding && !isRoad) continue;

        const points: OsmPoint[] = [];
        for (const ref of refs) {
          const node = state.nodes.get(ref);
          if (node) points.push(node);
        }
        if (points.length < 2) {
          state.world.counts.unresolvedWays += 1;
          continue;
        }
        const inside = points.some((p) => inBbox(p.lon, p.lat, target.bbox));
        if (!inside) continue;

        const proj = project(target.bbox);
        const xz = points.map((p) => proj.toXZ(p.lon, p.lat));

        if (isBuilding && points.length >= 3) {
          const area = Math.abs(
            xz.reduce((sum, [x, z], i) => {
              const [nx, nz] = xz[(i + 1) % xz.length];
              return sum + (x * nz - nx * z);
            }, 0) / 2,
          );
          if (area < 8) continue; // sheds the size of a motorcycle; noise at our scale
          const cx = xz.reduce((s, [x]) => s + x, 0) / xz.length;
          const cz = xz.reduce((s, [, z]) => s + z, 0) / xz.length;
          const levels = tags["building:levels"] ? Number.parseFloat(tags["building:levels"]) : undefined;
          const height = tags.height ? Number.parseFloat(tags.height) : undefined;
          state.onBuilding({
            id,
            kind: tags.building ?? "yes",
            name: tags.name,
            levels: Number.isFinite(levels) ? levels : undefined,
            heightM: Number.isFinite(height) ? height : undefined,
            areaM2: area,
            centroid: [cx, cz],
            ring: xz,
            tags,
          });
        } else if (isRoad) {
          state.onRoad({
            id,
            highway: tags.highway,
            name: tags.name,
            oneway: tags.oneway === "yes" || tags.oneway === "1" || tags.oneway === "-1",
            widthM: roadWidthM(tags.highway),
            points: xz,
          });
        }
        continue;
      }

      // 4: Relation — only multipolygon buildings are used (landmarks and malls live here).
      if (f.field === 4 && f.bytes) {
        state.world.counts.relations += 1;
        const keys: number[] = [];
        const vals: number[] = [];
        const roles: number[] = [];
        const memberIds: number[] = [];
        const memberTypes: number[] = [];
        for (const rf of fields(f.bytes)) {
          if (rf.field === 2 && rf.bytes) keys.push(...packed(rf.bytes, false));
          else if (rf.field === 3 && rf.bytes) vals.push(...packed(rf.bytes, false));
          else if (rf.field === 8 && rf.bytes) roles.push(...packed(rf.bytes, false));
          else if (rf.field === 9 && rf.bytes) memberIds.push(...packed(rf.bytes, true));
          else if (rf.field === 10 && rf.bytes) memberTypes.push(...packed(rf.bytes, false));
        }
        const tags = tagsOf(keys, vals);
        if (!("building" in tags) || tags.type !== "multipolygon") continue;
        const outer: number[] = [];
        const inner: number[] = [];
        let idCursor = 0;
        for (let i = 0; i < memberIds.length; i += 1) {
          idCursor += memberIds[i];
          if (memberTypes[i] !== 1) continue; // ways only
          const role = stringTable[roles[i]] ?? "";
          if (role === "outer" || role === "") outer.push(idCursor);
          else if (role === "inner") inner.push(idCursor);
        }
        if (outer.length) state.pendingRelations.push({ tags, outer, inner });
      }
    }
  }
}

/** Join way point-lists end to end into closed rings. */
function assembleRings(ways: OsmPoint[][]): Array<OsmPoint[]> {
  const pool = ways.filter((w) => w.length >= 2).map((w) => [...w]);
  const rings: Array<OsmPoint[]> = [];
  while (pool.length) {
    let ring = pool.shift() as OsmPoint[];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < pool.length; i += 1) {
        const candidate = pool[i];
        const end = ring[ring.length - 1];
        const start = ring[0];
        if (candidate[0].lat === end.lat && candidate[0].lon === end.lon) {
          ring = ring.concat(candidate.slice(1));
        } else if (candidate[candidate.length - 1].lat === end.lat && candidate[candidate.length - 1].lon === end.lon) {
          ring = ring.concat([...candidate].reverse().slice(1));
        } else if (candidate[candidate.length - 1].lat === start.lat && candidate[candidate.length - 1].lon === start.lon) {
          ring = candidate.slice(0, -1).concat(ring);
        } else if (candidate[0].lat === start.lat && candidate[0].lon === start.lon) {
          ring = [...candidate].reverse().slice(0, -1).concat(ring);
        } else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length >= 4) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first.lat === last.lat && first.lon === last.lon) ring = ring.slice(0, -1);
      if (ring.length >= 3) rings.push(ring);
    }
  }
  return rings;
}

function ringAreaM2(xz: Array<[number, number]>): number {
  return Math.abs(
    xz.reduce((sum, [x, z], i) => {
      const [nx, nz] = xz[(i + 1) % xz.length];
      return sum + (x * nz - nx * z);
    }, 0) / 2,
  );
}

/** Parse a `.osm.pbf` file and keep what falls inside `bbox`. */
export function extractOsmWorld(file: Uint8Array, bbox: OsmBbox, inflate: Inflate): OsmWorld {
  const { blobs, skipped } = readBlobs(file, inflate);
  const padLon = 0.002;
  const padLat = 0.002;
  const keep: OsmBbox = {
    south: bbox.south - padLat,
    west: bbox.west - padLon,
    north: bbox.north + padLat,
    east: bbox.east + padLon,
  };
  const world: OsmWorld = {
    bbox,
    extent: { south: Infinity, west: Infinity, north: -Infinity, east: -Infinity },
    origin: project(bbox).origin,
    counts: {
      blobs: blobs.length,
      nodes: 0,
      ways: 0,
      nodesInBbox: 0,
      buildings: 0,
      roads: 0,
      pois: 0,
      skippedBlobs: skipped,
      unresolvedWays: 0,
      relations: 0,
      multipolygonBuildings: 0,
    },
    buildings: [],
    roads: [],
    pois: [],
    tags: { building: {}, highway: {}, shop: {}, amenity: {} },
  };

  const state: ParseState = {
    nodes: new Map<number, OsmPoint>(),
    /** refs per way, so multipolygon relations can rebuild their rings after the fact. */
    wayRefs: new Map<number, number[]>(),
    pendingRelations: [],
    world,
    onBuilding: (b: OsmBuilding) => {
      world.buildings.push(b);
      world.counts.buildings += 1;
      bump(world.tags.building, b.kind);
      if (b.tags.shop) bump(world.tags.shop, b.tags.shop);
      if (b.tags.amenity) bump(world.tags.amenity, b.tags.amenity);
    },
    onRoad: (r: OsmRoad) => {
      world.roads.push(r);
      world.counts.roads += 1;
      bump(world.tags.highway, r.highway);
    },
    onPoi: (p: OsmPoi) => {
      world.pois.push(p);
      world.counts.pois += 1;
      if (p.kind.startsWith("shop=")) bump(world.tags.shop, p.kind.slice(5));
      if (p.kind.startsWith("amenity=")) bump(world.tags.amenity, p.kind.slice(8));
    },
  };

  for (const blob of blobs) {
    // Header blobs carry only the required feature list; data blobs carry the entities.
    if (blob.type === "OSMHeader") continue;
    readBlock(blob.data, { keep, bbox }, state);
  }

  // Multipolygon buildings, resolved after every way is known.
  const projAll = project(bbox);
  for (const rel of state.pendingRelations) {
    const outers = rel.outer.map((wayId) => state.wayRefs.get(wayId)).filter((r): r is number[] => !!r);
    const outerPoints = outers.map((refs) => refs.map((ref) => state.nodes.get(ref)).filter((p): p is OsmPoint => !!p));
    const rings = assembleRings(outerPoints);
    if (!rings.length) continue;
    // Same rule as ways: keep it only if some part of it actually falls in the requested box.
    if (!rings.some((ring) => ring.some((p) => inBbox(p.lon, p.lat, bbox)))) continue;
    let area = 0;
    const allXZ: Array<[number, number]> = [];
    let cx = 0;
    let cz = 0;
    for (const ring of rings) {
      const xz = ring.map((p) => projAll.toXZ(p.lon, p.lat));
      area += ringAreaM2(xz);
      for (const p of xz) allXZ.push(p);
      const rx = xz.reduce((sum, [x]) => sum + x, 0) / xz.length;
      const rz = xz.reduce((sum, [, z]) => sum + z, 0) / xz.length;
      cx += rx * ringAreaM2(xz);
      cz += rz * ringAreaM2(xz);
    }
    // Inner rings are subtracted when they resolve, so courtyards do not inflate a landmark.
    const inners = rel.inner.map((wayId) => state.wayRefs.get(wayId)).filter((r): r is number[] => !!r);
    for (const refs of inners) {
      const pts = refs.map((ref) => state.nodes.get(ref)).filter((p): p is OsmPoint => !!p);
      const ring = assembleRings([pts]);
      for (const r of ring) area -= ringAreaM2(r.map((p) => projAll.toXZ(p.lon, p.lat)));
    }
    if (area < 20) continue;
    const levels = rel.tags["building:levels"] ? Number.parseFloat(rel.tags["building:levels"]) : undefined;
    const height = rel.tags.height ? Number.parseFloat(rel.tags.height) : undefined;
    world.buildings.push({
      id: -state.world.buildings.length - 1,
      kind: `${rel.tags.building ?? "yes"} (multipolygon)`,
      name: rel.tags.name,
      levels: Number.isFinite(levels) ? levels : undefined,
      heightM: Number.isFinite(height) ? height : undefined,
      areaM2: Math.max(0, area),
      centroid: [cx / Math.max(1, area), cz / Math.max(1, area)],
      ring: allXZ,
      tags: rel.tags,
    });
    world.counts.multipolygonBuildings += 1;
    world.counts.buildings += 1;
    bump(world.tags.building, rel.tags.building ?? "yes");
  }

  // An outer way of a multipolygon often keeps its own `building` tag: drop the duplicate.
  const bigRings = world.buildings.filter((b) => b.kind.includes("multipolygon"));
  if (bigRings.length) {
    const kept: OsmBuilding[] = [];
    for (const b of world.buildings) {
      if (!b.kind.includes("multipolygon")) {
        const dup = bigRings.some(
          (m) => Math.hypot(m.centroid[0] - b.centroid[0], m.centroid[1] - b.centroid[1]) < 15 && b.areaM2 < m.areaM2 * 0.6,
        );
        if (dup) {
          world.counts.buildings -= 1;
          continue;
        }
      }
      kept.push(b);
    }
    world.buildings = kept;
  }

  // Deterministic output: biggest footprints first, then longest streets.
  world.buildings.sort((a, b) => b.areaM2 - a.areaM2);
  world.roads.sort((a, b) => b.points.length - a.points.length);
  return world;
}
