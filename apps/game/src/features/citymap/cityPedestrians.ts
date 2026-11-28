/**
 * NGƯỜI ĐI BỘ + HOẠT ĐỘNG TRÊN PHỐ THỦ TỤC — dùng **chính** bộ não của map chuẩn.
 *
 * Lý Thái Tổ có 15 người trên phố (`simulation/residents.ts`): người đi bộ trên hè, nhân viên đứng
 * bán, khách xếp hàng chờ buýt. Hành vi lang thang, né người, chờ đèn, sang đường đều do
 * `traffic/pedestrianBrain.ts` của engine tính (Helbing social force + máy trạng thái zebra). Thành
 * phố thủ tục **không** viết lại những thứ đó; file này chỉ trả lời hai câu hỏi mà Lý Thái Tổ không
 * phải trả lời:
 *
 *  1. **Đứng ở đâu?** Hè của LTT là một dải cố định theo trục z (x ∈ {2,7 · 0,3 · −13,2}). Phố sinh
 *     tự động chạy cả hai hướng, nên làn đi bộ phải suy ra từ hình học tuyến. Phần này thuần số
 *     (`citySidewalkLanes`) nên test được trong jsdom.
 *  2. **Bám vào cái gì?** Mỗi người đi bộ là một bản sao model NPC của LTT, đặt vào đúng toạ độ mà
 *     brain vừa tính, kèm clip đi bộ đã retarget và vệt bóng dưới chân. Phần này cần GLTF + Three.
 *
 * Tách đôi như vậy theo đúng bài học của `cityBus`: logic trong hàm thuần số thì test được; logic
 * trong hàm dựng Three.js thì không (jsdom không có canvas 2D nên `buildBus` nổ ngay).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type { City, CityStreet } from "./cityGen";
import type { CityZebra } from "./cityMesh";
import type { SaigonTrafficManager, SmartPedestrianAgent } from "../testbus/openworld/traffic";
import type { HumanPresenceSystem } from "../testbus/openworld/simulation/humanPresence";
import { streetClips } from "../testbus/openworld/simulation/streetClips";
import { createHumanRealismRig, type HumanActivity, type HumanRealismRig } from "../testbus/openworld/simulation/humanRealism";

/**
 * Hè mỗi bên, **phải khớp** bảng `walk` trong `cityMesh.ts`. Ở đó là biến cục bộ; đây là bản sao có
 * test canh (`cityPedestrians.test.ts` so hai bảng), vì người đi bộ đứng lệch hè một phân là lơ lửng
 * trên nhựa đường.
 */
export const CITY_WALK_WIDTH_M: Record<CityStreet["klass"], number> = {
  alley: 1.1,
  avenue: 4.0,
  street: 2.6,
  bridge: 2.6,
};
/** Đỉnh mặt hè: Part `y 0.10` + `sy 0.14` trong `cityMesh.ts`. */
export const CITY_WALK_TOP_Y = 0.24;

export interface CitySidewalkLane {
  streetId: string;
  /** Trung điểm làn (m). */
  x: number;
  z: number;
  /** Hướng dọc làn, cùng quy ước `atan2(dx, dz)` mà `PedestrianBrain` dùng cho `yaw`. */
  along: number;
  /** `"x"` nếu làn chạy gần song song trục x, `"z"` nếu song song trục z (chọn trục nào lệch < 45°). */
  axis: "x" | "z";
  /** Nửa chiều dài đoạn đi bộ được (đã trừ 8 m hai đầu cho khỏi đâm vào ngã tư). */
  halfLenM: number;
  /** Vị trí cố định trên trục còn lại: `z` khi `axis === "x"`, `x` khi `axis === "z"`. */
  fixed: number;
  klass: CityStreet["klass"];
}

/**
 * Sinh làn đi bộ từ dữ liệu tuyến — thuần số, không Three.js, không GLTF.
 *
 * Bỏ hẻm (`alley` 1,1 m: hai người không lách qua nhau, và hẻm nằm lọt trong khối nhà) và cầu.
 * `maxLanes` chặn trần vì `PedestrianBrain` là O(n²): mỗi người đẩy **mọi** người trong bán kính
 * 1,5 m. 15 người của LTT là 225 cặp/khung; 120 người là 14 400 cặp/khung.
 */
