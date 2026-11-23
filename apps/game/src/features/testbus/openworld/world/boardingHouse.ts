import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { CURB_HEIGHT, rect, type Solid } from "../simulation/boarding";
import {
  box,
  contact,
  contactMaterial,
  label,
  lamp,
  material,
  plane,
  rod,
  rounded,
  textLabel,
  tube,
  write,
} from "../simulation/scene-kit";
import {
  createCeramicTilePBR,
  createCorrugatedTinPBR,
  createVietnameseBrickPBR,
  createWeatheredStuccoPBR,
} from "./pbrTextures";
import { buildRealisticPottedPlants } from "./foliageAndProps";
import { freezeStaticMatrices, mergeStaticMeshesByMaterial } from "./meshBatcher";

/**
 * World-space anchor for "The Room" (Phòng 6.07) — exact untouched apartment.ts geometry.
 * Interior spans X: [19.4, 24.6], Y: [3.20, 5.85], Z: [-18.9, -14.7].
 * Entrance doorway opens south at X: [22.75, 23.65], Z: -14.70 onto Floor 2 corridor.
 * Window faces north at X: [20.25, 22.35], Y: [4.15, 5.50], Z: -18.90 overlooking Saigon skyline.
 */
export const ROOM_ANCHOR = new T.Vector3(22.0, 3.2, -16.8);

export const FLOOR2_Y = ROOM_ANCHOR.y; // 3.20 m
export const COURTYARD_Y = CURB_HEIGHT; // 0.16 m

// Staircase geometry: descends westward along Z ∈ [-14.55, -12.65] from X=19.2 (Y=3.20) to X=14.4 (Y=0.16)
export const STAIR = {
  xTop: 19.2,
  xBottom: 14.4,
  z0: -14.55,
  z1: -12.65,
  steps: 18,
} as const;

export interface PooledLightSpec {
  x: number;
  y: number;
  z: number;
  color: number;
  distance: number;
  decay: number;
  intensity: number;
}

export interface BoardingHouse {
  root: T.Group;
  solidsGround: Solid[];
  solidsUpper: Solid[];
  lightSpecs: PooledLightSpec[];
  setEnvironment: (nightFactor: number, wetness: number, windStrength: number) => void;
  update: (time: number) => void;
  dispose: () => void;
}

function noticeBoardMat() {
  return label(512, 640, (ctx) => {
    ctx.fillStyle = "#f2efe4";
    ctx.fillRect(0, 0, 512, 640);
    ctx.strokeStyle = "#1b5944";
    ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, 488, 616);
    ctx.fillStyle = "#1b5944";
    ctx.fillRect(24, 24, 464, 96);
    write(ctx, "NỘI QUY NHÀ TRỌ", 256, 86, 40, "#f7f1d4", 800, "center");
    const lines = [
      "1. Đóng cổng sau 23:30 — giữ chìa khóa cẩn thận.",
      "2. Dựng xe ngay ngắn sát vạch sân trọ.",
      "3. Giữ trật tự chung sau 22:00.",
      "4. Tắt điện, khóa nước khi ra khỏi phòng.",
      "5. Tiền điện 3.800đ/kWh · Nước 18.000đ/m³.",
      "6. Liên hệ Cô Lan (P.5.01): 0903 462 xxx",
    ];
    ctx.textAlign = "left";
    lines.forEach((l, i) => {
      write(ctx, l, 42, 178 + i * 62, 20, "#24332d", 600, "left");
    });
    ctx.fillStyle = "#b83b28";
    ctx.fillRect(42, 558, 428, 42);
    write(ctx, "KHU TRỌ AN NINH · 462/14 LÝ THÁI TỔ", 256, 586, 18, "#fff6de", 700, "center");
  });
}

function electricMeterMat(code: string) {
  return label(192, 256, (ctx) => {
    ctx.fillStyle = "#d9dcd6";
    ctx.fillRect(0, 0, 192, 256);
    ctx.strokeStyle = "#626965";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 176, 240);
    ctx.fillStyle = "#202826";
    ctx.fillRect(28, 42, 136, 54);
    ctx.fillStyle = "#c8f0b8";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("0482.6", 96, 77);
    write(ctx, code, 96, 148, 30, "#1d3d32", 800, "center");
    write(ctx, "EVN HCMC", 96, 206, 20, "#2a5680", 700, "center");
  });
}

