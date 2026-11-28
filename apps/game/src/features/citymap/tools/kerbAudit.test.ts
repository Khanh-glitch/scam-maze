import { describe, expect, it } from "vitest";
import { generateCity } from "../cityGen";
import { buildCityMesh } from "../cityMesh";

/**
 * BÓ VỈA KHÔNG ĐƯỢC CHẠY XUYÊN NHÀ — cổng chặn hồi quy.
 *
 * Triệu chứng người dùng báo ("đường đâm chọt ngang qua các công trình") xuất hiện đúng ở đây: một
 * dải đá chạy qua khối nhà. Số đo gốc: 516/3 286 mảnh (15,7 %) nằm trong nhà. Nay mỗi mảnh được cắt
 * thành đoạn theo nhà, nên **không điểm nào** của mảnh được nằm sâu trong tường quá 0,3 m.
 */
describe("bó vỉa không nằm trong nhà", () => {
  it("không mảnh nào xuyên tường quá 0,3 m", () => {
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    const solid = city.buildings.filter((b) => !b.walkable);
    const depth = (x: number, z: number) => {
      for (const b of solid) {
        if (x <= b.x0 || x >= b.x1 || z <= b.z0 || z >= b.z1) continue;
        return Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
      }
      return 0;
    };
    let deep = 0;
    const samples: string[] = [];
    for (const k of mesh.kerbs) {
      const ry = k.ry ?? 0;
      const along = Math.max(k.sx, k.sz);
      const dx = Math.cos(ry);
      const dz = -Math.sin(ry);
      let worst = 0;
      for (let f = -0.5; f <= 0.5; f += 0.02) {
        worst = Math.max(worst, depth(k.x + dx * along * f, k.z + dz * along * f));
      }
      if (worst > 0.3) {
        deep += 1;
        if (samples.length < 5) samples.push(`${k.x.toFixed(1)},${k.z.toFixed(1)} sâu ${worst.toFixed(2)} m`);
      }
    }
    console.log(`vỉa: ${mesh.kerbs.length} mảnh · xuyên tường > 0,3 m: ${deep}`);
    expect(samples).toEqual([]);
    expect(deep).toBe(0);
  });
});
