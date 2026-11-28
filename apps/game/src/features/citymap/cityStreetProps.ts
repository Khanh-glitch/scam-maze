/**
 * ĐỒ VỈA HÈ THẬT CHO PHỐ THỦ TỤC — L7.
 *
 * Trước file này, `cityGen` sinh **9 012** đồ vỉa hè (xe máy dựng, thùng rác, cột đèn, biển hiệu,
 * sạp, bàn ghế…) nhưng `cityLayer` chỉ thay **24 chỗ** bằng GLB thật (`i % 17 === 0` của loại
 * `stall`), còn lại là khối nguyên thuỷ: cột đèn = trụ tròn, thùng rác/bồn inox = trụ tròn, cây =
 * nón + trụ. Đó đúng là "NPC không tận dụng asset thật, dùng đồ giả" mà người dùng báo.
 *
 * Ở đây **không tạo asset mới**: chỉ chọn, cho mỗi loại đồ, một file GLB đã có trong repo (chính
 * file map dựng tay dùng) và một phép biến đổi để nó đứng đúng cỡ thật:
 *
 *   xe máy dựng  → bike-pcx / bike-supercub / bike-cg125   (ba đời xe máy Sài Gòn)
 *   sạp bán      → Prop_BanhMi / Prop_BatterySwap          (trong street-props.optimized.glb)
 *   thùng rác    → Prop_TrashBin
 *   bàn ghế      → table-set + stool-low / stool-high       (quán vỉa hè)
 *   biển hiệu    → bienhieu1
 *
 * Phần **toán** (chọn loại, giới hạn số bản sao, chia lô theo khoảng cách) nằm trong hàm thuần
 * `planStreetPropAssets` để test được trong jsdom; phần dựng Three.js nằm trong `placeStreetPropAssets`
 * và chỉ chạy khi có GLTF.
 *
 * NGÂN SÁCH: mỗi bản sao GLB là một draw call. `cityBudget.test.ts` chặn 260, hiện dùng 134, nên
 * trần đặt ở {@link MAX_GLB_PROPS} = 96 bản sao — vẫn là 4× con số cũ (24) mà còn dư ngân sách cho
 * đèn/cột. Đồ nào không có trong bảng thì giữ hình khối nguyên thuỷ (đó là *hình học đơn giản*,
 * không phải đồ giả: cột đèn, cọc tiêu, dây phơi vẫn phải là hình khối).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  BIENHIEU_GLB,
  BIKE_CG125_GLB,
  BIKE_PCX_GLB,
  BIKE_SUPERCUB_GLB,
  STOOL_HIGH_GLB,
  STOOL_LOW_GLB,
  STREET_PROPS_GLB,
  TABLE_SET_GLB,
} from "../../config/assetPaths";
import type { CityPropKind } from "./cityGen";

/**
 * Loại đồ **dùng cho bảng asset**. `stall_seating` (bàn ghế quán cóc) không phải loại mà `cityGen`
 * sinh ra — nó là cách gom bàn/ghế vào cùng một nhóm khi lên kế hoạch đặt đồ; mọi loại khác là
 * đúng `CityPropKind` của `cityGen`.
 */
export type PropAssetKind = CityPropKind | "stall_seating";

/** Một mẫu GLB: file + tên node bên trong (rỗng = cả scene) + hệ số phóng. */
export interface PropTemplate {
  id: string;
  url: string;
  node?: string;
  /** Nhân thêm vào cỡ gốc để ra cỡ thật ngoài phố. */
  scale: number;
  /** Đặt trên mặt hè (m). */
  y: number;
}

/**
 * BẢNG CHỌN ASSET. Một loại đồ có thể có nhiều mẫu (xe máy ba đời) — chọn theo chỉ số để phố không
 * lặp lại một chiếc xe y hệt ở mọi vỉa hè.
 */
export const PROP_TEMPLATES: Partial<Record<PropAssetKind, PropTemplate[]>> = {
  moto: [
    { id: "moto-pcx", url: BIKE_PCX_GLB, scale: 1, y: 0 },
    { id: "moto-supercub", url: BIKE_SUPERCUB_GLB, scale: 1, y: 0 },
    { id: "moto-cg125", url: BIKE_CG125_GLB, scale: 1, y: 0 },
  ],
  bin: [{ id: "bin-penguin", url: STREET_PROPS_GLB, node: "Prop_TrashBin", scale: 0.62, y: 0.17 }],
  stall: [
    { id: "stall-banhmi", url: STREET_PROPS_GLB, node: "Prop_BanhMi", scale: 0.48, y: 0.17 },
    { id: "stall-swap", url: STREET_PROPS_GLB, node: "Prop_BatterySwap", scale: 0.74, y: 0.17 },
  ],
  // Quán vỉa hè: bàn nhựa + ghế. `cityGen` không có loại "bàn ghế" riêng nên dùng chung nhóm với
  // sạp bán — cùng cảnh quán cóc Sài Gòn.
  stall_seating: [
    { id: "seat-table", url: TABLE_SET_GLB, scale: 1, y: 0.17 },
    { id: "seat-stool-low", url: STOOL_LOW_GLB, scale: 1, y: 0.17 },
    { id: "seat-stool-high", url: STOOL_HIGH_GLB, scale: 1, y: 0.17 },
  ],
  sign: [{ id: "sign-bienhieu", url: BIENHIEU_GLB, scale: 1, y: 0.17 }],
};

