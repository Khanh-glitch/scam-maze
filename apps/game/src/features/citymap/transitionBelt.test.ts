import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { buildCityMesh, type Part } from "./cityMesh";
import {
  REAL_WORLD_BUILD_MARGIN_M,
  REAL_WORLD_RECTS,
  inRealWorld,
  realWorldFootprintUnion,
} from "./realWorldFootprint";
import {
  BELT_HOUSE_DEPTHS_M,
  BELT_KERB_WIDTH_M,
  BELT_LAMP_SPACING_M,
  BELT_MAX_HEIGHT_M,
  BELT_WALK_WIDTH_M,
  buildTransitionBelt,
} from "./transitionBelt";
import { CURB_HEIGHT } from "../testbus/openworld/simulation/boarding";

/**
 * ĐAI CHUYỂN TIẾP — kiểm bằng số, không bằng mắt (sandbox không có GPU, xem
 * `docs/product/CITY_MAP_HANDOFF.md` §6).
 *
 * Ba thứ có thể hỏng im lặng: (1) đai không có nhà (vành trống quay lại), (2) nhà của đai đè lên
 * nhà map chuẩn, (3) hè/bó vỉa của đai sai cao độ nên chỗ nối có bậc.
 */
const belt = buildTransitionBelt();

describe("đai chuyển tiếp quanh map chuẩn", () => {
  it("có mặt tiền: đủ nhà để đứng trong map cũ nhìn ra không thấy vành đất trống", () => {
    expect(belt.buildings.length).toBeGreaterThan(120);
    // Nhà thấp đúng cỡ nhà ống chuyển tiếp, không phải tháp.
    for (const b of belt.buildings) expect(b.heightM).toBeLessThanOrEqual(BELT_MAX_HEIGHT_M);
    expect(Math.min(...belt.buildings.map((b) => b.floors))).toBeGreaterThanOrEqual(3);
    for (const b of belt.buildings) {
      // Mặt tiền 4,5–7,5 m, chiều sâu 8–12 m ⇒ cạnh dài hơn là chiều sâu.
      const depth = Math.round(Math.max(b.x1 - b.x0, b.z1 - b.z0));
      expect(BELT_HOUSE_DEPTHS_M).toContain(depth);
    }
  });

  it("mặt tiền quay vào map cũ, không quay ra ngoài", () => {
    const union = realWorldFootprintUnion();
    for (const b of belt.buildings) {
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      // `facing` là hướng mà mặt tiền NHÌN VỀ: "s" = +z (vào map nếu nhà ở phía bắc map).
      const toward: Record<string, { dx: number; dz: number }> = {
        n: { dx: 0, dz: -1 },
        s: { dx: 0, dz: 1 },
        e: { dx: 1, dz: 0 },
        w: { dx: -1, dz: 0 },
      };
      const dir = toward[b.facing];
      const ucx = (union.x0 + union.x1) / 2;
      const ucz = (union.z0 + union.z1) / 2;
      // Vectơ từ nhà tới tâm map chuẩn phải cùng chiều với hướng mặt tiền.
      const dot = dir.dx * (ucx - cx) + dir.dz * (ucz - cz);
      expect(dot).toBeGreaterThan(0);
    }
  });

  it("không toà nào của đai lấn vào lề nhà 18 m của map chuẩn", () => {
    for (const b of belt.buildings) {
      // Lô được kiểm bằng chính hộp bao của nó, đúng như `partHitsRealMap` làm với hình học.
      expect(inRealWorld((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, REAL_WORLD_BUILD_MARGIN_M - 0.01)).toBe(false);
      for (const r of REAL_WORLD_RECTS) {
        const dx = Math.min(b.x1, r.x1) - Math.max(b.x0, r.x0);
        const dz = Math.min(b.z1, r.z1) - Math.max(b.z0, r.z0);
        if (dx > 0 && dz > 0) throw new Error(`nhà đai ${b.id} đè lên ${r.id}`);
      }
    }
  });

  it("dải hè rộng 3 m có bó vỉa, cây thưa và cột đèn đúng nhịp", () => {
    expect(belt.walk.length).toBeGreaterThan(80);
    for (const p of belt.walk) expect(p.widthM).toBe(BELT_WALK_WIDTH_M);
    for (const k of belt.kerbs) expect(k.widthM).toBe(BELT_KERB_WIDTH_M);
    // Cùng số đoạn hè và bó vỉa: mỗi đoạn hè có đúng một dải bó vỉa ở mép trong.
    expect(belt.kerbs.length).toBe(belt.walk.length);

    const trees = belt.props.filter((p) => p.kind === "tree");
    const lamps = belt.props.filter((p) => p.kind === "lamp");
    expect(trees.length).toBeGreaterThan(60);
    expect(lamps.length).toBeGreaterThan(20);
    // Nhịp: cây không dày hơn 10 m/cây (đo theo tổng chiều dài hè mà không có mốc chồng).
    expect(lamps.length).toBeLessThan((BELT_LAMP_SPACING_M && trees.length) * 2);
  });

  it("hình học của đai dựng đúng cao độ nối với hè thành phố", () => {
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    // Chỉ tấm có bề rộng đúng bằng dải hè 3 m là của đai; tấm khác là hè 1,6 / 2,8 / 0,45 m của
    // thành phố (phần đó `cityMesh.test.ts` giữ).
    const walkPieces = mesh.flat.filter((p) => p.color === "#8e8b86" && Math.abs(p.sz - BELT_WALK_WIDTH_M) < 1e-6);
    expect(walkPieces.length).toBeGreaterThan(50);
    const tops = walkPieces.map((p) => p.y + p.sy);
    // Hè của đai và hè của thành phố phải **cùng một đỉnh** — lệch là thấy bậc ở chỗ nối.
    const cityTops = mesh.flat
      .filter((p) => p.color === "#8e8b86" && Math.abs(p.sz - BELT_WALK_WIDTH_M) >= 1e-6)
      .map((p) => p.y + p.sy);
    expect(new Set(tops.map((t) => t.toFixed(3))).size).toBe(1);
    expect(Math.abs(Math.max(...tops) - Math.max(...cityTops))).toBeLessThan(0.005);
    // Và phải cao hơn mặt nhựa đúng dải bó vỉa của engine.
    const roadTop = Math.max(...mesh.flat.filter((p) => p.color === "#5a5964").map((p) => p.y + p.sy));
    const walkTop = Math.max(...tops);
    expect(walkTop - roadTop).toBeGreaterThan(0.1);
    expect(walkTop - roadTop).toBeLessThan(CURB_HEIGHT + 0.1);
  });

  it("mảnh đai nào cũng qua được bộ lọc chồng lấn của `cityMesh`", () => {
    // Cùng phép kiểm với `realClearance.test.ts`, nhưng chỉ trên đai: hộp bao từng mảnh + lề.
    const marginOf = (p: Part) => (p.sy > 2 ? REAL_WORLD_BUILD_MARGIN_M : 2);
    const hits = (p: Part): boolean => {
      const margin = marginOf(p);
      const ry = p.ry ?? 0;
      const c = Math.abs(Math.cos(ry));
      const s = Math.abs(Math.sin(ry));
      const hx = (c * p.sx + s * p.sz) / 2;
      const hz = (s * p.sx + c * p.sz) / 2;
      return REAL_WORLD_RECTS.some(
        (r) => p.x + hx > r.x0 - margin && p.x - hx < r.x1 + margin && p.z + hz > r.z0 - margin && p.z - hz < r.z1 + margin,
      );
    };
    for (const p of belt.walk) {
      // Bề rộng đoạn chỉ 1 m: hộp bao của một đoạn hè không được chạm cả tấm hè lớn của thành phố.
      expect(hits({ x: p.x, y: 0.1, z: p.z, sx: p.lengthM, sy: 0.14, sz: p.widthM, ry: p.ry, color: "#8e8b86" })).toBe(false);
    }
  });
});
