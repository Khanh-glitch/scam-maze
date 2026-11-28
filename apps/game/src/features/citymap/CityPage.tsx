import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { generateCity, type City } from "./cityGen";
import { buildCityMesh, type Part } from "./cityMesh";
import { buildCoreWorld, type CoreWorld } from "./coreWorld";
import { buildRealWorld, type RealWorldHandle } from "./realWorld";

/**
 * `/saigon` — bản đồ Sài Gòn 2026 SINH TỰ ĐỘNG (`cityGen`) dựng bằng three.js.
 *
 * Vì sao có trang này: suốt một thời gian dài thành phố chỉ tồn tại trong ảnh kiểm toán offline
 * (`scripts/city-render.ts` → PNG). Người chơi mở preview vẫn thấy bản đồ cũ — đúng, vì chưa có
 * ai nối `cityGen` vào engine. Trang này là mối nối: cùng dữ liệu, cùng `buildCityMesh`, hiển thị
 * thời gian thực, đi lại được.
 *
 * Điều khiển: kéo chuột trái để xoay, chuột phải (hoặc Shift+kéo) để dịch, lăn chuột để thu phóng,
 * WASD/QE để bay, giữ Shift để bay nhanh.
 */
export interface CityPageProps {
  onBackToMenu?: () => void;
}

const SKY_TOP = "#26374f";
const SKY_BOTTOM = "#c8a68c";

/** Lăng trụ tam giác: đáy 1×1, cao 1, sống nóc chạy dọc trục x. */
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

/**
 * Vân mặt đứng: một tấm tường có lưới cửa sổ. Không có nó thì toà nhà chỉ là khối màu — đúng thứ
 * "khối hình học ghép lại" cần tránh. Vân tô trắng để màu từng toà (instance colour) còn nhân lên.
 */
