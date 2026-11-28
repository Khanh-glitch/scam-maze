import { describe, expect, it } from "vitest";
import { generateCity } from "../cityGen";
import { extendTrafficGraph } from "../cityTraffic";
import { SaigonTrafficManager } from "../../testbus/openworld/traffic";

/**
 * HAI CHIỀU PHẢI NẰM HAI NỬA ĐƯỜNG — đo bằng xe THẬT chạy, không bằng suy luận dấu.
 *
 * Bài học: tôi đã ba lần "suy ra" dấu của `carLaneOffsets` từ công thức pháp tuyến và ba lần sai,
 * vì `r` trong cấu trúc cạnh không cùng quy ước với pháp tuyến dùng để vẽ đường. Test này chỉ đo
 * một thứ không thể cãi: khoảng cách **ngang** của xe so với tim tuyến mà `cityGen` sinh ra.
 */
describe("làn xe thành phố", () => {
  it("mỗi chiều nằm ở nửa đường của mình, cách tim tuyến ≤ nửa bề rộng", () => {
    const city = generateCity(undefined, { realWorld: true });
    const traffic = new SaigonTrafficManager();
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 900, maxCorridors: 24 });
    const g = traffic.graph;

    // Tuyến dọc z của lưới: tim ở x = 0 (Lý Thái Tổ của thành phố). Hai chiều của nó phải nằm hai
    // bên x = 0, mỗi bên ≤ widthM / 2.
    const pairs: Array<[string, string]> = [];
    for (const id of g.edges.keys()) {
      const m = /^(CTY_\d+_\d+)_A$/.exec(id);
      if (m && g.edges.has(`${m[1]}_B`)) pairs.push([id, `${m[1]}_B`]);
    }
    expect(pairs.length).toBeGreaterThan(40);

    const step = { dt: 1 / 60, playerX: 0, playerY: 1.7, playerZ: -60, playerYaw: 0, wetness: 0 };
    const latOf = (streetId: string, v: { x: number; z: number }) => {
      // Tim tuyến: đường vuông góc qua TRUNG ĐIỂM hai đầu cạnh A và B (hai mép cùng mặt cắt).
      // Pháp tuyến LUÔN lấy từ cạnh `_A` — dùng pháp tuyến của cạnh B (chạy ngược) sẽ lật dấu và
      // biến "hai phía" thành "cùng phía". Đây đúng là lỗi đã làm tôi sửa sai ba lần.
      const a = g.edges.get(`${streetId}_A`)!;
      const b = g.edges.get(`${streetId}_B`)!;
      const mid = { x: (a.start.x + b.start.x) / 2, z: (a.start.z + b.start.z) / 2 };
      return (v.x - mid.x) * -a.tz + (v.z - mid.z) * a.tx;
    };

    let checked = 0;
    let sameSide = 0;
    let outside = 0;
    const bad: string[] = [];
    for (const [aId, bId] of pairs.slice(0, 40)) {
      const t = new SaigonTrafficManager();
      extendTrafficGraph(t.graph, city, { near: { x: 0, z: -60 }, radiusM: 900, maxCorridors: 24 });
      const ea = t.graph.edges.get(aId);
      const eb = t.graph.edges.get(bId);
      if (!ea || !eb) continue;
      t.spawnVehicle({ id: "VA", category: "car", edgeId: aId, s: ea.length * 0.5, halfWidth: 0.9, halfLength: 2.2 });
      t.spawnVehicle({ id: "VB", category: "car", edgeId: bId, s: eb.length * 0.5, halfWidth: 0.9, halfLength: 2.2 });
      for (let i = 0; i < 20; i += 1) t.step(step);
      const va = t.vehicles.find((v) => v.id === "VA");
      const vb = t.vehicles.find((v) => v.id === "VB");
      if (!va || !vb) continue;
      const street = aId.replace(/_A$/, "");
      const la = latOf(street, va);
      const lb = latOf(street, vb);
      const halfW = ea.width / 2;
      checked += 1;
      if (Math.sign(la) === Math.sign(lb)) {
        sameSide += 1;
        if (bad.length < 5) bad.push(`${aId.replace(/_A$/, "")} A=${la.toFixed(2)} B=${lb.toFixed(2)} cùng phía`);
      }
      if (Math.abs(la) > halfW + 0.6 || Math.abs(lb) > halfW + 0.6) {
        outside += 1;
        if (bad.length < 5) bad.push(`${aId} lệch làn ${Math.max(Math.abs(la), Math.abs(lb)).toFixed(2)} > ${halfW.toFixed(1)}`);
      }
    }
    console.log(JSON.stringify({ "cặp đo": checked, "cùng phía": sameSide, "tràn ra ngoài đường": outside, mau: bad }, null, 1));
    expect(bad).toEqual([]);
    expect(sameSide).toBe(0);
  });
});
