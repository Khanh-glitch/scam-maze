// Sinh thành phố từ `cityPlan.ts`: đường, khối, hẻm, lô mặt tiền, POI, vật thể vỉa hè.
//
// Nguyên tắc hình học (rút ra từ lần đo đầu tiên, xem docs/product/MAP_AUDIT.md):
//  1. MỐC THẬT, KHOẢNG CÁCH NÉN. Toạ độ Bitexco / Landmark 81 / chợ Bến Thành / chợ Bình Tây là độ
//     WGS84 thật, chiếu về mét rồi nén 1:8. Hướng và thứ tự giữ nguyên. Nhà cửa KHÔNG nén: cửa hẻm
//     2,8 m, nhà ống 4 m, tầng 3,3 m — người chơi đi trong đó bằng thân người thật.
//  2. ĐƯỜNG SINH TỪ KHE KHỐI, không phải kẻ lên bản vẽ. Lưới khối có jitter theo seed; bề rộng
//     đường là dữ liệu của từng tuyến, và mạng đường gồm cả HẺM — vì Sài Gòn là thành phố của hẻm.
//  3. KHỐI THẤM ĐƯỢC. Mỗi khối có một ngã tư hẻm xuyên qua + hẻm cụt dẫn vào sân chung. Nhờ vậy
//     mọi mét vuông trong khối đều tới được từ đường, và khối trở thành mê cung thật — không phải
//     cái hộp kín có dán chữ (lần đầu sinh ra 352 hộp rời rạc, đã bỏ).
//  4. MỖI LÔ LÀ MỘT ĐỊA CHỈ, KHÔNG PHẢI MỘT CÁI NHÃN. ~1/3 mặt tiền là cửa hàng có tên, 2/3 là nhà
//     ở / nhà trọ / kho. Tỉ lệ này suy từ chính A-list: 12 đơn vị + 6 chức năng mỗi 100 m.
//  5. ĐO BẰNG RASTER. Diện tích đi được, số vùng liền mạch, độ phủ POI đều đếm trên lưới 1 m dựng
//     từ chính hình học này — không cộng đại số các hình chữ nhật (lần đầu cộng ra 72% mái trên
//     khung 47% đi được, vô nghĩa).
import { cityPlan, type CityPlan } from "./cityPlan.ts";

export type CityClass = "residential" | "market" | "tourist" | "corporate" | "construction" | "park";

export interface CityRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Hướng mặt tiền: "n" = nhìn về −z (bắc), "s" = +z, "w" = −x, "e" = +x. */
export type CitySide = "n" | "s" | "e" | "w";

export interface CityBuilding extends CityRect {
  id: string;
  district: string;
  floors: number;
  heightM: number;
  kind: string;
  /** Mặt tiền nhìn về đâu — dùng để đặt cửa, biển hiệu, ban công khi dựng 3D. */
  facing: CitySide;
  /** Nhà này mở ra đâu: mặt đường, hẻm, hay sân chung. */
  on: "street" | "hem" | "court" | "anchor";
  street?: string;
  /** POI của lô này (nếu là cửa hàng có tên). */
  poi?: string;
  anchor?: string;
  /** Mặt tiền đóng cửa — The Coffee House đóng bớt chi nhánh 2025–2026, và quán trọ thì khoá cửa. */
  shuttered?: boolean;
  /** Công viên / sân chung: đi được dù là "toà nhà" (mặt phẳng). */
  walkable?: boolean;
}

export interface CityBlock extends CityRect {
  id: string;
  district: string;
  /** Tên hẻm xuyên khối — dùng cho địa chỉ và biển hẻm. */
  hemName: string;
  /** Một khối có ngã tư hẻm xuyên qua, đây là toạ độ tâm ngã tư đó. */
  hemCross: { x: number; z: number; width: number };
  /** Sân chung trong khối — chỗ hẹn kín, chỗ trốn. */
  courts: CityRect[];
  perimeterM: number;
}

export interface CityStreet {
  id: string;
  name: string;
  klass: "avenue" | "street" | "alley" | "bridge";
  widthM: number;
  points: Array<[number, number]>;
  /** Hẻm nằm trong khối, không phải tuyến của lưới thành phố. */
  insideBlock?: string;
}

export interface CityPoi {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  district: string;
  /** "venue" = có cốt truyện; "shop" = cửa hàng đời thường nhưng vẫn gõ cửa được. */
  tier: "venue" | "shop";
  story?: string;
  anchor?: string;
  beat?: string;
  shuttered?: boolean;
}

export type CityPropKind =
  | "tree"
  | "lamp"
  | "bin"
  | "moto"
  | "stall"
  | "sign"
  | "cone"
  | "hoarding"
  | "tank"
  | "clothes"
  | "shrine";

export interface CityProp {
  kind: CityPropKind;
  x: number;
  z: number;
  rot: number;
}

export interface CityAnchor {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  heightM: number;
  footprintM: number;
  ward: string;
  year2026: string;
}

export interface CityMetrics {
  frameAreaM2: number;
  landAreaM2: number;
  /** Đo trên raster 1 m. */
  walkableAreaM2: number;
  walkablePctOfLand: number;
  components: number;
  /** Số ô của vùng lớn nhất / tổng ô đi được. */
  largestComponentPct: number;
  reachableFromRoomPct: number;
  /** Đo trên raster: mỗi ô chỉ đếm một lần, không cộng dồn hình chữ nhật chồng nhau. */
  roofAreaM2: number;
  roofCoveragePct: number;
  grossFloorAreaM2: number;
  buildingCount: number;
  blocks: number;
  streets: number;
  streetLengthM: number;
  hemLengthM: number;
  streetKmPerKm2: number;
  /** Số lô quay mặt ra đường / (2 × chiều dài đường) × 100 — mỗi bên đường tính riêng. */
  frontageUnitsPer100m: number;
  /** Số đơn vị có chức năng khác nhau (cửa hàng có tên) mỗi 100 m mặt tiền. */
  functionsPer100m: number;
  /** % chiều dài mặt tiền thật sự có nhà đứng. */
  frontageBuiltPct: number;
  /** Đơn vị mặt tiền trong hẻm, mỗi 100 m. */
  hemUnitsPer100m: number;
  frontageMedianPer100m: number;
  frontageP10Per100m: number;
  functionsMedianPer100m: number;
  /** Trung vị đơn vị mặt tiền/100 m theo loại phường. */
  frontageByClass: Record<string, number>;
  /** Trung vị cửa hàng/100 m theo loại phường. */
  functionsByClass: Record<string, number>;
  /** Đoạn mặt tiền chết dài nhất (m) — A-list: không quá 60 m. */
  maxDeadFrontageM: number;
  /** Tuyến đang giữ đoạn chết dài nhất (để điều tra). */
  maxDeadStreet: string;
  /** % chiều dài mặt tiền có đất mà không có nhà nào — cổng chính của chất lượng mặt phố. */
  deadFrontagePct: number;
  pois: number;
  venuePois: number;
  shopPois: number;
  poisPerKm2: number;
  parkAreaM2: number;
  medianFloors: number;
  maxHeightM: number;
  districtMetrics: Array<{ id: string; walkableM2: number; roofPct: number; pois: number; buildings: number; streets: number }>;
  /** Số POI phải dời để có chỗ đứng trước cửa. */
  relocatedPois: number;
  /** Số lô bị bỏ vì chồng lên toà đã có (chẩn đoán hình học). */
  rejectedOverlap: number;
  /** Số toà phải đục bỏ để mở lối vào ổ kín. */
  connectionRepairs: number;
  /** Số lô bị bỏ ngay ở giai đoạn rải mặt phố (chẩn đoán). */
  rejectedStreetPhase: number;
  /** Thống kê theo lớp tuyến: thử / đặt được / bị cửa hẻm chặn (chẩn đoán). */
  streetPhase: Record<string, { tried: number; placed: number; mouth: number; water: number }>;
  /** Số tuyến hẻm bị bỏ vì quá sát một hẻm cùng phương đã có. */
  hemSkipped: number;
  /** Số mốc thật dựng được toà (phải bằng số mốc trong plan). */
  anchorsPlaced: number;
  /** Mốc nào không dựng được — rỗng mới đạt. */
  anchorsMissing: string[];
  /** Số toà bị loại vì rơi vào lòng đường (bất biến: lòng đường không có nhà). */
  rejectedRoad: number;
  /** Vài ví dụ bị loại vì lòng đường (để điều tra). */
  rejectedRoadSamples: string[];
  /** Cùng bộ đếm nhưng theo id tuyến — để soi một con phố cụ thể. */
  phaseById: Record<string, { tried: number; placed: number; mouth: number; water: number; occ: number }>;
}

/** Lưới đi được 1 m, dùng chung cho kiểm toán và cho va chạm lúc chơi. */
export interface CityWalkGrid {
  step: number;
  nx: number;
  nz: number;
  /** 0 = đi được, 1 = toà nhà, 2 = nước. */
  cells: Uint8Array;
  start: { x: number; z: number };
}

export interface City {
  seed: string;
  frame: CityRect;
  compression: number;
  districts: Array<{ id: string; ward: string; old: string; character: string; story: string; verb: string; klass: CityClass; tiles: CityRect[]; areaM2: number }>;
  /** Chỗ người chơi thật sự đứng được lúc mở màn (ngưỡng cửa phòng 6.07). */
  start: { x: number; z: number; distanceFromRoomM: number };
  water: Array<CityRect & { id: string; name: string }>;
  /** Mặt cầu: đi được dù bên dưới là nước. */
  decks: CityRect[];
  anchors: CityAnchor[];
  blocks: CityBlock[];
  buildings: CityBuilding[];
  streets: CityStreet[];
  pois: CityPoi[];
  props: CityProp[];
  /**
   * KHU PHỐ GỐC — bản đồ đang chơi được của game (`features/khupho`), đặt nguyên vào thành phố.
   * `x`/`z` là gốc toạ độ (tim phố, chính giữa); hình chữ nhật là vùng đã dành riêng cho nó.
   */
  core: {
    x: number;
    z: number;
    x0: number;
    x1: number;
    z0: number;
    z1: number;
    streetId?: string;
    streetName: string;
  };
  walk: CityWalkGrid;
  metrics: CityMetrics;
}

// --- seeded randomness (mulberry32) ---------------------------------------------------------------
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];
const between = (random: () => number, lo: number, hi: number): number => lo + random() * (hi - lo);
const rectArea = (r: CityRect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
const overlaps = (a: CityRect, b: CityRect) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.z1, b.z1) > Math.max(a.z0, b.z0);
const inflate = (r: CityRect, m: number): CityRect => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });

// --- local metre projection for real anchors ------------------------------------------------------
export function projectAnchor(lat: number, lon: number, compression: number, origin: { lat: number; lon: number }) {
  const mPerDegLat = 110_540;
  const mPerDegLon = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: ((lon - origin.lon) * mPerDegLon) / compression,
    z: -((lat - origin.lat) * mPerDegLat) / compression,
  };
}

// --- tên thật của Sài Gòn 2026 --------------------------------------------------------------------
const STREET_NAMES = [
  "Lý Thái Tổ", "Lê Hồng Phong", "Nguyễn Tri Phương", "Trần Nhân Tôn", "Nguyễn Kim",
  "Hải Thượng Lãn Ông", "Đồng Khởi", "Pasteur", "Nam Kỳ Khởi Nghĩa", "Cách Mạng Tháng 8",
  "Nguyễn Trãi", "Tôn Thất Tùng", "Bùi Thị Xuân", "Nguyễn Du", "Lê Lai", "Điện Biên Phủ",
  "Võ Văn Kiệt", "Trần Hưng Đạo", "Nguyễn Thị Minh Khai", "Phạm Ngũ Lão", "Ký Con", "Lê Thánh Tôn",
];
const MARKET_STREETS = ["Hải Thượng Lãn Ông", "Lão Tử", "Triệu Quang Phục", "Nguyễn Trãi", "Trần Xuân Hoà", "Đỗ Ngọc Thạnh"];
const TOURIST_STREETS = ["Lê Lợi", "Nguyễn Huệ", "Đồng Khởi", "Lê Thánh Tôn", "Pasteur", "Hàm Nghi", "Calmette"];
const CORPORATE_STREETS = ["Nguyễn Huệ", "Đồng Khởi", "Tôn Đức Thắng", "Hàm Nghi", "Nguyễn Thị Minh Khai", "Lý Tự Trọng"];
const PARK_STREETS = ["Nguyễn Hữu Cảnh", "Điện Biên Phủ", "Tôn Đức Thắng", "Nguyễn Văn Linh"];

const SHOP_NAMES = ["Tạp hoá", "Bách hoá", "Tiệm thuốc", "Cửa hàng", "Sạp", "Đại lý", "Tiệm"];
const SHOP_SUFFIX = ["Cô Ba", "Chú Tư", "Bảy", "Hai Lúa", "Kim Anh", "Minh Châu", "Hồng Phát", "Thành Đạt", "Phương Nam", "Ngọc Hân", "Tấn Lộc", "Bình Minh", "Hoà Bình", "Thiên Phú", "An Khang"];
const FOOD_NAMES = ["Cơm tấm", "Hủ tiếu", "Bún riêu", "Bánh mì", "Quán nhậu", "Ốc đêm", "Phở", "Bún bò", "Cà phê vợt", "Chè", "Bánh cuốn", "Gỏi cuốn"];
const CAFE_NAMES = ["Highlands", "Phúc Long", "Katinat", "Cộng Cà Phê", "Trung Nguyên", "Cà phê Phố", "Milano", "Passio"];
const BANK_NAMES = ["Vietcombank", "BIDV", "Techcombank", "Sacombank", "ACB", "VPBank", "MB Bank"];
const PAWN_NAMES = ["Cầm đồ", "Tiệm vàng", "Đổi ngoại tệ", "Tín dụng"];
const OFFICE_NAMES = ["Văn phòng cho thuê", "Công ty TNHH", "Trung tâm giao dịch", "Môi giới", "Bất động sản"];
const REPAIR_NAMES = ["Sửa xe", "Vá vỏ", "Rửa xe", "Điện lạnh", "Sửa khoá"];
const PHONE_NAMES = ["Điện thoại cũ", "Sửa điện thoại", "Thế Giới Di Động", "FPT Shop"];
const HOTEL_NAMES = ["Khách sạn", "Hostel", "Nhà nghỉ", "Căn hộ dịch vụ"];
const HERB_NAMES = ["Thuốc bắc", "Y học cổ truyền"];
const LAUNDRY_NAMES = ["Giặt sấy", "Giặt ủi", "Tiệm giặt"];
const NET_NAMES = ["Quán net", "Gaming", "Cyber"];
const GOLD_NAMES = ["Vàng bạc", "Kim hoàn", "Nữ trang"];
const MONEY_NAMES = ["Đổi tiền", "Chuyển tiền", "Thu hộ"];
const GAMING_NAMES = ["Game bắn cá", "Bi-a", "Nét"];

