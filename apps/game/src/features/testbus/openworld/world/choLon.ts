// CHỢ LỚN, QUẬN 5 — the market block at the end of Route 06.
//
// Why this file exists: `WorldStreamer.getZone` has returned `zone.choLonStop` / `district.d5` for
// the corridor at |z+128| < 18 since the bus was built, but no chunk ever built anything there. The
// bus arrived at z = -128, the doors opened, and the player stepped into a walkable corridor with
// nothing in it. Mission 02's entire destination is this block, so it had to be authored.
//
// What shaped it, and what the first renders got wrong (see §10 of the build plan):
//   - Chợ Lớn in the morning is read from above as an OVERLAPPING FIELD OF VENDOR CANOPIES over a
//     well of produce, with shophouse façades behind. The first version put a continuous tin roof
//     over the whole frontage and the canopies became invisible: a warehouse row, not a market. The
//     canopies are now the roof, at eye height above the stalls, in two overlapping rows.
//   - The district's institutions (temples, assembly halls) worked as dialect-group associations:
//     mutual support, commerce, reputation. That is why a shopkeeper keeping a stranger's receipts
//     is ordinary here. It is carried in writing, not in geometry (§10.5).
//   - The walkable corridor is x ∈ [-19.5, 7]. The first version put the frontage at x = -12.6 and
//     the stalls at x = -14.5, so the player would have walked a road and looked at a closed shop
//     across a pavement. The frontage now stands at x = -8.4 and the truck lane backs it.
//
// Deliberately NOT here: a temple set piece, interiors, animated vendors, a second district.
// Geometry conventions are copied from the neighbouring chunks: modular box/plane/rod composition,
// CURB_HEIGHT for anything on the pavement, `solids.push(rect(...))` for every volume the player
// must not walk through, and a streamer registration so the chunk streams like the rest.
import * as T from "three";
import { CURB_HEIGHT, rect, type Solid } from "../simulation/boarding";
import { box, contact, contactMaterial, material, plane, random, rod, tube } from "../simulation/scene-kit";
import {
  createCorrugatedTinPBR,
  createGranitePlazaPBR,
  createSaigonAsphaltPBR,
  createWorldFacadePBR,
} from "./pbrTextures";
import type { PooledLightSpec } from "./boardingHouse";
import type { WorldStreamer } from "./WorldStreamer";

/** Where the bus drops the player. Must match `ROUTE.destinationZ` in `simulation/transit.ts`. */
export const CHO_LON_Z = -128;
/** The market frontage, standing inside the walkable corridor (x ∈ [-19.5, 7]). */
const FRONT_X = -8.4;
/** The truck/scooter lane that backs the market — why a market opens onto a street, not a road. */
const LANE_X = -17.4;
/** Depth of the covered market, from the frontage back into the block. */
const DEPTH = 5.6;
/** The block spans this z range: wide enough that the corridor reads as a place, not a pocket. */
const Z0 = -104;
const Z1 = -152;
/** Stall pitch along z: one bay per 3.05 m, the width of a real Chợ Lớn shophouse bay. */
const BAY = 3.05;
/** Service-alley cross-section. */
const ALLEY_Z = -132;
const ALLEY_W = 3.1;

/**
 * Canopy palette, sampled from photographs of the district's morning market and then corrected once
 * I had actually looked at them. The first pass used brown, navy, bottle green, mauve and sand — a
 * plausible-sounding list that made the market look like a festival. The photographs disagree: the
 * fabric over these stalls is almost colourless. Cold grey, dusty white, deep navy, slate blue, and
 * a green that has been in the sun too long. Ten thousand morning markets fade the same way, and a
 * market that has faded together reads as a place; one in five bright colours reads as a render.
 */
const CANOPY_COLORS = [
  // Ordered by how often they appear in the photographs: the dark ones carry the field, the pale
  // ones are what makes it read as fifty separate vendors rather than a tarpaulin.
  "#2b3a52",
  "#39424e",
  "#31463f",
  "#6f7378",
  "#b6b1a4",
] as const;

const frameMat = () => material(0x8d9298, 0.44, 0.62);
const plasticRed = () => material(0xa4322a, 0.62, 0.04);
const plasticBlue = () => material(0x2c4c72, 0.62, 0.04);

export interface ChoLonHandles {
  root: T.Group;
  solids: Solid[];
  lightSpecs: PooledLightSpec[];
  /**
   * Cô Ba's stall, described from the customer's side of the counter: `x, z` is where a person
   * stands to talk to her, and `yaw` is the facing toward her. The vendor's own position is
   * `x - 1.05` — derive it, do not duplicate it.
   *
   * The first version returned the vendor's spot and called it the stall, so the QA camera stood
   * inside the glass case and photographed the inside of the display. A handle that is ambiguous
   * about *whose* position it is will eventually be used by the wrong side.
   */
  cobaStall: { x: number; z: number; yaw: number };
  /**
   * The nail the bills hang on. Mission 02's W6 inspect verb is aimed here, and the receipt is the
   * proof object of the whole mission, so its address belongs to the geometry that built it.
   */
  receiptNail: { x: number; y: number; z: number };
  /** The two bus shelters: the Chợ Lớn stop the player arrives at, and Lý Thái Tổ where they left. */
  busStops: { x: number; z: number; yaw: number }[];
}

