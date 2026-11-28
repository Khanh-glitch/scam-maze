// Giao thông trên phố THỦ TỤC phải do chính bộ mô phỏng của map chuẩn lái, và phải rẻ.
//
// Test này chạy `SaigonTrafficManager` thật (không cần WebGL), góp tuyến của `generateCity()` vào
// đồ thị của nó, đặt xe lên rồi bước 900 khung. Nó bắt đúng ba thứ có thể hỏng mà không thấy được
// bằng mắt: (1) tuyến thành phố không vào được đồ thị, (2) xe kẹt/NaN ở đầu phố cụt, (3) chi phí
// mỗi khung vượt ngân sách.

import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { extendTrafficGraph } from "./cityTraffic";
import { SaigonTrafficManager } from "../testbus/openworld/traffic";

describe("giao thông trên phố thủ tục", () => {
  const city = generateCity(undefined, { realWorld: true });

  it("góp được tuyến của thành phố vào đồ thị của map chuẩn", () => {
    const traffic = new SaigonTrafficManager();
    const before = traffic.graph.edges.size;
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 520, maxCorridors: 10 });
    expect(ext.corridors).toBeGreaterThan(0);
    // Mỗi tuyến được chia thành nhiều **đoạn** (mỗi ngã tư là một mối nối), và mỗi đoạn có đúng hai
    // làn ngược chiều. Nên tổng số làn là bội của 2, và nhiều hơn 2 lần số tuyến.
    expect(ext.edgeIds.length % 2).toBe(0);
    expect(ext.edgeIds.length).toBeGreaterThanOrEqual(ext.corridors * 2);
    // Vào đúng đồ thị ấy — không phải đồ thị thứ hai.
    expect(traffic.graph.edges.size).toBe(before + ext.edgeIds.length);
    for (const id of ext.edgeIds) {
      const edge = traffic.graph.edges.get(id);
      expect(edge).toBeDefined();
      expect(edge!.length).toBeGreaterThan(8);
      // Mọi làn đều phải có lối ra: cung đi tiếp/rẽ ở ngã tư, hoặc cung quay đầu ở đầu cụt.
      expect(edge!.outgoingTurns.length).toBeGreaterThan(0);
    }
    // Đồ thị có **ngã tư thật** (không chỉ đường cụt): node > 2 nhánh.
    const junctionIds = new Set(ext.junctions.map((j) => j.id));
    expect(junctionIds.size).toBeGreaterThan(4);
    // Và phố thủ tục nối được vào cổng của map chuẩn.
    expect(ext.portals.length).toBeGreaterThan(0);
  });

  it("xe chạy được trên tuyến thủ tục, không kẹt, không NaN, và đủ rẻ", () => {
    const traffic = new SaigonTrafficManager();
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 520, maxCorridors: 10 });
    let n = 0;
    for (const edgeId of ext.edgeIds) {
      if (n >= 12) break;
      traffic.spawnVehicle({
        id: `T_${n}`,
        category: "car",
        edgeId,
        s: 20,
        halfWidth: 0.92,
        halfLength: 2.2,
      });
      n += 1;
    }
    expect(traffic.vehicles.length).toBe(12);

    const start = traffic.vehicles.map((v) => ({ x: v.x, z: v.z }));
    const t0 = performance.now();
    for (let i = 0; i < 900; i += 1) {
      traffic.step({ dt: 1 / 60, playerX: 0, playerY: 1.7, playerZ: -60, playerYaw: 0, wetness: 0.1 });
    }
    const perStepMs = (performance.now() - t0) / 900;

    for (const v of traffic.vehicles) {
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.z)).toBe(true);
      expect(Number.isFinite(v.speed ?? 0)).toBe(true);
    }
    // Ít nhất một nửa số xe phải đã rời chỗ đứng — nếu không thì chúng kẹt ở đầu phố cụt.
    const moved = traffic.vehicles.filter((v, i) => Math.hypot(v.x - start[i].x, v.z - start[i].z) > 5).length;
    expect(moved).toBeGreaterThanOrEqual(6);

    // Ngân sách CPU: 12 xe + toàn bộ luật của map chuẩn. 16 xe là con số dùng trong thành phố.
    expect(perStepMs).toBeLessThan(4);
  });
});
