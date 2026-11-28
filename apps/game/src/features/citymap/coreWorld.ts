/**
 * KHU PHỐ GỐC — dựng **chính** thế giới đang chơi được của game (`features/khupho`) vào trong thành
 * phố sinh tự động.
 *
 * Ở đây không vẽ lại gì cả: cùng `buildNeighborhood` (nhà ống, mặt đường, vỉa hè, hẻm, sân chung,
 * dây điện, xe dựng, cây), cùng `buildLife` (người đi đường, chủ quán, xe máy chạy theo luật giao
 * thông), cùng `loadStreetProps` / `loadStreetFurniture` (đồ thật đã đặt tay trong map gốc) — chỉ
 * khác là chúng được gắn vào scene của thành phố, dời tới đúng vị trí, và tắt hai thứ chỉ dành cho
 * màn đứng riêng: tấm nền 440 m và dãy nhà xa giả (thành phố thật đã ở đó).
 */
import * as THREE from 'three';
import { Physics } from '../khupho/world/physics';
import { Interactions } from '../khupho/world/interact';
import { buildNeighborhood } from '../khupho/world/neighborhood';
import { buildLife, PERSON_GROUPS, type Life } from '../khupho/world/people';
import { loadStreetProps } from '../khupho/world/streetProps';
import { loadStreetFurniture, placeStreetFurniture } from '../khupho/world/streetFurniture';
import { loadBaoThu, loadBikeRider } from '../khupho/world/bikeRider';
import { HumanLibrary } from '../khupho/world/humans';
import { mulberry32 } from '../khupho/world/util';
import { setNightEmit, setWet, windUniform } from '../khupho/world/materials';
import { mergeDevices, mergeHouseShells, mergeRigidParts } from '../khupho/world/staticMerge';
import { buildShadowProxies } from '../khupho/world/shadowProxy';
import type { Ctx } from '../khupho/world/types';
import type { AudioSys } from '../khupho/world/audio';
import type { House } from '../khupho/world/house';
import { GROUND_BASE_HEX } from './cityGround';

/** Thứ âm thanh: thành phố chưa có mixer của khu phố, câm nhưng vẫn đủ hàm để logic chạy. */
const silentAudio = {
  horn() {},
  rev() {},
  step() {},
  play() {},
  loop() {},
} as unknown as AudioSys;

export interface CoreWorld {
  /** Nhóm chứa toàn bộ khu phố; `position` là vị trí đặt trong thành phố. */
  root: THREE.Group;
  houses: House[];
  phys: Physics;
  /** Người đi đường, xe máy, chủ quán — cùng vòng cập nhật của bản gốc. */
  life: Life | null;
  /** Số vật thể tải được từ GLB (đồ vỉa hè, xe, người mẫu). */
  loaded: { props: number; furniture: number; bikes: boolean; humans: boolean };
  update(dt: number, t: number): void;
  dispose(): void;
}

export interface CoreWorldOptions {
  /** Gọi sau mỗi bước nặng để thanh tải của trang kịp vẽ. */
  onStep?: (step: 'world' | 'life' | 'props', fraction: number) => void;
  /**
   * Gọi ngay khi phần **nhà + đường + vỉa hè** đã dựng xong, trước khi có người và đồ GLB: chủ
   * trang gắn `root` vào scene lúc này để phố hiện ra sớm, phần còn lại chảy vào sau.
   */
  onWorldReady?: (root: THREE.Group) => void;
  /**
   * Người mẫu GLB của khu phố (thư viện nhân vật ~50 MB). Mặc định tắt: trong thành phố, người đi
   * đường dựng bằng hình thủ tục của chính khu phố — vẫn là người thật của map gốc, chỉ không phải
   * model quét. Bật bằng `?humans=1` khi cần đúng model.
   */
  humans?: boolean;
  /** Xe "báo thủ" chạy ẩu. Mặc định tắt cho nhẹ; `?baothu=1` để bật. */
  baothu?: boolean;
  /**
   * Chỉ dựng nhà + đường + vỉa hè, bỏ người/xe/đồ GLB (`?nolife=1`). Dùng khi máy yếu hoặc khi chỉ
   * cần xem bố cục.
   */
  nolife?: boolean;
}

const yieldFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/**
 * Dựng khu phố gốc tại (x, z) của thành phố. Gốc toạ độ của khu phố là **tim đường**, đúng như
 * trong `features/khupho`: phố chạy theo trục x từ −70 tới 70.
 */
export async function buildCoreWorld(x: number, z: number, opts: CoreWorldOptions = {}): Promise<CoreWorld> {
  const root = new THREE.Group();
  root.name = 'core-neighborhood';
  // Dựng ở gốc toạ độ rồi mới dời đi: `buildShadowProxies` nướng ma trận thế giới vào hình học,
  // nên nếu dời trước thì mọi proxy bị cộng đôi vị trí (lần đầu đã thấy: hộp xám lệch 260 m).


  const ctx: Ctx = {
    root,
    phys: new Physics(),
    inter: new Interactions(),
    roomLights: [],
    dyn: [],
    env: { hour: 17.2, night: 0, rain: 0, sun: 1 },
    sfx: { play() {}, loop() {} },
    eye: new THREE.Vector3(x, 1.65, z),
    houses: [],
    player: { sit() {} },
    rand: mulberry32(2024),
    lamps: [],
    walkers: [],
  };

  // Đồ đã đặt tay trong map gốc phải biết trước khi dựng: chúng thay chỗ đồ thủ tục.
  const furnitureReady = loadStreetFurniture().catch((err) => {
    console.warn('[citymap] street furniture failed to load', err);
  });
  const bikeRider = loadBikeRider().catch(() => null);
  const baothu = opts.baothu ? loadBaoThu().catch(() => null) : Promise.resolve(null);
  const humans = opts.humans
    ? HumanLibrary.load().catch((err) => {
        console.warn('[citymap] characters failed to load', err);
        return null;
      })
    : Promise.resolve(null);

  await furnitureReady;
  opts.onStep?.('world', 0.1);
  await yieldFrame();

  // Nền của khu phố: chỉ hai dải hai bên vỉa hè (mặt đường và vỉa hè đã có hình riêng), cao 2 cm
  // trên nền thành phố để không bị nền xám của thành phố nuốt mất.
  const houses = buildNeighborhood(ctx, {
    ground: [
      // Cùng một hằng tông đất với nền 9 km của thành phố (`cityGround.ts`): hai tấm nền lệch màu
      // là một vệt sáng hình chữ nhật giữa thành phố.
      { x0: -74, x1: 74, z0: -30, z1: -6, color: GROUND_BASE_HEX },
      { x0: -74, x1: 74, z0: 6, z1: 58, color: GROUND_BASE_HEX },
    ],
    skyline: false,
  });
  ctx.houses = houses;
  opts.onWorldReady?.(root);
  opts.onStep?.('world', 1);

  // Gộp hình khối tĩnh như màn gốc: cùng số hình, ít lệnh vẽ hơn nhiều.
  for (const g of PERSON_GROUPS) mergeRigidParts(g);
  buildShadowProxies(root);
  mergeHouseShells(houses, root);
  mergeDevices(houses);

  opts.onStep?.('life', 0.2);
  await yieldFrame();
  const vehicles: { pos: THREE.Vector3; speed: number }[] = [];
  const life = opts.nolife
    ? null
    : buildLife(ctx, houses, vehicles, silentAudio, await bikeRider, await humans, await baothu);
  if (life) ctx.walkers.push(life);
  opts.onStep?.('life', 1);

  placeStreetFurniture(root);
  opts.onStep?.('props', 0.2);
  await yieldFrame();
  let placedProps = 0;
  if (!opts.nolife) {
    try {
      placedProps = (await loadStreetProps(ctx)).length;
    } catch (err) {
      console.warn('[citymap] street props failed to load', err);
    }
  }
  opts.onStep?.('props', 1);

  root.position.set(x, 0, z);
  root.updateMatrixWorld(true);
  setWet(0);
  setNightEmit(0.15);

  const tick = (dt: number, t: number) => {
    windUniform.value = t;
    life?.update(dt, t);
  };

  return {
    root,
    houses,
    phys: ctx.phys,
    life,
    loaded: {
      props: placedProps,
      furniture: root.children.length,
      bikes: Boolean(await Promise.resolve(bikeRider)),
      humans: Boolean(await Promise.resolve(humans)),
    },
    update: tick,
    dispose() {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry?.dispose();
      });
      root.removeFromParent();
      root.clear();
    },
  };
}
