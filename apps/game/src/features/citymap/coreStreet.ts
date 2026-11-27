// Đặt KHU PHỐ GỐC của game (bản đồ đang chơi được, `features/khupho`) vào giữa thành phố sinh tự động.
//
// Toàn bộ bố cục — căn nào, rộng bao nhiêu, mấy tầng, sơn màu gì, biển hiệu chữ gì — đọc từ
// `khupho/world/streetPlan.ts`, đúng dữ liệu mà engine khu phố đang dựng. Ở đây chỉ dựng hình khối
// theo đúng ngữ pháp của `cityMesh` (hộp + chi tiết + mái), nên khu phố gốc nằm chung một danh sách
// instance với thành phố xung quanh: cùng vật liệu, cùng ánh sáng, cùng bóng đổ.
import { coreLots, STREET, appearance, type PlacedLot } from "../khupho/world/streetPlan.ts";
import type { Part } from "./cityMesh.ts";

export interface CoreParts {
  boxes: Part[];
  flat: Part[];
  details: Part[];
  gables: Part[];
  drums: Part[];
}

const mix = (a: string, b: string, t: number): string => {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

const TILE = ["#9c6b4f", "#8a5b45", "#a5794f", "#7d5b4a"];
const AWNING = ["#b8452f", "#2f6b7a", "#3f7a55", "#a8443f", "#c2762f"];

/** Hướng mặt tiền của lô: điểm giữa mặt đứng + pháp tuyến hướng ra phố. */
const frontOf = (l: PlacedLot) => {
  const cxm = (l.x0 + l.x1) / 2;
  const czm = (l.z0 + l.z1) / 2;
  const len = l.side === "S" || l.side === "N" ? l.x1 - l.x0 : l.z1 - l.z0;
  if (l.side === "S") return { alongX: true, plane: l.z0, dir: -1, cxm, czm, len };
  if (l.side === "N") return { alongX: true, plane: l.z1, dir: 1, cxm, czm, len };
  if (l.side === "alleyW") return { alongX: false, plane: l.x1, dir: 1, cxm, czm, len };
  return { alongX: false, plane: l.x0, dir: -1, cxm, czm, len };
};

/**
 * @param ox, oz gốc toạ độ của khu phố trong thành phố (tim đường, chính giữa phố 140 m).
 */
export const buildCoreStreet = (ox: number, oz: number): CoreParts => {
  const boxes: Part[] = [];
  const flat: Part[] = [];
  const details: Part[] = [];
  const gables: Part[] = [];
  const drums: Part[] = [];

  // --- lòng đường, bó vỉa, hè, hẻm, sân chung ---------------------------------------------------
  const xa = ox + STREET.x0;
  const xb = ox + STREET.x1;
  const len = xb - xa;
  const halfRoad = STREET.roadHalf;
  const walkOuter = STREET.walkOuter;
  flat.push({
    x: (xa + xb) / 2, y: 0.02, z: oz, sx: len, sy: 0.07, sz: halfRoad * 2,
    color: "#5a5964",
  });
  // dải thoát nước hai bên (mép nhựa tối hơn) — đúng thứ nhìn thấy đầu tiên ở ảnh phố thật
  for (const sgn of [-1, 1]) {
    flat.push({ x: (xa + xb) / 2, y: 0.09, z: oz + sgn * (halfRoad - 0.05), sx: len, sy: 0.03, sz: 0.14, color: "#3a393f" });
  }
  // vỉa hè: phía nam bị hẻm cắt đôi
  const alley = STREET.alley;
  const walkPieces: Array<[number, number]> = [
    [STREET.x0, alley.x0],
    [alley.x1, STREET.x1],
  ];
  for (const sgn of [1, -1]) {
    const pieces = sgn > 0 ? walkPieces : [[STREET.x0, STREET.x1] as [number, number]];
    for (const [px0, px1] of pieces) {
      flat.push({
        x: ox + (px0 + px1) / 2, y: 0.05, z: oz + sgn * (halfRoad + (walkOuter - halfRoad) / 2),
        sx: px1 - px0, sy: 0.14, sz: walkOuter - halfRoad, color: "#8e8b86",
      });
    }
  }
  // vạch tim đường
  for (let x = STREET.x0 + 3; x < STREET.x1; x += STREET.laneDash.step) {
    flat.push({ x: ox + x, y: 0.1, z: oz, sx: STREET.laneDash.len, sy: 0.02, sz: 0.14, color: "#d8d3bd" });
  }
  // hẻm cụt + sân chung
  flat.push({
    x: ox + (alley.x0 + alley.x1) / 2, y: 0.02, z: oz + (alley.z0 + alley.z1) / 2,
    sx: alley.x1 - alley.x0, sy: 0.11, sz: alley.z1 - alley.z0, color: "#6f6b62",
  });
  flat.push({
    x: ox + (STREET.court.x0 + STREET.court.x1) / 2, y: 0.02, z: oz + (STREET.court.z0 + STREET.court.z1) / 2,
    sx: STREET.court.x1 - STREET.court.x0, sy: 0.1, sz: STREET.court.z1 - STREET.court.z0, color: "#7d786d",
  });

  // --- nhà ----------------------------------------------------------------------------------
  for (const lot of coreLots()) {
    const ap = appearance(lot.seq * 3 + 1, lot.style ?? "modern");
    const floors = lot.floors;
    const h = floors * 3.3 + 0.35;
    const w = lot.x1 - lot.x0;
    const d = lot.z1 - lot.z0;
    const cxm = ox + (lot.x0 + lot.x1) / 2;
    const czm = oz + (lot.z0 + lot.z1) / 2;
    boxes.push({ x: cxm, y: 0, z: czm, sx: w, sy: h, sz: d, color: ap.color });

    // mái: nhà cấp 4 / kiểu Pháp lợp ngói, còn lại mái bằng có gờ
    const tiled = (lot.style ?? "modern") !== "modern";
    if (tiled) {
      const along = d >= w;
      gables.push({
        x: cxm, y: h, z: czm,
        sx: along ? d : w, sy: Math.min(2.2, Math.min(w, d) * 0.22), sz: along ? w : d,
        ry: along ? Math.PI / 2 : 0,
        color: TILE[lot.seq % TILE.length],
      });
    } else {
      boxes.push({ x: cxm, y: h, z: czm, sx: Math.max(0.6, w - 0.3), sy: 0.1, sz: Math.max(0.6, d - 0.3), color: mix("#a39684", ap.color, 0.4) });
      for (const [ex, ez, sx2, sz2] of [
        [0, -d / 2 + 0.15, w, 0.3], [0, d / 2 - 0.15, w, 0.3],
        [-w / 2 + 0.15, 0, 0.3, d - 0.6], [w / 2 - 0.15, 0, 0.3, d - 0.6],
      ] as const) {
        boxes.push({ x: cxm + ex, y: h, z: czm + ez, sx: sx2, sy: 0.32, sz: sz2, color: mix(ap.trim, "#ffffff", 0.1) });
      }
    }
    // bồn nước inox trên mái
    if (lot.well) {
      drums.push({ x: cxm + w * 0.2, y: h + 0.2, z: czm + d * 0.2, sx: 0.55, sy: 1.1, sz: 0.55, color: "#c9cdd2" });
    }

    const f = frontOf(lot);
    const lenAlong = f.len;
    const at = (alongOffset: number, out: number): { x: number; z: number } =>
      f.alongX
        ? { x: cxm + alongOffset, z: oz + f.plane + f.dir * out }
        : { x: ox + f.plane + f.dir * out, z: czm + alongOffset };
    const face = (y: number, hh: number, deep: number, out: number, szAlong: number, color: string, along = 0) => {
      const p = at(along, out + deep / 2);
      details.push(f.alongX
        ? { x: p.x, y, z: p.z, sx: szAlong, sy: hh, sz: deep, color }
        : { x: p.x, y, z: p.z, sx: deep, sy: hh, sz: szAlong, color });
    };

    // tầng trệt: cửa cuốn / cửa kính, băng hiệu, mái hiên
    const shop = (lot.ground ?? "living") !== "living";
    face(0.1, Math.min(2.7, h * 0.55), 0.1, 0.02, lenAlong * 0.86, shop
      ? (lot.shutterColor ?? mix(ap.accent, "#e6e2d8", 0.25))
      : mix(ap.trim, "#5b564c", 0.35));
    if (lot.sign) {
      face(2.85, 1.0, 0.16, 0.04, lenAlong * 0.92, lot.signBg ?? ap.accent, 0);
      face(2.95, 0.34, 0.18, 0.05, lenAlong * 0.7, lot.signFg ?? "#ffffff", 0);
    }
    if (shop) {
      const aw = AWNING[lot.seq % AWNING.length];
      face(3.9, 0.09, 1.3, 0.55, lenAlong * 0.9, aw);
    }
    // lô có sân trước: tường rào + cổng
    if ((lot.yard ?? 0) > 0) {
      const yard = lot.yard ?? 0;
      const p = at(0, -yard + 0.1);
      details.push(f.alongX
        ? { x: p.x, y: 0, z: p.z, sx: lenAlong, sy: 1.15, sz: 0.16, color: mix(ap.trim, "#ffffff", 0.2) }
        : { x: p.x, y: 0, z: p.z, sx: 0.16, sy: 1.15, sz: lenAlong, color: mix(ap.trim, "#ffffff", 0.2) });
    }
    // lưới sắt ban công theo từng tầng (trong bản đồ gốc là `cage`)
    for (const floorIdx of lot.cage ?? []) {
      const y = Math.min(h - 0.6, floorIdx * 3.3 + 0.1);
      face(y, 0.12, 0.4, 0.0, lenAlong * 0.9, mix(ap.trim, "#ffffff", 0.15));
      face(y + 0.12, 1.0, 0.06, 0.34, lenAlong * 0.9, "#4c4f52");
    }
  }
  return { boxes, flat, details, gables, drums };
};
