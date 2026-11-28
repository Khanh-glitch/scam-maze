/**
 * BẢN ĐỒ THẬT TRONG THÀNH PHỐ — dựng **chính** Sài Gòn dựng tay của game (`features/testbus/openworld`)
 * vào scene của `/saigon`.
 *
 * Đây là map người dùng chỉ đúng tên: **hẻm 462/14 Lý Thái Tổ** (Quận 10) với sân nhà trọ 59 và phòng
 * 6.07 của nhân vật chính, **Đại lộ 3/2**, **Hải Triều**, **Đại lộ Đông**, **bến sông Bình Thạnh**,
 * **quảng trường Landmark 81**, và hai toà **Bitexco** + **Landmark 81**.
 *
 * Không có gì được vẽ lại ở đây. Ba hàm dựng của chính map thật được gọi, theo đúng thứ tự engine của
 * nó gọi (`OpenWorldEngine`):
 *
 *   1. `buildBoardingHouse` — dãy trọ 462/14 + phòng 6.07 + sân,
 *   2. `buildStreet`         — phố Lý Thái Tổ chia ô 21 m + vỉa hè + xe dựng,
 *   3. `buildSaigonDistricts`— các quận, Bitexco, Landmark 81, bến sông, Chợ Lớn, người đi đường,
 *                              cây, đèn, biển LED.
 *
 * Khác biệt duy nhất: chúng được gắn vào một nhóm của thành phố thay vì scene riêng của engine, và
 * `WorldStreamer` được cập nhật bằng camera của thành phố (để LOD và chunk chạy đúng như trong game).
 */
import * as THREE from 'three';
import { WorldStreamer } from '../testbus/openworld/world/WorldStreamer';
import { buildSaigonDistricts, type SaigonDistricts } from '../testbus/openworld/world/saigonDistricts';
import { buildBoardingHouse, type BoardingHouse } from '../testbus/openworld/world/boardingHouse';
import { buildStreet } from '../testbus/openworld/simulation/street';
import { SaigonTrafficManager } from '../testbus/openworld/traffic';
import { extendTrafficGraph, spawnCityVehicles, type CityTrafficExtension } from './cityTraffic';
import type { City } from './cityGen';

type StreetWorld = ReturnType<typeof buildStreet>;

export interface RealWorldOptions {
  /** Thành phố đang dựng — để góp đường thủ tục vào đồ thị giao thông của map chuẩn. */
  city?: City;
  /** Báo tiến độ để chip trên màn hình nói được đang dựng tới đâu. */
  onStep?: (step: 'street' | 'house' | 'districts', fraction: number) => void;
  /** Renderer của trang — chỉ dùng để nhận ra SwiftShader/llvmpipe mà hạ chi tiết như game gốc. */
  renderer?: THREE.WebGLRenderer;
}

export interface RealWorldHandle {
  /** Nhóm chứa toàn bộ map thật. */
  root: THREE.Group;
  stats: {
    /** Số ô mà `WorldStreamer` quản (phố Lý Thái Tổ chia ô + các quận + nhà trọ). */
    chunks: number;
    /** Tuyến phố thủ tục đã góp vào đồ thị giao thông của map chuẩn. */
    cityCorridors: number;
    /** Xe thành phố đặt lên đồ thị đó. */
    cityVehicles: number;
  };
  update(dt: number, t: number, camera: THREE.Camera): void;
  dispose(): void;
}

const yieldFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/** Cùng phép nhận dạng với `OpenWorldEngine.detectSoftwareRenderer`. */
function detectSoftwareRenderer(renderer?: THREE.WebGLRenderer): boolean {
  if (!renderer) return false;
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const info = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|software|mesa offscreen/i.test(info);
  } catch {
    return false;
  }
}

/**
 * Môi trường phản chiếu cho vật liệu PBR của map thật.
 *
 * Thế giới này dựng bằng `MeshStandardMaterial` với kính/kim loại thật — chúng cần `envMap` để phản
 * chiếu. Ở `/testbus`, `AtmosphereSystem` gán `scene.environment`; trong thành phố không có ai gán,
 * nên lần kiểm tra đầu tiên toàn bộ toà kính và tháp Bitexco / Landmark 81 ra **màu đen**.
 *
 * Chỉ gán cho hình học của map thật (không đụng vào vật liệu của thành phố): một tấm gradient trời
 * chiều làm equirect, cho qua PMREM để có phản chiếu nhám đúng.
 */
