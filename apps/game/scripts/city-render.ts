#!/usr/bin/env node
// Dựng thành phố 1:8 thành ẢNH 3D thật: camera phối cảnh, nắng có hướng, đổ bóng, tầm mắt 1,65 m.
//
// Vì sao có script này: `city-audit.ts` đo được hình học nhưng không nói được "đứng ở đó thì thấy
// gì". Sandbox không có trình duyệt và game chưa có cảnh 3D nào đọc `cityGen` — nên nếu không tự
// dựng ảnh thì không ai nhìn thấy thành phố này trước khi nó vào engine. Script này là mắt.
//
//   node scripts/city-render.ts                # dựng cả 6 khung hình
//   node scripts/city-render.ts --view=hem     # chỉ một khung
//   node scripts/city-render.ts --no-png       # chỉ SVG
//
// Không dùng WebGL, không dùng trình duyệt: hình học → camera → clip → chiếu → sắp theo độ sâu →
// tô. Tam giác nào gần che tam giác xa; nắng tính bằng Lambert trên pháp tuyến của từng mặt.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateCity, isWalkable, type City } from "../src/features/citymap/cityGen.ts";

const repo = path.resolve(process.cwd(), "..", "..");
const outDir = path.join(repo, "docs/product/audit");
const requireFromRepo = createRequire(path.join(process.cwd(), "package.json"));

const argv = new Set(process.argv.slice(2));
const only = [...argv].find((a) => a.startsWith("--view="))?.slice(7);
const noPng = argv.has("--no-png");

const city: City = generateCity();
const F = city.frame;

// --- màu --------------------------------------------------------------------------------------
type RGB = [number, number, number];
const hex2rgb = (hex: string): RGB => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb2css = (c: RGB, a = 1) =>
  a >= 1 ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
    : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Bảng màu lấy đúng cảm giác vật liệu Sài Gòn: tường vôi vàng/cam/xanh cũ ở khu nhà ống, kính xanh
// xám ở đại lộ văn phòng, tôn rỉ ở Chợ Lớn, bê tông xám ở khu đang xây.
const WALL: Record<string, string[]> = {
  residential: ["#c8a878", "#d8c39a", "#b98d63", "#cbb492", "#9fb7a4", "#b7a9bd", "#d9b7a0"],
  market: ["#c98f5a", "#b7743f", "#d3a06b", "#a8724a", "#cfae7d"],
  tourist: ["#9aa8b4", "#b9b2a0", "#8d9aa6", "#c6b79e", "#a5b0a8"],
  corporate: ["#8b8f96", "#6f7a86", "#a19c92", "#7b828c", "#8d9aa0"],
  construction: ["#8f8a80", "#a49c8e", "#7c766c"],
  park: ["#9aa88f", "#b3b49a"],
};
const ROOF = ["#8a5b45", "#9c6b4f", "#7a5a4a", "#6d6a72", "#a08a72"];
const GLASS: RGB = hex2rgb("#243040");
const SHOP: Record<string, string> = {
  cafe: "#d9a05b", food: "#c8603f", shop: "#3f6f7a", net: "#4b6f9c", gaming: "#7a4b9c",
  money: "#d4b23f", gold: "#e0c04a", bank: "#2f5a7a", pawn: "#8a3f4a", hotel: "#5f7fa8",
  repair: "#6a6a6a", laundry: "#5f8fa0", phone: "#3f7a6a", herb: "#6a8a4a", kho: "#7a6a52",
  boarding: "#7a5f52", room: "#8a6a52", market: "#b7743f", office: "#4a5a6a", default: "#6a6472",
};

const sun = (() => {
  const v: RGB = [0.46, 0.46, -0.66]; // nắng chiều thấp: bóng dài gấp ~1,4 lần chiều cao toà
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l] as RGB;
})();

// --- camera -----------------------------------------------------------------------------------
interface Camera {
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  fov: number; w: number; h: number;
}
const basisOf = (c: Camera) => {
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  return {
    right: [cy, 0, -sy] as RGB,
    up: [-sy * sp, cp, -cy * sp] as RGB,
    fwd: [sy * cp, sp, cy * cp] as RGB,
  };
};

type Face = { pts: Array<[number, number]>; fill: string; depth: number; opacity?: number; stroke?: string; width?: number };

const makeProjector = (cam: Camera) => {
  const { right, up, fwd } = basisOf(cam);
  const focal = cam.h / 2 / Math.tan((cam.fov * Math.PI) / 180 / 2);
  const toCam = (p: RGB): RGB => {
    const d: RGB = [p[0] - cam.x, p[1] - cam.y, p[2] - cam.z];
    return [d[0] * right[0] + d[1] * right[1] + d[2] * right[2], d[0] * up[0] + d[1] * up[1] + d[2] * up[2], d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2]];
  };
  const near = 0.45;
  /** Cắt đa giác theo mặt phẳng gần, trả về toạ độ màn hình. */
  const project = (world: RGB[]): { pts: Array<[number, number]>; depth: number } | null => {
    const camPts = world.map(toCam);
    const out: RGB[] = [];
    for (let i = 0; i < camPts.length; i += 1) {
      const a = camPts[i];
      const b = camPts[(i + 1) % camPts.length];
      const ain = a[2] >= near;
      const bin = b[2] >= near;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (near - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
      }
    }
    if (out.length < 3) return null;
    let depth = 0;
    const pts = out.map((p) => {
      depth += p[2];
      return [cam.w / 2 + (focal * p[0]) / p[2], cam.h / 2 - (focal * p[1]) / p[2]] as [number, number];
    });
    return { pts, depth: depth / out.length };
  };
  const screenOf = (p: RGB): [number, number] | null => {
    const c = toCam(p);
    if (c[2] < near) return null;
    return [cam.w / 2 + (focal * c[0]) / c[2], cam.h / 2 - (focal * c[1]) / c[2]];
  };
  return { project, screenOf, toCam };
};

// --- dựng hình --------------------------------------------------------------------------------
const WARM: RGB = [1.06, 1.0, 0.92];
const lambert = (normal: RGB): { k: number; warm: number } => {
  const d = Math.max(0, normal[0] * sun[0] + normal[1] * sun[1] + normal[2] * sun[2]);
  // Trời là nguồn sáng thứ hai: mặt hướng lên nhận thêm chút xanh, mặt khuất tối nhưng không đen.
  const sky = 0.5 + 0.5 * normal[1];
  // Sàn sáng nâng 0,20 → 0,30: mặt khuất nắng ở Sài Gòn vẫn nhận nhiều ánh trời, và trước đây
  // mặt quay vào camera trong ảnh "ngưỡng cửa"/"hẻm" gần như đen, mất hết khối.
  return { k: 0.30 + 0.66 * d + 0.20 * sky, warm: 0.10 + 0.30 * d };
};

interface Rect { x0: number; z0: number; x1: number; z1: number }

const scenes: Record<string, { cam: Camera; label: string; note: string; detail: boolean; maxDistance?: number }> = {};