const KIND_NAMES: Record<string, { prefix: string[]; suffix: string[] }> = {
  shop: { prefix: SHOP_NAMES, suffix: SHOP_SUFFIX },
  food: { prefix: FOOD_NAMES, suffix: SHOP_SUFFIX },
  cafe: { prefix: CAFE_NAMES, suffix: ["Nguyễn Huệ", "Đồng Khởi", "Lý Thái Tổ", "Bến Thành", "Hàm Nghi"] },
  bank: { prefix: BANK_NAMES, suffix: ["CN Sài Gòn", "PGD Bến Thành", "CN Chợ Lớn", "PGD Hoà Hưng"] },
  pawn: { prefix: PAWN_NAMES, suffix: ["88", "Kim Phát", "Tín Nghĩa", "24/7"] },
  gold: { prefix: GOLD_NAMES, suffix: ["Kim Phát", "SJC", "Doji", "An Đông"] },
  office: { prefix: OFFICE_NAMES, suffix: ["Sài Gòn", "Bến Thành", "Hoà Hưng", "Chợ Lớn"] },
  repair: { prefix: REPAIR_NAMES, suffix: SHOP_SUFFIX },
  phone: { prefix: PHONE_NAMES, suffix: ["24h", "Quận 5", "An Đông", "Vườn Lài"] },
  hotel: { prefix: HOTEL_NAMES, suffix: ["Bến Thành", "Sài Gòn", "Lý Thái Tổ", "Nguyễn Huệ"] },
  herb: { prefix: HERB_NAMES, suffix: ["Hoà Bình", "Thiên Phúc", "Chợ Lớn"] },
  laundry: { prefix: LAUNDRY_NAMES, suffix: SHOP_SUFFIX },
  net: { prefix: NET_NAMES, suffix: ["Bảy", "Hùng", "Pro"] },
  gaming: { prefix: GAMING_NAMES, suffix: ["Pro", "Arena", "Bình"] },
  boarding: { prefix: ["Dãy trọ", "Nhà trọ", "Phòng trọ"], suffix: SHOP_SUFFIX },
  money: { prefix: MONEY_NAMES, suffix: ["24/7", "Miễn phí", "Hoà Hưng"] },
};

/** Kiểu lô không phải cửa hàng: không có POI, nhưng vẫn là nhà có người ở. */
const PLAIN_KINDS = ["house", "room", "kho"];

interface ClassGrid {
  /** Kích thước khối mục tiêu (m) — khối Sài Gòn thật: 80–160 m một cạnh. */
  cell: [number, number];
  /** Đường lớn của lưới. */
  street: number;
  /** Đường nhỏ của lưới. */
  minor: number;
  /** Hẻm trong khối. */
  hem: [number, number];
  sidewalk: number;
  /** Bề dày dãy nhà quanh khối. */
  ring: [number, number];
  lot: [number, number];
  floors: [number, number];
  /**
   * Tỉ lệ lô bị "hạ tầng" xuống 3–5 tầng dù cả khu là tháp. Phố Lê Lợi/Nguyễn Huệ thật có nhà ống
   * 4 tầng chen giữa hai tháp 20 tầng; cả dãy cùng một chiều cao thì ảnh trên cao đọc ra "rừng
   * khối hộp giống nhau" — đúng thứ làm bản đồ trông máy sinh.
   */
  lowRise?: number;
  floorHeight: number;
  /** Tỉ lệ lô mặt tiền là cửa hàng có tên (phần còn lại là nhà ở/kho). */
  commercial: number;
  streets: readonly string[];
}

/**
 * Bảng này là chỗ "hàng thật" nằm: nhịp lô 3,2–6,4 m (nhà ống Sài Gòn), hẻm 2,6–4 m,
 * khối 90–170 m, tầng 2–5 ở khu ở và 7–26 ở khu văn phòng.
 */
const GRID: Record<CityClass, ClassGrid> = {
  residential: { cell: [124, 158], street: 12, minor: 6.5, hem: [2.6, 3.4], sidewalk: 1.5, ring: [12, 16], lot: [3.6, 5.0], floors: [2, 5], floorHeight: 3.25, commercial: 0.5, streets: STREET_NAMES },
  market: { cell: [112, 142], street: 10, minor: 5.5, hem: [2.4, 3.2], sidewalk: 1.2, ring: [10, 13], lot: [3.2, 4.4], floors: [2, 3], floorHeight: 3.3, commercial: 0.58, streets: MARKET_STREETS },
  tourist: { cell: [140, 178], street: 16, minor: 8, hem: [3, 4], sidewalk: 2.4, ring: [16, 22], lot: [6, 11], floors: [5, 14], lowRise: 0.38, floorHeight: 3.4, commercial: 0.55, streets: TOURIST_STREETS },
  corporate: { cell: [152, 195], street: 20, minor: 10, hem: [3.6, 5], sidewalk: 3, ring: [22, 30], lot: [11, 23], floors: [8, 30], lowRise: 0.34, floorHeight: 3.9, commercial: 0.42, streets: CORPORATE_STREETS },
  construction: { cell: [124, 160], street: 13, minor: 6.5, hem: [2.8, 3.6], sidewalk: 1.8, ring: [12, 16], lot: [3.8, 5.6], floors: [3, 8], floorHeight: 3.35, commercial: 0.55, streets: STREET_NAMES },
  park: { cell: [165, 210], street: 16, minor: 8, hem: [3, 4], sidewalk: 2.6, ring: [18, 24], lot: [8, 14], floors: [4, 12], lowRise: 0.3, floorHeight: 3.35, commercial: 0.3, streets: PARK_STREETS },
};

const asClass = (density: string): CityClass =>
  (["residential", "market", "tourist", "corporate", "construction", "park"] as const).includes(density as CityClass)
    ? (density as CityClass)
    : "residential";

const PLAN: CityPlan = cityPlan;

/** Toạ độ phòng 6.07 (gốc bản đồ này) — điểm xuất phát của BFS. */
const ROOM = { x: 0, z: 0 };

