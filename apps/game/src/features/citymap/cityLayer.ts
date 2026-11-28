import * as THREE from "three";
import { buildCityMesh, type CityMesh, type Part } from "./cityMesh";
import type { City } from "./cityGen";
import { SaigonBotanicalBatch } from "../testbus/openworld/world/foliageAndProps";
import { placeStreetProps } from "../testbus/openworld/simulation/streetPropsGlb";
import { createRealTreeBarkPBR } from "../testbus/openworld/world/pbrTextures";

/**
 * CẤY THÀNH PHỐ SAIGON VÀO MỘT SCENE CÓ SẴN.
 *
 * Hàm này chỉ làm một việc: biến `City` (dữ liệu quy hoạch) thành nội dung scene — mặt đường, bó
 * vỉa, vỉa hè, toà nhà, cây thật, cột đèn, đồ vỉa hè. Nó **không** tạo renderer, camera, đèn hay
 * bầu trời: những thứ đó thuộc về runtime đang chạy (`OpenWorldEngine` của `/testbus`, có
 * `AtmosphereSystem`), và đây chính là đường để thành phố được cấy vào runtime đó thay vì dựng một
 * engine thứ hai chất lượng thấp hơn.
 *
 * Cùng hàm này được `/saigon` dùng — nên hai nơi không bao giờ lệch chất lượng nhau.
 */

/** Cạnh ô chia thành phố (m). 0 = tắt chia ô (mặc định, xem `CityPage`). */
let CHUNK = 0;

export interface CityLayerOptions {
  meshData?: CityMesh;
  /** Máy chạy renderer phần mềm: hạ chi tiết như map chuẩn tự hạ. */
  software?: boolean;
  /** Chia ô để cull theo khung nhìn (mỗi ô một lệnh vẽ). */
  chunkMeters?: number;
}

export interface CityLayer {
  anchors: CityMesh["anchors"];
  trees: number;
  /** Uniform gió của bộ cây, cập nhật mỗi khung bằng `uTime.value = t`. */
  wind: { uTime: { value: number }; uWind: { value: number } } | null;
}

