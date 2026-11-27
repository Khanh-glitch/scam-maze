// Dựng hình khối 3D cho bản đồ Sài Gòn sinh tự động — dùng CHUNG cho trang xem trong game
// (`CityPage`) và cho công cụ kiểm toán offline.
//
// Vì sao tách khỏi `cityGen`: thành phố là dữ liệu (hình chữ nhật + số tầng + loại), còn "trông
// như thế nào" là hình học. Tách ra thì (a) trang web và ảnh kiểm toán dựng từ cùng một nguồn,
// không lệch nhau, (b) hình học kiểm được bằng unit test mà không cần trình duyệt.
//
// Nguyên tắc hình khối: một toà nhà KHÔNG phải một cái hộp. Tháp = bệ + thân thụt hai cấp (mặt
// bằng vát góc) + hộp kỹ thuật. Nhà ống = thân + mái ngói dốc + tum. Chợ = nhà lớn + mái dốc.
// Độ thụt co theo bề rộng lô, để tháp 9 m không thành cây kim.
import type { City, CityBuilding } from "./cityGen";

/** Một khối đặc: hộp (hoặc lăng trụ vát góc / lăng trụ tam giác tuỳ danh sách chứa nó). */
export interface Part {
  /** Tâm đáy theo x/z, cao độ đáy theo y. */
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  /** Góc quay quanh trục đứng (radian). */
  ry?: number;
  color: string;
}

export interface CityMesh {
  /** Hộp: nhà, bệ, đỉnh kỹ thuật, đường, vỉa hè, nước, biển hiệu. */
  boxes: Part[];
  /** Lăng trụ tám cạnh (bán kính 1, cao 1, đáy ở y=0): thân tháp vát góc. */
  prisms: Part[];
  /** Lăng trụ tam giác, sống nóc dọc trục x (rộng 1, sâu 1, cao 1): mái ngói. */
  gables: Part[];
  /** Thân cây (trụ), tán cây (nón). */
  trunks: Part[];
  canopies: Part[];
  /** Chi tiết dán lên mặt tiền: cửa cuốn, biển hiệu, mái hiên, ban công. Không vân, màu phẳng. */
  details: Part[];
  /** Bồn nước inox trên mái — hình trụ. */
  drums: Part[];
  anchors: Array<{ id: string; name: string; x: number; y: number; z: number }>;
  stats: {
    buildings: number;
    towers: number;
    gabledRoofs: number;
    parts: number;
    roads: number;
    props: number;
    minY: number;
    maxY: number;
  };
}

const WALL: Record<string, string[]> = {
  residential: ["#c8a878", "#d8c39a", "#b98d63", "#cbb492", "#9fb7a4", "#b7a9bd", "#d9b7a0"],
  market: ["#c98f5a", "#b7743f", "#d3a06b", "#a8724a", "#cfae7d"],
  tourist: ["#9aa8b4", "#b9b2a0", "#8d9aa6", "#c6b79e", "#a5b0a8"],
  corporate: ["#8b8f96", "#6f7a86", "#a19c92", "#7b828c", "#8d9aa0"],
  construction: ["#8f8a80", "#a49c8e", "#7c766c"],
  park: ["#9aa88f", "#b3b49a"],
};
const TILE = ["#9c6b4f", "#8a5b45", "#7a6a5c", "#6f7a6a", "#a5794f", "#7d5b4a", "#8d7a63"];
const SHEET = ["#8d8b84", "#9aa0a2", "#7f8a86", "#94897c"];

/** Trộn hai màu hex (dùng cho tấm biển sáng hơn màu quán). */
const mixHex = (a: string, b: string, t: number): string => {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};
const CROWN = "#5f636c";

const SHOP_COLOR: Record<string, string> = {
  cafe: "#d9a05b", food: "#c8603f", shop: "#3f6f7a", net: "#4b6f9c", gaming: "#7a4b9c",
  money: "#d4b23f", gold: "#e0c04a", bank: "#2f5a7a", pawn: "#8a3f4a", hotel: "#5f7fa8",
  repair: "#6a6a6a", laundry: "#5f8fa0", phone: "#3f7a6a", herb: "#6a8a4a", kho: "#7a6a52",
  boarding: "#7a5f52", room: "#8a6a52", market: "#b7743f", office: "#4a5a6a",
};
const AWNING = ["#b8452f", "#2f6b7a", "#c2762f", "#3f7a55", "#a8443f"];

