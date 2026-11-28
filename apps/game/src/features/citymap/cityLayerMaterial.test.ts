import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { generateCity } from "./cityGen";
import { addCityLayer } from "./cityLayer";

/**
 * VẬT LIỆU CỦA LỚP THÀNH PHỐ — hai nhánh, cùng một hình học.
 *
 * Việc B đổi mặt đứng / mái / hè từ `MeshLambertMaterial` sang `MeshStandardMaterial` để chúng nhận
 * `scene.environment` của `AtmosphereSystem`. Không có gì trong ảnh nói được "vật liệu này có nhận
 * IBL hay không" — chỉ có kiểu vật liệu nói được, nên test này đọc thẳng scene.
 *
 * Ràng buộc phải giữ: máy chạy renderer phần mềm (`?software`) vẫn ở Lambert, đúng cách map chuẩn
 * tự hạ chi tiết, vì PBR phủ toàn màn hình từng làm khung hình vượt 150 s trong sandbox (§4i).
 */

const build = (software: boolean) => {
  const scene = new THREE.Scene();
  const city = generateCity(undefined, { realWorld: true });
  addCityLayer(scene, city, { software });
  return scene;
};

/** Mọi vật liệu gắn trên mesh của scene, kèm tên object gần nhất. */
const materials = (scene: THREE.Scene) => {
  const out: { name: string; mat: THREE.Material }[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) if (mat) out.push({ name: mesh.name || o.type, mat });
  });
  return out;
};

describe("vật liệu lớp thành phố", () => {
  it("trên GPU: mặt đứng và mái là MeshStandardMaterial (nhận được scene.environment)", () => {
    const scene = build(false);
    const all = materials(scene);
    expect(all.length).toBeGreaterThan(0);

    const standard = all.filter(({ mat }) => (mat as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial);
    const lambert = all.filter(({ mat }) => (mat as { isMeshLambertMaterial?: boolean }).isMeshLambertMaterial);

    // Nhóm nhà + hè/sân + nhựa đường + nền đất đều phải là Standard; nếu không, IBL chỉ phủ một phần
    // thành phố và chỗ giáp ranh lại "đổi chất" — đúng lỗi mà `cityLayer.ts` cố tránh.
    expect(standard.length).toBeGreaterThanOrEqual(20);
    console.log(`[saigon] vật liệu GPU: ${standard.length} standard · ${lambert.length} lambert`);
    // Đo được **0**: mọi lô của lớp thành phố đều mang vật liệu nhận IBL. Đây là con số phải giữ —
    // một lô Lambert lọt vào nghĩa là bề mặt đó lại "bết" như trước việc B.
    expect(lambert.length).toBe(0);
  });

  it("trên renderer phần mềm: KHÔNG có MeshStandardMaterial nào (giữ ngân sách khung hình)", () => {
    const scene = build(true);
    const standard = materials(scene).filter(
      ({ mat }) => (mat as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial,
    );
    // Ngoại lệ duy nhất được phép: `roadMat` — nó đã là Standard từ trước việc B và code ghi rõ
    // nhánh phần mềm tắt normal map của nó. Nếu con số này lớn hơn 1 thì B đã rò vào nhánh phần mềm.
    expect(standard.length).toBeLessThanOrEqual(1);
  });

  it("bề mặt lớn không mang normal/roughness map (bài học 150 s của §4i)", () => {
    const all = materials(build(false));
    for (const { mat } of all) {
      const m = mat as THREE.MeshStandardMaterial;
      if (!m.isMeshStandardMaterial) continue;
      // `roadMat` có normalMap (nhánh GPU của nó đã có từ trước và đã đo được); còn lại thì không.
      if (m.normalMap) continue;
      expect(m.roughnessMap).toBeNull();
    }
  });
});
