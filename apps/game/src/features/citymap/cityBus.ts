/**
 * BUS 06 CHẠY THÊM MỘT VÒNG QUA CÁC TRỤC CỦA THÀNH PHỐ.
 *
 * Map chuẩn có tuyến Bus 06 của riêng nó: `BUS06_ROUTE_EDGES` (Lý Thái Tổ → Vinhomes → về), một
 * `BusCircuit` dựng từ đồ thị đường, và một `BusRouteController` lái nó. Ở đây **không** viết vòng
 * lặp xe buýt thứ hai và cũng không sửa tuyến cũ: dựng thêm **một** `BusCircuit` trên cùng đồ thị —
 * vòng này rời map dựng tay ở ngã tư Lý Thái Tổ × đại lộ phía nam, chạy hết tuyến thành phố, quay
 * đầu bằng cung `uturn` của `extendTrafficGraph`, rồi về — và cho **đúng** `BusRouteController` của
 * engine lái nó, với **đúng** `planBus06`/`syncBus06` của engine canh đèn, xe trước mặt và người đi
 * bộ.
 *
 * Nhờ vậy:
 *  - luật dừng / nhường đường / đèn QCVN 41:2024 là luật của engine, không phải bản viết lại;
 *  - xe buýt thành phố nằm trong `traffic.vehicles`, nên ACC/IDM+ và va chạm OBB của engine thấy nó;
 *  - tuyến cũ ở `/testbus` không đổi một dòng nào (module này chỉ `SaigonEnginePage` gọi).
 */
import * as THREE from "three";
import { BusCircuit } from "../testbus/openworld/traffic/busCircuit";
import type { SaigonRoadGraph } from "../testbus/openworld/traffic/roadGraph";
import type { SaigonTrafficManager } from "../testbus/openworld/traffic";
import { BusRouteController } from "../testbus/openworld/simulation/transit";
import { buildBus } from "../testbus/openworld/simulation/bus";

/** Id agent của xe buýt thành phố trong bộ mô phỏng. Bus 06 của map chuẩn là `BUS_06`. */
export const CITY_BUS_ID = "CITY_BUS_06";

/**
 * Bản sao tuyến Bus 06 của map chuẩn (`BUS06_ROUTE_EDGES`), dùng để nối vòng thành phố vào.
 *
 * Sao chép chứ không import: đây là **hợp đồng** — vòng thành phố phải bắt đầu và kết thúc ở đúng
 * những tuyến ấy, nên test trong `cityBus.test.ts` so hai danh sách với nhau và báo lỗi nếu tuyến
 * của map chuẩn đổi. Import trực tiếp thì test chỉ lặp lại chính nó.
 */
export const CITY_BUS_BASE_EDGES = [
  "LTT_S_NB",
  "LTT_M1_NB",
  "LTT_M2_NB",
  "LTT_N_NB",
  "VH_EB",
  "VH_WB",
  "LTT_N_SB",
  "DBP_W_EB",
  "HT_S_SB",
  "D32_W_WB",
  "LTT_S_SB",
] as const;

export interface CityBusOptions {
  /** Cha của mô hình xe buýt (thường là `engine.exteriorGroup`). */
  parent: THREE.Object3D;
  /** Lệch ngang khi chạy (m, + = phải) — cùng giá trị trạm Lý Thái Tổ dùng. */
  curbLat?: number;
}

export interface CityBus {
  circuit: BusCircuit;
  route: BusRouteController;
  /** Các đoạn đường của vòng, đúng thứ tự — test đối chiếu với đồ thị. */
  edgeIds: string[];
  root: THREE.Group | null;
  /** Gọi mỗi khung **sau** `traffic.step`, đúng chỗ engine gọi `syncBus06`. */
  update(dt: number): void;
  dispose(): void;
}

/** Hai tuyến này có cung nối trong đồ thị không (tức có ngã tư giữa chúng). */
function hasTurn(graph: SaigonRoadGraph, fromId: string, toId: string): boolean {
  return graph.turns.has(`${fromId}__${toId}`);
}

/**
 * Dựng vòng Bus 06 của thành phố trên **đồ thị đã mở rộng** (gọi sau `extendTrafficGraph`).
 *
 * Vòng đi **nối tiếp** tuyến của map chuẩn: từ `LTT_S_SB` (Lý Thái Tổ, chiều về nam) rẽ vào tuyến
 * thành phố gần nhất ở phía nam, chạy hết tuyến, quay đầu bằng cung `uturn` của `cityNetwork`, chạy
 * lại, rồi về `LTT_S_NB` để nhập lại vòng 06 cũ. Không có tuyến thành phố nào nối được thì trả `null`
 * — `/saigon` chạy tiếp với tuyến 06 của map chuẩn, không có vòng thứ hai.
 */
