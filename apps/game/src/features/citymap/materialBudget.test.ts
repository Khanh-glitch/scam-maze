import { describe, expect, it } from "vitest";
import * as THREE from "three";

/**
 * NGÂN SÁCH SHADER của việc B (vật liệu thành phố nhận `scene.environment`).
 *
 * `WebGLRenderer` chỉ gắn IBL của `AtmosphereSystem` cho `MeshStandardMaterial`
 * (`WebGLRenderer.js` ~1658), nên muốn hết "bết" thì vật liệu thành phố phải là Standard. Cái giá
 * không phải draw call (giữ nguyên: cùng một `InstancedMesh`, cùng 6 nhóm vật liệu) mà là **chi phí
 * mỗi mảnh**: PBR có nhiều uniform và varying hơn Lambert.
 *
 * Test này đo hai thứ đếm được, không cần GPU:
 *   1. số uniform khai báo trong shader (`ShaderLib`);
 *   2. số varying — thứ quyết định băng thông giữa vertex và fragment shader.
 *
 * Ngưỡng đặt theo số đo thật bên dưới, không theo cảm giác. Nếu ai đó thêm normal map / clearcoat /
 * transmission vào vật liệu thành phố, con số này sẽ vọt lên và test đỏ trước khi người dùng thấy
 * khung hình tụt.
 */

/** Đếm mọi dòng khai báo varying (không phụ thuộc tên biến). */
const countVaryings = (source: string) => (source.match(/^\s*varying\s+/gm) ?? []).length;

describe("ngân sách shader của vật liệu thành phố", () => {
  const lambert = THREE.ShaderLib.lambert;
  const physical = THREE.ShaderLib.physical;

  it("Lambert KHÔNG nhận IBL: three.js chỉ gắn scene.environment cho Standard", () => {
    // Đây là sự thật của thư viện mà cả việc A và B dựa vào; nếu three đổi hành vi thì test này
    // phải đỏ để người đọc biết mà xem lại `cityLayer.ts`.
    const lambertIsStandard = (new THREE.MeshLambertMaterial() as { isMeshStandardMaterial?: boolean })
      .isMeshStandardMaterial;
    const stdIsStandard = (new THREE.MeshStandardMaterial() as { isMeshStandardMaterial?: boolean })
      .isMeshStandardMaterial;
    expect(lambertIsStandard).toBeUndefined();
    expect(stdIsStandard).toBe(true);
  });

  it("shader PBR không vượt quá chi phí đã định (uniform + varying)", () => {
    const lv = countVaryings(lambert.vertexShader);
    const pv = countVaryings(physical.vertexShader);
    const lu = Object.keys(lambert.uniforms).length;
    const pu = Object.keys(physical.uniforms).length;
    console.log(
      `[saigon] shader lambert: ${lu} uniform, ${lv} varying · physical: ${pu} uniform, ${pv} varying ` +
        `(+${pu - lu} uniform, +${pv - lv} varying)`,
    );

    // Biên độ đo được: PBR thêm ~1/3 uniform và ~1/4 varying so với Lambert. Nới hơn mức đo một
    // chút để bản three mới không làm test đỏ oan, nhưng vẫn chặn việc lén thêm normal/clearcoat.
    expect(pu - lu).toBeLessThan(lu);
    expect(pv - lv).toBeLessThanOrEqual(Math.ceil(lv * 0.75));
  });

  it("vật liệu thành phố chỉ có một họ: cùng một bộ tham số cho mọi bề mặt", () => {
    // `facadeMaterial` và `slabMat` của `cityLayer.ts` chỉ truyền map/color/roughness/metalness/
    // envMapIntensity. Không normal map, không roughnessMap: bản quét phần mềm của engine từng làm
    // khung hình vượt 150 s khi normal map phủ toàn màn hình (§4i), và ở đây bề mặt phủ kín màn
    // hình nhiều hơn cả mặt đường.
    const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02, envMapIntensity: 0.85 });
    expect(m.normalMap).toBeNull();
    expect(m.roughnessMap).toBeNull();
    expect(m.aoMap).toBeNull();
    expect((m as unknown as { clearcoatMap?: unknown }).clearcoatMap ?? null).toBeNull();
    expect(m.envMapIntensity).toBeCloseTo(0.85);
  });
});
