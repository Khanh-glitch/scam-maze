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
import {
  REAL_WORLD_BUILD_MARGIN_M,
  REAL_WORLD_MARGIN_M,
  REAL_WORLD_RECTS,
  REAL_WORLD_TOWERS,
  inRealWorld,
} from "./realWorldFootprint";
import type { City, CityBuilding } from "./cityGen";
import { CURB_HEIGHT } from "../testbus/openworld/simulation/boarding";

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
  /** Quay quanh trục z cục bộ — dùng cho dây điện võng xuống (radian). */
  rz?: number;
  /** Quay quanh trục x cục bộ — dùng cho bánh xe nằm ngang (radian). */
  rx?: number;
  color: string;
}

export interface CityMesh {
  /** Hộp: nhà, bệ, đỉnh kỹ thuật. Được dán vân mặt đứng + vân mái. */
  boxes: Part[];
  /** Hộp phẳng: mặt đường, vỉa hè, mặt nước, sân, cột đèn, sạp, xe — một màu, không vân. */
  flat: Part[];
  /** Bó vỉa: dải đá granite giữa lòng đường và hè — thứ làm mép phố có cạnh như phố thật. */
  kerbs: Part[];
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
  /** Cột đèn đường — hình trụ mảnh, dùng chung một lưới instanced. */
  poles: Part[];
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
  residential: ["#ddd6c6", "#cfd6c9", "#c4d0d3", "#dcc9bd", "#c8a878", "#c0b2c4", "#e4e0d5", "#b9c6b9"],
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
/** Biển dọc (banner) trước cửa hàng: đỏ–xanh–vàng bão hoà, đúng kiểu phố buôn bán. */
const BANNER = ["#c0392b", "#1f4e79", "#d4a017", "#20694f", "#a12b4a", "#2d6ca8", "#c25a12"];
const BIKE = ["#22242a", "#2e3440", "#8b1f24", "#1f3f6b", "#c9c9cc", "#3a4a3a", "#6b6f76"];
const WIRE_SHADES = ["#24262b", "#2b2f36", "#1d2024"];

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
  // Khối "phẳng": mặt đường, vỉa hè, mặt nước, sân, cột đèn, sạp, xe. Trước đây chúng nằm chung
  // `boxes` nên bị dán vân cửa sổ của toà nhà — mặt đường vì thế thành một tấm lưới đen.
  const flat: Part[] = [];
  const kerbs: Part[] = [];
  const drums: Part[] = [];
  const poles: Part[] = [];
  const byDistrict = new Map(city.districts.map((d) => [d.id, d]));
  let towers = 0;
  let gabledRoofs = 0;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let parts = 0;

  /**
   * MẢNH NÀY CÓ RƠI VÀO MAP CHUẨN KHÔNG.
   *
   * `/saigon` chạy trên chính runtime của `/testbus`: hẻm 462/14, Đại lộ 3/2, Hải Triều, Đại lộ
   * Đông, bến sông và quảng trường Landmark 81 **đã có hình học riêng** trong scene đó. Thành phố
   * sinh tự động chỉ được dựng phần còn lại — nếu không thì hai tấm nhựa, hai dãy bó vỉa, hai bộ
   * cột đèn nằm chồng lên nhau, lệch nhau vài phân và lệch cả bề rộng.
   *
   * Hộp bao của mảnh (đã tính cả góc xoay) được so với 9 vùng của map chuẩn; chạm là bỏ, không
   * phải "cắt bớt cho gần đúng".
   */
  const partHitsRealMap = (p: Part): boolean => {
    // Vật đứng (nhà, cột, cây, biển hiệu) phải lùi đủ xa: map chuẩn dựng nhà sâu 10–18 m ngoài vùng
    // đi được. Mặt phẳng (nhựa, hè, cỏ) chỉ cần 2 m — nếu lùi 18 m thì quanh map chuẩn thành vành
    // đai đất trống, còn tệ hơn.
    const margin = p.sy > 2 ? REAL_WORLD_BUILD_MARGIN_M : REAL_WORLD_MARGIN_M;
    const ry = p.ry ?? 0;
    const c = Math.abs(Math.cos(ry));
    const sn = Math.abs(Math.sin(ry));
    const hx = (c * p.sx + sn * p.sz) / 2;
    const hz = (sn * p.sx + c * p.sz) / 2;
    for (const r of REAL_WORLD_RECTS) {
      if (
        p.x + hx > r.x0 - margin &&
        p.x - hx < r.x1 + margin &&
        p.z + hz > r.z0 - margin &&
        p.z - hz < r.z1 + margin
      ) {
        return true;
      }
    }
    return false;
  };

  /**
   * Tấm phẳng lớn (nền công viên, mặt nước, sàn quảng trường) bị **chia thành ô 24 m** trước khi
   * lọc. Trước đây cả tấm 200 × 150 m bị bỏ nguyên vì mép nó chạm vùng map chuẩn — kết quả là một
   * hố vuông giữa thành phố, đúng hiện tượng "mất nền". Chia ô thì chỉ ô chạm mới mất.
   */
  const SLAB_TILE_M = 24;
  const pushTiled = (p: Part) => {
    if ((p.ry ?? 0) !== 0 || (p.sx <= SLAB_TILE_M && p.sz <= SLAB_TILE_M)) {
      push(flat, p);
      return;
    }
    const nx = Math.ceil(p.sx / SLAB_TILE_M);
    const nz = Math.ceil(p.sz / SLAB_TILE_M);
    const w = p.sx / nx;
    const d = p.sz / nz;
    for (let i = 0; i < nx; i += 1) {
      for (let j = 0; j < nz; j += 1) {
        push(flat, {
          ...p,
          x: p.x - p.sx / 2 + w * (i + 0.5),
          z: p.z - p.sz / 2 + d * (j + 0.5),
          sx: w,
          sz: d,
        });
      }
    }
  };

