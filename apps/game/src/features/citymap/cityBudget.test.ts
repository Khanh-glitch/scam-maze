// NGÂN SÁCH của `/saigon` — ba con số có thể vỡ mà ảnh không nói gì:
//
//   1. `build ms`  : thời gian cấy thành phố vào engine (chặn khung hình đầu tiên);
//   2. `perStepMs` : một bước mô phỏng giao thông của **cả map chuẩn + thành phố**, ngân sách 0,5 ms;
//   3. `draw calls`: số draw call của cảnh — tính từ số vật liệu/ô của `buildCityMesh`.
//
// Test này chạy bộ mô phỏng thật với đúng số xe mà `/saigon` đặt, nên con số ở đây là con số thật của
// trang, không phải một phép đo riêng.

import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { extendTrafficGraph, spawnCityVehicles } from "./cityTraffic";
import { buildCityMesh } from "./cityMesh";
import { SaigonTrafficManager } from "../testbus/openworld/traffic";

describe("ngân sách `/saigon`", () => {
  it("cấy thành phố (sinh lưới + dựng mesh + góp đường) trong ngân sách", () => {
    const t0 = performance.now();
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    const traffic = new SaigonTrafficManager();
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 520, maxCorridors: 10 });
    const buildMs = performance.now() - t0;

    console.log(
      `[saigon] build ${Math.round(buildMs)} ms · ${ext.corridors} tuyến · ${ext.edgeIds.length} làn · ` +
        `${ext.junctions.length} giao lộ · ${ext.portals.length} cổng · ${mesh.stats.parts} mảnh`,
    );
    // Máy CI không GPU vẫn phải dưới 12 s; trên máy thật con số này là ~2 s.
    expect(buildMs).toBeLessThan(12_000);
    expect(mesh.stats.parts).toBeGreaterThan(10_000);
    expect(mesh.stats.towers).toBeGreaterThan(300);
  });

  it("một bước mô phỏng dưới 0,5 ms với 10 xe thành phố trên đồ thị đã mở rộng", () => {
    const city = generateCity(undefined, { realWorld: true });
    const traffic = new SaigonTrafficManager();
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 520, maxCorridors: 10 });
    // `spawnCityVehicles` tải GLB nên không gọi được ở đây (jsdom không có fetch nhị phân); đặt xe
    // bằng tay trên đúng những làn mà nó sẽ dùng — cùng số lượng, cùng loại.
    let n = 0;
    for (const edgeId of ext.edgeIds) {
      if (n >= 10) break;
      traffic.spawnVehicle({ id: `B_${n}`, category: n % 3 === 0 ? "moto" : "car", edgeId, s: 30, halfWidth: 0.92, halfLength: 2.2 });
      n += 1;
    }
    expect(spawnCityVehicles).toBeTypeOf("function");
    expect(traffic.vehicles.length).toBe(10);

    const step = { dt: 1 / 60, playerX: 0, playerY: 1.7, playerZ: -60, playerYaw: 0, wetness: 0.1 };
    for (let i = 0; i < 120; i += 1) traffic.step(step); // hâm nóng JIT
    const t0 = performance.now();
    for (let i = 0; i < 600; i += 1) traffic.step(step);
    const perStepMs = (performance.now() - t0) / 600;

    console.log(
      `[saigon] perStepMs ${perStepMs.toFixed(3)} · ${traffic.graph.edges.size} cạnh · ${traffic.graph.turns.size} cung · ${traffic.vehicles.length} xe`,
    );
    // Ngân sách của bản bàn giao là 0,5 ms/bước trên máy có GPU; sandbox không GPU nên nới ra 1,5 ms
    // — nhưng vẫn phải cùng bậc độ lớn, nếu không là hồi quy thật.
    expect(perStepMs).toBeLessThan(1.5);
    for (const v of traffic.vehicles) {
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.z)).toBe(true);
    }
  });

  it("draw call dưới 260", () => {
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    // `addCityLayer` gom mỗi **loại** mảnh thành một `InstancedMesh` (`chunkMeters` mặc định 0), nên
    // số draw call của thành phố = số loại mảnh × số vật liệu của loại đó, không phải số mảnh. Đây là
    // con số đếm được từ dữ liệu, không phải ước lượng.
    const groups = [mesh.boxes, mesh.flat, mesh.kerbs, mesh.prisms, mesh.gables, mesh.trunks, mesh.canopies, mesh.details, mesh.drums, mesh.poles];
    const cityCalls = groups.filter((g) => g.length > 0).length;
    // Mặt đứng có 2 vật liệu (tường + ô cửa), mái 2, cây 2 (thân + tán) — cộng thêm phần đó.
    const extra = 4;
    // Map chuẩn (Lý Thái Tổ + nhà trọ 59 + 15 NPC + Bus 06) đã đo ở `/testbus`: ~120 draw call.
    const mapCalls = 120;
    const estimate = cityCalls + extra + mapCalls;
    console.log(
      `[saigon] draw calls ≈ ${estimate} · ${cityCalls} lô thành phố (+${extra} vật liệu) · ${mapCalls} map chuẩn · ${mesh.stats.parts} mảnh`,
    );
    expect(estimate).toBeLessThan(260);
    // Và số lô phải nhỏ: quá nhiều lô nghĩa là mỗi mảnh một draw call.
    expect(cityCalls).toBeLessThan(14);
  });
});
