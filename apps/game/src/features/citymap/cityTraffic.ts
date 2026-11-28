/**
 * GIAO THÔNG LAN RA PHỐ THỦ TỤC — kế thừa bộ mô phỏng của map chuẩn, không dựng bộ thứ hai.
 *
 * `features/testbus/openworld/traffic` đã có đủ luật: đèn QCVN 41:2024, ACC/IDM+, sublane Sài Gòn,
 * OBB/SAT, người qua đường, còi, LOD 3 tầng. Nhưng **đồ thị đường** của nó chỉ gồm đường của map
 * dựng tay, nên xe không thể chạy ra phố do `cityGen` sinh. Ở đây thành phố **góp đường vào chính đồ
 * thị đó** (`SaigonRoadGraph.addCityEdge/addCityIntersection/addCityTurn`), nên xe trên phố thủ tục
 * vẫn do đúng bộ mô phỏng ấy lái — không phải một "AI giao thông" viết lại.
 *
 * Hình dạng đoạn đường thành phố đưa vào: mỗi tuyến thành **hai làn ngược chiều** (mỗi làn lệch
 * nửa phần tư bề rộng, đúng như `buildNetwork` làm với Lý Thái Tổ), hai đầu cụt nối bằng cung
 * `uturn` — vì lưới phố thủ tục chưa có ngã tư nào được đặt đèn. Xe chạy hết tuyến thì quay đầu,
 * đúng kiểu phố cụt Sài Gòn, và không bao giờ "biến mất" ở cuối đường.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { City, CityStreet } from './cityGen';
import type { SaigonRoadGraph } from '../testbus/openworld/traffic/roadGraph';
import type { SaigonTrafficManager } from '../testbus/openworld/traffic';
import { wheelRadius, wheelSpinSigns } from '../testbus/openworld/simulation/vehicleCrew';
import { inRealWorld } from './realWorldFootprint';

export interface CityTrafficExtension {
  /** Tuyến phố thủ tục đã góp vào đồ thị. */
  corridors: number;
  /** Làn xe (mỗi tuyến hai làn) — id dùng để gọi `spawnVehicle`. */
  edgeIds: string[];
}

const axisOf = (dx: number, dz: number) => (Math.abs(dx) >= Math.abs(dz) ? "ew" : "ns") as "ew" | "ns";

function lengthOf(st: CityStreet): number {
  let len = 0;
  for (let i = 1; i < st.points.length; i += 1) {
    len += Math.hypot(st.points[i][0] - st.points[i - 1][0], st.points[i][1] - st.points[i - 1][1]);
  }
  return len;
}

/**
 * Góp các tuyến của thành phố vào đồ thị giao thông của map chuẩn.
 *
 * `near` quyết định lấy tuyến nào: chỉ những tuyến gần điểm này mới được đưa vào, để đồ thị không
 * phình lên 140 tuyến (mỗi tuyến thêm 2 làn, 2 ngã ba và 2 cung quay đầu — bộ mô phỏng duyệt hết
 * mỗi khung). Mặc định lấy quanh gốc toạ độ, nơi map thật đứng.
 */
export function extendTrafficGraph(
  graph: SaigonRoadGraph,
  city: City,
  options: { maxCorridors?: number; near?: { x: number; z: number }; radiusM?: number } = {},
): CityTrafficExtension {
  const maxCorridors = options.maxCorridors ?? 10;
  const near = options.near ?? { x: 0, z: 0 };
  const radius = options.radiusM ?? 520;

  const candidates = city.streets
    .filter((st) => (st.klass === "avenue" || st.klass === "street") && !st.insideBlock)
    .map((st) => {
      const [ax, az] = st.points[0];
      const [bx, bz] = st.points[st.points.length - 1];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      return { st, len: lengthOf(st), dist: Math.hypot(mx - near.x, mz - near.z) };
    })
    // Đường phải đủ dài mới có chỗ cho xe chạy và quay đầu, và không được nằm trong đất của map
    // thật (đường đó đã có trong đồ thị gốc, thêm nữa là hai bộ luật chồng nhau).
    .filter((c) => c.len >= 90 && c.dist <= radius)
    .filter((c) => {
      const [ax, az] = c.st.points[0];
      const [bx, bz] = c.st.points[c.st.points.length - 1];
      return !inRealWorld(ax, az, 6) && !inRealWorld(bx, bz, 6) && !inRealWorld((ax + bx) / 2, (az + bz) / 2, 6);
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, maxCorridors);

  const edgeIds: string[] = [];
  candidates.forEach(({ st }, i) => {
    const [ax, az] = st.points[0];
    const [bx, bz] = st.points[st.points.length - 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1) return;
    const tx = dx / len;
    const tz = dz / len;
    const rx = -tz;
    const rz = tx;
    const lane = Math.max(1.2, st.widthM / 4);
    const trim = Math.min(7, len * 0.12);
    const speed = st.klass === "avenue" ? 13.9 : 11.1;
    const axis = axisOf(dx, dz);

    const aStart = { x: ax + tx * trim + rx * lane, z: az + tz * trim + rz * lane };
    const aEnd = { x: bx - tx * trim + rx * lane, z: bz - tz * trim + rz * lane };
    const bStart = { x: bx - tx * trim - rx * lane, z: bz - tz * trim - rz * lane };
    const bEnd = { x: ax + tx * trim - rx * lane, z: az + tz * trim - rz * lane };

    const idA = `CTY_${i}_A`;
    const idB = `CTY_${i}_B`;
    const nodeA = `CTYN_${i}_A`;
    const nodeB = `CTYN_${i}_B`;

    const carriage = Math.max(2.6, st.widthM / 2 - 0.6);
    graph.addCityEdge({
      id: idA,
      streetName: st.name,
      fromNode: nodeA,
      toNode: nodeB,
      axis,
      start: aStart,
      end: aEnd,
      width: carriage,
      speedLimit: speed,
      carLaneOffsets: [-carriage * 0.22, carriage * 0.22],
      motoLatRange: [-carriage * 0.42, carriage * 0.42],
    });
    graph.addCityEdge({
      id: idB,
      streetName: st.name,
      fromNode: nodeB,
      toNode: nodeA,
      axis,
      start: bStart,
      end: bEnd,
      width: carriage,
      speedLimit: speed,
      carLaneOffsets: [-carriage * 0.22, carriage * 0.22],
      motoLatRange: [-carriage * 0.42, carriage * 0.42],
    });

    graph.addCityIntersection({
      id: nodeA,
      name: `${st.name} (đầu phố)`,
      center: { x: ax + tx * trim, z: az + tz * trim },
      signalized: false,
      phaseOffset: 0,
      nsGreenSec: 15,
      ewGreenSec: 12,
      amberSec: 3,
      allRedSec: 1.8,
    });
    graph.addCityIntersection({
      id: nodeB,
      name: `${st.name} (cuối phố)`,
      center: { x: bx - tx * trim, z: bz - tz * trim },
      signalized: false,
      phaseOffset: 0,
      nsGreenSec: 15,
      ewGreenSec: 12,
      amberSec: 3,
      allRedSec: 1.8,
    });

    graph.addCityTurn(nodeB, idA, idB, "uturn");
    graph.addCityTurn(nodeA, idB, idA, "uturn");
    edgeIds.push(idA, idB);
  });

  return { corridors: candidates.length, edgeIds };
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
