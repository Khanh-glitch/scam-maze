import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { buildCityMesh, type Part } from "./cityMesh";
import { REAL_WORLD_BUILD_MARGIN_M, REAL_WORLD_MARGIN_M, REAL_WORLD_RECTS, inRealWorld } from "./realWorldFootprint";
import { CITY_AVENUE_WIDTH, CITY_MINOR_WIDTH, CITY_STREET_WIDTH } from "./roadSpec";
import { ROAD_WIDTH } from "../testbus/openworld/simulation/boarding";

/**
 * RANH GIỚI VỚI MAP CHUẨN — kiểm bằng hình học, không bằng mắt.
 *
 * `/saigon` chạy trên chính runtime của `/testbus`, nên mọi thứ của thành phố sinh tự động phải
 * dừng ở mép 9 vùng dựng tay: hai tấm nhựa chồng nhau, hai dãy bó vỉa lệch 3 cm, một cột điện mọc
 * giữa sân nhà trọ — đều là lỗi mà ảnh chụp dễ bỏ sót. Test này đọc thẳng dữ liệu hình học.
 */
const hits = (p: Part): boolean => {
  const margin = p.sy > 2 ? REAL_WORLD_BUILD_MARGIN_M : REAL_WORLD_MARGIN_M;
  const ry = p.ry ?? 0;
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  const hx = (c * p.sx + s * p.sz) / 2;
  const hz = (s * p.sx + c * p.sz) / 2;
  return REAL_WORLD_RECTS.some(
    (r) =>
      p.x + hx > r.x0 - margin &&
      p.x - hx < r.x1 + margin &&
      p.z + hz > r.z0 - margin &&
      p.z - hz < r.z1 + margin,
  );
};

describe("thành phố không dựng vào vùng của map chuẩn", () => {
  const city = generateCity(undefined, { realWorld: true });
  const mesh = buildCityMesh(city);

  it("không mảnh hình học nào chồng lên 9 vùng dựng tay", () => {
    const lists: Array<[string, Part[]]> = [
      ["boxes", mesh.boxes],
      ["flat", mesh.flat],
      ["kerbs", mesh.kerbs],
      ["prisms", mesh.prisms],
      ["gables", mesh.gables],
      ["trunks", mesh.trunks],
      ["canopies", mesh.canopies],
      ["details", mesh.details],
      ["drums", mesh.drums],
      ["poles", mesh.poles],
    ];
    for (const [name, parts] of lists) {
      const bad = parts.filter(hits);
      expect(`${name}:${bad.length}`).toBe(`${name}:0`);
    }
  });

  it("không khối nhà, sạp, cây nào đứng trong vùng dựng tay", () => {
    expect(
      city.buildings.filter(
        (b) => !b.walkable && inRealWorld((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, REAL_WORLD_BUILD_MARGIN_M),
      ).length,
    ).toBe(0);
    expect(city.props.filter((p) => inRealWorld(p.x, p.z, 1)).length).toBe(0);
  });
});

describe("khổ đường của thành phố khớp khổ đường map chuẩn", () => {
  it("phố thường đúng bằng bề rộng lòng đường của map chuẩn", () => {
    expect(CITY_STREET_WIDTH).toBe(ROAD_WIDTH);
    expect(CITY_STREET_WIDTH).toBe(12.8);
    expect(CITY_MINOR_WIDTH).toBeLessThan(CITY_STREET_WIDTH);
    // Đại lộ = hành lang Đại lộ 3/2 (openWorldBounds.json: z −86,6 … −65,4).
    expect(CITY_AVENUE_WIDTH).toBeCloseTo(21.2, 6);
  });

  it("mọi tuyến phố của thành phố dùng đúng ba khổ đó", () => {
    const city = generateCity(undefined, { realWorld: true });
    const widths = new Set(city.streets.map((s) => Math.round(s.widthM * 10) / 10));
    for (const w of widths) {
      const known =
        Math.abs(w - CITY_STREET_WIDTH) < 0.05 ||
        Math.abs(w - CITY_MINOR_WIDTH) < 0.05 ||
        Math.abs(w - CITY_AVENUE_WIDTH) < 0.05;
      // hẻm và cầu giữ khổ riêng của chúng (hẻm 2,4–3,6 m là đặc trưng Sài Gòn).
      expect(known || w < 6 || w > 22).toBe(true);
    }
  });
});