/** Trần số bản sao GLB — ngân sách draw call (xem đầu file). */
export const MAX_GLB_PROPS = 96;

/** Một chỗ đặt đã chọn: mẫu + toạ độ + hướng. */
export interface PlannedProp {
  templateId: string;
  url: string;
  node?: string;
  scale: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface PlanOptions {
  maxCopies?: number;
  /** Vùng của map dựng tay — ở đó đã có đồ thật của Lý Thái Tổ, không đặt thêm. */
  inRealWorld?: (x: number, z: number, margin: number) => boolean;
  /** Cách đều bao nhiêu chỗ lấy một (1 = lấy hết tới trần). */
  stride?: number;
}

/**
 * CHỌN CHỖ ĐẶT — hàm thuần số, test được không cần GLTF.
 *
 * Luật:
 *  1. Chỉ những `kind` có trong {@link PROP_TEMPLATES}. Đồ không có asset thật thì không giả vờ có.
 *  2. Không đặt trong vùng map dựng tay (đã có đồ thật).
 *  3. Chia đều khắp thành phố: duyệt theo thứ tự props và lấy cách `stride`, nên 96 bản sao rải từ
 *     đầu tới cuối bản đồ chứ không dồn một góc.
 *  4. Mỗi loại đồ có hạn mức riêng, để "xe máy" (1 428 chỗ) không chiếm hết trần và biến vỉa hè
 *     thành bãi xe.
 */
export function planStreetPropAssets(
  props: ReadonlyArray<{ kind: PropAssetKind; x: number; z: number; rot: number }>,
  options: PlanOptions = {},
): PlannedProp[] {
  const max = options.maxCopies ?? MAX_GLB_PROPS;
  const inRealWorld = options.inRealWorld ?? (() => false);

  // Hạn mức theo loại (tổng ≤ max), để "xe máy" (1 428 chỗ) không nuốt hết trần.
  // Hạn mức cộng lại **đúng bằng** trần: nếu cộng dư thì phần dư không có chỗ dùng (chỗ đặt đã chọn
  // theo khoảng cách), nếu cộng thiếu thì vỉa hè trống oan. Tỉ lệ theo mật độ thật của Sài Gòn:
  // xe máy dựng sát lề nhiều nhất, rồi thùng rác, sạp/quán cóc, biển hiệu.
  // Tỉ lệ chia tay: phần lẻ dồn hết vào nhóm cuối để tổng **đúng bằng** `max` (làm tròn từng nhóm
  // thì 96 chỗ chỉ dùng được 95).
  const motoQ = Math.round(max * 0.34);
  const binQ = Math.round(max * 0.18);
  const stallQ = Math.round(max * 0.2);
  const seatQ = Math.round(max * 0.14);
  const quota: Partial<Record<PropAssetKind, number>> = {
    moto: motoQ,
    bin: binQ,
    stall: stallQ,
    stall_seating: seatQ,
    sign: max - motoQ - binQ - stallQ - seatQ,
  };

  // 1. Ứng viên: đúng loại có asset, không nằm trong đất map dựng tay. GIỮ CHỈ SỐ GỐC để bước chọn
  //    vẫn rải được trên trục thời gian của `cityGen` (props được sinh dọc từng tuyến, nên chỉ số gốc
  //    là một trục không gian: đầu bản đồ → cuối bản đồ).
  const candidates = props
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => (PROP_TEMPLATES[p.kind]?.length ?? 0) > 0)
    .filter(({ p }) => !inRealWorld(p.x, p.z, 2));

  // 2. RẢI ĐỀU THEO CHỈ SỐ GỐC, không theo thứ tự loại.
  //
  //    Bản đầu duyệt theo thứ tự props và lấy từng cái cho tới khi đầy hạn mức của từng loại — nhưng
  //    props xếp theo loại trong dữ liệu sinh, nên 96 chỗ dồn vào một đoạn 3 m ở đầu bản đồ. Giờ:
  //    chọn chỉ số mục tiêu trải đều trên toàn dải `[0, n)`, rồi với mỗi mục tiêu lấy ứng viên gần
  //    nhất chưa dùng. Nhờ vậy 96 bản sao nằm rải khắp 1,2 km thành phố.
  const chosen: typeof candidates = [];
  const usedIdx = new Set<number>();
  const step = candidates.length / max;
  for (let k = 0; k < max && chosen.length < max; k += 1) {
    const target = k * step;
    let bestAt = -1;
    let bestDist = Infinity;
    for (let j = 0; j < candidates.length; j += 1) {
      const c = candidates[j];
      if (usedIdx.has(j)) continue;
      const d = Math.abs(j - target);
      if (d < bestDist) {
        bestDist = d;
        bestAt = j;
      }
    }
    if (bestAt < 0) break;
    usedIdx.add(bestAt);
    chosen.push(candidates[bestAt]);
  }

