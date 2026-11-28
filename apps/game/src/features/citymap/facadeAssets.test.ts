import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * VÂN MẶT ĐỨNG — file phải có dữ liệu thật.
 *
 * Một tấm vân "chết" (một màu tuyệt đối) không ném lỗi, không rơi draw call, không làm test nào
 * đỏ: nó chỉ làm mặt đứng ra phẳng, và triệu chứng duy nhất là *nhìn* mới thấy. Đó đúng là thứ đã
 * xảy ra với `q1/beige_wall_001-map.webp` — 3,8 KB cho 1024², độ lệch chuẩn **0,33/255** — mà
 * `createWorldFacadePBR` dùng làm `travertine` cho 14 toà nhà và mọi khối infill của map chuẩn.
 * Cùng lúc `clay_plaster` (dùng cho `warmLimestone` + 2 vật liệu khác) chỉ có std 1,86.
 *
 * Cách đo: giải mã ảnh rồi lấy độ lệch chuẩn ở 64×64. Hạ độ phân giải trước khi đo là cố ý — nhiễu
 * nén từng pixel không phải "vân"; thứ mắt nhìn thấy ở một ô vân 3 m là mảng sáng tối lớn. Ngưỡng
 * 4,0/255 nằm giữa nhóm chết (0,3–1,9) và nhóm thật yếu nhất (2,9–5,1).
 */
const IMAGES = path.resolve(__dirname, "../../../public/assets/testbus/ow/images");
/** Bỏ mức "nhiễu nén" ra khỏi phép đo: một màu + nhiễu vẫn là một màu. */
const MIN_CONTRAST = 4.0;

/** ID vân mặt đứng mà mã thật sự tham chiếu (qua `createWorldFacadePBR`). */
const FACADE_IDS = [
  "beige_wall_001",
  "blue_plaster_weathered",
  "brick_wall_04",
  "clay_plaster",
  "concrete_wall_007",
  "grey_plaster_02",
  "painted_plaster_wall",
  "painted_worn_brick",
];

/** Độ lệch chuẩn độ xám ở 64×64 của một ảnh WebP. */
async function contrast(file: string): Promise<{ mean: number; std: number }> {
  const { data } = await sharp(file)
    .greyscale()
    .resize(64, 64, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (const v of data) sum += v;
  const mean = sum / data.length;
  let sq = 0;
  for (const v of data) sq += (v - mean) ** 2;
  return { mean, std: Math.sqrt(sq / data.length) };
}

describe("vân mặt đứng của map chuẩn", () => {
  it("mọi ID mà mã tham chiếu đều có đủ map/normal/rough", () => {
    for (const id of FACADE_IDS) {
      for (const kind of ["map", "normal", "rough"]) {
        const file = path.join(IMAGES, "q1", `${id}-${kind}.webp`);
        expect(existsSync(file), `thiếu ${id}-${kind}.webp`).toBe(true);
        // File rỗng/0 byte là kiểu hỏng khác nhưng cùng hậu quả: material không có vân.
        expect(readFileSync(file).length, `${id}-${kind}.webp rỗng`).toBeGreaterThan(1024);
      }
    }
  });

  it("không tấm vân nào là một màu (bẫy đã làm toà 14 tầng mất vân)", async () => {
    for (const id of FACADE_IDS) {
      const { std } = await contrast(path.join(IMAGES, "q1", `${id}-map.webp`));
      expect(std, `${id}-map.webp chỉ có std ${std.toFixed(2)}/255 — gần như một màu, không có vân`).toBeGreaterThan(
        MIN_CONTRAST,
      );
    }
  });

  /**
   * Bản thay thế phải giữ đúng chất liệu: `beige_wall_001` là đá vôi vàng nhạt (`travertine`
   * của 14 toà), `clay_plaster` là đất nung nâu ấm. Bản vá đầu tiên dùng `tint()` của sharp và
   * làm cả hai bạc thành xám trắng — bề mặt đúng là có vân nhưng sai vật liệu.
   */
  it("bản thay thế giữ đúng tông chất liệu", async () => {
    const beige = await contrast(path.join(IMAGES, "q1", "beige_wall_001-map.webp"));
    // Đá vôi: sáng (150–200) nhưng không cháy trắng.
    expect(beige.mean).toBeGreaterThan(140);
    expect(beige.mean).toBeLessThan(210);
    const clay = await contrast(path.join(IMAGES, "q1", "clay_plaster-map.webp"));
    // Đất nung: tối và ấm.
    expect(clay.mean).toBeGreaterThan(60);
    expect(clay.mean).toBeLessThan(140);
  });
});