const buildScene = (cam: Camera, world: { aerial: boolean }) => {
  const faces: Face[] = [];
  const ground: Face[] = [];
  const shadows: Face[] = [];
  const texts: Array<{ x: number; y: number; size: number; fill: string; text: string; anchor: string; rotate: number }> = [];
  const P = makeProjector(cam);
  const pushInto = (list: Face[], world3: RGB[], color: RGB, normal: RGB, opts: { opacity?: number; stroke?: string; width?: number }) => {
    const proj = P.project(world3);
    if (!proj) return;
    const { k, warm } = lambert(normal);
    const lit: RGB = [color[0] * k * (1 + (WARM[0] - 1) * warm * 3), color[1] * k * (1 + (WARM[1] - 1) * warm * 3), color[2] * k * (1 + (WARM[2] - 1) * warm * 3)];
    list.push({ pts: proj.pts, fill: rgb2css(lit), depth: proj.depth, ...opts });
  };
  const push = (world3: RGB[], color: RGB, normal: RGB, opts: { opacity?: number; stroke?: string; width?: number } = {}) => pushInto(faces, world3, color, normal, opts);
  const pushGround = (world3: RGB[], color: RGB, normal: RGB, opts: { opacity?: number } = {}) => pushInto(ground, world3, color, normal, opts);
  // Bóng phải bị CẮT vào khung đất. Nắng chiều thấp làm bóng của tháp 461 m dài hàng trăm mét, và
  // trước khi cắt chúng nằm lơ lửng ngoài đế thành phố như những mảng đen rơi giữa trời.
  const pushShadow = (world3: RGB[]) => {
    const xs = world3.map((p) => p[0]);
    const zs = world3.map((p) => p[2]);
    const x0 = Math.max(F.x0, Math.min(...xs));
    const x1 = Math.min(F.x1, Math.max(...xs));
    const z0 = Math.max(F.z0, Math.min(...zs));
    const z1 = Math.min(F.z1, Math.max(...zs));
    if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return;
    const proj = P.project([[x0, 0.01, z0], [x1, 0.01, z0], [x1, 0.01, z1], [x0, 0.01, z1]]);
    if (proj) shadows.push({ pts: proj.pts, fill: "#0b0a12", depth: 0 });
  };
  const dist = (x: number, z: number) => Math.hypot(x - cam.x, z - cam.z);

  const q = (r: Rect, y: number): RGB[] => [
    [r.x0, y, r.z0], [r.x1, y, r.z0], [r.x1, y, r.z1], [r.x0, y, r.z1],
  ];

  // Nền: đất khung hình, và đất chạy tiếp ra ngoài khung.
  // Trước đây mép bản đồ là một dải đen dày 60 m ⇒ ảnh đọc ra "sa bàn đặt trên bàn" chứ không ra
  // thành phố. Nay đất liền một mảng ra tới ngoài khung hình, chỉ khác tông ở phần đất khung.
  // Đất ngoài khung phải vẽ thành LƯỚI, không phải một tấm 5 km: một tứ giác khổng lồ có đỉnh
  // nằm sau camera bị cắt thành đa giác tự cắt và biến mất ⇒ thành phố lơ lửng giữa trời. Lưới
  // 26×26 ô thì ô nào khuất thì mất, ô nào thấy thì hiện, và mép xa tự nhoè vào sương.
  const SK = 2900;
  const skirt = { x0: F.x0 - SK, x1: F.x1 + SK, z0: F.z0 - SK, z1: F.z1 + SK };
  {
    const N = 64;
    const gx = (skirt.x1 - skirt.x0) / N;
    const gz = (skirt.z1 - skirt.z0) / N;
    const far0 = hex2rgb("#4a4a44");
    for (let i = 0; i < N; i += 1) {
      for (let j = 0; j < N; j += 1) {
        // Chồng mép 1,2 m: hai ô sát nhau để lại đường may trắng do khử răng cưa.
        const tile = {
          x0: skirt.x0 + gx * i - 0.6, x1: skirt.x0 + gx * (i + 1) + 0.6,
          z0: skirt.z0 + gz * j - 0.6, z1: skirt.z0 + gz * (j + 1) + 0.6,
        };
        const dc = dist((tile.x0 + tile.x1) / 2, (tile.z0 + tile.z1) / 2);
        const haze = Math.min(0.62, Math.max(0, (dc - 900) / 3400)) ** 0.9;
        // Đất ngoài đô thị không phải bê tông: ruộng, vườn, xóm — mỗi ô lệch tông ±5 % và ngả lục.
        // Lệch tông ±3 % và ô 45 m: đủ để mặt đất không phải một tấm bê tông phẳng, nhưng không
        // thành bàn cờ (ô 220 m lệch 10 % đọc ra ngay là lưới).
        const hv = Math.abs(Math.round(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453)) % 1000 / 1000;
        const soilC = mix(hex2rgb("#55544a"), hex2rgb("#5f5c50"), hv);
        pushGround(q(tile, -0.06), mix(soilC, hex2rgb("#9d97a0"), haze), [0, 1, 0]);
      }
    }
  }
  // Đất trong khung CÙNG mặt phẳng và gần cùng tông với đất ngoài khung: bản cũ đặt khung cao
  // hơn 6 cm với một vành tối 5 m ⇒ khung thành cái khay, thành phố thành sa bàn.
  pushGround(q(F, -0.06), hex2rgb("#5b5a50"), [0, 1, 0]);
  for (const band of [
    { x0: F.x0 - 3, x1: F.x1 + 3, z0: F.z0 - 3, z1: F.z0 },
    { x0: F.x0 - 3, x1: F.x1 + 3, z0: F.z1, z1: F.z1 + 3 },
    { x0: F.x0 - 3, x1: F.x0, z0: F.z0, z1: F.z1 },
    { x0: F.x1, x1: F.x1 + 3, z0: F.z0, z1: F.z1 },
  ]) pushGround(q(band, -0.05), hex2rgb("#6e6c60"), [0, 1, 0]);

  // Nước
  for (const w of city.water) pushGround(q(w, 0.06), hex2rgb("#12414d"), [0, 1, 0], { opacity: 0.96 });

  // Lòng đường + vỉa hè
  for (const s of city.streets) {
    const [ax, az] = s.points[0];
    const [bx, bz] = s.points[s.points.length - 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 4) continue;

    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    const nx = -uz;
    const nz = ux;
    const half = s.widthM / 2;
    const walkW = s.klass === "avenue" ? 3.2 : s.klass === "alley" ? 0.7 : 1.7;
    // Nhìn từ trên cao, đường phải TỐI hơn mái và vỉa hè phải SÁNG hơn mái thì mạng phố mới đọc
    // ra; bản cũ để ba tông xấp xỉ nhau nên nửa thành phố thành một khối liền.
    const road = world.aerial
      ? hex2rgb(s.klass === "alley" ? "#3b3946" : s.klass === "avenue" ? "#282731" : "#302f3a")
      : hex2rgb(s.klass === "alley" ? "#45424f" : s.klass === "avenue" ? "#3b3946" : "#403e4b");
    const kerb = hex2rgb(s.klass === "alley" ? "#7e7b88" : "#918e9b");
    pushGround([
      [ax + nx * half, 0.02, az + nz * half], [bx + nx * half, 0.02, bz + nz * half],
      [bx - nx * half, 0.02, bz - nz * half], [ax - nx * half, 0.02, az - nz * half],
    ], road, [0, 1, 0]);
    for (const side of [1, -1]) {
      const o = half + walkW / 2;
      pushGround([
        [ax + nx * o * side, 0.09, az + nz * o * side], [bx + nx * o * side, 0.09, bz + nz * o * side],
        [bx + nx * (o + walkW) * side, 0.09, bz + nz * (o + walkW) * side], [ax + nx * (o + walkW) * side, 0.09, az + nz * (o + walkW) * side],
      ], kerb, [0, 1, 0], { opacity: world.aerial ? 1 : 0.9 });
    }
    // Vết vá / khe bê tông: vài mảng sáng tối dọc mặt đường, rải theo vị trí nên tất định.
    if (!world.aerial) {
      for (let t = 2; t < len - 3; t += 6.5) {
        const hsh = Math.sin((ax + t) * 12.9898 + az * 78.233) * 43758.5453;
        const frac = hsh - Math.floor(hsh);
        if (frac < 0.55) continue;
        const w = 1.2 + frac * 2.4;
        const lat = (frac - 0.72) * (s.widthM - w) * 1.4;
        const x1 = ax + ux * t + nx * lat;
        const z1 = az + uz * t + nz * lat;
        pushGround([
          [x1 - nx * w / 2, 0.05, z1 - nz * w / 2], [x1 + ux * 2.6 - nx * w / 2, 0.05, z1 + uz * 2.6 - nz * w / 2],
          [x1 + ux * 2.6 + nx * w / 2, 0.05, z1 + uz * 2.6 + nz * w / 2], [x1 + nx * w / 2, 0.05, z1 + nz * w / 2],
        ], frac > 0.8 ? hex2rgb("#6e6b76") : hex2rgb("#31303a"), [0, 1, 0], { opacity: 0.5 });
      }
    }
    // Vạch tim đường cho đại lộ
    if (s.klass === "avenue" && !world.aerial) {
      for (let t = 0; t < len; t += 9) {
        const x1 = ax + ux * t, z1 = az + uz * t;
        const x2 = ax + ux * (t + 4.5), z2 = az + uz * (t + 4.5);
        pushGround([[x1, 0.03, z1], [x2, 0.03, z2], [x2 + nx * 0.5, 0.03, z2 + nz * 0.5], [x1 + nx * 0.5, 0.03, z1 + nz * 0.5]],
          hex2rgb("#c9b98a"), [0, 1, 0], { opacity: 0.5 });
      }
    }
  }

  // Sân chung: nền đất
  for (const block of city.blocks) for (const c of block.courts) pushGround(q(c, 0.07), hex2rgb("#4f4e42"), [0, 1, 0], { opacity: 0.8 });

  // --- toà nhà --------------------------------------------------------------------------------
  const near = (b: { x0: number; z0: number; x1: number; z1: number }) => {
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    return dist(cx, cz);
  };
  // --- hệ hình khối ---------------------------------------------------------------------------
  // Một toà nhà thật KHÔNG phải một hộp: nó là bệ + thân giật cấp + đỉnh kỹ thuật + chóp, hoặc
  // tường + mái dốc + tum + bồn nước. Ở đây mọi thứ được dựng từ hai thứ: `emitMass` (khối hộp có
  // mặt đứng chi tiết) và `emitPrism` (lăng trụ đa giác — vát góc, đổi mặt bằng theo tầng).
  type Body = { x0: number; x1: number; z0: number; z1: number };
  const nrm = (v: RGB): RGB => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  // Khí quyển nhẹ và ấm: bản cũ trộn tới 30 % xám-lạnh nên cả thành phố ra màu thạch cao xanh xám.
  const atmOf = (c: RGB, dm: number) => mix(c, hex2rgb("#6e6672"), Math.min(0.14, Math.max(0, (dm - 380) / 1500) * 0.14));

  interface MassStyle {
    detail?: "glass" | "floors" | "plain";
    parapet?: boolean;
    shopfront?: boolean; // tầng trệt là quán — đại lộ Sài Gòn nào cũng vậy, không riêng nhà ở
    awning?: boolean;    // mái hiên bạt nhô ra (chỉ nhà phố)
    shop?: string;
  }

  const emitMass = (r: Body, y0: number, y1: number, base: RGB, roofC: RGB, dm: number, st: MassStyle = {}) => {
    const rw = r.x1 - r.x0;
    const rd = r.z1 - r.z0;
    const rh = y1 - y0;
    if (rw < 0.08 || rd < 0.08 || rh < 0.08) return;
    const toCamM = P.toCam([(r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2]);
    const detail = st.detail ?? (rh > 26 ? "glass" : "floors");
    const sides: Array<{ n: RGB; quad: RGB[]; along: number; dir: number }> = [
      { n: [0, 0, -1], quad: [[r.x0, y0, r.z0], [r.x1, y0, r.z0], [r.x1, y1, r.z0], [r.x0, y1, r.z0]], along: rw, dir: -1 },
      { n: [0, 0, 1], quad: [[r.x1, y0, r.z1], [r.x0, y0, r.z1], [r.x0, y1, r.z1], [r.x1, y1, r.z1]], along: rw, dir: 1 },
      { n: [-1, 0, 0], quad: [[r.x0, y0, r.z1], [r.x0, y0, r.z0], [r.x0, y1, r.z0], [r.x0, y1, r.z1]], along: rd, dir: -1 },
      { n: [1, 0, 0], quad: [[r.x1, y0, r.z0], [r.x1, y0, r.z1], [r.x1, y1, r.z1], [r.x1, y1, r.z0]], along: rd, dir: 1 },
    ];
    const nearWall = !world.aerial && dm < 150;
    for (const side of sides) {
      const facing = side.n[0] * toCamM[0] + side.n[1] * toCamM[1] + side.n[2] * toCamM[2] < 0;
      if (!facing) continue;
      const along = side.along;
      const isXw = side.n[0] !== 0;
      const planeW = isXw ? (side.n[0] > 0 ? r.x1 : r.x0) : (side.n[2] > 0 ? r.z1 : r.z0);
      const s0w = isXw ? r.z0 : r.x0;
      const ow = 0.05;
      const seg = (t0: number, t1: number, ya: number, yb: number): RGB[] => {
        const p0 = s0w + along * t0;
        const p1 = s0w + along * t1;
        return isXw
          ? [[planeW + ow, ya, p0], [planeW + ow, ya, p1], [planeW + ow, yb, p1], [planeW + ow, yb, p0]]
          : [[p0, ya, planeW + ow], [p1, ya, planeW + ow], [p1, yb, planeW + ow], [p0, yb, planeW + ow]];
      };
      // Mỗi mặt tường không phải MỘT màu: chân tường tối (đất, ẩm, bóng hắt), lên cao dần sáng,
      // sát mái hơi ngả trời. Ba dải màu là đủ để mắt đọc ra khối thay vì tấm bìa tô phẳng.
      if (!nearWall) {
        push(side.quad, atmOf(base, dm), side.n);
      } else {
        const wallC = atmOf(base, dm);
        const bands = 9;
        for (let i = 0; i < bands; i += 1) {
          const ya = y0 + (rh * i) / bands;
          const yb = y0 + (rh * (i + 1)) / bands;
          const t = (i + 0.5) / bands;
          const f = 0.64 + 0.44 * Math.pow(t, 0.55);
          const grime = (1 - Math.pow(t, 0.7)) * 0.13;
          push(seg(0, 1, ya, yb), mix(mul(wallC, Math.min(1.12, f)), hex2rgb("#2c2a2c"), grime), side.n);
        }
      }
      if (detail === "plain") continue;
      if (world.aerial) {
        if (dm < 2600 && along > 2.2) {
          if (detail === "glass") {
            // Tháp kính: dải kính dọc (mullion) — thứ duy nhất đọc ra "nhà cao tầng" từ 1 km.
            const strips = Math.max(2, Math.min(5, Math.round(along / 5)));
            for (let i = 0; i < strips; i += 1) {
              const t0 = 0.08 + (i / strips) * 0.84;
              push(seg(t0, t0 + (0.84 / strips) * 0.55, y0 + rh * 0.06, y1 - rh * 0.05), mix(GLASS, base, 0.45), side.n, { opacity: 0.8 });
            }
          } else {
            const bands = Math.max(1, Math.min(5, Math.round(rh / 3.3) - 1));
            for (let i = 1; i <= bands; i += 1) {
              const y = y0 + (rh * i) / (bands + 1);
              push(seg(0.07, 0.93, y, y + Math.min(0.75, rh * 0.045)), mix(base, hex2rgb("#2b2a33"), 0.45), side.n, { opacity: 0.62 });
            }
          }
        }
        continue;
      }
      // --- tầm mắt 1,65 m ---
      if (dm > 190 && rh < 40) continue;
      if (detail === "glass") {
        // Nhà kính: lưới mullion dọc + dải sàn ngang. Thiếu lưới này thì tháp 30 tầng ở tầm mắt
        // chỉ là một tấm tường phẳng tô một màu.
        const mull = Math.max(2, Math.min(14, Math.round(along / 2.1)));
        for (let cIdx = 0; cIdx < mull; cIdx += 1) {
          const t0 = 0.02 + (cIdx / mull) * 0.96;
          push(seg(t0, t0 + 0.022, y0, y1), mix(GLASS, base, 0.5), side.n, { opacity: 0.8 });
        }
        const fl = Math.max(2, Math.min(26, Math.round(rh / 3.4)));
        for (let f = 1; f < fl; f += 1) {
          const yy = y0 + (rh * f) / fl;
          push(seg(0, 1, yy, yy + Math.min(0.4, (rh / fl) * 0.14)), mix(base, hex2rgb("#0c0e13"), 0.55), side.n, { opacity: 0.9 });
        }
        if (st.shopfront && y0 < 0.06) {
          const shopC = hex2rgb(st.shop ?? SHOP.default);
          push(seg(0.02, 0.98, 0.15, 3.1), mix(shopC, base, 0.4), side.n, { opacity: 0.95 });
          push(seg(0.05, 0.95, 3.2, 4.2), shopC, side.n);
        }
        continue;
      }
      const floorsHere = Math.max(1, Math.round(rh / 3.3));
      const fh = rh / floorsHere;
      for (let f = 1; f < floorsHere; f += 1) {
        const ya = y0 + f * fh + Math.min(1.05, fh * 0.3);
        const yb = Math.min(ya + Math.min(1.35, fh * 0.45), y1 - 0.35);
        if (yb <= ya) continue;
        if (dm < 130 && along > 3) {
          const cols = Math.max(1, Math.round(along / 2.5));
          for (let cIdx = 0; cIdx < cols; cIdx += 1) {
            push(seg(0.08 + (cIdx / cols) * 0.84, 0.08 + ((cIdx + 0.72) / cols) * 0.84, ya, yb),
              mix(mix(GLASS, hex2rgb("#9aaec6"), 0.12 + 0.5 * (f / floorsHere)), base, 0.16), side.n, { opacity: 0.94 });
          }
        } else {
          push(seg(0.06, 0.94, ya, yb), mix(mix(GLASS, hex2rgb("#9aaec6"), 0.12 + 0.5 * (f / floorsHere)), base, 0.14), side.n, { opacity: 0.92 });
        }
      }
      // Tầng trệt nhà phố: mặt tiền quán + tấm biển hiệu
      if (st.shopfront && y0 < 0.06 && rh > 3.2) {
        const shopC = hex2rgb(st.shop ?? SHOP.default);
        // Cửa cuốn: 3–6 tấm, tông xen kẽ, khe dọc — đọc ra mặt tiền quán chứ không ra tấm bê tông.
        const panels = Math.max(3, Math.min(6, Math.round(along / 2.6)));
        for (let i = 0; i < panels; i += 1) {
          const t0 = 0.04 + (i / panels) * 0.92;
          const t1 = 0.04 + ((i + 0.88) / panels) * 0.92;
          push(seg(t0, t1, 0.18, Math.min(2.8, y1 * 0.6)), mix(shopC, base, i % 2 ? 0.55 : 0.18), side.n, { opacity: 0.96 });
        }
        push(seg(0.05, 0.95, Math.min(2.9, y1 * 0.6), Math.min(3.75, y1 * 0.82)), shopC, side.n);
        if (dm < 80 && along > 5 && rh > 5) {
          const hs2 = Math.abs(Math.round(s0w * 13 + planeW * 7));
          const p0 = s0w + along * (0.15 + ((hs2 % 60) / 100));
          const ya = 3.5;
          const yb = Math.min(y1 - 0.4, 5.2);
          const out = 0.85;
          const face = (dz: number): RGB[] => isXw
            ? [[planeW, ya, p0 + dz], [planeW + side.dir * out, ya, p0 + dz], [planeW + side.dir * out, yb, p0 + dz], [planeW, yb, p0 + dz]]
            : [[p0 + dz, ya, planeW], [p0 + dz, ya, planeW + side.dir * out], [p0 + dz, yb, planeW + side.dir * out], [p0 + dz, yb, planeW]];
          push(face(0), shopC, isXw ? [0, 0, -1] : [-1, 0, 0]);
          push(face(1.5), mul(shopC, 0.82), isXw ? [0, 0, 1] : [1, 0, 0]);
          // mặt dưới + cạnh trên: một tấm biển dày 0,12 m
          const topQ: RGB[] = isXw
            ? [[planeW, yb, p0], [planeW + side.dir * out, yb, p0], [planeW + side.dir * out, yb, p0 + 1.5], [planeW, yb, p0 + 1.5]]
            : [[p0, yb, planeW], [p0 + 1.5, yb, planeW], [p0 + 1.5, yb, planeW + side.dir * out], [p0, yb, planeW + side.dir * out]];
          push(topQ, mul(shopC, 1.15), [0, 1, 0]);
        }
      }
      // Mái hiên nhô 0,9 m — nhịp điệu đặc trưng của phố Sài Gòn
      if (st.awning && dm < 140 && y0 < 0.06 && rh > 4.6 && rh < 26) {
        const y = 4.05;
        const p0 = s0w + along * 0.04;
        const p1 = s0w + along * 0.96;
        const aw: RGB[] = isXw
          ? [[planeW, y, p0], [planeW, y, p1], [planeW + side.dir * 0.9, y + 0.18, p1], [planeW + side.dir * 0.9, y + 0.18, p0]]
          : [[p0, y, planeW], [p1, y, planeW], [p1, y + 0.18, planeW + side.dir * 0.9], [p0, y + 0.18, planeW + side.dir * 0.9]];
        push(aw, mix(hex2rgb("#b8452f"), hex2rgb("#2f6b7a"), (Math.abs(Math.round(r.x0 * 7 + r.z0 * 13)) % 5) / 5), nrm([0, 1, 0]));
      }
    }
    // Mái bằng + gờ parapet
    push([[r.x0, y1, r.z0], [r.x1, y1, r.z0], [r.x1, y1, r.z1], [r.x0, y1, r.z1]], atmOf(roofC, dm), [0, 1, 0]);
    if (st.parapet && rh > 6 && rw > 5 && rd > 5) {
      const inx = Math.min(1.1, rw * 0.1);
      const inz = Math.min(1.1, rd * 0.1);
      push([
        [r.x0 + inx, y1 + 0.03, r.z0 + inz], [r.x1 - inx, y1 + 0.03, r.z0 + inz],
        [r.x1 - inx, y1 + 0.03, r.z1 - inz], [r.x0 + inx, y1 + 0.03, r.z1 - inz],
      ], mix(atmOf(roofC, dm), hex2rgb("#20202a"), 0.28), [0, 1, 0], { opacity: 0.9 });
    }
  };

  // Lăng trụ đa giác: mặt bằng vát góc / đổi hình theo tầng. Đây là thứ phá vỡ "khối hộp".
  const emitPrism = (poly: Array<[number, number]>, y0: number, y1: number, base: RGB, roofC: RGB, dm: number, st: MassStyle = {}) => {
    const rh = y1 - y0;
    if (rh < 0.1) return;
    const cx = poly.reduce((s2, p) => s2 + p[0], 0) / poly.length;
    const cz = poly.reduce((s2, p) => s2 + p[1], 0) / poly.length;
    const toCam = P.toCam([cx, (y0 + y1) / 2, cz]);
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b2 = poly[(i + 1) % poly.length];
      const ex = b2[0] - a[0];
      const ez = b2[1] - a[1];
      const len = Math.hypot(ex, ez);
      if (len < 0.05) continue;
      const n: RGB = [ez / len, 0, -ex / len];
      if (n[0] * toCam[0] + n[2] * toCam[2] >= 0) continue;
      push([[a[0], y0, a[1]], [b2[0], y0, b2[1]], [b2[0], y1, b2[1]], [a[0], y1, a[1]]], atmOf(base, dm), n);
      if (st.detail === "plain" || len < 2.2) continue;
      const near2 = world.aerial ? dm < 2600 : dm < 220;
      if (!near2) continue;
      const strips = Math.max(1, Math.min(3, Math.round(len / 6)));
      for (let k = 0; k < strips; k += 1) {
        const t0 = 0.1 + (k / strips) * 0.8;
        const t1 = t0 + (0.8 / strips) * 0.52;
        const o2 = 0.07;
        const q0x = a[0] + ex * t0 + n[0] * o2;
        const q0z = a[1] + ez * t0 + n[2] * o2;
        const q1x = a[0] + ex * t1 + n[0] * o2;
        const q1z = a[1] + ez * t1 + n[2] * o2;
        const ya = y0 + rh * 0.07;
        const yb = y1 - rh * 0.06;
        push([[q0x, ya, q0z], [q1x, ya, q1z], [q1x, yb, q1z], [q0x, yb, q0z]], mix(GLASS, base, 0.42), n, { opacity: 0.82 });
      }
    }
    // Mái (đa giác lồi)
    push(poly.map((p) => [p[0], y1, p[1]] as RGB), atmOf(roofC, dm), [0, 1, 0]);
  };

  const insetBody = (r: Body, k: number): Body => {
    const ix = Math.min((r.x1 - r.x0) * k, (r.x1 - r.x0) / 2 - 1.5);
    const iz = Math.min((r.z1 - r.z0) * k, (r.z1 - r.z0) / 2 - 1.5);
    return { x0: r.x0 + Math.max(0, ix), x1: r.x1 - Math.max(0, ix), z0: r.z0 + Math.max(0, iz), z1: r.z1 - Math.max(0, iz) };
  };

  // Mặt bằng vát góc: hình chữ nhật cắt 4 góc. Vát 10 % mỗi góc là đủ để silhouette không còn
  // là "hộp chữ nhật dựng đứng".
  const chamfer = (r: Body, k: number): Array<[number, number]> => {
    const c = Math.min((r.x1 - r.x0), (r.z1 - r.z0)) * k;
    return [
      [r.x0 + c, r.z0], [r.x1 - c, r.z0], [r.x1, r.z0 + c], [r.x1, r.z1 - c],
      [r.x1 - c, r.z1], [r.x0 + c, r.z1], [r.x0, r.z1 - c], [r.x0, r.z0 + c],
    ];
  };

  const oct8 = (cx: number, cz: number, r: number): Array<[number, number]> => {
    const k = 0.7071;
    return [
      [cx + r, cz], [cx + r * k, cz + r * k], [cx, cz + r], [cx - r * k, cz + r * k],
      [cx - r, cz], [cx - r * k, cz - r * k], [cx, cz - r], [cx + r * k, cz - r * k],
    ];
  };

  // Mái ngói dốc hai mái (nhà ống, chợ): sống nóc ở giữa, hai mặt dốc + hàng ngói.
  const emitGable = (r: Body, y: number, rise: number, roofC: RGB, dm: number, axis: "x" | "z") => {
    const tile = atmOf(mix(roofC, hex2rgb("#b4562f"), 0.35), dm);
    const dark = mix(tile, hex2rgb("#3a2018"), 0.4);
    const ridge = mix(tile, hex2rgb("#ffffff"), 0.08);
    if (axis === "x") {
      const zm = (r.z0 + r.z1) / 2;
      const nS = nrm([0, 1, -1]);
      const nN = nrm([0, 1, 1]);
      push([[r.x0, y, r.z0], [r.x1, y, r.z0], [r.x1, y + rise, zm], [r.x0, y + rise, zm]], tile, nS);
      push([[r.x1, y, r.z1], [r.x0, y, r.z1], [r.x0, y + rise, zm], [r.x1, y + rise, zm]], tile, nN);
      for (let i = 1; i <= 3; i += 1) {
        const t0 = i / 4;
        const t1 = t0 + 0.05;
        const yy0 = y + rise * t0 + 0.02;
        const yy1 = y + rise * t1 + 0.02;
        const za = zm - (zm - r.z0) * (1 - t0);
        const zb = zm - (zm - r.z0) * (1 - t1);
        push([[r.x0 + 0.3, yy0, za], [r.x1 - 0.3, yy0, za], [r.x1 - 0.3, yy1, zb], [r.x0 + 0.3, yy1, zb]], dark, nS, { opacity: 0.45 });
        const zc = zm + (r.z1 - zm) * (1 - t0);
        const zd = zm + (r.z1 - zm) * (1 - t1);
        push([[r.x1 - 0.3, yy0, zc], [r.x0 + 0.3, yy0, zc], [r.x0 + 0.3, yy1, zd], [r.x1 - 0.3, yy1, zd]], dark, nN, { opacity: 0.45 });
      }
      // sống nóc + đầu hồi hai bên
      push([[r.x0, y + rise - 0.06, zm - 0.25], [r.x1, y + rise - 0.06, zm - 0.25], [r.x1, y + rise + 0.1, zm], [r.x0, y + rise + 0.1, zm]], ridge, nN);
      push([[r.x0, y, r.z0], [r.x0, y, r.z1], [r.x0, y + rise, zm]], mix(tile, hex2rgb("#000000"), 0.12), nrm([-1, 0, 0]));
      push([[r.x1, y, r.z1], [r.x1, y, r.z0], [r.x1, y + rise, zm]], mix(tile, hex2rgb("#000000"), 0.12), nrm([1, 0, 0]));
    } else {
      const xm = (r.x0 + r.x1) / 2;
      const nW = nrm([-1, 1, 0]);
      const nE = nrm([1, 1, 0]);
      push([[r.x0, y, r.z1], [r.x0, y, r.z0], [xm, y + rise, r.z0], [xm, y + rise, r.z1]], tile, nW);
      push([[r.x1, y, r.z0], [r.x1, y, r.z1], [xm, y + rise, r.z1], [xm, y + rise, r.z0]], tile, nE);
      for (let i = 1; i <= 3; i += 1) {
        const t0 = i / 4;
        const t1 = t0 + 0.05;
        const yy0 = y + rise * t0 + 0.02;
        const yy1 = y + rise * t1 + 0.02;
        const xa = xm - (xm - r.x0) * (1 - t0);
        const xb = xm - (xm - r.x0) * (1 - t1);
        push([[xa, yy0, r.z0 + 0.3], [xa, yy0, r.z1 - 0.3], [xb, yy1, r.z1 - 0.3], [xb, yy1, r.z0 + 0.3]], dark, nW, { opacity: 0.45 });
        const xc = xm + (r.x1 - xm) * (1 - t0);
        const xd = xm + (r.x1 - xm) * (1 - t1);
        push([[xc, yy0, r.z1 - 0.3], [xc, yy0, r.z0 + 0.3], [xd, yy1, r.z0 + 0.3], [xd, yy1, r.z1 - 0.3]], dark, nE, { opacity: 0.45 });
      }
      push([[xm - 0.25, y + rise - 0.06, r.z0], [xm - 0.25, y + rise - 0.06, r.z1], [xm, y + rise + 0.1, r.z1], [xm, y + rise + 0.1, r.z0]], ridge, nE);
      push([[r.x0, y, r.z0], [r.x0, y, r.z1], [xm, y + rise, r.z1]], mix(tile, hex2rgb("#000000"), 0.12), nrm([0, 0, 1]));
      push([[r.x1, y, r.z1], [r.x1, y, r.z0], [xm, y + rise, r.z0]], mix(tile, hex2rgb("#000000"), 0.12), nrm([0, 0, -1]));
    }
  };

  const buildings = city.buildings
    .filter((b) => !b.walkable)
    .map((b) => ({ b, d: near(b) }))
    .sort((p, q2) => q2.d - p.d); // vẽ xa trước

  for (const item of buildings) {
    const b = item.b;
    const dm = item.d;
    const district = city.districts.find((dd) => dd.id === b.district);
    const palette = WALL[district?.klass ?? "residential"] ?? WALL.residential;
    const seed = Number.isFinite(b.x0 + b.z0) ? Math.abs(Math.round(b.x0 * 7919 + b.z0 * 104729)) % palette.length : 0;
    const glassy = (item as { b: { glass?: boolean } }).b.glass === true;
    const rawBase = hex2rgb(glassy ? "#a3b6c6" : b.anchor ? "#9aa3ad" : palette[seed] ?? "#8a8578");
    // Lệch tông nhẹ theo toà: đá, sơn, gạch men — cùng một bảng màu nhưng không toà nào trùng toà
    // nào. Thiếu bước này thì cả dãy phố là một tấm bê tông.
    const tintSeed = Math.abs(Math.round(b.x1 * 31 + b.z1 * 17 + b.heightM * 7)) % 100 / 100;
    const base = mix(rawBase, tintSeed > 0.55 ? hex2rgb("#e5d3ae") : hex2rgb("#5f6a74"), Math.abs(tintSeed - 0.5) * 0.16);
    const h = b.heightM;
    const roofC = hex2rgb(b.kind === "market" ? "#8b6a52" : b.floors <= 2 ? ROOF[seed % ROOF.length] : "#6d6a72");
    const w = b.x1 - b.x0;
    const dd = b.z1 - b.z0;
    const klass = district?.klass ?? "residential";

    // Bóng đổ: hình chiếu của hộp nhà theo hướng nắng. Ở tầm mắt bóng CHÍNH LÀ thứ làm phố có
    // chiều sâu — thiếu nó, mặt đường và mặt tường sáng đều nhau và cả cảnh ra hình phẳng.
    {
      const k = h / sun[1];
      const sx = -sun[0] * k;
      const sz = -sun[2] * k;
      pushShadow([[b.x0, 0.01, b.z0], [b.x1, 0.01, b.z0], [b.x1, 0.01, b.z1], [b.x0, 0.01, b.z1]]);
      pushShadow([
        [b.x0 + sx, 0.01, b.z0 + sz], [b.x1 + sx, 0.01, b.z0 + sz],
        [b.x1 + sx, 0.01, b.z1 + sz], [b.x0 + sx, 0.01, b.z1 + sz],
      ]);
    }

    const body: Body = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
    const shopC = SHOP[b.kind] ?? SHOP.default;
    const street = klass === "residential" || klass === "market";

    // --- phân loại công trình -----------------------------------------------------------------
    // Tháp văn phòng/khách sạn: bệ + thân giật ba cấp (vát góc) + đỉnh kỹ thuật + chóp.
    // Nhà ống: một khối + mái ngói dốc (một nửa) hoặc mái bằng có sân thượng, bồn nước.
    // Chợ: nhà lớn một tầng + mái ngói dốc có hàng cửa gió.
    // Landmark 81: một tháp DUY NHẤT, thân vuông vát góc, đỉnh giật thành bậc như bản thật. Ba
    // tháp mảnh đứng cạnh nhau trên lô 44 m đọc ra ba cây kim, không ra toà nhà.
    if (b.anchor === "landmark81") {
      const podH = 26;
      emitMass(body, 0, podH, base, roofC, dm, { detail: "glass", parapet: true });
      // Thân LIỀN từ đế lên 90 % chiều cao: năm bậc thụt xếp chồng đọc ra chồng bánh xếp, không ra
      // tháp. Chỉ giật hai bậc ngắn ở đỉnh + hộp kỹ thuật, như bản thật.
      emitPrism(chamfer(insetBody(body, 0.015), 0.1), podH, h * 0.9, base, roofC, dm, { detail: "glass" });
      emitPrism(chamfer(insetBody(body, 0.055), 0.13), h * 0.9, h * 0.965, base, mix(roofC, base, 0.55), dm, { detail: "glass" });
      emitMass(insetBody(body, 0.14), h * 0.965, h, mix(roofC, hex2rgb("#22242c"), 0.3), roofC, dm, { detail: "plain", parapet: true });
    }
    const isTower = !b.anchor && b.floors >= 9 && w > 7.5 && dd > 7.5;
    const anchorTower = b.anchor === "bitexco";
    if ((isTower || anchorTower) && b.anchor !== "landmark81") {
      const minSide = Math.min(w, dd);
      const podH = Math.min(18, Math.max(9, h * 0.16));
      emitMass(body, 0, podH, base, roofC, dm, { detail: "floors", parapet: true, shopfront: true, shop: shopC });
      // Thân: hai tới ba cấp thụt dần, mặt bằng vát góc. Độ thụt phải CO THEO BỀ RỘNG — tháp 9 m
      // thụt 20 % thành cây kim 5 m cao 120 m, đúng kiểu "khối hình học" cần tránh.
      const wide = minSide >= 14;
      const shaftTop = podH + (h - podH) * (wide ? 0.62 : 0.8);
      emitPrism(chamfer(insetBody(body, wide ? 0.05 : 0.025), 0.09), podH, shaftTop, base, roofC, dm, { detail: "glass" });
      if (wide) {
        const t2 = podH + (h - podH) * 0.87;
        emitPrism(chamfer(insetBody(body, 0.11), 0.11), shaftTop, t2, mix(base, hex2rgb("#e8eef2"), 0.05), roofC, dm, { detail: "glass" });
        emitMass(insetBody(body, 0.165), t2, h, mix(roofC, hex2rgb("#1d1d26"), 0.4), roofC, dm, { detail: "plain", parapet: true });
      } else {
        emitMass(insetBody(body, 0.1), shaftTop, h, mix(roofC, hex2rgb("#1d1d26"), 0.4), roofC, dm, { detail: "plain", parapet: true });
      }
    }
    // Bitexco: sân bay trực thăng nhô ra khỏi thân ở 85 % độ cao (bản thật có, và nó là thứ duy
    // nhất làm toà nhà này khác mọi tháp kính khác).
    if (b.anchor === "bitexco") {
      const y = h * 0.855;
      const pad = { x0: b.x1 - 5, x1: b.x1 + 4.5, z0: (b.z0 + b.z1) / 2 - 4.5, z1: (b.z0 + b.z1) / 2 + 4.5 };
      emitMass(pad, y, y + 0.9, mix(hex2rgb("#3d4048"), base, 0.2), roofC, dm, { detail: "plain" });
      emitMass({ x0: pad.x1 - 1.2, x1: pad.x1, z0: pad.z0 + 1.2, z1: pad.z1 - 1.2 }, y + 0.9, y + 1.5,
        mix(hex2rgb("#c9c2b2"), base, 0.3), roofC, dm, { detail: "plain" });
    }
    if (!isTower && !anchorTower && b.anchor !== "landmark81") {
      // Thân chính. Nhà 1–2 tầng giữ mặt đứng phẳng (tường + cửa cuốn); từ 3 tầng có dải tầng.
      emitMass(body, 0, h, base, roofC, dm, {
        detail: b.floors >= 3 ? "floors" : "plain",
        parapet: true,
        shopfront: true,
        awning: street,
        shop: shopC,
      });
      // Mái: nhà phố Sài Gòn phần lớn là mái ngói dốc hoặc mái bằng có tum. Cả thành phố mái bằng
      // là thứ làm ảnh trên cao đọc ra "các khối hộp xếp cạnh nhau".
      const gable = street && b.floors <= 4 && w > 3 && dd > 3 && (seed + b.floors) % 3 !== 0;
      if (gable) {
        const rise = Math.min(2.6, Math.min(w, dd) * 0.22);
        emitGable(body, h, rise, mix(roofC, hex2rgb("#b4562f"), 0.5), dm, w >= dd ? "x" : "z");
        // tum thang + bồn nước sau nóc (nhà ống nào cũng có)
        if (w > 4.2 && dd > 4.2 && b.floors >= 2) {
          const t = { x0: b.x0 + w * 0.62, x1: b.x0 + w * 0.62 + Math.min(2.3, w * 0.22), z0: b.z0 + dd * 0.3, z1: b.z0 + dd * 0.3 + Math.min(2.1, dd * 0.2) };
          emitMass(t, h, h + 2.3, mix(base, hex2rgb("#ffffff"), 0.12), roofC, dm, { detail: "plain" });
          const r = Math.min(0.8, Math.min(w, dd) * 0.14);
          const cx = t.x0 + (t.x1 - t.x0) / 2;
          const cz = t.z1 + Math.max(0.9, dd * 0.1);
          emitMass({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r }, h + 2.3, h + 2.3 + r * 1.9,
            mix(hex2rgb("#c9cdd2"), base, 0.25), roofC, dm, { detail: "plain" });
        }
      } else if (w > 13 && dd > 13 && b.floors <= 4) {
        // Chợ/kho/xưởng mái tôn: gân tôn + hai hàng cửa gió trên nóc.
        const ribs = Math.max(4, Math.min(11, Math.round(dd / 3.2)));
        const rh = h + 0.02;
        for (let i = 0; i < ribs; i += 1) {
          const z0r = b.z0 + (dd * i) / ribs;
          const z1r = b.z0 + (dd * (i + 0.55)) / ribs;
          push([[b.x0 + 0.4, rh, z0r], [b.x1 - 0.4, rh, z0r], [b.x1 - 0.4, rh, z1r], [b.x0 + 0.4, rh, z1r]],
            mix(atmOf(roofC, dm), hex2rgb(i % 2 ? "#ffffff" : "#101018"), i % 2 ? 0.13 : 0.16), [0, 1, 0], { opacity: 0.85 });
        }
        const vents = Math.max(2, Math.round(w / 9));
        for (let i = 0; i < vents; i += 1) {
          const cx = b.x0 + (w * (i + 0.5)) / vents;
          emitMass({ x0: cx - 1.1, x1: cx + 1.1, z0: (b.z0 + b.z1) / 2 - 1.4, z1: (b.z0 + b.z1) / 2 + 1.4 },
            h, h + 1.5, mix(base, hex2rgb("#ffffff"), 0.2), roofC, dm, { detail: "plain" });
        }
      } else if (!b.anchor && b.floors >= 2 && b.floors <= 6 && w > 3 && dd > 3 && (!world.aerial ? dm < 160 : dm < 420)) {
        // Bồn nước inox trên mái — chi tiết nhìn từ trên cao, rất Sài Gòn.
        const cx = b.x0 + w * 0.28;
        const cz = b.z0 + dd * 0.62;
        const r = Math.min(0.85, Math.min(w, dd) * 0.16);
        emitMass({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r }, h, h + r * 1.7,
          mix(hex2rgb("#c9cdd2"), base, 0.25), roofC, dm, { detail: "plain" });
      }
    }
  }

  // --- biển hiệu có tên thật ------------------------------------------------------------------
  if (world.aerial === false) {
    const shops = city.pois
      .filter((p) => p.tier === "shop")
      .map((p) => ({ p, d: dist(p.x, p.z) }))
      .filter(({ d }) => d < 34)
      .sort((a, b) => a.d - b.d);
    const placed: Array<[number, number]> = [];
    for (const { p, d } of shops) {
      if (texts.length >= 7) break;
      const s = P.screenOf([p.x, 3.25, p.z]);
      if (!s) continue;
      if (s[0] < 60 || s[0] > cam.w - 60 || s[1] < 90 || s[1] > cam.h - 90) continue;
      if (placed.some(([x, y]) => Math.abs(x - s[0]) < 150 && Math.abs(y - s[1]) < 34)) continue;
      placed.push(s);
      texts.push({ x: s[0], y: s[1], size: Math.max(9, Math.min(22, 210 / Math.max(5, d))), fill: "#fff1d0", text: p.name, anchor: "middle", rotate: 0 });
    }
  }

  // --- dây điện: đặc sản Sài Gòn, và cũng là thứ cho biết "đây là hẻm" ------------------------
  if (!world.aerial) {
    for (const s of city.streets) {
      if (s.klass === "avenue") continue;
      const [ax, az] = s.points[0];
      const [bx, bz] = s.points[s.points.length - 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 12) continue;
      const mid = [(ax + bx) / 2, (az + bz) / 2] as const;
      if (dist(mid[0], mid[1]) > 150) continue;
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      const nx = -uz;
      const nz = ux;
      const off = s.widthM / 2 + (s.klass === "alley" ? 0.5 : 1.9);
      for (let t = 4; t < len - 8; t += 26) {
        for (let k = 0; k < 3; k += 1) {
          const y0 = 5.4 + k * 0.42;
          const pts: RGB[] = [];
          for (let i = 0; i <= 7; i += 1) {
            const tt = t + (i / 7) * 26;
            const sag = Math.sin((i / 7) * Math.PI) * 0.55;
            pts.push([ax + ux * tt + nx * off, y0 - sag, az + uz * tt + nz * off]);
          }
          const proj = pts.map((p) => P.screenOf(p)).filter((p): p is [number, number] => !!p);
          if (proj.length < 2) continue;
          faces.push({
            pts: proj,
            fill: "none",
            depth: 0,
            stroke: "rgba(18,16,20,0.75)",
            width: Math.max(0.6, 12 / Math.max(8, dist(pts[0][0], pts[0][2]))),
          });
        }
      }
    }
  }

  // --- vật thể vỉa hè -------------------------------------------------------------------------
  for (const pr of city.props) {
    const d = dist(pr.x, pr.z);
    if (d > (world.aerial ? 300 : 95)) continue;
    const c = hex2rgb(
      pr.kind === "tree" ? "#4b6f45" : pr.kind === "moto" ? "#5a5f6a" : pr.kind === "lamp" ? "#8a8f96"
        : pr.kind === "bin" ? "#4a5a4a" : pr.kind === "stall" ? "#b06a4a" : pr.kind === "tank" ? "#9aa2a8"
          : pr.kind === "clothes" ? "#96a0ad" : pr.kind === "sign" ? "#c9a04a" : "#7a7f86",
    );
    const hgt = pr.kind === "tree" ? 4.2 : pr.kind === "lamp" ? 4.6 : pr.kind === "moto" ? 1.05 : pr.kind === "stall" ? 2.1 : 0.9;
    const rad = pr.kind === "tree" ? 1.5 : pr.kind === "lamp" ? 0.12 : 0.42;
    const trunk = pr.kind === "tree" ? 1.9 : 0;
    if (pr.kind === "tree") {
      // Cây: thân tròn + ba tầng tán bát giác thu nhỏ. Một hộp vuông 3 m là hình khối đọc ra
      // "khối lập phương" rõ nhất trong cảnh — mắt nhận ra ngay.
      emitPrism(oct8(pr.x, pr.z, 0.24), 0, 2.05, hex2rgb("#584330"), hex2rgb("#584330"), d, { detail: "plain" });
      const greens = ["#557a4a", "#456a41", "#628a52"];
      const tiers: Array<[number, number, number]> = [[1.6, 1.95, 3.35], [1.28, 3.15, 4.15], [0.88, 3.95, 4.75]];
      tiers.forEach(([rr, ya, yb], i) => {
        emitPrism(oct8(pr.x, pr.z, rr), ya, yb, hex2rgb(greens[i % 3]), hex2rgb(greens[(i + 1) % 3]), d, { detail: "plain" });
      });
      continue;
    }
    if (trunk) {
      push([[pr.x - 0.16, 0, pr.z - 0.16], [pr.x + 0.16, 0, pr.z - 0.16], [pr.x + 0.16, trunk, pr.z - 0.16], [pr.x - 0.16, trunk, pr.z - 0.16]], hex2rgb("#4a3a2c"), [0, 0, -1]);
    }
    const y0 = trunk;
    const y1 = trunk + (hgt - trunk);
    const cc = mul(c, world.aerial ? 0.95 : 1);
    // tán lá / thân xe: hộp thay cho hình trụ — đủ ở tỉ lệ này
    push([[pr.x - rad, y0, pr.z - rad], [pr.x + rad, y0, pr.z - rad], [pr.x + rad, y1, pr.z - rad], [pr.x - rad, y1, pr.z - rad]], cc, [0, 0, -1]);
    push([[pr.x - rad, y1, pr.z - rad], [pr.x + rad, y1, pr.z - rad], [pr.x + rad, y1, pr.z + rad], [pr.x - rad, y1, pr.z + rad]], mul(cc, 1.1), [0, 1, 0]);
    push([[pr.x + rad, y0, pr.z - rad], [pr.x + rad, y0, pr.z + rad], [pr.x + rad, y1, pr.z + rad], [pr.x + rad, y1, pr.z - rad]], mul(cc, 0.82), [1, 0, 0]);
  }

  // Nhãn: ở ảnh trên cao là tên phường + mốc thật; ở tầm mắt là tên quán (đã thêm bên trên).
  if (world.aerial) {
    for (const d of city.districts) {
      const tile = d.tiles[0];
      const p = P.screenOf([(tile.x0 + tile.x1) / 2, 6, (tile.z0 + tile.z1) / 2]);
      if (p) texts.push({ x: p[0], y: p[1], size: 20, fill: "#efe6ff", text: d.ward, anchor: "middle", rotate: 0 });
    }
    for (const a of city.anchors) {
      if (a.kind === "home") continue;
      const p = P.screenOf([a.x, Math.max(6, Math.min(a.heightM, 120)), a.z]);
      if (p) texts.push({ x: p[0] + 8, y: p[1] - 6, size: 15, fill: "#ffe6a8", text: a.name, anchor: "start", rotate: 0 });
    }
  }

  // Nhãn đè nhau: giữ nhãn lớn, đẩy nhãn nhỏ xuống vài bước, không được thì bỏ. Ảnh axon từng có
  // "Chợ Bến Thành", "Ga Metro Bến Thành", "Phường Bến Thành" chồng lên nhau ở giữa khung.
  {
    const placed: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
    const kept: typeof texts = [];
    for (const t of texts.slice().sort((p, q) => q.size - p.size)) {
      const wText = t.text.length * t.size * 0.56;
      let ok = false;
      for (let attempt = 0; attempt < 4 && !ok; attempt += 1) {
        const y = t.y + attempt * t.size * 1.35;
        const box = {
          x0: t.anchor === "middle" ? t.x - wText / 2 : t.x,
          x1: t.anchor === "middle" ? t.x + wText / 2 : t.x + wText,
          y0: y - t.size,
          y1: y + t.size * 0.3,
        };
        if (!placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) {
          placed.push(box);
          kept.push({ ...t, y });
          ok = true;
        }
      }
    }
    texts.length = 0;
    texts.push(...kept);
  }
  return { faces, ground, shadows, texts, shadowOpacity: world.aerial ? 0.52 : 0.34 };
};

