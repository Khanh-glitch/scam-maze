/**
 * ĐAI CHUYỂN TIẾP QUANH MAP CHUẨN — dải đất 18 m ngoài ranh 9 vùng dựng tay.
 *
 * `openWorldBounds.json` là vùng **đi được** của map dựng tay; dãy nhà của phố Lý Thái Tổ, của hẻm
 * 462/14 và sân nhà trọ 59 mọc ra thêm 10–18 m nữa về phía ngoài. Thành phố thủ tục phải nhường
 * đúng khoảng đó (`REAL_WORLD_BUILD_MARGIN_M`), nên trước module này mép map chuẩn là một vành đất
 * trống: đứng trong hẻm nhìn ra thấy thành phố bắt đầu từ khoảng không.
 *
 * Module dựng đúng phần chuyển tiếp ấy, theo **dữ liệu** (không dựng hình ở đây — `cityMesh` làm
 * việc đó), để unit test kiểm được:
 *
 *  - hè rộng `3 m` + bó vỉa ở cao độ `CURB_HEIGHT`, chạy dọc mép vùng đi được;
 *  - dãy nhà thấp `3–5 tầng`, cao `≤ 12 m`, sâu `8–12 m`, **mặt tiền quay vào map cũ**;
 *  - cây thật (`tree`) thưa `8–10 m` một cây, cột đèn (`lamp`) `22 m` một cột, trên cùng dải hè;
 *  - không mảnh nào chồng lên 9 vùng của map chuẩn (lọc lại bằng `partHitsRealMap` bên `cityMesh`).
 *
 * Nguyên tắc đặt: lô nhà nằm **ngoài** lề 18 m của lề nhà (nên không bao giờ đè nhà map chuẩn), còn
 * hè/cây/cột đèn nằm **trong** dải 18 m nhưng ngoài lề 2 m của mặt đường map chuẩn — đúng chỗ dãy
 * nhà map chuẩn tự lùi vào. Cả hai đều được `partHitsRealMap` kiểm lại lần cuối.
 */
import type { CityBuilding, CityProp, CityRect } from "./cityGen";
import {
  REAL_WORLD_BUILD_MARGIN_M,
  REAL_WORLD_RECTS,
  realWorldFootprintUnion,
} from "./realWorldFootprint";

/** Bề rộng dải hè chuyển tiếp (m) — đủ cho người đi bộ và cột đèn, sát mép vùng đi được. */
export const BELT_WALK_WIDTH_M = 3;
/** Bó vỉa của dải hè: cùng chiều dày bó vỉa của thành phố (`cityMesh`: 0,16 m). */
export const BELT_KERB_WIDTH_M = 0.16;
/** Bước cây trên dải hè (m) — "rải thưa". */
export const BELT_TREE_SPACING_M = 9;
/** Bước cột đèn trên dải hè (m). */
export const BELT_LAMP_SPACING_M = 22;
/** Chiều sâu dãy nhà chuyển tiếp (m): 8–12 m, xen kẽ theo nhịp. */
export const BELT_HOUSE_DEPTHS_M = [8, 10, 12] as const;
/** Cao độ tối đa của nhà chuyển tiếp (m) — 3–5 tầng nhà ống Sài Gòn. */
export const BELT_MAX_HEIGHT_M = 12;
/** Bề rộng mặt tiền một căn (m). */
const HOUSE_FRONT_MIN = 4.5;
const HOUSE_FRONT_MAX = 7.5;

const hash01 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Một mảnh hè của đai: tấm phẳng ở cao độ hè, quay theo cạnh đang chạy. */
export interface BeltWalkPiece {
  x: number;
  z: number;
  /** Bề rộng theo trục ngang của dải (m) — luôn là `BELT_WALK_WIDTH_M`. */
  widthM: number;
  lengthM: number;
  /** Góc quay quanh trục đứng, cùng quy ước với `cityMesh` (ry = −θ). */
  ry: number;
}

