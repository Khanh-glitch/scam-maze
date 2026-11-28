import { describe, expect, it } from "vitest";
import { generateCity } from "../cityGen";
import { diagnosePlan } from "./planAudit";

/**
 * CỔNG MẶT BẰNG — chặn ba lỗi người dùng báo bằng số, không bằng cảm nhận.
 *
 * Chạy trên chính dữ liệu `cityGen` sinh ra (không cần mesh, không cần WebGL), nên đây là bất biến
 * của **thành phố**, không phải của công cụ vẽ.
 *
 * L2 — công trình dính chùm: trước bản vá 5 cặp, 81 m². Tất cả là `bd-5147` (ga metro 40 × 40 m)
 * đè `bd-2019…2023` ở `x 294…330, z −9`. Nguyên nhân: `offRoad()` trượt cả hình chữ nhật toà mốc
 * sang lô khác **sau khi** đã dọn chỗ ở vị trí cũ, nên toà rơi vào dãy nhà mặt phố.
 *
 * L1 — đường xuyên công trình: 0 mẫu tuyến nằm trong nhà (đã vá ở `kerbAudit` + lọc đai chuyển
 * tiếp; cổng này giữ nó không tái phát ở mức dữ liệu).
 *
 * L3 — lấn lòng đường: tách "lỗi thật" (> 0,7 m) khỏi "dung sai dựng hình" (≤ 0,7 m). Mức lấn sâu
 * nhất toàn map là 0,6 m — mặt tiền sinh từ dải mép khối, tim tuyến gấp khúc; mắt không thấy, xe
 * không chạm. Đây là con số phải giữ, không phải con số phải về 0.
 */
describe("mặt bằng thành phố", () => {
  const city = generateCity(undefined, { realWorld: true });
  const findings = diagnosePlan(city);

  it("không có hai công trình nào chồng nhau", () => {
    expect(findings.report["cặp nhà chồng nhau"]).toBe(0);
    expect(findings.report["diện tích chồng (m²)"]).toBe(0);
    expect(findings.worst).toEqual([]);
  });

  it("không tuyến nào chạy xuyên qua công trình", () => {
    expect(findings.report["mẫu tuyến nằm trong nhà"]).toBe(0);
    expect(findings.throughAt).toEqual([]);
  });

  it("không công trình nào lấn hẳn lên lòng đường (quá 0,7 m)", () => {
    expect(findings.report["nhà lấn lòng đường (thật, > 0,7 m)"]).toBe(0);
    // Và dung sai dựng hình phải nhỏ: nếu ai đó làm mặt tiền lệch cả mét thì con số này vọt lên.
    expect(findings.report["mức lấn sâu nhất (m)"] as number).toBeLessThanOrEqual(0.7);
  });

  it("giữ đủ nhà và đủ khối — vá lỗi không được làm thành phố rỗng đi", () => {
    // Trước bản vá: 4 804 nhà đặc. Vá bằng cách dọn nhà thì số này tụt; vá đúng thì gần như giữ nguyên.
    expect(findings.report["nhà (đặc)"] as number).toBeGreaterThan(4700);
    expect(findings.report["khối"] as number).toBeGreaterThan(45);
    expect(findings.report["tuyến"] as number).toBeGreaterThan(130);
  });
});
