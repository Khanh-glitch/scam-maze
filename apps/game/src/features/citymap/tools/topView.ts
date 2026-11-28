/**
 * MẮT — raster hoá **dữ liệu hình học thật** của thành phố ra buffer RGBA nhìn từ trên xuống.
 *
 * Sandbox không có GPU nên không chụp được scene WebGL. Nhưng sai hỏng người dùng báo (đường đâm
 * xuyên nhà, nhà dính chùm, tuyến ngổn ngang, đèn sai chỗ, xe chạy lùi) đều là lỗi **mặt bằng**:
 * chúng hiện ra trong dữ liệu `cityGen`/`cityMesh`/`cityNetwork` trước khi lên hình. Vẽ đúng dữ liệu
 * đó ra ảnh là nhìn được lỗi — không phải đoán, không phải chụp màn hình.
 *
 * Không phụ thuộc three.js: tự cấp phát buffer RGBA, tự vẽ. Ghi PNG nằm ở `topView.test.ts`
 * (cần `sharp`, chỉ có trong test/Node).
 */
import type { City } from "../cityGen";
import type { CityMesh } from "../cityMesh";

export interface TopViewOptions {
  /** Pixel trên một mét. 1,6 = nhìn khung 1,1 km trong ảnh ~1 900 px. */
  pxPerM?: number;
  /** Lề quanh khung, mét. */
  padM?: number;
  /** Chỉ vẽ một vùng (mét) — dùng để phóng to chỗ có lỗi. */
  region?: { x0: number; z0: number; x1: number; z1: number };
  /**
   * Tô đỏ tươi những nhà **lấn lòng đường** và tô xanh lam lòng đường, để mắt thấy ngay chỗ chồng.
   * Bật cho ảnh chẩn đoán; tắt cho ảnh "bản đồ" thường.
   */
  highlight?: boolean;
}