export interface BeltData {
  /** Dãy nhà chuyển tiếp, đã có `facing` quay vào map cũ. */
  buildings: CityBuilding[];
  /** Cây + cột đèn trên dải hè. */
  props: CityProp[];
  /** Tấm hè (3 m) dọc mép vùng đi được. */
  walk: BeltWalkPiece[];
  /** Bó vỉa giữa mép vùng đi được và dải hè. */
  kerbs: BeltWalkPiece[];
  /** Hình chữ nhật đã dùng cho nhà — để `cityGen` không đặt lô khác lên. */
  occupied: CityRect[];
}

/**
 * Nới mép vùng đi được ra `BELT_WALK_WIDTH_M` để lấy dải hè — nhưng chỉ về phía **ngoài** khối
 * dựng tay, không đè lên đại lộ hay bến sông nằm trong vùng.
 */
function beltEdges(): Array<{ x0: number; x1: number; z0: number; z1: number; side: "n" | "s" | "e" | "w" }> {
  // Đai chạy dọc mép NGOÀI của dãy nhà map chuẩn (xem `realWorldOuterEdge`), không phải mép vùng
  // đi được: bó vỉa + hè đứng ngay sau nhà, đúng như vỉa hè của một con phố.
  const union = realWorldOuterEdge();
  const out: Array<{ x0: number; x1: number; z0: number; z1: number; side: "n" | "s" | "e" | "w" }> = [];
  const w = BELT_WALK_WIDTH_M;
  // Dải hè **không** chồng nhau ở bốn góc: mỗi cạnh chỉ lấy đúng phần rộng của nó, cạnh bắc/nam ăn
  // hết chiều rộng (kể cả hai đầu), cạnh tây/đông lùi vào trong hai đầu đó. Chồng ở góc là hai tấm
  // hè cùng cao độ z-fighting trong khung hình.
  const nz0 = union.z0 - w;
  const sz1 = union.z1 + w;
  out.push({ x0: union.x0, x1: union.x1, z0: nz0, z1: union.z0, side: "n" });
  out.push({ x0: union.x0, x1: union.x1, z0: union.z1, z1: sz1, side: "s" });
  out.push({ x0: union.x0 - w, x1: union.x0, z0: union.z0, z1: union.z1, side: "w" });
  out.push({ x0: union.x1, x1: union.x1 + w, z0: union.z0, z1: union.z1, side: "e" });
  return out;
}

/** Mảnh này có nằm trọn trong vùng đi được (hoặc sát nó) không — dùng để bỏ phần hè chạy vào đại lộ. */
const cutsRealWorld = (x: number, z: number, margin: number): boolean =>
  REAL_WORLD_RECTS.some(
    (r) => x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin,
  );

const FACING_OF_SIDE = { n: "s", s: "n", w: "e", e: "w" } as const;

/**
 * Mép **trong** thật của thế giới dựng tay: mép ngoài của 9 vùng cộng phần dãy nhà đã dựng thêm
 * (`REAL_WORLD_BUILD_MARGIN_M`).
 *
 * Vì sao phải cộng tay chứ không dùng thẳng `REAL_WORLD_RECTS`: `openWorldBounds.json` chỉ ghi vùng
 * **đi được**. Dãy nhà của phố Lý Thái Tổ và của hẻm 462/14 mọc thêm 10–18 m nữa ra ngoài; chính vì
 * thế thành phố mới phải lùi 18 m. Đai chuyển tiếp đứng **ngay sau** dãy nhà đó — không phải ngay
 * sau mép đường — nên mép trong của nó là `union + REAL_WORLD_BUILD_MARGIN_M`.
 */
export function realWorldOuterEdge(): { x0: number; x1: number; z0: number; z1: number } {
  const u = realWorldFootprintUnion();
  return {
    x0: u.x0 - REAL_WORLD_BUILD_MARGIN_M,
    x1: u.x1 + REAL_WORLD_BUILD_MARGIN_M,
    z0: u.z0 - REAL_WORLD_BUILD_MARGIN_M,
    z1: u.z1 + REAL_WORLD_BUILD_MARGIN_M,
  };
}

