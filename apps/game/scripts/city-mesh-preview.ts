// Dựng ảnh từ CHÍNH hình học mà trang `/saigon` vẽ (`buildCityMesh`) — không phải renderer kiểm
// toán. Mục đích: sandbox không có trình duyệt, nên đây là cách duy nhất để NHÌN thấy cái người
// chơi sẽ thấy, thay vì tin vào con số đếm mặt.
//
//   node scripts/city-mesh-preview.ts                 # khung mặc định
//   node scripts/city-mesh-preview.ts --yaw=-2.1 --pitch=-0.5 --dist=700 --x=100 --z=60
//   node scripts/city-mesh-preview.ts --street         # hạ camera xuống tầm mắt giữa phố
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateCity } from "../src/features/citymap/cityGen.ts";
import { buildCityMesh, type Part } from "../src/features/citymap/cityMesh.ts";

const requireFromRepo = createRequire(path.join(process.cwd(), "package.json"));
const outDir = path.resolve(process.cwd(), "..", "..", "docs/product/audit");
mkdirSync(outDir, { recursive: true });

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "1"] as const;
  }),
);
const num = (k: string, d: number) => (args.has(k) ? Number(args.get(k)) : d);

const W = num("w", 1600);
const H = num("h", 1000);
const city = generateCity();
const mesh = buildCityMesh(city);
const F = city.frame;

// `--street`: đứng giữa đại lộ dài nhất, nhìn dọc trục — khung nhìn mà người chơi thật sự có.
const avenue = [...city.streets]
  .filter((st) => st.klass === "avenue" || st.klass === "street")
  .sort((a, b2) => Math.hypot(b2.points.at(-1)![0] - b2.points[0][0], b2.points.at(-1)![1] - b2.points[0][1])
    - Math.hypot(a.points.at(-1)![0] - a.points[0][0], a.points.at(-1)![1] - a.points[0][1]))[0];
const along = (t: number): [number, number] => {
  const [ax, az] = avenue.points[0];
  const [bx, bz] = avenue.points.at(-1)!;
  return [ax + (bx - ax) * t, az + (bz - az) * t];
};
const eyeStreet = (() => {
  const [x, z] = along(num("t", 0.12));
  return [x, num("y", 1.65), z];
})();
const lookStreet = (() => {
  const [x, z] = along(num("t", 0.12) + 0.24);
  return [x, 5, z];
})();
const eye = num("street", 0) === 1
  ? eyeStreet
  : [num("x", (F.x0 + F.x1) / 2 + 260), num("y", 210), num("z", (F.z0 + F.z1) / 2 + 330)];
const look = num("street", 0) === 1
  ? lookStreet
  : [num("tx", (F.x0 + F.x1) / 2), num("ty", 10), num("tz", (F.z0 + F.z1) / 2)];

const fwdRaw = [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]];
const fl = Math.hypot(...fwdRaw) || 1;
const Fv = fwdRaw.map((v) => v / fl);
const rightRaw = [Fv[2], 0, -Fv[0]];
const rl = Math.hypot(...rightRaw) || 1;
const R = rightRaw.map((v) => v / rl);
const U = [Fv[1] * R[2] - Fv[2] * R[1], Fv[2] * R[0] - Fv[0] * R[2], Fv[0] * R[1] - Fv[1] * R[0]];
const focal = H / 2 / Math.tan((num("fov", 50) * Math.PI) / 180 / 2);