export function citySidewalkLanes(
  city: City,
  opts: { maxLanes?: number; minLenM?: number } = {},
): CitySidewalkLane[] {
  const maxLanes = opts.maxLanes ?? 56;
  const minLen = opts.minLenM ?? 70;
  const out: CitySidewalkLane[] = [];
  for (const s of city.streets) {
    if (out.length >= maxLanes) break;
    if (s.klass === "alley" || s.klass === "bridge") continue;
    if (s.insideBlock) continue;
    const walk = CITY_WALK_WIDTH_M[s.klass];
    // Người đi bộ đứng giữa hè, nhưng không xa hơn 1,4 m tính từ mép nhựa: hè đại lộ 4,0 m thì tim
    // hè là 2,0 m, còn hè phố 2,6 m thì 1,3 m — luôn nằm trong bề rộng thật của hè.
    const off = s.widthM / 2 + Math.min(walk * 0.5, 1.4);
    for (let i = 0; i < s.points.length - 1; i += 1) {
      if (out.length >= maxLanes) break;
      const [ax, az] = s.points[i];
      const [bx, bz] = s.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < minLen) continue;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const along = Math.atan2(bx - ax, bz - az);
      // Trục dọc làn: `along` đo từ +z, nên làn song song z khi |cos| lớn.
      const axis: "x" | "z" = Math.abs(Math.cos(along)) > 0.7071 ? "z" : "x";
      // Pháp tuyến của tuyến (vuông góc trục dọc) để đẩy ra hai bên hè.
      const nx = Math.cos(along);
      const nz = -Math.sin(along);
      for (const sgn of [1, -1] as const) {
        if (out.length >= maxLanes) break;
        const x = mx + nx * off * sgn;
        const z = mz + nz * off * sgn;
        out.push({
          streetId: s.id,
          x,
          z,
          along,
          axis,
          halfLenM: Math.max(10, len / 2 - 8),
          fixed: axis === "z" ? x : z,
          klass: s.klass,
        });
      }
    }
  }
  return out;
}

/** Model NPC lấy từ đúng bộ của LTT (`residents.ts` lẫn `storyNpcs.ts` đều dùng những file này). */
const NPC_MODELS = [
  "npc-alice",
  "npc-alan",
  "npc-sofia",
  "npc-nguoigia",
  "manvn",
  "juno3",
  "rowan",
  "npc-arthur",
  "npc-freya",
  "npc-linmei",
  "npc-napole",
  "npc-yoshida",
  "npc-archetype",
  "npc-blackguy",
] as const;

