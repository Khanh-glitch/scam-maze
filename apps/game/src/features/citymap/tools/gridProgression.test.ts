import { describe, expect, it } from "vitest";
import { generateCity } from "../cityGen";
import { extendTrafficGraph } from "../cityTraffic";
import { SaigonTrafficManager } from "../../testbus/openworld/traffic";

/**
 * L6 — TUYẾN ĐƯỜNG PHẢI CÓ NGUYÊN TẮC: lưới trực giao, có phân cấp, và đèn chạy làn sóng xanh.
 *
 * Ba tính chất của một lưới phố thật, đo được trên dữ liệu `cityGen`:
 *
 *  1. **Lưới trực giao**: mọi tuyến dài (≥ 20 m) phải nằm trong 1° so với trục x hoặc z. Một thành
 *     phố "ngổn ngang" là thành phố có tuyến cắt xéo lung tung; đo được hiện tại: **139/139 tuyến
 *     lệch 0–1°**, tức lưới tuyệt đối vuông.
 *  2. **Phân cấp**: ba cấp đúng `roadSpec` — đại lộ 21,2 m, phố 12,8 m, hẻm 7,2 m (và cầu). Không
 *     được có bề rộng lạ chen vào.
 *  3. **Đèn có pha lệch theo khoảng cách** (làn sóng xanh): trước bản vá mọi ngã tư đều
 *     `phaseOffset = 0` nên cả lưới đổi đèn cùng lúc — không trục nào đi liên tục được. Sau bản vá
 *     pha lan dọc tuyến theo `khoảng cách / tốc độ thiết kế`, chuẩn hoá về chu kỳ 39,6 s.
 */
describe("lưới phố có nguyên tắc", () => {
  const city = generateCity(undefined, { realWorld: true });

  it("mọi tuyến dài đều nằm trên lưới trực giao (lệch ≤ 1°)", () => {
    const offGrid: string[] = [];
    let checked = 0;
    for (const s of city.streets) {
      for (let i = 0; i < s.points.length - 1; i += 1) {
        const [ax, az] = s.points[i];
        const [bx, bz] = s.points[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 20) continue;
        checked += 1;
        const deg = (Math.atan2(bz - az, bx - ax) * 180) / Math.PI;
        const m = ((deg % 90) + 90) % 90;
        const deviation = Math.min(m, 90 - m);
        if (deviation > 1) offGrid.push(`${s.id} ${deviation.toFixed(1)}°`);
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(offGrid).toEqual([]);
  });

  it("mọi tuyến dài đều mang đúng một trong ba khổ của roadSpec", () => {
    // Bất biến §3: 21,2 đại lộ · 12,8 phố · 7,2 phố nhỏ. Tuyến **dài** (lưới chính, có xe chạy) phải
    // rơi đúng vào một trong ba khổ ấy — không có bề rộng tự chế chen vào lưới giao thông.
    const allowed = [7.2, 12.8, 21.2];
    const offSpec: string[] = [];
    const long = (s: (typeof city.streets)[number]) => {
      let len = 0;
      for (let i = 0; i < s.points.length - 1; i += 1) {
        len += Math.hypot(s.points[i + 1][0] - s.points[i][0], s.points[i + 1][1] - s.points[i][1]);
      }
      return len >= 60;
    };
    let checked = 0;
    for (const s of city.streets) {
      if (s.klass === "alley" || s.klass === "bridge" || !long(s)) continue;
      checked += 1;
      if (!allowed.some((w) => Math.abs(w - s.widthM) < 0.05)) offSpec.push(`${s.id} ${s.widthM.toFixed(1)} m`);
    }
    expect(checked).toBeGreaterThan(20);
    expect(offSpec).toEqual([]);
    // Và cả ba khổ phải có mặt — thiếu 7,2 nghĩa là mất một cấp đường khỏi thành phố.
    const present = new Set(city.streets.filter(long).map((s) => Math.round(s.widthM * 10) / 10));
    for (const w of allowed) expect(present.has(w)).toBe(true);
    // Hẻm thật: hẹp hơn phố nhỏ, rộng hơn 1 m (hẻm Sài Gòn 2–4 m).
    const alleys = city.streets.filter((s) => s.klass === "alley").map((s) => s.widthM);
    expect(alleys.length).toBeGreaterThan(50);
    expect(Math.max(...alleys)).toBeLessThan(8);
    expect(Math.min(...alleys)).toBeGreaterThan(1);
  });

  it("đèn lệch pha theo khoảng cách — không phải cả lưới đổi đèn cùng lúc", () => {
    const traffic = new SaigonTrafficManager();
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 900, maxCorridors: 24 });
    expect(ext.phaseOffsets.length).toBe(ext.junctions.length);
    // Pha lệch tuyệt đối nằm trong [0, 1) chu kỳ.
    expect(ext.phaseOffsets.every((p) => p.offset >= 0 && p.offset < 1)).toBe(true);
    // Nguồn (ngã tư gần gốc toạ độ nhất) có pha 0, phần lớn còn lại lệch khác 0.
    const nonzero = ext.phaseOffsets.filter((p) => p.offset > 0.01);
    expect(nonzero.length).toBeGreaterThan(ext.phaseOffsets.length * 0.3);
    // Và độ lệch phải nằm trong một chu kỳ.
    expect(ext.phaseOffsets.every((p) => p.offset >= 0 && p.offset < 1)).toBe(true);
    // Ngã tư có pha thật: hai ngã tư liền kề cùng trục không còn đổi đèn đồng thời.
    const j = ext.junctions.filter((x) => !x.id.startsWith("CTYEND_"));
    expect(j.length).toBeGreaterThan(10);
    const offsets = new Set(j.map((x) => traffic.graph.intersections.get(x.id)!.phaseOffset.toFixed(2)));
    expect(offsets.size).toBeGreaterThan(5);
  });
});
