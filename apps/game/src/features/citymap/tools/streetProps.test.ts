import { describe, expect, it } from "vitest";
import { generateCity } from "../cityGen";
import { inRealWorld } from "../realWorldFootprint";
import { MAX_GLB_PROPS, PROP_TEMPLATES, planStreetPropAssets } from "../cityStreetProps";

/**
 * L7 — NPC/ĐỒ ĐẠC PHẢI DÙNG ASSET THẬT, KHÔNG PHẢI ĐỒ GIẢ.
 *
 * Trước bản vá: `cityGen` sinh 9 012 đồ vỉa hè, `cityLayer` thay đúng **24** chỗ bằng GLB
 * (`i % 17 === 0` của loại `stall`). Còn lại là khối nguyên thuỷ: 1 428 xe máy dựng = hộp,
 * 1 485 thùng rác và 1 027 bồn inox = trụ tròn.
 *
 * Sau bản vá: mọi loại đồ **có** asset thật trong repo đều được đặt bằng file GLB thật (xe máy ba
 * đời, thùng rác, sạp bánh mì, tủ đổi pin, bàn ghế nhựa, biển hiệu), rải đều khắp bản đồ, trần
 * `MAX_GLB_PROPS` cho ngân sách draw call. Đồ không có asset thật (cột đèn, cọc tiêu, rào tôn) vẫn
 * là hình khối — đó là hình học đúng của nó.
 */
describe("đồ vỉa hè dùng asset thật", () => {
  const city = generateCity(undefined, { realWorld: true });

  it("mọi loại đồ có asset đều được đặt bằng GLB thật, không chỉ 24 chỗ", () => {
    const plan = planStreetPropAssets(city.props, { inRealWorld });
    // Chạm trần: mọi chỗ có thể đặt đều đã đặt (không bỏ trống vì hạn mức cộng thiếu).
    expect(plan.length).toBe(MAX_GLB_PROPS);
    // 24 chỗ cũ là toàn bộ bản vá trước; 96 chỗ là 4×.
    expect(plan.length).toBeGreaterThan(24 * 3);
    const kinds = new Set(plan.map((p) => p.templateId.split("-")[0]));
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    // Không mẫu nào trỏ vào file không tồn tại trong bảng template.
    const known = new Set(Object.values(PROP_TEMPLATES).flat().map((t) => t.id));
    for (const p of plan) expect(known.has(p.templateId)).toBe(true);
  });

  it("rải đều khắp thành phố, không dồn một góc", () => {
    const plan = planStreetPropAssets(city.props, { inRealWorld });
    const xs = plan.map((p) => p.x);
    const zs = plan.map((p) => p.z);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanZ = Math.max(...zs) - Math.min(...zs);
    // Thành phố 1220 × 790 m: đồ phải trải trên phần lớn khung, không phải một cụm.
    expect(spanX).toBeGreaterThan(400);
    expect(spanZ).toBeGreaterThan(300);
  });

  it("không đè lên đất của map dựng tay (ở đó đã có đồ thật của Lý Thái Tổ)", () => {
    const plan = planStreetPropAssets(city.props, { inRealWorld });
    for (const p of plan) expect(inRealWorld(p.x, p.z, 0)).toBe(false);
  });

  it("mỗi loại có hạn mức riêng — xe máy không chiếm hết vỉa hè", () => {
    const plan = planStreetPropAssets(city.props, { inRealWorld });
    const byPrefix: Record<string, number> = {};
    for (const p of plan) {
      const k = p.templateId.split("-")[0];
      byPrefix[k] = (byPrefix[k] ?? 0) + 1;
    }
    // Không nhóm nào vượt 40 % tổng, và phải có ít nhất 4 nhóm.
    const total = plan.length;
    for (const [k, n] of Object.entries(byPrefix)) expect({ k, ok: n <= total * 0.4 }).toEqual({ k, ok: true });
    expect(Object.keys(byPrefix).length).toBeGreaterThanOrEqual(4);
  });

  it("mọi mẫu đều có phép biến đổi cỡ và cao độ hợp lí", () => {
    for (const [kind, list] of Object.entries(PROP_TEMPLATES)) {
      for (const t of list!) {
        expect({ kind, id: t.id, ok: t.scale > 0.2 && t.scale <= 3 }).toEqual({ kind, id: t.id, ok: true });
        expect({ kind, id: t.id, ok: t.url.endsWith(".glb") }).toEqual({ kind, id: t.id, ok: true });
        expect({ kind, id: t.id, ok: t.y >= 0 && t.y < 0.3 }).toEqual({ kind, id: t.id, ok: true });
      }
    }
  });
});