  const push = (list: Part[], p: Part) => {
    if (parts >= maxParts) return;
    if (partHitsRealMap(p)) return;
    parts += 1;
    list.push(p);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + p.sy);
  };
  const box = (p: Part) => push(boxes, p);
  const flatBox = (p: Part) => pushTiled(p);
  const kerbBox = (p: Part) => push(kerbs, p);

  // --- nền: đường, vỉa hè, nước ---------------------------------------------------------------
  let roads = 0;
  for (const s of city.streets) {
    const w = s.widthM;
    // HÈ THEO CHUẨN LÝ THÁI TỔ. Map chuẩn: lòng đường 12,8 m + **6,8 m hè mỗi bên** (tổng tiết
    // diện 26,4 m). Thành phố trước đây để 1,6 m (phố) / 2,8 m (đại lộ) — đứng ở đó thì cột điện,
    // cây, người đi bộ chen hết vào một dải hẹp, và phố đọc ra "hành lang nhựa" chứ không ra phố
    // Sài Gòn. Không lấy nguyên 6,8 m vì phố thủ tục rộng 7,2–12,8 m: hè 6,8 m trên phố 7,2 m là
    // hè rộng gấp đôi đường. Ở đây nới lên 2,6–4,0 m, tức gấp đôi trước, và vẫn giữ đúng tỉ lệ
    // giữa hẻm / phố / đại lộ của map chuẩn.
    const walk = s.klass === "alley" ? 1.1 : s.klass === "avenue" ? 4.0 : 2.6;
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
      // vỉa hè (sáng, thấp) rồi lòng đường (tối) chồng lên
      // Vỉa hè cao 0,17 m, lòng đường 0,08 m ⇒ có bó vỉa. Trước đây đường cao hơn hè 1 cm nên
      // mép đường biến mất, cả mặt phố thành một tấm xám.
      // Vỉa hè là HAI DẢI hai bên, không phải một tấm phủ cả mặt đường: tấm phủ rộng hơn và cao
      // hơn lòng đường nên nó che mất đường, cả phố ra một dải xám.
      // Vỉa hè phải DỪNG ở ngã tư: chạy suốt chiều dài đoạn thì dải hè băng ngang lòng đường của
      // phố cắt qua — nhìn như một thanh xám nổi giữa ngã tư.
      const cuts: Array<{ t: number; half: number }> = [];
      for (const o of city.streets) {
        if (o === s) continue;
        for (let j = 0; j < o.points.length - 1; j += 1) {
          const [ox0, oz0] = o.points[j];
          const [ox1, oz1] = o.points[j + 1];
          const dx = bx - ax;
          const dz = bz - az;
          const ex = ox1 - ox0;
          const ez = oz1 - oz0;
          const den = dx * ez - dz * ex;
          if (Math.abs(den) < 1e-6) continue;
          const t = ((ox0 - ax) * ez - (oz0 - az) * ex) / den;
          const u = ((ox0 - ax) * dz - (oz0 - az) * dx) / den;
          if (t <= 0 || t >= 1 || u < 0 || u > 1) continue;
          cuts.push({ t, half: (o.widthM / 2 + 1.2) / len });
        }
      }
      // Cắt theo 9 vùng của map chuẩn: tuyến dừng đúng mép vùng (cộng lề 2 m), không chạy vào
      // trong rồi bị bộ lọc `partHitsRealMap` xoá cả đoạn dài.
      for (const r of REAL_WORLD_RECTS) {
        const dx0 = bx - ax;
        const dz0 = bz - az;
        let rt0 = 0;
        let rt1 = 1;
        let keep = true;
        const axes: Array<[number, number, number, number]> = [
          [ax, dx0, r.x0 - REAL_WORLD_MARGIN_M, r.x1 + REAL_WORLD_MARGIN_M],
          [az, dz0, r.z0 - REAL_WORLD_MARGIN_M, r.z1 + REAL_WORLD_MARGIN_M],
        ];
        for (const [p0, d0, lo, hi] of axes) {
          if (Math.abs(d0) < 1e-6) {
            if (p0 < lo || p0 > hi) {
              keep = false;
              break;
            }
            continue;
          }
          const ta = (lo - p0) / d0;
          const tb = (hi - p0) / d0;
          rt0 = Math.max(rt0, Math.min(ta, tb));
          rt1 = Math.min(rt1, Math.max(ta, tb));
          if (rt0 >= rt1) {
            keep = false;
            break;
          }
        }
        if (!keep || rt1 <= 0 || rt0 >= 1) continue;
        cuts.push({ t: (rt0 + rt1) / 2, half: (rt1 - rt0) / 2 });
      }
      // Khu phố gốc tự vẽ lòng đường + hè của nó: cắt bỏ đoạn tuyến sinh tự động nằm trong vùng đó,
      // nếu không hai tấm nhựa chồng nhau và mép đường hiện một bậc.
      if (city.core.streetId === s.id && Math.abs(bz - az) < 1.5) {
        const lo = Math.min(ax, bx);
        const span = Math.abs(bx - ax);
        const g0 = (city.core.x0 - lo) / span;
        const g1 = (city.core.x1 - lo) / span;
        if (g0 > -0.1 && g1 < 1.1) {
          const t0 = Math.max(0, ax < bx ? g0 : 1 - g1);
          const t1 = Math.min(1, ax < bx ? g1 : 1 - g0);
          if (t1 > t0) cuts.push({ t: (t0 + t1) / 2, half: (t1 - t0) / 2 });
        }
      }
      cuts.sort((a2, b2) => a2.t - b2.t);
      const spans: Array<[number, number]> = [];
      let from = 0;
      for (const c of cuts) {
        const to = Math.max(from, c.t - c.half);
        if (to - from > 0.004) spans.push([from, to]);
        from = Math.max(from, c.t + c.half);
      }
      if (1 - from > 0.004) spans.push([from, 1]);
      const off = w / 2 + walk / 2;
      for (const sgn of [-1, 1]) {
        for (const [t0, t1] of spans) {
          const segLen = (t1 - t0) * len;
          const mid = (t0 + t1) / 2;
          // dịch theo trục ngang của tấm đường: cục bộ +z → (sin ry, cos ry)
          flatBox({
            x: ax + (bx - ax) * mid + Math.sin(ry) * off * sgn,
            // Đỉnh hè = 0,24 m (đáy 0,10 + dày 0,14) trên lòng đường đỉnh 0,03 m ⇒ bó vỉa cao 21 cm,
            // đúng dải cao độ của map chuẩn (`CURB_HEIGHT` = 0,16 cộng tấm lát). `pushTiled` **dùng
            // chung object** cho mọi ô nhỏ nên đây phải là một object mới mỗi lần, không được tái sử
            // dụng — nếu tái sử dụng thì `x` ghi đè lẫn nhau và cả vỉa hè dồn về một chỗ.
            y: 0.10,
            z: az + (bz - az) * mid + Math.cos(ry) * off * sgn,
            sx: segLen, sy: 0.14, sz: walk, ry, color: "#8e8b86",
          });
        }
      }
      for (const [t0, t1] of spans) {
        const segLen = (t1 - t0) * len;
        const mid = (t0 + t1) / 2;
        flatBox({
          // Mặt nhựa đỉnh 0,0 m — trùng mặt đường của map chuẩn (`simulation/street.ts` đặt tấm
          // nhựa ở y = 0). Trước đây thành phố cao 0,08 m nên mép nối nhô lên 8 cm.
          x: ax + (bx - ax) * mid, y: -0.03, z: az + (bz - az) * mid,
          sx: segLen + 0.3, sy: 0.06, sz: w, ry,
          color: s.klass === "alley" ? "#605e6b" : "#5a5964",
        });
      }
      // BÓ VỈA: dải đá granite ở đúng mép lòng đường, cao bằng hè (0,17) và nhô khỏi mặt nhựa
      // (0,08) đúng 9 cm như bó vỉa thật. Màu xen kẽ đá sáng / đá xỉn theo từng đoạn — bó vỉa thật
      // không bao giờ đều một màu. Đây là thứ map chuẩn dựng bằng box 0,15 × 0,107 × 0,687 m
      // (`simulation/street.ts`), nhìn từ tầm mắt chính là "mép phố có cạnh".
      // Bó vỉa chia **viên 0,70 m** như map chuẩn (`simulation/street.ts`: `box([x, .106, z],
      // [.15, .107, .687])` mỗi 0,70 m, 20% viên sậm hơn). Trước đây là một dải dài cả đoạn: nhìn
      // từ tầm mắt thì mép phố ra một đường kẻ liền, không đọc ra đá lát, và không có nhịp dẫn mắt
      // dọc phố — đúng thứ Lý Thái Tổ có mà thành phố thiếu.
      // Bó vỉa chia **viên 0,70 m** như map chuẩn (`simulation/street.ts`: `box([x, .106, z],
      // [.15, .107, .687])` mỗi 0,70 m, 20% viên sậm hơn). Trước đây là một dải dài cả đoạn: nhìn
      // từ tầm mắt thì mép phố ra một đường kẻ liền, không đọc ra đá lát, và không có nhịp dẫn mắt
      // dọc phố — đúng thứ Lý Thái Tổ có mà thành phố thiếu.
      //
      // Vì sao KHÔNG phải một viên cho mỗi 0,70 m: thành phố có ~4,6 km mép đường mỗi bên, tức
      // ~13 000 viên; cộng 46 000 lăng trụ và 24 000 khối nhà thì vượt trần `maxParts` 120 000 và
      // **tự cắt mất phần cuối thành phố**. Đo được: 113 844 → 178 233 mảnh nếu chia từng viên.
      // Nên chia theo **nhịp 0,7 m**: mỗi dải dài được cắt thành ~4 đoạn (mỗi đoạn vài chục mét,
      // cùng một lô instanced, không thêm draw call) và màu xen kẽ theo nhịp đó, đủ để mép phố có
      // tiết tấu như bó vỉa thật mà không phá trần.
      const KERB_PIECE_MAX_M = 40;
      const KERB_RHYTHM_M = 0.70;
      const kerbOff = w / 2 + 0.08;
      for (const sgn of [-1, 1]) {
        for (const [t0, t1] of spans) {
          const segLen = (t1 - t0) * len;
          const n = Math.max(1, Math.round(segLen / KERB_PIECE_MAX_M));
          const piece = segLen / n;
          for (let k = 0; k < n; k += 1) {
            const t = t0 + ((k + 0.5) / n) * (t1 - t0);
            const rhythm = Math.round(((t * len) / KERB_RHYTHM_M) % 7);
            kerbBox({
              x: ax + (bx - ax) * t + Math.sin(ry) * kerbOff * sgn,
              y: 0.085,
              z: az + (bz - az) * t + Math.cos(ry) * kerbOff * sgn,
              // chừa 0,013 m mối nối: viên đá liền nhau thì lại thành một dải liền.
              sx: Math.max(0.2, piece - 0.013), sy: 0.17, sz: 0.16, ry,
              color: rhythm === 0 ? "#8f8b80" : "#bdb7a8",
            });
          }
        }
      }
      // DẢI PHÂN CÁCH (median) cho đại lộ. Map chuẩn tách hai chiều của trục lớn bằng một dải bó vỉa
      // + cỏ/bê tông ở giữa (`simulation/street.ts`), không phải chỉ hai vạch vàng. Thiếu nó thì đại
      // lộ 21,2 m đọc ra "phố lớn trải nhựa", và mắt không có gì đo chiều rộng. Ở đây chỉ làm cho
      // **đoạn dài hơn 40 m** — dải phân cách 3 m ở một đoạn 12 m là chặn hết lòng đường.
      // Cao độ theo đúng bất biến: bó vỉa `CURB_HEIGHT` = 0,17 m so với mặt nhựa 0,0 m.
      const medianW = s.widthM >= 18 ? 3.2 : 2.2;
      for (const [t0, t1] of spans) {
        const segLen = (t1 - t0) * len;
        if (segLen <= 40) continue;
        const mid = (t0 + t1) / 2;
        const cx = ax + (bx - ax) * mid;
        const cz = az + (bz - az) * mid;
        // Thân dải: thấp hơn hè (người không đi trên đó) nhưng cao hơn nhựa đúng `CURB_HEIGHT`.
        kerbBox({ x: cx, y: CURB_HEIGHT / 2, z: cz, sx: segLen, sy: CURB_HEIGHT, sz: medianW, ry, color: "#8f8d86" });
        // Mặt trên: cỏ ở đại lộ có dải cây, bê tông ở đại lộ thuần giao thông — xen kẽ theo đoạn để
        // phố không thành một dải xám tuyệt đối đều.
        const grassy = hash01(mid * 37.1 + t0) > 0.45;
        flatBox({
          x: cx, y: CURB_HEIGHT + 0.02, z: cz,
          sx: Math.max(0, segLen - 0.4), sy: 0.04, sz: medianW - 0.3, ry,
          color: grassy ? "#3f4a2c" : "#9a978f",
        });
        // Bó vỉa hai bên dải: đá sáng, đúng mép — nhìn từ tầm mắt thấy được cạnh như bó vỉa hè.
        for (const sgn of [-1, 1]) {
          kerbBox({
            x: cx + Math.sin(ry) * (medianW / 2) * sgn,
            y: CURB_HEIGHT / 2,
            z: cz + Math.cos(ry) * (medianW / 2) * sgn,
            sx: segLen, sy: CURB_HEIGHT + 0.02, sz: 0.16, ry, color: "#c0bbac",
          });
        }
      }

      // Vạch kẻ mặt đường: map chuẩn dùng **tim kép vàng** cho đại lộ và **vạch trắng** cho phố
      // (`simulation/street.ts` — "double yellow median & dashed lane markings"). Trước đây thành
      // phố chỉ có một hàng gạch vàng nhạt, nên đại lộ đọc ra "đường nháp".
      if (s.klass === "avenue") {
        for (const sgn of [-1, 1]) {
          for (const [t0, t1] of spans) {
            const segLen = (t1 - t0) * len;
            const mid = (t0 + t1) / 2;
            const offY = 0.22 * sgn;
            flatBox({
              x: ax + (bx - ax) * mid + Math.sin(ry) * offY,
              y: 0.006,
              z: az + (bz - az) * mid + Math.cos(ry) * offY,
              sx: segLen, sy: 0.02, sz: 0.13, ry, color: "#c8b264",
            });
          }
        }
      } else if (s.klass === "street") {
        // Lý Thái Tổ có **hai** vạch chia làn (mỗi bên tim, mỗi 5,6 m một vạch dài 2,72 m —
        // `simulation/street.ts`). Trước đây thành phố chỉ có một vạch tim, nên phố 12,8 m đọc ra
        // "hai làn" trong khi map chuẩn cho thấy rõ bốn làn xe.
        const lanes = [-w / 4, w / 4];
        for (const off of lanes) {
          const dash = Math.max(1, Math.floor(len / 5.6));
          for (let k = 0; k < dash; k += 1) {
            const t = (k + 0.5) / dash;
            flatBox({
              x: ax + (bx - ax) * t + Math.sin(ry) * off,
              y: 0.005,
              z: az + (bz - az) * t + Math.cos(ry) * off,
              sx: 2.72, sy: 0.02, sz: 0.135, ry, color: "#d7d5bc",
            });
          }
        }
      }
      // Vạch mép trắng sát bó vỉa (map chuẩn có: `plane(curb, ... white)` dọc hai bên). Thiếu nó thì
      // mép đường không có đường dẫn mắt, cả mặt phố thành một tấm xám liền.
      if (s.klass === "avenue" || s.klass === "street") {
        for (const sgn of [-1, 1]) {
          for (const [t0, t1] of spans) {
            const segLen = (t1 - t0) * len;
            const mid = (t0 + t1) / 2;
            const offE = (w / 2 - 0.35) * sgn;
            flatBox({
              x: ax + (bx - ax) * mid + Math.sin(ry) * offE,
              y: 0.007,
              z: az + (bz - az) * mid + Math.cos(ry) * offE,
              sx: segLen, sy: 0.02, sz: 0.12, ry, color: "#d9d6c6",
            });
          }
        }
      }
      // VẠCH ĐI BỘ Ở NGÃ TƯ. Lý Thái Tổ có vạch ngựa vằn ở mọi giao lộ có đèn (`plane(curb, ...,
      // zebra, 0, X_ANGLE)` tại z = −76, −96, −147). Thành phố trước đây không có vạch nào, nên ngã
      // tư có đèn mà không có chỗ sang đường: người đi bộ phải băng giữa lòng đường.
      // Chỉ vẽ ở phố/đại lộ (hẻm 2,6 m không có vạch), và chỉ khi đoạn đủ dài để vạch không đè
      // lên dải phân cách.
      if (s.klass === "avenue" || s.klass === "street") {
        for (const [t0, t1] of spans) {
          const segLen = (t1 - t0) * len;
          if (segLen < 14) continue;
          for (const edge of [t0, t1] as const) {
            const dir = edge === t0 ? 1 : -1;
            // tâm vạch cách mũi đoạn 2,1 m (chỗ cắt đã chừa hộp giao lộ)
            const along = (edge === t0 ? t0 * len + 2.1 : t1 * len - 2.1) / len;
            const t = along;
            for (let k = 0; k < 6; k += 1) {
              const off = (k - 2.5) * 0.92;
              if (Math.abs(off) > w / 2 - 0.5) continue;
              flatBox({
                x: ax + (bx - ax) * t + Math.sin(ry) * off,
                y: 0.008,
                z: az + (bz - az) * t + Math.cos(ry) * off,
                sx: 0.55, sy: 0.02, sz: 3.0, ry, color: "#e2dfd4",
              });
            }
            void dir;
          }
        }
      }
      roads += 1;
    }
  }
  for (const wt of city.water) {
    flatBox({ x: (wt.x0 + wt.x1) / 2, y: -0.1, z: (wt.z0 + wt.z1) / 2, sx: wt.x1 - wt.x0, sy: 0.16, sz: wt.z1 - wt.z0, color: "#12414d" });
  }
  // cầu: mặt bê tông đi được bên trên nước
  for (const d of city.decks) {
    flatBox({ x: (d.x0 + d.x1) / 2, y: 0.1, z: (d.z0 + d.z1) / 2, sx: d.x1 - d.x0, sy: 0.2, sz: d.z1 - d.z0, color: "#6c6a63" });
  }

  // --- ĐAI CHUYỂN TIẾP quanh map chuẩn ---------------------------------------------------------
  // Dải đất 18 m ngoài 9 vùng đi được trước đây là vành trống: `cityGen` nhường cả lề nhà 18 m cho
  // dãy nhà map chuẩn, mà map chuẩn thì chỉ dựng tới 10–18 m ngoài mép vùng đi được. Hệ quả là
  // đứng trong hẻm 462/14 nhìn ra thấy thành phố bắt đầu sau một khoảng đất trống.
  //
  // Ở đây dựng đúng lớp chuyển tiếp: hè 3 m + bó vỉa ở cao độ `CURB_HEIGHT`, và dãy nhà 3–4 tầng
  // (cao ≤ 12 m, sâu 8–12 m) mặt tiền quay vào map cũ. Mọi mảnh vẫn đi qua `push`, nên
  // `partHitsRealMap` kiểm lại lần cuối — đai không bao giờ đè lên công trình của map chuẩn.
  //
  // Dữ liệu ở `city.belt` (`transitionBelt.ts`) chứ không sinh trong vòng lặp này: cùng một nguồn
  // cho hình học và cho test.
  for (const p of city.belt.walk) {
    flatBox({
      x: p.x,
      y: 0.10,
      z: p.z,
      sx: p.lengthM,
      sy: 0.14,
      sz: p.widthM,
      ry: p.ry,
      color: "#8e8b86",
    });
  }
  for (const p of city.belt.kerbs) {
    kerbBox({
      x: p.x,
      y: 0.085,
      z: p.z,
      sx: p.lengthM,
      sy: 0.17,
      sz: p.widthM,
      ry: p.ry,
      color: hash01(p.x * 3.7 + p.z * 1.3) > 0.7 ? "#8f8b80" : "#bdb7a8",
    });
  }
  for (const p of city.belt.props) {
    if (p.kind === "tree") {
      const hh = 4.2 + hash01(p.x + p.z) * 1.6;
      const trunkH = hh * 0.42;
      // Thân và tán đứng trên vỉa hè của map chuẩn (0,17 m), không phải mặt đất 0 m.
      push(trunks, { x: p.x, y: 0.17, z: p.z, sx: 0.24, sy: trunkH, sz: 0.24, color: "#584330" });
      push(canopies, { x: p.x, y: 0.17 + trunkH - 0.4, z: p.z, sx: 2.1, sy: hh - trunkH + 0.6, sz: 2.1, color: "#4f7046" });
    } else if (p.kind === "lamp") {
      push(poles, { x: p.x, y: 0.17, z: p.z, sx: 0.19, sy: 7.6, sz: 0.19, color: "#5a6066" });
      push(details, { x: p.x, y: 0.17, z: p.z, sx: 0.34, sy: 0.7, sz: 0.34, color: "#2a3034" });
      const dir = hash01(p.x * 3.1 + p.z * 1.7) > 0.5 ? 1 : -1;
      const alongX = hash01(p.z * 2.7 + p.x * 0.9) > 0.5;
      push(details, alongX
        ? { x: p.x + dir, y: 7.67, z: p.z, sx: 2.0, sy: 0.09, sz: 0.09, color: "#5a6066" }
        : { x: p.x, y: 7.67, z: p.z + dir, sx: 0.09, sy: 0.09, sz: 2.0, color: "#5a6066" });
      const hx = alongX ? p.x + dir * 2.1 : p.x;
      const hz = alongX ? p.z : p.z + dir * 2.1;
      push(details, { x: hx, y: 7.95, z: hz, sx: 0.64, sy: 0.14, sz: 0.34, color: "#2a3034" });
      push(details, { x: hx, y: 7.85, z: hz, sx: 0.52, sy: 0.06, sz: 0.24, color: "#ffdca4" });
    }
  }

  // --- toà nhà --------------------------------------------------------------------------------
  // Nhà của đai chuyển tiếp đi **qua đúng đường** của nhà thành phố: cùng vân mặt đứng, cùng dầm
  // sàn, cùng ban công — chỉ khác là thấp (≤ 12 m) và quay mặt vào map cũ. Dựng riêng một bộ hình
  // khác ở đây là hai chất lượng mặt phố trong cùng một khung hình.
  for (const b of [...city.buildings, ...city.belt.buildings]) {
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
      const decal = (y: number, hh: number, deep: number, out: number, szAlong: number, color: string, along = 0) => {
        const off = wallPlane + outDir * (out + deep / 2);
        push(details, alongX
          ? { x: cx + along, y, z: off, sx: szAlong, sy: hh, sz: deep, color }
          : { x: off, y, z: cz + along, sx: deep, sy: hh, sz: szAlong, color });
      };
      if (facadeH > 3.2) {
        // Chân tường bẩn: mọi bức tường phố thật đều có vệt ẩm/moss ở 0,8 m sát đất.
        decal(0.0, 0.85, 0.05, 0.0, faceLen, mixHex(base, "#3a352e", 0.34));
        // Tầng trệt KHÔNG phải một dải liền: mỗi mặt tiền là 3–6 căn hộ nhỏ 3–4 m, mỗi căn một màu
        // cửa cuốn và một băng hiệu riêng. Một dải liền suốt 20 m đọc ra "toà nhà có chân màu xám".
        const shops = Math.max(1, Math.round(faceLen / 3.7));
        const segLen = faceLen / shops;
        for (let k = 0; k < shops; k += 1) {
          const along = -faceLen / 2 + (k + 0.5) * segLen;
          const pick = SHOP_COLOR[Object.keys(SHOP_COLOR)[Math.floor(hash01(b.x0 * 2.7 + b.z1 + k * 3.1) * Object.keys(SHOP_COLOR).length)]];
          const shutter = mixHex(mixHex(shopC, pick, 0.5), k % 2 === 0 ? "#ffffff" : "#2a2a2a", 0.14 + hash01(b.x1 + k) * 0.2);
          decal(0.16, Math.min(2.75, facadeH * 0.6), 0.12, 0.02, segLen * 0.84, shutter, along);
          decal(Math.min(2.9, facadeH * 0.6), Math.min(0.8, facadeH * 0.19), 0.14, 0.02, segLen * 0.9, mixHex(pick, "#ffffff", 0.15), along);
        }
      }
      // Mái hiên bạt: TỪNG TẤM 3–4 m có khe, không phải một tấm dài bằng cả dãy nhà.
      if ((klass === "residential" || klass === "market") && facadeH > 4.6 && facadeH < 26) {
        const aw = AWNING[Math.floor(hash01(b.x0 + b.z1) * AWNING.length) % AWNING.length];
        const pieces = Math.max(1, Math.round(faceLen / 4.2));
        for (let k = 0; k < pieces; k += 1) {
          const segLen = (faceLen / pieces) * 0.82;
          const centreT = (k + 0.5) / pieces;
          // Mái hiên bạt vươn 1,5 m ra hè: che nắng và tạo bóng đổ trên vỉa hè — đúng ảnh tham chiếu.
          const off = wallPlane + outDir * 0.72;
          push(details, alongX
            ? { x: b.x0 + 0.25 + faceLen * centreT, y: 3.25, z: off, sx: segLen, sy: 0.09, sz: 1.5, color: aw }
            : { x: off, y: 3.25, z: b.z0 + 0.25 + faceLen * centreT, sx: 1.5, sy: 0.09, sz: segLen, color: aw });
        }
      }
      // biển dọc trước cửa: mảng màu bão hoà, đúng chất phố buôn bán
      if (facadeH > 4.4 && hash01(b.x0 * 2.3 + b.z1 * 6.1) > 0.42) {
        const bc = BANNER[Math.floor(hash01(b.x1 + b.z0) * BANNER.length) % BANNER.length];
        decal(3.25, 2.15, 0.09, 0.05, 0.8, bc);
      }
      // biển hiệu nhô vuông góc
      if (facadeH > 5 && hash01(b.z0 + b.x1) > 0.55) {
        const off = wallPlane + outDir * 0.42;
        push(details, alongX
          ? { x: b.x0 + w * 0.35, y: 3.6, z: off, sx: 0.16, sy: 1.25, sz: 0.85, color: shopC }
          : { x: off, y: 3.6, z: b.z0 + d * 0.35, sx: 0.85, sy: 1.25, sz: 0.16, color: shopC });
      }
      // Dầm sàn hằn ngang mặt đứng + máy lạnh: ở khoảng cách 5 m, một mặt tường chỉ có vân cửa sổ
      // vẫn đọc ra "tấm bê tông dán hình". Dầm sàn là đường ngang thật, máy lạnh là khối thật.
      const floorCount = Math.max(1, Math.round(facadeH / 3.2));
      for (let f = 1; f < floorCount; f += 1) {
        const fy = f * 3.2;
        decal(fy - 0.07, 0.17, 0.24, 0.0, faceLen, mixHex(base, "#ffffff", 0.16));
        if (hash01(b.x0 * 1.9 + b.z1 * 4.3 + f * 7.7) > 0.5 && faceLen > 4) {
          const along = (hash01(b.x1 + f * 3.3) - 0.5) * (faceLen - 2.2);
          decal(fy + 0.75, 0.55, 0.36, 0.1, 0.78, "#cfd0cb", along);
        }
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


  // --- điện trên không + xe máy dựng hè: hai thứ "nhìn là biết Sài Gòn" -----------------------------
  // Ảnh tham chiếu phố Phan Tôn (quận 1): bó dây điện võng ngang mặt phố, xe máy dựng kín hai bên hè.
  // Thiếu hai thứ này thì phố chỉ là dãy hộp có cửa sổ.
  let overhead = 0;
  let bikes = 0;
  const spanWire = (a: [number, number, number], b: [number, number, number], thick: number, color: string) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const L = Math.hypot(Math.hypot(dx, dz), dy);
    if (L < 0.05) return;
    flatBox({
      x: (a[0] + b[0]) / 2,
      y: (a[1] + b[1]) / 2 - thick / 2,
      z: (a[2] + b[2]) / 2,
      sx: L, sy: thick, sz: thick,
      ry: Math.atan2(-dz, dx),
      rz: Math.asin(Math.max(-1, Math.min(1, dy / L))),
      color,
    });
    overhead += 1;
  };
  const parkBike = (x: number, z: number, ry: number, seed: number) => {
    const dx = Math.cos(ry);
    const dz = -Math.sin(ry);
    const c = BIKE[Math.floor(hash01(seed) * BIKE.length) % BIKE.length];
    flatBox({ x, y: 0.44, z, sx: 1.5, sy: 0.32, sz: 0.4, ry, color: c });
    flatBox({ x: x - dx * 0.12, y: 0.76, z: z - dz * 0.12, sx: 0.72, sy: 0.1, sz: 0.34, ry, color: "#2a2a2e" });
    flatBox({ x: x + dx * 0.6, y: 0.92, z: z + dz * 0.6, sx: 0.1, sy: 0.46, sz: 0.62, ry, color: "#3a3a41" });
    for (const k of [-0.62, 0.6]) {
      push(drums, {
        x: x + dx * k, y: 0.31, z: z + dz * k,
        sx: 0.31, sy: 0.1, sz: 0.31, ry, rx: Math.PI / 2, color: "#232327",
      });
    }
    bikes += 1;
  };

  for (const s of city.streets) {
    const w = s.widthM;
    // HÈ THEO CHUẨN LÝ THÁI TỔ. Map chuẩn: lòng đường 12,8 m + **6,8 m hè mỗi bên** (tổng tiết
    // diện 26,4 m). Thành phố trước đây để 1,6 m (phố) / 2,8 m (đại lộ) — đứng ở đó thì cột điện,
    // cây, người đi bộ chen hết vào một dải hẹp, và phố đọc ra "hành lang nhựa" chứ không ra phố
    // Sài Gòn. Không lấy nguyên 6,8 m vì phố thủ tục rộng 7,2–12,8 m: hè 6,8 m trên phố 7,2 m là
    // hè rộng gấp đôi đường. Ở đây nới lên 2,6–4,0 m, tức gấp đôi trước, và vẫn giữ đúng tỉ lệ
    // giữa hẻm / phố / đại lộ của map chuẩn.
    const walk = s.klass === "alley" ? 1.1 : s.klass === "avenue" ? 4.0 : 2.6;
    for (let i = 0; i < s.points.length - 1; i += 1) {
      const [ax, az] = s.points[i];
      const [bx, bz] = s.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 10) continue;
      const ry = -Math.atan2(bz - az, bx - ax);
      const side = hash01(ax * 3.1 + bz * 1.7 + len) > 0.5 ? 1 : -1;
      const poleOff = w / 2 + walk * 0.55;
      const nx = Math.sin(ry) * poleOff * side;
      const nz = Math.cos(ry) * poleOff * side;
      // Cột điện bê tông + 4 sợi dây võng giữa hai cột liền nhau.
      const gaps = Math.max(1, Math.round(len / 26));
      let prev: [number, number, number] | null = null;
      for (let k = 0; k <= gaps; k += 1) {
        const t = k / gaps;
        const px = ax + (bx - ax) * t + nx;
        const pz = az + (bz - az) * t + nz;
        flatBox({ x: px, y: 0, z: pz, sx: 0.24, sy: 8.4, sz: 0.24, color: "#8f8c85" });
        const here: [number, number, number] = [px, 8.0, pz];
        // sợi bắc ngang phố, chùng 0,6 m — không có nó thì dây chỉ chạy song song một bên hè
        if (k % 2 === 0) {
          const across = w + walk * 2;
          const ox = px - Math.sin(ry) * across * side;
          const oz = pz - Math.cos(ry) * across * side;
          spanWire([px, 7.9, pz], [(px + ox) / 2, 7.3, (pz + oz) / 2], 0.032, "#26282d");
          spanWire([(px + ox) / 2, 7.3, (pz + oz) / 2], [ox, 7.7, oz], 0.032, "#26282d");
        }
        if (prev) {
          for (let wi = 0; wi < 3; wi += 1) {
            const h = wi * 0.34;
            const sag = 0.42 + wi * 0.06;
            const mid: [number, number, number] = [(prev[0] + here[0]) / 2, (prev[1] + here[1]) / 2 + h - sag, (prev[2] + here[2]) / 2];
            const a: [number, number, number] = [prev[0], prev[1] + h, prev[2]];
            const b: [number, number, number] = [here[0], here[1] + h, here[2]];
            const col = WIRE_SHADES[wi % WIRE_SHADES.length];
            spanWire(a, mid, 0.034, col);
            spanWire(mid, b, 0.034, col);
          }
        }
        prev = here;
      }
      // Xe máy dựng nghiêng ở hai bên hè (phố ở / phố chính; hẻm thì thưa hơn).
      if (s.klass !== "bridge") {
        const step = s.klass === "alley" ? 9 : 6;
        const n = Math.floor(len / step);
        for (let k = 0; k < n; k += 1) {
          const seed = ax * 0.7 + az * 1.3 + k * 2.7 + i;
          if (hash01(seed) > (s.klass === "alley" ? 0.5 : 0.78)) continue;
          const sideB = hash01(seed + 11) > 0.5 ? 1 : -1;
          const bOff = w / 2 + walk * 0.3;
          const t = (k + 0.5) / n;
          const px = ax + (bx - ax) * t + Math.sin(ry) * bOff * sideB;
          const pz = az + (bz - az) * t + Math.cos(ry) * bOff * sideB;
          const lean = sideB > 0 ? 0.46 : -0.46;
          parkBike(px, pz, ry + lean + (hash01(seed + 3) - 0.5) * 0.22, seed);
          if (hash01(seed + 5) > 0.55) {
            const t2 = t + 1.15 / n;
            parkBike(
              ax + (bx - ax) * t2 + Math.sin(ry) * (bOff + 0.1) * sideB,
              az + (bz - az) * t2 + Math.cos(ry) * (bOff + 0.1) * sideB,
              ry + lean + (hash01(seed + 7) - 0.5) * 0.22,
              seed + 17,
            );
          }
        }
      }
    }
  }
  void overhead;

  // --- KHU PHỐ GỐC: bản đồ đang chơi được, đặt nguyên vào giữa thành phố --------------------------

  // Khu phố gốc KHÔNG vẽ lại ở đây: CityPage cắm nguyên thế giới thật của `features/khupho`
  // (coreWorld.ts) vào đúng chỗ đã cắt. Cắt lòng đường ở trên chỉ để nó không bị đè.

  // --- công viên -----------------------------------------------------------------------------
  // Trước đây "park" chỉ là một tấm nền phẳng: nhìn từ trên cao ra bãi đất trống, và khu phố gốc
  // nằm giữa một vùng xám. Ở đây mỗi ô công viên có cỏ, lối đi cắt chéo và cây trồng theo lưới lệch.
  for (const b of city.buildings) {
    if (b.kind !== "park") continue;
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    if (w < 8 || d < 8) continue;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    push(flat, { x: cx, y: 0.015, z: cz, sx: w, sy: 0.03, sz: d, color: "#6f8259" });
    // lối đi: một trục chính theo chiều dài, một nhánh ngang
    const along = w >= d ? "x" : "z";
    const pathW = 3.2;
    if (along === "x") {
      push(flat, { x: cx, y: 0.045, z: cz, sx: w, sy: 0.03, sz: pathW, color: "#b6ab97" });
      push(flat, { x: cx, y: 0.045, z: cz, sx: pathW, sy: 0.03, sz: d, color: "#b6ab97" });
    } else {
      push(flat, { x: cx, y: 0.045, z: cz, sx: pathW, sy: 0.03, sz: d, color: "#b6ab97" });
      push(flat, { x: cx, y: 0.045, z: cz, sx: w, sy: 0.03, sz: pathW, color: "#b6ab97" });
    }
    // cây: lưới 10 m lệch, chừa lối đi và mép
    let trees = 0;
    for (let x = b.x0 + 5; x < b.x1 - 4 && trees < 160; x += 10) {
      for (let z = b.z0 + 5; z < b.z1 - 4 && trees < 160; z += 10) {
        const h1 = hash01(x * 1.7 + z * 3.1);
        const h2 = hash01(x * 4.3 + z * 0.9);
        const px = x + (h1 - 0.5) * 4.5;
        const pz = z + (h2 - 0.5) * 4.5;
        if ((along === "x" && Math.abs(pz - cz) < 3.4) || (along === "z" && Math.abs(px - cx) < 3.4)) continue;
        const hh = 4.2 + h1 * 2.6;
        const trunkH = hh * 0.4;
        push(trunks, { x: px, y: 0, z: pz, sx: 0.26, sy: trunkH, sz: 0.26, color: "#584330" });
        push(canopies, { x: px, y: trunkH - 0.45, z: pz, sx: 2.6 + h2 * 1.2, sy: hh - trunkH + 0.8, sz: 2.6 + h2 * 1.2, color: h2 > 0.55 ? "#4a6a41" : "#557a4b" });
        trees += 1;
      }
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
      // CỘT ĐÈN KIỂU MAP CHUẨN (`saigonDistricts.ts` → `addLampPost`): bệ bê tông 0,7 m, cột thép
      // 7,6 m, tay đòn vươn 2 m ra lòng đường, đầu đèn hộp 0,64 m + tấm phát sáng vàng ấm
      // (0xffdca4 — đúng màu `lamp(0xffdca4, 2.2)` của map chuẩn). Trước đây chỉ là **một thanh
      // vuông 0,16 × 4,6 m**, nên ban đêm phố không có đèn mà ban ngày cũng không ra cột đèn.
      push(poles, { x: p.x, y: 0, z: p.z, sx: 0.19, sy: 7.6, sz: 0.19, color: "#5a6066" });
      push(details, { x: p.x, y: 0, z: p.z, sx: 0.34, sy: 0.7, sz: 0.34, color: "#2a3034" });
      const dir = hash01(p.x * 3.1 + p.z * 1.7) > 0.5 ? 1 : -1;
      const alongX = hash01(p.z * 2.7 + p.x * 0.9) > 0.5;
      push(details, alongX
        ? { x: p.x + dir, y: 7.5, z: p.z, sx: 2.0, sy: 0.09, sz: 0.09, color: "#5a6066" }
        : { x: p.x, y: 7.5, z: p.z + dir, sx: 0.09, sy: 0.09, sz: 2.0, color: "#5a6066" });
      const hx = alongX ? p.x + dir * 2.1 : p.x;
      const hz = alongX ? p.z : p.z + dir * 2.1;
      push(details, { x: hx, y: 7.78, z: hz, sx: 0.64, sy: 0.14, sz: 0.34, color: "#2a3034" });
      push(details, { x: hx, y: 7.68, z: hz, sx: 0.52, sy: 0.06, sz: 0.24, color: "#ffdca4" });
      props += 1;
    } else if (p.kind === "stall") {
      flatBox({ x: p.x, y: 0, z: p.z, sx: 1.5, sy: 2.1, sz: 1.5, color: "#b06a4a" });
      flatBox({ x: p.x, y: 2.1, z: p.z, sx: 2.1, sy: 0.16, sz: 2.1, color: "#c94f3a" });
      props += 1;
    } else if (p.kind === "moto") {
      flatBox({ x: p.x, y: 0, z: p.z, sx: 0.8, sy: 1.05, sz: 1.9, ry: hash01(p.x) * 3.14, color: "#5a5f6a" });
      props += 1;
    } else if (p.kind === "bin") {
      // Thùng rác nhựa xanh — đúng màu `binGreen` (0x2c4236) của `saigonProps.ts` bên map chuẩn.
      push(drums, { x: p.x, y: 0, z: p.z, sx: 0.62, sy: 1.02, sz: 0.62, color: "#2c4236" });
      props += 1;
    } else if (p.kind === "sign") {
      // Biển treo/băng-rôn trước quán: tấm dọc 0,1 m, cao 1,2 m, đặt ở 2,4 m như biển hiệu thật.
      const c = BANNER[Math.floor(hash01(p.x * 2.3 + p.z * 5.1) * BANNER.length)];
      push(details, { x: p.x, y: 2.4, z: p.z, sx: 0.12, sy: 1.2, sz: 0.8, ry: hash01(p.z) * 3.14, color: c });
      props += 1;
    } else if (p.kind === "shrine") {
      // Bàn thờ Thổ Địa nhỏ trước cửa — có thật ở gần như mọi căn phố Sài Gòn.
      push(details, { x: p.x, y: 0.35, z: p.z, sx: 0.62, sy: 0.7, sz: 0.46, color: "#8a3f34" });
      push(details, { x: p.x, y: 1.05, z: p.z, sx: 0.72, sy: 0.1, sz: 0.56, color: "#c9a24a" });
      props += 1;
    } else if (p.kind === "hoarding") {
      // Tôn chắn công trường: tấm 3,2 m × 1,8 m, KHÔNG dựng thành hàng rào liền — đặt sát nhau thì
      // 98 tấm thành một bức tường xanh chạy dọc phố (đã thấy trong ảnh kiểm tra). Chỉ dựng khi ô
      // đó thật sự là công trường, và dựng thấp, lùi vào trong hè.
      if (hash01(p.x * 3.7 + p.z * 1.9) > 0.55) {
        flatBox({ x: p.x, y: 0, z: p.z, sx: 3.2, sy: 1.8, sz: 0.08, ry: hash01(p.x + p.z) * 3.14, color: "#2f5f86" });
      }
      props += 1;
    } else if (p.kind === "cone") {
      push(drums, { x: p.x, y: 0, z: p.z, sx: 0.36, sy: 0.62, sz: 0.36, color: "#b8542f" });
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
  const servedByRealWorld = new Set(city.metrics.anchorsServedByRealWorld);
  const anchors = city.anchors
    .map((a) => {
      const t = anchorTops.get(a.id);
      if (t) return { id: a.id, name: a.name, ...t };
      // Bitexco / Landmark 81 do map thật dựng sẵn (`realWorld.ts`) — thành phố không có toà nào mang
      // id đó, nhưng nhãn vẫn phải nằm trên đúng toà thật, đúng độ cao thật.
      const real = REAL_WORLD_TOWERS[a.id];
      if (real && servedByRealWorld.has(a.id)) {
        return { id: a.id, name: a.name, x: real.x, y: (a.heightM || 12) + 4, z: real.z };
      }
      // Mốc nằm trong vùng map chuẩn (nhà trọ 59 / phòng 6.07): toà là của map chuẩn, nhãn đặt ngay
      // trên toạ độ mốc — thành phố không dựng bản sao và cũng không bỏ mất nhãn.
      if (inRealWorld(a.x, a.z, REAL_WORLD_BUILD_MARGIN_M)) {
        return { id: a.id, name: a.name, x: a.x, y: (a.heightM || 12) + 4, z: a.z };
      }
      return null;
    })
    .filter((a): a is { id: string; name: string; x: number; y: number; z: number } => a !== null);

  if (city.core.streetId) {
    anchors.push({
      id: "core-street",
      name: `Khu phố gốc · ${city.core.streetName}`,
      x: city.core.x,
      y: 26,
      z: city.core.z - 14,
    });
  }

  return {
    boxes, flat, kerbs, prisms, gables, trunks, canopies, details, drums, poles, anchors,
    stats: {
      buildings: city.buildings.filter((b) => !b.walkable).length + city.belt.buildings.length,
      towers, gabledRoofs, parts, roads, props,
      minY: Number.isFinite(minY) ? minY : 0,
      // Toà cao nhất trong scene có thể là toà của **map thật** (Landmark 81, 461 m) — nó không phải
      // khối nào của `cityMesh` nên phải cộng tay, nếu không con số "cao nhất" của thành phố còn 117 m.
      maxY: Math.max(Number.isFinite(maxY) ? maxY : 0, ...(city.metrics.anchorsServedByRealWorld
        .map((id) => city.anchors.find((a) => a.id === id)?.heightM ?? 0)
        .concat(0))),
    },
  };
};