/** Vẽ mặt bằng thành phố. Trả buffer RGBA + kích thước để nơi gọi ghi ra PNG. */
export function renderCityTopView(city: City, mesh: CityMesh, opts: TopViewOptions = {}) {
  const PX_PER_M = opts.pxPerM ?? 1.6;
  const PAD = opts.padM ?? 40;
  // --- canvas ---------------------------------------------------------------------------------------
  const frame = opts.region
    ? { x0: opts.region.x0, x1: opts.region.x1, z0: opts.region.z0, z1: opts.region.z1 }
    : city.frame;
  const X0 = frame.x0 - (opts.region ? 0 : PAD);
  const Z0 = frame.z0 - (opts.region ? 0 : PAD);
  const W = Math.ceil((frame.x1 - frame.x0 + (opts.region ? 0 : PAD * 2)) * PX_PER_M);
  const H = Math.ceil((frame.z1 - frame.z0 + (opts.region ? 0 : PAD * 2)) * PX_PER_M);
  const buf = new Uint8Array(W * H * 4).fill(0);
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

  const px = (m: number) => Math.round((m - X0) * PX_PER_M);
  const py = (m: number) => Math.round((m - Z0) * PX_PER_M);

  function put(x: number, y: number, r: number, g: number, b: number, a = 1) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    if (a >= 1) {
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
      return;
    }
    buf[i] = buf[i] * (1 - a) + r * a;
    buf[i + 1] = buf[i + 1] * (1 - a) + g * a;
    buf[i + 2] = buf[i + 2] * (1 - a) + b * a;
  }

  function rect(x0: number, z0: number, x1: number, z1: number, color: [number, number, number], a = 1) {
    const ax = px(Math.min(x0, x1));
    const bx = px(Math.max(x0, x1));
    const ay = py(Math.min(z0, z1));
    const by = py(Math.max(z0, z1));
    for (let y = ay; y <= by; y += 1) for (let x = ax; x <= bx; x += 1) put(x, y, color[0], color[1], color[2], a);
  }

  /** Thick line (đường, tuyến) bằng quét vuông góc — đủ cho mặt bằng. */
  function line(ax: number, az: number, bx: number, bz: number, widthM: number, color: [number, number, number], a = 1) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return;
    const nx = -dz / len;
    const nz = dx / len;
    const h = widthM / 2;
    const steps = Math.max(1, Math.ceil(len * PX_PER_M));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const cx = ax + dx * t;
      const cz = az + dz * t;
      for (let w = -h; w <= h; w += 0.25) {
        put(px(cx + nx * w), py(cz + nz * w), color[0], color[1], color[2], a);
      }
    }
  }

  function dot(x: number, z: number, rM: number, color: [number, number, number]) {
    const cx = px(x);
    const cy = py(z);
    const r = Math.max(1, Math.round(rM * PX_PER_M));
    for (let y = -r; y <= r; y += 1) for (let xx = -r; xx <= r; xx += 1) {
      if (xx * xx + y * y <= r * r) put(cx + xx, cy + y, color[0], color[1], color[2]);
    }
  }

  // --- lớp vẽ, dưới lên trên ------------------------------------------------------------------------
  // 1. nền đất
  rect(X0, Z0, X0 + W / PX_PER_M, Z0 + H / PX_PER_M, [26, 26, 24]);

  // 2. nước + cầu
  for (const w of city.water) rect(w.x0, w.z0, w.x1, w.z1, [20, 60, 78]);
  for (const d of city.decks) rect(d.x0, d.z0, d.x1, d.z1, [80, 80, 74]);

  // 3. tuyến ĐƯỜNG SINH TỰ ĐỘNG (xám nhạt) — vẽ TRƯỚC nhà để thấy ngay chỗ đường chạm/xuyên nhà.
  for (const s of city.streets) {
    const w = s.widthM;
    for (let i = 0; i < s.points.length - 1; i += 1) {
      const [ax, az] = s.points[i];
      const [bx, bz] = s.points[i + 1];
      line(ax, az, bx, bz, w + (s.klass === "alley" ? 0 : 5.2), [58, 58, 54]); // hè
      line(ax, az, bx, bz, w, [96, 96, 88]); // lòng đường
    }
  }

  // 3b. CHẾ ĐỘ CHẨN ĐOÁN: tô lòng đường bằng xanh lam để thấy nhà có đè lên hay không.
  if (opts.highlight) {
    for (const s of city.streets) {
      for (let i = 0; i < s.points.length - 1; i += 1) {
        const [ax, az] = s.points[i];
        const [bx, bz] = s.points[i + 1];
        line(ax, az, bx, bz, s.widthM + 4, [0, 200, 220], 0.55);
      }
    }
  }

  // 4. NHÀ (đỏ = khối có chiều cao, xanh = đi được/công viên)
  for (const b of city.buildings) {
    if (b.walkable) rect(b.x0, b.z0, b.x1, b.z1, [34, 74, 52]);
    else {
      const t = Math.min(1, b.heightM / 90);
      rect(b.x0, b.z0, b.x1, b.z1, [120 + 110 * t, 48 + 40 * t, 44 + 30 * t]);
    }
  }
  for (const b of city.belt.buildings) rect(b.x0, b.z0, b.x1, b.z1, [150, 110, 90]);

  // 4b. CHẾ ĐỘ CHẨN ĐOÁN: khoanh đỏ tươi những nhà lấn lòng đường (không tính hẻm).
  if (opts.highlight) {
    const distToStreet = (b: { x0: number; x1: number; z0: number; z1: number }, s: City["streets"][number]) => {
      let best = Infinity;
      for (let i = 0; i < s.points.length - 1; i += 1) {
        const [ax, az] = s.points[i];
        const [bx, bz] = s.points[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const L = dx * dx + dz * dz;
        for (const [x, z] of [
          [b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1],
          [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2],
        ]) {
          const t = L < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
          best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
        }
      }
      return best;
    };
    for (const b of city.buildings) {
      if (b.walkable) continue;
      for (const s of city.streets) {
        if (s.klass === "alley") continue;
        if (distToStreet(b, s) < s.widthM / 2 + 0.5) {
          rect(b.x0, b.z0, b.x1, b.z1, [255, 40, 220], 0.75);
          break;
        }
      }
    }
  }

  // 5. lưới toạ độ 100 m + gốc
  for (let g = Math.ceil(X0 / 100) * 100; g < X0 + W / PX_PER_M; g += 100) {
    for (let y = 0; y < H; y += 1) put(px(g), y, 70, 70, 70, 0.5);
  }
  for (let g = Math.ceil(Z0 / 100) * 100; g < Z0 + H / PX_PER_M; g += 100) {
    for (let x = 0; x < W; x += 1) put(x, py(g), 70, 70, 70, 0.5);
  }
  dot(0, 0, 4, [255, 255, 255]);

  // 6. MESH THẬT: bó vỉa (vàng) — thứ hiện sai nếu tiết diện đường lệch.

  // PHẢI vẽ theo `ry`: mọi mảnh có `ry` khác 0 mà vẽ bằng hộp bao trục thì thành một thanh ngang
  // xuyên khối nhà — đúng thứ trông như "đường đâm qua công trình" nhưng là **lỗi của công cụ vẽ**,
  // không phải của thành phố. Đây là lần thứ hai bẫy này xuất hiện; đường và vỉa đều dùng `line()`.
  for (const k of mesh.kerbs) {
    const ry = k.ry ?? 0;
    const along = Math.max(k.sx, k.sz);
    const dx = Math.cos(ry);
    const dz = -Math.sin(ry);
    const sx = k.sx >= k.sz ? along : k.sz;
    const sz = k.sx >= k.sz ? k.sz : along;
    if (Math.abs(ry) < 1e-3) rect(k.x - sx / 2, k.z - sz / 2, k.x + sx / 2, k.z + sz / 2, [210, 190, 60], 0.95);
    else line(k.x - dx * along / 2, k.z - dz * along / 2, k.x + dx * along / 2, k.z + dz * along / 2, Math.max(0.2, sz), [210, 190, 60], 0.95);
  }
  // vạch đi bộ (trắng) — chỗ người đi bộ thật sự sang đường
  for (const z of mesh.zebras) line(z.a.x, z.a.z, z.b.x, z.b.z, 0.5, [255, 255, 255], 0.9);



  return { data: buf, width: W, height: H, pxPerM: PX_PER_M, origin: { x: X0, z: Z0 } };
}
