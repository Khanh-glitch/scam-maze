// BẢN ĐỒ GỐC CỦA GAME — dữ liệu thuần, không import three.js.
//
// Khu phố trong `neighborhood.ts` là bản đồ đang chơi được: 140 m phố, hai dãy nhà ống, một hẻm cụt,
// một sân chung. Trước đây toàn bộ bố cục đó nằm lẫn trong hàm dựng hình, nên không chỗ nào khác
// (thành phố lớn ở `/saigon`) đọc được. Tách ra đây thành *dữ liệu*: cùng một nguồn cho
//  (a) `neighborhood.ts` — dựng khu phố chơi được,
//  (b) `citymap/coreStreet.ts` — đặt đúng khu phố đó vào giữa thành phố sinh tự động.
// Sửa một căn nhà ở đây thì cả hai nơi đổi theo. Đây là "kế thừa bản đồ", không phải vẽ lại.

export type LotStyle = "modern" | "french" | "cap4";
export type LotGround = "living" | "garage" | "grocery" | "cafe" | "pho" | "repair" | "hair";

/** Tham số một lô, đúng bằng tham số `spec()` của khu phố. */
export interface LotPlan {
  W: number;
  D: number;
  floors: number;
  style?: LotStyle;
  ground?: LotGround;
  sign?: string[];
  signBg?: string;
  signFg?: string;
  shutterColor?: string;
  yard?: number;
  well?: boolean;
  solar?: boolean;
  flag?: boolean;
  cage?: number[];
  gb?: boolean;
  lite?: boolean;
}

/** Hình học mặt bằng của khu phố (mét, tính từ tim đường). */
export const STREET = {
  /** Phố chạy dọc trục x, từ x0 tới x1. */
  x0: -70,
  x1: 70,
  /** Mép nhựa đường (tim đường = 0). */
  roadHalf: 3.6,
  /** Mép ngoài vỉa hè. */
  walkOuter: 6.0,
  /** Mép trước nhà hai bên (m). */
  frontZ: 6.0,
  /** Hẻm cụt phía bắc, chạy dọc z. */
  alley: { x0: 8.5, x1: 11.5, z0: 3.6, z1: 52 },
  /** Sân chung trong khối. */
  court: { x0: -4.6, x1: 23.6, z0: 40.5, z1: 53 },
  /** Vạch tim đường: gạch dài 2,4 m, cách nhau 4,5 m. */
  laneDash: { step: 4.5, len: 2.4 },
} as const;

/** Bảng màu nhà phố: [tường, viền, nhấn] — nguyên bảng của khu phố. */
export const MOD: ReadonlyArray<readonly [string, string, string]> = [
  ["#e7d8b5", "#f4f1ea", "#6b8a8f"],
  ["#c9dfd2", "#f2f0e8", "#b5533c"],
  ["#f0cdb8", "#f6f2ea", "#2f5d62"],
  ["#cfd8e8", "#f1efe9", "#c9a24b"],
  ["#e9e2d0", "#f5f2ea", "#6b4a3a"],
  ["#d9c4a8", "#f3efe6", "#4a6a7a"],
  ["#bfd8d2", "#f2f1ea", "#a8503c"],
  ["#e6bfae", "#f6f1e8", "#44625a"],
];

/** Màu của một căn theo seed — cùng công thức `spec()` đang dùng. */
export const appearance = (seed: number, style: LotStyle = "modern") => {
  const pal = MOD[seed % MOD.length];
  const french = style === "french";
  return {
    color: french ? "#e3c25a" : style === "cap4" ? "#d8cdb0" : pal[0],
    trim: french ? "#f6f2e6" : pal[1],
    accent: french ? "#5a7a55" : pal[2],
  };
};

/** Một lô đã đặt: hình chữ nhật mặt bằng + hướng nhìn. */
export interface PlacedLot extends LotPlan {
  /** Thứ tự trong khu phố (cũng là seed màu). */
  seq: number;
  side: "S" | "N" | "alleyW" | "alleyE";
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Góc quay của căn nhà trong engine (radian). */
  rot: number;
}

const FILL_W = [4.2, 3.8, 4.6, 4.0, 4.4, 3.9, 4.5, 4.2, 4.0, 4.3, 3.7, 4.4];
const FILL_GROUND: LotGround[] = ["living", "grocery", "garage", "cafe", "repair"];