// --- khung hình -------------------------------------------------------------------------------
const ROOM = city.anchors.find((a) => a.id === "room") ?? { x: 0, z: 0 };
const streetByName = (re: RegExp, klass?: string) =>
  city.streets.find((s) => re.test(s.name) && (!klass || s.klass === klass)) ?? null;

/** Đặt camera trên một tuyến: cách đầu tuyến `t` mét, cao `y`, nhìn dọc tuyến. */
const onStreet = (street: NonNullable<ReturnType<typeof streetByName>>, t: number, y: number, opts: { w: number; h: number; fov: number; pitch?: number; flip?: boolean }) => {
  const [ax, az] = street.points[0];
  const [bx, bz] = street.points[street.points.length - 1];
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len;
  const uz = (bz - az) / len;
  const sign = opts.flip ? -1 : 1;
  const x = ax + ux * t;
  const z = az + uz * t;
  return {
    x, y, z,
    yaw: Math.atan2(ux * sign, uz * sign),
    pitch: opts.pitch ?? 0,
    fov: opts.fov, w: opts.w, h: opts.h,
  } satisfies Camera;
};

/** Canh camera tự động: lùi dần theo hướng nhìn tới khi mọi điểm cần thấy nằm trong khung. */
const fitCamera = (opts: {
  target: RGB; yaw: number; pitch: number; fov: number; w: number; h: number;
  points: RGB[]; margin: number; start?: number;
}) => {
  const probe: Camera = { x: 0, y: 0, z: 0, yaw: opts.yaw, pitch: opts.pitch, fov: opts.fov, w: opts.w, h: opts.h };
  const dir = basisOf(probe).fwd;
  const fits = (distance: number) => {
    const cam: Camera = {
      ...probe,
      x: opts.target[0] - dir[0] * distance,
      y: opts.target[1] - dir[1] * distance,
      z: opts.target[2] - dir[2] * distance,
    };
    const P = makeProjector(cam);
    return opts.points.every((p) => {
      const s = P.screenOf(p);
      return !!s && s[0] > opts.margin && s[0] < opts.w - opts.margin && s[1] > opts.margin && s[1] < opts.h - opts.margin;
    });
  };
  let lo = opts.start ?? 120;
  let hi = 6000;
  if (!fits(hi)) return { ...probe, x: opts.target[0] - dir[0] * hi, y: opts.target[1] - dir[1] * hi, z: opts.target[2] - dir[2] * hi } as Camera;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid; else lo = mid;
  }
  return { ...probe, x: opts.target[0] - dir[0] * hi, y: opts.target[1] - dir[1] * hi, z: opts.target[2] - dir[2] * hi } as Camera;
};

