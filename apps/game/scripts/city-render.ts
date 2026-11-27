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
  const skirt = { x0: F.x0 - 2600, x1: F.x1 + 2600, z0: F.z0 - 2600, z1: F.z1 + 2600 };
  pushGround(q(skirt, -0.06), hex2rgb("#43473f"), [0, 1, 0]);
  pushGround(q(F, 0), hex2rgb("#6a6774"), [0, 1, 0]);
  for (const band of [
    { x0: F.x0 - 5, x1: F.x1 + 5, z0: F.z0 - 5, z1: F.z0 },
    { x0: F.x0 - 5, x1: F.x1 + 5, z0: F.z1, z1: F.z1 + 5 },
    { x0: F.x0 - 5, x1: F.x0, z0: F.z0, z1: F.z1 },
    { x0: F.x1, x1: F.x1 + 5, z0: F.z0, z1: F.z1 },
  ]) pushGround(q(band, -0.02), hex2rgb("#3a3742"), [0, 1, 0]);

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
    const road = hex2rgb(s.klass === "alley" ? "#3b3946" : s.klass === "avenue" ? "#282731" : "#302f3a");
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
  const buildings = city.buildings
    .filter((b) => !b.walkable)
    .flatMap((b) => {
      if (b.anchor !== "landmark81") return [{ b, d: near(b) }];
      // Landmark 81 thật là một CỤM ba tháp so le (461 m + hai tháp thấp hơn), không phải một hộp
      // dựng đứng. Một hộp 461 m ở tỉ lệ này đọc ra như cái cột trắng — thứ duy nhất trong khung
      // hình trông chưa làm xong.
      const w = b.x1 - b.x0;
      const dd2 = b.z1 - b.z0;
      const gap = Math.max(1.2, w * 0.05);
      const share = [0.5, 0.28, 0.22];
      const hs = [b.heightM, b.heightM * 0.66, b.heightM * 0.5];
      // Trục x chia 0,5/0,28/0,22; tháp phụ lùi theo trục sâu để cụm so le chứ không phải hàng rào.
      const zs: Array<[number, number]> = [[0, 1], [0.06, 0.94], [0.18, 0.86]];
      let cursor = b.x0;
      return hs.map((hh, i) => {
        const tw = (w - gap * 2) * share[i];
        const x0 = cursor;
        cursor += tw + gap;
        const rec = {
          ...b, x0, x1: x0 + tw,
          z0: b.z0 + dd2 * zs[i][0], z1: b.z0 + dd2 * zs[i][1],
          heightM: hh, floors: Math.round(hh / 3.9), anchor: undefined, glass: true,
        };
        return { b: rec, d: near(rec) };
      });
    })
    .sort((p, q2) => q2.d - p.d); // vẽ xa trước

  for (const item of buildings) {
    const b = item.b;
    const d = item.d;
    const district = city.districts.find((dd) => dd.id === b.district);
    const palette = WALL[district?.klass ?? "residential"] ?? WALL.residential;
    const seed = Number.isFinite(b.x0 + b.z0) ? Math.abs(Math.round(b.x0 * 7919 + b.z0 * 104729)) % palette.length : 0;
    const glassy = (item as { b: { glass?: boolean } }).b.glass === true;
    const base = hex2rgb(glassy ? "#a3b6c6" : b.anchor ? "#9aa3ad" : palette[seed] ?? "#8a8578");
    const h = b.heightM;
    // Mái chợ/kho lớn: tôn rỉ. Mái bê tông xám đọc ra "bãi đỗ xe" đúng nghĩa đen.
    const roofC = hex2rgb(b.kind === "market" ? "#8b6a52" : b.floors <= 2 ? ROOF[seed % ROOF.length] : "#6d6a72");
    const lot: Rect = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
    const w = b.x1 - b.x0;
    const dd = b.z1 - b.z0;

    // Bóng đổ: hình chiếu của hộp nhà theo hướng nắng (chỉ vẽ khi nhìn từ trên, ở tầm mắt thì
    // bóng dài hàng trăm mét và làm rối ảnh).
    if (world.aerial) {
      const k = h / sun[1];
      const sx = -sun[0] * k;
      const sz = -sun[2] * k;
      // Hợp của đáy và đỉnh-chiếu = bóng của cả khối hộp. Vẽ hai hình trong CÙNG một nhóm có
      // opacity nên chỗ chồng nhau không bị sẫm gấp đôi.
      pushShadow([[b.x0, 0.01, b.z0], [b.x1, 0.01, b.z0], [b.x1, 0.01, b.z1], [b.x0, 0.01, b.z1]]);
      pushShadow([
        [b.x0 + sx, 0.01, b.z0 + sz], [b.x1 + sx, 0.01, b.z0 + sz],
        [b.x1 + sx, 0.01, b.z1 + sz], [b.x0 + sx, 0.01, b.z1 + sz],
      ]);
    }

    // Khí quyển nhẹ và ấm: bản cũ trộn tới 30 % xám-lạnh (#4a5568) nên cả thành phố ra màu thạch
    // cao xanh xám — mất sạch chất Sài Gòn (vàng đất, ngói, tường vôi).
    const atm = (c: RGB) => mix(c, hex2rgb("#6e6672"), Math.min(0.14, Math.max(0, (d - 380) / 1500) * 0.14));

    // Bốn mặt tường: chỉ vẽ mặt hướng về camera (pháp tuyến · hướng nhìn < 0)
    const walls: Array<{ n: RGB; quad: RGB[] }> = [
      { n: [0, 0, -1], quad: [[b.x0, 0, b.z0], [b.x1, 0, b.z0], [b.x1, h, b.z0], [b.x0, h, b.z0]] },
      { n: [0, 0, 1], quad: [[b.x1, 0, b.z1], [b.x0, 0, b.z1], [b.x0, h, b.z1], [b.x1, h, b.z1]] },
      { n: [-1, 0, 0], quad: [[b.x0, 0, b.z1], [b.x0, 0, b.z0], [b.x0, h, b.z0], [b.x0, h, b.z1]] },
      { n: [1, 0, 0], quad: [[b.x1, 0, b.z0], [b.x1, 0, b.z1], [b.x1, h, b.z1], [b.x1, h, b.z0]] },
    ];
    const toCam = P.toCam([(b.x0 + b.x1) / 2, h / 2, (b.z0 + b.z1) / 2]);
    for (const wall of walls) {
      const facing = wall.n[0] * toCam[0] + wall.n[1] * toCam[1] + wall.n[2] * toCam[2] < 0;
      if (!facing) continue;
      push(wall.quad, atm(base), wall.n);
      const along = wall.n[0] === 0 ? w : dd;
      if (world.aerial) {
        // Ảnh trên cao từng không có một chi tiết mặt đứng nào: tháp 30 tầng và nhà kho đọc ra
        // giống nhau — những tảng thạch cao. Nay: tháp có dải kính dọc, nhà nhiều tầng có dải tầng.
        if (d < 2600 && along > 2.4 && h > 6) {
          const floorsHere = Math.max(1, Math.round(h / 3.3));
          const isXw = wall.n[0] !== 0;
          const planeW = isXw ? (wall.n[0] > 0 ? b.x1 : b.x0) : (wall.n[2] > 0 ? b.z1 : b.z0);
          const ow = 0.05;
          const s0w = isXw ? b.z0 : b.x0;
          const seg = (t0: number, t1: number, y0: number, y1: number): RGB[] => {
            const p0 = s0w + along * t0;
            const p1 = s0w + along * t1;
            return isXw
              ? [[planeW + ow, y0, p0], [planeW + ow, y0, p1], [planeW + ow, y1, p1], [planeW + ow, y1, p0]]
              : [[p0, y0, planeW + ow], [p1, y0, planeW + ow], [p1, y1, planeW + ow], [p0, y1, planeW + ow]];
          };
          if (floorsHere >= 9) {
            const strips = Math.max(2, Math.min(5, Math.round(along / 5)));
            for (let i = 0; i < strips; i += 1) {
              const t0 = 0.08 + (i / strips) * 0.84;
              push(seg(t0, t0 + (0.84 / strips) * 0.55, h * 0.07, h * 0.95), mix(GLASS, base, 0.45), wall.n, { opacity: 0.8 });
            }
          } else if (floorsHere >= 3) {
            const bands = Math.min(5, floorsHere - 1);
            for (let i = 1; i <= bands; i += 1) {
              const y = (h * i) / (bands + 1);
              push(seg(0.07, 0.93, y, y + Math.min(0.75, h * 0.045)), mix(base, hex2rgb("#2b2a33"), 0.45), wall.n, { opacity: 0.62 });
            }
          }
        }
        continue;
      }
      // Chi tiết tầng chỉ cho nhà gần: ban công, dải cửa kính, tấm biển hiệu.
      if (d > 190) continue;
      const isX = wall.n[0] !== 0;
      const plane = isX ? (wall.n[0] > 0 ? b.x1 : b.x0) : (wall.n[2] > 0 ? b.z1 : b.z0);
      const o = 0.04 * (wall.n[0] + wall.n[2]);
      const at = (t0: number, t1: number, y0: number, y1: number): RGB[] => {
        const s = isX ? b.z0 : b.x0;
        const p0 = s + along * t0;
        const p1 = s + along * t1;
        const yy0 = y0, yy1 = y1;
        return isX
          ? [[plane + o, yy0, p0], [plane + o, yy0, p1], [plane + o, yy1, p1], [plane + o, yy1, p0]]
          : [[p0, yy0, plane + o], [p1, yy0, plane + o], [p1, yy1, plane + o], [p0, yy1, plane + o]];
      };
      // Cửa sổ: nhà gần thì từng ô, nhà xa thì một dải — nhưng phải đọc ra "nhà có cửa sổ".
      const cols = Math.max(1, Math.round(along / 2.5));
      const fh = h / Math.max(1, b.floors);
      for (let f = 1; f < b.floors; f += 1) {
        const y0 = f * fh + Math.min(1.05, fh * 0.3);
        const y1 = Math.min(y0 + Math.min(1.35, fh * 0.45), h - 0.35);
        if (y1 <= y0) continue;
        if (d < 80 && along > 3) {
          for (let cIdx = 0; cIdx < cols; cIdx += 1) {
            const t0 = 0.08 + (cIdx / cols) * 0.84;
            const t1 = 0.08 + ((cIdx + 0.72) / cols) * 0.84;
            push(at(t0, t1, y0, y1), mix(GLASS, base, 0.2), wall.n, { opacity: 0.94 });
          }
        } else {
          push(at(0.06, 0.94, y0, y1), mix(GLASS, base, 0.18), wall.n, { opacity: 0.92 });
        }
      }
      // Tầng trệt: mặt tiền quán (tôn cuốn / kính) + tấm biển
      if (b.floors >= 1) {
        push(at(0.03, 0.97, 0.15, 2.8), mix(hex2rgb(SHOP[b.kind] ?? SHOP.default), base, 0.35), wall.n, { opacity: 0.95 });
        const signC = hex2rgb(SHOP[b.kind] ?? SHOP.default);
        push(at(0.06, 0.94, 2.85, 3.75), signC, wall.n);
      }
      // Mái hiên (nhà ở / chợ): tấm bạt nhô ra 0,9 m trên mặt tiền — nhịp điệu đặc trưng của phố.
      if ((district?.klass === "residential" || district?.klass === "market") && d < 140 && b.floors <= 5) {
        const y = 4.05;
        const out = 0.9;
        const s = isX ? b.z0 : b.x0;
        const p0 = s + along * 0.04;
        const p1 = s + along * 0.96;
        const dir = wall.n[0] + wall.n[2];
        const awn: RGB[] = isX
          ? [[plane, y, p0], [plane, y, p1], [plane + dir * out, y + 0.18, p1], [plane + dir * out, y + 0.18, p0]]
          : [[p0, y, plane], [p1, y, plane], [p1, y + 0.18, plane + dir * out], [p0, y + 0.18, plane + dir * out]];
        push(awn, mix(hex2rgb("#b8452f"), hex2rgb("#2f6b7a"), (seed % 5) / 5), [0, 1, 0]);
      }
      // Ban công nhà ở (1–4 tầng)
      if (b.floors >= 2 && b.floors <= 5 && along > 3.2 && (district?.klass === "residential" || district?.klass === "market")) {
        const y = 3.9;
        push(at(0.1, 0.9, y, y + 0.16), mix(base, hex2rgb("#ffffff"), 0.22), wall.n);
      }
    }

    // Mái
    push([[b.x0, h, b.z0], [b.x1, h, b.z0], [b.x1, h, b.z1], [b.x0, h, b.z1]], atm(roofC), [0, 1, 0]);
    // Mái tôn có gân cho nhà LỚN mà THẤP (chợ, kho, xưởng): một tấm phẳng 53×43 m đọc ra ô trống
    // chứ không ra mái chợ. Sáu–mười vệt sáng tối là đủ để mắt nhận ra tấm tôn.
    if (w > 13 && dd > 13 && b.floors <= 4) {
      const ribs = Math.max(4, Math.min(11, Math.round(dd / 3.2)));
      const rh = h + 0.02;
      for (let i = 0; i < ribs; i += 1) {
        const z0r = b.z0 + (dd * i) / ribs;
        const z1r = b.z0 + (dd * (i + 0.55)) / ribs;
        push([[b.x0 + 0.4, rh, z0r], [b.x1 - 0.4, rh, z0r], [b.x1 - 0.4, rh, z1r], [b.x0 + 0.4, rh, z1r]],
          mix(atm(roofC), hex2rgb(i % 2 ? "#ffffff" : "#101018"), i % 2 ? 0.13 : 0.16), [0, 1, 0], { opacity: 0.85 });
      }
    }
    // Sân thượng: một hình chữ nhật thụt vào, đọc ra gờ mái/parapet khi nhìn từ trên.
    if (world.aerial && h > 11 && w > 6 && dd > 6) {
      const inx = Math.min(1.1, w * 0.1);
      const inz = Math.min(1.1, dd * 0.1);
      push([
        [b.x0 + inx, h + 0.03, b.z0 + inz], [b.x1 - inx, h + 0.03, b.z0 + inz],
        [b.x1 - inx, h + 0.03, b.z1 - inz], [b.x0 + inx, h + 0.03, b.z1 - inz],
      ], mix(atm(roofC), hex2rgb("#20202a"), 0.28), [0, 1, 0], { opacity: 0.9 });
    }
    // Bồn nước trên mái — chi tiết nhìn từ trên cao, rất Sài Gòn
    if (!b.anchor && b.floors >= 2 && b.floors <= 6 && w > 3 && dd > 3 && (!world.aerial ? d < 160 : d < 420)) {
      const cx = b.x0 + w * 0.28;
      const cz = b.z0 + dd * 0.62;
      const r = Math.min(0.85, Math.min(w, dd) * 0.16);
      push([[cx - r, h, cz - r], [cx + r, h, cz - r], [cx + r, h, cz + r], [cx - r, h, cz + r]], mix(hex2rgb("#c9cdd2"), base, 0.25), [0, 1, 0]);
      push([
        [cx - r, h, cz - r], [cx + r, h, cz - r], [cx + r, h + r * 1.7, cz - r], [cx - r, h + r * 1.7, cz - r],
      ], mix(hex2rgb("#8e949b"), base, 0.2), [0, 0, -1]);
    }

    // Ở tầm mắt không dán chữ lên mặt toà: chữ chỉ nằm trên tấm biển hiệu (xem phần POI bên dưới).
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
  return { faces, ground, shadows, texts };
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

const svgFor = (cam: Camera, scene: { faces: Face[]; ground: Face[]; shadows: Face[]; texts: unknown[] }, title: string, sub: string) => {
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
    out.push(`<g fill="#100e18" opacity="0.52">`);
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