export function generateCity(seedOverride?: string): City {
  const random = rng(seedOverride ?? PLAN.seed);
  const frame: CityRect = PLAN.frame;
  const compression = PLAN.compression;

  const anchors: CityAnchor[] = PLAN.anchors.map((a) => {
    const { x, z } = projectAnchor(a.lat, a.lon, compression, PLAN.origin);
    return { id: a.id, name: a.name, kind: a.kind, x, z, heightM: a.heightM, footprintM: a.footprintM, ward: a.ward, year2026: a.year2026 };
  });

  const districts: City["districts"] = PLAN.districts.map((d) => {
    const tiles = d.tiles.map(([x0, z0, x1, z1]) => ({ x0, x1, z0, z1 }));
    return {
      id: d.id,
      ward: d.ward,
      old: d.old,
      character: d.character,
      story: d.story,
      verb: d.verb,
      klass: asClass(d.density),
      tiles,
      areaM2: tiles.reduce((sum, t) => sum + rectArea(t), 0),
    };
  });
  const water = PLAN.water.map((w) => ({ ...w }));
  const inWater = (x: number, z: number) => water.some((w) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1);

  // --- 1. Đại lộ thật từ plan: trở thành TUYẾN CỦA LƯỚI, không phải hành lang cắt ngang -----------
  // Lần trước đại lộ được "carve" xuyên khối: hai bên là dải chết không nhà, mất 13,6 km mặt tiền.
  // Giờ đại lộ vào thẳng lưới: một đường có tên + bề rộng thật, khối và nhà quay mặt ra cả hai bên.
  // Ba tuyến chéo (Nguyễn Thị Minh Khai, Hải Thượng Lãn Ông, Điện Biên Phủ đoạn bắc) đã bị bỏ khỏi
  // lưới: bậc thang hoá chúng sinh hàng trăm tuyến vụn và khối không đủ chỗ cho nhà. Hướng chéo của
  // Sài Gòn còn lại ở sông Sài Gòn và kênh Thị Nghè — chỗ duy nhất nó không phá vỡ hình học nhà.
  const avenues: Array<{ id: string; name: string; widthM: number; klass?: "bridge"; points: Array<[number, number]> }> = PLAN.avenues.map((a) => ({
    id: a.id,
    name: a.name,
    widthM: a.widthM,
    klass: a.class === "bridge" ? ("bridge" as const) : undefined,
    points: a.points.map(([x, z]) => [x, z] as [number, number]),
  }));

  interface AvLine {
    axis: "x" | "z";
    at: number;
    width: number;
    name: string;
    klass?: "bridge";
    from: number;
    to: number;
  }
  const avenueLines: AvLine[] = [];
  for (const a of avenues) {
    const zs = a.points.map((p) => p[1]);
    const xs = a.points.map((p) => p[0]);
    const flatZ = Math.max(...zs) - Math.min(...zs);
    const flatX = Math.max(...xs) - Math.min(...xs);
    const median = (v: number[]) => v.slice().sort((p, q) => p - q)[Math.floor(v.length / 2)];
    if (flatZ <= 26 && flatX > 26) {
      avenueLines.push({ axis: "z", at: median(zs), width: a.widthM, name: a.name, klass: a.klass, from: Math.min(...xs), to: Math.max(...xs) });
    } else if (flatX <= 26 && flatZ > 26) {
      avenueLines.push({ axis: "x", at: median(xs), width: a.widthM, name: a.name, klass: a.klass, from: Math.min(...zs), to: Math.max(...zs) });
    }
  }

  // --- 2. Lưới đường: mỗi tile một lưới, có đại lộ cắm vào làm chuẩn -----------------------------
  const streets: CityStreet[] = [];
  const streetByKey = new Map<string, CityStreet>();
  // --- mặt nạ lòng đường -------------------------------------------------------------------
  // Lô nhà rải từ một tuyến có thể sâu 20–30 m và tràn sang tuyến bên cạnh: kết quả là 117/142
  // tuyến có tim đường bị nhà chặn (88/110 hẻm). Ảnh phẳng không thấy, đứng ở tầm mắt thì thấy
  // ngay — một bức tường giữa hẻm. Nên lòng đường (đúng bề rộng xe chạy) là vùng CẤM XÂY.
  // Hẻm được thêm vào mặt nạ NGAY khi tuyến hẻm ra đời, nên ruột khối cũng không lách được.
  const roadCell = 1;
  const roadNX = Math.ceil((frame.x1 - frame.x0) / roadCell);
  const roadNZ = Math.ceil((frame.z1 - frame.z0) / roadCell);
  const road = new Uint8Array(roadNX * roadNZ);
  const paintRoad = (st: CityStreet) => {
    const [ax, az] = st.points[0];
    const [bx, bz] = st.points[st.points.length - 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1) return;
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const half = Math.max(0.6, st.widthM / 2 - 0.15);
    const steps = Math.ceil(len / (roadCell * 0.5));
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * len;
      const cx = ax + ux * t;
      const cz = az + uz * t;
      const i0 = Math.floor((cx - half - frame.x0) / roadCell);
      const i1 = Math.floor((cx + half - frame.x0) / roadCell);
      const j0 = Math.floor((cz - half - frame.z0) / roadCell);
      const j1 = Math.floor((cz + half - frame.z0) / roadCell);
      for (let ii = i0; ii <= i1; ii += 1) {
        for (let jj = j0; jj <= j1; jj += 1) {
          if (ii < 0 || jj < 0 || ii >= roadNX || jj >= roadNZ) continue;
          const px = frame.x0 + (ii + 0.5) * roadCell;
          const pz = frame.z0 + (jj + 0.5) * roadCell;
          const perp = Math.abs((px - ax) * -uz + (pz - az) * ux);
          const along = (px - ax) * ux + (pz - az) * uz;
          if (perp <= half && along >= -half && along <= len + half) {
            road[jj * roadNX + ii] = 1;
            roadOwner.set(jj * roadNX + ii, `${st.name}/${st.klass}/w${st.widthM.toFixed(0)}`);
          }
        }
      }
    }
  };
  const roadOwner = new Map<number, string>();
  const onRoad = (r: CityRect, ownerOut?: string[]) => {
    const i0 = Math.max(0, Math.floor((r.x0 - frame.x0) / roadCell));
    const i1 = Math.min(roadNX - 1, Math.floor((r.x1 - frame.x0) / roadCell));
    const j0 = Math.max(0, Math.floor((r.z0 - frame.z0) / roadCell));
    const j1 = Math.min(roadNZ - 1, Math.floor((r.z1 - frame.z0) / roadCell));
    let hit = false;
    for (let ii = i0; ii <= i1; ii += 1) {
      for (let jj = j0; jj <= j1; jj += 1) {
        if (!road[jj * roadNX + ii]) continue;
        hit = true;
        if (ownerOut) ownerOut.push(roadOwner.get(jj * roadNX + ii) ?? "?");
      }
    }
    return hit;
  };

  // Đường mà quá nửa lòng đường nằm trên sông/kênh là đường sai — bỏ. (Tuyến x=720 chạy đúng mép
  // sông Saigon: nửa lòng đường chìm dưới nước, cả dải mặt tiền phía đông không tồn tại.)
  const streetOnWater = (s: CityStreet) => {
    const [a, b] = [s.points[0], s.points[s.points.length - 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const corridor = {
      x0: Math.min(a[0], b[0]) - (Math.abs(b[0] - a[0]) < 0.01 ? s.widthM / 2 : 0),
      x1: Math.max(a[0], b[0]) + (Math.abs(b[0] - a[0]) < 0.01 ? s.widthM / 2 : 0),
      z0: Math.min(a[1], b[1]) - (Math.abs(b[1] - a[1]) < 0.01 ? s.widthM / 2 : 0),
      z1: Math.max(a[1], b[1]) + (Math.abs(b[1] - a[1]) < 0.01 ? s.widthM / 2 : 0),
    };
    let wet = 0;
    for (const w of water) {
      wet += Math.max(0, Math.min(corridor.x1, w.x1) - Math.max(corridor.x0, w.x0)) *
        Math.max(0, Math.min(corridor.z1, w.z1) - Math.max(corridor.z0, w.z0));
    }
    const area = (corridor.x1 - corridor.x0) * (corridor.z1 - corridor.z0) * len / len;
    return area > 0 && wet / area > 0.4;
  };
  const addStreet = (s: CityStreet) => {
    if (streetOnWater(s)) return null;
    const existing = streetByKey.get(s.id);
    if (existing) {
      existing.widthM = Math.max(existing.widthM, s.widthM);
      return existing;
    }
    streetByKey.set(s.id, s);
    streets.push(s);
    paintRoad(s);
    return s;
  };

  interface LineAcc {
    at: number;
    width: number;
    name: string;
    klass?: "bridge";
    from: number;
    to: number;
  }
  const xAcc = new Map<string, LineAcc>();
  const zAcc = new Map<string, LineAcc>();
  const keyOf = (at: number) => (Math.round(at * 10) / 10).toFixed(1);
  const reserve = (acc: Map<string, LineAcc>, at: number, width: number, from: number, to: number, name: string, klass?: "bridge") => {
    const key = keyOf(at);
    const cur = acc.get(key);
    if (!cur) {
      acc.set(key, { at, width, name, klass, from, to });
      return;
    }
    cur.width = Math.max(cur.width, width);
    cur.from = Math.min(cur.from, from);
    cur.to = Math.max(cur.to, to);
    if (klass) {
      cur.klass = klass;
      cur.name = name;
    }
  };
  for (const line of avenueLines) {
    reserve(line.axis === "x" ? xAcc : zAcc, line.at, line.width, line.from, line.to, line.name, line.klass);
  }
  const avenueAt = (axis: "x" | "z", at: number, range: [number, number] | null = null, within = 11) => {
    let best: AvLine | null = null;
    for (const line of avenueLines) {
      if (line.axis !== axis) continue;
      if (range && (line.to < range[0] || line.from > range[1])) continue;
      const d = Math.abs(line.at - at);
      if (d < within && (!best || d < Math.abs(best.at - at))) best = line;
    }
    return best;
  };

  interface TileGrid {
    district: string;
    klass: CityClass;
    rect: CityRect;
    xs: number[];
    zs: number[];
  }
  const tileGrids: TileGrid[] = [];
  for (const district of districts) {
    const g = GRID[district.klass];
    for (const tile of district.tiles) {
      const width = tile.x1 - tile.x0;
      const depth = tile.z1 - tile.z0;
      const cols = Math.max(1, Math.round(width / between(random, g.cell[0], g.cell[1])));
      const rows = Math.max(1, Math.round(depth / between(random, g.cell[0], g.cell[1])));
      const jitter = (count: number, step: number) =>
        Array.from({ length: Math.max(0, count - 1) }, () => (random() - 0.5) * 2 * Math.min(9, step * 0.18));
      const dx = jitter(cols, width / cols);
      const dz = jitter(rows, depth / rows);
      const build = (from: number, span: number, count: number, deltas: number[], axis: "x" | "z", range: [number, number]) => {
        const out: number[] = [from];
        for (let i = 1; i < count; i += 1) {
          const ideal = from + (span * i) / count + deltas[i - 1];
          // Tuyến nào trùng đại lộ thì dùng đúng toạ độ đại lộ, và bỏ tuyến nằm sát nó.
          const av = avenueAt(axis, ideal, axis === "x" ? [range[0], range[1]] : [range[0], range[1]]);
          if (av) {
            if (av.at > out[out.length - 1] + 18) out.push(av.at);
            continue;
          }
          out.push(ideal);
        }
        out.push(from + span);
        // Đại lộ cắt ngang tile mà lưới chưa có tuyến nào gần đó: cắm thêm.
        for (const line of avenueLines) {
          if (line.axis !== axis) continue;
          if (line.to < range[0] || line.from > range[1]) continue;
          if (line.at <= from + 12 || line.at >= from + span - 12) continue;
          if (out.some((v) => Math.abs(v - line.at) < 30)) continue;
          out.push(line.at);
        }
        out.sort((p, q) => p - q);
        // Khối phải đủ chỗ cho hai dãy nhà: bỏ tuyến nào sát tuyến trước dưới 56 m, nếu không sẽ
        // sinh ra dải 34–42 m — hai dãy vành chồng nhau và mất sạch mặt tiền (đo được: 40% phủ).
        const kept: number[] = [];
        for (const v of out) {
          if (!kept.length || v - kept[kept.length - 1] >= 56 || v === out[out.length - 1]) kept.push(v);
          else if (lineNameSafe(v, axis)) kept.push(v);
        }
        return kept;
      };
      const lineNameSafe = (_v: number, _axis: "x" | "z") => false;
      const xs = build(tile.x0, width, cols, dx, "x", [tile.z0, tile.z1]);
      const zs = build(tile.z0, depth, rows, dz, "z", [tile.x0, tile.x1]);
      for (let i = 0; i < xs.length; i += 1) {
        const edge = i === 0 || i === xs.length - 1;
        const av = avenueAt("x", xs[i], [tile.z0, tile.z1], 2);
        reserve(xAcc, xs[i], av ? Math.max(av.width, g.street) : edge ? g.street : i % 3 === 0 ? g.street : g.minor, tile.z0, tile.z1, av?.name ?? pick(random, g.streets), av?.klass);
      }
      for (let j = 0; j < zs.length; j += 1) {
        const edge = j === 0 || j === zs.length - 1;
        const av = avenueAt("z", zs[j], [tile.x0, tile.x1], 2);
        reserve(zAcc, zs[j], av ? Math.max(av.width, g.street) : edge ? g.street : j % 3 === 0 ? g.street : g.minor, tile.x0, tile.x1, av?.name ?? pick(random, g.streets), av?.klass);
      }
      tileGrids.push({ district: district.id, klass: district.klass, rect: tile, xs, zs });
    }
  }
  // Hai tile jitter ra hai tuyến gần trùng nhau (±4 m) — đó là MỘT con đường, không phải hai.
  const mergeClose = (acc: Map<string, LineAcc>) => {
    const list = [...acc.values()].sort((p, q) => p.at - q.at);
    const out: LineAcc[] = [];
    for (const line of list) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(line.at - prev.at) <= 4 && Math.min(line.to, prev.to) - Math.max(line.from, prev.from) > 0) {
        prev.from = Math.min(prev.from, line.from);
        prev.to = Math.max(prev.to, line.to);
        prev.width = Math.max(prev.width, line.width);
        if (line.klass) prev.klass = line.klass;
        continue;
      }
      out.push({ ...line });
    }
    return out;
  };
  // Hai tuyến song song quá sát nhau thì không có chỗ cho một dãy nhà giữa chúng: lô nhà của tuyến
  // này rơi vào lòng tuyến kia và bị loại (đo được 6.328 lần loại chỉ vì một tuyến cách đại lộ
  // 8 m). Giữ tuyến rộng hơn, bỏ tuyến sát nó.
  const pruneTooClose = (acc: Map<string, LineAcc>) => {
    const list = mergeClose(acc).sort((p, q) => q.width - p.width || p.at - q.at);
    const keep: LineAcc[] = [];
    for (const line of list) {
      const clash = keep.some((other) =>
        Math.abs(other.at - line.at) < (other.width + line.width) / 2 + 24 &&
        Math.min(other.to, line.to) - Math.max(other.from, line.from) > 8);
      if (!clash || line.klass === "bridge") keep.push(line);
    }
    return keep.sort((p, q) => p.at - q.at);
  };
  for (const acc of pruneTooClose(xAcc)) {
    addStreet({ id: `st-x-${Math.round(acc.at)}`, name: acc.name, klass: acc.klass ?? (acc.width >= 14 ? "avenue" : "street"), widthM: acc.width, points: [[acc.at, acc.from], [acc.at, acc.to]] });
  }
  for (const acc of pruneTooClose(zAcc)) {
    addStreet({ id: `st-z-${Math.round(acc.at)}`, name: acc.name, klass: acc.klass ?? (acc.width >= 14 ? "avenue" : "street"), widthM: acc.width, points: [[acc.from, acc.at], [acc.to, acc.at]] });
  }
  const mergedX = new Map<string, LineAcc>();
  const mergedZ = new Map<string, LineAcc>();
  for (const acc of pruneTooClose(xAcc)) mergedX.set(keyOf(acc.at), acc);
  for (const acc of pruneTooClose(zAcc)) mergedZ.set(keyOf(acc.at), acc);
  const lineWidth = (axis: "x" | "z", at: number) => (axis === "x" ? mergedX.get(keyOf(at)) : mergedZ.get(keyOf(at)))?.width ?? GRID.residential.street;
  // --- 2b. KHU PHỐ GỐC --------------------------------------------------------------------------
  // Bản đồ đang chơi (`features/khupho`) là một phố 140 m: 44 căn nhà ống, một hẻm cụt, một sân
  // chung. Nó không tự mọc thành thành phố 1,2 km, nhưng thành phố thì mọc QUANH nó được: chọn một
  // tuyến phố ngang đủ dài, dành riêng đúng hình chữ nhật của khu phố, rồi để lưới sinh tự động
  // tiếp tục hai đầu. Mọi con số về căn nào/mấy tầng/màu gì đọc từ `streetPlan.ts`.
  // Vùng dành riêng = đúng khuôn của thế giới thật: phố chạy x −70…70, hẻm và sân chung tới z 53,
  // vật lý của khu phố tới ±58, cộng 2 m lề để lô sinh tự động không chạm vào.
  // Số đo lấy từ chính khu phố: phố dựng từ x −70 tới 70; nhà hai bên tới z ±21; hẻm và sân chung
  // ăn tới z 53 trong khoảng x −4,6…23,6. Dành riêng đúng hai dải đó (hình L), phần còn lại để lưới
  // sinh tự động lấp — nếu dành cả hình chữ nhật 144 × 116 thì hai bên thành bãi đất trống.
  const coreFoot = { fx0: -70, fx1: 70, fz0: -26, fz1: 26 };
  const coreBack = { bx0: -12, bx1: 30, bz0: 26, bz1: 58 };
  const clearOfAnchors = (z: number) => anchors.every((a) => Math.abs(a.z - z) > 45 || Math.abs(a.x) > 90);

  // Ở ĐÂU: khu phố phải nằm trong phố ở. Lần chọn đầu (phố ngang dài gần tâm) rơi vào công viên
  // Tao Đàn; lần hai (lưới phố dày) rơi vào công trường metro. Giờ chấm điểm theo KHU và đặt khu phố
  // vào khoảng trống dài nhất giữa hai phố cắt ngang, đo theo MÉP đường.
  // Chỉ dãy nhà cần sạch: nhà chạy x −37…54 (91 m); hai đầu phố trống thì hẻm chữ T cắt vào cũng
  // chấp nhận được, giống phố thật.
  const CONTENT_X0 = -37;
  const CONTENT_X1 = 54;
  const CONTENT_W = CONTENT_X1 - CONTENT_X0 + 5;
  const CONTENT_MID = (CONTENT_X0 + CONTENT_X1) / 2;
  const districtClassAt = (x: number, z: number): CityClass | null => {
    for (const d of districts) {
      for (const t of d.tiles) if (x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1) return d.klass;
    }
    return null;
  };
  const classScore: Record<CityClass, number> = {
    residential: 6, market: 7, tourist: 5, corporate: 1, construction: -6, park: -8,
  };
  /** Điểm của một vị trí: hạng khu quanh nó + số phố chạy qua (lưới dày = khối đông). */
  const coreScoreAt = (x: number, z: number): number => {
    let score = 0;
    for (let i = -2; i <= 2; i += 1) {
      const klass = districtClassAt(x + i * 22, z);
      score += klass ? classScore[klass] : 0;
      const px = x + i * 22;
      const crosses = streets.filter((o) => {
        const ox0 = Math.min(...o.points.map((q) => q[0]));
        const ox1 = Math.max(...o.points.map((q) => q[0]));
        const oz0 = Math.min(...o.points.map((q) => q[1]));
        const oz1 = Math.max(...o.points.map((q) => q[1]));
        return px > ox0 && px < ox1 && z > oz0 && z < oz1;
      }).length;
      score += Math.min(3, crosses) * 0.8;
    }
    return score;
  };
  /** Các phố dọc cắt ngang tuyến này (vị trí + bề rộng). */
  const crossingsOn = (st: (typeof streets)[number]): Array<{ at: number; width: number }> => {
    const cz = st.points[0][1];
    const sx0 = Math.min(...st.points.map((q) => q[0]));
    const sx1 = Math.max(...st.points.map((q) => q[0]));
    const out: Array<{ at: number; width: number }> = [];
    for (const o of streets) {
      if (o === st) continue;
      const ox0 = Math.min(...o.points.map((q) => q[0]));
      const ox1 = Math.max(...o.points.map((q) => q[0]));
      const oz0 = Math.min(...o.points.map((q) => q[1]));
      const oz1 = Math.max(...o.points.map((q) => q[1]));
      if (ox1 - ox0 < 1.5 && ox0 > sx0 + 4 && ox0 < sx1 - 4 && oz0 <= cz && oz1 >= cz) {
        out.push({ at: ox0, width: o.widthM });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  };
  /** Khoảng trống dài nhất giữa hai phố cắt ngang, tính theo mép đường. */
  const longestGap = (st: (typeof streets)[number]): { mid: number; len: number } => {
    const sx0 = Math.min(...st.points.map((q) => q[0]));
    const sx1 = Math.max(...st.points.map((q) => q[0]));
    const cuts = crossingsOn(st).map((c) => ({ a: c.at - c.width / 2, b: c.at + c.width / 2 }));
    let best = { mid: (sx0 + sx1) / 2, len: -1 };
    let from = sx0;
    for (const c of [...cuts, { a: sx1, b: sx1 }]) {
      const len = c.a - from;
      if (len > best.len) best = { mid: (from + c.a) / 2, len };
      from = Math.max(from, c.b);
    }
    return best;
  };
  const coreCandidates = streets.filter((st) => {
    const [ax, az] = st.points[0];
    const [bx, bz] = st.points[st.points.length - 1];
    const horizontal = Math.abs(bz - az) < 1.5;
    const span = Math.abs(bx - ax);
    return horizontal && span > CONTENT_W + 40 && st.widthM >= 6 && st.widthM <= 9.5 && clearOfAnchors(az);
  });
  const coreOptions = coreCandidates.map((st) => {
    const gap = longestGap(st);
    // tim phố đặt sao cho giữa dãy nhà rơi vào giữa khoảng trống
    const x = gap.mid - CONTENT_MID;
    return {
      st,
      gap,
      x,
      score: coreScoreAt(x, st.points[0][1]) + (gap.len >= CONTENT_W ? 6 : 0) + Math.min(4, gap.len / 60),
    };
  });
  const coreOptionsOk = coreOptions.filter((o) => o.gap.len >= CONTENT_W);
  const coreChoice = (coreOptionsOk.length ? coreOptionsOk : coreOptions).sort((a, b) => b.score - a.score)[0];
  const coreStreet = coreChoice?.st;
  const core = {
    x: coreChoice ? coreChoice.x : 0,
    z: coreStreet ? coreStreet.points[0][1] : 0,
    x0: 0,
    x1: 0,
    z0: 0,
    z1: 0,
    streetId: coreStreet?.id,
    streetName: coreStreet?.name ?? "",
  };
  core.x0 = core.x + coreFoot.fx0;
  core.x1 = core.x + coreFoot.fx1;
  core.z0 = core.z + coreFoot.fz0;
  core.z1 = core.z + coreFoot.fz1;

  // --- 3. Khối, hẻm, và mặt phố rải TỪ ĐƯỜNG RA -----------------------------------------------
  // Đổi hướng: trước đây nhà được rải từ chu vi khối vào, nên chỗ nào lưới khối không phủ tới là
  // một dải chết (đo được 48% mặt tiền trống, có đoạn 1,1 km không nhà). Giờ thứ tự ngược lại:
  // dựng khối trước (chỉ hình học), rồi rải lô dọc TỪNG BÊN của TỪNG TUYẾN ĐƯỜNG, rồi mới lấp
  // ruột khối bằng hẻm và sân. Mặt phố liền là hệ quả của cách dựng, không phải của may mắn.
  const blocks: CityBlock[] = [];
  const buildings: CityBuilding[] = [];
  const pois: CityPoi[] = [];
  const usedNames = new Set<string>();
  let buildSeq = 0;
  let poiSeq = 0;

  // Bất biến: không hai toà chồng nhau (xem chú thích ở `fits`).
  const occCell = 12;
  const occ = new Map<string, CityRect[]>();
  const occKey = (i: number, j: number) => `${i}:${j}`;
  const fits = (r: CityRect) => {
    const i0 = Math.floor(r.x0 / occCell);
    const i1 = Math.floor(r.x1 / occCell);
    const j0 = Math.floor(r.z0 / occCell);
    const j1 = Math.floor(r.z1 / occCell);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const list = occ.get(occKey(i, j));
        if (list) for (const other of list) if (overlaps(r, other)) return false;
      }
    }
    return true;
  };
  const occupy = (r: CityRect) => {
    const i0 = Math.floor(r.x0 / occCell);
    const i1 = Math.floor(r.x1 / occCell);
    const j0 = Math.floor(r.z0 / occCell);
    const j1 = Math.floor(r.z1 / occCell);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const k = occKey(i, j);
        const list = occ.get(k);
        if (list) list.push(r);
        else occ.set(k, [r]);
      }
    }
  };
  occupy({ x0: core.x0 - 1, x1: core.x1 + 1, z0: core.z0 - 1, z1: core.z1 + 1 });
  occupy({ x0: core.x + coreBack.bx0 - 1, x1: core.x + coreBack.bx1 + 1, z0: core.z + coreBack.bz0, z1: core.z + coreBack.bz1 + 1 });
  let rejectedOverlap = 0;
  let rejectedWater = 0;
  let hemSkipped = 0;
  let rejectedRoad = 0;
  const rejectedRoadSamples: string[] = [];
  const addBuilding = (b: Omit<CityBuilding, "id">): CityBuilding | null => {
    if (!fits(b)) {
      rejectedOverlap += 1;
      return null;
    }
    // Bất biến: không toà nào đè lên lòng đường. Đây là lỗi từng làm 88/110 hẻm bị chặn giữa.
    const owners: string[] = [];
    if (!b.walkable && b.anchor !== "room" && onRoad(b, owners)) {
      rejectedRoad += 1;
      if (rejectedRoadSamples.length < 10) rejectedRoadSamples.push(`${b.kind}/${b.on}${b.anchor ? "/" + b.anchor : ""} ${b.x0.toFixed(0)},${b.z0.toFixed(0)} ${(b.x1 - b.x0).toFixed(0)}x${(b.z1 - b.z0).toFixed(0)} street=${b.street ?? "-"} ⟵ ${[...new Set(owners)].slice(0, 3).join(" | ")}`);
      return null;
    }
    // Chặn cuối: không đặt toà xuống lòng sông/kênh, kể cả khi lô được sinh từ ruột khối hay mốc.
    // Cầu và mặt sàn đi được (công viên, sân) là ngoại lệ hợp lý.
    if (!b.walkable && b.kind !== "bridge" &&
      water.some((w) => Math.min(b.x1, w.x1) > Math.max(b.x0, w.x0) && Math.min(b.z1, w.z1) > Math.max(b.z0, w.z0))) {
      rejectedWater += 1;
      return null;
    }
    const out: CityBuilding = { id: `bd-${buildSeq++}`, ...b };
    occupy(out);
    buildings.push(out);
    return out;
  };

  const poiName = (kind: string, street: string): string => {
    const pool = KIND_NAMES[kind] ?? KIND_NAMES.shop;
    const base = `${pick(random, pool.prefix)} ${pick(random, pool.suffix)}`;
    if (!usedNames.has(base)) {
      usedNames.add(base);
      return base;
    }
    const withStreet = `${base} — ${street}`;
    if (!usedNames.has(withStreet)) {
      usedNames.add(withStreet);
      return withStreet;
    }
    let n = 2;
    while (usedNames.has(`${withStreet} ${n}`)) n += 1;
    const final = `${withStreet} ${n}`;
    usedNames.add(final);
    return final;
  };

  const districtAt = (x: number, z: number): string => {
    for (const d of districts) if (d.tiles.some((t) => x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1)) return d.id;
    return districts[0].id;
  };

  const addShopPoi = (b: CityBuilding, side: CitySide, kind: string) => {
    const px = side === "n" || side === "s" ? (b.x0 + b.x1) / 2 : side === "w" ? b.x0 - 1.1 : b.x1 + 1.1;
    const pz = side === "n" ? b.z0 - 1.1 : side === "s" ? b.z1 + 1.1 : (b.z0 + b.z1) / 2;
    pois.push({
      id: `poi-${poiSeq++}`,
      name: poiName(kind, b.street ?? "Hẻm"),
      kind,
      x: px,
      z: pz,
      district: b.district,
      tier: "shop",
      shuttered: b.shuttered,
    });
    b.poi = pois[pois.length - 1].id;
  };

  /** Rải một dãy lô dọc theo một cạnh của `rect` (dùng cho ruột khối). */
  interface BandOpts {
    side: CitySide;
    depth: number;
    district: string;
    klass: CityClass;
    on: "street" | "hem" | "court";
    street: string;
    gaps?: Array<[number, number]>;
    alongRange?: [number, number];
    commercial?: number;
    maxDepth?: number;
  }
  const layBand = (rect: CityRect, opts: BandOpts) => {
    const g = GRID[opts.klass];
    const alongX = opts.side === "n" || opts.side === "s";
    const [a0, a1] = opts.alongRange ?? (alongX ? [rect.x0, rect.x1] : [rect.z0, rect.z1]);
    const gaps = (opts.gaps ?? []).slice().sort((p, q) => p[0] - q[0]);
    let cursor = a0;
    let guard = 0;
    while (cursor < a1 - 2.6 && guard++ < 500) {
      const gap = gaps.find((gp) => cursor >= gp[0] - 0.01 && cursor < gp[1]);
      if (gap) {
        cursor = gap[1];
        continue;
      }
      const nextGap = gaps.find((gp) => gp[0] > cursor);
      const limit = Math.min(a1, nextGap ? nextGap[0] : a1);
      const lotW = Math.min(between(random, g.lot[0], g.lot[1]), limit - cursor);
      if (lotW < 2.6) {
        cursor = limit;
        continue;
      }
      const depth = Math.min(opts.depth + (random() < 0.28 ? between(random, 0, 3.2) : 0), opts.maxDepth ?? Number.POSITIVE_INFINITY);
      const facade = (random() - 0.3) * 0.7;
      const commercial = opts.commercial ?? g.commercial;
      const isShop = random() < commercial;
      const kind = isShop ? pick(random, Object.keys(KIND_NAMES)) : pick(random, PLAIN_KINDS);
      // Tháp hay nhà ống? Khu văn phòng có ~1/3 lô là nhà thấp chen giữa (xem `lowRise`).
      const lowRise = g.lowRise !== undefined && random() < g.lowRise && g.floors[0] >= 6;
      const floors = lowRise
        ? Math.max(1, Math.round(between(random, 3, Math.min(5, g.floors[1]))))
        : Math.max(1, Math.round(between(random, g.floors[0], g.floors[1])));
      const b: CityRect =
        opts.side === "n"
          ? { x0: cursor, x1: cursor + lotW, z0: rect.z0 - facade, z1: rect.z0 + depth }
          : opts.side === "s"
            ? { x0: cursor, x1: cursor + lotW, z0: rect.z1 - depth, z1: rect.z1 + facade }
            : opts.side === "w"
              ? { x0: rect.x0 - facade, x1: rect.x0 + depth, z0: cursor, z1: cursor + lotW }
              : { x0: rect.x1 - depth, x1: rect.x1 + facade, z0: cursor, z1: cursor + lotW };
      if (b.x1 - b.x0 >= 2.4 && b.z1 - b.z0 >= 2.4 && !inWater((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2)) {
        const building = addBuilding({
          district: opts.district,
          ...b,
          floors,
          heightM: +(floors * g.floorHeight + (random() < 0.3 ? 0.9 : 0)).toFixed(2),
          kind,
          facing: opts.side,
          on: opts.on,
          street: opts.street,
          shuttered: isShop && random() < 0.11,
        });
        if (building && isShop) addShopPoi(building, opts.side, kind);
      }
      cursor += lotW;
    }
  };

  const courtRects: CityRect[] = [];

  /** Ruột khối: lưới nhà nhỏ + hẻm 2,8 m, không phải bãi trống. */
  const fillCourt = (court: CityRect, district: string, klass: CityClass, hemName: string) => {
    const g = GRID[klass];
    const pitch = between(random, 11, 14);
    const gx = Math.max(1, Math.round((court.x1 - court.x0) / pitch));
    const gy = Math.max(1, Math.round((court.z1 - court.z0) / pitch));
    const cw = (court.x1 - court.x0) / gx;
    const ch = (court.z1 - court.z0) / gy;
    const lane = 1.4;
    for (let i = 0; i < gx; i += 1) {
      for (let j = 0; j < gy; j += 1) {
        const x0 = court.x0 + i * cw + lane;
        const x1 = court.x0 + (i + 1) * cw - lane;
        const z0 = court.z0 + j * ch + lane;
        const z1 = court.z0 + (j + 1) * ch - lane;
        if (x1 - x0 < 3 || z1 - z0 < 3) continue;
        const alongX = x1 - x0 >= z1 - z0;
        const parts = random() < 0.42 ? 1 : random() < 0.78 ? 2 : 3;
        const span = alongX ? x1 - x0 : z1 - z0;
        for (let k = 0; k < parts; k += 1) {
          const a0 = (alongX ? x0 : z0) + (span * k) / parts;
          const a1 = (alongX ? x0 : z0) + (span * (k + 1)) / parts;
          const rect: CityRect = alongX ? { x0: a0, x1: a1, z0, z1 } : { x0, x1, z0: a0, z1: a1 };
          if (rect.x1 - rect.x0 < 2.6 || rect.z1 - rect.z0 < 2.6) continue;
          if (inWater((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2)) continue;
          const isShop = random() < 0.16;
          const kind = isShop ? pick(random, ["repair", "boarding", "shop", "food", "laundry"]) : pick(random, ["kho", "room", "house"]);
          const floors = Math.max(1, Math.round(between(random, g.floors[0], Math.min(g.floors[1], 4))));
          const facing: CitySide = alongX ? (j === 0 ? "n" : "s") : i === 0 ? "w" : "e";
          const b = addBuilding({
            district,
            ...rect,
            floors,
            heightM: +(floors * g.floorHeight).toFixed(2),
            kind,
            facing,
            on: "court",
            street: hemName,
          });
          if (b && isShop) addShopPoi(b, facing, kind);
        }
      }
    }
  };

  // (a) Hình học khối + hẻm + cửa hẻm ra phố
  interface Mouth {
    rect: CityRect;
  }
  const mouths: Mouth[] = [];
  for (const grid of tileGrids) {
    const g = GRID[grid.klass];
    for (let i = 0; i < grid.xs.length - 1; i += 1) {
      for (let j = 0; j < grid.zs.length - 1; j += 1) {
        const x0 = grid.xs[i];
        const x1 = grid.xs[i + 1];
        const z0 = grid.zs[j];
        const z1 = grid.zs[j + 1];
        const wl = lineWidth("x", x0) / 2 + g.sidewalk;
        const wr = lineWidth("x", x1) / 2 + g.sidewalk;
        const wt = lineWidth("z", z0) / 2 + g.sidewalk;
        const wb = lineWidth("z", z1) / 2 + g.sidewalk;
        const block: CityRect = { x0: x0 + wl, x1: x1 - wr, z0: z0 + wt, z1: z1 - wb };
        const W = block.x1 - block.x0;
        const D = block.z1 - block.z0;
        if (W < 26 || D < 26) continue;
        if (water.reduce((sum, w) => sum + rectArea(intersectRect(block, w)), 0) > rectArea(block) * 0.35) continue;
        const id = grid.district;
        const hemW = between(random, g.hem[0], g.hem[1]);
        const hemX = block.x0 + W * between(random, 0.3, 0.7);
        const hemZ = block.z0 + D * between(random, 0.3, 0.7);
        const hemName = `Hẻm ${60 + Math.floor(random() * 420)}`;
        // Hai khối cạnh nhau có thể đặt hẻm cách nhau 0,2–2 m: hai lòng hẻm chồng nhau thành một
        // cái hào, và vì lòng đường là vùng cấm xây nên cả dãy nhà hai bên bị loại. Hẻm nào quá sát
        // một hẻm cùng phương đã có thì bỏ — khối đó dùng luôn hẻm của khối bên cạnh.
        const tooClose = (axis: "v" | "h", at: number, from: number, to: number) =>
          streets.some((other) => {
            if (other.klass !== "alley") return false;
            const [ox, oz] = other.points[0];
            const [px, pz] = other.points[other.points.length - 1];
            const otherV = Math.abs(ox - px) < 0.5;
            if ((axis === "v") !== otherV) return false;
            const otherAt = axis === "v" ? ox : oz;
            if (Math.abs(otherAt - at) > Math.max(hemW, other.widthM) + 2.5) return false;
            const [from2, to2] = axis === "v" ? [oz, pz] : [ox, px];
            return Math.min(Math.max(from, to), Math.max(from2, to2)) - Math.max(Math.min(from, to), Math.min(from2, to2)) > 6;
          });
        const vOk = !tooClose("v", hemX, block.z0 - g.sidewalk, block.z1 + g.sidewalk);
        const hOk = !tooClose("h", hemZ, block.x0 - g.sidewalk, block.x1 + g.sidewalk);
        if (!vOk || !hOk) hemSkipped += 1;
        if (!vOk && !hOk) continue;
        if (vOk) addStreet({ id: `hem-v-${Math.round(hemX)}-${Math.round(hemZ)}-${blocks.length}`, name: hemName, klass: "alley", widthM: hemW, points: [[hemX, block.z0], [hemX, block.z1]], insideBlock: id });
        if (hOk) addStreet({ id: `hem-h-${Math.round(hemX)}-${Math.round(hemZ)}-${blocks.length}`, name: hemName, klass: "alley", widthM: hemW, points: [[block.x0, hemZ], [block.x1, hemZ]], insideBlock: id });
        // Cửa hẻm: chỗ hẻm cắt qua dãy nhà mặt phố. Phải ăn sâu vào trong khối ít nhất bằng bề
        // dày dãy mặt phố (nếu chỉ chừa vỉa hè thì dãy nhà bịt đầu hẻm và cả khối thành ổ kín).
        const mouthDepth = g.ring[1] + 6;
        const mouthOut = g.sidewalk + 2.5;
        mouths.push({ rect: { x0: hemX - hemW / 2, x1: hemX + hemW / 2, z0: block.z0 - mouthOut, z1: block.z0 + mouthDepth } });
        mouths.push({ rect: { x0: hemX - hemW / 2, x1: hemX + hemW / 2, z0: block.z1 - mouthDepth, z1: block.z1 + mouthOut } });
        mouths.push({ rect: { x0: block.x0 - mouthOut, x1: block.x0 + mouthDepth, z0: hemZ - hemW / 2, z1: hemZ + hemW / 2 } });
        mouths.push({ rect: { x0: block.x1 - mouthDepth, x1: block.x1 + mouthOut, z0: hemZ - hemW / 2, z1: hemZ + hemW / 2 } });
        blocks.push({
          id: `b-${blocks.length}`,
          district: id,
          ...block,
          hemCross: { x: hemX, z: hemZ, width: hemW },
          hemName,
          courts: [],
          perimeterM: 2 * (W + D),
        });
      }
    }
  }

  // (b) Mặt phố: rải lô từ từng bên của từng tuyến đường
  const mouthHit = (r: CityRect) => mouths.some((mm) => overlaps(mm.rect, r));
  const streetPhase: Record<string, { tried: number; placed: number; mouth: number; water: number }> = {};
  const phaseById: Record<string, { tried: number; placed: number; mouth: number; water: number; occ: number }> = {};
  for (const street of streets) {
    if (street.klass === "bridge") continue;
    const [ax, az] = street.points[0];
    const [bx, bz] = street.points[street.points.length - 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 10) continue;
    const vertical = Math.abs(ax - bx) < 0.01;
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const klass = districtAt((ax + bx) / 2, (az + bz) / 2);
    const g = GRID[districts.find((d) => d.id === klass)?.klass ?? "residential"];
    for (const side of [-1, 1] as const) {
      // Half-width + vỉa hè: mép ngoài của lòng đường bên này.
      const off = street.widthM / 2 + g.sidewalk;
      let t = 0;
      let guard = 0;
      while (t < len - 2.6 && guard++ < 400) {
        const lotW = Math.min(between(random, g.lot[0], g.lot[1]), len - t);
        if (lotW < 2.6) break;
        const depth = between(random, g.ring[0], g.ring[1]);
        const facade = (random() - 0.35) * 0.5;
        let rect: CityRect;
        let facing: CitySide;
        if (vertical) {
          // Đường dọc: bên trái/phải theo trục x.
          facing = side < 0 ? "e" : "w";
          const xa = ax + side * (off + facade);
          const xb = ax + side * (off + facade + depth);
          rect = { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: az + Math.min(uz * t, uz * (t + lotW)), z1: az + Math.max(uz * t, uz * (t + lotW)) };
        } else {
          facing = side < 0 ? "s" : "n";
          const za = az + side * (off + facade);
          const zb = az + side * (off + facade + depth);
          rect = { x0: ax + Math.min(ux * t, ux * (t + lotW)), x1: ax + Math.max(ux * t, ux * (t + lotW)), z0: Math.min(za, zb), z1: Math.max(za, zb) };
        }
        const cx = (rect.x0 + rect.x1) / 2;
        const cz = (rect.z0 + rect.z1) / 2;
        const stats = (streetPhase[street.klass] ??= { tried: 0, placed: 0, mouth: 0, water: 0 });
        const ps = (phaseById[street.id] ??= { tried: 0, placed: 0, mouth: 0, water: 0, occ: 0 });
        stats.tried += 1;
        ps.tried += 1;
        const hitMouth = mouthHit(rect);
        const ok = !hitMouth && !inWater(cx, cz) && cx > frame.x0 + 2 && cx < frame.x1 - 2 && cz > frame.z0 + 2 && cz < frame.z1 - 2;
        if (hitMouth) {
          stats.mouth += 1;
          ps.mouth += 1;
          // Nhảy qua đúng khẩu độ miệng hẻm rồi đặt tiếp, thay vì bỏ cả lô.
          let skip = 0;
          for (const mm of mouths) {
            if (!overlaps(mm.rect, rect)) continue;
            const edge = vertical ? (side > 0 ? mm.rect.x1 : mm.rect.x0) : (side > 0 ? mm.rect.z1 : mm.rect.z0);
            const along = vertical ? (edge - az) * Math.sign(uz) : (edge - ax) * Math.sign(ux);
            skip = Math.max(skip, along - t + 0.2);
          }
          t += Math.max(0.6, Math.min(skip, lotW + 8));
          continue;
        }
        if (!ok) stats.water += 1;
        if (!ok) ps.water += 1;
        if (ok && rect.x1 - rect.x0 >= 2.4 && rect.z1 - rect.z0 >= 2.4) {
          const isShop = random() < g.commercial;
          const kind = isShop ? pick(random, Object.keys(KIND_NAMES)) : pick(random, PLAIN_KINDS);
          const floors = Math.max(1, Math.round(between(random, g.floors[0], g.floors[1])));
          const make = (w: number) => {
            // Lô chạm giao lộ: cắt ngắn cho tới khi ra khỏi lòng tuyến cắt ngang rồi vẫn xây.
            // (Trước đây cả lô bị bỏ, nên mỗi ngã tư để lại một lỗ 5–8 m trên dãy mặt phố.)
            let width = w;
            for (let cut = 0; cut < 14; cut += 1) {
              const test: CityRect = vertical
                ? { ...rect, z0: Math.min(az + uz * t, az + uz * (t + width)), z1: Math.max(az + uz * t, az + uz * (t + width)) }
                : { ...rect, x0: Math.min(ax + ux * t, ax + ux * (t + width)), x1: Math.max(ax + ux * t, ax + ux * (t + width)) };
              if (!onRoad(test) && width >= 2.6) break;
              width -= 0.6;
            }
            if (width < 2.6) return null;
            const w2 = width;
            const r2 = vertical
              ? { ...rect, z0: Math.min(az + uz * t, az + uz * (t + w2)), z1: Math.max(az + uz * t, az + uz * (t + w2)) }
              : { ...rect, x0: Math.min(ax + ux * t, ax + ux * (t + w2)), x1: Math.max(ax + ux * t, ax + ux * (t + w2)) };
            return addBuilding({
              district: klass,
              ...r2,
              floors,
              heightM: +(floors * g.floorHeight + (random() < 0.3 ? 0.9 : 0)).toFixed(2),
              kind,
              facing,
              on: street.klass === "alley" ? "hem" : "street",
              street: street.name,
              shuttered: isShop && random() < 0.11,
            });
          };
          // Góc phố hay chồng lô: thử lô hẹp hơn trước khi bỏ trống mặt tiền.
          const building = make(lotW) ?? (lotW > 3.2 ? make(lotW * 0.55) : null);
          if (building) { stats.placed += 1; ps.placed += 1; }
          if (building && isShop) addShopPoi(building, facing, kind);
          t += building ? lotW : 1.6;
        } else {
          t += lotW;
        }
      }
    }
  }

  const rejectedBeforeInterior = rejectedOverlap;
  // (c) Ruột khối: hẻm xuyên, dãy nhà quay ra hẻm, sân chung có hẻm cụt dẫn vào
  for (const block of blocks) {
    const klass = districts.find((d) => d.id === block.district)?.klass ?? "residential";
    const g = GRID[klass];
    void klass;
    const hemX = block.hemCross.x;
    const hemZ = block.hemCross.z;
    const hemW = block.hemCross.width;
    const hemName = block.hemName;
    const ringDepth = g.ring[1] + 0.6;
    const quadrants: Array<{ rect: CityRect; vSide: CitySide; hSide: CitySide }> = [
      { rect: { x0: block.x0 + ringDepth, x1: hemX - hemW / 2, z0: block.z0 + ringDepth, z1: hemZ - hemW / 2 }, vSide: "e", hSide: "s" },
      { rect: { x0: hemX + hemW / 2, x1: block.x1 - ringDepth, z0: block.z0 + ringDepth, z1: hemZ - hemW / 2 }, vSide: "w", hSide: "s" },
      { rect: { x0: block.x0 + ringDepth, x1: hemX - hemW / 2, z0: hemZ + hemW / 2, z1: block.z1 - ringDepth }, vSide: "e", hSide: "n" },
      { rect: { x0: hemX + hemW / 2, x1: block.x1 - ringDepth, z0: hemZ + hemW / 2, z1: block.z1 - ringDepth }, vSide: "w", hSide: "n" },
    ];
    for (const q of quadrants) {
      const qw = q.rect.x1 - q.rect.x0;
      const qd = q.rect.z1 - q.rect.z0;
      if (qw < 9 || qd < 9) continue;
      const dV = between(random, 11, 15);
      const dH = between(random, 11, 15);
      const stubSpan = Math.max(1, qd - dH - 2.3);
      const stubV = between(random, 0.15, 0.85) * stubSpan;
      layBand(q.rect, { side: q.vSide, depth: dV, maxDepth: dV + 1.5, district: block.district, klass, on: "hem", street: hemName, commercial: 0.24, gaps: [[q.rect.z0 + stubV, q.rect.z0 + stubV + 2.3]] });
      const inner = q.vSide === "e" ? q.rect.x1 - dV : q.rect.x0 + dV;
      const hRange: [number, number] = q.vSide === "e" ? [q.rect.x0, inner] : [inner, q.rect.x1];
      if (hRange[1] - hRange[0] > 9) {
        const stubSpanH = Math.max(1, hRange[1] - hRange[0] - 2.3);
        const stubH = between(random, 0.15, 0.85) * stubSpanH;
        layBand(q.rect, { side: q.hSide, depth: dH, maxDepth: dH + 1.5, district: block.district, klass, on: "hem", street: hemName, commercial: 0.24, alongRange: hRange, gaps: [[hRange[0] + stubH, hRange[0] + stubH + 2.3]] });
      }
      const court: CityRect = q.vSide === "e"
        ? q.hSide === "s"
          ? { x0: q.rect.x0, x1: q.rect.x1 - dV, z0: q.rect.z0, z1: q.rect.z1 - dH }
          : { x0: q.rect.x0, x1: q.rect.x1 - dV, z0: q.rect.z0 + dH, z1: q.rect.z1 }
        : q.hSide === "s"
          ? { x0: q.rect.x0 + dV, x1: q.rect.x1, z0: q.rect.z0, z1: q.rect.z1 - dH }
          : { x0: q.rect.x0 + dV, x1: q.rect.x1, z0: q.rect.z0 + dH, z1: q.rect.z1 };
      if (court.x1 - court.x0 > 7 && court.z1 - court.z0 > 7) {
        block.courts.push(court);
        courtRects.push(court);
        fillCourt(court, block.district, klass, hemName);
      }
    }
  }

  // --- 4. Mốc thật: tháp, chợ, công viên, công trường --------------------------------------------
  const clearArea = (rect: CityRect, keepStreetWall = false) => {
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (!overlaps(b, rect)) continue;
      // Mốc thật không bao giờ bị mốc khác dọn: Ga Metro Bến Thành (đặt sau) từng xoá sạch chợ
      // Bến Thành (đặt trước) vì hai mốc nằm sát nhau — chợ biến mất mà không cổng nào báo.
      if (b.anchor) continue;
      // Công viên/quảng trường nằm SAU dãy nhà mặt phố: không xoá tường phố, chỉ dọn ruột khối.
      if (keepStreetWall && b.on === "street") continue;
      buildings.splice(i, 1);
    }
    for (const [k, list] of occ) {
      const keep = list.filter((r) => !overlaps(r, rect));
      if (keep.length) occ.set(k, keep);
      else occ.delete(k);
    }
    for (let i = pois.length - 1; i >= 0; i -= 1) {
      const p = pois[i];
      if (p.x > rect.x0 && p.x < rect.x1 && p.z > rect.z0 && p.z < rect.z1 && p.tier === "shop") pois.splice(i, 1);
    }
  };

  // Nhà của người chơi (phòng 6.07) không được nằm giữa lòng đường. Mốc "room" chiếu ra đúng gốc
  // bản đồ, mà lưới đại lộ lại đi qua gốc — nên nhà phải trượt ra lô trống gần nhất, còn POI/điểm
  // xuất phát theo nhà mới.
  let roomCenter = { x: ROOM.x, z: ROOM.z };
  /** Mốc thật đã dựng được toà; mốc nào không dựng được thì ghi tên (cổng kiểm toán đòi 9/9). */
  let anchorsPlaced = 0;
  const anchorsMissing: string[] = [];
  const offRoad = (rect: CityRect): CityRect => {
    const w = rect.x1 - rect.x0;
    const d = rect.z1 - rect.z0;
    const cx0 = (rect.x0 + rect.x1) / 2;
    const cz0 = (rect.z0 + rect.z1) / 2;
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let r = 1; r <= 96; r += 1) {
      for (const [sx, sz] of dirs) {
        const cand = { x0: cx0 + sx * r - w / 2, x1: cx0 + sx * r + w / 2, z0: cz0 + sz * r - d / 2, z1: cz0 + sz * r + d / 2 };
        const grown = inflate(cand, 0.8);
        if (grown.x0 < frame.x0 + 2 || grown.x1 > frame.x1 - 2 || grown.z0 < frame.z0 + 2 || grown.z1 > frame.z1 - 2) continue;
        if (onRoad(grown)) continue;
        if (water.some((wt) => overlaps(grown, wt))) continue;
        // Nhà dân thì dọn được (nhà của mình mọc lên chỗ 2–3 căn cũ), nhưng không được đè lên
        // mốc thật khác: Landmark, chợ, công viên là thứ không thể dời.
        if (buildings.some((b) => overlaps(b, grown) && (b.anchor || b.on === "anchor"))) continue;
        return cand;
      }
    }
    return rect;
  };

  for (const anchor of anchors) {
    const ward = anchor.ward;
    const half = anchor.footprintM / 2;
    if (anchor.kind === "park") {
      const r = half;
      const parkRect: CityRect = { x0: anchor.x - r, x1: anchor.x + r, z0: anchor.z - r * 0.72, z1: anchor.z + r * 0.72 };
      // Công viên lớn hơn một khối phải CẮT THEO KHỐI: một hình chữ nhật 180 m nuốt luôn cả con phố
      // chạy ngang qua nó và để lại 190 m mặt tiền trống. Cắt theo khối giữ nguyên mạng phố, công
      // viên thành vài mảng xanh liền nhau giữa các dãy nhà — đúng cách Tao Đàn nằm giữa phố.
      const parts = blocks
        .map((k) => ({ x0: Math.max(parkRect.x0, k.x0), x1: Math.min(parkRect.x1, k.x1), z0: Math.max(parkRect.z0, k.z0), z1: Math.min(parkRect.z1, k.z1) }))
        .filter((q) => q.x1 - q.x0 > 6 && q.z1 - q.z0 > 6);
      const pieces = parts.length ? parts : [parkRect];
      for (const piece of pieces) {
        clearArea(inflate(piece, 2), true);
        addBuilding({ district: ward, ...piece, floors: 0, heightM: 0.25, kind: "park", facing: "n", on: "anchor", anchor: anchor.id, walkable: true });
      }
      if (pieces.length) anchorsPlaced += 1;
      else anchorsMissing.push(`park ${anchor.id}`);
      pois.push({ id: `poi-${poiSeq++}`, name: anchor.name, kind: "park", x: anchor.x, z: anchor.z, district: ward, tier: "venue", story: "chỗ gặp kín", anchor: anchor.id });
      continue;
    }
    if (anchor.kind === "metro-site") {
      // Ga Hòa Hưng rộng 90 m: không có ô trống nào 90 m trong nội thành, nên phải THU NHỎ dần
      // chứ không bỏ — ga là mốc cốt truyện, mất ga là mất cảnh.
      const site0: CityRect = { x0: anchor.x - half, x1: anchor.x + half, z0: anchor.z - half * 0.62, z1: anchor.z + half * 0.62 };
      let placed: CityRect | null = null;
      for (const scale of [1, 0.78, 0.6, 0.46, 0.34]) {
        const w0 = (site0.x1 - site0.x0) * scale;
        const d0 = (site0.z1 - site0.z0) * scale;
        const cx0 = (site0.x0 + site0.x1) / 2;
        const cz0 = (site0.z0 + site0.z1) / 2;
        const cand = offRoad({ x0: cx0 - w0 / 2, x1: cx0 + w0 / 2, z0: cz0 - d0 / 2, z1: cz0 + d0 / 2 });
        clearArea(inflate(cand, 1.4));
        if (addBuilding({ district: ward, ...cand, floors: 1, heightM: 4.2, kind: "metro-site", facing: "n", on: "anchor", anchor: anchor.id })) {
          placed = cand;
          break;
        }
      }
      if (placed) anchorsPlaced += 1;
      else anchorsMissing.push(`metro-site ${anchor.id}`);
      pois.push({ id: `poi-${poiSeq++}`, name: anchor.name, kind: "metro-site", x: anchor.x, z: (placed?.z1 ?? anchor.z) + 2, district: ward, tier: "venue", story: "rào tôn, lối tắt, hối lộ", anchor: anchor.id });
      continue;
    }
    if (anchor.kind === "market") {
      // Chợ lớn hơn một khối (Bình Tây 70 m, Bến Thành 66 m) thì CẮT THEO KHỐI như công viên. Bản
      // cũ đặt một hình chữ nhật 70 m đè lên phố ⇒ `addBuilding` từ chối vì đè lòng đường, và cả
      // ba cái chợ BIẾN MẤT khỏi bản đồ trong khi bài kiểm toán vẫn báo "đạt toàn bộ cổng".
      const marketRect: CityRect = { x0: anchor.x - half, x1: anchor.x + half, z0: anchor.z - half * 0.8, z1: anchor.z + half * 0.8 };
      let built = 0;
      let frontEdge: CityRect | null = null;
      // Thu nhỏ dần cho tới khi có mảng nào rời được lòng đường. Bình Tây 70 m nằm giữa hai phố:
      // hình chữ nhật đầy đủ luôn chạm mặt nạ đường, và trước đây chợ bị bỏ im lặng.
      for (const scale of [1, 0.88, 0.76, 0.64, 0.52]) {
        const w0 = (marketRect.x1 - marketRect.x0) * scale;
        const d0 = (marketRect.z1 - marketRect.z0) * scale;
        const cx0 = (marketRect.x0 + marketRect.x1) / 2;
        const cz0 = (marketRect.z0 + marketRect.z1) / 2;
        const src: CityRect = { x0: cx0 - w0 / 2, x1: cx0 + w0 / 2, z0: cz0 - d0 / 2, z1: cz0 + d0 / 2 };
        const parts = blocks
          .map((k) => ({ x0: Math.max(src.x0, k.x0), x1: Math.min(src.x1, k.x1), z0: Math.max(src.z0, k.z0), z1: Math.min(src.z1, k.z1) }))
          .filter((q) => q.x1 - q.x0 > 7 && q.z1 - q.z0 > 7 && !onRoad(inflate(q, 1)));
        // Không mảng nào rời lòng đường (chợ nằm trọn trong một khối) thì trượt cả hình chữ nhật
        // ra ô trống gần nhất, đừng bỏ chợ.
        const pieces = parts.length ? parts : [offRoad(src)];
        for (const piece of pieces) {
          // Chợ THAY dãy nhà, không nằm sau nó: giữ tường phố thì chính tường đó chặn chợ và
          // `addBuilding` từ chối — đúng lý do Bến Thành/Bình Tây từng biến mất.
          clearArea(inflate(piece, 1.6));
          if (addBuilding({ district: ward, ...piece, floors: 3, heightM: 12, kind: "market", facing: "n", on: "anchor", anchor: anchor.id })) {
            built += 1;
            if (!frontEdge) frontEdge = piece;
          }
        }
        if (built) break;
      }
      if (built) anchorsPlaced += 1;
      else anchorsMissing.push(`market ${anchor.id}`);
      // POI đứng TRƯỚC cửa chợ, không nằm trong lòng chợ (POI trong toà là POI không tới được).
      const mFront = frontEdge as CityRect | null;
      pois.push({
        id: `poi-${poiSeq++}`,
        name: anchor.name,
        kind: "market",
        x: mFront ? (mFront.x0 + mFront.x1) / 2 : anchor.x,
        z: mFront ? mFront.z1 + 1.8 : anchor.z,
        district: ward,
        tier: "venue",
        anchor: anchor.id,
        story: "chợ thật, giá thật, người thật",
      });
      continue;
    }
    let footprint: CityRect = { x0: anchor.x - half, x1: anchor.x + half, z0: anchor.z - half, z1: anchor.z + half };
    clearArea(inflate(footprint, 2.2));
    if (anchor.kind === "home" || anchor.id === "room") {
      footprint = offRoad(footprint);
      clearArea(inflate(footprint, 1.0));
      roomCenter = { x: (footprint.x0 + footprint.x1) / 2, z: (footprint.z0 + footprint.z1) / 2 };
    }
    const floors = anchor.kind === "metro" ? 3 : Math.max(6, Math.round(anchor.heightM / 3.9));
    // Toà mốc không bao giờ được lặng lẽ biến mất: nếu lô vẫn đè lòng đường thì thu nhỏ dần, chứ
    // không bỏ. Sáu trong chín mốc (Bitexco, Bến Thành, Bình Tây, An Đông, hai ga metro) từng
    // không có toà nào trên bản đồ mà không cổng nào bắt được.
    let placedRect = offRoad(footprint);
    let towerOk = false;
    for (let shrink = 0; shrink < 5 && !towerOk; shrink += 1) {
      const cxr = (placedRect.x0 + placedRect.x1) / 2;
      const czr = (placedRect.z0 + placedRect.z1) / 2;
      const k = 1 - shrink * 0.14;
      const tryRect: CityRect = {
        x0: cxr - ((placedRect.x1 - placedRect.x0) / 2) * k,
        x1: cxr + ((placedRect.x1 - placedRect.x0) / 2) * k,
        z0: czr - ((placedRect.z1 - placedRect.z0) / 2) * k,
        z1: czr + ((placedRect.z1 - placedRect.z0) / 2) * k,
      };
      const fitted = shrink === 0 ? placedRect : offRoad(tryRect);
      clearArea(inflate(fitted, 1.2), true);
      if (addBuilding({ district: ward, ...fitted, floors, heightM: anchor.heightM || 12, kind: anchor.kind, facing: "n", on: "anchor", anchor: anchor.id })) {
        placedRect = fitted;
        towerOk = true;
      }
    }
    if (towerOk) anchorsPlaced += 1;
    else anchorsMissing.push(`${anchor.kind} ${anchor.id}`);
    footprint = placedRect;
    pois.push({
      id: `poi-${poiSeq++}`,
      name: anchor.name,
      kind: anchor.kind,
      x: anchor.x,
      z: footprint.z1 + 1.2,
      district: ward,
      tier: "venue",
      anchor: anchor.id,
      story: anchor.kind === "market" ? "chợ thật, giá thật, người thật" : undefined,
    });
  }

  // --- 5. Địa điểm có cốt truyện ----------------------------------------------------------------
  const walkableAt = (x: number, z: number) => {
    if (x < frame.x0 + 1 || x > frame.x1 - 1 || z < frame.z0 + 1 || z > frame.z1 - 1) return false;
    if (inWater(x, z)) return false;
    for (const b of buildings) if (!b.walkable && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
    return true;
  };
  /** Venue đặt lên đỉnh toà tháp thì phải trượt ra cửa — nếu không nó nằm trong lòng bê tông. */
  const snapToGround = (x: number, z: number): { x: number; z: number } => {
    if (walkableAt(x, z)) return { x, z };
    for (let r = 0.6; r < 46; r += 0.8) {
      for (let k = 0; k < 24; k += 1) {
        const a = (k / 24) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (walkableAt(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  };

  const anchorById = new Map(anchors.map((a) => [a.id, a]));
  const venuePoiId = new Map<string, string>();
  for (const venue of PLAN.venues) {
    const anchor = anchorById.get(venue.anchor);
    if (!anchor) continue;
    const spot = snapToGround(anchor.x + venue.offset[0], anchor.z + venue.offset[1]);
    const id = `venue-${venue.id}`;
    venuePoiId.set(venue.id, id);
    pois.push({
      id,
      name: venue.name,
      kind: venue.kind,
      x: spot.x,
      z: spot.z,
      district: anchor.ward,
      tier: "venue",
      story: venue.story,
      anchor: anchor.id,
    });
  }

  // Beats nối cốt truyện vào địa điểm: mỗi beat gắn vào đúng POI mà nó nói tới.
  for (const beat of PLAN.beats) {
    for (const venueId of beat.where) {
      const id = venuePoiId.get(venueId);
      const poi = id ? pois.find((p) => p.id === id) : undefined;
      if (poi) poi.beat = beat.id;
    }
  }

  // Mặt cầu: tuyến klass "bridge" là một mặt sàn đi được bắc qua nước.
  const decks: CityRect[] = streets
    .filter((st) => st.klass === "bridge")
    .map((st) => {
      const [ax, az] = st.points[0];
      const [bx, bz] = st.points[st.points.length - 1];
      const h = st.widthM / 2;
      const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
      const minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
      return maxX - minX < 0.01
        ? { x0: ax - h, x1: ax + h, z0: minZ - h, z1: maxZ + h }
        : { x0: minX - h, x1: maxX + h, z0: az - h, z1: az + h };
    });

  // --- 5c. Vá ổ kín: đục hẻm cụt ngắn nhất ----------------------------------------------------
  // Sau khi rải nhà, vài chục mét vuông có thể bị bọc kín (thường là góc sân chung). Một ổ kín
  // không phải "hẻm cụt" — hẻm cụt vẫn vào được. Nên chỗ nào kín thì đục một lối 2,2 m tới chỗ
  // đi được gần nhất, và GHI LẠI số lần phải đục để không giấu lỗi hình học.
  let connectionRepairs = 0;

  for (let pass = 0; pass < 4; pass += 1) {
    const grid = rasterize({ frame, water, buildings, decks });
    const { nx: gx, nz: gz, cells: gc } = grid;
    const comp = new Int32Array(gx * gz).fill(-1);
    const queue = new Int32Array(gx * gz);
    let mainId = -1;
    let mainSize = 0;
    let comps = 0;
    for (let k = 0; k < gc.length; k += 1) {
      if (gc[k] !== 0 || comp[k] >= 0) continue;
      const id = comps++;
      let head = 0;
      let tail = 0;
      queue[tail++] = k;
      comp[k] = id;
      let size = 0;
      while (head < tail) {
        const cur = queue[head++];
        size += 1;
        const i = cur % gx;
        const j = (cur - i) / gx;
        if (i > 0 && gc[cur - 1] === 0 && comp[cur - 1] < 0) { comp[cur - 1] = id; queue[tail++] = cur - 1; }
        if (i < gx - 1 && gc[cur + 1] === 0 && comp[cur + 1] < 0) { comp[cur + 1] = id; queue[tail++] = cur + 1; }
        if (j > 0 && gc[cur - gx] === 0 && comp[cur - gx] < 0) { comp[cur - gx] = id; queue[tail++] = cur - gx; }
        if (j < gz - 1 && gc[cur + gx] === 0 && comp[cur + gx] < 0) { comp[cur + gx] = id; queue[tail++] = cur + gx; }
      }
      if (size > mainSize) {
        mainSize = size;
        mainId = id;
      }
    }
    if (comps <= 1) break;
    // BFS xuyên vật thể từ vùng chính. Ưu tiên đục qua sân/hẻm/nhà trong khối; CHỈ khoan qua
    // dãy mặt phố khi không còn lối nào khác — mặt phố là thứ người chơi nhìn thấy.
    // (đánh dấu ô thuộc tường mặt phố để bước chọn đoạn đục biết đường nào đắt)
    const wallOfStreet = new Uint8Array(gx * gz);
    for (const b of buildings) {
      if (b.anchor || b.walkable || b.on !== "street") continue;
      const i0 = Math.max(0, Math.floor((b.x0 - frame.x0) / grid.step));
      const i1 = Math.min(gx - 1, Math.floor((b.x1 - frame.x0) / grid.step));
      const j0 = Math.max(0, Math.floor((b.z0 - frame.z0) / grid.step));
      const j1 = Math.min(gz - 1, Math.floor((b.z1 - frame.z0) / grid.step));
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) wallOfStreet[j * gx + i] = 1;
    }
    const runBfs = (avoidStreet: boolean) => {
      const parent = new Int32Array(gx * gz).fill(-2);
      let head = 0;
      let tail = 0;
      for (let k = 0; k < gc.length; k += 1) {
        if (comp[k] === mainId) {
          parent[k] = -1;
          queue[tail++] = k;
        }
      }
      const pockets: number[] = [];
      while (head < tail) {
        const cur = queue[head++];
        const i = cur % gx;
        const j = (cur - i) / gx;
        for (const n of [i > 0 ? cur - 1 : -1, i < gx - 1 ? cur + 1 : -1, j > 0 ? cur - gx : -1, j < gz - 1 ? cur + gx : -1]) {
          if (n < 0 || parent[n] !== -2) continue;
          if (avoidStreet && gc[n] !== 0 && wallOfStreet[n]) continue;
          parent[n] = cur;
          if (comp[n] >= 0 && comp[n] !== mainId) pockets.push(n);
          queue[tail++] = n;
        }
      }
      return { parent, pockets };
    };
    // Một lượt BFS; việc "tránh tường mặt phố" do bước chọn đoạn đục bên dưới lo (rẻ hơn 2×BFS).
    let { parent, pockets: pocketCells } = runBfs(false);
    if (!pocketCells.length) break;
    // Đường BFS chạy XUYÊN vật thể nên nó có thể chạy dọc bên trong cả dãy nhà và xoá sạch dãy đó.
    // Chỉ đục đúng một đoạn tường mỏng nhất trên đường: tách path thành các đoạn đặc/trống, chọn
    // đoạn đặc rẻ nhất (ưu tiên không phải tường mặt phố), rồi xoá nhà phủ đoạn đó.
    const doomed = new Set<string>();
    for (const cell of pocketCells) {
      let cur = cell;
      const path: number[] = [];
      while (cur >= 0 && parent[cur] !== -1) {
        path.push(cur);
        cur = parent[cur];
      }
      let bestScore = Infinity;
      let bestRun: number[] = [];
      for (let start = 0; start < path.length; start += 1) {
        if (gc[path[start]] === 0) continue;
        let end = start;
        let score = 0;
        while (end < path.length && gc[path[end]] !== 0) {
          score += 1 + (wallOfStreet[path[end]] ? 6 : 0);
          end += 1;
        }
        if (score < bestScore) {
          bestScore = score;
          bestRun = path.slice(start, end);
        }
        start = end;
      }
      for (const k of bestRun) {
        const i = k % gx;
        const j = (k - i) / gx;
        const x = frame.x0 + (i + 0.5) * grid.step;
        const z = frame.z0 + (j + 0.5) * grid.step;
        const probe: CityRect = { x0: x - 1.2, x1: x + 1.2, z0: z - 1.2, z1: z + 1.2 };
        for (const b of buildings) {
          if (!overlaps(b, probe) || b.anchor || b.walkable) continue;
          doomed.add(b.id);
          if (b.poi) doomed.add(b.poi);
        }
      }
    }
    if (!doomed.size) break;
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      if (doomed.has(buildings[i].id)) {
        const b = buildings[i];
        const i0 = Math.floor(b.x0 / occCell);
        const i1 = Math.floor(b.x1 / occCell);
        const j0 = Math.floor(b.z0 / occCell);
        const j1 = Math.floor(b.z1 / occCell);
        for (let a = i0; a <= i1; a += 1) {
          for (let c = j0; c <= j1; c += 1) {
            const key = occKey(a, c);
            const list = occ.get(key);
            if (list) {
              const keep = list.filter((r) => r !== b);
              if (keep.length) occ.set(key, keep);
              else occ.delete(key);
            }
          }
        }
        buildings.splice(i, 1);
        connectionRepairs += 1;
      }
    }
    for (let i = pois.length - 1; i >= 0; i -= 1) {
      if (doomed.has(pois[i].id)) pois.splice(i, 1);
    }
  }

  // --- 5d. Dời POI về chỗ đứng được -----------------------------------------------------------
  // Nhà Sài Gòn xây sát nhau, nên một POI đặt "cách mặt tiền 1,1 m" rất dễ rơi vào lòng nhà bên
  // cạnh. Cửa hàng thì phải có chỗ đứng trước cửa: dời ≤4 m, theo lưới đi được, và đếm lại.
  const solidIndex = buildRectIndex(buildings.filter((b) => !b.walkable));
  const waterIndex = buildRectIndex(water);
  const freeAt = (x: number, z: number) =>
    x > frame.x0 + 1 && x < frame.x1 - 1 && z > frame.z0 + 1 && z < frame.z1 - 1 &&
    !waterIndex.some(x, z) && !solidIndex.some(x, z);
  // Điểm xuất phát: tâm "phòng" nằm TRONG toà nhà nên không đứng được. Lấy điểm đi được gần nhất
  // (ngưỡng cửa) và xuất ra thành `start` — nếu để engine tự đoán, người chơi spawn trong tường.
  const start = (() => {
    // Tìm điểm đứng được GẦN NHẤT nhưng ưu tiên phía mặt phố: nhà ống có cửa trước và lối sau,
    // và người chơi phải bước ra từ cửa trước, không phải từ đuôi nhà.
    let face = { x: roomCenter.x + 1, z: roomCenter.z, d: Infinity };
    for (const st of streets) {
      const [ax, az] = st.points[0];
      const [bx, bz] = st.points[st.points.length - 1];
      const vx = bx - ax;
      const vz = bz - az;
      const len2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((roomCenter.x - ax) * vx + (roomCenter.z - az) * vz) / len2));
      const px = ax + vx * t;
      const pz = az + vz * t;
      const d = Math.hypot(px - roomCenter.x, pz - roomCenter.z);
      if (d < face.d) face = { x: px, z: pz, d };
    }
    const base = Math.atan2(face.z - roomCenter.z, face.x - roomCenter.x);
    for (let r = 0.5; r <= 18; r += 0.5) {
      for (let k = 0; k < 48; k += 1) {
        const step = Math.ceil(k / 2) * (Math.PI * 2 / 48);
        const a = base + (k % 2 === 1 ? step : -step);
        const x = roomCenter.x + Math.cos(a) * r;
        const z = roomCenter.z + Math.sin(a) * r;
        // Đứng cách tường 0,6 m: điểm sát mép tường vẫn "đi được" trên giấy nhưng người chơi
        // sẽ bị đẩy ra ngay khi bước vào, và camera ngưỡng cửa dán mặt vào gạch.
        if (freeAt(x, z) && freeAt(x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6)) {
          // Trả điểm đã bước ra 0,6 m: nếu trả đúng mặt tường thì hình học nói "đi được" còn lưới
          // 0,5 m của engine nói "trong tường", và người chơi spawn kẹt ngay ô đầu.
          return {
            x: +(x + Math.cos(a) * 0.6).toFixed(2),
            z: +(z + Math.sin(a) * 0.6).toFixed(2),
            distanceFromRoomM: +(r + 0.6).toFixed(1),
          };
        }
      }
    }
    return { x: roomCenter.x, z: roomCenter.z, distanceFromRoomM: 0 };
  })();
  let relocated = 0;
  for (const poi of pois) {
    if (freeAt(poi.x, poi.z)) continue;
    let done = false;
    for (let r = 0.5; r <= 9 && !done; r += 0.5) {
      for (let k = 0; k < 32 && !done; k += 1) {
        const a = (k / 32) * Math.PI * 2;
        const px = poi.x + Math.cos(a) * r;
        const pz = poi.z + Math.sin(a) * r;
        if (freeAt(px, pz)) {
          poi.x = px;
          poi.z = pz;
          relocated += 1;
          done = true;
        }
      }
    }
  }

  // --- 6. Vật thể vỉa hè + sân chung -----------------------------------------------------------
  const props: CityProp[] = [];
  const buildingGrid = buildRectIndex(buildings, 24);
  // Vật thể vỉa hè KHÔNG được rơi vào khu phố gốc: chỗ đó đã có đồ thật của map gốc (cây, ghế,
  // bồn rác chim cánh cụt, xe dựng, giỏ hàng). Trước khi chặn, thùng/cọc của thành phố đứng giữa
  // lòng đường khu phố thành mấy khối xám lơ lửng.
  const inCore = (x: number, z: number) =>
    (Math.abs(x - core.x) < 72 && Math.abs(z - core.z) < 28) ||
    (x > core.x + coreBack.bx0 && x < core.x + coreBack.bx1 && z > core.z + coreBack.bz0 && z < core.z + coreBack.bz1);
  const freeSpot = (x: number, z: number) => !inWater(x, z) && !buildingGrid.some(x, z) && !inCore(x, z) && x > frame.x0 && x < frame.x1 && z > frame.z0 && z < frame.z1;

  for (const street of streets) {
    const [ax, az] = street.points[0];
    const [bx, bz] = street.points[street.points.length - 1];
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 8) continue;
    const ux = (bx - ax) / length;
    const uz = (bz - az) / length;
    const step = street.klass === "alley" ? 4.2 : 3.25;
    for (let t = 5; t < length - 3; t += step * between(random, 0.8, 1.2)) {
      const side = random() < 0.5 ? -1 : 1;
      const off = street.widthM / 2 + between(random, 0.3, 1.5) * side;
      const x = ax + ux * t - uz * off;
      const z = az + uz * t + ux * off;
      if (!freeSpot(x, z)) continue;
      const roll = random();
      const kind: CityPropKind =
        street.klass === "alley"
          ? roll < 0.28 ? "moto" : roll < 0.58 ? "clothes" : roll < 0.74 ? "bin" : roll < 0.88 ? "lamp" : "tank"
          : roll < 0.24 ? "tree" : roll < 0.52 ? "moto" : roll < 0.68 ? "lamp" : roll < 0.8 ? "bin" : roll < 0.9 ? "sign" : "stall";
      props.push({ kind, x, z, rot: random() * Math.PI * 2 });
    }
  }
  for (const court of courtRects) {
    const area = rectArea(court);
    const count = Math.max(2, Math.round(area / 22));
    for (let i = 0; i < count; i += 1) {
      const x = between(random, court.x0 + 0.8, court.x1 - 0.8);
      const z = between(random, court.z0 + 0.8, court.z1 - 0.8);
      if (!freeSpot(x, z)) continue;
      const roll = random();
      props.push({ kind: roll < 0.3 ? "clothes" : roll < 0.5 ? "tank" : roll < 0.66 ? "tree" : roll < 0.8 ? "shrine" : "bin", x, z, rot: random() * Math.PI * 2 });
    }
  }
  // Công trường metro Hoà Hưng: rào tôn quanh chu vi, còn cẩu/thép để lớp 3D.
  for (const anchor of anchors.filter((a) => a.kind === "metro-site")) {
    const half = anchor.footprintM / 2;
    const zHalf = half * 0.62;
    for (let x = anchor.x - half; x <= anchor.x + half; x += 3) {
      props.push({ kind: "hoarding", x, z: anchor.z - zHalf - 1, rot: 0 });
      props.push({ kind: "hoarding", x, z: anchor.z + zHalf + 1, rot: Math.PI });
    }
    for (let z = anchor.z - zHalf; z <= anchor.z + zHalf; z += 3) {
      props.push({ kind: "hoarding", x: anchor.x - half - 1, z, rot: Math.PI / 2 });
      props.push({ kind: "hoarding", x: anchor.x + half + 1, z, rot: Math.PI / 2 });
    }
    for (let i = 0; i < 6; i += 1) props.push({ kind: "cone", x: between(random, anchor.x - half, anchor.x + half), z: anchor.z + zHalf + 2.2, rot: 0 });
  }

  // --- 7. Đo bằng raster -----------------------------------------------------------------------
  const walk = rasterize({ frame, water, buildings, decks });
  // Bất biến cuối: điểm POI phải đứng được theo CẢ HAI cách đo — hình học chính xác (không nằm trong
  // hình chữ nhật toà nào) và lưới 0,5 m của engine. POI được nắn lúc đặt, nhưng lô mọc sau vẫn đè
  // lên được (đổi thứ tự rải lô là đổi kết quả) — nắn lại sau khi lưới chốt thì bất biến luôn đúng.
  {
    const solidPts = buildRectIndex(buildings.filter((b) => !b.walkable), 16);
    const waterPts = buildRectIndex(water, 16);
    const deckPts = buildRectIndex(decks, 16);
    const cellValue = (x: number, z: number) => {
      const i = Math.floor((x - frame.x0) / walk.step);
      const j = Math.floor((z - frame.z0) / walk.step);
      if (i < 0 || j < 0 || i >= walk.nx || j >= walk.nz) return -1;
      return walk.cells[j * walk.nx + i];
    };
    const standable = (x: number, z: number) =>
      x > frame.x0 && x < frame.x1 && z > frame.z0 && z < frame.z1 &&
      (deckPts.some(x, z) || (!waterPts.some(x, z) && !solidPts.some(x, z))) &&
      cellValue(x, z) === 0;
    for (const poi of pois) {
      if (standable(poi.x, poi.z)) continue;
      let best: { x: number; z: number } | null = null;
      for (let r = 0.5; r <= 18 && !best; r += 0.5) {
        for (let k = 0; k < 32 && !best; k += 1) {
          const a = (k / 32) * Math.PI * 2;
          const px = +(poi.x + Math.cos(a) * r).toFixed(2);
          const pz = +(poi.z + Math.sin(a) * r).toFixed(2);
          if (standable(px, pz)) best = { x: px, z: pz };
        }
      }
      if (best) {
        poi.x = best.x;
        poi.z = best.z;
      }
    }
  }
  const stats = measure(walk, { frame, districts, buildings, streets, pois, blocks, water, anchors }, start);
  stats.rejectedOverlap = rejectedOverlap;
  stats.connectionRepairs = connectionRepairs;
  stats.rejectedStreetPhase = rejectedBeforeInterior;
  stats.streetPhase = streetPhase;
  stats.phaseById = phaseById;
  stats.hemSkipped = hemSkipped;
  stats.anchorsPlaced = anchorsPlaced;
  stats.anchorsMissing = anchorsMissing;
  stats.rejectedRoad = rejectedRoad;
  stats.rejectedRoadSamples = rejectedRoadSamples;
  stats.relocatedPois = relocated;

  return {
    seed: PLAN.seed,
    start,
    frame,
    compression,
    districts,
    water,
    anchors,
    blocks,
    buildings,
    streets,
    pois,
    props,
    core,
    walk,
    decks,
    metrics: stats,
  };
}

