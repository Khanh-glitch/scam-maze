// ĐÈN NGÃ TƯ của phố thủ tục phải chạy trên **bộ điều khiển của engine**, không phải một bộ đếm giây
// viết lại.
//
// Test dùng `SaigonTrafficManager` thật (không cần WebGL): bật đèn bằng `signalizeCityIntersections`,
// kiểm `IntersectionSpec` của đồ thị đã đổi, rồi bước mô phỏng và xem bộ điều khiển QCVN 41:2024 có
// thật sự đổi pha — nếu đèn thành phố là "đèn trang trí" thì pha sẽ đứng yên.

import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { extendTrafficGraph } from "./cityTraffic";
import { SaigonTrafficManager } from "../testbus/openworld/traffic";
import { deriveSignalApproaches, signalBasePosition } from "../testbus/openworld/world/signalPlacement";

describe("đèn tín hiệu ngã tư thành phố", () => {
  const city = generateCity(undefined, { realWorld: true });
  const traffic = new SaigonTrafficManager();
  const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 520, maxCorridors: 10 });

  it("chỉ bật ngã tư **thật**, không bật đầu cụt quay đầu", () => {
    const picked = ext.junctions.filter((j) => !j.id.startsWith("CTYEND_")).slice(0, 4);
    expect(picked.length).toBeGreaterThan(0);
    for (const j of picked) {
      const spec = traffic.graph.intersections.get(j.id);
      expect(spec).toBeDefined();
      // Đầu cụt chỉ có vòng quay đầu — đèn ở đó là đèn vô nghĩa (và tốn một cột GLB).
      expect(j.id.startsWith("CTYEND_")).toBe(false);
      expect(spec!.nsGreenSec + spec!.ewGreenSec).toBeGreaterThan(20);
    }
  });

  it("mọi nhánh vào của ngã tư đều có vị trí cột đèn hợp lệ", () => {
    const wanted = new Set(ext.junctions.filter((j) => !j.id.startsWith("CTYEND_")).map((j) => j.id));
    for (const id of wanted) {
      const spec = traffic.graph.intersections.get(id);
      if (spec) spec.signalized = true;
    }
    const approaches = deriveSignalApproaches(traffic.graph).filter((a) => wanted.has(a.intersectionId));
    expect(approaches.length).toBeGreaterThan(0);
    for (const a of approaches) {
      const pos = signalBasePosition(a);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.z)).toBe(true);
      // Cột đứng trên hè chứ không đứng giữa lòng đường: nó phải lệch sang phía tay phải của tài xế
      // đúng bằng `poleLateral`, và lùi sau vạch dừng.
      const edge = traffic.graph.edges.get(a.edgeId);
      expect(edge).toBeDefined();
      expect(a.poleLateral).toBeGreaterThan(edge!.width / 2 + 0.5);
      const behind = Math.hypot(pos.x - a.stopLine.x, pos.z - a.stopLine.z);
      expect(behind).toBeGreaterThan(a.poleBehindStop - 0.01);
      expect(behind).toBeLessThan(24);
    }
  });

  it("đèn thành phố chạy trên bộ điều khiển của engine (pha thật sự đổi)", () => {
    const wanted = ext.junctions.filter((j) => !j.id.startsWith("CTYEND_")).slice(0, 2);
    const phases = new Map<string, Set<string>>();
    for (const j of wanted) {
      const spec = traffic.graph.intersections.get(j.id)!;
      // Bật đúng như `signalizeCityIntersections` làm: đó là toàn bộ thay đổi trên đồ thị.
      spec.signalized = true;
      spec.nsGreenSec = 16;
      spec.ewGreenSec = 14;
      spec.amberSec = 3;
      spec.allRedSec = 1.8;
      traffic.signals.registerIntersection(spec);
      phases.set(j.id, new Set());
    }
    // 60 giây mô phỏng = hơn một chu kỳ đèn (16 + 3 + 1,8 + 14 + 3 + 1,8 ≈ 39,6 s) nên phải thấy
    // đủ cả pha NS xanh lẫn EW xanh.
    for (let i = 0; i < 60 * 60; i += 1) {
      traffic.step({ dt: 1 / 60, playerX: 0, playerY: 1.7, playerZ: -60, playerYaw: 0, wetness: 0 });
      if (i % 60 !== 0) continue;
      for (const j of wanted) {
        const ns = traffic.signals.getAxisState(j.id, "ns");
        const ew = traffic.signals.getAxisState(j.id, "ew");
        const seen = phases.get(j.id)!;
        seen.add(`${ns.lamp}/${ew.lamp}`);
      }
    }
    for (const [id, seen] of phases) {
      // Trong 40 giây phải thấy ít nhất hai tổ hợp pha (ví dụ NS xanh rồi EW xanh) — nếu chỉ một
      // thì đèn đứng yên và đó là lỗi.
      expect(seen.size, `ngã tư ${id} không đổi pha`).toBeGreaterThan(1);
    }
  });
});