/** Năm căn "anh hùng" đầu phố phía nam (từ x=8,5 chạy về phía tây). */
const SOUTH_HERO: LotPlan[] = [
  { W: 4.4, floors: 3, D: 15, ground: "living", well: true, cage: [2], flag: true, gb: true, solar: false, sign: ["Nhà 4B"] },
  { W: 4.0, floors: 2, style: "french", ground: "grocery", D: 14, sign: ["TẠP HÓA BÀ NĂM", "Bia · Nước ngọt · Gạo · Mì tôm"], signBg: "#1f6b3a", signFg: "#fff6c0", shutterColor: "#b9b29d" },
  { W: 5.2, floors: 1, style: "cap4", ground: "living", D: 13, gb: true },
  { W: 3.8, floors: 3, ground: "cafe", D: 15, well: true, solar: true, cage: [1, 2], sign: ["CÀ PHÊ CÓC", "Cà phê phin · Trà đá · Sinh tố"], signBg: "#4a2c1c", signFg: "#ffd37a", shutterColor: "#7f8c8d" },
  { W: 4.6, floors: 2, ground: "pho", D: 14, sign: ["PHỞ BÒ GIA TRUYỀN", "Phở tái · Phở chín · Quẩy"], signBg: "#b3191a", signFg: "#ffe8a0", shutterColor: "#a9a28f", flag: true },
];

/** Ba căn giữa phố phía nam (từ x=11,5 chạy về phía đông). */
const SOUTH_MID: LotPlan[] = [
  { W: 4.2, floors: 4, ground: "living", D: 15, well: true, flag: true, cage: [3] },
  { W: 3.9, floors: 2, style: "french", ground: "repair", D: 14, sign: ["SỬA XE MÁY ANH BA", "Vá · Thay nhớt · Rửa xe"], signBg: "#1d3f7a", signFg: "#ffffff", shutterColor: "#7f8c8d" },
  { W: 4.8, floors: 3, ground: "garage", D: 15, well: true, solar: true },
];

/** Sáu căn phía bắc, từ x=34 chạy về phía tây. */
const NORTH_HERO: LotPlan[] = [
  { W: 4.2, floors: 3, ground: "hair", D: 14, sign: ["CẮT TÓC NAM", "Gội đầu · Cạo mặt · Uốn tóc"], signBg: "#0f3d6b", signFg: "#ffffff", shutterColor: "#b7b2a5", cage: [2] },
  { W: 4.0, floors: 2, style: "french", ground: "living", D: 14 },
  { W: 5.2, floors: 1, style: "cap4", ground: "living", D: 13, yard: 2.4 },
  { W: 4.4, floors: 3, ground: "garage", D: 15, well: true, flag: true },
  { W: 4.0, floors: 3, ground: "grocery", D: 14, sign: ["TẠP HÓA 24/7", "Đại lý vé số · Thẻ cào"], signBg: "#e5b012", signFg: "#7a1010", shutterColor: "#8f9aa3", cage: [1, 2] },
  { W: 4.6, floors: 2, ground: "living", D: 14, solar: true },
];

const ALLEY_W: LotPlan[] = [
  { W: 3.8, floors: 2, ground: "living", D: 13 },
  { W: 4.2, floors: 3, ground: "grocery", D: 13, sign: ["TẠP HÓA HẺM", "Gần nhà ai cũng quen"], signBg: "#2a6d4a", signFg: "#fff3c0", shutterColor: "#a8a28f" },
  { W: 4.4, floors: 1, style: "cap4", ground: "living", D: 13, yard: 2.0 },
  { W: 4.0, floors: 3, ground: "living", D: 13, cage: [2] },
];

const ALLEY_E: LotPlan[] = [
  { W: 4.0, floors: 3, ground: "living", D: 13, flag: true },
  { W: 3.8, floors: 2, style: "french", ground: "living", D: 13 },
  { W: 4.4, floors: 2, ground: "cafe", D: 13, sign: ["QUÁN TRÀ ĐÁ", "Trà đá · Nước mía · Hạt dưa"], signBg: "#2d5f2d", signFg: "#fff3a0", shutterColor: "#8f9aa3" },
  { W: 4.0, floors: 3, ground: "living", D: 13, solar: true },
];