function intersectRect(a: CityRect, b: CityRect): CityRect {
  return { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) };
}

/** Lưới 1 m: 0 = đi được, 1 = toà nhà, 2 = nước. */
function rasterize(city: { frame: CityRect; water: Array<CityRect>; buildings: CityBuilding[]; decks?: Array<CityRect> }, step = 0.5): CityWalkGrid {
  const f = city.frame;
  const nx = Math.max(1, Math.ceil((f.x1 - f.x0) / step));
  const nz = Math.max(1, Math.ceil((f.z1 - f.z0) / step));
  const cells = new Uint8Array(nx * nz);
  // Lấy mẫu theo TÂM ô: ô được đánh dấu chỉ khi tâm ô nằm trong hình. Cách cũ (floor..ceil) nở mỗi
  // toà ra ngoài tới 1 ô mỗi phía, đủ để bóp nghẹt hẻm 1–2 m và biến 160 chỗ đi được thành ảo.
  const paint = (r: CityRect, value: number) => {
    const i0 = Math.max(0, Math.ceil((r.x0 - f.x0) / step - 0.5));
    const i1 = Math.min(nx, Math.ceil((r.x1 - f.x0) / step - 0.5));
    const j0 = Math.max(0, Math.ceil((r.z0 - f.z0) / step - 0.5));
    const j1 = Math.min(nz, Math.ceil((r.z1 - f.z0) / step - 0.5));
    for (let j = j0; j < j1; j += 1) for (let i = i0; i < i1; i += 1) cells[j * nx + i] = value;
  };
  for (const w of city.water) paint(w, 2);
  for (const b of city.buildings) if (!b.walkable) paint(b, 1);
  // Mặt cầu: đi được DÙ bên dưới là nước. Cầu không đi được là một lời nói dối trên bản đồ.
  for (const d of city.decks ?? []) paint(d, 0);
  return { step, nx, nz, cells, start: { x: ROOM.x, z: ROOM.z } };
}

