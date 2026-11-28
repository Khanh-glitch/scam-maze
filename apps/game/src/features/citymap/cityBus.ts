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
  /** Trạng thái chạy của xe — đọc được để test và để đặt pose ban đầu. */
  readonly d: number;
  readonly speed: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
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

/** Giới hạn tốc độ vào cua dọc vòng: đúng `turn.maxSpeed` engine tính cho từng cung. */
function curveLimit(circuit: BusCircuit, d: number): number {
  let limit = Infinity;
  for (const seg of circuit.segments) {
    if (!seg.turn || seg.turn.kind === "straight") continue;
    const ahead = circuit.delta(d, seg.start);
    const inside = circuit.delta(seg.start, d);
    const dist = inside >= 0 && inside < seg.length ? 0 : ahead;
    if (dist < 0 || dist > 70) continue;
    const cap = seg.turn.maxSpeed * 0.85;
    limit = Math.min(limit, Math.sqrt(cap * cap + 2 * 2.1 * dist));
  }
  return limit;
}

/** Trạng thái chạy của xe buýt thành phố — thuần số, không Three.js (test được trong jsdom). */
export interface CityBusMotion {
  /** Vị trí dọc vòng (m). */
  d: number;
  /** Tốc độ hiện tại (m/s). */
  speed: number;
  /** Lệch ngang so với tim làn (m, + = phải). */
  lat: number;
  x: number;
  z: number;
  yaw: number;
}

/** Tạo trạng thái ban đầu cho một vòng. */
export function createCityBusMotion(circuit: BusCircuit, curbLat = 0.9): CityBusMotion {
  const d = Math.min(30, circuit.length * 0.05);
  const pose = circuit.poseAt(d, curbLat);
  return { d, speed: 0, lat: curbLat, x: pose.x, z: pose.z, yaw: pose.yaw };
}

/**
 * MỘT BƯỚC của xe buýt thành phố — thuần số, không Three.js, nên test đọc được trong jsdom.
 *
 * `plan` là kết quả `traffic.planBus06(...)` với `circuit` của **chính xe này**: đèn QCVN 41:2024 ở
 * mọi ngã tư trên vòng, xe phía trước, người qua đường, và làn ngang nó muốn bám. Hàm này chỉ:
 *
 *  1. giới hạn thêm theo `turn.maxSpeed` của những cung sắp tới (engine tính sẵn lúc dựng cung);
 *  2. tích phân `d` theo vòng bằng `circuit.poseAt` — hình học là của `BusCircuit`;
 *  3. trượt ngang có giới hạn tốc độ (xe buýt đổi làn khi chạy, không "đi ngang").
 *
 * Không có luật lái nào được viết lại ở đây.
 */
export function stepCityBusMotion(
  circuit: BusCircuit,
  motion: CityBusMotion,
  dt: number,
  plan: { speed: number; lat: number },
  curbLat = 0.9,
): CityBusMotion {
  const step = Math.max(0.001, Math.min(0.05, dt));
  const target = Math.min(plan.speed, curveLimit(circuit, motion.d));
  const accel = target > motion.speed ? 1.6 : 2.1;
  const speed = target > motion.speed
    ? Math.min(target, motion.speed + accel * step)
    : Math.max(target, motion.speed - accel * step);
  const d = circuit.wrap(motion.d + speed * step);
  const seg = circuit.segmentAt(d);
  const wish = seg.edge ? plan.lat : curbLat;
  const lat = motion.lat + Math.max(-1.6 * step, Math.min(1.6 * step, (wish - motion.lat) * Math.min(1, step * 6)));
  const pose = circuit.poseAt(d, lat);
  return { d, speed, lat, x: pose.x, z: pose.z, yaw: pose.yaw };
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
  // Trạng thái chạy (thuần số) — `stepCityBusMotion` cập nhật nó mỗi khung.
  const curbLat = options.curbLat ?? 0.9;
  let motion = createCityBusMotion(circuit, curbLat);

  // MÔ HÌNH: chính `buildBus` của engine — cùng thân xe sơn xanh 06, cùng cửa trượt, cùng đèn, cùng
  // bánh. Không có GLB riêng cho xe buýt, và cũng không nên có: engine dựng nó bằng hình khối, nên
  // xe buýt thành phố trông y hệt xe buýt của map chuẩn.
  //
  // `buildBus` cần một object có `x/z/yaw/speed/doors/steer/phase`; đây là cầu nối mỏng tới trạng
  // thái ở trên — không phải một controller thứ hai.
  const busDriver = {
    x: motion.x,
    z: motion.z,
    yaw: motion.yaw,
    speed: 0,
    steer: 0,
    phase: "driving" as const,
    doors: { front: { amount: 0, target: 0 }, rear: { amount: 0, target: 0 } },
    progress: 0,
  };
  const bus = buildBus(options.parent as unknown as THREE.Scene, busDriver as never, false);
  const root = bus.root;

  // Đăng ký vòng đường riêng của xe này với bộ mô phỏng **trước** khi đồng bộ lần đầu: nếu không nó
  // sẽ chiếu vị trí lên vòng Bus 06 của map chuẩn và nhảy về Lý Thái Tổ.
  traffic.registerExtraBus(CITY_BUS_ID, circuit);

  const seg = circuit.segmentAt(motion.d);
  traffic.spawnVehicle({
    id: CITY_BUS_ID,
    category: "bus",
    edgeId: seg.edge?.id ?? circuit.segments[0].id,
    s: Math.max(1, motion.d - seg.start),
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
    agent.x = motion.x;
    agent.z = motion.z;
    agent.yaw = Math.PI + motion.yaw;
  }

  return {
    circuit,
    get d() {
      return motion.d;
    },
    get speed() {
      return motion.speed;
    },
    get x() {
      return motion.x;
    },
    get z() {
      return motion.z;
    },
    get yaw() {
      return motion.yaw;
    },
    edgeIds: circuit.segments.filter((s) => s.edge).map((s) => s.id),
    root,
    update(dt: number) {
      // BỐN BƯỚC, ĐÚNG THỨ TỰ ENGINE DÙNG CHO BUS 06:
      //  1. bộ mô phỏng lập kế hoạch tốc độ (đèn, xe trước, người đi bộ, làn muốn bám) — `planBus06`
      //     với **vòng của chính xe này**;
      //  2. `stepCityBusMotion` tích phân theo vòng, có giới hạn vào cua;
      //  3. đồng bộ vị trí/tốc độ lại cho bộ mô phỏng để xe khác và người đi bộ thấy nó;
      //  4. `buildBus` tự đặt thân xe + xoay bánh từ những con số đó.
      const plan = traffic.planBus06(motion.x, motion.z, 11.5, {
        yaw: Math.PI + motion.yaw,
        agentId: CITY_BUS_ID,
        circuit,
        aggressive: true,
      });
      motion = stepCityBusMotion(circuit, motion, dt, plan, curbLat);
      busDriver.x = motion.x;
      busDriver.z = motion.z;
      busDriver.yaw = motion.yaw;
      busDriver.speed = motion.speed;
      traffic.syncBus06(motion.x, motion.z, Math.PI + motion.yaw, motion.speed, 0, undefined, undefined, CITY_BUS_ID, circuit);
      bus.update(Math.max(0.001, Math.min(0.05, dt)));
    },
    dispose() {
      bus.dispose();
      root.removeFromParent();
    },
  };
}