/**
 * Dựng dữ liệu đai chuyển tiếp.
 *
 * `seed` chỉ dùng để chọn nhịp nhà/cây — không đổi hình dạng map, không đổi `cityGen`.
 */
export function buildTransitionBelt(seed = "saigon-2026"): BeltData {
  let s = 0;
  for (let i = 0; i < seed.length; i += 1) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = (k: number) => hash01(s + k * 7.31);

  const buildings: CityBuilding[] = [];
  const props: CityProp[] = [];
  const walk: BeltWalkPiece[] = [];
  const kerbs: BeltWalkPiece[] = [];
  const occupied: CityRect[] = [];

  let seq = 0;
  for (const edge of beltEdges()) {
    const horizontal = edge.side === "n" || edge.side === "s";
    const alongFrom = horizontal ? edge.x0 : edge.z0;
    const alongTo = horizontal ? edge.x1 : edge.z1;
    const alongLen = alongTo - alongFrom;
    if (alongLen <= 0) continue;

    // 1. HÈ 3 m: chia thành đoạn ngắn để (a) ô nào chạm đại lộ thì mất đúng ô đó — không lỗ hổng
    //    lớn, và (b) lọc `partHitsRealMap` bên `cityMesh` chỉ ăn một đoạn chứ không ăn cả dải.
    const pieceLen = 1;
    const alongMid = horizontal ? (edge.z0 + edge.z1) / 2 : (edge.x0 + edge.x1) / 2;
    for (let t = alongFrom; t < alongTo; t += pieceLen) {
      const len = Math.min(pieceLen, alongTo - t);
      const mid = t + len / 2;
      const cx = horizontal ? mid : alongMid;
      const cz = horizontal ? alongMid : mid;
      // Mép trong của dải hè là mép ngoài dãy nhà map chuẩn; chỉ cần nó không rơi vào trong vùng
      // đi được (chỗ đó là lòng đường / đại lộ của map chuẩn).
      if (cutsRealWorld(cx, cz, REAL_WORLD_BUILD_MARGIN_M - 0.05)) continue;
      walk.push({
        x: cx,
        z: cz,
        widthM: BELT_WALK_WIDTH_M,
        lengthM: len,
        // Tấm hè dài theo trục chạy của cạnh; cùng quy ước `ry` của `cityMesh`.
        ry: horizontal ? 0 : -Math.PI / 2,
      });
      // Bó vỉa ở đúng mép trong của dải hè (mép giáp vùng đi được).
      const kerbOffset = BELT_WALK_WIDTH_M / 2 - BELT_KERB_WIDTH_M / 2;
      const sign = edge.side === "n" || edge.side === "w" ? 1 : -1;
      kerbs.push({
        x: horizontal ? cx : cx + sign * kerbOffset,
        z: horizontal ? cz + sign * kerbOffset : cz,
        widthM: BELT_KERB_WIDTH_M,
        lengthM: len,
        ry: horizontal ? 0 : -Math.PI / 2,
      });
    }

    // 2. DÃY NHÀ 3–5 TẦNG, mặt tiền QUAY VÀO map cũ.
    //    Lô bắt đầu ngay ngoài lề nhà 18 m (chỗ dãy nhà map chuẩn dừng) và sâu 8–12 m ra ngoài.
    let t = alongFrom + 1.5 + rand(seq) * 3;
    while (t < alongTo - HOUSE_FRONT_MAX) {
      const front = HOUSE_FRONT_MIN + rand(seq + 1) * (HOUSE_FRONT_MAX - HOUSE_FRONT_MIN);
      const depth = BELT_HOUSE_DEPTHS_M[Math.floor(rand(seq + 2) * BELT_HOUSE_DEPTHS_M.length) % BELT_HOUSE_DEPTHS_M.length];
      // "3–5 tầng" của nhà ống Sài Gòn là 3–4 tầng × 3,0 m; 5 tầng sẽ vượt trần `BELT_MAX_HEIGHT_M`
      // (12 m) nên bị `Math.min` kéo lại — vẫn giữ biên độ vì đó là mức trần kiến trúc của đai.
      const floors = rand(seq + 3) > 0.55 ? 4 : 3;
      const heightM = Math.min(BELT_MAX_HEIGHT_M, floors * 3.0);

      // Lô nhà đứng ngay sau dải hè: mép trong = mép ngoài của dãy nhà map chuẩn.
      const near = 0;
      let rect: CityRect;
      if (edge.side === "n") {
        // `edge.z0` là mép ngoài dải hè; dãy nhà nằm ngoài nó `depth` mét.
        rect = { x0: t, x1: t + front, z0: edge.z0 - near - depth, z1: edge.z0 - near };
      } else if (edge.side === "s") {
        rect = { x0: t, x1: t + front, z0: edge.z1 + near, z1: edge.z1 + near + depth };
      } else if (edge.side === "w") {
        rect = { x0: edge.x0 - near - depth, x1: edge.x0 - near, z0: t, z1: t + front };
      } else {
        rect = { x0: edge.x1 + near, x1: edge.x1 + near + depth, z0: t, z1: t + front };
      }

      // Mặt tiền quay vào map: dãy phía bắc (lô ở z nhỏ hơn) quay mặt về +z (`facing: "s"`), dãy
      // phía nam quay về −z (`"n"`), dãy phía tây quay về +x (`"e"`), dãy phía đông về −x (`"w"`).
      const facing = FACING_OF_SIDE[edge.side];
      const shop = rand(seq + 4) > 0.7;
      const b: CityBuilding = {
        ...rect,
        id: `belt-${seq}`,
        district: "belt",
        floors,
        heightM,
        kind: shop ? "shop" : "home",
        facing,
        on: "street",
        walkable: false,
      };
      buildings.push(b);
      occupied.push(rect);
      t += front + 0.6 + rand(seq + 6) * 2.2;
      seq += 1;
    }

    // 3. CÂY / CỘT ĐÈN dọc đai.
    //
    // Chúng đứng trên vỉa hè của dãy nhà map chuẩn — dải 18 m mà thành phố nhường — nên `cityMesh`
    // đặt chúng ở cao độ hè (0,17 m) chứ không phải mặt đất, và chúng không bao giờ rơi vào lòng
    // đường của map chuẩn. Nhịp: cây 8–10 m một cây (có nhiễu), cột đèn 22 m một cột.
    const sign = edge.side === "n" || edge.side === "w" ? -1 : 1;
    const inset = REAL_WORLD_BUILD_MARGIN_M - 1.2;
    const plantX = (p: number) => (horizontal ? p : edge.x0 + sign * inset);
    const plantZ = (p: number) => (horizontal ? edge.z0 + sign * inset : p);
    for (let p = alongFrom + 2; p < alongTo - 2; p += BELT_TREE_SPACING_M * (0.85 + rand(Math.round(p) + 11) * 0.35)) {
      if (rand(Math.round(p) + 13) > 0.78) continue; // thưa, không đều như hàng rào
      const cx = plantX(p);
      const cz = plantZ(p);
      if (cutsRealWorld(cx, cz, REAL_WORLD_BUILD_MARGIN_M - 1.5)) continue;
      props.push({ kind: "tree", x: cx, z: cz, rot: rand(Math.round(p)) * Math.PI * 2 });
    }
    for (let p = alongFrom + BELT_LAMP_SPACING_M / 2; p < alongTo - 2; p += BELT_LAMP_SPACING_M) {
      const cx = plantX(p);
      const cz = plantZ(p);
      if (cutsRealWorld(cx, cz, REAL_WORLD_BUILD_MARGIN_M - 1.5)) continue;
      props.push({ kind: "lamp", x: cx, z: cz, rot: 0 });
    }
  }

  return { buildings, props, walk, kerbs, occupied };
}
