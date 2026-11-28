import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateCity } from "../cityGen";
import { extendTrafficGraph } from "../cityTraffic";
import { SaigonTrafficManager } from "../../testbus/openworld/traffic";
import { signalizeCityIntersections } from "../citySignals";
import * as THREE from "three";
import { renderCityTopView } from "./topView";
import { buildCityMesh } from "../cityMesh";

/**
 * VẼ VỆT XE CHẠY THẬT.
 *
 * Đây là thứ trả lời "xe đi lùi / xe đi ngược / dừng đèn sai chỗ" bằng bằng chứng chứ không bằng cảm
 * nhận: chạy đúng `SaigonTrafficManager` của engine (cùng đèn QCVN, cùng IDM/ACC, cùng làn) trên đồ
 * thị thành phố, ghi lại quỹ đạo từng xe qua thời gian, rồi vẽ lên mặt bằng:
 *
 *   xanh lục = đi tới (chiều dương của cạnh) · đỏ = ĐI LÙI (chiều âm) · vàng = đứng yên > 6 s.
 *
 * Mỗi xe vẽ từ vị trí tới vị trí, nên nếu nó quay đầu giữa cạnh thì vệt đỏ hiện ngay.
 */
describe("vệt xe chạy", () => {
  it("xuất ảnh quỹ đạo + số đo lùi/ngược", async () => {
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    const traffic = new SaigonTrafficManager();
    const ext = extendTrafficGraph(traffic.graph, city, { near: { x: 0, z: -60 }, radiusM: 900, maxCorridors: 24 });

    // Bật đèn **như game thật** (`SaigonEnginePage` gọi y hệt): không có pha thì mọi hướng đều
    // "xanh 99" và hình vẽ sẽ không phản ánh cái người chơi thấy. `maxIntersections: 0` để test
    // không phải dựng cột GLB (jsdom không có canvas 2D cho bảng đếm giây).
    signalizeCityIntersections(traffic.graph, traffic, {
      parent: new THREE.Group(),
      junctions: ext.junctions,
      maxIntersections: 0,
    });

    // Rải 36 xe trên **toàn** lưới, không dồn vào các cạnh đầu danh sách: bản trước chỉ tô nửa trái
    // bản đồ và trông như nửa thành phố không có xe.
    const total = ext.edgeIds.length;
    const stride = Math.max(1, Math.floor(total / 36));
    const picked: string[] = [];
    for (let i = 0; i < total && picked.length < 36; i += stride) picked.push(ext.edgeIds[i]);
    // Nếu lưới ít hơn 36 cạnh thì lấp thêm.
    for (let i = 0; picked.length < 36 && i < total; i += 1) picked.push(ext.edgeIds[i]);

    // Đặt 36 xe bằng tay: `spawnCityVehicles` cần GLTF (jsdom không nạp được GLB nhị phân).
    picked.slice(0, 36).forEach((edgeId, n) => {
      const edge = traffic.graph.edges.get(edgeId)!;
      traffic.spawnVehicle({
        id: `P_${n}`,
        category: n % 3 === 0 ? "moto" : "car",
        edgeId,
        s: Math.min(edge.length * 0.5, 20 + (n % 2) * 40),
        halfWidth: 0.92,
        halfLength: 2.2,
      });
    });

    const step = { dt: 1 / 60, playerX: 0, playerY: 1.7, playerZ: -60, playerYaw: 0, wetness: 0.1 };
    for (let i = 0; i < 60; i += 1) {
      traffic.step(step);
      traffic.signals.update(i / 60);
    } // hâm nóng

    type Pt = { x: number; z: number };
    const trails = new Map<string, Pt[]>();
    const still = new Map<string, number>();
    let reversals = 0;
    for (let i = 0; i < 60 * 40; i += 1) {
      traffic.step(step);
      traffic.signals.update(1 + i / 60);
      if (i % 12 !== 0) continue; // 5 mẫu/giây
      for (const v of traffic.vehicles) {
        const arr = trails.get(v.id) ?? [];
        const last = arr[arr.length - 1];
        // Đổi chiều = đi ngược vector hướng của cạnh (dấu của `s` giảm liên tục).
        if (last) {
          const dx = v.x - last.x;
          const dz = v.z - last.z;
          const speed = Math.hypot(dx, dz) / (12 / 60);
          if (speed < 0.2) still.set(v.id, (still.get(v.id) ?? 0) + 1);
          else still.set(v.id, 0);
          // ĐI LÙI = mặt xe và hướng dịch chuyển ngược nhau quá 120° **trong lúc đang chạy**.
          // Không đếm cung quay đầu: `addCityLink(..., "uturn")` ở đầu cụt là hợp lệ và engine xoay
          // `yaw` dần; nếu đo cả lúc đang xoay thì mỗi cú quay đầu thành một "lần đi lùi" giả.
          // Cách phân biệt: chỉ tính khi |yawRate| nhỏ (mặt xe đã ổn định) — xe đang bẻ lái thì bỏ qua.
          if (speed > 0.8 && Math.abs(v.yawRate) < 0.05) {
            const dir = Math.atan2(dx, dz);
            let d = dir - v.yaw;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) > (Math.PI * 2) / 3) reversals += 1;
          }
        }
        arr.push({ x: v.x, z: v.z });
        trails.set(v.id, arr);
      }
    }

    // Vẽ: mặt bằng tối đi (để vệt xe nổi) + quỹ đạo.
    const view = renderCityTopView(city, mesh, { pxPerM: 2.2 });
    for (let i = 0; i < view.data.length; i += 4) {
      view.data[i] = view.data[i] * 0.28;
      view.data[i + 1] = view.data[i + 1] * 0.28;
      view.data[i + 2] = view.data[i + 2] * 0.28;
    }
    const { data, width, height, pxPerM, origin } = view;
    const px = (m: number) => Math.round((m - origin.x) * pxPerM);
    const py = (m: number) => Math.round((m - origin.z) * pxPerM);
    const put = (x: number, y: number, r: number, g: number, b: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b;
    };
    // Vệt dày 3 px: ở 2,2 px/m, vệt 1 px là 0,45 m — mảnh tới mức chìm vào nền.
    const seg = (a: Pt, b: Pt, r: number, g: number, bl: number) => {
      const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) * 2));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const cx = px(a.x + (b.x - a.x) * t);
        const cy = py(a.z + (b.z - a.z) * t);
        for (let d = -1; d <= 1; d += 1) {
          put(cx + d, cy, r, g, bl);
          put(cx, cy + d, r, g, bl);
        }
      }
    };
    let stillCount = 0;
    for (const [id, arr] of trails) {
      const frozen = (still.get(id) ?? 0) > 12;
      if (frozen) stillCount += 1;
      for (let i = 1; i < arr.length; i += 1) {
        if (frozen) seg(arr[i - 1], arr[i], 240, 200, 40);
        else seg(arr[i - 1], arr[i], 60, 220, 120);
      }
    }
    mkdirSync("docs/product/audit", { recursive: true });
    await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toFile("docs/product/audit/city-traffic.png");
    const report = {
      xe: traffic.vehicles.length,
      "mẫu quỹ đạo": [...trails.values()].reduce((a, b) => a + b.length, 0),
      "lần đổi hướng > 120°": reversals,
      "xe đứng yên > 6 s": stillCount,
      "cạnh": traffic.graph.edges.size,
      "cung": traffic.graph.turns.size,
    };
    writeFileSync("docs/product/audit/city-traffic.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    expect(traffic.vehicles.length).toBe(36);
  });
});