const W = 1600;
const H = 1000;

// Hẻm Chợ Lớn: chọn hẻm có nhiều nhà nhất trong bán kính 40 m.
const hemScore = city.streets
  .filter((s) => s.klass === "alley")
  .map((s) => {
    const [ax, az] = s.points[0];
    const [bx, bz] = s.points[s.points.length - 1];
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const n = city.buildings.filter((b) => !b.walkable && Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz) < 34).length;
    return { s, n, cx, cz };
  })
  .sort((a, b) => b.n - a.n)[0];

const avenue = streetByName(/Nguyễn Huệ|Lê Lợi/, "avenue") ?? city.streets.find((s) => s.klass === "avenue")!;
const market = city.anchors.find((a) => a.id === "binh-tay")!;
const marketStreet = city.streets
  .filter((s) => s.klass !== "alley")
  .map((s) => ({ s, d: Math.hypot((s.points[0][0] + s.points[s.points.length - 1][0]) / 2 - market.x, (s.points[0][1] + s.points[s.points.length - 1][1]) / 2 - market.z) }))
  .sort((a, b) => a.d - b.d)[0].s;

// Camera tầm mắt từng bị đặt ngay trong một tấm vải phơi / sát bức tường, cho ra khung hình nửa
// màn hình là một mảng phẳng. Ảnh "nhìn" phải là ảnh NGƯỜI ĐI ĐƯỢC ở đó, nên mỗi camera phải
// lùi ra chỗ trống trước khi chụp.
const solidNear = (x: number, z: number, pad: number) =>
  city.buildings.some((b) => !b.walkable && x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);
