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
import { CITY_BUS_BASE_EDGES, buildCityBusCircuit } from "./cityBus";

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