function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#4a6b96'); // trời cao
    g.addColorStop(0.42, '#9db4c9');
    g.addColorStop(0.52, '#e6d6bd'); // chân trời chiều
    g.addColorStop(0.62, '#8a8377');
    g.addColorStop(1, '#4b4740'); // đất
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);

    const equirect = new THREE.CanvasTexture(canvas);
    equirect.mapping = THREE.EquirectangularReflectionMapping;
    equirect.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(equirect);
    equirect.dispose();
    pmrem.dispose();
    return target.texture;
  } catch (err) {
    console.warn('[citymap] không dựng được môi trường phản chiếu cho map thật', err);
    return null;
  }
}

export async function buildRealWorld(opts: RealWorldOptions = {}): Promise<RealWorldHandle> {
  const software = detectSoftwareRenderer(opts.renderer);
  const root = new THREE.Group();
  root.name = 'saigon-real-world';

  /**
   * Ba hàm dựng của map thật chỉ gọi `scene.add(...)`. Đưa chúng một "scene" là nhóm này, để toàn bộ
   * map thật nằm gọn trong một nhóm (bật/tắt, dời, dispose một chỗ) mà không phải sửa engine của nó.
   */
  const sink = { add: (obj: THREE.Object3D) => root.add(obj) } as unknown as THREE.Scene;
  const noAssetCallback = () => {};

  opts.onStep?.('house', 0.05);
  await yieldFrame();
  const house: BoardingHouse = buildBoardingHouse(sink, noAssetCallback);

  /**
   * GIAO THÔNG — đúng bộ mô phỏng của map chuẩn (`traffic/TrafficManager.ts`): đèn QCVN 41:2024,
   * ACC/IDM+, sublane Sài Gòn, va chạm OBB, người qua đường, còi. Trước đây `realWorld.ts` truyền
   * `undefined` nên đường Lý Thái Tổ trong thành phố chỉ có xe **dựng im** — thiếu hẳn phần sống nhất
   * của map chuẩn. Truyền manager vào `buildStreet` và `buildSaigonDistricts` thì chính 9 xe của phố
   * và đoàn xe trên Đại lộ 3/2 / Hải Triều / Đại lộ Đông vào chung một hàng đợi và chạy theo luật.
   */
  const traffic = new SaigonTrafficManager();

  opts.onStep?.('street', 0.15);
  await yieldFrame();
  const street: StreetWorld = buildStreet(sink, software, undefined, noAssetCallback, traffic);

  opts.onStep?.('districts', 0.4);
  await yieldFrame();
  const streamer = new WorldStreamer();
  // `horizon: false` — vòng chân trời giả của map thật (11 cụm tháp đen + tấm nền 880 m) chỉ dùng khi
  // nó đứng một mình ở `/testbus`. Trong thành phố, chân trời thật đã có; để nguyên thì mười một khối
  // đen mọc giữa phố (đã thấy trong ảnh kiểm tra đầu tiên).
  const districts: SaigonDistricts = buildSaigonDistricts(sink, streamer, software, noAssetCallback, traffic, undefined, {
    horizon: false,
  });

  // Môi trường ban ngày cho map thật.
  //
  // `buildSaigonDistricts` dựng vật liệu ở chế độ **đêm** (`uNight: 0.9`) và chờ engine gọi
  // `setEnvironment` mỗi khung để đưa về đúng giờ trong ngày. Trong thành phố không ai gọi, nên lần
  // kiểm tra đầu tiên toàn bộ tháp kính ra màu đen (uNight = 0.9 = ban đêm, trời tối). Đây là chỗ gọi
  // đó: 17 giờ chiều, khô, gió nhẹ — cùng mặt trời với thành phố.
  const sunDir = new THREE.Vector3(-520, 1150, 640).normalize();
  districts.setEnvironment(0, 0.12, 0.35, 0, sunDir, new THREE.Color('#c8a68c'), 0.0006);
  house.setEnvironment(0, 0.12, 0.35);
  street.wet(false, 0.12);

  // Nhà trọ 462/14 là chỗ nhân vật chính ở: đăng ký với streamer y như engine làm, nhưng luôn hiện —
  // trong thành phố camera có thể ở cách xa hàng trăm mét mà dãy trọ vẫn là thứ để nhận ra Sài Gòn.
  streamer.register({
    id: 'boarding-house',
    name: 'Dãy Trọ 462/14 Lý Thái Tổ',
    district: 'Quận 10',
    cx: 22,
    cz: -13,
    near: house.root,
    nearDist: 140,
    lodDist: 320,
    alwaysVisible: true,
  });

  // Bản LOD của map thật là khối tối giản: đứng trong thành phố nhìn từ 200 m, chúng thành tháp đen.
  // Bật hết chi tiết (268 000 tam giác) — xem `WorldStreamer.forceNear`.
  streamer.forceNear();

  // GIAO THÔNG LAN RA PHỐ THỦ TỤC: góp tuyến của thành phố vào **chính** đồ thị của bộ mô phỏng
  // map chuẩn, rồi đặt xe của map chuẩn lên đó. Không có bộ mô phỏng thứ hai nào ở đây.
  let extension: CityTrafficExtension = { corridors: 0, edgeIds: [] };
  if (opts.city) {
    try {
      extension = extendTrafficGraph(traffic.graph, opts.city, { near: { x: 0, z: -60 }, maxCorridors: 10, radiusM: 520 });
      console.info("[citymap] nối", extension.corridors, "tuyến phố thành phố vào đồ thị giao thông");
    } catch (err) {
      console.warn('[citymap] không nối được đường thành phố vào đồ thị giao thông', err);
    }
  }

  opts.onStep?.('districts', 1);

  const player = { x: 0, y: 0, z: 0 };
  let time = 0;
  let frames = 0;
  let disposed = false;

  // Đặt sau khi dựng xong: `mergeStaticMeshesByMaterial` / `freezeStaticMatrices` của map thật nướng
  // ma trận vào hình học, nên nhóm phải đứng ở gốc toạ độ lúc dựng rồi mới dời (bài học từ khu phố).
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);

  // Kính và kim loại của map thật chỉ đúng màu khi có môi trường phản chiếu (xem `buildEnvironment`).
  const env = opts.renderer ? buildEnvironment(opts.renderer) : null;
  if (env) {
    let patched = 0;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mats = mesh.isMesh ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std || !(std as unknown as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) continue;
        if (std.envMap) continue;
        std.envMap = env;
        std.needsUpdate = true;
        patched += 1;
      }
    });
    // MẶT ĐƯỜNG ƯỚT NHƯ TRONG MAP CHUẨN: `simulation/street.ts` chỉnh chính vật liệu này theo
    // thời tiết (`asphalt.roughness = 0.89 - wetness*0.57; metalness = 0.02 + wetness*0.36`). Khi
    // map thật được cấy vào /saigon, không có `AtmosphereSystem` bơm wetness, nên vật liệu giữ độ
    // nhám 0,94 khô và mất hẳn vệt phản chiếu — đây chính là khác biệt "mặt đường bết" trong ảnh so
    // sánh. Đặt mức ướt nhẹ (0,45) đúng bằng trạng thái "sau cơn mưa" của bản gốc.
    let wet = 0;
    const WETNESS = 0.45;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        const tex = std?.map as (THREE.Texture & { userData?: { src?: string } }) | undefined;
        const src = tex?.userData?.src ?? tex?.image?.currentSrc ?? "";
        if (typeof src === "string" && src.includes("survey/map")) {
          std.roughness = 0.89 - WETNESS * 0.57;
          std.metalness = 0.02 + WETNESS * 0.36;
          std.envMapIntensity = 1.25;
          std.needsUpdate = true;
          wet += 1;
        }
      }
    });
    (window as unknown as { __cityRealWet?: number }).__cityRealWet = wet;
    (window as unknown as { __cityRealEnv?: number }).__cityRealEnv = patched;
  }

  // Móc kiểm tra: đọc được danh sách xe (vị trí, tốc độ) từ ngoài, không phải đoán qua ảnh.
  (window as unknown as { __cityTraffic?: unknown }).__cityTraffic = traffic;

  let cityVehicles = 0;
  const cityTrafficOn = new URLSearchParams(window.location.search).get('citytraffic') !== '0';
  if (extension.edgeIds.length && cityTrafficOn) {
    // 10 xe, không phải 16: đo trong sandbox thấy 16 model xe chi tiết làm khung hình chậm tới mức
    // không chụp nổi ảnh, trong khi bộ mô phỏng chỉ tốn 0,1 ms/khung cho 16 xe — nút cổ chai là **vẽ**,
    // không phải luật giao thông. Xe ở xa còn bị ẩn hẳn (xem vòng update).
    void spawnCityVehicles(traffic, extension, root, { perEdge: 1, maxVehicles: 10 })
      .then((res) => {
        cityVehicles = res.spawned;
        (window as unknown as { __cityTrafficSpawn?: unknown }).__cityTrafficSpawn = {
          corridors: extension.corridors,
          edges: extension.edgeIds.length,
          spawned: res.spawned,
        };
      })
      .catch((err) => console.warn('[citymap] không đặt được xe thành phố', err));
  }

  return {
    root,
    stats: {
      chunks: streamer.update(0, 0, 0, software).totalChunks,
      cityCorridors: extension.corridors,
      get cityVehicles() {
        return cityVehicles;
      },
    },
    update(dt: number, t: number, camera: THREE.Camera) {
      if (disposed) return;
      time = t;
      player.x = camera.position.x;
      player.y = camera.position.y;
      player.z = camera.position.z;
      // Chunk/LOD của map thật theo camera thành phố — đúng cơ chế của game, không phải "hiện hết".
      streamer.update(player.x, player.y, player.z, software);
      // Camera thành phố đóng vai "người chơi" của bộ mô phỏng: LOD 3 tầng, vùng cách âm, còi, và
      // người qua đường đều tính quanh nó.
      traffic.step({
        dt,
        playerX: player.x,
        playerY: player.y,
        playerZ: player.z,
        playerYaw: 0,
        wetness: 0.12,
      });
      districts.update(dt, time, player.x, player.z);
      // `skipBlockCull = true`: camera thành phố bay ở 45 m, cắt ô theo "người chơi" 1,7 m sẽ làm cả
      // con phố biến mất khi nhìn từ trên cao.
      street.update(dt, player, time, true);
      house.update(time);
      // Cắt theo khoảng cách: model xe chi tiết chỉ hiện trong 260 m quanh camera. Bộ mô phỏng vẫn
      // chạy đủ luật cho mọi xe (0,1 ms/khung); đây thuần là cắt chi phí **vẽ**.
      if (frames % 10 === 0) {
        for (const v of traffic.vehicles) {
          const rigRoot = v.rig?.root;
          if (!rigRoot) continue;
          const far = Math.hypot(v.x - player.x, v.z - player.z) > 260;
          if (rigRoot.visible === far) rigRoot.visible = !far;
        }
      }
      // Số liệu giao thông cho kiểm toán: bao nhiêu xe đang chạy (không phải xe dựng im).
      if (frames % 20 === 0) {
        let moving = 0;
        for (const v of traffic.vehicles) if (Math.abs(v.speed ?? 0) > 0.4) moving += 1;
        (window as unknown as { __cityRealTraffic?: unknown }).__cityRealTraffic = {
          vehicles: traffic.vehicles.length,
          moving,
          simTime: Number(time.toFixed(1)),
        };
      }
      frames += 1;
    },
    dispose() {
      disposed = true;
      try { districts.dispose(); } catch { /* map thật tự dọn phần của nó */ }
      try { street.dispose(); } catch { /* như trên */ }
      try { house.dispose(); } catch { /* như trên */ }
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry?.dispose();
      });
      root.removeFromParent();
      root.clear();
    },
  };
}
