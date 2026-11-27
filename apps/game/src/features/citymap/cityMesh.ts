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
const TILE = ["#8a5b45", "#9c6b4f", "#7a5a4a", "#a5794f"];
const CROWN = "#5f636c";

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
    const walk = s.klass === "alley" ? 1.2 : s.klass === "avenue" ? 6.4 : 3.4;
    for (let i = 0; i < s.points.length - 1; i += 1) {
      const [ax, az] = s.points[i];
      const [bx, bz] = s.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1) continue;
      const ry = Math.atan2(bz - az, bx - ax);
      const cx = (ax + bx) / 2;
      const cz = (az + bz) / 2;
      // vỉa hè (sáng, thấp) rồi lòng đường (tối) chồng lên
      box({ x: cx, y: 0.02, z: cz, sx: len + walk * 2, sy: 0.09, sz: w + walk * 2, ry, color: "#8e8b95" });
      box({ x: cx, y: 0.06, z: cz, sx: len + 0.4, sy: 0.06, sz: w, ry, color: s.klass === "alley" ? "#43414c" : "#3a3944" });
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
    const roofC = b.kind === "market" ? "#8b6a52" : b.floors <= 2 ? tileC : CROWN;

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
    const wantGable = (b.kind === "market" || ((klass === "residential" || klass === "market") && b.floors <= 4 && w > 3 && d > 3));
    if (wantGable) {
      const rise = b.kind === "market" ? Math.min(9, Math.min(w, d) * 0.24) : Math.min(2.6, Math.min(w, d) * 0.22);
      const alongX = w >= d;
      push(gables, {
        x: cx, y: h, z: cz,
        sx: alongX ? w : d, sy: rise, sz: alongX ? d : w,
        ry: alongX ? 0 : Math.PI / 2,
        color: b.kind === "market" ? "#8b6a52" : tileC,
      });
      gabledRoofs += 1;
    } else if (h > 4) {
      // gờ mái / parapet: một vành mỏng tối hơn, đọc ra mép mái
      box({ x: cx, y: h, z: cz, sx: w * 0.96, sy: 0.35, sz: d * 0.96, color: roofC });
    }
  }

  // --- cây, cột đèn, vật thể vỉa hè -----------------------------------------------------------
  let props = 0;
  for (const p of city.props) {
    if (p.kind === "tree") {
      const hh = 3.6 + hash01(p.x + p.z) * 1.6;
      push(trunks, { x: p.x, y: 0, z: p.z, sx: 0.26, sy: hh * 0.55, sz: 0.26, color: "#584330" });
      push(canopies, { x: p.x, y: hh * 0.5, z: p.z, sx: 1.5, sy: hh * 0.55, sz: 1.5, color: "#557a4a" });
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
    boxes, prisms, gables, trunks, canopies, anchors,
    stats: {
      buildings: city.buildings.filter((b) => !b.walkable).length,
      towers, gabledRoofs, parts, roads, props,
      minY: Number.isFinite(minY) ? minY : 0,
      maxY: Number.isFinite(maxY) ? maxY : 0,
    },
  };
};
