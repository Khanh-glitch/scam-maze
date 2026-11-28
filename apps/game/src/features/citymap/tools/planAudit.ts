/**
 * CHẨN ĐOÁN MẶT BẰNG — đếm đúng những lỗi người dùng báo, bằng số, không bằng cảm nhận.
 *
 * Chạy trên dữ liệu `cityGen` (không cần mesh): nhà chồng nhau, nhà lấn lòng đường, tuyến xuyên
 * qua khối nhà. Đây là bộ đếm dùng lại được trong test hồi quy.
 */
import type { City } from "../cityGen";

export interface TopViewFindings {
  report: Record<string, unknown>;
  worst: Array<{ a: string; b: string; m2: number; at: string }>;
  intrudeWorst: Array<{ id: string; d: number; need: number; street: string }>;
  throughAt: string[];
}

export function diagnosePlan(city: City): TopViewFindings {
  const frame = city.frame;
  type R = { x0: number; x1: number; z0: number; z1: number };
  const overlap = (a: R, b: R) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
  const area = (r: R) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
  const isect = (a: R, b: R): R => ({
    x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1),
    z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1),
  });

  const solid = city.buildings.filter((b) => !b.walkable);
  let pairs = 0;
  let overlapArea = 0;
  const worst: Array<{ a: string; b: string; m2: number; at: string }> = [];
  for (let i = 0; i < solid.length; i += 1) {
    for (let j = i + 1; j < solid.length; j += 1) {
      const a = solid[i];
      const b = solid[j];
      if (!overlap(a, b)) continue;
      const m2 = area(isect(a, b));
      if (m2 < 0.5) continue;
      pairs += 1;
      overlapArea += m2;
      if (worst.length < 12) {
        const c = isect(a, b);
        worst.push({ a: a.id, b: b.id, m2: Math.round(m2), at: `${Math.round((c.x0 + c.x1) / 2)},${Math.round((c.z0 + c.z1) / 2)}` });
      }
    }
  }

  /** Nhà có tâm hoặc góc nằm TRONG lòng đường (không tính hẻm — hẻm nằm trong khối là đúng). */
  const inside = (p: { x: number; z: number }, r: R, m = 0) =>
    p.x > r.x0 - m && p.x < r.x1 + m && p.z > r.z0 - m && p.z < r.z1 + m;

  function distToSeg(pxp: number, pzp: number, ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax;
    const dz = bz - az;
    const L = dx * dx + dz * dz;
    const t = L < 1e-9 ? 0 : Math.max(0, Math.min(1, ((pxp - ax) * dx + (pzp - az) * dz) / L));
    return Math.hypot(pxp - (ax + dx * t), pzp - (az + dz * t));
  }

  /** Khoảng cách nhỏ nhất từ một hộp nhà tới tim tuyến. */
  function boxToStreetDist(b: City["buildings"][number], s: City["streets"][number]) {
    let best = Infinity;
    for (let i = 0; i < s.points.length - 1; i += 1) {
      const [ax, az] = s.points[i];
      const [bx, bz] = s.points[i + 1];
      // mẫu 4 điểm của hộp + tâm
      const pts = [
        [b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1],
        [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2],
      ];
      for (const [x, z] of pts) best = Math.min(best, distToSeg(x, z, ax, az, bx, bz));
    }
    return best;
  }

  let intrude = 0;
  let intrudeWorst: Array<{ id: string; d: number; need: number; street: string }> = [];
  for (const b of solid) {
    for (const s of city.streets) {
      if (s.klass === "alley") continue; // hẻm nằm trong khối là thiết kế
      const d = boxToStreetDist(b, s);
      const need = s.widthM / 2 + 0.5;
      if (d < need) {
        intrude += 1;
        if (intrudeWorst.length < 12) intrudeWorst.push({ id: b.id, d: +d.toFixed(2), need: +need.toFixed(2), street: s.id });
        break;
      }
    }
  }

  // Tuyến cắt qua khối nhà (đường xuyên công trình) — quét mẫu theo mét.
  let streetThroughBuilding = 0;
  const throughAt: string[] = [];
  for (const s of city.streets) {
    for (let i = 0; i < s.points.length - 1; i += 1) {
      const [ax, az] = s.points[i];
      const [bx, bz] = s.points[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(2, Math.ceil(len / 2));
      for (let k = 0; k <= n; k += 1) {
        const x = ax + ((bx - ax) * k) / n;
        const z = az + ((bz - az) * k) / n;
        const hit = solid.find((b) => inside({ x, z }, b));
        if (hit) {
          streetThroughBuilding += 1;
          if (throughAt.length < 12) throughAt.push(`${s.id}@${Math.round(x)},${Math.round(z)} → ${hit.id}`);
          break;
        }
      }
    }
  }

  const report: Record<string, unknown> = {
    "khung (m)": `${Math.round(frame.x1 - frame.x0)} × ${Math.round(frame.z1 - frame.z0)}`,
    "tuyến": city.streets.length,
    "nhà (đặc)": solid.length,
    "khối": city.blocks.length,
    "cặp nhà chồng nhau": pairs,
    "diện tích chồng (m²)": Math.round(overlapArea),
    "nhà lấn lòng đường": intrude,
    "mẫu tuyến nằm trong nhà": streetThroughBuilding,
  };

  return { report, worst, intrudeWorst, throughAt };
}
