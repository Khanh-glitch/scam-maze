import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { generateCity, type City } from "./cityGen";
import { buildCityMesh } from "./cityMesh";
import { buildCoreWorld, type CoreWorld } from "./coreWorld";
import { buildRealWorld, type RealWorldHandle } from "./realWorld";
import { addCityLayer } from "./cityLayer";

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
  const [realStats, setRealStats] = useState<{ chunks: number; ms: number; corridors: number; vehicles: number } | null>(null);
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

    // ENV MAP: map chuẩn có `AtmosphereSystem` nạp PMREM từ chính vòm trời, nên mặt đường/nhựa/kính
    // đều có phản chiếu mềm và "ướt". /saigon trước đây không có gì trong `scene.environment`, nên
    // mọi vật liệu PBR ra bết — đây là nửa còn lại của khác biệt về mặt đường. Ở đây nướng một PMREM
    // 128 từ đúng gradient trời/đất đang dùng (một lần, rất rẻ) thay vì kéo cả hệ thống khí quyển.
    try {
      const envCanvas = document.createElement("canvas");
      envCanvas.width = 64;
      envCanvas.height = 32;
      const eg = envCanvas.getContext("2d");
      if (eg) {
        const grad = eg.createLinearGradient(0, 0, 0, 32);
        grad.addColorStop(0, "#2b4a86");
        grad.addColorStop(0.45, "#9dbbdd");
        grad.addColorStop(0.55, "#cfd8dc");
        grad.addColorStop(0.75, "#6f6a5e");
        grad.addColorStop(1, "#46443c");
        eg.fillStyle = grad;
        eg.fillRect(0, 0, 64, 32);
      }
      const envTex = new THREE.CanvasTexture(envCanvas);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const rt = pmrem.fromEquirectangular(envTex);
      scene.environment = rt.texture;
      scene.environmentIntensity = 0.85;
      envTex.dispose();
      pmrem.dispose();
    } catch (err) {
      console.warn("[citymap] không nướng được env map", err);
    }

    // Phát hiện renderer phần mềm (SwiftShader/llvmpipe): hạ chi tiết y như map chuẩn tự hạ.
    const SOFT_GL = (() => {
      try {
        const gl = renderer.getContext();
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        const info = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
        // `?hq=1` ép bản đầy đủ (cây thật, normal map mặt đường) kể cả trên máy phần mềm.
        const forced = new URLSearchParams(window.location.search).get("hq") === "1";
        return !forced && /swiftshader|llvmpipe|software|mesa offscreen/i.test(info);
      } catch {
        return false;
      }
    })();

    // CẤY THÀNH PHỐ: toàn bộ phần "thành phố sinh tự động" nằm trong `cityLayer.ts` — cùng hàm mà
    // runtime `/testbus` dùng để cấy thành phố vào chính nó, nên hai nơi không thể lệch chất lượng.
    let treeWind: { uTime: { value: number }; uWind: { value: number } } | null = null;
    {
      const layer = addCityLayer(scene, city, { meshData, software: SOFT_GL, chunkMeters: Number(qs.get("chunk") ?? 0) || 0 });
      treeWind = layer.wind;
    }

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
        city,
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
          setRealStats({ chunks: world.stats.chunks, ms, corridors: world.stats.cityCorridors, vehicles: world.stats.cityVehicles });
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
      if (treeWind) treeWind.uTime.value = now;
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
                {realStats
                  ? ` · ${realStats.chunks} ô · ${realStats.corridors} tuyến phố thành phố · ${(realStats.ms / 1000).toFixed(0)} s`
                  : ""}
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
