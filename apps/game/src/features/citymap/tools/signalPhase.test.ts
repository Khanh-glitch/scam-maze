import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { generateCity } from "../cityGen";
import { extendTrafficGraph } from "../cityTraffic";
import { signalizeCityIntersections } from "../citySignals";
import { SaigonTrafficManager } from "../../testbus/openworld/traffic";

/**
 * L5 — XE DỪNG ĐÈN ĐỎ PHẢI HỢP LÍ: ngã tư có PHA THẬT, và xe dừng TRƯỚC VẠCH.
 *
 * Trước bản vá, `signalizeCityIntersections` bật `signalized` cho đúng `maxIntersections` ngã tư
 * (mặc định 3, game thật 12 trên 15 ngã tư thật). Ngã tư `signalized === false` được
 * `TrafficSignalController.update` trả "xanh 99" cho **cả hai** trục, nên hai dòng xe của hai phố
 * cắt nhau đi thẳng vào nhau: đo được hai xe chỉ còn cách nhau **2,3 m** ở `CTYJ_1_8` trong khi cả
 * hai vẫn chạy 8–11 m/s. Nhìn từ phía người chơi đó là "dừng đèn đỏ không hợp lí" — vì không có đèn.
 *
 * Bản vá tách hai thứ vốn bị buộc vào nhau:
 *   · **PHA** (`signalized` + `registerIntersection`) là số học trong bộ điều khiển — rẻ, bật cho
 *     mọi ngã tư thật (trần `maxPhases`, mặc định không trần).
 *   · **CỘT ĐÈN** là hình học (GLB + shader mỗi cột) — vẫn giữ trần `maxIntersections`.
 *
 * Số đo: **15/15** ngã tư thật có pha; khoảng cách nhỏ nhất hai xe khác trục ở `CTYJ_1_8`:
 * 2,28 m → **19,1 m**; xe gặp đỏ đứng yên cách tim ngã tư 4–24 m (trước vạch, không vào hộp).
 */