const clearEye = (x: number, z: number) =>
  isWalkable(city, x, z) && !solidNear(x, z, 1.2) && !city.props.some((pr) => Math.hypot(pr.x - x, pr.z - z) < 1.3);
const nudge = (cam: Camera): Camera => {
  if (clearEye(cam.x, cam.z)) return cam;
  for (let r = 0.5; r <= 6; r += 0.5) {
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * Math.PI * 2;
      const x = cam.x + Math.cos(a) * r;
      const z = cam.z + Math.sin(a) * r;
      if (clearEye(x, z)) return { ...cam, x, z };
    }
  }
  return cam;
};

const shots: Record<string, () => { cam: Camera; title: string; sub: string; aerial: boolean }> = {
  axon: () => ({
    cam: fitCamera({
      target: [(F.x0 + F.x1) / 2, 40, (F.z0 + F.z1) / 2],
      yaw: Math.atan2(-0.52, -0.86),
      pitch: (-32 * Math.PI) / 180,
      fov: 32, w: 2200, h: 1400, margin: 40,
      points: [
        [F.x0, 0, F.z0], [F.x1, 0, F.z0], [F.x1, 0, F.z1], [F.x0, 0, F.z1],
        [F.x0, 0, F.z1], [F.x1, 461, F.z0], [F.x0, 461, F.z0],
      ] as RGB[],
    }),
    title: "Sài Gòn 2026 — nhìn từ trên cao",
    sub: `${city.buildings.length} toà · ${city.pois.length} POI · khung 1.220×790 m · nắng chiều đổ bóng`,
    aerial: true,
  }),
  hem: () => {
    const s = hemScore.s;
    return {
      cam: nudge(onStreet(s, Math.max(8, Math.hypot(s.points[s.points.length - 1][0] - s.points[0][0], s.points[s.points.length - 1][1] - s.points[0][1]) * 0.55), 1.65, { w: W, h: H, fov: 62 })),
      title: `${s.name} — trong hẻm`,
      sub: `hẻm ${s.widthM.toFixed(1)} m · tầm mắt 1,65 m · ${hemScore.n} toà trong 34 m`,
      aerial: false,
    };
  },
  avenue: () => (() => {
    // Đứng TRÊN trục đại lộ và nhìn dọc: đứng sát vỉa hè rồi quay ngang thì khung hình là mặt
    // tường của toà bên cạnh, không phải đại lộ. Ảnh này để đo bề rộng lòng đường + hai dãy mặt phố.
    const cam = onStreet(avenue, 55, 1.65, { w: W, h: H, fov: 62 });
    return {
      cam: nudge({ ...cam, yaw: cam.yaw + 0.06, pitch: 0.015 }),
      title: `${avenue.name} — đại lộ`,
      sub: `lòng đường ${avenue.widthM} m · đứng giữa trục · tầm mắt 1,65 m`,
      aerial: false,
    } as { cam: Camera; title: string; sub: string; aerial: boolean };
  })(),
  market: () => ({
    cam: (() => {
      // Ba cách trước đều hỏng: vòng tròn 42–88 m cho ra 2/3 khung là mặt đường trống và cái chợ
      // chỉ là một dải ở chân trời; tầm mắt bên kia đường thì cột đèn chắn giữa ống kính, rồi hàng
      // cây che sạch chợ. Nay chụp TỪ TRÊN XUỐNG ở góc chéo qua chợ: chợ, dãy sạp, dù, và mạng phố
      // quanh nó cùng vào khung trong một ảnh — đúng thứ ảnh này phải chứng minh.
      // Lùi đủ xa để khung hình là "chợ TRONG khu phố": chợ chiếm ~1/4 khung, phần còn lại là
      // dãy nhà, hẻm, dù sạp quanh nó. Ở cự ly 44 m chợ phủ kín 2/3 khung thành một tấm tôn gân.
      const cam = { x: market.x - 96, y: 104, z: market.z + 104 };
      return {
        x: cam.x, y: cam.y, z: cam.z,
        yaw: Math.atan2(market.x - cam.x, market.z - cam.z),
        pitch: (-30 * Math.PI) / 180, fov: 48, w: W, h: H,
      } satisfies Camera;
    })(),
    title: `${market.name} — sạp chợ`,
    sub: `mốc ${market.footprintM} m · ${market.kind} · mái tôn chợ nằm trong mạng phố Chợ Lớn`,
    aerial: false,
  }),
  room: () => {
    // Ảnh này phải trả lời: "bước ra khỏi phòng 6.07 thì thấy gì?". Nên camera đứng ở ngưỡng cửa
    // THẬT (`city.start`), bước thêm 1,6 m ra lòng đường và nhìn DỌC phố — không nhìn ngang vào
    // bức tường đối diện, thứ từng cho ra một khung hình toàn mảng xám.
    const door = city.start;
    const nearest = city.streets
      .filter((st) => st.klass !== "alley")
      .map((st) => {
        const [ax, az] = st.points[0];
        const [bx, bz] = st.points[st.points.length - 1];
        const vx = bx - ax;
        const vz = bz - az;
        const len2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((door.x - ax) * vx + (door.z - az) * vz) / len2));
        const px = ax + vx * t;
        const pz = az + vz * t;
        return { st, d: Math.hypot(px - door.x, pz - door.z), px, pz, yaw: Math.atan2(vx, vz) };
      })
      .sort((a, b) => a.d - b.d)[0];
    const away = nearest.d > 0.001 ? { x: (nearest.px - door.x) / nearest.d, z: (nearest.pz - door.z) / nearest.d } : { x: 0, z: 0 };
    const cam = { x: door.x + away.x * 1.6, z: door.z + away.z * 1.6 };
    return {
      cam: nudge({ x: cam.x, y: 1.65, z: cam.z, yaw: nearest.yaw + 0.12, pitch: 0.02, fov: 72, w: W, h: H }) satisfies Camera,
      title: "Ngưỡng cửa phòng 6.07 — nhìn ra phố",
      sub: `điểm spawn thật (${door.x.toFixed(0)}, ${door.z.toFixed(0)}) cách tâm phòng ${door.distanceFromRoomM} m · ${nearest.st.name}`,
      aerial: false,
    };
  },
  roof: () => {
    const s = hemScore.s;
    const [ax, az] = s.points[0];
    return {
      cam: { x: ax + 26, y: 15.5, z: az + 10, yaw: Math.atan2(-1, 0.55), pitch: (-16 * Math.PI) / 180, fov: 62, w: W, h: H },
      title: "Mái tôn — nhìn xuống mạng hẻm",
      sub: "cao 15,5 m · thấy được ruột khối và hẻm cụt",
      aerial: false,
    };
  },
};

