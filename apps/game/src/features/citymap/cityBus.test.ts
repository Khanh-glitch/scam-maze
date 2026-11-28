// BUS 06 PHẢI CHẠY NỐI TIẾP qua phố thủ tục — bằng `BusCircuit` + `BusRouteController` của engine,
// không phải một vòng lặp xe buýt viết riêng.
//
// Test này không cần WebGL: `buildCityBusCircuit` chỉ đọc đồ thị, và `BusRouteController` là mô phỏng
// thuần. Nếu vòng không nối được (thiếu cung, sai chiều) thì `buildCityBusCircuit` trả `null` và chặng
// đường bộ 6.07 → đại lộ thành phố coi như không có.

import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { extendTrafficGraph } from "./cityTraffic";
import { SaigonTrafficManager } from "../testbus/openworld/traffic";
import { BUS06_ROUTE_EDGES } from "../testbus/openworld/traffic/busCircuit";
import { CITY_BUS_BASE_EDGES, CITY_BUS_ID, buildCityBusCircuit, createCityBusMotion, stepCityBusMotion } from "./cityBus";

describe("Bus 06 mở rộng qua thành phố", () => {
  const city = generateCity(undefined, { realWorld: true });
  const traffic = new SaigonTrafficManager();
  const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 520, maxCorridors: 10 });

  it("bản sao tuyến gốc không lệch khỏi tuyến 06 của map chuẩn", () => {
    // Sao chép là **hợp đồng**: nếu tuyến 06 của map chuẩn đổi, vòng thành phố phải được nối lại.
    expect([...CITY_BUS_BASE_EDGES]).toEqual([...BUS06_ROUTE_EDGES]);
  });

  it("vòng thành phố nối tiếp tuyến gốc và đi qua làn của phố thủ tục", () => {
    const built = buildCityBusCircuit(traffic.graph, ext.edgeIds);
    expect(built).not.toBeNull();
    const ids = built!.edgeIds;
    // Bắt đầu ở đúng tuyến 06 của map chuẩn.
    expect(ids[0]).toBe("LTT_S_SB");
    // Có ít nhất hai làn của phố thủ tục, và chúng nằm ngoài đất map chuẩn.
    const cityEdges = ids.filter((id) => id.startsWith("CTY_"));
    expect(cityEdges.length).toBeGreaterThanOrEqual(2);
    // Vòng có chiều dài thật (không phải 0 hay một cung cụt).
    expect(built!.circuit.length).toBeGreaterThan(300);
    // Mọi cặp liên tiếp đều có cung trong đồ thị — nếu không `BusCircuit` đã ném lỗi.
    for (let i = 0; i < ids.length; i += 1) {
      const from = ids[i];
      const to = ids[(i + 1) % ids.length];
      expect(traffic.graph.turns.has(`${from}__${to}`), `${from} → ${to}`).toBe(true);
    }
  });

  it("vòng quay đầu của tuyến thành phố nằm trong vòng, không phải cung bịa", () => {
    const built = buildCityBusCircuit(traffic.graph, ext.edgeIds)!;
    const kinds = built.circuit.segments.filter((s) => s.kind === "turn").map((s) => s.turn!.kind);
    expect(kinds).toContain("uturn");
    // Mọi cung của vòng đều là cung có thật trong đồ thị của engine.
    for (const seg of built.circuit.segments) {
      if (seg.kind === "turn") expect(traffic.graph.turns.get(seg.id)).toBeDefined();
      else expect(traffic.graph.edges.get(seg.id)).toBeDefined();
    }
  });

  it("xe buýt chạy được trên vòng: rời bến, không nhảy vị trí, không vượt ẩu", () => {
    const built = buildCityBusCircuit(traffic.graph, ext.edgeIds)!;
    // Đi đúng đường mà `/saigon` đi: đăng ký vòng riêng cho agent, đặt xe, rồi mỗi khung gọi
    // `planBus06` (luật của engine) + `stepCityBusMotion` (tích phân hình học) — không Three.js.
    traffic.registerExtraBus(CITY_BUS_ID, built.circuit);
    const seg = built.circuit.segmentAt(20);
    traffic.spawnVehicle({
      id: CITY_BUS_ID,
      category: "bus",
      edgeId: seg.edge?.id ?? built.circuit.segments[0].id,
      s: 20,
      halfWidth: 1.32,
      halfLength: 5.55,
    });
    const motion0 = createCityBusMotion(built.circuit);
    traffic.syncBus06(motion0.x, motion0.z, Math.PI + motion0.yaw, 0, 0, undefined, undefined, CITY_BUS_ID, built.circuit);
    let motion = motion0;

    let travelled = 0;
    let maxJump = 0;
    let maxSpeed = 0;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (let i = 0; i < 900; i += 1) {
      const plan = traffic.planBus06(motion.x, motion.z, 11.5, {
        yaw: Math.PI + motion.yaw,
        agentId: CITY_BUS_ID,
        circuit: built.circuit,
        aggressive: true,
      });
      const next = stepCityBusMotion(built.circuit, motion, 1 / 60, plan);
      maxJump = Math.max(maxJump, Math.hypot(next.x - motion.x, next.z - motion.z));
      travelled += Math.hypot(next.x - motion.x, next.z - motion.z);
      maxSpeed = Math.max(maxSpeed, next.speed);
      minLat = Math.min(minLat, next.lat);
      maxLat = Math.max(maxLat, next.lat);
      motion = next;
      traffic.syncBus06(motion.x, motion.z, Math.PI + motion.yaw, motion.speed, 0, undefined, undefined, CITY_BUS_ID, built.circuit);
      traffic.step({ dt: 1 / 60, playerX: 0, playerY: 1.7, playerZ: -60, playerYaw: 0, wetness: 0 });
    }
    // 15 giây: xe buýt phải đi được một quãng thật (không kẹt ở đầu vòng).
    expect(travelled).toBeGreaterThan(60);
    // Không nhảy vị trí: một khung 1/60 s ở 12 m/s chỉ đi được ~0,2 m.
    expect(maxJump).toBeLessThan(1.5);
    // Có chạy thật, nhưng không vượt ẩu.
    expect(maxSpeed).toBeGreaterThan(4);
    expect(maxSpeed).toBeLessThan(16);
    // Bám trong lòng đường: lệch ngang không vượt nửa bề rộng làn + lề.
    expect(maxLat - minLat).toBeLessThan(6);
    expect(Number.isFinite(motion.x)).toBe(true);
    expect(Number.isFinite(motion.z)).toBe(true);
    // Agent trong bộ mô phỏng bám theo xe.
    const agent = traffic.vehicles.find((v) => v.id === CITY_BUS_ID)!;
    expect(Math.hypot(agent.x - motion.x, agent.z - motion.z)).toBeLessThan(6);
  });

  it("không cấy thành phố thì không có vòng thứ hai (giữ `/testbus` nguyên)", () => {
    // `extendTrafficGraph` không được gọi ⇒ đồ thị y như map chuẩn, và `buildCityBusCircuit` không
    // tìm được làn thành phố nào để nối.
    const fresh = new SaigonTrafficManager();
    expect(buildCityBusCircuit(fresh.graph, [])).toBeNull();
    expect(fresh.busCircuit.length).toBeGreaterThan(0);
    expect(fresh.busCircuit.segments.filter((s) => s.kind === "edge").map((s) => s.id)).toEqual([
      ...BUS06_ROUTE_EDGES,
    ]);
  });
});