export function buildCityBusCircuit(
  graph: SaigonRoadGraph,
  cityEdgeIds: string[],
): { circuit: BusCircuit; edgeIds: string[] } | null {
  if (!cityEdgeIds.length) return null;
  const city = new Set(cityEdgeIds.filter((id) => graph.edges.has(id)));
  const legacyEntry = "LTT_S_SB";
  
  /** Làn của phố thành phố mà cổng `END_LTT_S` đổ vào (xe rời 6.07 đi thẳng vào đó). */
  const startEdges = [...graph.turns.values()]
    .filter((t) => t.fromEdgeId === legacyEntry && city.has(t.toEdgeId))
    .map((t) => t.toEdgeId);
  /** Làn thành phố chạy về được cổng (nhập lại vòng 06 của map chuẩn). */
  const targetEdges = new Set(
    [...graph.turns.values()].filter((t) => t.toEdgeId === legacyEntry && city.has(t.fromEdgeId)).map((t) => t.fromEdgeId),
  );
  if (!startEdges.length || !targetEdges.size) return null;

  // Đường đi ngắn nhất trên đồ thị từ làn vào tới làn về, đi qua **cung của engine** — nên vòng này
  // là một vòng thật của lưới (vào đại lộ, chạy hết, quay đầu, chạy lại, rồi về), không phải một
  // đường vẽ tay. Giới hạn độ sâu để không bao giờ đi vòng quanh cả thành phố.
  const MAX_EDGES = 10;
  const outgoing = new Map<string, string[]>();
  for (const t of graph.turns.values()) {
    if (!city.has(t.fromEdgeId) || !city.has(t.toEdgeId)) continue;
    const list = outgoing.get(t.fromEdgeId) ?? [];
    list.push(t.toEdgeId);
    outgoing.set(t.fromEdgeId, list);
  }
  let path: string[] | null = null;
  for (const start of startEdges) {
    const queue: string[][] = [[start]];
    const seen = new Set<string>([start]);
    while (queue.length && !path) {
      const cur = queue.shift()!;
      const last = cur[cur.length - 1];
      if (cur.length > 1 && targetEdges.has(last)) {
        path = cur;
        break;
      }
      if (cur.length >= MAX_EDGES) continue;
      for (const next of outgoing.get(last) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push([...cur, next]);
      }
    }
    if (path) break;
  }
  if (!path) {
    console.warn("[citymap] không tìm được vòng Bus 06 qua phố thành phố");
    return null;
  }

  const loop = [legacyEntry, ...path];
  for (let i = 0; i < loop.length; i += 1) {
    const from = loop[i];
    const to = loop[(i + 1) % loop.length];
    if (!hasTurn(graph, from, to)) {
      console.warn("[citymap] vòng Bus 06 thành phố thiếu cung nối", from, "→", to);
      return null;
    }
  }
  try {
    return { circuit: new BusCircuit(graph, loop), edgeIds: loop };
  } catch (err) {
    console.warn("[citymap] vòng Bus 06 thành phố không dựng được", err);
    return null;
  }
}

/**
 * Đặt xe buýt thành phố vào scene và nối nó với bộ mô phỏng của engine.
 *
 * Mô hình: GLB xe buýt của map chuẩn. Không tải được thì phần mô phỏng vẫn chạy (xe vô hình nhưng
 * vẫn chiếm đường, vẫn dừng đèn) — mất mô hình không được phép làm hỏng giao thông.
 */
export async function spawnCityBus(
  traffic: SaigonTrafficManager,
  circuit: BusCircuit,
  options: CityBusOptions,
): Promise<CityBus> {
  const route = new BusRouteController({ circuit });
  route.wait();
  route.update(0, { front: false, rear: false }, false);

  // MÔ HÌNH: chính `buildBus` của engine — cùng thân xe sơn xanh 06, cùng cửa trượt, cùng đèn, cùng
  // bánh. Không có GLB riêng cho xe buýt, và cũng không nên có: engine dựng nó bằng hình khối, nên
  // xe buýt thành phố trông y hệt xe buýt của map chuẩn.
  const bus = buildBus(options.parent as unknown as THREE.Scene, route, false);
  const root = bus.root;

  const curbLat = options.curbLat ?? 0.9;
  const pose = circuit.poseAt(route.d, curbLat);
  route.x = pose.x;
  route.z = pose.z;
  const seg = circuit.segmentAt(route.d);
  traffic.spawnVehicle({
    id: CITY_BUS_ID,
    category: "bus",
    edgeId: seg.edge?.id ?? circuit.segments[0].id,
    s: Math.max(1, route.d - seg.start),
    laneIndex: 1,
    halfWidth: 1.32,
    halfLength: 5.55,
    // Mô hình do `buildBus` lái (`bus.update`), nên `rig` để trống: nếu gắn rig, engine sẽ xoay thân
    // xe lần thứ hai trên cùng một vị trí.
    rig: null,
  });
  const agent = traffic.vehicles.find((v) => v.id === CITY_BUS_ID);
  if (agent) {
    // Vòng cập nhật của trang lái nó bằng `BusRouteController`, nên nó không đi theo ACC/IDM+.
    // Nhưng nó **vẫn** nằm trong `traffic.vehicles`: xe khác và người đi bộ nhìn thấy nó như xe buýt
    // 06 của map chuẩn (`externalControl` chỉ có nghĩa "vị trí do bên ngoài đặt").
    agent.externalControl = true;
    agent.x = pose.x;
    agent.z = pose.z;
    agent.yaw = Math.PI + pose.yaw;
  }

  return {
    circuit,
    route,
    edgeIds: circuit.segments.filter((s) => s.edge).map((s) => s.id),
    root,
    update(dt: number) {
      // Đúng chuỗi lệnh engine dùng trong `OpenWorldEngine.frame`: bộ mô phỏng lập kế hoạch tốc độ
      // (đèn, xe trước, người đi bộ) → `BusRouteController` chạy theo → đồng bộ lại vị trí cho mô
      // phỏng.
      const plan = traffic.planBus06(route.x, route.z, 11.5, { yaw: Math.PI + route.yaw });
      route.update(dt, { front: false, rear: false }, false, plan.speed, { lat: plan.lat });
      traffic.syncBus06(route.x, route.z, Math.PI + route.yaw, route.speed, route.accel, undefined, undefined, CITY_BUS_ID);
      // `buildBus` tự đặt `root.position/rotation` từ `route` và tự xoay bánh theo `route.speed`;
      // gọi nó là đủ, không tự dựng lại phép biến đổi ở đây.
      bus.update(dt);
    },
    dispose() {
      bus.dispose();
      root.removeFromParent();
    },
  };
}
