/**
 * BẢN ĐỒ THẬT NẰM TRONG THÀNH PHỐ — vùng đất mà thành phố sinh tự động **không được** dựng nhà.
 *
 * `features/testbus/openworld` là Sài Gòn dựng tay của game: hẻm 462/14 Lý Thái Tổ (Quận 10), sân
 * nhà trọ 59 với phòng 6.07 của nhân vật chính, Đại lộ 3/2, Hải Triều, Đại lộ Đông, bến sông Bình
 * Thạnh, quảng trường Landmark 81, Bitexco và Landmark 81. Toàn bộ hình học đó giờ được dựng thẳng
 * vào scene của `/saigon` (xem `realWorld.ts`) tại đúng toạ độ gốc của nó.
 *
 * Vì vậy `cityGen` phải chừa đất: không lô nào, không toà tháp nào của thành phố được mọc trong 9
 * vùng dưới đây, và hai toà Bitexco / Landmark 81 do map thật dựng — thành phố không dựng bản sao
 * thứ hai (đã chốt với người dùng: "giữ toà của map thật").
 *
 * Số liệu **không** chép tay: đọc thẳng `openWorldBounds.json` — cùng file mà `isWithinOpenWorld`
 * của game dùng, nên vùng chừa đất không thể lệch khỏi vùng đi được thật.
 */
import raw from "../testbus/openworld/world/openWorldBounds.json";

export interface RealWorldRect {
  id: string;
  name: string;
  district: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

type RawBounds = { rects: RealWorldRect[] };
const bounds = raw as unknown as RawBounds;

/** 9 vùng đi được của map thật, theo toạ độ của chính nó = toạ độ thành phố. */
export const REAL_WORLD_RECTS: readonly RealWorldRect[] = bounds.rects;

/**
 * Chỗ đứng của hai toà tháp map thật dựng sẵn. Phải khớp `BITEXCO_POS` / `LANDMARK81_POS` trong
 * `testbus/openworld/world/saigonDistricts.ts` — `realWorld.test.ts` đọc file đó và so số, nên nếu
 * ai dời toà thì test đỏ chứ không âm thầm lệch.
 */
export const REAL_WORLD_TOWERS: Readonly<Record<string, { x: number; z: number }>> = {
  bitexco: { x: 94, z: -186 },
  landmark81: { x: 26, z: -356 },
};

/** Lề quanh vùng map thật: lô sinh tự động không được chạm mép đường của map thật. */
export const REAL_WORLD_MARGIN_M = 2;

/**
 * Lề dành cho **nhà** của thành phố quanh map chuẩn.
 *
 * `openWorldBounds.json` là vùng **đi được**, không phải vùng **đã dựng**: dãy nhà phố Lý Thái Tổ,
 * dãy trọ 462/14, nhà trong hẻm đều nằm ngoài hình chữ nhật đi được, sâu 10–18 m. Thành phố sinh
 * tự động mà chỉ chừa 2 m thì nhà của nó mọc xuyên qua nhà của map chuẩn — đúng hiện tượng "nhà
 * cửa ngỗn ngang chồng lấn". Mặt đường thì vẫn chỉ cần 2 m (đường nối vào đường).
 */
export const REAL_WORLD_BUILD_MARGIN_M = 18;

const hit = (r: RealWorldRect, x: number, z: number, margin: number) =>
  x >= r.x0 - margin && x <= r.x1 + margin && z >= r.z0 - margin && z <= r.z1 + margin;

/**
 * Hộp bao chung của 9 vùng đi được — ranh ngoài của map chuẩn.
 *
 * Dùng cho đai chuyển tiếp (`transitionBelt.ts`): đai chạy dọc **mép ngoài** của map, nên cần biết
 * mép đó ở đâu chứ không phải từng vùng một. Không dùng cho việc kiểm chồng lấn (việc đó phải so
 * từng hình chữ nhật, vì map chuẩn không phải một khối đặc).
 */
export function realWorldFootprintUnion(): { x0: number; x1: number; z0: number; z1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const r of REAL_WORLD_RECTS) {
    x0 = Math.min(x0, r.x0);
    x1 = Math.max(x1, r.x1);
    z0 = Math.min(z0, r.z0);
    z1 = Math.max(z1, r.z1);
  }
  return { x0, x1, z0, z1 };
}

/** Điểm (x, z) có nằm trong (hoặc sát) vùng của map thật không. */
export function inRealWorld(x: number, z: number, margin = 0): boolean {
  return REAL_WORLD_RECTS.some((r) => hit(r, x, z, margin));
}

/** Hình chữ nhật này có chạm vùng của map thật không. */
export function rectHitsRealWorld(
  rect: { x0: number; x1: number; z0: number; z1: number },
  margin = REAL_WORLD_MARGIN_M,
): boolean {
  return REAL_WORLD_RECTS.some(
    (r) =>
      Math.min(rect.x1, r.x1 + margin) > Math.max(rect.x0, r.x0 - margin) &&
      Math.min(rect.z1, r.z1 + margin) > Math.max(rect.z0, r.z0 - margin),
  );
}

/** Toà tháp này do map thật dựng (thành phố không được dựng lại). */
export function isRealWorldTower(anchorId: string): boolean {
  return Object.prototype.hasOwnProperty.call(REAL_WORLD_TOWERS, anchorId);
}