  // 3. Áp hạn mức theo loại; phần vượt hạn mức trả lại cho loại còn dư chỗ (đi vòng một lần).
  const used: Partial<Record<PropAssetKind, number>> = {};
  const palette = new Map<PropAssetKind, number>();
  const out: PlannedProp[] = [];
  const tryPlace = (c: (typeof candidates)[number]) => {
    const kind = c.p.kind;
    const cap = quota[kind] ?? 0;
    if ((used[kind] ?? 0) >= cap) return false;
    const templates = PROP_TEMPLATES[kind]!;
    const next = palette.get(kind) ?? 0;
    const t = templates[next % templates.length];
    palette.set(kind, next + 1);
    used[kind] = (used[kind] ?? 0) + 1;
    out.push({ templateId: t.id, url: t.url, node: t.node, scale: t.scale, x: c.p.x, y: t.y, z: c.p.z, yaw: c.p.rot });
    return true;
  };
  const rest: typeof candidates = [];
  for (const c of chosen) if (!tryPlace(c)) rest.push(c);
  for (const c of rest) {
    if (out.length >= max) break;
    // Trả lại chỗ cho loại còn hạn mức: dùng mẫu của loại đang thiếu, giữ nguyên vị trí.
    const spare = (Object.keys(quota) as PropAssetKind[]).find((k) => (used[k] ?? 0) < (quota[k] ?? 0));
    if (!spare) continue;
    const templates = PROP_TEMPLATES[spare]!;
    const next = palette.get(spare) ?? 0;
    const t = templates[next % templates.length];
    palette.set(spare, next + 1);
    used[spare] = (used[spare] ?? 0) + 1;
    out.push({ templateId: t.id, url: t.url, node: t.node, scale: t.scale, x: c.p.x, y: t.y, z: c.p.z, yaw: c.p.rot });
  }
  return out;
}

/**
 * DỰNG THẬT. Nạp mỗi file GLB **một lần** rồi nhân bản trên toàn thành phố — cùng cách
 * `placeStreetProps` của map chuẩn làm, để hai bên dùng chung một mục HTTP cache.
 *
 * Không ném lỗi: thiếu asset thì cảnh vẫn chạy (chỉ là vỉa hè ít đồ hơn), và mọi lỗi được gom vào
 * `warnings` để log một dòng thay vì một tràng `console.warn` cho mỗi bản sao.
 */
export async function placeStreetPropAssets(
  parent: THREE.Object3D,
  plan: readonly PlannedProp[],
  onAssetLoaded?: (obj: THREE.Object3D) => void,
): Promise<{ placed: number; warnings: string[] }> {
  const warnings: string[] = [];
  if (!plan.length) return { placed: 0, warnings };

  // Gom theo (url, node) để mỗi mẫu chỉ giải mã một lần.
  const wanted = new Map<string, PlannedProp>();
  for (const p of plan) wanted.set(`${p.url}|${p.node ?? ""}`, p);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const templates = new Map<string, THREE.Object3D>();
  await Promise.all(
    [...wanted.entries()].map(async ([key, sample]) => {
      try {
        const gltf = await loader.loadAsync(sample.url);
        let obj: THREE.Object3D | null = sample.node ? gltf.scene.getObjectByName(sample.node) : gltf.scene;
        if (!obj) {
          warnings.push(`${sample.url} thiếu node ${sample.node}`);
          return;
        }
        obj = obj.clone(true) as THREE.Object3D;
        obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const m = mesh.material as THREE.MeshStandardMaterial;
          if (m && m.roughness !== undefined) m.roughness = Math.max(m.roughness, 0.45);
          if (m && "metalness" in m) m.metalness = Math.min(m.metalness, 0.6);
        });
        // Chân mẫu về gốc: asset của map chuẩn có pivot ở giữa, đặt thẳng xuống là lơ lửng.
        const box = new THREE.Box3().setFromObject(obj);
        const centre = box.getCenter(new THREE.Vector3());
        obj.position.set(-centre.x, -box.min.y, -centre.z);
        const pivot = new THREE.Group();
        pivot.add(obj);
        pivot.scale.setScalar(sample.scale);
        templates.set(key, pivot);
      } catch (error) {
        warnings.push(`${sample.url}: ${(error as Error).message}`);
      }
    }),
  );

  let placed = 0;
  for (const p of plan) {
    const template = templates.get(`${p.url}|${p.node ?? ""}`);
    if (!template) continue;
    const copy = template.clone(true);
    copy.position.set(p.x, p.y, p.z);
    copy.rotation.y = p.yaw;
    parent.add(copy);
    onAssetLoaded?.(copy);
    placed += 1;
  }
  if (warnings.length) console.warn("[citymap] đồ vỉa hè GLB:", warnings.join(" · "));
  return { placed, warnings };
}
