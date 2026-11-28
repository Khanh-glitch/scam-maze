/**
 * ĐÈN TÍN HIỆU CHO NGÃ TƯ CỦA THÀNH PHỐ THỦ TỤC.
 *
 * Map chuẩn dựng đèn bằng `world/signalBuilder.ts` → `deriveSignalApproaches(graph)` →
 * `createMastArmSignal` (GLB `traffic-signal.optimized.glb`, hoặc cột tay khi GLB lỗi) và gắn màu
 * đèn bằng `SaigonTrafficManager.bindSignalVisual` ⇒ `TrafficSignalController` của engine. Nghĩa là
 * **một** bộ điều khiển QCVN 41:2024 lo cả map dựng tay và phố sinh tự động.
 *
 * `deriveSignalApproaches` quét toàn bộ đồ thị, nên nếu cứ bật `signalized` cho 10 ngã tư mới thì
 * mỗi khung hình engine phải dựng thêm ~40 cột đèn — mỗi cột là một cái GLB 20–30k tam giác. Ở đây
 * chỉ lấy **ngã tư quan trọng nhất**: nơi tuyến phố thủ tục cắt một tuyến khác (không phải hai đầu
 * cụt), gần chỗ người chơi đứng nhất, có trần số cột.
 *
 * Không có gì được vẽ lại: cùng `createMastArmSignal`, cùng vật liệu đèn, cùng `bindSignalVisual`.
 */
import * as THREE from "three";
import type { SaigonRoadGraph } from "../testbus/openworld/traffic/roadGraph";
import type { SaigonTrafficManager } from "../testbus/openworld/traffic";
import { TrafficSignalController } from "../testbus/openworld/traffic/signalController";
import { createMastArmSignal, signalLampMaterial, type LampSet, type SharedCountdown } from "../testbus/openworld/world/mastArmSignal";
import { deriveSignalApproaches, signalBasePosition, signalYaw } from "../testbus/openworld/world/signalPlacement";
import { rect, type Solid } from "../testbus/openworld/simulation/boarding";

export interface CitySignalOptions {
  /** Trần số ngã tư được bật đèn — mỗi ngã tư 2–4 cột đèn GLB. */
  maxIntersections?: number;
  /** Cha của các cột đèn (thường là `engine.exteriorGroup`). */
  parent: THREE.Object3D;
  /** Hộp cản của cột đèn được đẩy vào đây, để nhân vật không đi xuyên cột. */
  solids?: Solid[];
  /**
   * Danh sách ngã tư **thật** do `buildCityNetwork` trả về. Chỉ những chỗ này mới được bật đèn:
   * đầu cụt của tuyến (`CTYEND_*`) chỉ có vòng quay đầu, và ngã tư nào cũng bật thì mỗi khung hình
   * engine phải dựng thêm hàng chục cột đèn GLB.
   */
  junctions?: ReadonlyArray<{ id: string; x: number; z: number }>;
}

export interface CitySignals {
  /** Id ngã tư đã bật `signalized`. */
  signalized: string[];
  /** Nhóm chứa các cột đèn (một nhóm con cho mỗi ngã tư). */
  root: THREE.Group;
  /** Số cột đèn đã dựng. */
  poles: number;
}

/**
 * Bật đèn cho các ngã tư của thành phố và dựng cột đèn cho đúng những ngã tư đó.
 *
 * Phải gọi **sau** `extendTrafficGraph` (đồ thị đã có node/tuyến) và **sau** khi `TrafficManager`
 * tồn tại (để gắn màu đèn). Gọi lại lần hai thì không làm gì (idempotent) — engine chỉ dựng một lần
 * nhưng test và `?respawn` có thể gọi nhiều lần.
 */