const facadeTexture = (): THREE.Texture => {
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

/**
 * Cạnh ô chia thành phố (m). Chia ô để mỗi ô cull được riêng theo khung nhìn — trên GPU thật đây là
 * cách cắt số hình phải vẽ khi đứng trong phố. Nhưng mỗi ô là một lệnh vẽ: ở trình duyệt phần mềm
 * (SwiftShader, GPU ảo) 250 lệnh vẽ đắt hơn 8 lệnh vẽ kèm cull hỏng — đo được 2,3 fps so với 20 fps.
 * Vì vậy mặc định TẮT, bật bằng `?chunk=1` (hoặc `?chunk=640` để đổi cạnh ô).
 */
let CHUNK = 0;

/**
 * Như `addInstanced` nhưng chia theo ô 320 m: mỗi ô là một `InstancedMesh` riêng, có bao cầu riêng,
 * nên khi nhìn dọc một con phố máy chỉ vẽ những ô trong khung hình thay vì **toàn bộ 97 000 khối**.
 * Bản cũ đặt `frustumCulled = false` cho tất cả: đứng ở đâu cũng vẽ cả thành phố 1,3 km.
 */
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

export const CityPage: React.FC<CityPageProps> = ({ onBackToMenu }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Array<{ id: string; name: string; x: number; y: number }>>([]);
  const [showLabels, setShowLabels] = useState(true);
  const [hud, setHud] = useState<{ fps: number; height: number }>({ fps: 0, height: 0 });

  // Sinh thành phố tốn ~4 s: đẩy sang nhịp sau để màn hình "đang dựng" vẽ trước.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        // Map thật (`features/testbus/openworld`) mặc định được dựng trong thành phố; `?real=0` để
        // xem thành phố thuần thủ tục (đo đạc). Thành phố phải biết trước để chừa đất và không dựng
        // bản sao Bitexco / Landmark 81.
        const realOn = new URLSearchParams(window.location.search).get("real") !== "0";
        setCity(generateCity(undefined, { realWorld: realOn }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "không sinh được thành phố");
      }
    }, 30);
    return () => window.clearTimeout(id);
  }, []);

  const meshData = useMemo(() => (city ? buildCityMesh(city) : null), [city]);

  const labelRef = useRef<Array<{ id: string; name: string; pos: THREE.Vector3 }>>([]);
  const [coreLoad, setCoreLoad] = useState<{ step: string; fraction: number } | null>(null);
  /** Trạng thái khu phố gốc để người xem biết nó đang dựng, đã xong hay lỗi — không phải đoán. */
  const [coreState, setCoreState] = useState<"pending" | "ready" | "error">("pending");
  const [coreError, setCoreError] = useState<string>("");
  /** Camera bay tới khu phố gốc khi bấm nút. */
  const flyToCoreRef = useRef<(() => void) | null>(null);
  /** Map thật Sài Gòn (Lý Thái Tổ, Bitexco, Landmark 81, nhà trọ 59) — trạng thái để chip nói ra. */
  const [realState, setRealState] = useState<"off" | "pending" | "ready" | "error">("off");
  const [realLoad, setRealLoad] = useState<{ step: string; fraction: number } | null>(null);
  const [realError, setRealError] = useState<string>("");
  const [realStats, setRealStats] = useState<{ chunks: number; ms: number } | null>(null);
  const flyToRealRef = useRef<(() => void) | null>(null);
  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  const mount = useCallback(() => {
    if (!mountRef.current || !meshData || !city) return undefined;
    let cancelled = false;
    const el = mountRef.current;
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;

    const qs = new URLSearchParams(window.location.search);
    CHUNK = Number(qs.get("chunk") ?? 0) || 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    renderer.setClearColor(SKY_BOTTOM);
    // Nắng + trời tán xạ cộng lại từng vượt 1,0 → tường bê tông thành màu be, mất sắc xám.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = qs.has("expo") ? Number(qs.get("expo")) || 1.45 : 1.45;
    // Bóng đổ: một nguồn nắng chiều thấp. Không có bóng thì mọi mặt đứng sáng đều nhau và cả
    // thành phố đọc ra "các khối màu dán lên nền" — đúng thứ cần tránh.
    renderer.shadowMap.enabled = true;
    // Thành phố tĩnh: chỉ vẽ lại bản đồ bóng khi camera pan đủ xa, nếu không mỗi khung hình phải
    // dựng lại cả 43.000 khối thêm một lần nữa.
    // Bóng vẽ mỗi khung (thử tắt autoUpdate: khu phố và nhà mất bóng hoàn toàn — ảnh kiểm tra
    // `_g-shadow.jpg` cho thấy phố phẳng lì, nên giữ vẽ mỗi khung; chỉ thu nhỏ khung bóng cho sắc).
    renderer.shadowMap.autoUpdate = !qs.has("noshadow");
    renderer.shadowMap.needsUpdate = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const F = city.frame;
    const centre = new THREE.Vector3((F.x0 + F.x1) / 2, 0, (F.z0 + F.z1) / 2);
    scene.fog = new THREE.Fog(SKY_BOTTOM, 900, 3200);

    // Nền trời: gradient vẽ vào canvas rồi dán lên vòm cầu. Bản cũ (cầu một màu + dải trụ mờ) tạo
    // đúng một đường kẻ ngang giữa trời — trông như tấm phông, không như bầu trời.
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 8;
    skyCanvas.height = 256;
    const sg = skyCanvas.getContext("2d");
    if (sg) {
      const grad = sg.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#1e3450");
      grad.addColorStop(0.42, SKY_TOP);
      grad.addColorStop(0.72, "#7d8ea6");
      grad.addColorStop(0.9, SKY_BOTTOM);
      grad.addColorStop(1, "#e6cfb4");
      sg.fillStyle = grad;
      sg.fillRect(0, 0, 8, 256);
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(5200, 32, 24),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);

    // Đất ngoài đô thị: một tấm lớn, cùng tông với nền xám lục của ảnh kiểm toán.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000),
      new THREE.MeshLambertMaterial({ color: "#55544a" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    scene.add(ground);

    const cube = new THREE.BoxGeometry(1, 1, 1);
    cube.translate(0, 0.5, 0);
    const prism = new THREE.CylinderGeometry(1, 1, 1, 8);
    prism.translate(0, 0.5, 0);
    prism.rotateY(Math.PI / 8);

    // Mặt đứng có cửa sổ, mái có vân: hộp nhà đọc ra toà nhà.
    const facade = new THREE.MeshLambertMaterial({ map: facadeTexture() });
    // Sửa UV theo kích thước THẬT của từng instance: hộp 60 m cao mà dán 4 cửa sổ thì đọc ra "tường
    // trơn có 4 ô đen". Một ô vân = 4 cửa sổ ≈ 13,5 m ngang, 14,5 m đứng.
    facade.onBeforeCompile = (shader) => {
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
    const roofMat = new THREE.MeshLambertMaterial({ map: roofTexture() });
    // BoxGeometry có 6 nhóm mặt: +x, -x, +y, -y, +z, -z
    addChunked(scene, cube, meshData.boxes, { materials: [facade, facade, roofMat, roofMat, facade, facade] });
    // Đường, hè, nước, sân, vật thể: màu phẳng. Dán vân cửa sổ lên mặt đường là biến phố thành
    // một tấm lưới đen (lỗi nhìn thấy ngay ở khung ngang tầm mắt).
    // Mặt đường/sân/nước chỉ nhận bóng: cho 30 000 tấm phẳng ném bóng là tiền mất tật mang.
    addChunked(scene, cube, meshData.flat, { materials: new THREE.MeshLambertMaterial(), castShadow: false });
    addChunked(scene, prism, meshData.prisms);
    addChunked(scene, gableGeometry(), meshData.gables);
    // Chi tiết mặt tiền (cửa cuốn, biển hiệu, mái hiên, ban công) không vân, màu phẳng.
    addChunked(scene, cube, meshData.details, { materials: new THREE.MeshLambertMaterial(), castShadow: false });
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    addChunked(scene, trunkGeo, meshData.trunks);
    const canopyGeo = new THREE.ConeGeometry(0.5, 1, 7);
    canopyGeo.translate(0, 0.5, 0);
    addChunked(scene, canopyGeo, meshData.canopies);
    const drumGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    drumGeo.translate(0, 0.5, 0);
    addChunked(scene, drumGeo, meshData.drums, { materials: new THREE.MeshLambertMaterial({ color: "#c9cdd2" }), castShadow: false });

    // KHU PHỐ GỐC: cắm nguyên thế giới đang chơi được của game vào đây — nhà ống, mặt đường, vỉa hè,
    // hẻm, sân chung, dây điện, cây, đồ vỉa hè, người và xe máy chạy theo đúng luật của map gốc.
    // Không vẽ lại: cùng builder, cùng dữ liệu, chỉ khác vị trí và không có nền/nhà xa giả.
    // `?core=0` tắt khu phố Nguyễn Du — dùng khi chỉ muốn xem/đo map thật cho nhanh.
    let coreWorld: CoreWorld | null = null;
    if (city.core.streetId && qs.get("core") !== "0") {
      void buildCoreWorld(city.core.x, city.core.z, {
        onStep: (step, fraction) => setCoreLoad({ step, fraction }),
        // Phố hiện ngay khi nhà + mặt đường dựng xong; người và đồ GLB chảy vào sau, không chặn.
        onWorldReady: (root) => {
          if (cancelled) return;
          scene.add(root);
          // Bản đồ bóng giờ là tĩnh: phải vẽ lại một lần khi có hình mới vào scene, nếu không khu
          // phố đứng không bóng cho tới khi người xem đi xa 30 m.
          renderer.shadowMap.needsUpdate = true;
          (window as unknown as { __cityCoreWorldAt?: number }).__cityCoreWorldAt = performance.now();
        },
        humans: qs.get("humans") === "1",
        baothu: qs.get("baothu") === "1",
        nolife: qs.get("nolife") === "1",
      })
        .then((world) => {
          if (cancelled) {
            world.dispose();
            return;
          }
          setCoreState("ready");
          coreWorld = world;
          if (!world.root.parent) scene.add(world.root);
          renderer.shadowMap.needsUpdate = true;
          setCoreLoad(null);
          {
            const box = new THREE.Box3().setFromObject(world.root);
            (window as unknown as { __cityCoreAt?: number }).__cityCoreAt = performance.now();
            (window as unknown as { __cityCore?: unknown }).__cityCore = {
              houses: world.houses.length,
              children: world.root.children.length,
              props: world.loaded.props,
              bounds: { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z },
            };
          }
        })
        .catch((err) => {
          console.error("[citymap] khu phố gốc không dựng được", err);
          setCoreLoad(null);
          setCoreState("error");
          setCoreError(err instanceof Error ? err.message : String(err));
        });
    }

    // BẢN ĐỒ THẬT: dựng thẳng Sài Gòn dựng tay của game (`features/testbus/openworld`) vào thành
    // phố — hẻm 462/14 Lý Thái Tổ, nhà trọ 59 với phòng 6.07 của nhân vật chính, Đại lộ 3/2, Hải
    // Triều, Đại lộ Đông, bến sông Bình Thạnh, quảng trường Landmark 81, Bitexco và Landmark 81.
    // Cùng ba hàm dựng của engine gốc; ở đây chỉ khác cái scene và việc cập nhật streamer bằng
    // camera thành phố. `?real=0` để tắt (khi đó thành phố vẫn chừa đất nhưng mảng đó trống).
    let realWorld: RealWorldHandle | null = null;
    if (qs.get("real") !== "0") {
      setRealState("pending");
      const realT0 = performance.now();
      void buildRealWorld({
        renderer,
        onStep: (step, fraction) => setRealLoad({ step, fraction }),
      })
        .then((world) => {
          if (cancelled) {
            world.dispose();
            return;
          }
          realWorld = world;
          scene.add(world.root);
          renderer.shadowMap.needsUpdate = true;
          setRealState("ready");
          setRealLoad(null);
          const ms = Math.round(performance.now() - realT0);
          setRealStats({ chunks: world.stats.chunks, ms });
          const box = new THREE.Box3().setFromObject(world.root);
          (window as unknown as { __cityReal?: unknown }).__cityReal = {
            chunks: world.stats.chunks,
            buildMs: ms,
            bounds: { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z },
          };
        })
        .catch((err) => {
          console.error("[citymap] map thật không dựng được", err);
          setRealLoad(null);
          setRealState("error");
          setRealError(err instanceof Error ? err.message : String(err));
        });
    }

    // Nắng chiều thấp: một nguồn chính + trời tán xạ. Bóng đổ thật (shadow map) cho 20.000 khối
    // thì vượt ngân sách khung hình của máy yếu, nên dùng sáng hai chiều + sương làm độ sâu.
    const sunLevel = Number(new URLSearchParams(window.location.search).get("sun"));
    const sun = new THREE.DirectionalLight("#ffe6c8", Number.isFinite(sunLevel) && qs.has("sun") ? sunLevel : 1.9);
    sun.position.set(-520, 1150, 640);
    sun.castShadow = true;
    // Bóng chỉ cần đúng quanh chỗ đang xem. Trước đây khung bóng phủ ±900 m với bản đồ 2048²:
    // mỗi texel ~0,88 m nên bóng nhoè thành vệt xám, mà vẫn phải vẽ cả thành phố vào bản đồ bóng.
    // ±330 m → ~0,32 m/texel: bóng sắc hơn và rẻ hơn nhiều.
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -330;
    sun.shadow.camera.right = 330;
    sun.shadow.camera.top = 330;
    sun.shadow.camera.bottom = -330;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 3000;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.6;
    scene.add(sun);
    scene.add(sun.target);
    const hemiLevel = Number(qs.get("hemi"));
    scene.add(new THREE.HemisphereLight("#b3c0cf", "#5f5748", qs.has("hemi") && Number.isFinite(hemiLevel) ? hemiLevel : 2.0));

    const num = (k: string, d: number) => {
      const v = Number(qs.get(k));
      return Number.isFinite(v) && qs.get(k) !== null && qs.get(k) !== "" ? v : d;
    };
    const tq = (qs.get("t") ?? "").split(",").map(Number);
    const camera = new THREE.PerspectiveCamera(num("fov", 48), W / H, 0.4, 6000);
    // Mở trang là đứng ngay trên KHU PHỐ GỐC — bản đồ đang chơi được — rồi mới nhìn ra thành phố
    // sinh tự động mọc quanh nó. Thành phố 1,2 km mà mở màn ở góc bất kỳ thì không ai thấy bản đồ thật.
    const coreCentre = new THREE.Vector3(city.core.x, 0, city.core.z - 6);
    const hasCore = Boolean(city.core.streetId);
    const target = new THREE.Vector3(
      Number.isFinite(tq[0]) ? tq[0] : hasCore ? coreCentre.x : centre.x,
      num("ty", 20),
      Number.isFinite(tq[1]) ? tq[1] : hasCore ? coreCentre.z : centre.z,
    );
    let radius = num("r", hasCore ? 150 : 900);
    let yaw = num("yaw", hasCore ? -1.35 : -2.3);
    let pitch = num("pitch", hasCore ? -0.32 : -0.42);
    const applyCamera = () => {
      const cp = Math.cos(pitch);
      camera.position.set(
        target.x + Math.sin(yaw) * cp * radius,
        target.y - Math.sin(pitch) * radius,
        target.z + Math.cos(yaw) * cp * radius,
      );
      camera.lookAt(target);
    };
    applyCamera();

    // --- điều khiển -------------------------------------------------------------------------
    let dragging: "orbit" | "pan" | null = null;
    let lastX = 0;
    let lastY = 0;
    const keys = new Set<string>();
    const onDown = (ev: PointerEvent) => {
      dragging = ev.button === 2 || ev.shiftKey ? "pan" : "orbit";
      lastX = ev.clientX;
      lastY = ev.clientY;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const onUp = (ev: PointerEvent) => {
      dragging = null;
      if (renderer.domElement.hasPointerCapture(ev.pointerId)) renderer.domElement.releasePointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (dragging === "orbit") {
        yaw -= dx * 0.005;
        pitch = Math.max(-1.45, Math.min(-0.02, pitch + dy * 0.004));
      } else {
        // dịch theo mặt phẳng ngang, tỉ lệ theo khoảng cách để kéo ở xa không bị "nhảy"
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const k = radius * 0.0016;
        target.addScaledVector(right, -dx * k);
        target.addScaledVector(fwd, -dy * k);
      }
      applyCamera();
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      radius = Math.max(40, Math.min(3000, radius * (1 + Math.sign(ev.deltaY) * 0.12)));
      applyCamera();
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      keys.add(ev.key.toLowerCase());
    };
    const onKeyUp = (ev: KeyboardEvent) => keys.delete(ev.key.toLowerCase());
    const onContext = (ev: Event) => ev.preventDefault();

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onResize = () => {
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    flyToCoreRef.current = () => {
      if (!city.core.streetId) return;
      target.set(city.core.x, 3, city.core.z - 6);
      radius = 140;
      yaw = -1.35;
      pitch = -0.32;
      applyCamera();
    };

    flyToRealRef.current = () => {
      // Đứng giữa hẻm 462/14 nhìn lên dãy trọ 59 — chỗ nhân vật chính ở trong map thật.
      target.set(6, 2.2, -34);
      yaw = Math.PI;
      pitch = -0.12;
      radius = 26;
      applyCamera();
    };

    // Móc kiểm tra: đọc được scene/camera/renderer từ ngoài (probe, kiểm toán) mà không phải đoán.
    {
      const dbg = window as unknown as { __cityScene?: THREE.Scene; __cityCamera?: THREE.Camera; __cityRenderer?: THREE.WebGLRenderer };
      dbg.__cityScene = scene;
      dbg.__cityCamera = camera;
      dbg.__cityRenderer = renderer;
    }

    labelRef.current = meshData.anchors.map((a) => ({ id: a.id, name: a.name, pos: new THREE.Vector3(a.x, a.y, a.z) }));

    let raf = 0;
    let frames = 0;
    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    const loop = () => {
      const dt = Math.min(0.05, clock.getDelta());
      const now = clock.elapsedTime;
      coreWorld?.update(dt, now);
      realWorld?.update(dt, now, camera);
      const boost = keys.has("shift") ? 4 : 1;
      const step = 60 * boost * dt;
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      if (keys.has("w") || keys.has("arrowup")) target.addScaledVector(fwd, -step);
      if (keys.has("s") || keys.has("arrowdown")) target.addScaledVector(fwd, step);
      if (keys.has("a") || keys.has("arrowleft")) target.addScaledVector(right, -step);
      if (keys.has("d") || keys.has("arrowright")) target.addScaledVector(right, step);
      if (keys.has("q")) target.y -= step * 0.6;
      if (keys.has("e")) target.y += step * 0.6;
      if (keys.size) applyCamera();
      // nguồn nắng đi theo điểm nhìn để bản đồ bóng luôn phủ vùng đang xem
      // Bóng tĩnh: chỉ vẽ lại bản đồ bóng khi điểm nhìn đã đi xa hơn 30 m, không phải mỗi khung.
      if (sun.target.position.distanceToSquared(new THREE.Vector3(target.x, 0, target.z)) > 900) {
        renderer.shadowMap.needsUpdate = true;
      }
      sun.position.set(target.x - 520, 1150, target.z + 640);
      sun.target.position.set(target.x, 0, target.z);
      sky.position.set(camera.position.x, 0, camera.position.z);
      renderer.render(scene, camera);

      // nhãn mốc: chiếu vào màn hình mỗi khung (9 nhãn, không đáng kể)
      if (showLabelsRef.current) {
        const out: Array<{ id: string; name: string; x: number; y: number }> = [];
        for (const l of labelRef.current) {
          tmp.copy(l.pos).project(camera);
          if (tmp.z > 1 || tmp.z < -1) continue;
          const sx = (tmp.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
          const sy = (-tmp.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
          if (sx < -80 || sy < -40 || sx > renderer.domElement.clientWidth + 80 || sy > renderer.domElement.clientHeight + 40) continue;
          out.push({ id: l.id, name: l.name, x: sx, y: sy });
        }
        setLabels((prev) => {
          if (prev.length === out.length && prev.every((p, i) => Math.abs(p.x - out[i].x) < 2 && Math.abs(p.y - out[i].y) < 2 && p.id === out[i].id)) return prev;
          return out;
        });
      } else {
        setLabels((prev) => (prev.length ? [] : prev));
      }

      frames += 1;
      if (frames % 30 === 0) setHud({ fps: Math.round(1 / Math.max(0.001, dt)), height: Math.round(camera.position.y) });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      coreWorld?.dispose();
      coreWorld = null;
      realWorld?.dispose();
      realWorld = null;
      cancelAnimationFrame(raf);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, [meshData, city]);

  useEffect(() => mount(), [mount]);

  const s = meshData?.stats;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1b2330] text-white">
      <div ref={mountRef} className="absolute inset-0" />

      {/* nhãn mốc thật */}
      {showLabels &&
        labels.map((l) => (
          <div
            key={l.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white shadow-sm backdrop-blur-sm"
            style={{ left: l.x, top: l.y }}
          >
            {l.name}
          </div>
        ))}

      {!city && !error && (
        <div className="absolute inset-0 grid place-items-center bg-[#10141c]">
          <div className="text-center">
            <div className="text-sm uppercase tracking-[0.3em] text-white/50">Sài Gòn 2026</div>
            <div className="mt-3 text-2xl font-semibold">Đang dựng thành phố…</div>
            <div className="mt-2 text-sm text-white/60">4.300 toà · 27 km đường · mất khoảng 4 giây</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-[#1a1013]">
          <div className="max-w-md text-center">
            <div className="text-lg font-semibold text-red-300">Không dựng được thành phố</div>
            <div className="mt-2 text-sm text-white/70">{error}</div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-black/50 px-3 py-2 backdrop-blur">
        <div className="text-[11px] uppercase tracking-[0.25em] text-white/45">Bản đồ sinh tự động</div>
        <div className="text-lg font-semibold leading-tight">Sài Gòn 2026</div>
        {s && (
          <div className="mt-1 text-[11px] leading-relaxed text-white/65">
            {s.buildings.toLocaleString("vi-VN")} toà · {s.towers} tháp · {s.gabledRoofs.toLocaleString("vi-VN")} mái dốc
            <br />
            {s.roads} đoạn đường · {s.props.toLocaleString("vi-VN")} vật thể · {s.parts.toLocaleString("vi-VN")} khối
            <br />
            cao nhất {Math.round(s.maxY)} m
          </div>
        )}
      </div>

      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowLabels((v) => !v)}
          className="cursor-pointer rounded-md border border-white/15 bg-black/45 px-2.5 py-1 text-xs font-medium backdrop-blur transition hover:bg-white/20"
        >
          {showLabels ? "Ẩn tên mốc" : "Hiện tên mốc"}
        </button>
        {onBackToMenu && (
          <button
            type="button"
            onClick={onBackToMenu}
            className="cursor-pointer rounded-md border border-white/15 bg-black/45 px-2.5 py-1 text-xs font-medium backdrop-blur transition hover:bg-white/20"
          >
            Về menu
          </button>
        )}
      </div>

      {/*
        Trước đây không có gì trên màn hình nói khu phố gốc đang dựng hay đã hỏng, nên người xem chỉ
        thấy thành phố khối và tưởng map gốc không có trong /saigon. Chip này nói thẳng trạng thái.
      */}
      {city?.core.streetId && (
        <div className="pointer-events-auto absolute left-4 top-24 rounded-md border border-white/15 bg-black/55 px-3 py-2 text-[11px] leading-relaxed text-white/85 backdrop-blur">
          <div className="font-medium">
            {coreState === "ready"
              ? `Khu phố gốc · ${city.core.streetName} ✓`
              : coreState === "error"
                ? "Khu phố gốc: dựng thất bại"
                : `Đang dựng khu phố gốc${coreLoad ? ` (${coreLoad.step} ${Math.round(coreLoad.fraction * 100)}%)` : ""}`}
          </div>
          {coreState === "error" && <div className="max-w-[280px] text-red-300">{coreError.slice(0, 160)}</div>}
          {coreState === "ready" && <div className="text-white/55">44 nhà ống · hẻm cụt · sân chung · người &amp; xe của map gốc</div>}
          <button
            type="button"
            onClick={() => flyToCoreRef.current?.()}
            className="mt-1 cursor-pointer rounded border border-white/20 px-2 py-0.5 text-[11px] hover:bg-white/15"
          >
            Bay tới khu phố gốc
          </button>
          {/* MAP THẬT — Lý Thái Tổ, nhà trọ 59, Bitexco, Landmark 81. Trạng thái hiện ngay trên
              màn hình: trước đây không có gì báo nên rất dễ tưởng map thật không nằm trong thành phố. */}
          <div className="mt-2 border-t border-white/15 pt-1.5">
            <div className="font-medium">
              {realState === "off"
                ? "Map thật: tắt (?real=0)"
                : realState === "ready"
                  ? "Map thật Sài Gòn ✓"
                  : realState === "error"
                    ? "Map thật: dựng thất bại"
                    : `Đang dựng map thật${realLoad ? ` (${realLoad.step} ${Math.round(realLoad.fraction * 100)}%)` : ""}`}
            </div>
            {realState === "error" && <div className="max-w-[280px] text-red-300">{realError.slice(0, 160)}</div>}
            {realState === "ready" && (
              <div className="text-white/55">
                Lý Thái Tổ · nhà trọ 59 · phòng 6.07 · Bitexco · Landmark 81
                {realStats ? ` · ${realStats.chunks} ô · ${(realStats.ms / 1000).toFixed(0)} s` : ""}
              </div>
            )}
            <button
              type="button"
              onClick={() => flyToRealRef.current?.()}
              className="mt-1 cursor-pointer rounded border border-white/20 px-2 py-0.5 text-[11px] hover:bg-white/15"
            >
              Bay tới hẻm 462/14 (Lý Thái Tổ)
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-white/55">
        kéo trái: xoay · kéo phải / shift: dịch · lăn: thu phóng · WASD: bay · Q/E: lên xuống
        {hud.fps ? ` · ${hud.fps} fps · camera ${hud.height} m` : ""}
      </div>
    </div>
  );
};