export function buildChoLon(
  root: T.Group,
  streamer: WorldStreamer,
  solids: Solid[],
  lightSpecs: PooledLightSpec[],
  seed = 5173,
): ChoLonHandles {
  const chunk = new T.Group();
  chunk.name = "ChoLonMarket";
  root.add(chunk);
  const lightSpecsLocal: PooledLightSpec[] = [];
  const rand = random(seed);
  const midZ = (Z0 + Z1) / 2;
  const spanZ = Z0 - Z1;

  // ---------------------------------------------------------------------------
  // GROUND — market floor, the customer strip, and the truck lane behind it
  //
  // Three different surfaces, because they are three different things: stained concrete under the
  // stalls, patched pavement where people stand, and a rutted asphalt lane where the trucks idle.
  // ---------------------------------------------------------------------------
  // These three planes fill the lower half of every frame in the block, so they are the last place a
  // flat colour is acceptable. They use the same scanned Saigon surfaces as the neighbouring chunks:
  // slab, concrete and asphalt. Repeat counts are chosen so every tile is ~2.8 m, so the paving does
  // not change size as the player walks from the market floor to the pavement to the lane.
  const marketFloor = createGranitePlazaPBR(2, 17);
  marketFloor.color = new T.Color(0x8a857c); // washed concrete, not polished granite
  const pavement = createGranitePlazaPBR(3, 17);
  const lane = createSaigonAsphaltPBR(1, 17);
  plane(chunk, [FRONT_X - DEPTH / 2, 0.02, midZ], [DEPTH, spanZ], marketFloor, 0, -Math.PI / 2);
  plane(chunk, [FRONT_X + 3.4, 0.022, midZ], [6.8, spanZ], pavement, 0, -Math.PI / 2);
  plane(chunk, [LANE_X, 0.018, midZ], [2.8, spanZ], lane, 0, -Math.PI / 2);

  // The block must be *bigger than the shot*. The walkable corridor is x ∈ [-19.5, 7] and these
  // planes cover x ∈ [-19.3, 3.6]; the first frames ended the pavement in mid-air about 8 m from the
  // camera, which reads as a bug even though the far side is technically off-limits. A market does
  // not stop at the edge of the pavement, so the ground runs on under the neighbouring blocks and
  // the camera never finds an edge.
  // This is the *whole* walkable corridor plus 12 m of slack on each side, not a decorative apron.
  // The corridor is x ∈ [-19.5, 7]; the pavement only reaches x = -1.6, so a camera standing at
  // x = 2.6 — which is where the bus doors open — had four metres of nothing between its feet and
  // the paving, and every frame ended in the void a few metres out.
  const WALK_MIN_X = -19.5;
  const WALK_MAX_X = 7;
  const SLACK = 12;
  const groundMinX = WALK_MIN_X - SLACK;
  const groundMaxX = WALK_MAX_X + SLACK;
  const groundW = groundMaxX - groundMinX;
  const apron = createGranitePlazaPBR(Math.round(groundW / 2.4), Math.round((spanZ + 26) / 2.4));
  apron.color = new T.Color(0x6f6b64);
  plane(chunk, [(groundMinX + groundMaxX) / 2, 0.014, midZ], [groundW, spanZ + 26], apron, 0, -Math.PI / 2);
  // ...and a kerb along the lane, because a 6 cm step is what tells the eye where the road starts.
  const kerb = createWorldFacadePBR("concrete_wall_007", "#8e8a82", 1.6, 0.8, 0.94);
  box(chunk, [LANE_X + 1.55, CURB_HEIGHT / 2, midZ], [0.22, CURB_HEIGHT, spanZ + 26], kerb, false);
  // Fill the two metres between the lane edge and the market floor: that was the one remaining strip
  // of sky visible from under the canopies.
  const gutter = createSaigonAsphaltPBR(1, 20);
  plane(chunk, [(LANE_X + 1.4 + FRONT_X - DEPTH) / 2, 0.016, midZ], [2.4, spanZ], gutter, 0, -Math.PI / 2);

  // Expansion joints across the market floor: the single cheapest thing that stops a big flat plane
  // looking like a void.
  const joint = material(0x453f38, 0.98, 0.01);
  for (let z = Z1 + 4; z < Z0; z += 4.2) {
    box(chunk, [FRONT_X - DEPTH / 2, 0.006, z], [DEPTH, 0.006, 0.05], joint, false);
  }
  // Standing water: this floor is washed down every morning and never fully dries.
  const wet = new T.MeshStandardMaterial({ color: 0x3d4a4e, roughness: 0.12, metalness: 0.1 });
  for (let i = 0; i < 9; i++) {
    const wx = FRONT_X - 0.6 - rand() * (DEPTH - 1.2);
    const wz = Z1 + 3 + rand() * (spanZ - 6);
    plane(chunk, [wx, 0.024, wz], [0.7 + rand() * 1.1, 0.4 + rand() * 0.8], wet, rand() * Math.PI, -Math.PI / 2);
  }
  // Painted bay lines on the pavement, faded to almost nothing — municipal paint, twenty years old.
  const paint = material(0x9c9a86, 0.95, 0.01);
  for (let z = Z1 + 6; z < Z0; z += 6.1) {
    box(chunk, [FRONT_X + 1.9, 0.026, z], [2.6, 0.005, 0.09], paint, false);
  }

  // ---------------------------------------------------------------------------
  // THE SHOPHOUSE WALL BEHIND THE STALLS
  //
  // One continuous volume: from the street you never see its far side, and a long shophouse terrace
  // is exactly how Chợ Lớn reads at eye level. Braked with pilasters and a parapet so it does not
  // read as a hangar.
  // ---------------------------------------------------------------------------
  // The terrace wall used to be a single FlatColor 0xb0a696 over 48 m, which is 48 m of nothing.
  // `createWorldFacadePBR` projects UVs from world space, so one tile covers a fixed ~3.4 m of wall
  // however long the box is — the same function, and the same weathering shader, as the D1 frontages.
  const stucco = createWorldFacadePBR("painted_plaster_wall", "#c9bda9", 3.4, 1.0, 0.9);
  const stuccoWarm = createWorldFacadePBR("clay_plaster", "#d3c0a4", 3.4, 0.9, 0.88);
  const backX = FRONT_X - DEPTH + 0.42;
  const wallH = 7.6;
  box(chunk, [backX, wallH / 2, midZ], [0.92, wallH, spanZ], stucco);
  box(chunk, [backX, wallH + 0.15, midZ], [1.16, 0.3, spanZ], createWorldFacadePBR("concrete_wall_007", "#b6ada0", 2.0, 0.7, 0.92), false);
  for (let z = Z1 + BAY; z < Z0; z += BAY * 4) {
    box(chunk, [backX + 0.52, wallH / 2, z], [0.16, wallH - 0.2, 0.4], stuccoWarm, false);
  }
  // Ground-floor openings behind the stalls: warm interior recesses, not texture. This is what the
  // player sees past the canopies, and depth is what sells the block.
  // A shophouse interior at 08:40 is dim but never black: a fluorescent tube over a counter, spill
  // from the street. The first version used 0x17140f at 0.3 emissive and rendered as a void — which
  // put the mission's receipt string against pure black and made the prop unreadable.
  const recessMat = new T.MeshStandardMaterial({
    color: 0x2b2418,
    emissive: new T.Color(0xffd9a0),
    emissiveIntensity: 0.62,
    roughness: 0.88,
    metalness: 0.02,
  });
  for (let z = Z1 + BAY / 2; z < Z0; z += BAY) {
    plane(chunk, [backX + 0.48, 1.4, z], [2.4, 2.4], recessMat, Math.PI / 2);
  }
  // First-floor windows: dark, some with a light on. Two per bay would be too regular, so the
  // pattern repeats every five bays.
  const windowMat = new T.MeshStandardMaterial({
    color: 0x2a2b28,
    emissive: new T.Color(0xffe0b0),
    emissiveIntensity: 0.06,
    roughness: 0.36,
    metalness: 0.2,
  });
  const litWindow = new T.MeshStandardMaterial({
    color: 0x2a2b28,
    emissive: new T.Color(0xffd79a),
    emissiveIntensity: 0.42,
    roughness: 0.36,
    metalness: 0.2,
  });
  for (let z = Z1 + 1.4; z < Z0; z += 2.4) {
    const lit = Math.floor((z - Z1) / 2.4) % 7 === 2;
    plane(chunk, [backX + 0.47, 4.5, z], [1.15, 1.45], lit ? litWindow : windowMat, Math.PI / 2);
    // Burglar bars: every ground-floor window in this district has them.
    for (let b = 0; b < 4; b++) {
      box(chunk, [backX + 0.44, 3.82 + b * 0.42, z], [0.03, 0.03, 1.2], frameMat(), false);
    }
  }
  solids.push(rect(backX, midZ, 0.92, spanZ));

  // ---------------------------------------------------------------------------
  // THE CANOPY FIELD — the district's roof (§1b.6)
  //
  // 26 canopies in two overlapping rows at 2.6–3.0 m, which is the height a vendor's frame actually
  // reaches and low enough that the player walks *under* the market rather than past it. The first
  // render failed here: 14 canopies at 3.4 m under a continuous tin roof read as awnings on a
  // warehouse. Fabric is now the only roof over the stalls.
  // ---------------------------------------------------------------------------
  // A canopy lane, not a row of parasols. Three staggered files over the walkway, a canopy every
  // ~1.6 m of frontage, 2.15–2.45 m up: low enough that the player walks *under* the market, dense
  // enough that the fabric reads as a ceiling from the street. This is the one thing the reference
  // photographs are unambiguous about, and the first version got it wrong twice — once with a tin
  // roof over everything, once with canopies too few and too high.
  // Four files, and every one of them is OUTSIDE the frontage line.
  //
  // The third version put the "mid-walkway" and "over the kerb" files at FRONT_X - 3.15 and -5.05,
  // which is *behind* the shopfronts, between the stalls and the back wall. The aerial frame showed
  // it immediately: a strip of fabric over the produce and 12 m of open pavement where the player
  // actually walks. The brief is "approaches her by walking under fabric", so the field has to hang
  // over the customer strip — from just inside the stall edge out to the kerb.
  const canopyCount = 56;
  for (let i = 0; i < canopyCount; i++) {
    const file = i % 4;
    const k = Math.floor(i / 4);
    const z = Z1 + 1.4 + (k / 13) * (spanZ - 2.8) + (rand() - 0.5) * 0.4;
    // -0.9 (stall edge, rigged to the eave) → +3.4 (over the kerb, on ground stems).
    const x = FRONT_X + (file === 0 ? -0.9 : file === 1 ? 0.9 : file === 2 ? 2.3 : 3.5) - rand() * 0.3;
    const size = 2.35 + rand() * 0.7;
    const yaw = (rand() - 0.5) * 0.55;
    const tilt = (rand() - 0.5) * 0.15;
    const y = 2.16 + rand() * 0.3 + (file === 2 ? 0.12 : 0);
    const cloth = new T.MeshStandardMaterial({
      color: CANOPY_COLORS[i % CANOPY_COLORS.length],
      roughness: 0.9,
      metalness: 0.02,
      side: T.DoubleSide,
    });
    const canopy = new T.Mesh(new T.ConeGeometry(size, 0.62, 4, 1, true), cloth);
    canopy.position.set(x, y, z);
    canopy.rotation.set(tilt, yaw + Math.PI / 4, tilt * 0.6);
    canopy.castShadow = true;
    chunk.add(canopy);
    // The hem: a darker rim band, which is what makes overlapping canopies read as separate objects
    // rather than one continuous tent.
    const rim = new T.Mesh(new T.TorusGeometry(size * 0.708, 0.032, 4, 4), material(0x2c2924, 0.86, 0.05));
    rim.position.copy(canopy.position);
    rim.rotation.set(Math.PI / 2 + tilt, yaw, 0);
    chunk.add(rim);
    // Stems only on the files that stand on the ground: the stall file hangs from the eave purlins,
    // which is how a market vendor actually rigs a canopy.
    if (file > 0) {
      rod(chunk, [x - tilt * 1.2, CURB_HEIGHT, z], [x, y - 0.36, z], 0.032, frameMat(), 0.027, 6);
    } else {
      rod(chunk, [x, y + 0.9, z], [x, y - 0.36, z], 0.022, frameMat(), 0.02, 5);
    }
  }

  // The narrow permanent eave over the back wall: enough to keep stock dry, narrow enough that it
  // never becomes the roof of the market.
  const tin = createCorrugatedTinPBR("#7d8b93", "#6b442b", 2, 1);
  const eave = box(chunk, [backX + 0.95, 3.32, midZ], [2.5, 0.08, spanZ + 0.3], tin, false);
  eave.rotation.z = 0.085;
  for (let z = Z1 + 1.2; z < Z0; z += 3.2) {
    box(chunk, [backX + 0.95, 3.18, z], [2.6, 0.1, 0.12], material(0x4a4f52, 0.62, 0.5), false);
  }

  // ---------------------------------------------------------------------------
  // STALLS — a line of tables under the fabric, not an open hall.
  //
  // Each bay: a trestle table at 0.78 m (the height a vendor works at), produce crates, and two
  // plastic stools on the customer side. Some bays are shuttered: a market at 11:30 is half-packed,
  // and the asymmetry is what makes it read as a working day rather than a set.
  // ---------------------------------------------------------------------------
  const tableTop = material(0x9a8b72, 0.88, 0.02);
  const tableLeg = material(0x474b4e, 0.5, 0.55);
  const crateMats = [material(0x7c5a3a, 0.92, 0.02), material(0x5d6b4a, 0.9, 0.02), material(0x8a6b4b, 0.92, 0.02)];
  let bay = 0;
  for (let z = Z1 + BAY / 2; z < Z0 - BAY / 2; z += BAY, bay++) {
    const shuttered = bay % 5 === 3;
    const x = FRONT_X - 1.55;
    if (!shuttered) {
      box(chunk, [x, 0.78, z], [1.6, 0.08, 2.15], tableTop);
      for (const sx of [-0.68, 0.68]) {
        for (const sz of [-0.94, 0.94]) {
          box(chunk, [x + sx, 0.39, z + sz], [0.06, 0.78, 0.06], tableLeg, false);
        }
      }
      // Produce: stacked crates of descending height, so the stall line is not a grid.
      const crates = 2 + (bay % 3);
      for (let c = 0; c < crates; c++) {
        const cz = z - 0.78 + c * 0.64;
        const h = 0.17 + ((bay + c) % 3) * 0.06;
        box(chunk, [x - 0.05, 0.82 + h / 2, cz], [1.2, h, 0.52], crateMats[(bay + c) % 3], false);
        // A mound of produce above the crate rim: three small boxes, never aligned.
        for (let g = 0; g < 3; g++) {
          box(
            chunk,
            [x - 0.05 + (g - 1) * 0.34, 0.82 + h + 0.05, cz + ((g % 2) - 0.5) * 0.16],
            [0.28, 0.1, 0.28],
            crateMats[(bay + g + 1) % 3],
            false,
          );
        }
      }
      // Stools on the customer side, one red one blue: the two colours every pavement in the
      // country uses, and free local colour.
      const stoolMat = bay % 2 === 0 ? plasticRed() : plasticBlue();
      for (const sz of [-0.6, 0.6]) {
        const seat = new T.Mesh(new T.CylinderGeometry(0.18, 0.16, 0.05, 10), stoolMat);
        seat.position.set(x + 1.22, CURB_HEIGHT + 0.44, z + sz);
        chunk.add(seat);
        for (const lx of [-1, 1]) {
          for (const lz of [-1, 1]) {
            rod(
              chunk,
              [x + 1.22 + lx * 0.11, CURB_HEIGHT, z + sz + lz * 0.11],
              [x + 1.22 + lx * 0.08, CURB_HEIGHT + 0.42, z + sz + lz * 0.08],
              0.015,
              stoolMat,
              0.015,
              5,
            );
          }
        }
      }
      // Hanging scale over the produce: the one object that says "this is sold by weight".
      const arm = material(0x9aa0a4, 0.4, 0.7);
      rod(chunk, [x, 2.05, z], [x + 0.5, 2.05, z], 0.012, arm, 0.012, 5);
      rod(chunk, [x + 0.5, 2.05, z], [x + 0.5, 1.82, z], 0.008, arm, 0.008, 5);
      const pan = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.04, 10), arm);
      pan.position.set(x + 0.5, 1.79, z);
      chunk.add(pan);
    } else {
      // Shutter down: a ribbed steel blind, and the bay goes quiet.
      const shutter = material(0x878b8f, 0.54, 0.64);
      box(chunk, [FRONT_X - 0.32, 1.3, z], [0.09, 2.6, BAY - 0.1], shutter);
      for (let r = 0; r < 7; r++) {
        box(chunk, [FRONT_X - 0.27, 0.3 + r * 0.34, z], [0.03, 0.05, BAY - 0.14], material(0x697075, 0.5, 0.6), false);
      }
      // Stock is stored under the shutter, as it always is.
      box(chunk, [FRONT_X - 0.72, 0.24, z], [0.56, 0.46, BAY - 0.5], material(0x7a6248, 0.94, 0.02), false);
    }
    solids.push(rect(x, z, 2.0, BAY));
  }

  // ---------------------------------------------------------------------------
  // CÔ BA'S STALL (A3) — the one bay the mission's writing actually points at.
  //
  // Chosen at z = -130: close enough to the bus that the walk is short, far enough that the player
  // passes three other stalls first, which is how a market is entered.
  // ---------------------------------------------------------------------------
  const cobaZ = -130;
  const cobaX = FRONT_X - 1.55;
  // Half-lowered shutter: she is open, but tidying. The gap is at chest height, not at the floor.
  box(chunk, [FRONT_X - 0.32, 2.06, cobaZ], [0.09, 0.6, BAY - 0.1], material(0x878b8f, 0.54, 0.64));
  const caseFrame = material(0x64696d, 0.42, 0.7);
  const caseGlass = new T.MeshStandardMaterial({
    color: 0xbcd6dd,
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.3,
  });
  box(chunk, [cobaX, 0.9, cobaZ], [1.35, 0.06, 1.9], caseFrame);
  box(chunk, [cobaX, 1.16, cobaZ], [1.28, 0.46, 1.84], caseGlass, false);
  for (const sx of [-0.62, 0.62]) {
    for (const sz of [-0.9, 0.9]) {
      box(chunk, [cobaX + sx, 0.45, cobaZ + sz], [0.05, 0.9, 0.05], caseFrame, false);
    }
  }
  // THE RECEIPT STRING (D2): bills on a nail at eye height, beside the shutter. This is the one prop
  // the dialogue points at, so it sits where someone standing at the counter must look at it.
  const nailX = FRONT_X - 0.62;
  const nailZ = cobaZ + 1.28;
  rod(chunk, [nailX - 0.04, 1.64, nailZ], [nailX + 0.05, 1.64, nailZ], 0.011, caseFrame, 0.011, 5);
  // The string of bills — the only prop the mission's dialogue actually points at (A3).
  //
  // The first version hung eleven slips 0.10-0.16 m tall at 0.026 m intervals, so they occupied the
  // same 0.29 m of height as one slip and rendered as a single white smear. A spike of receipts is
  // not a stack; it is a rosette. Each slip is impaled at one point and hangs outward under its own
  // weight, so the fan is what tells the eye "eleven bills", and the fan is also why a shopkeeper can
  // read any one of them without taking the others off.
  //
  // Golden-angle spacing puts the bills around the nail without clumping, which is what actually
  // happens when they are threaded on in a hurry over a morning.
  const paperA = material(0xe8e1d2, 0.95, 0.01);
  const paperB = material(0xd8cfbc, 0.95, 0.01);
  const GOLDEN = 2.3999632297286535;
  for (let b = 0; b < 11; b++) {
    const angle = b * GOLDEN;
    const hang = 0.13 + rand() * 0.09;
    const reach = 0.012 + b * 0.0042; // later bills splay further out
    const slip = box(
      chunk,
      [
        nailX + 0.02 + Math.cos(angle) * reach,
        // Top of every slip is at the nail; the body drops from there.
        1.6 - hang / 2 - b * 0.0016,
        nailZ + Math.sin(angle) * reach,
      ],
      [0.006, hang, 0.062 + rand() * 0.026],
      b % 3 === 0 ? paperB : paperA,
      false,
    );
    // Every slip pivots about the nail, so the whole fan is one readable object from any side.
    slip.rotation.y = angle;
    slip.rotation.x = (rand() - 0.5) * 0.18;
    slip.rotation.z = (rand() - 0.5) * 0.22;
  }
  // Her stool behind the counter, and the crate she keeps under it.
  const herStool = new T.Mesh(new T.CylinderGeometry(0.2, 0.18, 0.05, 12), plasticRed());
  herStool.position.set(cobaX - 0.55, CURB_HEIGHT + 0.42, cobaZ - 0.55);
  chunk.add(herStool);
  box(chunk, [cobaX - 0.7, 0.19, cobaZ + 0.52], [0.42, 0.38, 0.58], material(0x6a573f, 0.94, 0.02), false);
  contact(chunk, cobaX, 0.014, cobaZ, 1.75, 2.2, contactMaterial(0.5));

  // ---------------------------------------------------------------------------
  // SERVICE ALLEY — a way in and out, so the block is a place and not a façade.
  //
  // It crosses the block toward the truck lane, which is what every market in this district has and
  // what makes carts, porters and the whole economy of the place legible.
  // ---------------------------------------------------------------------------
  plane(chunk, [FRONT_X - DEPTH / 2, 0.028, ALLEY_Z], [DEPTH + 1.6, ALLEY_W], marketFloor, 0, -Math.PI / 2);
  const alleyWall = createWorldFacadePBR("grey_plaster_02", "#a8a094", 3.0, 1.1, 0.94);
  for (const sz of [-1, 1]) {
    box(
      chunk,
      [FRONT_X - DEPTH / 2, 2.7, ALLEY_Z + sz * (ALLEY_W / 2 + 0.11)],
      [DEPTH + 1.4, 5.4, 0.22],
      alleyWall,
    );
  }
  // Above the alley: a bridge of shophouse, so the block is continuous over the passage.
  box(chunk, [FRONT_X - DEPTH / 2, 5.9, ALLEY_Z], [DEPTH + 1.4, 1.5, ALLEY_W + 0.6], stuccoWarm);
  // One bare bulb on a bracket: an alley with no light is a texture, not a place.
  rod(chunk, [FRONT_X - 2.6, 3.5, ALLEY_Z + 1.1], [FRONT_X - 2.6, 3.12, ALLEY_Z + 0.42], 0.012, frameMat(), 0.012, 5);
  const bulb = new T.Mesh(new T.SphereGeometry(0.062, 8, 6), new T.MeshBasicMaterial({ color: 0xffe0a8 }));
  bulb.position.set(FRONT_X - 2.6, 3.07, ALLEY_Z + 0.42);
  chunk.add(bulb);
  lightSpecsLocal.push({ x: FRONT_X - 2.6, y: 2.95, z: ALLEY_Z + 0.42, color: 0xffca86, intensity: 3.6, distance: 7.5, decay: 2 });

  // ---------------------------------------------------------------------------
  // BUS SHELTERS (A4, A5) — there were none anywhere in the world.
  // ---------------------------------------------------------------------------
  const shelterRoof = material(0x4a5157, 0.5, 0.62);
  const shelterPost = material(0x3d4247, 0.46, 0.68);
  const plateMat = material(0xeee8d6, 0.82, 0.02);
  const buildShelter = (x: number, z: number, yaw: number) => {
    const g = new T.Group();
    g.position.set(x, CURB_HEIGHT, z);
    g.rotation.y = yaw;
    chunk.add(g);
    const r = box(g, [0, 2.44, 0], [1.52, 0.09, 3.44], shelterRoof, true);
    r.rotation.z = 0.045;
    box(g, [0.72, 2.36, 0], [0.05, 0.13, 3.44], shelterPost, false);
    box(g, [-0.72, 2.36, 0], [0.05, 0.13, 3.44], shelterPost, false);
    for (const px of [-0.66, 0.66]) {
      for (const pz of [-1.62, 1.62]) {
        box(g, [px, 1.2, pz], [0.08, 2.4, 0.08], shelterPost, true);
      }
    }
    box(g, [-0.42, 0.44, 0], [0.34, 0.06, 2.5], material(0x948975, 0.88, 0.02), false);
    for (const pz of [-1.05, 0, 1.05]) {
      box(g, [-0.42, 0.22, pz], [0.3, 0.44, 0.06], shelterPost, false);
    }
    box(g, [0.72, 1.72, -1.66], [0.05, 0.46, 0.72], plateMat, false);
    const bin = new T.Mesh(new T.CylinderGeometry(0.21, 0.18, 0.62, 10), material(0x2f5a3a, 0.82, 0.06));
    bin.position.set(0.5, 0.31, 1.74);
    g.add(bin);
    lightSpecsLocal.push({ x, y: 2.3, z, color: 0xf2ead6, intensity: 2.6, distance: 6.2, decay: 2 });
    solids.push(rect(x, z, 1.5, 3.5));
  };
  buildShelter(FRONT_X + 3.9, CHO_LON_Z + 1.5, Math.PI / 2);
  buildShelter(3.1, 9.4, -Math.PI / 2);

  // ---------------------------------------------------------------------------
  // THE ATM (D3) — the rider offers to stop at one, so one has to exist.
  // ---------------------------------------------------------------------------
  const atmX = FRONT_X + 4.4;
  const atmZ = -121.5;
  box(chunk, [atmX, 1.05, atmZ], [0.72, 2.1, 1.15], material(0x37424c, 0.42, 0.58));
  const atmScreen = new T.MeshStandardMaterial({
    color: 0x0d1a24,
    emissive: new T.Color(0x7fd4ff),
    emissiveIntensity: 0.5,
    roughness: 0.24,
  });
  plane(chunk, [atmX - 0.37, 1.42, atmZ], [0.86, 0.6], atmScreen, -Math.PI / 2);
  const atmFascia = new T.MeshStandardMaterial({
    color: 0x123a5e,
    emissive: new T.Color(0x4aa8ff),
    emissiveIntensity: 0.7,
    roughness: 0.5,
  });
  plane(chunk, [atmX - 0.375, 1.96, atmZ], [1.06, 0.26], atmFascia, -Math.PI / 2);
  box(chunk, [atmX - 0.28, 2.28, atmZ], [0.9, 0.06, 1.5], shelterRoof, false);
  solids.push(rect(atmX, atmZ, 0.9, 1.3));

  // ---------------------------------------------------------------------------
  // SIGNAGE — half-real / half-fake (§7.1), in the house style already shipped for GS36.
  //
  // Hand-painted market signage in this district is Vietnamese with Chinese characters above it.
  // The fascia is geometry, not a texture, so the courier's brand (B1/B2 in the brief) can be
  // swapped in later without touching the block.
  // ---------------------------------------------------------------------------
  const marketSign = new T.MeshStandardMaterial({
    color: 0x6b2a24,
    emissive: new T.Color(0xd8a05a),
    emissiveIntensity: 0.18,
    roughness: 0.8,
  });
  for (const [z0, z1] of [
    [Z1 + 0.4, ALLEY_Z - ALLEY_W / 2 - 0.2],
    [ALLEY_Z + ALLEY_W / 2 + 0.2, Z0 - 0.4],
  ] as const) {
    box(chunk, [FRONT_X + 0.04, 2.98, (z0 + z1) / 2], [0.09, 0.58, z1 - z0], marketSign, false);
  }

  // ---------------------------------------------------------------------------
  // THE TRUCK LANE BEHIND THE MARKET — one parked wagon, a stack of pallets, a wheelie bin.
  // This is what makes the block have a back, which is what makes it a building.
  // ---------------------------------------------------------------------------
  const pallet = material(0x8a7351, 0.94, 0.01);
  for (let i = 0; i < 6; i++) {
    const pz = Z1 + 8 + rand() * (spanZ - 16);
    const px = LANE_X + (rand() - 0.5) * 1.6;
    const stackH = 0.13 * (1 + Math.floor(rand() * 3));
    box(chunk, [px, stackH / 2, pz], [1.1, stackH, 0.8], pallet, false);
  }
  const wagon = new T.Group();
  wagon.position.set(LANE_X + 0.2, 0, -113.5);
  wagon.rotation.y = 0.06;
  chunk.add(wagon);
  box(wagon, [0, 0.62, 0], [1.62, 0.9, 3.9], material(0xd6d2c8, 0.62, 0.14));
  box(wagon, [0, 1.24, 0.55], [1.5, 0.62, 1.5], material(0xcfcbc0, 0.62, 0.14), false);
  box(wagon, [0, 0.72, -1.86], [1.58, 0.42, 0.1], material(0x3a3f42, 0.6, 0.4), false);
  for (const wx of [-0.78, 0.78]) {
    for (const wz of [-1.32, 1.24]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(0.31, 0.31, 0.2, 12), material(0x1d1f20, 0.9, 0.02));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.31, wz);
      wagon.add(wheel);
    }
  }
  solids.push(rect(LANE_X + 0.2, -113.5, 1.9, 4.1));

  // ---------------------------------------------------------------------------
  // THE THINGS THAT MAKE A PAVEMENT USED — added after looking at the first renders.
  //
  // The block read as a building next to an empty road: every object that says "people work here
  // every morning" was missing. These are all cheap boxes and cylinders, and they are the ones a
  // player actually walks past.
  // ---------------------------------------------------------------------------

  // 1. Overhead cables. Every street in this district is webbed with them; they are the single most
  //    recognisable silhouette in a photograph of Chợ Lớn after the canopies.
  const cable = material(0x24262a, 0.9, 0.1);
  for (let c = 0; c < 5; c++) {
    const cy = 4.55 + c * 0.19;
    const zA = Z1 + 6 + c * 9.5;
    const sag = 0.42 + c * 0.05;
    const pts: [number, number, number][] = [];
    for (let t = 0; t <= 7; t++) {
      const f = t / 7;
      const zz = zA + f * 26;
      const xx = FRONT_X + 0.2 + f * (LANE_X - FRONT_X) * 0.1 - 1.4;
      pts.push([xx, cy - Math.sin(f * Math.PI) * sag, zz]);
    }
    tube(chunk, pts, 0.016, cable, 8);
  }
  // Drop wires from the cables down to the shopfronts: the district's signature mess.
  for (let d = 0; d < 6; d++) {
    const dz = Z1 + 9 + d * 7.3;
    rod(chunk, [FRONT_X - 2.2, 5.1, dz], [FRONT_X - 0.1, 3.7, dz + 0.3], 0.009, cable, 0.009, 4);
  }

  // 2. Goods on the pavement: stacked baskets, a sack of rice, a polystyrene box. Vendors put their
  //    stock out the front and the front line of a market is never a clean kerb.
  const basket = material(0x7d6142, 0.94, 0.01);
  for (let i = 0; i < 14; i++) {
    const z = Z1 + 4 + rand() * (spanZ - 8);
    const x = FRONT_X + 1.15 + rand() * 1.7;
    const kind = i % 4;
    if (kind === 0) {
      // A stack of plastic baskets, slightly rotated, as they always are.
      for (let b = 0; b < 4; b++) {
        const bb = box(chunk, [x, 0.06 + b * 0.115, z], [0.52, 0.11, 0.42], basket, false);
        bb.rotation.y = (rand() - 0.5) * 0.2;
      }
    } else if (kind === 1) {
      // A rice sack, slumped.
      const sack = box(chunk, [x, 0.22, z], [0.5, 0.44, 0.72], material(0xd8d4c4, 0.96, 0.01), false);
      sack.rotation.z = (rand() - 0.5) * 0.12;
    } else if (kind === 2) {
      // Polystyrene fish box, lid slightly off.
      box(chunk, [x, 0.13, z], [0.62, 0.26, 0.44], material(0xe6e8e4, 0.9, 0.01), false);
      box(chunk, [x + 0.06, 0.28, z + 0.04], [0.6, 0.04, 0.42], material(0xdfe2de, 0.9, 0.01), false);
    } else {
      // A pyramid of drink crates against the stall.
      for (let r = 0; r < 3; r++) {
        box(chunk, [x, 0.11 + r * 0.22, z], [0.42, 0.21, 0.6], material(0xa83b2c, 0.88, 0.03), false);
      }
    }
  }

  // 3. A parked scooter, half on the pavement, which is where scooters are parked.
  const scooter = new T.Group();
  scooter.position.set(FRONT_X + 4.7, 0, -136.5);
  scooter.rotation.y = 0.38;
  chunk.add(scooter);
  box(scooter, [0, 0.58, 0], [0.36, 0.3, 1.24], material(0x1f2a33, 0.4, 0.45));
  box(scooter, [0, 0.86, 0.34], [0.3, 0.18, 0.5], material(0x1a222a, 0.5, 0.4), false);
  rod(scooter, [0, 0.78, 0.62], [0, 1.06, 0.5], 0.03, frameMat(), 0.03, 6);
  for (const wz of [-0.56, 0.6]) {
    const w = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.1, 12), material(0x181a1b, 0.92, 0.02));
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.26, wz);
    scooter.add(w);
  }
  solids.push(rect(FRONT_X + 4.7, -136.5, 1.0, 1.5));

  // 4. A hand-pulled cart parked in the service alley: the block's back door is where the goods
  //    actually come in, and it gives the alley a reason to exist.
  const cart = new T.Group();
  cart.position.set(FRONT_X - 3.4, 0, ALLEY_Z + 0.7);
  cart.rotation.y = 0.9;
  chunk.add(cart);
  box(cart, [0, 0.62, 0], [1.0, 0.14, 1.9], material(0x8b7a5f, 0.94, 0.01));
  for (const sx of [-0.42, 0.42]) {
    box(cart, [sx, 0.32, 0], [0.07, 0.42, 1.8], material(0x6b5c46, 0.94, 0.01), false);
  }
  for (const wz of [-0.6, 0.6]) {
    const w = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.08, 10), material(0x222526, 0.9, 0.02));
    w.rotation.z = Math.PI / 2;
    w.position.set(-0.5, 0.22, wz);
    cart.add(w);
  }
  box(cart, [0.1, 0.86, 0.2], [0.7, 0.34, 0.9], basket, false);

  streamer.register({
    id: "cho-lon-market",
    name: "Chợ Lớn · Quận 5",
    district: "Quận 5",
    cx: FRONT_X - DEPTH / 2,
    cz: midZ,
    near: chunk,
    nearDist: 190,
    lodDist: 420,
  });

  lightSpecs.push(...lightSpecsLocal);

  return {
    root: chunk,
    solids,
    lightSpecs: lightSpecsLocal,
    // The customer stands on the pavement outside the frontage line, facing the counter.
    cobaStall: { x: FRONT_X + 1.15, z: cobaZ, yaw: -Math.PI / 2 },
    receiptNail: { x: nailX, y: 1.6, z: nailZ },
    busStops: [
      { x: FRONT_X + 3.9, z: CHO_LON_Z + 1.5, yaw: Math.PI / 2 },
      { x: 3.1, z: 9.4, yaw: -Math.PI / 2 },
    ],
  };
}