const svgFor = (cam: Camera, scene: { faces: Face[]; ground: Face[]; shadows: Face[]; texts: unknown[]; shadowOpacity?: number }, title: string, sub: string) => {
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${cam.w}" height="${cam.h}" viewBox="0 0 ${cam.w} ${cam.h}" font-family="ui-sans-serif, system-ui, sans-serif">`);
  out.push(`<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#243553"/><stop offset="0.55" stop-color="#566478"/>
      <stop offset="0.82" stop-color="#9b8b8c"/><stop offset="1" stop-color="#c8a68c"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.80" cy="0.15" r="0.22">
      <stop offset="0" stop-color="#ffe3b0" stop-opacity="0.40"/><stop offset="1" stop-color="#ffe3b0" stop-opacity="0"/>
    </radialGradient>
  </defs>`);
  out.push(`<rect width="${cam.w}" height="${cam.h}" fill="url(#sky)"/>`);
  out.push(`<rect width="${cam.w}" height="${cam.h}" fill="url(#sun)"/>`);

  // Nền vẽ theo ĐÚNG thứ tự chồng: viền → mặt đất → nước → đường → vỉa hè → sân. Sắp theo độ sâu
  // thì hình chữ nhật mặt đất (tâm ở giữa bản đồ) sẽ đè lên đường ở nửa xa.
  for (const f of scene.ground as Face[]) {
    out.push(`<polygon points="${f.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${f.fill}"${f.opacity !== undefined ? ` fill-opacity="${f.opacity}"` : ""}/>`);
  }

  const shadows = (scene.shadows as Face[]).slice().sort((a, b) => a.depth - b.depth);
  if (shadows.length) {
    // Gom bóng vào MỘT nhóm có opacity: bóng chồng nhau không bị sẫm gấp đôi.
    out.push(`<g fill="#100e18" opacity="${(scene.shadowOpacity ?? 0.52).toFixed(2)}">`);
    for (const s of shadows) out.push(`<polygon points="${s.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}"/>`);
    out.push(`</g>`);
  }

  const faces = scene.faces.slice().sort((a, b) => b.depth - a.depth);
  for (const f of faces) {
    const pts = f.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    if (f.fill === "none") {
      out.push(`<polyline points="${pts}" fill="none" stroke="${f.stroke}" stroke-width="${(f.width ?? 1).toFixed(2)}" stroke-linecap="round"/>`);
    } else {
      out.push(`<polygon points="${pts}" fill="${f.fill}"${f.opacity !== undefined ? ` fill-opacity="${f.opacity}"` : ""}/>`);
    }
  }

  for (const t of scene.texts as Array<{ x: number; y: number; size: number; fill: string; text: string; anchor: string; rotate: number }>) {
    out.push(`<text x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}" fill="${t.fill}" font-size="${t.size.toFixed(1)}" text-anchor="${t.anchor}" font-weight="600" stroke="#0b0a12" stroke-width="${(t.size * 0.16).toFixed(2)}" paint-order="stroke">${t.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
  }

  out.push(`<rect width="${cam.w}" height="64" fill="#0b0a12" opacity="0.55"/>`);
  out.push(`<text x="22" y="28" fill="#f6efe4" font-size="17" font-weight="700">${title}</text>`);
  out.push(`<text x="22" y="48" fill="#b8adc4" font-size="11">${sub}</text>`);
  out.push(`<text x="22" y="${cam.h - 16}" fill="#9b93a8" font-size="10">Dựng từ chính dữ liệu va chạm của game (cityGen) — camera phối cảnh, nắng chiều, đổ bóng. Không dùng WebGL/trình duyệt.</text>`);
  out.push("</svg>");
  return out.join("\n");
};

const png = async (name: string, svg: string) => {
  if (noPng) return;
  try {
    const { default: sharp } = await import(requireFromRepo.resolve("sharp"));
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `${name}.png`));
  } catch (error) {
    console.warn("PNG bỏ qua:", String(error).slice(0, 200));
  }
};

mkdirSync(outDir, { recursive: true });
for (const [name, make] of Object.entries(shots)) {
  if (only && only !== name) continue;
  const { cam, title, sub, aerial } = make();
  if (!aerial && !isWalkable(city, cam.x, cam.z)) console.warn(`[${name}] camera không đứng được (đang trong nhà/nước) — vẫn dựng để xem`);
  const scene = buildScene(cam, { aerial });
  const svg = svgFor(cam, scene as never, title, sub);
  writeFileSync(path.join(outDir, `city-${name}.svg`), svg);
  await png(`city-${name}`, svg);
  console.log(`${name.padEnd(8)} ${scene.faces.length} mặt · ${scene.shadows.length} bóng · ${scene.texts.length} nhãn → docs/product/audit/city-${name}.png`);
}
