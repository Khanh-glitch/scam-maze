import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { generateCity, type City } from "./cityGen";
import { buildCityMesh, type Part } from "./cityMesh";

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
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#f2efe9";
    g.fillRect(0, 0, 128, 128);
    // nhiễu nhẹ: tường vôi không phẳng tuyệt đối
    for (let i = 0; i < 700; i += 1) {
      g.fillStyle = `rgba(120,110,100,${0.02 + Math.random() * 0.04})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    // lưới cửa sổ 4 × 4, mỗi ô có bậu và bóng dưới
    for (let r = 0; r < 4; r += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = 8 + col * 30;
        const y = 10 + r * 30;
        g.fillStyle = "rgba(28,34,44,0.62)";
        g.fillRect(x, y, 20, 18);
        g.fillStyle = "rgba(255,255,255,0.25)";
        g.fillRect(x, y + 18, 20, 2);
        g.fillStyle = "rgba(20,24,32,0.18)";
        g.fillRect(x, y - 2, 20, 2);
      }
    }
    // dải sàn giữa các tầng
    for (let r = 0; r < 4; r += 1) {
      g.fillStyle = "rgba(90,86,80,0.18)";
      g.fillRect(0, 4 + r * 30, 128, 2);
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
    e.set(0, p.ry ?? 0, 0);
    q.setFromEuler(e);
    pos.set(p.x, p.y, p.z);
    scale.set(p.sx, p.sy, p.sz);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.set(p.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
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
        setCity(generateCity());
      } catch (err) {
        setError(err instanceof Error ? err.message : "không sinh được thành phố");
      }
    }, 30);
    return () => window.clearTimeout(id);
  }, []);

  const meshData = useMemo(() => (city ? buildCityMesh(city) : null), [city]);

  const labelRef = useRef<Array<{ id: string; name: string; pos: THREE.Vector3 }>>([]);
  const showLabelsRef = useRef(showLabels);
  showLabelsRef.current = showLabels;

  const mount = useCallback(() => {
    if (!mountRef.current || !meshData || !city) return undefined;
    const el = mountRef.current;
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    renderer.setClearColor(SKY_BOTTOM);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const F = city.frame;
    const centre = new THREE.Vector3((F.x0 + F.x1) / 2, 0, (F.z0 + F.z1) / 2);
    scene.fog = new THREE.Fog(SKY_BOTTOM, 900, 3200);

    // Nền trời: một vòm lớn tô gradient bằng đỉnh màu (không cần shader riêng).
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(5200, 24, 16),
      new THREE.MeshBasicMaterial({ color: SKY_TOP, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);
    const horizon = new THREE.Mesh(
      new THREE.CylinderGeometry(5000, 5000, 1200, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: SKY_BOTTOM, side: THREE.BackSide, fog: false, transparent: true, opacity: 0.65 }),
    );
    horizon.position.y = 520;
    scene.add(horizon);

    // Đất ngoài đô thị: một tấm lớn, cùng tông với nền xám lục của ảnh kiểm toán.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000),
      new THREE.MeshLambertMaterial({ color: "#55544a" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    scene.add(ground);

    const cube = new THREE.BoxGeometry(1, 1, 1);
    cube.translate(0, 0.5, 0);
    const prism = new THREE.CylinderGeometry(1, 1, 1, 8);
    prism.translate(0, 0.5, 0);
    prism.rotateY(Math.PI / 8);

    // Mặt đứng có cửa sổ, mái có vân: hộp nhà đọc ra toà nhà.
    const facade = new THREE.MeshLambertMaterial({ map: facadeTexture() });
    const roofMat = new THREE.MeshLambertMaterial({ map: roofTexture() });
    // BoxGeometry có 6 nhóm mặt: +x, -x, +y, -y, +z, -z
    addInstanced(scene, cube, meshData.boxes, [facade, facade, roofMat, roofMat, facade, facade]);
    addInstanced(scene, prism, meshData.prisms);
    addInstanced(scene, gableGeometry(), meshData.gables);
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    addInstanced(scene, trunkGeo, meshData.trunks);
    const canopyGeo = new THREE.ConeGeometry(0.5, 1, 7);
    canopyGeo.translate(0, 0.5, 0);
    addInstanced(scene, canopyGeo, meshData.canopies);

    // Nắng chiều thấp: một nguồn chính + trời tán xạ. Bóng đổ thật (shadow map) cho 20.000 khối
    // thì vượt ngân sách khung hình của máy yếu, nên dùng sáng hai chiều + sương làm độ sâu.
    const sun = new THREE.DirectionalLight("#ffe0b8", 2.1);
    sun.position.set(-600, 700, 900);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight("#8fa6c4", "#4a4438", 1.35));

    const camera = new THREE.PerspectiveCamera(48, W / H, 1, 6000);
    const target = new THREE.Vector3(centre.x, 20, centre.z);
    let radius = 900;
    let yaw = -2.3;
    let pitch = -0.42;
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

    labelRef.current = meshData.anchors.map((a) => ({ id: a.id, name: a.name, pos: new THREE.Vector3(a.x, a.y, a.z) }));

    let raf = 0;
    let frames = 0;
    const clock = new THREE.Clock();
    const tmp = new THREE.Vector3();
    const loop = () => {
      const dt = Math.min(0.05, clock.getDelta());
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
      sky.position.set(camera.position.x, 0, camera.position.z);
      horizon.position.set(camera.position.x, 520, camera.position.z);
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

      <div className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-white/55">
        kéo trái: xoay · kéo phải / shift: dịch · lăn: thu phóng · WASD: bay · Q/E: lên xuống
        {hud.fps ? ` · ${hud.fps} fps · camera ${hud.height} m` : ""}
      </div>
    </div>
  );
};
