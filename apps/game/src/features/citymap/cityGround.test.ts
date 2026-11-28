import { describe, expect, it } from "vitest";
import { GROUND_BASE_HEX, GROUND_TILE_M, groundTexturePixels } from "./cityGround";
import { CITY_AVENUE_WIDTH, CITY_MINOR_WIDTH, CITY_STREET_WIDTH } from "./roadSpec";
import { ROAD_WIDTH } from "../testbus/openworld/simulation/boarding";

/**
 * NỀN ĐẤT 9 KM — không được là một tấm xám phẳng.
 *
 * Test đọc thẳng điểm ảnh của tấm vân: một tấm `#55544a` tuyệt đối thì mọi pixel giống nhau, còn
 * tấm vân thật thì phải có biến thiên sắc độ ở cả ba thang (mảng lớn, vệt, hạt). Đó là thứ duy nhất
 * kiểm được mà không cần GPU.
 */
const hexToRgb = (hex: string) => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});

describe("nền đất 9 km", () => {
  const data = groundTexturePixels(128, 7);
  const luma: number[] = [];
  for (let i = 0; i < data.length; i += 4) luma.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);

  it("có biến thiên sắc độ thật, không phải một màu tuyệt đối", () => {
    const min = Math.min(...luma);
    const max = Math.max(...luma);
    const mean = luma.reduce((a, b) => a + b, 0) / luma.length;
    // Trải rộng ít nhất 12 mức sáng (0–255) và trung bình nằm giữa dải đó.
    expect(max - min).toBeGreaterThan(12);
    expect(mean).toBeGreaterThan(min + 1);
    expect(mean).toBeLessThan(max - 1);
    // Độ lệch chuẩn (đo độ "nhiễu" của hạt) phải > 0.
    const variance = luma.reduce((a, b) => a + (b - mean) ** 2, 0) / luma.length;
    expect(Math.sqrt(variance)).toBeGreaterThan(0.8);
  });

  it("giữ đúng tông đất của engine: trung bình quanh `GROUND_BASE_HEX`", () => {
    const base = hexToRgb(GROUND_BASE_HEX);
    const baseLuma = 0.299 * base.r + 0.587 * base.g + 0.114 * base.b;
    const mean = luma.reduce((a, b) => a + b, 0) / luma.length;
    // Biến thiên có, nhưng không được "đổi màu": lệch trung bình < 12 mức sáng.
    expect(Math.abs(mean - baseLuma)).toBeLessThan(12);
  });

  it("tất định: cùng seed ra cùng tấm vân", () => {
    const again = groundTexturePixels(128, 7);
    expect(Array.from(again.slice(0, 400))).toEqual(Array.from(data.slice(0, 400)));
    const other = groundTexturePixels(128, 8);
    expect(Array.from(other.slice(0, 400))).not.toEqual(Array.from(data.slice(0, 400)));
  });

  it("ô vân lặp theo mét, không theo kích thước tấm nền", () => {
    // 9 km / 28 m ≈ 321 lần lặp — con số duy nhất bảo đảm ô vân đúng cỡ khi tấm nền to ra.
    expect(GROUND_TILE_M).toBeGreaterThan(16);
    expect(Math.round(9000 / GROUND_TILE_M)).toBe(321);
  });
});

describe("khổ đường dùng chung giữa hai file", () => {
  it("đại lộ và phố nhỏ vẫn đúng khổ đã chốt", () => {
    expect(CITY_AVENUE_WIDTH).toBeCloseTo(21.2, 6);
    expect(CITY_MINOR_WIDTH).toBeCloseTo(7.2, 6);
    expect(CITY_STREET_WIDTH).toBe(ROAD_WIDTH);
  });
});
