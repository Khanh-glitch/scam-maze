// MẠNG ĐƯỜNG CỦA THÀNH PHỐ phải là một lưới **thật** trên đồ thị của engine, không phải những
// tuyến cụt rời rạc.
//
// Ba thứ có thể hỏng mà mắt không thấy khi chỉ nhìn ảnh: ngã tư không được nối (xe chạy hết tuyến rồi
// quay đầu mãi), cổng của map chuẩn không nối được vào lưới (đi bộ ra khỏi 6.07 là hết đường), và đồ
// thị phình to quá ngân sách mỗi khung.

import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { extendTrafficGraph } from "./cityTraffic";
import { SaigonTrafficManager } from "../testbus/openworld/traffic";
import { realWorldFootprintUnion } from "./realWorldFootprint";

const build = () => {
  const city = generateCity(undefined, { realWorld: true });
  const traffic = new SaigonTrafficManager();
  const before = traffic.graph.edges.size;
  const t0 = performance.now();
  const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 520, maxCorridors: 10 });
  return { city, traffic, ext, before, buildMs: performance.now() - t0 };
};

describe("mạng đường thành phố", () => {
  const { traffic, ext, before } = build();
  const graph = traffic.graph;

  it("nằm ngoài đất của map chuẩn — không chồng lên đường dựng tay", () => {
    const fp = realWorldFootprintUnion();
    let checked = 0;
    for (const id of ext.edgeIds) {
      const edge = graph.edges.get(id)!;
      for (const p of [edge.start, edge.end]) {
        const inside = p.x > fp.x0 && p.x < fp.x1 && p.z > fp.z0 && p.z < fp.z1;
        expect(inside).toBe(false);
        checked += 1;
      }
    }
    expect(checked).toBe(ext.edgeIds.length * 2);
  });

  it("mỗi ngã tư có ít nhất một cặp vào–ra, không có node rỗng", () => {
    expect(ext.junctions.length).toBeGreaterThan(4);
    for (const j of ext.junctions) {
      const inter = graph.intersections.get(j.id);
      expect(inter).toBeDefined();
      expect(inter!.turnIds.length).toBeGreaterThan(0);
      // Tâm giao lộ phải nằm gần đúng toạ độ đã báo (dùng để đặt đèn).
      expect(Math.hypot(inter!.center.x - j.x, inter!.center.z - j.z)).toBeLessThan(60);
    }
  });

  it("có ngã tư **thật** — hai tuyến vuông góc cắt nhau và rẽ được", () => {
    let crossings = 0;
    let leftRight = 0;
    for (const j of ext.junctions) {
      const turnIds = graph.intersections.get(j.id)?.turnIds ?? [];
      const corridors = new Set<string>();
      for (const id of turnIds) {
        const turn = graph.turns.get(id);
        if (!turn) continue;
        const from = graph.edges.get(turn.fromEdgeId);
        const to = graph.edges.get(turn.toEdgeId);
        if (!from || !to) continue;
        // Cung rẽ: hướng vào và hướng ra khác nhau đáng kể.
        if (Math.abs(from.tx * to.tx + from.tz * to.tz) < 0.6) crossings += 1;
        // Cung rẽ phải/trái phải tồn tại: đó là thứ engine dùng để giảm tốc vào cua.
        if (turn.kind === "right" || turn.kind === "left") leftRight += 1;
        corridors.add(turn.fromEdgeId.split("_")[1]);
        corridors.add(turn.toEdgeId.split("_")[1]);
      }
      if (corridors.size >= 2) expect(turnIds.length).toBeGreaterThan(1);
    }
    expect(crossings).toBeGreaterThan(3);
    expect(leftRight).toBeGreaterThan(8);
  });

  it("nối được vào cổng của map chuẩn, cả hai chiều", () => {
    expect(ext.portals.length).toBeGreaterThan(0);
    // Cổng phải có cung **rời** cổng (xe đi tiếp ra phố thành phố) và cung **về** cổng (xe từ phố
    // quay lại map dựng tay).
    const outOfPortal = [...graph.turns.values()].filter(
      (t) => t.fromEdgeId.endsWith("_SB") && t.toEdgeId.startsWith("CTY_"),
    );
    const intoPortal = [...graph.turns.values()].filter(
      (t) => t.fromEdgeId.startsWith("CTY_") && t.toEdgeId.endsWith("_SB"),
    );
    expect(outOfPortal.length).toBeGreaterThan(0);
    expect(intoPortal.length).toBeGreaterThan(0);
    // Mỗi cổng đã nối phải là cổng thật của đồ thị, không phải id bịa.
    for (const id of ext.portals) expect(graph.intersections.has(id)).toBe(true);
  });

  it("đồ thị không phình: số làn và chi phí dựng trong ngân sách", () => {
    // Mười tuyến, chia theo ngã tư ⇒ dưới 80 làn. Nhiều hơn thì bộ mô phỏng duyệt quá nhiều cung.
    expect(ext.edgeIds.length).toBeLessThan(80);
    expect(graph.edges.size).toBe(before + ext.edgeIds.length);
    expect(ext.edgeIds.length % 2).toBe(0);
  });
});