export interface CityPedestrians {
  /** Agent đã đăng ký trong `PedestrianBrain` — test đếm con số này. */
  readonly agents: readonly SmartPedestrianAgent[];
  readonly lanes: readonly CitySidewalkLane[];
  readonly spawned: number;
  /** Đặt bản sao vào toạ độ brain vừa tính. Gọi mỗi khung, sau `traffic.step`. */
  update(dt: number, cam: THREE.Vector3): void;
  dispose(): void;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/**
 * Đặt người đi bộ lên hè thành phố.
 *
 * Mỗi làn `perLane` người, rải đều theo trục làn. Người đi bộ đăng ký với brain ở đúng hệ toạ độ
 * thế giới hay không là **có**: engine vừa được mở thêm `patrolAxis` (mặc định `"z"` = y nguyên
 * hành vi LTT), nên làn chạy theo trục x dùng `patrolAxis: "x"` và brain tự tuần tra theo trục x.
 * Không có phép xoay nào ở đây, cũng không ghi đè `x/z` sau khi brain tính.
 */
export async function spawnCityPedestrians(
  traffic: SaigonTrafficManager,
  parent: THREE.Object3D,
  lanes: readonly CitySidewalkLane[],
  options: {
    perLane?: number;
    maxPedestrians?: number;
    humanPresence?: HumanPresenceSystem;
    onAssetLoaded?: (object: THREE.Object3D) => void;
  } = {},
): Promise<CityPedestrians> {
  const perLane = options.perLane ?? 1;
  const maxPedestrians = options.maxPedestrians ?? 44;
  const roots: THREE.Group[] = [];
  const agents: SmartPedestrianAgent[] = [];
  const rigs: HumanRealismRig[] = [];
  // Đánh chỉ số **theo root** (`null` khi model không có clip đi bộ). Trước đây mảng này được đẩy
  // theo thứ tự người có clip, nên chỉ cần một model thiếu clip là mọi người phía sau mượn nhầm
  // mixer/animation của người khác — chân người này bước theo tốc độ người kia.
  const mixes: Array<{ mixer: THREE.AnimationMixer; walk: THREE.AnimationAction; idle?: THREE.AnimationAction; walkSpeed: number } | null> = [];
  const presence: Array<() => void> = [];
  const laneOf: CitySidewalkLane[] = [];
  let disposed = false;

  const loaded = await Promise.all(
    NPC_MODELS.map((n) =>
      loader.loadAsync(`/assets/testbus/ow/models/${n}.optimized.glb`).then(
        (g) => ({ name: n, gltf: g }),
        () => null,
      ),
    ),
  );
  const models = loaded.filter((m): m is NonNullable<typeof m> => m !== null);
  if (!models.length) {
    console.warn("[citymap] không nạp được model NPC của map chuẩn — không có người đi bộ");
    return { agents, lanes, spawned: 0, update: () => {}, dispose: () => {} };
  }

  // `streetClips` retarget clip đi bộ của juno3 sang từng rig một lần mỗi file (có cache bên trong),
  // đúng cách `residents.ts` làm — nếu không mọi NPC trượt trên hè ở tư thế bind.
  const blueprints: Array<{ scene: THREE.Object3D; height: number; walk?: THREE.AnimationClip; idle?: THREE.AnimationClip; walkSpeed: number }> = [];
  for (const { name, gltf } of models) {
    const box = new THREE.Box3().setFromObject(gltf.scene, true);
    const raw = Math.max(0.1, box.max.y - box.min.y);
    // Chuẩn hoá về 1,72 m ± 6 % như người thật, để NPC không cao 3 m cạnh cửa hàng.
    const height = 1.62 + (blueprints.length % 5) * 0.045;
    // Khoá cache phải khớp khoá mà `residents.ts` dùng (`npc-alice.optimized.glb`): nếu lệch một ký
    // tự thì clip Mixamo bị retarget **hai lần** cho cùng một rig — gấp đôi thời gian nạp.
    const clips = await streetClips(`${name}.optimized.glb`, gltf.scene, gltf.animations).catch(() => null);
    blueprints.push({
      scene: gltf.scene,
      height,
      walk: clips?.walk,
      idle: clips?.idle,
      walkSpeed: clips?.walkSpeedAt(height) ?? 1.3,
    });
    void raw;
  }

  let n = 0;
  for (const lane of lanes) {
    if (n >= maxPedestrians) break;
    for (let k = 0; k < perLane && n < maxPedestrians; k += 1) {
      const bp = blueprints[n % blueprints.length];
      const obj = cloneSkinned(bp.scene);
      // Chuẩn hoá chiều cao **trên bản sao**, sau đó dời gốc xuống mặt hè (gốc model nằm ở hông/gót).
      const box = new THREE.Box3().setFromObject(obj, true);
      const h = Math.max(0.1, box.max.y - box.min.y);
      const scale = bp.height / h;
      obj.scale.setScalar(scale);
      obj.position.set(
        -((box.max.x + box.min.x) * scale) / 2,
        -box.min.y * scale,
        -((box.max.z + box.min.z) * scale) / 2,
      );

      const root = new THREE.Group();
      root.name = `city-ped-${n}`;
      root.add(obj);
      parent.add(root);
      roots.push(root);
      laneOf.push(lane);
      // Bóng tiếp xúc **không** vẽ ở đây: `createHumanRealismRig` đã gắn đĩa bóng riêng của nó
      // (`attachContactShadow`, ở y = 0,012). Thêm tấm thứ hai là hai cái bóng chồng lệch nhau trên
      // cùng đôi chân, và tốn thêm một draw call mỗi người.

      // Rải người dọc làn, tránh trùng nhau.
      const spread = (k - (perLane - 1) / 2) * 9;
      const sx = lane.x + Math.sin(lane.along) * spread;
      const sz = lane.z + Math.cos(lane.along) * spread;
      const half = lane.halfLenM;
      const axis = lane.axis;
      const agent = traffic.pedestrians.registerSidewalkWalker({
        id: `CITY_PED_${n}`,
        x: sx,
        z: sz,
        // `patrolZMin/Max` là khoảng tuần tra trên **trục dọc làn** (engine dùng chung cho cả hai trục).
        patrolZMin: (axis === "z" ? sz : sx) - half,
        patrolZMax: (axis === "z" ? sz : sx) + half,
        baseSpeed: 0.74 + ((n * 13) % 7) * 0.045,
        // Không có vạch kẻ trong đồ thị thành phố (xem `CITY_STREET_UPGRADE_PLAN.md` K): cho người
        // đi bộ sang đường ở đây sẽ là băng qua nhựa đường giữa chừng — LTT làm vậy được vì có
        // `CW_*` thật trong `roadGraph.buildNetwork()`. Đứng yên chờ đèn thì càng sai.
        canCross: false,
        seed: n + 3,
        patrolAxis: axis,
        patrolZ: axis === "x" ? sz : undefined,
      });
      agents.push(agent);
      n += 1;
      options.onAssetLoaded?.(root);

      if (bp.walk) {
        const mixer = new THREE.AnimationMixer(obj);
        const walk = mixer.clipAction(bp.walk);
        walk.play();
        walk.time = bp.walk.duration * ((n * 0.618) % 1);
        let idle: THREE.AnimationAction | undefined;
        if (bp.idle && bp.idle !== bp.walk) {
          idle = mixer.clipAction(bp.idle);
          idle.setEffectiveWeight(0);
          idle.play();
        }
        mixes[roots.length - 1] = { mixer, walk, idle, walkSpeed: bp.walkSpeed };
      } else {
        mixes[roots.length - 1] = null;
      }

      const rig = createHumanRealismRig(root, obj, n + 1);
      rigs.push(rig);
      if (options.humanPresence) {
        presence.push(
          options.humanPresence.register({
            id: `city_ped_${n}`,
            label: { en: "Passerby", vi: "Người đi bộ" },
            object: root,
            radius: 0.34,
            canSidestep: true,
            onBump: (dx, dz, strength) => {
              rig.triggerBump(dx, dz, strength);
              agent.x += dx * 0.14;
              agent.z += dz * 0.14;
            },
            onPersonalSpace: (closeness) => rig.setPersonalSpace(closeness),
          }),
        );
      }
    }
  }

  let blend = new Array<number>(roots.length).fill(1);
  return {
    agents,
    lanes,
    spawned: n,
    update(dt: number, cam: THREE.Vector3) {
      if (disposed) return;
      const t = performance.now() / 1000;
      for (let i = 0; i < roots.length; i += 1) {
        const root = roots[i];
        const a = agents[i];
        const lane = laneOf[i];
        if (!a || !lane) continue;
        root.position.set(a.x, CITY_WALK_TOP_Y, a.z);
        root.rotation.y = a.yaw;
        // Đổi clip theo tốc độ thật của brain: đứng chờ thì mờ dần sang idle, bước thì khớp sải chân.
        const moving = a.speed > 0.08;
        const m = mixes[i];
        if (m) {
          blend[i] = THREE.MathUtils.damp(blend[i], moving ? 1 : 0, 7.5, dt);
          m.walk.setEffectiveWeight(blend[i]);
          m.walk.timeScale = Math.max(0.15, a.speed / m.walkSpeed);
          m.idle?.setEffectiveWeight(1 - blend[i]);
          m.mixer.update(dt);
        }
        // Cổng hiển thị có trễ (70 m bật / 85 m tắt) — như `residents.ts`, NPC ngoài tầm nhìn không
        // đáng một draw call, nhưng đi qua ngưỡng thì không được nhấp nháy.
        const d2 = cam.distanceToSquared(root.position);
        if (!root.visible && d2 < 70 * 70) root.visible = true;
        else if (root.visible && d2 > 85 * 85) root.visible = false;
        if (!root.visible) continue;
        // Hoạt động thật, không phải "đứng đó": người đi thì `walking`, người đứng chờ thì luân phiên
        // `talking`/`listening`/`idle` — cùng bảng `HumanActivity` mà LTT dùng cho 15 cư dân của nó.
        const activity: HumanActivity = moving
          ? "walking"
          : i % 3 === 1
            ? "talking"
            : i % 3 === 2
              ? "listening"
              : "idle";
        rigs[i]?.update({
          dt,
          time: t,
          playerPos: cam,
          moveSpeed: a.speed,
          activity,
          hasActiveMixer: Boolean(m),
        });
      }
    },
    dispose() {
      disposed = true;
      for (const off of presence) off();
      presence.length = 0;
      rigs.length = 0;
      for (const root of roots) {
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) mat?.dispose();
        });
        root.removeFromParent();
      }
      roots.length = 0;
      // `PedestrianBrain` không có `unregister`: đẩy agent ra khỏi thế giới và tắt tốc độ. Chúng vẫn
      // nằm trong mảng (nên vẫn tốn cặp O(n²) nếu đăng ký lại), nên trang chỉ được spawn một lần.
      for (const a of agents) {
        a.baseSpeed = 0;
        a.speed = 0;
        a.patrolZMin = a.patrolZMax = a.patrolAxis === "x" ? a.x : a.z;
        a.x = 1e6;
        a.z = 1e6;
      }
      agents.length = 0;
    },
  };
}