const defaultDepth = (l: LotPlan) => l.D ?? 14;

/**
 * Bố cục đầy đủ của khu phố, đã đặt vị trí. Thứ tự lô ở đây **phải** trùng thứ tự gọi `spec()`
 * trước đây, vì màu và số nhà suy ra từ bộ đếm — đổi thứ tự là đổi cả khu phố.
 */
export const coreLots = (): PlacedLot[] => {
  const out: PlacedLot[] = [];
  let seq = 0;
  const emit = (l: LotPlan, side: PlacedLot["side"], x0: number, z: number) => {
    const W = l.W;
    const D = defaultDepth(l);
    const south = side === "S";
    const placed: PlacedLot = {
      ...l,
      seq: seq++,
      side,
      x0,
      x1: x0 + W,
      z0: south ? z : z - D,
      z1: south ? z + D : z,
      rot: 0,
    };
    out.push(placed);
    return placed;
  };
  /** Rải một dãy dọc phố, giống `frontRow` cũ. */
  const row = (list: LotPlan[], startX: number, dir: 1 | -1, side: "S" | "N") => {
    let cur = startX;
    for (const l of list) {
      const north = side === "N";
      const x0 = north ? (dir < 0 ? cur - l.W : cur) : dir < 0 ? cur - l.W : cur;
      const p = emit(l, side, x0, north ? -STREET.frontZ - (l.yard ?? 0) : STREET.frontZ + (l.yard ?? 0));
      p.rot = north ? Math.PI : 0;
      cur += dir * l.W;
    }
    return cur;
  };
  /** Lấp dãy bằng nhà "lite" — đúng công thức `lightFill` cũ. */
  const fill = (n: number, from: number, dir: 1 | -1, side: "S" | "N") => {
    const list: LotPlan[] = [];
    for (let i = 0; i < n; i += 1) {
      const at = seq + i; // = `hid` tại thời điểm dựng căn này
      list.push({
        W: FILL_W[(i * 5 + (side === "N" ? 3 : 0)) % FILL_W.length],
        floors: 2 + ((i + (side === "N" ? 1 : 0)) % 3),
        style: i % 4 === 1 ? "french" : "modern",
        lite: true,
        D: 14,
        ground: FILL_GROUND[(i + at) % 5],
        sign: i % 3 === 0 ? ["TẠP HÓA", "Mở cửa cả ngày"] : undefined,
        cage: i % 2 ? [1] : undefined,
        flag: i % 4 === 2,
      });
    }
    return row(list, from, dir, side);
  };

  const ex = row(SOUTH_HERO, 8.5, -1, "S");
  fill(6, ex, -1, "S");
  row(SOUTH_MID, 11.5, 1, "S");
  fill(5, 11.5 + 4.2 + 3.9 + 4.8, 1, "S");
  const nx = row(NORTH_HERO, 34, -1, "N");
  fill(6, nx, -1, "N");
  fill(5, 34, 1, "N");

  let cz = 24;
  for (const l of ALLEY_W) {
    const p = emit(l, "alleyW", STREET.alley.x0 - (l.yard ?? 0) - l.W, cz);
    p.rot = -Math.PI / 2;
    p.z0 = cz;
    p.z1 = cz + l.W;
    cz += l.W;
  }
  cz = 24;
  for (const l of ALLEY_E) {
    cz += l.W;
    const p = emit(l, "alleyE", STREET.alley.x1 + (l.yard ?? 0), cz);
    p.rot = Math.PI / 2;
    p.z0 = cz;
    p.z1 = cz + l.W;
  }
  return out;
};

/** Kích thước khu phố khi đặt vào thành phố: hình chữ nhật bao mọi lô + hè. */
export const coreFootprint = () => {
  const lots = coreLots();
  let x0: number = STREET.x0;
  let x1: number = STREET.x1;
  let z0: number = -STREET.walkOuter;
  let z1: number = STREET.walkOuter;
  for (const l of lots) {
    x0 = Math.min(x0, l.x0);
    x1 = Math.max(x1, l.x1);
    z0 = Math.min(z0, l.z0);
    z1 = Math.max(z1, l.z1);
  }
  return { x0, x1, z0, z1 };
};