describe("pha đèn ngã tư thành phố", () => {
  const build = () => {
    const city = generateCity(undefined, { realWorld: true });
    const traffic = new SaigonTrafficManager();
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 900, maxCorridors: 24 });
    return { traffic, ext };
  };

  it("nhãn trục của cạnh khớp hướng chạy — đèn đọc đúng trục", () => {
    // Bản trước gán `axis = alongZ ? "ew" : "ns"` (ngược). `TurnArc.axis = from.axis`, nên xe chạy
    // dọc phố bắc–nam lại xin đèn trục đông–tây: vượt đèn đỏ hoặc dừng khi trục mình đang xanh.
    const { traffic, ext } = build();
    const g = traffic.graph;
    const cityEdges = ext.edgeIds.map((id) => g.edges.get(id)!).filter(Boolean);
    expect(cityEdges.length).toBeGreaterThan(80);
    const mismatched = cityEdges.filter((e) => {
      const alongZ = Math.abs(e.tz) > Math.abs(e.tx);
      return alongZ ? e.axis !== "ns" : e.axis !== "ew";
    });
    expect(mismatched.map((e) => `${e.id} axis=${e.axis}`)).toEqual([]);
    // Và mọi cung của ngã tư thành phố cũng phải theo nhãn ấy.
    const turns = [...g.turns.values()].filter((t) => t.fromEdgeId.startsWith("CTY"));
    const badTurns = turns.filter((t) => g.edges.get(t.fromEdgeId)!.axis !== t.axis);
    expect(badTurns.length).toBe(0);
  });

  it("mọi ngã tư thật có pha, kể cả khi không dựng cột đèn nào", () => {
    const { traffic, ext } = build();
    const signals = signalizeCityIntersections(traffic.graph, traffic, {
      parent: new THREE.Group(),
      junctions: ext.junctions,
      // Không dựng cột nào: pha là số học, không phải hình học (test không có canvas 2D của jsdom).
      maxIntersections: 0,
    });
    const real = ext.junctions.filter((j) => !j.id.startsWith("CTYEND_"));
    expect(signals.signalized.length).toBe(real.length);
    expect(signals.poles).toBe(0);

    // Đèn **thật sự đổi màu**, không phải xanh vĩnh viễn: một chu kỳ ≈ 39,6 s.
    const id = real[0].id;
    const seen = new Set<string>();
    for (let t = 0; t < 80; t += 0.25) {
      traffic.signals.update(t);
      seen.add(traffic.signals.getAxisState(id, "ns").lamp);
      seen.add(traffic.signals.getAxisState(id, "ew").lamp);
    }
    expect([...seen].sort()).toEqual(["amber", "green", "red"]);
  });

  it("trần pha và trần cột đèn là hai thứ riêng", () => {
    const { traffic, ext } = build();
    const limited = signalizeCityIntersections(traffic.graph, traffic, {
      parent: new THREE.Group(),
      junctions: ext.junctions,
      maxIntersections: 0,
      maxPhases: 2,
    });
    // Chỉ hai ngã tư có pha ⇒ hai ngã tư đó phải đổi màu, ngã tư thứ ba thì không (xanh 99).
    const real = ext.junctions.filter((j) => !j.id.startsWith("CTYEND_"));
    expect(limited.signalized.length).toBe(2);
    const third = real.find((j) => !limited.signalized.includes(j.id))!;
    traffic.signals.update(10);
    const stale = traffic.signals.getAxisState(third.id, "ns");
    expect(stale.lamp).toBe("green");
    expect(stale.countdown).toBe(99);
  });

  it("hai xe khác trục không cắt vào nhau ở ngã tư, và xe gặp đỏ dừng trước vạch", () => {
    const { traffic, ext } = build();
    signalizeCityIntersections(traffic.graph, traffic, {
      parent: new THREE.Group(),
      junctions: ext.junctions,
      maxIntersections: 0,
    });
    const g = traffic.graph;
    const J = "CTYJ_1_8";
    const junction = g.intersections.get(J)!;
    expect(junction.signalized).toBe(true);

    const incoming = [...g.turns.values()].filter((t) => t.intersectionId === J);
    const nsEdge = incoming.map((t) => t.fromEdgeId).find((id) => Math.abs(g.edges.get(id)!.tz) > 0.8)!;
    const ewEdge = incoming.map((t) => t.fromEdgeId).find((id) => Math.abs(g.edges.get(id)!.tx) > 0.8)!;
    expect(Boolean(nsEdge && ewEdge)).toBe(true);

    const spawn = (id: string, edgeId: string) => {
      const e = g.edges.get(edgeId)!;
      traffic.spawnVehicle({ id, category: "car", edgeId, s: e.length - 14, halfWidth: 0.92, halfLength: 2.2 });
    };
    spawn("X", nsEdge);
    spawn("Y", ewEdge);

    const step = { dt: 1 / 60, playerX: 9999, playerY: 1.7, playerZ: 9999, playerYaw: 0, wetness: 0.1 };
    let minDist = Infinity;
    let stoppedAtRed = 0;
    let tooCloseToCentre = 0;
    for (let i = 0; i < 900; i += 1) {
      traffic.step(step);
      traffic.signals.update(i / 60);
      const vx = traffic.vehicles.find((v) => v.id === "X");
      const vy = traffic.vehicles.find((v) => v.id === "Y");
      if (vx && vy) minDist = Math.min(minDist, Math.hypot(vx.x - vy.x, vx.z - vy.z));
      for (const [v, axis] of [
        [vx, "ns"],
        [vy, "ew"],
      ] as const) {
        if (!v || v.speed > 0.2) continue;
        const lamp = traffic.signals.getAxisState(J, axis).lamp;
        const toCentre = Math.hypot(v.x - junction.center.x, v.z - junction.center.z);
        if (lamp === "red" && toCentre > 4 && toCentre < 24) stoppedAtRed += 1;
        // Không ai được đứng trong hộp ngã tư.
        if (toCentre <= 3) tooCloseToCentre += 1;
      }
    }
    console.log(
      JSON.stringify({
        "khoảng cách nhỏ nhất hai xe khác trục (m)": +minDist.toFixed(2),
        "mẫu dừng đèn đỏ trước vạch": stoppedAtRed,
        "mẫu đứng trong hộp ngã tư": tooCloseToCentre,
      }),
    );
    // Trước bản vá: 2,28 m. Xe 4,4 × 1,84 m ⇒ dưới 6 m là đã chồng thân.
    expect(minDist).toBeGreaterThan(6);
    expect(tooCloseToCentre).toBe(0);
    expect(stoppedAtRed).toBeGreaterThan(0);
  });
});