/**
 * KHỚP VẠCH KẺ VỚI NGÃ TƯ THẬT — thuần số, test được.
 *
 * `cityMesh` vẽ vạch theo hình học tuyến (mỗi đầu đoạn ≥ 14 m), còn đồ thị giao thông chia tuyến theo
 * chỗ cắt với tuyến vuông góc (`CTYJ_*`) và đầu cụt (`CTYEND_*`). Hai cách chia không trùng nhau:
 * một vạch có thể rơi gần một ngã tư, hoặc rơi giữa đoạn (khi đó **không** được thành vạch, vì
 * không có đèn và không có cung nào để xe nhường).
 *
 * Vạch chỉ được nhận khi: (a) có ngã tư trong bán kính `maxDistM`, và (b) ngã tư đó đã có đèn —
 * `traffic.signals` phải biết pha của nó, nếu không `getAxisState` trả "green 99" và người đi bộ
 * bước xuống đường bất kể xe.
 */
export function matchCityZebras(
  zebras: readonly CityZebra[],
  junctions: ReadonlyArray<{ id: string; x: number; z: number }>,
  signalized: ReadonlySet<string>,
  maxDistM = 16,
): Array<Omit<CityZebra, "intersectionId"> & { intersectionId: string; parallelAxis: "ns" | "ew" }> {
  const out: Array<Omit<CityZebra, "intersectionId"> & { intersectionId: string; parallelAxis: "ns" | "ew" }> = [];
  for (const z of zebras) {
    const cx = (z.a.x + z.b.x) / 2;
    const cz = (z.a.z + z.b.z) / 2;
    let best: { id: string; d: number } | null = null;
    for (const j of junctions) {
      // Đầu cụt (`CTYEND_*`) chỉ có vòng quay đầu: không có làn cắt ngang nên `turn.crosswalks` rỗng
      // và vạch ở đó không bao giờ được dùng. Chỉ ngã tư thật (`CTYJ_*`) mới nhận vạch.
      if (!signalized.has(j.id) || j.id.startsWith("CTYEND_")) continue;
      const d = Math.hypot(j.x - cx, j.z - cz);
      if (d > maxDistM) continue;
      if (!best || d < best.d) best = { id: j.id, d };
    }
    if (!best) continue;
    // Xe đi cùng chiều với người đi bộ: vạch bắc qua trục z (pedAxis "ns") thì xe chạy trên trục z.
    out.push({ ...z, intersectionId: best.id, parallelAxis: z.pedAxis });
  }
  return out;
}