export const addCityLayer = (scene: THREE.Scene, city: City, opts: CityLayerOptions = {}): CityLayer => {
  CHUNK = opts.chunkMeters ?? 0;
  const SOFT_GL = Boolean(opts.software);
  const meshData = opts.meshData ?? buildCityMesh(city);

const gableGeometry = (): THREE.BufferGeometry => {
  const g = new THREE.BufferGeometry();
  // 6 đỉnh: hai tam giác đầu hồi + bốn đỉnh mái dốc
  const v = new Float32Array([
    // mặt dốc nam (z = -0.5 → sống nóc z = 0)
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0,
    -0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0,
    // mặt dốc bắc
    0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 1, 0,
    0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0,
    // đầu hồi
    0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0,
    -0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 1, 0,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
};

const facadeTexture = (plaster?: string): THREE.Texture => {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#efebe2";
    g.fillRect(0, 0, S, S);
    // vôi loang
    for (let i = 0; i < 2600; i += 1) {
      g.fillStyle = `rgba(118,108,96,${0.012 + Math.random() * 0.03})`;
      g.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 4, 3);
    }
    // Dầm sàn: đường ngang mỗi 60 px ≈ 3,4 m. Đây là chi tiết quyết định — thiếu nó, mặt tường
    // 20 m chỉ là một mảng phẳng dán hình cửa sổ.
    for (let r = 0; r < 4; r += 1) {
      const y = 8 + r * 60;
      g.fillStyle = "rgba(96,90,82,0.30)";
      g.fillRect(0, y, S, 3);
      g.fillStyle = "rgba(255,255,255,0.30)";
      g.fillRect(0, y + 3, S, 2);
    }
    // 4 × 4 ô cửa: khung đậm, kính xám xanh, bệ cửa sáng, có ô lắp máy lạnh
    for (let r = 0; r < 4; r += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = 16 + col * 60;
        const y = 20 + r * 60;
        g.fillStyle = "rgba(44,52,64,0.46)";
        g.fillRect(x, y, 33, 29);
        g.fillStyle = "rgba(150,163,175,0.30)";
        g.fillRect(x + 2, y + 2, 13, 11);
        g.fillStyle = "rgba(255,255,255,0.40)";
        g.fillRect(x, y + 29, 33, 3);
        g.fillStyle = "rgba(38,42,50,0.16)";
        g.fillRect(x, y - 3, 33, 3);
        if (Math.random() > 0.78) {
          g.fillStyle = "rgba(206,206,200,0.85)";
          g.fillRect(x + 4, y + 32, 15, 8);
          g.fillStyle = "rgba(70,72,74,0.5)";
          g.fillRect(x + 4, y + 38, 15, 2);
        }
      }
    }
    // ống thoát nước chạy dọc mép tấm vân: mỗi 13,5 m một ống, đúng nhịp nhà phố
    g.fillStyle = "rgba(104,100,94,0.55)";
    g.fillRect(0, 0, 5, S);
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.fillRect(5, 0, 1, S);
    for (let k = 0; k < 4; k += 1) {
      g.fillStyle = "rgba(70,68,64,0.5)";
      g.fillRect(0, 14 + k * 60, 8, 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  // BỘ ĐỒ CỦA MAP CHUẨN: phủ ảnh quét thạch cao/vôi thật (`q1/*-map.webp`, cùng bộ map chuẩn dùng
  // cho mặt đứng) lên trên tấm vân vẽ tay, chế độ `multiply` — cửa sổ, dầm sàn, ống nước vẫn còn
  // nhưng bề mặt là ảnh thật, không còn "tường nhựa phẳng". Ảnh về muộn thì vân vẽ tay vẫn dùng
  // được ngay từ khung hình đầu.
  if (plaster && g) {
    const img = new Image();
    img.onload = () => {
      g.save();
      g.globalCompositeOperation = "multiply";
      g.globalAlpha = 0.85;
      for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) g.drawImage(img, i * S * 0.5, j * S * 0.5, S * 0.5, S * 0.5);
      }
      g.restore();
      t.needsUpdate = true;
    };
    img.src = `/assets/testbus/ow/images/q1/${plaster}-map.webp`;
  }
  return t;
};

/** Vân mái: bê tông/tôn xám có vệt, để mặt trên không phải một ô màu phẳng. */
const roofTexture = (): THREE.Texture => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#d9d6d0";
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 40; i += 1) {
      g.fillStyle = `rgba(70,68,66,${0.03 + Math.random() * 0.08})`;
      g.fillRect(0, Math.random() * 64, 64, 1 + Math.random() * 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
};

const addInstanced = (
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  parts: Part[],
  materials?: THREE.Material | THREE.Material[],
) => {
  if (!parts.length) return null;
  const mat = materials ?? new THREE.MeshLambertMaterial({ vertexColors: false });
  const mesh = new THREE.InstancedMesh(geometry, mat, parts.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  parts.forEach((p, i) => {
    // Thứ tự quay: X (bánh xe nằm ngang) → Z (dây võng) → Y (hướng phố).
    e.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0, "YZX");
    q.setFromEuler(e);
    pos.set(p.x, p.y, p.z);
    scale.set(p.sx, p.sy, p.sz);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.set(p.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
};

const tiledSurface = (m: THREE.Material, tileMeters = 3.2): THREE.Material => {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
      #if defined(USE_INSTANCING) && defined(USE_MAP)
        float sX = length(instanceMatrix[0].xyz);
        float sY = length(instanceMatrix[1].xyz);
        float sZ = length(instanceMatrix[2].xyz);
        vec2 dims = abs(normal.y) > 0.5 ? vec2(sZ, sX) : (abs(normal.x) > 0.5 ? vec2(sZ, sY) : vec2(sX, sY));
        vMapUv *= max(vec2(1.0), dims / ${tileMeters.toFixed(2)});
      #endif`,
    );
  };
  m.customProgramCacheKey = () => `city-tiled-${tileMeters.toFixed(2)}`;
  return m;
};

const addChunked = (
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  parts: Part[],
  opts: { materials?: THREE.Material | THREE.Material[]; castShadow?: boolean; receiveShadow?: boolean } = {},
) => {
  if (!parts.length) return [] as THREE.InstancedMesh[];
  if (CHUNK <= 0) {
    const mesh = addInstanced(scene, geometry, parts, opts.materials);
    if (!mesh) return [];
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    return [mesh];
  }
  const buckets = new Map<string, Part[]>();
  for (const p of parts) {
    const key = `${Math.floor(p.x / CHUNK)}|${Math.floor(p.z / CHUNK)}`;
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }
  const out: THREE.InstancedMesh[] = [];
  for (const list of buckets.values()) {
    const mesh = addInstanced(scene, geometry, list, opts.materials);
    if (!mesh) continue;
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    out.push(mesh);
  }
  return out;
};

    const cube = new THREE.BoxGeometry(1, 1, 1);
    cube.translate(0, 0.5, 0);
    const prism = new THREE.CylinderGeometry(1, 1, 1, 8);
    prism.translate(0, 0.5, 0);
    prism.rotateY(Math.PI / 8);

    // Mặt đứng có cửa sổ, mái có vân: hộp nhà đọc ra toà nhà.
    /**
     * Sửa UV theo kích thước THẬT của từng instance: hộp 60 m cao mà dán 4 cửa sổ thì đọc ra "tường
     * trơn có 4 ô đen". Một ô vân = 4 cửa sổ ≈ 13,5 m ngang, 14,5 m đứng.
     */
    const facadeUvPatch = (m: THREE.MeshLambertMaterial) => {
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
          float facadePitch(float size, float tile) { return max(1.0, floor(size / tile + 0.5)); }`,
          )
          .replace(
            "#include <uv_vertex>",
            `#include <uv_vertex>
          #ifdef USE_INSTANCING
            float fSX = length(instanceMatrix[0].xyz);
            float fSY = length(instanceMatrix[1].xyz);
            float fSZ = length(instanceMatrix[2].xyz);
            float fU = abs(normal.x) > 0.5 ? fSZ : fSX;
            vMapUv *= vec2(facadePitch(fU, 13.5), facadePitch(fSY, 14.5));
          #endif`,
          );
      };
      return m;
    };
    const roofMat = new THREE.MeshLambertMaterial({ map: roofTexture() });
    // BoxGeometry có 6 nhóm mặt: +x, -x, +y, -y, +z, -z
    // MẶT ĐỨNG: ba bộ vân, mỗi bộ là **ảnh quét thạch cao của map chuẩn** phủ dưới lưới cửa sổ
    // (`q1/beige_wall_001`, `q1/grey_plaster_02`, `q1/clay_plaster`). Toà được chia theo hash nên dãy
    // phố không còn "một bức tường vẽ một lần rồi dán khắp thành phố", mà vẫn chỉ tốn 3 lệnh vẽ.
    const facadeVariants = ["beige_wall_001", "grey_plaster_02", "clay_plaster"];
    const facadeMats = facadeVariants.map((id) => facadeUvPatch(new THREE.MeshLambertMaterial({ map: facadeTexture(id) })));
    const buckets: Part[][] = facadeVariants.map(() => []);
    const hF = (n: number) => {
      const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    for (const p of meshData.boxes) {
      const b = Math.min(facadeVariants.length - 1, Math.floor(hF(p.x * 1.7 + p.z * 3.3 + p.y * 5.1) * facadeVariants.length));
      buckets[b].push(p);
    }
    buckets.forEach((parts, i) => {
      if (!parts.length) return;
      const m = facadeMats[i];
      addChunked(scene, cube, parts, { materials: [m, m, roofMat, roofMat, m, m] });
    });
    // Đường, hè, nước, sân, vật thể: màu phẳng. Dán vân cửa sổ lên mặt đường là biến phố thành
    // một tấm lưới đen (lỗi nhìn thấy ngay ở khung ngang tầm mắt).
    // Mặt đường/sân/nước chỉ nhận bóng: cho 30 000 tấm phẳng ném bóng là tiền mất tật mang.
    // MẶT ĐƯỜNG LẤY TỪ MAP CHUẨN. `survey/map.webp` (+ normal, + rough) là bộ quét nhựa đường thật
    // mà phố Lý Thái Tổ của `/testbus` dùng. Trước đây mặt đường thành phố chỉ là màu phẳng
    // `#5a5964`; giờ nó là cùng một vật liệu với map chuẩn, nên chỗ giáp ranh không còn "đổi chất".
    // Máy chạy renderer phần mềm (SwiftShader/llvmpipe) thì giữ màu phẳng: nhựa đường có normal map
    // phủ toàn màn hình làm khung hình trong sandbox rớt tới mức không chụp nổi ảnh (đã đo: quá 150 s
    // cho một khung). Trên GPU thật thì bật — cùng cách map chuẩn tự hạ chi tiết khi gặp software.

    const ROAD_COLORS = new Set(["#5a5964", "#605e6b"]);
    const roadParts = meshData.flat
      .filter((p) => p.color && ROAD_COLORS.has(p.color))
      // Màu của instance nhân vào map: phải để trắng, nếu không nhựa đường bị nhân thêm màu xám đậm.
      .map((p) => ({ ...p, color: "#ffffff" }));
    const otherFlat = meshData.flat.filter((p) => !(p.color && ROAD_COLORS.has(p.color)));
    // `MeshLambertMaterial`: cùng một tấm ảnh nhựa đường, nhưng không có per-pixel normal/rough nên
    // rẻ hơn nhiều lần — cái giá phải trả của `MeshStandardMaterial` phủ toàn màn hình đã đo được là
    // khung hình vượt 150 s trong sandbox. Màu phẳng trước đây giữ làm nền khi ảnh chưa tải xong.
    // `#d4d8dc` là đúng màu nhân mà `street.ts` của map chuẩn dùng cho cùng tấm ảnh này
    // (`asphalt.color.set(0xd4d8dc)`); để trắng thì nhựa đường ra gần đen.
    // Trên GPU thật: `MeshStandardMaterial` để dùng được ảnh normal + độ nhám của bản quét (mặt
    // nhựa có hạt, có vệt bánh). Trên renderer phần mềm: Lambert, vì normal map phủ toàn màn hình
    // từng làm khung hình quá 150 s (xem §4i).
    // ĐÚNG CÔNG THỨC CỦA MAP CHUẨN (`simulation/street.ts:227`):
    //   MeshStandardMaterial({ map, roughnessMap, normalMap, normalScale .45, roughness .94 })
    // Khác biệt lớn nhất giữa hai ảnh người dùng gửi không phải màu mà là **độ bóng ướt**: mặt đường
    // map chuẩn có envMap nên phản chiếu trời, còn mặt đường /saigon trước đây là Lambert nên bết.
    // Nay /saigon dùng đúng vật liệu đó + `scene.environment` (xem khối PMREM bên dưới).
    const roadMat: THREE.Material = tiledSurface(
      new THREE.MeshStandardMaterial({ color: "#d4d8dc", roughness: 0.94, metalness: 0.02, envMapIntensity: 0.9 }),
      12.8,
    );
    /**
     * Ảnh quét nhựa đường của map chuẩn, **hạ xuống 256²** qua canvas.
     *
     * Lần đầu tôi gán thẳng file 1024² và mặt đường ra đen tuyền trong sandbox (texture báo
     * `complete: true`, 1024×1024, UV có, mà vẫn đen) — nghi bản WebP 1024² không lên được GPU ảo.
     * Vẽ lại qua canvas 256² vừa nhẹ cho SwiftShader, vừa không phụ thuộc định dạng file.
     */
    const surveyTex = (file: string, apply: (t: THREE.Texture) => void) => {
      const t = new THREE.Texture();
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = 256;
        c.height = 256;
        const g = c.getContext("2d");
        if (!g) return;
        g.drawImage(img, 0, 0, 256, 256);
        const ct = new THREE.CanvasTexture(c);
        ct.colorSpace = THREE.SRGBColorSpace;
        ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
        ct.anisotropy = 4;
        ct.needsUpdate = true;
        apply(ct);
        roadMat.needsUpdate = true;
      };
      img.onerror = () => console.warn("[citymap] không tải được", file);
      img.src = `/assets/testbus/ow/images/survey/${file}`;
      return t;
    };
    // `surveyTex` tự gán `roadMat.map` khi ảnh giải mã xong (bất đồng bộ), nên không cần đặt ở đây.
    // Ảnh màu gán vào `map`; ảnh normal chỉ gán khi vật liệu là Standard (Lambert không có normal map).
    // Trước đây cả hai cùng gán `roadMat.map`, nên ảnh normal ghi đè ảnh màu và mặt đường ra **tím**
    // (lỗi chỉ lộ ở `?hq=1` vì trên máy phần mềm nhánh normal bị tắt).
    surveyTex("map.webp", (t) => {
      (roadMat as THREE.MeshStandardMaterial).map = t;
    });
    if (!SOFT_GL) {
      surveyTex("normal.webp", (t) => {
        const std = roadMat as THREE.MeshStandardMaterial;
        std.normalMap = t;
        std.normalScale.set(0.45, 0.45);
      });
    }
    // Luôn dùng `roadParts` (màu instance = trắng): màu instance nhân vào map, để nguyên `#5a5964`
    // thì nhựa đường bị nhân hai lần và ra đen tuyền — đúng cái đã thấy ở ảnh kiểm tra thứ nhất.
    addChunked(scene, cube, roadParts, { materials: roadMat, castShadow: false });
    // HÈ / SÂN: tấm lát `drive-look/slab-map.webp` của map chuẩn (cùng tấm mà vỉa hè Lý Thái Tổ
    // dùng), UV theo mét để viên lát đúng cỡ 1,2 m chứ không phải ảnh bị kéo.
    const slabTex = new THREE.TextureLoader().load("/assets/testbus/ow/images/drive-look/slab-map.webp");
    slabTex.wrapS = THREE.RepeatWrapping;
    slabTex.wrapT = THREE.RepeatWrapping;
    slabTex.anisotropy = 4;
    const slabMat = tiledSurface(new THREE.MeshLambertMaterial({ map: slabTex, color: "#cfcdc4" }), 1.2);
    addChunked(scene, cube, otherFlat, { materials: slabMat, castShadow: false });
    // Bó vỉa: đá granite hai màu, dựng từ cùng bộ hình khối nhưng **không** dùng chung vật liệu với
    // hè — nếu dùng chung thì mép đường lại lẫn vào mặt hè và mất cạnh.
    addChunked(scene, cube, meshData.kerbs, {
      materials: new THREE.MeshLambertMaterial({ color: "#ffffff" }),
      castShadow: false,
    });
    addChunked(scene, prism, meshData.prisms);
    addChunked(scene, gableGeometry(), meshData.gables);
    // Chi tiết mặt tiền (cửa cuốn, biển hiệu, mái hiên, ban công): trước đây là **màu phẳng**, nên
    // cả dãy cửa cuốn đọc ra những khối xanh đen không rõ là gì. Nay dán tấm tôn cuốn của map chuẩn
    // (`drive-look/tin-map.webp`, cùng tấm mà map chuẩn dùng cho vách tôn) — màu của từng ô vẫn do
    // instance quyết nên mỗi căn vẫn một màu, nhưng bề mặt đọc ra kim loại.
    const tin = new THREE.TextureLoader().load("/assets/testbus/ow/images/drive-look/tin-map.webp");
    tin.wrapS = THREE.RepeatWrapping;
    tin.wrapT = THREE.RepeatWrapping;
    tin.repeat.set(2, 2);
    addChunked(scene, cube, meshData.details, {
      materials: new THREE.MeshLambertMaterial({ map: tin }),
      castShadow: false,
    });
    // CÂY: dùng **đúng bộ cây của map chuẩn** — `SaigonBotanicalBatch` (thân phân nhánh + 20 thẻ lá
    // alpha mỗi cây, tất cả instanced nên cả thành phố chỉ tốn 2 draw call, có gió theo shader).
    // Trước đây thành phố trồng cây bằng nón 7 cạnh (`ConeGeometry(0.5, 1, 7)`) — thứ đọc ra "cây
    // nháp" trong ảnh kiểm tra. Nón chỉ còn là đường lui cho máy chạy renderer phần mềm: 27 000 thẻ
    // lá alpha-test là overdraw, SwiftShader không gánh nổi.
    let treeWind: { uTime: { value: number }; uWind: { value: number } } | null = null;
    if (!SOFT_GL && meshData.trunks.length && meshData.trunks.length === meshData.canopies.length) {
      const batch = new SaigonBotanicalBatch();
      for (let i = 0; i < meshData.trunks.length; i += 1) {
        const t = meshData.trunks[i];
        const c = meshData.canopies[i];
        // Cây đường phố thật cao 7–11 m; khung xương mẫu cao 5,2 m nên scale suy từ chiều cao cũ.
        const scale = Math.min(2.1, Math.max(0.9, (t.sy + c.sy) / 5.2));
        batch.addShadeTree(t.x, t.y, t.z, scale);
      }
      const wind = { uTime: { value: 0 }, uWind: { value: 0.55 } };
      const trees = new THREE.Group();
      trees.name = "city-trees";
      batch.commit(trees, createRealTreeBarkPBR(1, 3), wind, true);
      scene.add(trees);
      treeWind = wind;
    }
    if (!treeWind) {
      const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
      trunkGeo.translate(0, 0.5, 0);
      addChunked(scene, trunkGeo, meshData.trunks);
      const canopyGeo = new THREE.ConeGeometry(0.5, 1, 7);
      canopyGeo.translate(0, 0.5, 0);
      addChunked(scene, canopyGeo, meshData.canopies);
    }
    // ĐỒ VỈA HÈ THẬT của map chuẩn: xe bánh mì, tủ đổi pin, thùng rác inox — **chính file GLB** mà
    // phố Lý Thái Tổ dùng (`simulation/streetPropsGlb.ts`, các node `Prop_BanhMi` / `Prop_BatterySwap`
    // / `Prop_TrashBin`). Đặt thưa (24 chỗ trên 408 sạp) để không thành rừng bản sao và không phá
    // ngân sách khung hình; mỗi chỗ là một bản sao trên mặt hè (y = 0,17 m).
    {
      const spots = city.props.filter((p) => p.kind === "stall").filter((_, i) => i % 17 === 0).slice(0, 24);
      const nodes = ["Prop_BanhMi", "Prop_BatterySwap", "Prop_TrashBin"] as const;
      if (spots.length) {
        void placeStreetProps(
          scene,
          spots.map((p, i) => ({ node: nodes[i % nodes.length], x: p.x, y: 0.17, z: p.z, yaw: (i * 1.7) % (Math.PI * 2) })),
        ).catch((err) => console.warn("[citymap] không đặt được đồ vỉa hè GLB", err));
      }
    }
    // Cột đèn: trụ tròn mảnh, cùng một lưới instanced cho cả 937 cột.
    const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    poleGeo.translate(0, 0.5, 0);
    addChunked(scene, poleGeo, meshData.poles, { materials: new THREE.MeshLambertMaterial({ color: "#ffffff" }), castShadow: false });
    const drumGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    drumGeo.translate(0, 0.5, 0);
    // Vật liệu để **trắng**: màu nằm ở từng instance (bồn inox `#c9cdd2`, thùng rác `#2c4236`,
    // cọc tiêu `#b8542f`, bánh xe). Trước đây vật liệu mang màu inox nên mọi thứ khác trong cùng
    // lưới bị nhân màu thép và mất màu riêng.
    addChunked(scene, drumGeo, meshData.drums, { materials: new THREE.MeshLambertMaterial({ color: "#ffffff" }), castShadow: false });

  return { anchors: meshData.anchors, trees: meshData.trunks.length, wind: treeWind };
};
