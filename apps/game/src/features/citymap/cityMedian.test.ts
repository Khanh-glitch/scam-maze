// DẢI PHÂN CÁCH của đại lộ phải là hình học thật, đúng cao độ, và chỉ ở đoạn đủ dài.
//
// Đây là thứ dễ hỏng nhất mà mắt lại dễ bỏ qua: một dải phân cách đặt sai cao độ thì hoặc chìm dưới
// nhựa (không thấy), hoặc nhô cao như bó vỉa hè (xe "leo" lên). Test đọc thẳng `buildCityMesh()` nên
// kiểm được cả hình học lẫn quy tắc "chỉ đoạn > 40 m".

import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { buildCityMesh } from "./cityMesh";
import { CURB_HEIGHT } from "../testbus/openworld/simulation/boarding";

describe("dải phân cách đại lộ", () => {
  const city = generateCity(undefined, { realWorld: true });
  const mesh = buildCityMesh(city);
  const parts = [...mesh.flat, ...mesh.kerbs];

  /** Dải phân cách = tấm nằm ở giữa lòng đường, rộng 2,2–3,2 m, đúng cao độ bó vỉa. */
  const medians = parts.filter(
    (p) => Math.abs(p.sy - CURB_HEIGHT) < 1e-6 && p.sz >= 2 && p.sz <= 3.4 && p.sx > 30,
  );

  it("có dải phân cách trên đại lộ dài", () => {
    expect(medians.length).toBeGreaterThan(4);
  });

  it("đúng cao độ bó vỉa (`CURB_HEIGHT`), không phải cao độ hè", () => {
    for (const m of medians) {
      expect(m.sy).toBeCloseTo(CURB_HEIGHT, 6);
      // Đáy tấm nằm ở 0 (tâm đặt ở sy/2) ⇒ đỉnh đúng `CURB_HEIGHT`, thấp hơn hè thành phố (0,24) và
      // cao hơn mặt nhựa (0,03).
      expect(m.sy).toBeLessThan(0.24);
      expect(m.sy).toBeGreaterThan(0.03);
    }
  });

  it("chỉ ở đoạn dài hơn 40 m — dải 3 m ở đoạn 12 m là chặn hết lòng đường", () => {
    for (const m of medians) expect(m.sx).toBeGreaterThan(40);
  });

  it("bề rộng hợp lý: 2,2 m cho phố, 3,2 m cho đại lộ", () => {
    const widths = new Set(medians.map((m) => Math.round(m.sz * 10) / 10));
    for (const w of widths) expect([2.2, 3.2]).toContain(w);
  });

  it("có mặt trên (cỏ hoặc bê tông) — không phải một khối đá trơ", () => {
    const tops = parts.filter((p) => p.sy === 0.04 || (p.sy < 0.06 && p.sy > 0.03));
    expect(tops.length).toBeGreaterThan(0);
  });
});