function measure(
  walk: CityWalkGrid,
  city: {
    frame: CityRect;
    water: Array<CityRect>;
    districts: City["districts"];
    buildings: CityBuilding[];
    streets: CityStreet[];
    pois: CityPoi[];
    blocks: CityBlock[];
    anchors: CityAnchor[];
  },
  room: { x: number; z: number },
): CityMetrics {
  const { nx, nz, cells, step } = walk;
  const f = city.frame;
  const idx = (i: number, j: number) => j * nx + i;
  const iOf = (x: number) => Math.floor((x - f.x0) / step);
  const jOf = (z: number) => Math.floor((z - f.z0) / step);

  let walkable = 0;
  let roof = 0;
  for (let k = 0; k < cells.length; k += 1) {
    if (cells[k] === 0) walkable += 1;
    else if (cells[k] === 1) roof += 1;
  }
  const cellArea = step * step;
  const frameArea = rectArea(f);
  const waterArea = city.water.reduce((sum, w) => sum + rectArea(w), 0);
  const landArea = frameArea - waterArea;

  // Vùng liền mạch: đếm mọi vùng, và vùng lớn nhất.
  const comp = new Int32Array(nx * nz).fill(-1);
  const sizes: number[] = [];
  const queue = new Int32Array(nx * nz);
  for (let k = 0; k < cells.length; k += 1) {
    if (cells[k] !== 0 || comp[k] >= 0) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = k;
    comp[k] = id;
    let size = 0;
    while (head < tail) {
      const cur = queue[head++];
      size += 1;
      const i = cur % nx;
      const j = (cur - i) / nx;
      if (i > 0) { const n = cur - 1; if (cells[n] === 0 && comp[n] < 0) { comp[n] = id; queue[tail++] = n; } }
      if (i < nx - 1) { const n = cur + 1; if (cells[n] === 0 && comp[n] < 0) { comp[n] = id; queue[tail++] = n; } }
      if (j > 0) { const n = cur - nx; if (cells[n] === 0 && comp[n] < 0) { comp[n] = id; queue[tail++] = n; } }
      if (j < nz - 1) { const n = cur + nx; if (cells[n] === 0 && comp[n] < 0) { comp[n] = id; queue[tail++] = n; } }
    }
    sizes.push(size);
  }
  const largest = sizes.length ? Math.max(...sizes) : 0;

  // BFS từ phòng 6.07.
  const dist = new Int32Array(nx * nz).fill(-1);
  let si = Math.max(0, Math.min(nx - 1, iOf(room.x)));
  let sj = Math.max(0, Math.min(nz - 1, jOf(room.z)));
  if (cells[idx(si, sj)] !== 0) {
    let found = false;
    for (let r = 1; r < 60 && !found; r += 1) {
      for (let di = -r; di <= r && !found; di += 1) {
        for (let dj = -r; dj <= r && !found; dj += 1) {
          const i = si + di;
          const j = sj + dj;
          if (i >= 0 && j >= 0 && i < nx && j < nz && cells[idx(i, j)] === 0) { si = i; sj = j; found = true; }
        }
      }
    }
  }
  let head = 0;
  let tail = 0;
  dist[idx(si, sj)] = 0;
  queue[tail++] = idx(si, sj);
  let reachable = 0;
  while (head < tail) {
    const cur = queue[head++];
    reachable += 1;
    const i = cur % nx;
    const j = (cur - i) / nx;
    const d = dist[cur];
    if (i > 0) { const n = cur - 1; if (cells[n] === 0 && dist[n] < 0) { dist[n] = d + 1; queue[tail++] = n; } }
    if (i < nx - 1) { const n = cur + 1; if (cells[n] === 0 && dist[n] < 0) { dist[n] = d + 1; queue[tail++] = n; } }
    if (j > 0) { const n = cur - nx; if (cells[n] === 0 && dist[n] < 0) { dist[n] = d + 1; queue[tail++] = n; } }
    if (j < nz - 1) { const n = cur + nx; if (cells[n] === 0 && dist[n] < 0) { dist[n] = d + 1; queue[tail++] = n; } }
  }

  // Gán phường cho từng ô để đo theo phường (dùng lưới thô 1 m, gán theo tâm ô).
  const districtAt = (x: number, z: number): string | null => {
    for (const d of city.districts) if (d.tiles.some((t) => x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1)) return d.id;
    return null;
  };

  const streetLengthM = city.streets.reduce((sum, s) => {
    let len = 0;
    for (let i = 1; i < s.points.length; i += 1) len += Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][1] - s.points[i - 1][1]);
    return sum + len;
  }, 0);
  const hemLengthM = city.streets.filter((s) => s.klass === "alley").reduce((sum, s) => {
    let len = 0;
    for (let i = 1; i < s.points.length; i += 1) len += Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][1] - s.points[i - 1][1]);
    return sum + len;
  }, 0);
  const functionsCount = city.pois.filter((p) => p.tier === "shop").length;

  // --- Mặt tiền: đo bằng hình học ---------------------------------------------------------------
  // Mỗi toà có một cạnh mặt tiền (theo `facing`). Chiếu cạnh đó lên tuyến đường gần nhất (khoảng
  // cách phải nằm trong [nửa bề rộng, nửa bề rộng + 14 m] — tính cả đại lộ rộng, nơi nhà đứng xa
  // tim đường). Kết quả: bao nhiêu mét mặt tiền CÓ nhà, mỗi 100 m được bao nhiêu đơn vị, và đoạn
  // chết dài nhất.
  const frontEdges = city.buildings
    .filter((b) => b.on === "street" || b.on === "hem")
    .map((b) => {
      const edge: [[number, number], [number, number]] =
        b.facing === "n" ? [[b.x0, b.z0], [b.x1, b.z0]]
          : b.facing === "s" ? [[b.x0, b.z1], [b.x1, b.z1]]
            : b.facing === "w" ? [[b.x0, b.z0], [b.x0, b.z1]]
              : [[b.x1, b.z0], [b.x1, b.z1]];
      return { b, edge };
    });

  // Mỗi toà chỉ được gán cho MỘT tuyến gần nhất (trước đây một toà bị đếm cho nhiều tuyến).
  interface StreetFront {
    units: number;
    shops: number;
    /** Đơn vị theo từng bên (+1 / −1) — để đo nhịp trên đúng đoạn có tường phố. */
    unitsBySide: Record<string, number>;
    built: number;
    intervals: Array<{ side: 1 | -1; t0: number; t1: number }>;
    length: number;
    klass: string;
    ax: number;
    az: number;
    ux: number;
    uz: number;
    width: number;
  }
  const fronts = new Map<string, StreetFront>();
  for (const street of city.streets) {
    const a = street.points[0];
    const b = street.points[street.points.length - 1];
    const len0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    fronts.set(street.id, {
      units: 0,
      shops: 0,
      unitsBySide: {},
      built: 0,
      intervals: [],
      length: len0,
      klass: street.klass,
      ax: a[0],
      az: a[1],
      ux: (b[0] - a[0]) / len0,
      uz: (b[1] - a[1]) / len0,
      width: street.widthM,
    });
  }
  for (const { b } of frontEdges) {
    const mx = b.facing === "e" ? b.x1 : b.facing === "w" ? b.x0 : (b.x0 + b.x1) / 2;
    const mz = b.facing === "n" ? b.z0 : b.facing === "s" ? b.z1 : (b.z0 + b.z1) / 2;
    const edgeLen = b.facing === "n" || b.facing === "s" ? b.x1 - b.x0 : b.z1 - b.z0;
    let best: { id: string; along: number; perp: number; dist: number } | null = null;
    for (const street of city.streets) {
      const [ax, az] = street.points[0];
      const [bx, bz] = street.points[street.points.length - 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 12) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      const along = (mx - ax) * ux + (mz - az) * uz;
      if (along < -1 || along > len + 1) continue;
      const perp = (mx - ax) * -uz + (mz - az) * ux;
      const dist = Math.abs(Math.abs(perp) - street.widthM / 2);
      if (Math.abs(perp) < street.widthM / 2 - 2) continue;
      if (!best || dist < best.dist) best = { id: street.id, along, perp, dist };
    }
    if (!best || best.dist > 8) continue;
    const front = fronts.get(best.id);
    if (!front) continue;
    front.units += 1;
    if (b.poi) front.shops += 1;
    const sideKey = String(best.perp > 0 ? 1 : -1);
    front.unitsBySide[sideKey] = (front.unitsBySide[sideKey] ?? 0) + 1;
    const t0 = Math.max(0, best.along - edgeLen / 2);
    const t1 = Math.min(front.length, best.along + edgeLen / 2);
    if (t1 > t0) {
      front.built += t1 - t0;
      front.intervals.push({ side: best.perp > 0 ? 1 : -1, t0, t1 });
    }
  }
  let frontageUnits = 0;
  let frontageBuiltM = 0;
  let maxDeadGapM = 0;
  let deadFrontageM = 0;
  let zonedFrontageM = 0;
  let streetOnlyLength = 0;
  let streetOnlyUnits = 0;
  let streetOnlyBuilt = 0;
  const parkRects = [
    ...city.buildings.filter((b) => b.walkable),
    ...city.anchors.map((a) => ({ x0: a.x - a.footprintM / 2, x1: a.x + a.footprintM / 2, z0: a.z - a.footprintM / 2, z1: a.z + a.footprintM / 2 })),
  ];
  let maxDeadStreet = "";
  for (const [streetId, front] of fronts) {
    // "Mặt tiền chết" chỉ có nghĩa ở nơi CÓ ĐẤT để xây. Bờ sông, kênh, mép khung không tính.
    const bin = 5;
    for (const side of [1, -1] as const) {
      const bins = Math.ceil(front.length / bin);
      const landed = new Array<boolean>(bins).fill(false);
      const built = new Array<boolean>(bins).fill(false);
      for (let b = 0; b < bins; b += 1) {
        const t = (b + 0.5) * bin;
        const px = front.ax + front.ux * t + -front.uz * side * (front.width / 2 + 7);
        const pz = front.az + front.uz * t + front.ux * side * (front.width / 2 + 7);
        const inPark = parkRects.some((pr) => px > pr.x0 - 1 && px < pr.x1 + 1 && pz > pr.z0 - 1 && pz < pr.z1 + 1);
        landed[b] =
          !inPark &&
          px > f.x0 + 1 && px < f.x1 - 1 && pz > f.z0 + 1 && pz < f.z1 - 1 &&
          !city.water.some((w) => px > w.x0 && px < w.x1 && pz > w.z0 && pz < w.z1);
      }
      for (const iv of front.intervals) {
        if (iv.side !== side) continue;
        for (let b = Math.floor(iv.t0 / bin); b <= Math.min(bins - 1, Math.floor((iv.t1 - 0.01) / bin)); b += 1) built[b] = true;
      }
      let run = 0;
      for (let b = 0; b < bins; b += 1) {
        if (landed[b]) zonedFrontageM += bin;
        if (landed[b] && !built[b]) {
          run += 1;
          deadFrontageM += bin;
          if (run * bin > maxDeadGapM) {
            maxDeadGapM = run * bin;
            maxDeadStreet = city.streets.find((st) => st.id === streetId)?.name ?? "?";
          }
        } else run = 0;
      }
    }
    frontageUnits += front.units;
    frontageBuiltM += front.built;
    if (front.klass === "street" || front.klass === "avenue") {
      streetOnlyLength += front.length;
      streetOnlyUnits += front.units;
      streetOnlyBuilt += front.built;
    }
  }
  // Trung vị theo tuyến: "đi 100 m trên con phố này thì qua bao nhiêu đơn vị". Trung bình toàn mạng
  // bị kéo xuống bởi đại lộ văn phòng (tháp 26 m mặt tiền) — đó không phải câu hỏi của A-list.
  const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const percentile = (values: number[], pct: number) => {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * pct) / 100))];
  };

  const perStreet: number[] = [];
  const perStreetFn: number[] = [];
  const perStreetByClass: Record<string, number[]> = {};
  const perStreetFnByClass: Record<string, number[]> = {};
  for (const street of city.streets) {
    if (street.klass === "alley") continue;
    const front = fronts.get(street.id);
    if (!front || front.length < 40) continue;
    const mid: [number, number] = [street.points[0][0], street.points[0][1]];
    const wardOf = city.districts.find((d) => d.tiles.some((t) => mid[0] >= t.x0 && mid[0] <= t.x1 && mid[1] >= t.z0 && mid[1] <= t.z1));
    // Nhịp mặt phố đo trên ĐOẠN CÓ TƯỜNG: hợp các khoảng có nhà (nới 6 mỗi phía) theo từng bên.
    // Giao lộ, công viên, bờ sông là khoảng trống dài — không phải "mặt tiền thưa", và nếu đem
    // chia cho cả chiều dài hình học thì mỗi ngã tư bị tính như một dãy nhà biến mất.
    const dilate = 6;
    const sideStats = ([1, -1] as const).map((side) => {
      const spans = front.intervals
        .filter((iv) => iv.side === side)
        .map((iv) => [iv.t0 - dilate, iv.t1 + dilate] as [number, number])
        .sort((p, q) => p[0] - q[0]);
      let wall = 0;
      let cur0 = NaN;
      let cur1 = NaN;
      for (const [a, b] of spans) {
        if (!Number.isFinite(cur0)) { cur0 = a; cur1 = b; continue; }
        if (a <= cur1) { cur1 = Math.max(cur1, b); continue; }
        wall += Math.min(cur1, front.length) - Math.max(cur0, 0);
        cur0 = a; cur1 = b;
      }
      if (Number.isFinite(cur0)) wall += Math.min(cur1, front.length) - Math.max(cur0, 0);
      return { wall: Math.max(0, wall), units: front.unitsBySide[String(side)] ?? 0 };
    }).filter((st) => st.wall > 30);
    if (!sideStats.length) continue;
    const wallM = sideStats.reduce((sum, st) => sum + st.wall, 0);
    const unitsOnWall = sideStats.reduce((sum, st) => sum + st.units, 0);
    const unitsPer100 = (unitsOnWall / wallM) * 100;
    const fnPer100 = ((front.shops * unitsOnWall) / Math.max(1, front.units) / wallM) * 100;
    perStreet.push(unitsPer100);
    perStreetFn.push(fnPer100);
    if (wardOf) {
      (perStreetByClass[wardOf.klass] ??= []).push(unitsPer100);
      (perStreetFnByClass[wardOf.klass] ??= []).push(fnPer100);
    }
  }
  const classMedians = Object.fromEntries(Object.entries(perStreetByClass).map(([k, v]) => [k, +median(v).toFixed(1)]));
  const classFnMedians = Object.fromEntries(Object.entries(perStreetFnByClass).map(([k, v]) => [k, +median(v).toFixed(1)]));
  const streetOnlyFrontageM = 2 * streetOnlyLength;
  const hemFrontageM = 2 * (streetLengthM - streetOnlyLength);
  const grossFloor = city.buildings.reduce((sum, b) => sum + rectArea(b) * Math.max(1, b.floors), 0);

  const districtMetrics = city.districts.map((d) => {
    let dwalk = 0;
    let droof = 0;
    for (const t of d.tiles) {
      const i0 = Math.max(0, iOf(t.x0));
      const i1 = Math.min(nx, iOf(t.x1));
      const j0 = Math.max(0, jOf(t.z0));
      const j1 = Math.min(nz, jOf(t.z1));
      for (let j = j0; j < j1; j += 1) {
        for (let i = i0; i < i1; i += 1) {
          const v = cells[idx(i, j)];
          if (v === 0) dwalk += 1;
          else if (v === 1) droof += 1;
        }
      }
    }
    const total = dwalk + droof;
    return {
      id: d.id,
      walkableM2: Math.round(dwalk * cellArea),
      roofPct: total ? +((100 * droof) / total).toFixed(1) : 0,
      pois: city.pois.filter((p) => p.district === d.id).length,
      buildings: city.buildings.filter((b) => b.district === d.id).length,
      streets: city.streets.filter((s) => {
        const a = s.points[0];
        const b = s.points[s.points.length - 1];
        return districtAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) === d.id;
      }).length,
    };
  });

  const floors = city.buildings.filter((b) => !b.walkable).map((b) => b.floors).sort((a, b) => a - b);
  return {
    frameAreaM2: Math.round(frameArea),
    landAreaM2: Math.round(landArea),
    walkableAreaM2: Math.round(walkable * cellArea),
    walkablePctOfLand: landArea ? +((100 * walkable * cellArea) / landArea).toFixed(1) : 0,
    components: sizes.filter((size) => size * cellArea >= 2).length,
    largestComponentPct: walkable ? +((100 * largest) / walkable).toFixed(2) : 0,
    reachableFromRoomPct: walkable ? +((100 * reachable) / walkable).toFixed(2) : 0,
    roofAreaM2: Math.round(roof * cellArea),
    roofCoveragePct: landArea ? +((100 * roof * cellArea) / landArea).toFixed(1) : 0,
    grossFloorAreaM2: Math.round(grossFloor),
    buildingCount: city.buildings.length,
    blocks: city.blocks.length,
    streets: city.streets.length,
    streetLengthM: Math.round(streetLengthM),
    hemLengthM: Math.round(hemLengthM),
    streetKmPerKm2: +(streetLengthM / 1000 / (frameArea / 1e6)).toFixed(1),
    // A-list đo trên mặt phố người chơi đi (phố + đại lộ), hẻm đo riêng: hẻm Sài Gòn không phải
    // mặt phố kinh doanh, trộn hai loại vào một con số là tự lừa mình.
    frontageUnitsPer100m: streetOnlyFrontageM ? +((streetOnlyUnits / streetOnlyFrontageM) * 100).toFixed(1) : 0,
    /** Trung vị theo tuyến — đây mới là con số A-list nói tới. */
    frontageMedianPer100m: +median(perStreet).toFixed(1),
    /** Tuyến tệ nhất 10%: chỗ mặt phố đứt gãy. */
    frontageP10Per100m: +percentile(perStreet, 10).toFixed(1),
    functionsMedianPer100m: +median(perStreetFn).toFixed(1),
    /** Trung vị theo loại phường — luật 12/6 áp cho phố nhà ống và chợ, không áp cho đại lộ tháp. */
    frontageByClass: classMedians,
    functionsByClass: classFnMedians,
    functionsPer100m: streetOnlyFrontageM ? +((functionsCount / streetOnlyFrontageM) * 100).toFixed(1) : 0,
    frontageBuiltPct: streetOnlyFrontageM ? +((100 * Math.min(streetOnlyBuilt, streetOnlyFrontageM)) / streetOnlyFrontageM).toFixed(1) : 0,
    hemUnitsPer100m: hemFrontageM ? +((((frontageUnits - streetOnlyUnits) || 0) / hemFrontageM) * 100).toFixed(1) : 0,
    maxDeadFrontageM: Math.round(maxDeadGapM),
    maxDeadStreet,
    deadFrontagePct: zonedFrontageM ? +((100 * deadFrontageM) / zonedFrontageM).toFixed(1) : 0,
    pois: city.pois.length,
    venuePois: city.pois.filter((p) => p.tier === "venue").length,
    shopPois: functionsCount,
    poisPerKm2: walkable ? Math.round(city.pois.length / ((walkable * cellArea) / 1e6)) : 0,
    parkAreaM2: Math.round(city.buildings.filter((b) => b.walkable).reduce((sum, b) => sum + rectArea(b), 0)),
    medianFloors: floors.length ? floors[Math.floor(floors.length / 2)] : 0,
    maxHeightM: +Math.max(0, ...city.buildings.map((b) => b.heightM)).toFixed(1),
    districtMetrics,
    relocatedPois: 0,
    rejectedOverlap: 0,
    connectionRepairs: 0,
    rejectedStreetPhase: 0,
    streetPhase: {},
    phaseById: {},
    hemSkipped: 0,
    anchorsPlaced: 0,
    anchorsMissing: [],
    rejectedRoad: 0,
    rejectedRoadSamples: [],
  };
}