const hash01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const inset = (r: CityBuilding, k: number) => {
  const ix = Math.min((r.x1 - r.x0) * k, (r.x1 - r.x0) / 2 - 1.5);
  const iz = Math.min((r.z1 - r.z0) * k, (r.z1 - r.z0) / 2 - 1.5);
  return { x0: r.x0 + Math.max(0, ix), x1: r.x1 - Math.max(0, ix), z0: r.z0 + Math.max(0, iz), z1: r.z1 - Math.max(0, iz) };
};

/**
 * Dựng toàn bộ hình học của thành phố.
 * `maxParts` chặn trần để trang web không bao giờ dựng quá nặng (mặc định đủ cho ~4.400 toà).
 */
export const buildCityMesh = (city: City, opts: { maxParts?: number } = {}): CityMesh => {
  const maxParts = opts.maxParts ?? 120_000;
  const boxes: Part[] = [];
  const prisms: Part[] = [];
  const gables: Part[] = [];
  const trunks: Part[] = [];
  const canopies: Part[] = [];
  const details: Part[] = [];
  const drums: Part[] = [];
  const byDistrict = new Map(city.districts.map((d) => [d.id, d]));
  let towers = 0;
  let gabledRoofs = 0;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let parts = 0;

  const push = (list: Part[], p: Part) => {
    if (parts >= maxParts) return;
    parts += 1;
    list.push(p);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + p.sy);
  };
  const box = (p: Part) => push(boxes, p);

  // --- nền: đường, vỉa hè, nước ---------------------------------------------------------------
  let roads = 0;
  for (const s of city.streets) {
    const w = s.widthM;
    const walk = s.klass === "alley" ? 0.45 : s.klass === "avenue" ? 2.8 : 1.6;
    for (let i = 0; i < s.points.length - 1; i += 1) {
      const [ax, az] = s.points[i];
      const [bx, bz] = s.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1) continue;
      // Ba.js (và mọi phép quay quanh trục Y) biến trục cục bộ +x thành (cos ry, −sin ry). Để
      // trục dài của tấm đường trùng hướng tuyến thì ry phải là −θ. Trước đây dùng +θ nên mọi
      // đoạn đường chéo bị xoay lệch — nhìn ảnh là thấy, đếm mặt thì không.
      const theta = Math.atan2(bz - az, bx - ax);
      const ry = -theta;
      const cx = (ax + bx) / 2;
      const cz = (az + bz) / 2;
      // vỉa hè (sáng, thấp) rồi lòng đường (tối) chồng lên
      // Vỉa hè cao 0,17 m, lòng đường 0,08 m ⇒ có bó vỉa. Trước đây đường cao hơn hè 1 cm nên
      // mép đường biến mất, cả mặt phố thành một tấm xám.
      // Vỉa hè là HAI DẢI hai bên, không phải một tấm phủ cả mặt đường: tấm phủ rộng hơn và cao
      // hơn lòng đường nên nó che mất đường, cả phố ra một dải xám.
      const off = w / 2 + walk / 2;
      for (const sgn of [-1, 1]) {
        // dịch theo trục ngang của tấm đường: cục bộ +z → (sin ry, cos ry)
        box({
          x: cx + Math.sin(ry) * off * sgn,
          y: 0.05,
          z: cz + Math.cos(ry) * off * sgn,
          sx: len + 0.4, sy: 0.12, sz: walk, ry, color: "#9a97a1",
        });
      }
      box({ x: cx, y: 0.02, z: cz, sx: len + 0.4, sy: 0.06, sz: w, ry, color: s.klass === "alley" ? "#3a3842" : "#2e2d37" });
      // vạch tim đường cho đại lộ / phố: gạch 2 m cách nhau 6 m
      if (s.klass === "avenue" || s.klass === "street") {
        const dash = Math.max(1, Math.floor(len / 7));
        for (let k = 0; k < dash; k += 1) {
          const t = (k + 0.5) / dash;
          box({ x: ax + (bx - ax) * t, y: 0.085, z: az + (bz - az) * t, sx: 2.2, sy: 0.02, sz: 0.18, ry, color: "#c9c08a" });
        }
      }
      roads += 1;
    }
  }
  for (const wt of city.water) {
    box({ x: (wt.x0 + wt.x1) / 2, y: -0.1, z: (wt.z0 + wt.z1) / 2, sx: wt.x1 - wt.x0, sy: 0.16, sz: wt.z1 - wt.z0, color: "#12414d" });
  }
  // cầu: mặt bê tông đi được bên trên nước
  for (const d of city.decks) {
    box({ x: (d.x0 + d.x1) / 2, y: 0.1, z: (d.z0 + d.z1) / 2, sx: d.x1 - d.x0, sy: 0.2, sz: d.z1 - d.z0, color: "#6c6a63" });
  }

  // --- toà nhà --------------------------------------------------------------------------------
  for (const b of city.buildings) {
    if (b.walkable) continue; // mặt công viên / sân: đã có ở lớp nền
    const klass = byDistrict.get(b.district)?.klass ?? "residential";
    const palette = WALL[klass] ?? WALL.residential;
    const pickIdx = Math.floor(hash01(b.x0 * 3.1 + b.z0 * 7.7) * palette.length) % palette.length;
    const base = b.anchor ? "#9aa3ad" : palette[pickIdx];
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const h = b.heightM;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const tileC = TILE[Math.floor(hash01(b.x1 + b.z1) * TILE.length) % TILE.length];

    // --- chi tiết mặt tiền ---------------------------------------------------------------------
    // Một dãy phố không có cửa cuốn, mái hiên, biển hiệu thì đọc ra "các khối hộp sơn màu".
    // Tháp cũng cần: bệ tháp ngoài đời là dãy cửa hàng.
    const streetFront = (facadeH: number) => {
      if (b.anchor || klass === "park" || b.on === "court") return;
      const side = b.facing;
      const alongX = side === "n" || side === "s";
      const faceLen = Math.max(2, (alongX ? w : d) - 0.5);
      const wallPlane = side === "n" ? b.z0 : side === "s" ? b.z1 : side === "w" ? b.x0 : b.x1;
      const outDir = side === "n" || side === "w" ? -1 : 1;
      const shopC = SHOP_COLOR[b.kind] ?? "#6a6472";
      const decal = (y: number, hh: number, deep: number, out: number, szAlong: number, color: string) => {
        const off = wallPlane + outDir * (out + deep / 2);
        push(details, alongX
          ? { x: cx, y, z: off, sx: szAlong, sy: hh, sz: deep, color }
          : { x: off, y, z: cz, sx: deep, sy: hh, sz: szAlong, color });
      };
      if (facadeH > 3.2) {
        decal(0.16, Math.min(2.75, facadeH * 0.6), 0.12, 0.02, faceLen, shopC);
        decal(Math.min(2.9, facadeH * 0.6), Math.min(0.85, facadeH * 0.2), 0.14, 0.02, faceLen, mixHex(shopC, "#ffffff", 0.18));
      }
      // Mái hiên bạt: TỪNG TẤM 3–4 m có khe, không phải một tấm dài bằng cả dãy nhà.
      if ((klass === "residential" || klass === "market") && facadeH > 4.6 && facadeH < 26) {
        const aw = AWNING[Math.floor(hash01(b.x0 + b.z1) * AWNING.length) % AWNING.length];
        const pieces = Math.max(1, Math.round(faceLen / 4.2));
        for (let k = 0; k < pieces; k += 1) {
          const segLen = (faceLen / pieces) * 0.82;
          const centreT = (k + 0.5) / pieces;
          const off = wallPlane + outDir * 0.34;
          push(details, alongX
            ? { x: b.x0 + 0.25 + faceLen * centreT, y: 3.55, z: off, sx: segLen, sy: 0.1, sz: 0.72, color: aw }
            : { x: off, y: 3.55, z: b.z0 + 0.25 + faceLen * centreT, sx: 0.72, sy: 0.1, sz: segLen, color: aw });
        }
      }
      // biển hiệu nhô vuông góc
      if (facadeH > 5 && hash01(b.z0 + b.x1) > 0.55) {
        const off = wallPlane + outDir * 0.42;
        push(details, alongX
          ? { x: b.x0 + w * 0.35, y: 3.6, z: off, sx: 0.16, sy: 1.25, sz: 0.85, color: shopC }
          : { x: off, y: 3.6, z: b.z0 + d * 0.35, sx: 0.85, sy: 1.25, sz: 0.16, color: shopC });
      }
      // ban công nhà ở (2–4 tầng)
      if ((klass === "residential" || klass === "market") && b.floors >= 2 && b.floors <= 4 && faceLen > 3.4) {
        for (let f = 1; f < b.floors; f += 1) {
          decal(f * 3.2 + 0.1, 0.14, 0.45, 0.0, faceLen * 0.9, mixHex(base, "#ffffff", 0.16));
        }
      }
    };



    if (b.anchor === "landmark81") {
      // Đế rộng + thân liền vát góc + đỉnh giật hai bậc. Đế 84 m (không phải 44) để tỉ lệ thật.
      const podH = Math.min(26, h * 0.06);
      box({ x: cx, y: 0, z: cz, sx: w, sy: podH, sz: d, color: base });
      const s1 = inset(b, 0.015);
      push(prisms, { x: (s1.x0 + s1.x1) / 2, y: podH, z: (s1.z0 + s1.z1) / 2, sx: (s1.x1 - s1.x0) / 2, sy: h * 0.9 - podH, sz: (s1.z1 - s1.z0) / 2, color: "#a8b6c4" });
      const s2 = inset(b, 0.055);
      push(prisms, { x: (s2.x0 + s2.x1) / 2, y: h * 0.9, z: (s2.z0 + s2.z1) / 2, sx: (s2.x1 - s2.x0) / 2, sy: h * 0.965 - h * 0.9, sz: (s2.z1 - s2.z0) / 2, color: "#b3c0cc" });
      const s3 = inset(b, 0.14);
      box({ x: (s3.x0 + s3.x1) / 2, y: h * 0.965, z: (s3.z0 + s3.z1) / 2, sx: s3.x1 - s3.x0, sy: h * 0.035, sz: s3.z1 - s3.z0, color: CROWN });
      towers += 1;
      continue;
    }

    const isTower = (b.floors >= 9 || b.anchor === "bitexco") && w > 7.5 && d > 7.5;
    if (isTower) {
      const minSide = Math.min(w, d);
      const wide = minSide >= 14;
      const podH = Math.min(18, Math.max(9, h * 0.16));
      box({ x: cx, y: 0, z: cz, sx: w, sy: podH, sz: d, color: base });
      streetFront(podH);
      const shaftTop = podH + (h - podH) * (wide ? 0.62 : 0.8);
      const s1 = inset(b, wide ? 0.05 : 0.025);
      push(prisms, {
        x: (s1.x0 + s1.x1) / 2, y: podH, z: (s1.z0 + s1.z1) / 2,
        sx: (s1.x1 - s1.x0) / 2, sy: shaftTop - podH, sz: (s1.z1 - s1.z0) / 2,
        color: b.anchor === "bitexco" ? "#9fb0c0" : base,
      });
      if (wide) {
        const t2 = podH + (h - podH) * 0.87;
        const s2i = inset(b, 0.11);
        push(prisms, {
          x: (s2i.x0 + s2i.x1) / 2, y: shaftTop, z: (s2i.z0 + s2i.z1) / 2,
          sx: (s2i.x1 - s2i.x0) / 2, sy: t2 - shaftTop, sz: (s2i.z1 - s2i.z0) / 2, color: base,
        });
        const s3i = inset(b, 0.165);
        box({ x: (s3i.x0 + s3i.x1) / 2, y: t2, z: (s3i.z0 + s3i.z1) / 2, sx: s3i.x1 - s3i.x0, sy: h - t2, sz: s3i.z1 - s3i.z0, color: CROWN });
      } else {
        const s2i = inset(b, 0.1);
        box({ x: (s2i.x0 + s2i.x1) / 2, y: shaftTop, z: (s2i.z0 + s2i.z1) / 2, sx: s2i.x1 - s2i.x0, sy: h - shaftTop, sz: s2i.z1 - s2i.z0, color: CROWN });
      }
      // Sân bay trực thăng của Bitexco: tấm sàn nhô ra khỏi thân ở 85 % độ cao.
      if (b.anchor === "bitexco") {
        box({ x: b.x1 + 2.2, y: h * 0.855, z: cz, sx: 9, sy: 0.9, sz: 9, color: "#3d4048" });
      }
      towers += 1;
      continue;
    }

    // Nhà ống / chợ / ga: thân một khối, mái ngói dốc hay mái bằng.
    box({ x: cx, y: 0, z: cz, sx: w, sy: h, sz: d, color: base });
    streetFront(h);

    const roofPick = hash01(b.x0 * 5.3 + b.z1 * 3.7);
    const wantGable = b.kind === "market"
      || ((klass === "residential" || klass === "market") && b.floors <= 3 && w > 3 && d > 3 && w < 26 && roofPick < 0.55);
    const sheetRoof = !wantGable && (klass === "residential" || klass === "market") && b.floors <= 3 && roofPick > 0.85;
    if (wantGable) {
      const rise = b.kind === "market" ? Math.min(5.5, Math.min(w, d) * 0.14) : Math.min(2.4, Math.min(w, d) * 0.2);
      const alongX = w >= d;
      push(gables, {
        x: cx, y: h, z: cz,
        sx: alongX ? w : d, sy: rise, sz: alongX ? d : w,
        ry: alongX ? 0 : Math.PI / 2,
        color: b.kind === "market" ? mixHex(tileC, "#ffffff", 0.16) : tileC,
      });
      // Chợ thật không phải một cái lều: mái có **dãy cửa trời** chạy dọc sống mái, và tường hồi
      // lộ ra dưới mái. Thiếu chi tiết này, chợ đọc ra "kim tự tháp bìa cứng".
      if (b.kind === "market") {
        const rl = (alongX ? w : d) * 0.78;
        const rc = mixHex("#d9d3c4", tileC, 0.25);
        push(details, alongX
          ? { x: cx, y: h + rise * 0.72, z: cz, sx: rl, sy: 1.5, sz: 3.0, color: rc }
          : { x: cx, y: h + rise * 0.72, z: cz, sx: 3.0, sy: 1.5, sz: rl, color: rc });
        for (let k = 1; k <= 3; k += 1) {
          const t = k / 4;
          push(details, alongX
            ? { x: b.x0 + w * t, y: h + 0.4, z: cz, sx: 0.5, sy: 0.8, sz: d * 0.98, color: mixHex(rc, "#000000", 0.25) }
            : { x: cx, y: h + 0.4, z: b.z0 + d * t, sx: w * 0.98, sy: 0.8, sz: 0.5, color: mixHex(rc, "#000000", 0.25) });
        }
      }
      gabledRoofs += 1;
    } else if (sheetRoof) {
      // mái tôn: một tấm dốc nhẹ, màu xám bạc
      push(gables, {
        x: cx, y: h, z: cz,
        sx: w, sy: Math.min(1.4, Math.min(w, d) * 0.12), sz: d,
        color: SHEET[Math.floor(hash01(b.x1 * 2.9 + b.z0) * SHEET.length) % SHEET.length],
      });
      gabledRoofs += 1;
    } else {
      // Mái bằng: MẶT MÁI luôn có, tối hơn tường — thiếu nó thì nhà 1–2 tầng có nóc màu vôi, và cả
      // khu phố đọc ra "các hộp bìa cứng". Gờ parapet chỉ thêm khi nhà đủ cao.
      const t = 0.32;
      // Mái bê tông/tôn sáng màu: mái tối om đọc ra "toà nhà không có mái, chỉ có lòng chảo".
      // Mỗi lô một sắc độ: cả quận mà cùng một màu mái thì nhìn từ trên xuống thành "tấm thảm".
      const jit = hash01(b.x0 * 1.7 + b.z1 * 9.1);
      const plateC = mixHex(mixHex("#a39684", tileC, 0.4), jit > 0.5 ? "#6f685e" : "#f2ece1", 0.1 + jit * 0.24);
      box({ x: cx, y: h, z: cz, sx: Math.max(0.5, w - t), sy: 0.12, sz: Math.max(0.5, d - t), color: plateC });
      if (h > 4.5) {
        const c = mixHex(base, "#ffffff", 0.06);
        box({ x: cx, y: h, z: b.z0 + t / 2, sx: w, sy: 0.34, sz: t, color: c });
        box({ x: cx, y: h, z: b.z1 - t / 2, sx: w, sy: 0.34, sz: t, color: c });
        box({ x: b.x0 + t / 2, y: h, z: cz, sx: t, sy: 0.34, sz: Math.max(0.2, d - t * 2), color: mixHex(c, "#000000", 0.1) });
        box({ x: b.x1 - t / 2, y: h, z: cz, sx: t, sy: 0.34, sz: Math.max(0.2, d - t * 2), color: mixHex(c, "#000000", 0.1) });
      }
    }
    // bồn nước inox trên mái — chi tiết nhỏ nhưng là "chữ ký" của nhà ống Sài Gòn
    if (!b.anchor && b.floors >= 2 && b.floors <= 6 && w > 3 && d > 3 && !wantGable && hash01(b.x0 * 1.7 + b.z1 * 2.3) > 0.45) {
      push(drums, {
        x: b.x0 + w * 0.3, y: h, z: b.z0 + d * 0.66,
        sx: 0.55, sy: 1.4, sz: 0.55, color: "#c9cdd2",
      });
    }
  }

  // --- cây, cột đèn, vật thể vỉa hè -----------------------------------------------------------
  let props = 0;
  for (const p of city.props) {
    if (p.kind === "tree") {
      const hh = 3.8 + hash01(p.x + p.z) * 1.4;
      const trunkH = hh * 0.42;
      push(trunks, { x: p.x, y: 0, z: p.z, sx: 0.22, sy: trunkH, sz: 0.22, color: "#584330" });
      push(canopies, { x: p.x, y: trunkH - 0.4, z: p.z, sx: 1.9, sy: hh - trunkH + 0.6, sz: 1.9, color: "#4f7046" });
      props += 1;
    } else if (p.kind === "lamp") {
      box({ x: p.x, y: 0, z: p.z, sx: 0.16, sy: 4.6, sz: 0.16, color: "#8a8f96" });
      props += 1;
    } else if (p.kind === "stall") {
      box({ x: p.x, y: 0, z: p.z, sx: 1.5, sy: 2.1, sz: 1.5, color: "#b06a4a" });
      box({ x: p.x, y: 2.1, z: p.z, sx: 2.1, sy: 0.16, sz: 2.1, color: "#c94f3a" });
      props += 1;
    } else if (p.kind === "moto") {
      box({ x: p.x, y: 0, z: p.z, sx: 0.8, sy: 1.05, sz: 1.9, ry: hash01(p.x) * 3.14, color: "#5a5f6a" });
      props += 1;
    }
  }

  // --- nhãn mốc thật ---------------------------------------------------------------------------
  const anchorTops = new Map<string, { x: number; y: number; z: number }>();
  for (const b of city.buildings) {
    if (!b.anchor) continue;
    const prev = anchorTops.get(b.anchor);
    const top = { x: (b.x0 + b.x1) / 2, y: b.heightM + 4, z: (b.z0 + b.z1) / 2 };
    if (!prev || top.y > prev.y) anchorTops.set(b.anchor, top);
  }
  const anchors = city.anchors
    .map((a) => {
      const t = anchorTops.get(a.id);
      return t ? { id: a.id, name: a.name, ...t } : null;
    })
    .filter((a): a is { id: string; name: string; x: number; y: number; z: number } => a !== null);

  return {
    boxes, prisms, gables, trunks, canopies, details, drums, anchors,
    stats: {
      buildings: city.buildings.filter((b) => !b.walkable).length,
      towers, gabledRoofs, parts, roads, props,
      minY: Number.isFinite(minY) ? minY : 0,
      maxY: Number.isFinite(maxY) ? maxY : 0,
    },
  };
};
