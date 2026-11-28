/**
 * GIAO THÔNG LAN RA PHỐ THỦ TỤC — kế thừa bộ mô phỏng của map chuẩn, không dựng bộ thứ hai.
 *
 * `features/testbus/openworld/traffic` đã có đủ luật: đèn QCVN 41:2024, ACC/IDM+, sublane Sài Gòn,
 * OBB/SAT, người qua đường, còi, LOD 3 tầng. Nhưng **đồ thị đường** của nó chỉ gồm đường của map
 * dựng tay, nên xe không thể chạy ra phố do `cityGen` sinh. Ở đây thành phố **góp đường vào chính đồ
 * thị đó** (`cityNetwork.ts` → `SaigonRoadGraph.addCityEdge/addCityIntersection/addCityLink`), nên xe
 * trên phố thủ tục vẫn do đúng bộ mô phỏng ấy lái — không phải một "AI giao thông" viết lại.
 *
 * Hai thứ được gắn thêm, cả hai đều bằng API của engine:
 *
 *  - **Đèn ngã tư** (`citySignals.ts`): ngã tư do các tuyến cắt nhau được bật `signalized` và gắn cột
 *    đèn qua đúng `bindSignalVisual` của map chuẩn, nên một `TrafficSignalController` lo cả map dựng
 *    tay lẫn phố sinh tự động.
 *  - **Bus 06 mở rộng** (`cityBus.ts`): một `BusCircuit` **thứ hai** qua các trục của thành phố, chạy
 *    bằng chính `BusRouteController` + `TrafficManager` của engine.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { City } from './cityGen';
import type { SaigonRoadGraph } from '../testbus/openworld/traffic/roadGraph';
import type { SaigonTrafficManager } from '../testbus/openworld/traffic';
import { wheelRadius, wheelSpinSigns } from '../testbus/openworld/simulation/vehicleCrew';
import { buildCityNetwork, type CityNetwork } from './cityNetwork';

/** Mọi thứ `extendTrafficGraph` góp vào đồ thị — giữ tên cũ để `realWorld.ts` không phải đổi. */
export interface CityTrafficExtension extends CityNetwork {
  /** Số tuyến vào đồ thị (giữ tên cũ `corridors`). */
  corridors: number;
}

/**
 * Góp mạng đường của thành phố vào đồ thị của engine.
 *
 * Hàm giữ nguyên chữ ký cũ (`graph`, `city`, `options`) để mọi chỗ gọi hiện có không phải sửa.
 */
export function extendTrafficGraph(
  graph: SaigonRoadGraph,
  city: City,
  options: { maxCorridors?: number; near?: { x: number; z: number }; radiusM?: number } = {},
): CityTrafficExtension {
  return buildCityNetwork(graph, city, options);
}


/** Ba mẫu xe hơi của map chuẩn, dùng lại nguyên model. */
const CAR_MODELS = [
  "/assets/testbus/ow/models/vehicles/taxi_corolla.glb",
  "/assets/testbus/ow/models/vehicles/savanna.glb",
  "/assets/testbus/ow/models/vehicles/mula_van.glb",
];

/**
 * Đặt xe lên các làn vừa góp vào đồ thị.
 *
 * Model lấy từ chính map chuẩn (taxi Corolla, Savanna, Mula van) — không dựng xe mới. Mỗi làn hai
 * xe, tổng số có trần để bộ mô phỏng còn rẻ: mỗi khung nó duyệt mọi xe cho ACC/IDM+, va chạm và
 * sublane, nên số xe là chi phí CPU thật, không phải chi phí vẽ.
 */
export async function spawnCityVehicles(
  traffic: SaigonTrafficManager,
  extension: CityTrafficExtension,
  parent: THREE.Object3D,
  options: { perEdge?: number; maxVehicles?: number } = {},
): Promise<{ spawned: number }> {
  const perEdge = options.perEdge ?? 1;
  const maxVehicles = options.maxVehicles ?? 18;
  if (!extension.edgeIds.length) return { spawned: 0 };

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = await Promise.all(CAR_MODELS.map((url) => loader.loadAsync(url).catch(() => null)));
  const models = loaded.filter((g): g is NonNullable<typeof g> => Boolean(g));
  if (!models.length) {
    console.warn("[citymap] không tải được model xe của map chuẩn", CAR_MODELS.join(", "));
    return { spawned: 0 };
  }
  console.info("[citymap] nạp được", models.length, "model xe, đặt lên", extension.edgeIds.length, "làn");

  let spawned = 0;
  let modelIndex = 0;
  for (const edgeId of extension.edgeIds) {
    const edge = traffic.graph.edges.get(edgeId);
    if (!edge) continue;
    for (let k = 0; k < perEdge; k += 1) {
      if (spawned >= maxVehicles) return { spawned };
      const gltf = models[modelIndex % models.length];
      modelIndex += 1;
      const visual = gltf.scene.clone(true);

      const root = new THREE.Group();
      root.name = `city-vehicle-${spawned}`;
      const chassis = new THREE.Group();
      chassis.add(visual);
      root.add(chassis);
      parent.add(root);

      const wheels: THREE.Object3D[] = [];
      visual.traverse((o) => {
        if (wheels.length < 4 && /wheel|banh|tire/i.test(o.name)) wheels.push(o);
      });
      const signs = wheels.length ? wheelSpinSigns(chassis, wheels, new THREE.Vector3(0, 0, 1)) : [];
      const radius = wheels[0] ? wheelRadius(wheels[0], 0.33) : 0.33;

      const isVan = /mula_van/.test(CAR_MODELS[modelIndex % CAR_MODELS.length] ?? "");
      try {
        traffic.spawnVehicle({
          id: `CITY_VEH_${spawned}`,
          category: isVan ? "van" : "car",
          edgeId,
          // Rải xe dọc tuyến (20–80% chiều dài) thay vì dồn ở đầu phố: đầu phố cụt thì cả đoàn xe
          // đứng chồng lên nhau, còn rải ra thì mỗi đoạn phố đều có xe như phố thật.
          s: Math.min(edge.length - 15, Math.max(10, edge.length * (0.2 + 0.15 * (spawned % 5)) + k * 26)),
          laneIndex: 0,
          halfWidth: isVan ? 0.98 : 0.92,
          halfLength: isVan ? 1.95 : 2.2,
          rig: {
            root,
            chassis,
            wheels: wheels.map((node, i) => ({ node, sign: signs[i] ?? 1, isFront: i < 2, baseYaw: node.rotation.y })),
            wheelRadius: radius,
            lights: null,
          },
        });
        spawned += 1;
      } catch (err) {
        console.warn("[citymap] không đặt được xe lên", edgeId, err);
        root.removeFromParent();
      }
    }
  }
  return { spawned };
}