// --- truy vấn lúc chơi ---------------------------------------------------------------------------
interface RectIndex {
  cell: number;
  map: Map<string, CityRect[]>;
  some(x: number, z: number): boolean;
}

function buildRectIndex(rects: CityRect[], cell = 16): RectIndex {
  const map = new Map<string, CityRect[]>();
  const key = (i: number, j: number) => `${i}:${j}`;
  for (const r of rects) {
    const i0 = Math.floor(r.x0 / cell);
    const i1 = Math.floor(r.x1 / cell);
    const j0 = Math.floor(r.z0 / cell);
    const j1 = Math.floor(r.z1 / cell);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const k = key(i, j);
        const list = map.get(k);
        if (list) list.push(r);
        else map.set(k, [r]);
      }
    }
  }
  return {
    cell,
    map,
    some(x, z) {
      const list = map.get(key(Math.floor(x / cell), Math.floor(z / cell)));
      if (!list) return false;
      return list.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    },
  };
}

const indexCache = new WeakMap<City, { solid: RectIndex; water: RectIndex; deck: RectIndex }>();

/** Điểm có đi được không: trong khung, không phải nước, không nằm trong toà nhà (trừ công viên/sân). */
export function isWalkable(city: City, x: number, z: number): boolean {
  const f = city.frame;
  if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) return false;
  let cache = indexCache.get(city);
  if (!cache) {
    cache = {
      solid: buildRectIndex(city.buildings.filter((b) => !b.walkable)),
      water: buildRectIndex(city.water),
      deck: buildRectIndex(city.decks ?? []),
    };
    indexCache.set(city, cache);
  }
  if (cache.deck.some(x, z)) return true;
  if (cache.water.some(x, z)) return false;
  return !cache.solid.some(x, z);
}

/** Lấy ô lưới tại toạ độ — dùng cho va chạm ở runtime và cho kiểm toán. */
export function cellAt(city: City, x: number, z: number): 0 | 1 | 2 | -1 {
  const { step, nx, nz, cells } = city.walk;
  const i = Math.floor((x - city.frame.x0) / step);
  const j = Math.floor((z - city.frame.z0) / step);
  if (i < 0 || j < 0 || i >= nx || j >= nz) return -1;
  return cells[j * nx + i] as 0 | 1 | 2;
}