export function signalizeCityIntersections(
  graph: SaigonRoadGraph,
  traffic: SaigonTrafficManager,
  options: CitySignalOptions,
): CitySignals {
  const maxIntersections = options.maxIntersections ?? 3;
  const root = new THREE.Group();
  root.name = "city-traffic-signals";
  const signalized: string[] = [];

  // 1. Ngã tư "thật" = chỗ hai tuyến của lưới gặp nhau, hoặc cổng của map chuẩn (nơi phố thủ tục tiếp
  //    quản đường của map dựng tay). Đầu cụt `CTYEND_*` chỉ có vòng quay đầu nên không đèn.
  const candidates = (options.junctions ?? [])
    .filter((j) => !j.id.startsWith("CTYEND_"))
    .filter((j) => graph.intersections.has(j.id))
    .map((j) => ({ id: j.id, x: j.x, z: j.z }));
  // Gần gốc toạ độ (map chuẩn nằm quanh đó) trước — đó là chỗ người chơi thật sự đi qua.
  candidates.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const picked = candidates.slice(0, maxIntersections);
  if (!picked.length) return { signalized, root, poles: 0 };

  // 2. `IntersectionSpec` là object sống trong đồ thị: bật cờ là bộ điều khiển của engine nhận
  //    ngay ở khung sau (`signals.update` duyệt lại `specs` mỗi lần gọi).
  for (const p of picked) {
    const spec = graph.intersections.get(p.id);
    if (!spec) continue;
    spec.signalized = true;
    spec.nsGreenSec = 16;
    spec.ewGreenSec = 14;
    spec.amberSec = 3;
    spec.allRedSec = 1.8;
    // Bộ điều khiển của engine chụp danh sách giao lộ lúc construct — đăng ký để ngã tư mới **có pha**
    // thật, chứ không phải một cột đèn đứng yên.
    traffic.signals.registerIntersection(spec);
    signalized.push(p.id);
  }

  // 3. Cột đèn cho đúng những ngã tư vừa bật. `deriveSignalApproaches` trả về mọi nhánh vào của mọi
  //    ngã tư có đèn (cả của map chuẩn), nên lọc lại theo danh sách vừa chọn.
  const wanted = new Set(signalized);
  const approaches = deriveSignalApproaches(graph).filter((a) => wanted.has(a.intersectionId));
  const groupOf = new Map<string, THREE.Group>();
  let poles = 0;
  for (const a of approaches) {
    let group = groupOf.get(a.intersectionId);
    if (!group) {
      group = new THREE.Group();
      group.name = `city-signals-${a.intersectionId}`;
      groupOf.set(a.intersectionId, group);
      root.add(group);
    }
    const pos = signalBasePosition(a);
    const lamps: LampSet = { r: signalLampMaterial(0xff3426), y: signalLampMaterial(0xffb524), g: signalLampMaterial(0x28e672) };
    const countdown: SharedCountdown = TrafficSignalController.createSharedCountdown();
    // Cùng API engine dùng cho map chuẩn: cột đèn ngay lập tức thuộc về bộ điều khiển QCVN 41:2024.
    traffic.bindSignalVisual({
      intersectionId: a.intersectionId,
      axis: a.axis,
      redMat: lamps.r,
      amberMat: lamps.y,
      greenMat: lamps.g,
      countdown: countdown.handle,
    });
    const signal = createMastArmSignal({
      lamps,
      countdown,
      armLength: a.armLength,
      laneCentres: a.laneCentres,
    });
    const container = new THREE.Group();
    container.name = `city-signal-${a.edgeId}`;
    // Cột đứng trên vỉa hè của thành phố, cùng cao độ `CURB_HEIGHT` mà map chuẩn dùng.
    container.position.set(pos.x, 0.17, pos.z);
    container.rotation.y = signalYaw(a.heading);
    container.add(signal.group);
    group.add(container);
    options.solids?.push(rect(pos.x, pos.z, 0.3, 0.3));
    poles += 1;
  }

  if (poles) options.parent.add(root);
  return { signalized, root, poles };
}
