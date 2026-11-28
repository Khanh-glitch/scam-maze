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

type StreetWorld = ReturnType<typeof buildStreet>;

export interface RealWorldOptions {
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

  opts.onStep?.('street', 0.15);
  await yieldFrame();
  const street: StreetWorld = buildStreet(sink, software, undefined, noAssetCallback);

  opts.onStep?.('districts', 0.4);
  await yieldFrame();
  const streamer = new WorldStreamer();
  // `horizon: false` — vòng chân trời giả của map thật (11 cụm tháp đen + tấm nền 880 m) chỉ dùng khi
  // nó đứng một mình ở `/testbus`. Trong thành phố, chân trời thật đã có; để nguyên thì mười một khối
  // đen mọc giữa phố (đã thấy trong ảnh kiểm tra đầu tiên).
  const districts: SaigonDistricts = buildSaigonDistricts(sink, streamer, software, noAssetCallback, undefined, undefined, {
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

  opts.onStep?.('districts', 1);

  const player = { x: 0, y: 0, z: 0 };
  let time = 0;
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
    (window as unknown as { __cityRealEnv?: number }).__cityRealEnv = patched;
  }

  return {
    root,
    stats: { chunks: streamer.update(0, 0, 0, software).totalChunks },
    update(dt: number, t: number, camera: THREE.Camera) {
      if (disposed) return;
      time = t;
      player.x = camera.position.x;
      player.y = camera.position.y;
      player.z = camera.position.z;
      // Chunk/LOD của map thật theo camera thành phố — đúng cơ chế của game, không phải "hiện hết".
      streamer.update(player.x, player.y, player.z, software);
      districts.update(dt, time, player.x, player.z);
      // `skipBlockCull = true`: camera thành phố bay ở 45 m, cắt ô theo "người chơi" 1,7 m sẽ làm cả
      // con phố biến mất khi nhìn từ trên cao.
      street.update(dt, player, time, true);
      house.update(time);
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
