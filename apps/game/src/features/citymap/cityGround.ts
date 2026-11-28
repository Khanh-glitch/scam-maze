/**
 * NỀN ĐẤT CỦA THÀNH PHỐ — tấm 9 km dưới mọi thứ khác.
 *
 * Trước đây là một `MeshLambertMaterial("#55544a")` phẳng: từ trên cao nó là một tấm xám tuyệt đối,
 * và ở chỗ giáp với map chuẩn thì tông đất lệch hẳn so với nền của `saigonDistricts`. Ở đây sinh vân
 * đất thật, **thuần số** rồi mới vẽ vào canvas:
 *
 *  - nền lấy đúng tông đất của engine (`GROUND_BASE_HEX`) nên chỗ nối không còn "đổi màu";
 *  - ba lớp biến thiên: mảng đất ẩm / bụi nắng / moss cỡ lớn, vệt mảnh (bánh xe, rãnh nước) cỡ
 *    trung, và hạt nhiễu tần số cao — cùng cấu trúc với `createLushSoilGrassGroundMaterial` nhưng
 *    tông **đất thị thành** (đất nện, bụi, sỏi) chứ không phải cỏ công viên;
 *  - vân lặp theo mét (không theo UV của tấm 9 km), nên ô vân luôn ~28 m dù tấm lớn cỡ nào.
 *
 * Tách phần tính điểm ảnh ra khỏi canvas vì jsdom **không** có backend 2D (`getContext("2d")` trả
 * `null` khi không cài gói `canvas`), mà đây lại là thứ dễ hỏng im lặng nhất: một tấm vân trơn là
 * "mặt đất xám" quay lại. Nhờ tách ra, test đọc thẳng điểm ảnh.
 */
import * as THREE from "three";

/**
 * Tông đất gốc — **cùng một hằng** cho nền 9 km và cho nền của khu phố gốc (`coreWorld`). Hai tấm
 * nền lệch màu là một vệt sáng hình chữ nhật giữa thành phố.
 */
export const GROUND_BASE_HEX = "#55544a";
/** Ô vân lặp trên mặt đất (m). 28 m ≈ một ô phố, đủ lớn để không thấy nhịp lặp. */
export const GROUND_TILE_M = 28;

const BASE_RGB = [0x55, 0x54, 0x4a] as const;

/** Bảng biến thiên sắc độ, khớp với tông đất thị thành của engine. */
const PATCH_TONES = [
  [58, 56, 46], // đất ẩm tối
  [122, 116, 96], // bụi nắng
  [92, 104, 68], // moss / cỏ dại
  [150, 142, 120], // sỏi / cát
] as const;

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/**
 * Điểm ảnh của vân đất, RGBA, hàng-major. Thuần số, tất định theo `seed`, không cần DOM.
 *
 * Ba lớp chồng như một mặt đất thật:
 *  1. mảng mềm cỡ 6–24 m — đổi **sắc độ** chứ không đổi màu (mặt đất thị thành không phải bãi cỏ);
 *  2. vệt mảnh, dài, gần như trong suốt — chỉ đọc ra khi nhìn nghiêng;
 *  3. hạt nhiễu tần số cao — thiếu lớp này, khi camera đứng yên mặt đất "trượt" vì lọc bilinear
 *     hai ô vân trơn.
 */
export function groundTexturePixels(size = 256, seed = 20261128): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  let rng = seed >>> 0;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  // 1. Mảng mềm. Chỉ duyệt hộp bao của từng mảng nên 240 mảng trên 256² vẫn nhanh.
  const fields = new Float32Array(size * size * 4);
  for (let i = 0; i < 240; i += 1) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rad = size * (0.02 + rand() * 0.07);
    const tone = PATCH_TONES[Math.floor(rand() * PATCH_TONES.length)];
    const amp = 0.14 + rand() * 0.24;
    const x0 = Math.max(0, Math.floor(cx - rad));
    const x1 = Math.min(size - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad));
    const y1 = Math.min(size - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d >= 1) continue;
        const w = (1 - d) ** 2 * amp;
        const k = (y * size + x) * 4;
        for (let ch = 0; ch < 3; ch += 1) fields[k + ch] += (tone[ch] - BASE_RGB[ch]) * w;
      }
    }
  }

  // 2. Vệt mảnh: vẽ bằng lấy mẫu dọc đoạn thẳng, bề rộng 1–3 px.
  for (let i = 0; i < 90; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const len = size * (0.08 + rand() * 0.24);
    const a = rand() * Math.PI;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const width = 1 + Math.floor(rand() * 2.2);
    const dark = rand() < 0.5;
    const amp = dark ? -8 - rand() * 10 : 6 + rand() * 8;
    for (let t = 0; t < len; t += 1) {
      const sx = Math.round(x + dx * t);
      const sy = Math.round(y + dy * t);
      for (let o = -width; o <= width; o += 1) {
        const px2 = sx + o;
        const py2 = sy + o;
        if (px2 < 0 || py2 < 0 || px2 >= size || py2 >= size) continue;
        const k = (py2 * size + px2) * 4;
        for (let ch = 0; ch < 3; ch += 1) fields[k + ch] += amp * 0.35;
      }
    }
  }

  // 3. Gộp ba lớp + hạt nhiễu, ghi ra RGBA đục.
  for (let i = 0, k = 0; i < size * size; i += 1, k += 4) {
    const n = (rand() - 0.5) * 15;
    px[k] = clamp255(BASE_RGB[0] + fields[k] + n);
    px[k + 1] = clamp255(BASE_RGB[1] + fields[k + 1] + n);
    px[k + 2] = clamp255(BASE_RGB[2] + fields[k + 2] + n);
    px[k + 3] = 255;
  }
  return px;
}

/** Vân đất đã vẽ vào canvas — dùng cho `THREE.CanvasTexture`. */
export function makeGroundTextureCanvas(size = 256, seed = 20261128): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return canvas;
  const image = g.createImageData(size, size);
  image.data.set(groundTexturePixels(size, seed));
  g.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Vật liệu nền 9 km.
 *
 * `sizeM` là cạnh tấm nền; UV đặt theo mét nên ô vân luôn `GROUND_TILE_M`. Trên renderer phần mềm
 * (SwiftShader/llvmpipe) vân hạ xuống 128² và tắt anisotropy — cùng cách map chuẩn tự hạ chi tiết.
 */
export function createCityGroundMaterial(sizeM: number, software = false): THREE.Material {
  const tex = new THREE.CanvasTexture(makeGroundTextureCanvas(software ? 128 : 256));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = software ? 1 : 8;
  const repeat = Math.max(1, Math.round(sizeM / GROUND_TILE_M));
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: tex, color: "#ffffff" });
}