type P3 = [number, number, number];
const toCam = (p: P3): P3 => {
  const d: P3 = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  return [d[0] * R[0] + d[1] * R[1] + d[2] * R[2], d[0] * U[0] + d[1] * U[1] + d[2] * U[2], d[0] * Fv[0] + d[1] * Fv[1] + d[2] * Fv[2]];
};
const NEAR = 0.5;
const screenOf = (c: P3): [number, number, number] => [W / 2 + (focal * c[0]) / c[2], H / 2 - (focal * c[1]) / c[2], c[2]];
/** Cắt đa giác theo mặt phẳng gần: đa giác lớn (mặt đất) luôn có đỉnh nằm sau camera. */
const clipNear = (cam: P3[]): P3[] => {
  const out: P3[] = [];
  for (let i = 0; i < cam.length; i += 1) {
    const a = cam[i];
    const b = cam[(i + 1) % cam.length];
    const ain = a[2] >= NEAR;
    const bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
};

const sunV: P3 = [-0.5, 0.55, -0.67];
const sl = Math.hypot(...sunV);
const sun: P3 = [sunV[0] / sl, sunV[1] / sl, sunV[2] / sl];
const shade = (hex: string, n: P3): string => {
  const d = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
  const k = 0.58 + 0.62 * d;
  const v = Number.parseInt(hex.slice(1), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.min(255, Math.round(x * k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
const nrm = (v: P3): P3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

interface Poly { pts: string; fill: string; z: number }
const polys: Poly[] = [];
const groundPolys: Poly[] = [];
const addPoly = (world: P3[], color: string, n: P3, ground = false) => {
  const q = clipNear(world.map(toCam)).map(screenOf);
  if (q.length < 3) return;
  (ground ? groundPolys : polys).push({
    pts: q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
    fill: shade(color, n),
    z: (q[0][2] + q[2][2]) / 2,
  });
};

/** Khối hộp có quay quanh trục đứng (giống Part.ry). */
const addBox = (p: Part) => {
  const c = Math.cos(p.ry ?? 0);
  const s = Math.sin(p.ry ?? 0);
  const hx = p.sx / 2;
  const hz = p.sz / 2;
  const corner = (ax: number, az: number): [number, number] => [p.x + ax * c + az * s, p.z - ax * s + az * c];
  const base2 = [corner(-hx, -hz), corner(hx, -hz), corner(hx, hz), corner(-hx, hz)];
  const y0 = p.y;
  const y1 = p.y + p.sy;
  // mặt trên
  addPoly(base2.map(([x, z]) => [x, y1, z] as P3), p.color, [0, 1, 0]);
  // bốn mặt bên (bỏ mặt quay lưng để đỡ mặt + không bị viền)
  for (let i = 0; i < 4; i += 1) {
    const a = base2[i];
    const b = base2[(i + 1) % 4];
    const n = nrm([b[1] - a[1], 0, -(b[0] - a[0])]);
    const mid: P3 = [(a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2];
    const toEye: P3 = [eye[0] - mid[0], eye[1] - mid[1], eye[2] - mid[2]];
    if (n[0] * toEye[0] + n[1] * toEye[1] + n[2] * toEye[2] <= 0) continue;
    addPoly([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], p.color, n);
  }
};

/** Lăng trụ đa giác (bán kính 1 → nhân sx/sz), dùng cho thân tháp vát góc và bồn nước. */
const addPrism = (p: Part, sides = 8) => {
  const y0 = p.y;
  const y1 = p.y + p.sy;
  const ring: Array<[number, number]> = [];
  for (let i = 0; i < sides; i += 1) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    ring.push([p.x + Math.cos(a) * p.sx, p.z + Math.sin(a) * p.sz]);
  }
  addPoly(ring.map(([x, z]) => [x, y1, z] as P3), p.color, [0, 1, 0]);
  for (let i = 0; i < sides; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % sides];
    const n = nrm([b[1] - a[1], 0, -(b[0] - a[0])]);
    const mid: P3 = [(a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2];
    const toEye: P3 = [eye[0] - mid[0], eye[1] - mid[1], eye[2] - mid[2]];
    if (n[0] * toEye[0] + n[1] * toEye[1] + n[2] * toEye[2] <= 0) continue;
    addPoly([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], p.color, n);
  }
};

/** Lăng trụ tam giác: sống nóc dọc trục x (khớp `gableGeometry` của trang web). */
const addGable = (p: Part) => {
  const c = Math.cos(p.ry ?? 0);
  const s = Math.sin(p.ry ?? 0);
  const hx = p.sx / 2;
  const hz = p.sz / 2;
  const corner = (ax: number, az: number): [number, number] => [p.x + ax * c + az * s, p.z - ax * s + az * c];
  const a0 = corner(-hx, -hz);
  const a1 = corner(hx, -hz);
  const a2 = corner(hx, hz);
  const a3 = corner(-hx, hz);
  const ridgeY = p.y + p.sy;
  // Sống nóc chạy dọc trục x Ở GIỮA hộp (z = 0 trong hệ cục bộ). Đặt nó ở mép hộp thì "mái" thành
  // một tấm dốc khổng lồ phủ cả lô — đúng lỗi từng thấy trong ảnh xem trước.
  const r0 = corner(-hx, 0);
  const r1 = corner(hx, 0);
  const ridge0: P3 = [r0[0], ridgeY, r0[1]];
  const ridge1: P3 = [r1[0], ridgeY, r1[1]];
  const nS = nrm([0, p.sy, -hz]);
  const nN = nrm([0, p.sy, hz]);
  // hai mặt dốc
  addPoly([[a0[0], p.y, a0[1]], [a1[0], p.y, a1[1]], ridge1, ridge0], p.color, nS);
  addPoly([[a2[0], p.y, a2[1]], [a3[0], p.y, a3[1]], ridge0, ridge1], p.color, nN);
  // hai đầu hồi
  addPoly([[a1[0], p.y, a1[1]], [a2[0], p.y, a2[1]], ridge1], p.color, nrm([1, 0.2, 0]));
  addPoly([[a3[0], p.y, a3[1]], [a0[0], p.y, a0[1]], ridge0], p.color, nrm([-1, 0.2, 0]));
};

/** Nón (tán cây). */
const addCone = (p: Part, sides = 7) => {
  const ring: Array<[number, number]> = [];
  for (let i = 0; i < sides; i += 1) {
    const a = (i / sides) * Math.PI * 2;
    ring.push([p.x + Math.cos(a) * p.sx, p.z + Math.sin(a) * p.sz]);
  }
  for (let i = 0; i < sides; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % sides];
    const n = nrm([b[1] - a[1], 0.5, -(b[0] - a[0])]);
    addPoly([[a[0], p.y, a[1]], [b[0], p.y, b[1]], [p.x, p.y + p.sy, p.z]], p.color, n);
  }
};

// nền đất
const gY = -0.06;
// Đất phải chia LƯỚI: một tứ giác 12 km luôn có đỉnh nằm sau camera nên bị bỏ (đúng lỗi từng gặp
// ở renderer kiểm toán), và khi đó nửa dưới khung hình là trời.
{
  const N = 32;
  const half = 2400;
  const step = (half * 2) / N;
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const x0 = eye[0] - half + i * step;
      const z0 = eye[2] - half + j * step;
      addPoly([[x0, gY, z0], [x0 + step, gY, z0], [x0 + step, gY, z0 + step], [x0, gY, z0 + step]], i % 2 === j % 2 ? "#565549" : "#585749", [0, 1, 0], true);
    }
  }
}

for (const p of mesh.boxes) addBox(p);
for (const p of mesh.flat) addBox(p);
if (!args.has("nodetail")) for (const p of mesh.details) addBox(p);
for (const p of mesh.prisms) addPrism(p, 8);
if (!args.has("nogable")) for (const p of mesh.gables) addGable(p);
for (const p of mesh.trunks) addPrism(p, 6);
for (const p of mesh.canopies) addCone(p, 7);
for (const p of mesh.drums) addPrism(p, 8);

polys.sort((a, b) => b.z - a.z);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#2b3b52"/><stop offset="0.6" stop-color="#6b7486"/><stop offset="1" stop-color="#c8a68c"/>
</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${groundPolys.map((p) => `<polygon points="${p.pts}" fill="${p.fill}"/>`).join("")}
${polys.map((p) => `<polygon points="${p.pts}" fill="${p.fill}"/>`).join("")}
</svg>`;
const name = args.has("out") ? String(args.get("out")) : "city-mesh";
writeFileSync(path.join(outDir, `_${name}.svg`), svg);
const { default: sharp } = await import(requireFromRepo.resolve("sharp"));
await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `_${name}.png`));
console.log(
  `${polys.length} đa giác · ${mesh.stats.parts} khối · ${mesh.stats.buildings} toà · ` +
  `${mesh.details.length} chi tiết mặt tiền · ${mesh.drums.length} bồn nước → docs/product/audit/_${name}.png`,
);