export function buildBoardingHouse(
  scene: T.Scene,
  onAssetLoaded?: (obj: T.Object3D) => void,
): BoardingHouse {
  const root = new T.Group();
  root.name = "DayTro_462_14";
  scene.add(root);

  const solidsGround: Solid[] = [];
  const solidsUpper: Solid[] = [];
  const lightSpecs: PooledLightSpec[] = [];
  const emissives: T.MeshStandardMaterial[] = [];
  const windUniforms = { time: { value: 0 }, amp: { value: 1 } };
  let disposed = false;

  // REAL Ho Chi Minh City Photographic PBR Materials (Albedo + Normal + Roughness!)
  const wallCream = createWeatheredStuccoPBR("#ddd4be", "#585040", 4621, 3, 2);
  const wallMint = createWeatheredStuccoPBR("#c4d2c4", "#445646", 4622, 3, 2);
  const balconyTile = createCeramicTilePBR("#c8c0ae", "#6b665c", 6, 5, 2);
  const yardTile = createCeramicTilePBR("#a49e92", "#55544e", 8, 7, 5);

  const concrete = createVietnameseBrickPBR("#b6aaa0", 2, 2);
  const darkConcrete = createCeramicTilePBR("#666863", "#353733", 4, 3, 2);
  const greenIron = material(0x234a3c, 0.42, 0.68);
  const darkIron = material(0x28302e, 0.48, 0.64);
  const tinRoof = createCorrugatedTinPBR("#648696", "#72432a", 6, 2);
  const pvcPipe = material(0x7c8e9c, 0.36, 0.12);
  const bluePlastic = material(0x1f62b5, 0.34, 0.04);
  const redPaint = material(0xb52424, 0.38, 0.3);
  const woodDoor = material(0x6e4c36, 0.62, 0.08);
  const blueDoor = material(0x3a6475, 0.52, 0.22);
  const aluFrame = material(0xb5b9bc, 0.35, 0.78);
  const inox = material(0xd2d8da, 0.24, 0.92);
  const terracotta = material(0xa85638, 0.84);
  const glass = new T.MeshStandardMaterial({
    color: 0x26444b,
    roughness: 0.1,
    metalness: 0.55,
    envMapIntensity: 1.4,
  });
  const warmWindow = new T.MeshStandardMaterial({
    color: 0x2a3538,
    emissive: new T.Color(0xffc87a),
    emissiveIntensity: 0.55,
    roughness: 0.25,
  });
  emissives.push(warmWindow);

  const warmLampMat = lamp(0xffdfaa, 1.8);
  emissives.push(warmLampMat);
  const coolTubeMat = lamp(0xe4f1ff, 1.5);
  emissives.push(coolTubeMat);
  const shade = contactMaterial(0.55);

  const Y1 = COURTYARD_Y; // 0.16
  const Y2 = FLOOR2_Y; // 3.20

  // =========================================================================
  // 1. COURTYARD & HẺM CONNECTOR FLOOR (Y = 0.16)
  // =========================================================================
  // Main courtyard slab X: [13.0, 31.8], Z: [-19.2, -6.6]
  box(root, [22.4, Y1 - 0.12, -12.9], [18.8, 0.24, 12.6], darkConcrete, false);
  const yardFloor = plane(root, [22.4, Y1 + 0.004, -10.5], [18.6, 8.2], yardTile, 0, -Math.PI / 2);
  yardFloor.receiveShadow = true;

  // Seamless tiled floor extending west through the Hẻm mouth (X: [4.85, 13.4], Z: [-12.5, -10.0])
  const hemFloor = plane(root, [9.15, Y1 + 0.005, -11.25], [8.7, 2.52], yardTile, 0, -Math.PI / 2);
  hemFloor.receiveShadow = true;

  // Courtyard perimeter walls (South Z=-6.6, East X=31.7, West-South X=13.25)
  box(root, [22.5, 1.55, -6.65], [18.6, 2.8, 0.22], wallCream);
  box(root, [22.5, 3.02, -6.65], [18.8, 0.16, 0.34], concrete); // wall coping
  // Anti-climb steel spikes / top grille along courtyard wall
  for (let x = 13.8; x <= 31.2; x += 0.6) {
    rod(root, [x, 3.08, -6.65], [x, 3.52, -6.65], 0.012, darkIron);
  }
  box(root, [22.5, 3.45, -6.65], [17.8, 0.03, 0.03], darkIron);
  solidsGround.push(rect(22.5, -6.65, 18.8, 0.32));

  // East boundary wall (closes east side of courtyard & building)
  box(root, [31.7, 3.2, -12.9], [0.24, 6.1, 12.6], wallCream);
  solidsGround.push(rect(31.7, -12.9, 0.36, 12.8));
  solidsUpper.push(rect(31.7, -12.9, 0.36, 12.8));

  // West boundary wall south of the gate (Z: [-10.0, -6.65]) & north of gate (Z: [-19.2, -12.5])
  box(root, [13.25, 1.6, -8.32], [0.24, 2.9, 3.4], wallCream);
  solidsGround.push(rect(13.25, -8.32, 0.35, 3.45));
  box(root, [13.25, 3.1, -15.85], [0.24, 6.0, 6.7], wallCream);
  solidsGround.push(rect(13.25, -15.85, 0.35, 6.7));
  solidsUpper.push(rect(13.25, -15.85, 0.35, 6.7));

  // =========================================================================
  // 2. IRON BOARDING HOUSE GATE ("KHU TRỌ 462/14") AT X=13.25, Z ∈ [-12.5, -10.0]
  // =========================================================================
  // Left & right masonry gate piers + lintel beam (high enough for comfortable clearance)
  box(root, [13.25, 1.65, -12.48], [0.38, 3.0, 0.28], wallMint);
  box(root, [13.25, 1.65, -10.02], [0.38, 3.0, 0.28], wallMint);
  box(root, [13.25, 3.12, -11.25], [0.42, 0.42, 2.86], wallMint);
  // Open folding iron gate leaves folded flat against the courtyard side
  for (const side of [-1, 1]) {
    const leafZ = -11.25 + side * 1.05;
    box(root, [13.78, 1.38, leafZ], [0.85, 2.25, 0.05], greenIron);
    for (let k = 0; k < 5; k++) {
      box(root, [13.42 + k * 0.17, 1.38, leafZ], [0.025, 2.1, 0.06], darkIron);
    }
  }
  // Glowing Vietnamese house-number & boarding house sign above the gate (both sides!)
  const gateSign = label(640, 144, (ctx) => {
    ctx.fillStyle = "#16466d";
    ctx.fillRect(0, 0, 640, 144);
    ctx.strokeStyle = "#f2d680";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 624, 128);
    write(ctx, "KHU TRỌ 462/14 LÝ THÁI TỔ", 320, 66, 36, "#fff6d6", 800, "center");
    write(ctx, "PHÒNG CHO THUÊ · CÓ CHỖ ĐỂ XE · AN NINH 24/24", 320, 114, 19, "#bdd8ee", 600, "center");
  });
  plane(root, [13.02, 3.12, -11.25], [2.4, 0.46], gateSign, -Math.PI / 2);
  plane(root, [13.48, 3.12, -11.25], [2.4, 0.46], gateSign, Math.PI / 2);
  // Small glowing alley lamp over the gate (fed into fixed outdoor PointLight pool -> ZERO shader recompiles!)
  box(root, [12.95, 2.84, -11.25], [0.16, 0.08, 0.46], coolTubeMat);
  const gateLight: PooledLightSpec = { x: 12.2, y: 2.7, z: -11.25, color: 0xdcebff, distance: 10.5, decay: 2, intensity: 2.4 };
  lightSpecs.push(gateLight);

  // Hẻm alley dressing (overhead cables, pipes, wall lamp mid-alley)
  for (let i = 0; i < 4; i++) {
    tube(
      root,
      [
        [5.0, 4.1 + i * 0.12, -12.35],
        [7.8, 3.85 + i * 0.1, -11.8 + i * 0.25],
        [10.8, 3.92 + i * 0.1, -10.5 - i * 0.15],
        [13.2, 4.05 + i * 0.12, -10.2],
      ],
      0.015,
      darkIron,
      10,
    );
  }
  box(root, [8.6, 3.45, -12.32], [0.42, 0.09, 0.12], warmLampMat);
  const hemLight: PooledLightSpec = { x: 8.6, y: 3.2, z: -11.25, color: 0xffcb88, distance: 9.5, decay: 2, intensity: 2.0 };
  lightSpecs.push(hemLight);

  // =========================================================================
  // 3. NORTH BOARDING HOUSE BLOCK — FLOOR 1 (Y=0.16..3.10) & FLOOR 2 (Y=3.20..6.0)
  // =========================================================================
  // Floor 1 ground boarding units (X: [13.4, 31.6], Z: [-19.1, -14.7])
  box(root, [22.5, 1.65, -16.9], [18.2, 3.04, 4.4], wallCream);
  solidsGround.push(rect(22.5, -16.9, 18.2, 4.5));

  // Floor 1 unit facades (P. 5.01, P. 5.02, P. 5.03, P. 5.04) along Z = -14.68
  const groundUnits = [
    { x: 16.4, label: "P. 5.01" },
    { x: 20.6, label: "P. 5.02" },
    { x: 24.8, label: "P. 5.03" },
    { x: 29.0, label: "P. 5.04" },
  ];
  for (const u of groundUnits) {
    // Blue-painted metal/wood boarding door
    box(root, [u.x - 0.65, Y1 + 1.04, -14.68], [0.92, 2.08, 0.08], blueDoor);
    box(root, [u.x - 0.65, Y1 + 2.11, -14.65], [1.02, 0.08, 0.12], concrete);
    // Security iron-bar louvered window
    box(root, [u.x + 0.62, Y1 + 1.42, -14.68], [1.05, 1.05, 0.08], warmWindow);
    for (let k = -2; k <= 2; k++) {
      box(root, [u.x + 0.62 + k * 0.21, Y1 + 1.42, -14.62], [0.02, 1.04, 0.02], greenIron);
    }
    // Room number plaque + electric meter
    plane(root, [u.x - 0.65, Y1 + 1.85, -14.62], [0.24, 0.11], textLabel(u.label, "#18466b", "#fff5d2", 160, 72, 42));
    box(root, [u.x - 1.32, Y1 + 1.75, -14.64], [0.22, 0.3, 0.1], aluFrame);
    plane(root, [u.x - 1.32, Y1 + 1.75, -14.585], [0.2, 0.27], electricMeterMat(u.label));
  }

  // =========================================================================
  // 4. FLOOR 2 BALCONY SLAB & NEIGHBORING UNITS AROUND "THE ROOM" (P. 6.07)
  // =========================================================================
  // Floor 2 structural deck under The Room & neighbors (Z: [-19.15, -14.65], Y = 3.04..3.20)
  box(root, [22.5, Y2 - 0.11, -16.9], [18.4, 0.2, 4.55], concrete, false);
  // Floor 2 open corridor balcony slab (X: [19.1, 31.7], Z: [-14.70, -12.40], Y = 3.20)
  box(root, [25.4, Y2 - 0.11, -13.55], [12.6, 0.22, 2.3], concrete, false);
  const balcFloor = plane(root, [25.4, Y2 + 0.004, -13.55], [12.5, 2.24], balconyTile, 0, -Math.PI / 2);
  balcFloor.receiveShadow = true;

  // Support pillars under the balcony down to the courtyard
  for (const px of [19.3, 23.4, 27.5, 31.4]) {
    box(root, [px, (Y1 + Y2) * 0.5, -12.52], [0.22, Y2 - Y1, 0.22], wallCream);
    solidsGround.push(rect(px, -12.52, 0.28, 0.28));
  }

  // West Neighbor Unit (P. 6.06): X: [13.4, 19.32], Z: [-19.1, -14.65], Y: [3.20, 6.0]
  box(root, [16.36, Y2 + 1.4, -16.88], [5.92, 2.8, 4.45], wallMint);
  solidsUpper.push(rect(16.36, -16.88, 5.95, 4.55));
  // P. 6.06 door & louvered window facing south over the staircase
  box(root, [18.2, Y2 + 1.04, -14.63], [0.88, 2.04, 0.08], woodDoor);
  box(root, [16.4, Y2 + 1.45, -14.63], [1.1, 1.05, 0.08], warmWindow);
  plane(root, [18.2, Y2 + 1.85, -14.57], [0.24, 0.11], textLabel("P. 6.06", "#18466b", "#fff5d2", 160, 72, 42));

  // East Neighbor Units (P. 6.08 & P. 6.09): X: [24.68, 31.6], Z: [-19.1, -14.65], Y: [3.20, 6.0]
  box(root, [28.14, Y2 + 1.4, -16.88], [6.92, 2.8, 4.45], wallMint);
  solidsUpper.push(rect(28.14, -16.88, 6.96, 4.55));
  for (const [ux, code] of [[26.2, "P. 6.08"], [29.6, "P. 6.09"]] as const) {
    box(root, [ux, Y2 + 1.04, -14.63], [0.88, 2.04, 0.08], woodDoor);
    box(root, [ux + 1.25, Y2 + 1.45, -14.63], [1.0, 1.0, 0.08], warmWindow);
    plane(root, [ux, Y2 + 1.85, -14.57], [0.24, 0.11], textLabel(code, "#18466b", "#fff5d2", 160, 72, 42));
    box(root, [ux - 0.65, Y2 + 1.72, -14.6], [0.22, 0.3, 0.1], aluFrame);
    plane(root, [ux - 0.65, Y2 + 1.72, -14.545], [0.2, 0.27], electricMeterMat(code));
    // AC outdoor unit mounted on wall
    rounded(root, [ux + 1.25, Y2 + 2.38, -14.44], [0.68, 0.42, 0.28], 0.025, aluFrame);
  }

  // =========================================================================
  // 5. EXTERIOR SHELL AROUND "THE ROOM" (P. 6.07) — ZERO INTERIOR ALTERATION!
  // =========================================================================
  // Exterior South facade (Z = -14.58) with exact cutout for Room 6.07 doorway (X: [22.74, 23.66], Y: [3.20, 5.26])
  box(root, [21.05, Y2 + 1.4, -14.58], [3.38, 2.8, 0.14], wallMint); // west of door (19.36..22.74)
  box(root, [24.16, Y2 + 1.4, -14.58], [1.02, 2.8, 0.14], wallMint); // east of door (23.65..24.67)
  box(root, [23.2, Y2 + 2.43, -14.58], [0.96, 0.74, 0.14], wallMint); // transom above door
  // Room 6.07 blue enamel Vietnamese door number plaque + electric meter outside the room!
  plane(root, [22.46, Y2 + 1.78, -14.5], [0.28, 0.13], textLabel("P. 6.07", "#14426b", "#fff6d4", 180, 84, 44));
  box(root, [22.02, Y2 + 1.72, -14.5], [0.22, 0.3, 0.1], aluFrame);
  plane(root, [22.02, Y2 + 1.72, -14.445], [0.2, 0.27], electricMeterMat("P. 6.07"));
  // Small potted snake plant & doormat outside Room 6.07
  box(root, [23.2, Y2 + 0.008, -14.22], [0.68, 0.014, 0.42], material(0x6c4c36, 0.96), false);

  // Exterior North facade of Room 6.07 (Z = -19.04) with EXACT cutout for Room 6.07 window (X: [20.22, 22.38], Y: [4.13, 5.52])
  box(root, [22.0, Y2 + 0.46, -19.04], [5.32, 0.94, 0.16], wallCream); // below sill
  box(root, [22.0, Y2 + 2.56, -19.04], [5.32, 0.48, 0.16], wallCream); // above lintel
  box(root, [19.79, Y2 + 1.62, -19.04], [0.88, 1.44, 0.16], wallCream); // west pier
  box(root, [23.52, Y2 + 1.62, -19.04], [2.28, 1.44, 0.16], wallCream); // east pier
  // Rain drip hood above Room 6.07 north window
  const hood = box(root, [21.3, Y2 + 2.42, -19.28], [2.36, 0.06, 0.48], concrete);
  hood.rotation.x = -0.18;
  // Exterior AC condenser on north-east wall outside Room 6.07
  rounded(root, [24.0, Y2 + 1.85, -19.26], [0.72, 0.46, 0.28], 0.025, aluFrame);

  // Ceiling/roof slab above Room 6.07 & Floor 2 (Y = 5.95) + Slanted Corrugated Steel Roof (mái tôn)
  box(root, [22.5, Y2 + 2.74, -16.9], [18.5, 0.16, 4.65], concrete, false);
  const roof = box(root, [22.5, Y2 + 3.22, -15.65], [19.2, 0.09, 7.6], tinRoof);
  roof.rotation.x = 0.085;
  // Roof trusses & steel balcony posts up to the roof overhang
  for (const px of [14.3, 19.3, 23.4, 27.5, 31.4]) {
    box(root, [px, Y2 + 1.48, -12.48], [0.09, 2.95, 0.09], greenIron);
  }
  box(root, [22.8, Y2 + 2.92, -12.48], [17.4, 0.1, 0.1], greenIron);

  // Iconic Vietnamese stainless-steel rooftop water tanks (Sơn Hà style!)
  for (const [tx, tz] of [[15.8, -17.6], [28.4, -17.6]] as const) {
    rod(root, [tx, Y2 + 3.6, tz - 0.7], [tx, Y2 + 3.6, tz + 0.7], 0.56, inox, 0.56, 18);
    box(root, [tx, Y2 + 3.05, tz], [1.1, 0.12, 1.3], darkIron);
  }

  // Floor 2 Balcony Iron Railing (X: [19.2, 31.5], Z = -12.46)
  box(root, [25.35, Y2 + 0.98, -12.46], [12.3, 0.055, 0.055], greenIron);
  box(root, [25.35, Y2 + 0.14, -12.46], [12.3, 0.04, 0.04], greenIron);
  for (let x = 19.35; x <= 31.4; x += 0.18) {
    box(root, [x, Y2 + 0.56, -12.46], [0.022, 0.84, 0.022], greenIron);
  }
  // Colliders for Floor 2 balcony railing (leaves wide unobstructed funnel onto stairs at X=19.2!)
  solidsUpper.push(rect(25.45, -12.42, 12.1, 0.16));

  // Corridor warm lights on Floor 2 & Floor 1
  for (const lx of [16.8, 22.8, 27.8]) {
    box(root, [lx, Y2 + 2.74, -13.6], [0.58, 0.045, 0.09], coolTubeMat);
    box(root, [lx, Y1 + 2.86, -13.6], [0.58, 0.045, 0.09], warmLampMat);
  }
  const corLight1: PooledLightSpec = { x: 22.6, y: Y2 + 2.55, z: -13.6, color: 0xffe8c6, distance: 12, decay: 2, intensity: 2.0 };
  const corLight2: PooledLightSpec = { x: 16.6, y: Y2 + 2.55, z: -13.6, color: 0xffe4be, distance: 12, decay: 2, intensity: 1.8 };
  const yardLight: PooledLightSpec = { x: 22.0, y: Y1 + 3.0, z: -9.8, color: 0xffdeb4, distance: 18, decay: 2, intensity: 3.0 };
  lightSpecs.push(corLight1, corLight2, yardLight);

  // Hanging laundry line on Floor 2 balcony (east of Room 6.07) with live wind sway shader
  rod(root, [24.6, Y2 + 2.15, -12.56], [29.4, Y2 + 2.15, -12.56], 0.008, aluFrame);
  const clothColors = [0xd8e0e8, 0x3b6682, 0xc77558, 0xe8d9a8, 0x526b56];
  clothColors.forEach((col, i) => {
    const cm = new T.MeshStandardMaterial({ color: col, roughness: 0.9, side: T.DoubleSide });
    cm.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = windUniforms.time;
      shader.uniforms.uWindAmp = windUniforms.amp;
      shader.vertexShader =
        "uniform float uWindTime, uWindAmp;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float hang = clamp(0.5 - position.y, 0.0, 1.0);
           transformed.z += hang * 0.14 * uWindAmp * sin(uWindTime * 2.7 + ${i.toFixed(1)} * 1.4 + position.x * 3.0);
           transformed.x += hang * 0.05 * uWindAmp * cos(uWindTime * 1.9 + ${i.toFixed(1)});`,
        );
    };
    const w = 0.42 + (i % 2) * 0.14;
    const h = 0.62 + (i % 3) * 0.12;
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h, 4, 8), cm);
    mesh.position.set(25.2 + i * 0.88, Y2 + 2.14 - h / 2, -12.56);
    mesh.castShadow = true;
    root.add(mesh);
  });

  // =========================================================================
  // 6. SEAMLESS CONCRETE STAIRCASE (X: 19.2 → 14.4, Z: [-14.55, -12.65], Y: 3.20 → 0.16)
  // =========================================================================
  const runX = STAIR.xTop - STAIR.xBottom; // 4.80 m
  const dropY = Y2 - Y1; // 3.04 m
  const stairW = STAIR.z1 - STAIR.z0; // 1.90 m
  const stairMidZ = (STAIR.z0 + STAIR.z1) * 0.5;
  const stepDx = runX / STAIR.steps;
  const stepDy = dropY / STAIR.steps;

  for (let i = 0; i < STAIR.steps; i++) {
    const stepX = STAIR.xBottom + (i + 0.5) * stepDx;
    const topY = Y1 + (i + 1) * stepDy;
    // Solid step block extending slightly down into stringer
    box(root, [stepX, topY - 0.14, stairMidZ], [stepDx + 0.02, 0.28, stairW], balconyTile);
    // Terracotta anti-slip step nosing strip
    box(root, [stepX - stepDx * 0.46, topY + 0.004, stairMidZ], [0.045, 0.012, stairW - 0.04], terracotta, false);
  }
  // Sloped underside concrete stringer + support wall on north edge
  const slopeLen = Math.hypot(runX, dropY);
  const slopeAngle = Math.atan2(dropY, runX);
  const stringer = box(
    root,
    [(STAIR.xBottom + STAIR.xTop) * 0.5, (Y1 + Y2) * 0.5 - 0.22, stairMidZ],
    [slopeLen, 0.24, stairW],
    concrete,
  );
  stringer.rotation.z = slopeAngle;

  // Handrail along the south side of the staircase (Z = -12.68)
  rod(root, [STAIR.xBottom, Y1 + 0.96, STAIR.z1 - 0.04], [STAIR.xTop, Y2 + 0.96, STAIR.z1 - 0.04], 0.028, greenIron);
  for (let i = 0; i <= 9; i++) {
    const f = i / 9;
    const px = T.MathUtils.lerp(STAIR.xBottom, STAIR.xTop, f);
    const py = T.MathUtils.lerp(Y1, Y2, f);
    rod(root, [px, py, STAIR.z1 - 0.04], [px, py + 0.96, STAIR.z1 - 0.04], 0.018, greenIron);
  }
  // Guardrail along stair south edge (offset outward slightly so top & bottom stair landings never snag!)
  solidsUpper.push(rect((STAIR.xBottom + STAIR.xTop) * 0.5, STAIR.z1 + 0.12, runX - 0.3, 0.14));

  // =========================================================================
  // 6B. HYPER-REALISTIC SAIGON BOARDING HOUSE MICRO-DETAILS (GTA 6 DENSITY!)
  // =========================================================================
  // 1. Rooftop Stainless-Steel Water Tank (BỒN NƯỚC INOX SƠN HÀ) + PVC downspouts
  const tankX = 28.8;
  const tankZ = -17.2;
  const tankY = Y2 + 3.55;
  for (const [lx, lz] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]]) {
    rod(root, [tankX + lx, Y2 + 2.85, tankZ + lz], [tankX + lx * 0.8, tankY - 0.1, tankZ + lz * 0.8], 0.032, darkIron);
  }
  const tankCyl = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 1.55, 20), inox);
  tankCyl.rotation.z = Math.PI / 2;
  tankCyl.position.set(tankX, tankY + 0.48, tankZ);
  tankCyl.castShadow = true;
  root.add(tankCyl);
  rod(root, [31.42, Y1, -14.7], [31.42, Y2 + 3.1, -14.7], 0.048, pvcPipe);
  rod(root, [19.45, Y1, -14.55], [19.45, Y2 + 2.8, -14.55], 0.042, pvcPipe);

  // 2. Wall-mounted Electric Meter Bank (Đồng Hồ Điện P.6.06–6.08) + tangled overhead cables
  box(root, [24.85, Y2 + 1.55, -14.58], [0.76, 0.48, 0.14], material(0xd8dcd6, 0.55));
  for (let m = 0; m < 3; m++) {
    box(root, [24.62 + m * 0.23, Y2 + 1.58, -14.5], [0.16, 0.22, 0.08], glass, false);
    box(root, [24.62 + m * 0.23, Y2 + 1.4, -14.5], [0.12, 0.06, 0.05], darkIron, false);
  }
  for (let c = 0; c < 4; c++) {
    const oy = Y2 + 2.38 - c * 0.06;
    const cat = tube(
      root,
      [
        [13.3, oy + 0.2, -12.4 + c * 0.12],
        [17.5, oy - 0.22, -13.1 + c * 0.08],
        [22.0, oy - 0.16, -14.2],
        [24.85, Y2 + 1.85, -14.56],
      ],
      0.011,
      darkIron,
      12,
    );
    cat.castShadow = false;
  }

  // 3. Outdoor AC Condenser Units (Dàn nóng máy lạnh) with fan grilles & brackets
  for (const [ax, ay, az] of [[25.8, Y2 + 2.2, -14.32], [29.4, Y2 + 2.2, -14.32], [26.0, Y1 + 2.25, -14.32]]) {
    box(root, [ax, ay, az], [0.78, 0.54, 0.3], material(0xdcdad2, 0.62, 0.15));
    const fanRim = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.04, 16), darkIron);
    fanRim.rotation.x = Math.PI / 2;
    fanRim.position.set(ax - 0.12, ay, az + 0.15);
    root.add(fanRim);
    box(root, [ax - 0.28, ay - 0.3, az - 0.02], [0.04, 0.04, 0.34], darkIron, false);
    box(root, [ax + 0.28, ay - 0.3, az - 0.02], [0.04, 0.04, 0.34], darkIron, false);
  }

  // 4. Resident Shoe Racks, Wall Fire Extinguisher, Saigon Plastic Stools & Drainage Grate
  for (const sx of [18.85, 25.55]) {
    box(root, [sx, Y2 + 0.24, -14.42], [0.68, 0.46, 0.26], woodDoor);
    box(root, [sx - 0.14, Y2 + 0.5, -14.42], [0.1, 0.06, 0.22], bluePlastic, false);
    box(root, [sx + 0.02, Y2 + 0.5, -14.42], [0.1, 0.06, 0.22], bluePlastic, false);
  }
  const fireExt = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.46, 12), redPaint);
  fireExt.position.set(19.38, Y2 + 1.15, -14.48);
  root.add(fireExt);
  for (const [gx, gz] of [[28.9, -9.8], [30.4, -10.5], [29.4, -10.9]]) {
    box(root, [gx, Y1 + 0.42, gz], [0.34, 0.04, 0.34], bluePlastic);
    for (const [lx, lz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) {
      rod(root, [gx + lx, Y1, gz + lz], [gx + lx * 0.85, Y1 + 0.42, gz + lz * 0.85], 0.018, bluePlastic);
    }
  }
  box(root, [18.0, Y1 + 0.008, -11.2], [0.58, 0.02, 0.58], darkIron, false);

  // 5. Hẻm 462/14 Blue Vietnamese Address Plaque & Orange Convex Alley Safety Mirror
  plane(root, [13.06, Y1 + 2.35, -9.65], [0.52, 0.32], textLabel("462/14 LÝ THÁI TỔ", "#114685", "#f8f8f0", 256, 140, 32), -Math.PI / 2);
  rod(root, [13.02, Y1 + 2.45, -12.65], [12.72, Y1 + 2.55, -12.55], 0.028, darkIron);
  const mirrorHousing = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.08, 18), material(0xd8541a, 0.45));
  mirrorHousing.rotation.z = Math.PI / 2;
  mirrorHousing.rotation.y = 0.4;
  mirrorHousing.position.set(12.68, Y1 + 2.56, -12.52);
  root.add(mirrorHousing);
  const mirrorGlass = new T.Mesh(new T.SphereGeometry(0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.38), inox);
  mirrorGlass.rotation.z = -Math.PI / 2;
  mirrorGlass.rotation.y = 0.4;
  mirrorGlass.position.set(12.66, Y1 + 2.56, -12.52);
  root.add(mirrorGlass);

  // =========================================================================
  // 7. COURTYARD PROPS — NOTICE BOARD, PLANTS, SINKS & EXACT BUS STATION SCOOTERS
  // =========================================================================
  // Landlord notice board on south courtyard wall
  box(root, [18.5, Y1 + 1.48, -6.8], [0.98, 1.24, 0.06], darkIron);
  plane(root, [18.5, Y1 + 1.48, -6.84], [0.9, 1.14], noticeBoardMat(), Math.PI);

  // Photorealistic Lathe-Turned Vietnamese Ceramic Pots + Alpha-Cutout Bougainvillea & Tropical Foliage (Batched into 4 GPU draw calls!)
  const potPlacements: { pos: [number, number, number]; scale: number; hasFlowers: boolean }[] = [
    { pos: [14.1, Y1, -7.4], scale: 1.15, hasFlowers: true },
    { pos: [15.4, Y1, -7.3], scale: 1.05, hasFlowers: false },
    { pos: [21.6, Y1, -7.3], scale: 1.12, hasFlowers: true },
    { pos: [28.8, Y1, -7.4], scale: 1.18, hasFlowers: true },
    { pos: [30.9, Y1, -11.4], scale: 1.08, hasFlowers: false },
    { pos: [30.8, Y1, -8.4], scale: 1.0, hasFlowers: true },
    { pos: [20.4, Y2, -12.8], scale: 0.92, hasFlowers: true },
    { pos: [24.4, Y2, -12.8], scale: 0.98, hasFlowers: false },
    { pos: [27.2, Y2, -12.8], scale: 0.94, hasFlowers: true },
    { pos: [29.8, Y2, -12.8], scale: 1.0, hasFlowers: true },
  ];
  buildRealisticPottedPlants(root, potPlacements, windUniforms);
  for (const p of potPlacements) {
    if (p.pos[1] < 1) solidsGround.push(rect(p.pos[0], p.pos[2], 0.52, 0.52));
  }

  // Load EXACT 3D motorbike & courtyard table models from the Bus Station asset pack!
  const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loadProp = async (file: string, placements: { pos: [number, number, number]; ry: number; targetH: number; col?: [number, number] }[]) => {
    const data = await gltfLoader.loadAsync(`/assets/testbus/ow/models/${file}`).catch(() => null);
    if (!data || disposed) return;
    const base = data.scene;
    const box3 = new T.Box3().setFromObject(base, true);
    const size = box3.getSize(new T.Vector3());
    const center = box3.getCenter(new T.Vector3());
    const h = Math.max(0.01, size.y);
    for (const p of placements) {
      const holder = new T.Group();
      const clone = base.clone(true);
      const s = p.targetH / h;
      clone.scale.setScalar(s);
      clone.position.set(-center.x * s, -box3.min.y * s, -center.z * s);
      clone.traverse((n) => {
        if (n instanceof T.Mesh) {
          n.castShadow = false; // grounded via crisp contact shadow decal (eliminates 50k+ shadow tris on door-open!)
          n.receiveShadow = true;
        }
      });
      holder.add(clone);
      holder.position.set(p.pos[0], p.pos[1], p.pos[2]);
      holder.rotation.y = p.ry;
      root.add(holder);
      freezeStaticMatrices(holder);
      onAssetLoaded?.(holder);
      contact(root, p.pos[0], p.pos[1] + 0.008, p.pos[2], 1.7, 0.9, shade);
      if (p.col) solidsGround.push(rect(p.pos[0], p.pos[2], p.col[0], p.col[1]));
    }
  };

  // Batch ~260 static boarding-house meshes by material down to ~16 GPU draw calls (ZERO visual change!)
  mergeStaticMeshesByMaterial(root);
  freezeStaticMatrices(root);

  void Promise.all([
    // Realistic open-source PBR motorbike parked right in the boarding house courtyard!
    loadProp("vehicles/motorbike.glb", [
      { pos: [22.2, Y1, -8.15], ry: 0.22, targetH: 1.18, col: [0.9, 2.0] },
    ]),
    // Parked Honda PCX scooters in the boarding house courtyard
    loadProp("bike-pcx.optimized.glb", [
      { pos: [23.8, Y1, -8.1], ry: 0.15, targetH: 1.15, col: [0.9, 1.9] },
      { pos: [25.2, Y1, -8.15], ry: -0.08, targetH: 1.15, col: [0.9, 1.9] },
    ]),
    // Parked Honda Super Cub scooters in the courtyard & near the Hẻm entrance
    loadProp("bike-supercub.optimized.glb", [
      { pos: [26.6, Y1, -8.2], ry: 0.12, targetH: 1.05, col: [0.85, 1.85] },
      { pos: [28.0, Y1, -8.1], ry: -0.18, targetH: 1.05, col: [0.85, 1.85] },
      { pos: [20.4, Y1, -8.25], ry: 0.25, targetH: 1.05, col: [0.85, 1.85] },
    ]),
    // Courtyard tea/coffee table set for residents
    loadProp("table-set.optimized.glb", [
      { pos: [29.8, Y1, -10.0], ry: 0.3, targetH: 0.78, col: [1.3, 1.3] },
    ]),
  ]);

  let lastLit = 0.8;
  return {
    root,
    solidsGround,
    solidsUpper,
    lightSpecs,
    setEnvironment(nightFactor: number, wetness: number, windStrength: number) {
      windUniforms.amp.value = 0.4 + windStrength * 2.2;
      // Wet ceramic courtyard & balcony tiles become glossy in tropical rain
      yardTile.roughness = T.MathUtils.lerp(0.76, 0.16, wetness);
      yardTile.metalness = T.MathUtils.lerp(0.04, 0.34, wetness);
      balconyTile.roughness = T.MathUtils.lerp(0.72, 0.2, wetness);
      balconyTile.metalness = T.MathUtils.lerp(0.04, 0.3, wetness);
      glass.roughness = T.MathUtils.lerp(0.14, 0.05, wetness);
      // Warm evening/night corridor, courtyard, and neighbor room illumination (physically calibrated candela!)
      const lit = T.MathUtils.smoothstep(nightFactor, 0.15, 0.75);
      lastLit = lit;
      warmWindow.emissiveIntensity = 0.08 + lit * 1.15;
      warmLampMat.emissiveIntensity = 0.25 + lit * 2.5;
      coolTubeMat.emissiveIntensity = 0.25 + lit * 2.1;
      gateLight.intensity = 1.2 + lit * 26.0;
      hemLight.intensity = 1.0 + lit * 22.0;
      corLight1.intensity = 1.2 + lit * 24.0;
      corLight2.intensity = 1.0 + lit * 22.0;
      yardLight.intensity = 1.8 + lit * 34.0;
    },
    update(time: number) {
      windUniforms.time.value = time;
      // Authentic subtle Saigon Hẻm fluorescent tube flicker at night (rare soft ballast micro-dip)
      if (lastLit > 0.35) {
        const cycle = time % 7.4;
        const dip =
          (cycle > 6.85 && cycle < 6.93) || (cycle > 7.01 && cycle < 7.06) ? 0.58 : 1.0;
        coolTubeMat.emissiveIntensity = (0.25 + lastLit * 2.1) * dip;
        hemLight.intensity = (1.0 + lastLit * 22.0) * (0.75 + 0.25 * dip);
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
