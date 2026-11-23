/**
 * Phase 3 & 4 — Thủ Thiêm Skyline, Cable-Stayed Ba Son Bridge, Illuminated Saigon River Boats
 * & Living Sky System (Soaring Tropical Swifts at Day + Blinking Tân Sơn Nhất Aircraft Lights at Night!)
 */
import * as T from "three";
import { box, lamp, material, rod } from "../simulation/scene-kit";
import { freezeStaticMatrices, mergeStaticMeshesByMaterial } from "./meshBatcher";

export interface SaigonRiversideHandle {
  staticGroup: T.Group;
  dynamicGroup: T.Group;
  setEnvironment: (nightFactor: number, rainIntensity: number) => void;
  update: (dt: number, time: number) => void;
  dispose: () => void;
}

export function buildSaigonRiversideWorld(
  staticParent: T.Group,
  dynamicParent: T.Group,
  towerMats: T.Material[],
): SaigonRiversideHandle {
  const staticGroup = new T.Group();
  staticGroup.name = "ThuThiemWaterfrontAndBaSonBridge";
  staticParent.add(staticGroup);

  const dynamicGroup = new T.Group();
  dynamicGroup.name = "SaigonRiverBoatsAndSkyLife";
  dynamicParent.add(dynamicGroup);

  const concrete = material(0x7c8284, 0.88);
  const darkBase = material(0x28322c, 0.94);
  const pylonWhite = material(0xdcdad2, 0.58, 0.15);
  const cableMat = material(0x9aa4ae, 0.4, 0.65);
  const darkMetal = material(0x22282d, 0.45, 0.65);
  const bridgeGold = lamp(0xffc978, 1.15);
  const boatWarm = lamp(0xffbe68, 0.85);
  const navRed = lamp(0xff2a20, 2.4);
  const navGreen = lamp(0x26e86c, 2.4);
  const navWhite = lamp(0xeef4ff, 2.4);

  // =========================================================================
  // 1. THỦ THIÊM RIVERBANK EMBANKMENT (Z = -484..-580 — closes the horizon!)
  // =========================================================================
  box(staticGroup, [40, 0.4, -525], [560, 1.6, 86], darkBase, false);
  box(staticGroup, [40, 1.0, -482.5], [560, 1.8, 2.4], concrete, false);
  // Warm waterfront promenade bollards along Thủ Thiêm side
  for (let x = -160; x <= 220; x += 26) {
    box(staticGroup, [x, 2.5, -483], [0.45, 1.2, 0.45], bridgeGold, false);
  }

  // Thủ Thiêm New Urban Area Skyline — Varied Organic Architectural Clusters (Metropole / Empire City 88)
  // Varied widths, depths, setbacks, & asymmetric spacing (ZERO repetitive LEGO blocks!)
  const thuThiemTowers: [number, number, number, number, number][] = [
    [-134, -514, 18, 72, 18],
    [-98, -506, 26, 118, 20],
    [-68, -524, 16, 62, 16],
    [-22, -508, 22, 148, 22],
    [16, -528, 34, 88, 20],   // Metropole horizontal luxury residential terrace
    [54, -510, 20, 134, 20],
    [98, -512, 28, 228, 26],  // Empire City 88-inspired terraced observation spire!
    [134, -530, 18, 92, 18],
    [186, -514, 24, 112, 22],
  ];
  thuThiemTowers.forEach(([x, z, w, h, d], i) => {
    const tm = towerMats[i % towerMats.length];
    if (i === 6) {
      // Signature Empire City 88 stepped triple-tier spire with sky-forest notch & illuminated crown!
      box(staticGroup, [x, 42, z], [w, 84, d], tm, false);
      box(staticGroup, [x + 2, 118, z], [w * 0.78, 68, d * 0.78], tm, false);
      box(staticGroup, [x - 1, 186, z], [w * 0.56, 76, d * 0.56], tm, false);
      box(staticGroup, [x, 228, z], [w * 0.34, 8, d * 0.34], bridgeGold, false);
      rod(staticGroup, [x, 232, z], [x, 256, z], 0.55, pylonWhite, 0.16, 6);
    } else if (i % 3 === 1) {
      // Twin-slab asymmetric setback tower
      const h1 = h * 0.58;
      const h2 = h * 0.42;
      box(staticGroup, [x, h1 * 0.5, z], [w, h1, d], tm, false);
      box(staticGroup, [x + w * 0.14, h1 + h2 * 0.5, z], [w * 0.62, h2, d * 0.82], tm, false);
      box(staticGroup, [x + w * 0.14, h + 1.4, z], [w * 0.54, 2.8, d * 0.72], darkMetal, false);
    } else {
      // Stepped modern crown with slender mechanical penthouse
      const h1 = h * 0.74;
      const h2 = h * 0.26;
      box(staticGroup, [x, h1 * 0.5, z], [w, h1, d], tm, false);
      box(staticGroup, [x, h1 + h2 * 0.5, z], [w * 0.76, h2, d * 0.76], tm, false);
      box(staticGroup, [x, h + 1.5, z], [w * 0.42, 3.0, d * 0.42], darkMetal, false);
    }
  });

  // =========================================================================
  // 2. ICONIC BA SON CABLE-STAYED BRIDGE SILHOUETTE (East flank over Saigon River!)
  // Spans Z = -396 to Z = -492 at X = 148 with signature tilted 113m A-pylon & glowing stays!
  // =========================================================================
  const bx = 148;
  // Bridge road deck + illuminated parapet edge strip
  box(staticGroup, [bx, 18.0, -444], [14.0, 2.2, 112.0], concrete, false);
  box(staticGroup, [bx - 7.1, 19.2, -444], [0.25, 0.35, 112.0], bridgeGold, false);
  box(staticGroup, [bx + 7.1, 19.2, -444], [0.25, 0.35, 112.0], bridgeGold, false);
  // River piers
  box(staticGroup, [bx, 9.0, -402], [10.0, 18.0, 4.5], concrete, false);
  box(staticGroup, [bx, 9.0, -486], [10.0, 18.0, 4.5], concrete, false);
  // Signature Asymmetric Leaning Cable-Stayed Pylon (tilted subtly toward Thủ Thiêm)
  const pyTop: [number, number, number] = [bx, 112.0, -456];
  rod(staticGroup, [bx - 5.2, 0.0, -446], pyTop, 2.2, pylonWhite, 1.3, 8);
  rod(staticGroup, [bx + 5.2, 0.0, -446], pyTop, 2.2, pylonWhite, 1.3, 8);
  box(staticGroup, [bx, 58.0, -451], [8.5, 2.6, 2.8], pylonWhite, false);
  // Warm golden illuminated spire tip
  box(staticGroup, [bx, 108.0, -456], [2.4, 8.0, 2.4], bridgeGold, false);
  // Fan of cable stays radiating from pylon head to bridge deck
  for (let k = 0; k < 9; k++) {
    const zDeck = -402 - k * 10.2;
    const yAnchor = 106 - Math.abs(k - 4) * 3.8;
    rod(staticGroup, [bx - 1.2, yAnchor, -455.5], [bx - 6.2, 19.0, zDeck], 0.14, cableMat, 0.12, 5);
    rod(staticGroup, [bx + 1.2, yAnchor, -455.5], [bx + 6.2, 19.0, zDeck], 0.14, cableMat, 0.12, 5);
  }

  mergeStaticMeshesByMaterial(staticGroup);
  freezeStaticMatrices(staticGroup);

  // =========================================================================
  // 3. TWO ILLUMINATED SAIGON RIVER DINNER CRUISE BOATS
  // =========================================================================
  interface RiverBoat {
    group: T.Group;
    dir: number;
    speed: number;
    minX: number;
    maxX: number;
    bobOffset: number;
  }
  const boats: RiverBoat[] = [];
  const hullMat = material(0x1b242e, 0.48, 0.35);
  const deckWhite = material(0x8e9296, 0.58, 0.14);

  const makeBoat = (x: number, z: number, dir: number, speed: number, length: number) => {
    const g = new T.Group();
    box(g, [0, 0.55, 0], [length, 1.4, 5.2], hullMat, false);
    box(g, [0, 1.85, 0], [length * 0.74, 1.4, 4.2], deckWhite, false);
    // Segmented warm amber-gold dinner-cruise cabin windows (not one blown-out solid white bar!)
    const segCount = 6;
    const segSpan = length * 0.58;
    for (let s = 0; s < segCount; s++) {
      const sx = -segSpan * 0.5 + (s + 0.5) * (segSpan / segCount);
      box(g, [sx, 1.95, 2.14], [(segSpan / segCount) * 0.68, 0.58, 0.08], boatWarm, false);
      box(g, [sx, 1.95, -2.14], [(segSpan / segCount) * 0.68, 0.58, 0.08], boatWarm, false);
    }
    // Upper canopy deck + delicate warm amber fairy-light rim
    box(g, [0, 3.35, 0], [length * 0.6, 0.22, 3.9], darkMetal, false);
    box(g, [0, 3.22, 1.98], [length * 0.56, 0.07, 0.06], bridgeGold, false);
    box(g, [0, 3.22, -1.98], [length * 0.56, 0.07, 0.06], bridgeGold, false);
    // Port (red), Starboard (green) & Masthead (white) navigation beacons
    box(g, [length * 0.48, 1.6, -2.2], [0.28, 0.28, 0.28], navRed, false);
    box(g, [length * 0.48, 1.6, 2.2], [0.28, 0.28, 0.28], navGreen, false);
    rod(g, [length * 0.2, 3.7, 0], [length * 0.2, 6.2, 0], 0.08, darkMetal, 0.05, 6);
    box(g, [length * 0.2, 6.3, 0], [0.3, 0.3, 0.3], navWhite, false);

    g.position.set(x, -0.22, z);
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    dynamicGroup.add(g);
    boats.push({ group: g, dir, speed, minX: -140, maxX: 132, bobOffset: Math.random() * 6 });
  };
  makeBoat(-42, -432, 1, 3.4, 22);
  makeBoat(64, -458, -1, 2.8, 18);

  // =========================================================================
  // 4. LIVING SKY — HIGH-ALTITUDE TÂN SƠN NHẤT AIRCRAFT & DAYTIME TROPICAL SWIFTS
  // =========================================================================
  const planeGroup = new T.Group();
  const planeStrobeMat = new T.MeshBasicMaterial({ color: new T.Color(5.0, 5.2, 5.8) });
  const planeWingRed = new T.MeshBasicMaterial({ color: new T.Color(4.5, 0.3, 0.2) });
  const planeWingGreen = new T.MeshBasicMaterial({ color: new T.Color(0.25, 4.5, 0.5) });
  const strobe = new T.Mesh(new T.SphereGeometry(0.65, 6, 6), planeStrobeMat);
  const wRed = new T.Mesh(new T.SphereGeometry(0.55, 6, 6), planeWingRed);
  wRed.position.set(0, 0, -4.2);
  const wGreen = new T.Mesh(new T.SphereGeometry(0.55, 6, 6), planeWingGreen);
  wGreen.position.set(0, 0, 4.2);
  planeGroup.add(strobe, wRed, wGreen);
  planeGroup.position.set(-220, 195, -260);
  dynamicGroup.add(planeGroup);

  // 1-draw-call soaring tropical bird flock gliding over Landmark 81 & Saigon River at daytime/sunset!
  const birdCount = 16;
  const birdGeo = new T.BufferGeometry();
  // Simple sleek V-wing silhouette (2 triangles)
  birdGeo.setAttribute(
    "position",
    new T.BufferAttribute(
      new Float32Array([
        0, 0, 0.35, -0.95, 0.14, -0.22, 0, 0, -0.15,
        0, 0, 0.35, 0, 0, -0.15, 0.95, 0.14, -0.22,
      ]),
      3,
    ),
  );
  const birdMat = new T.ShaderMaterial({
    side: T.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new T.Color(0x1f242a) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      void main() {
        vec3 p = position;
        float wing = abs(p.x);
        // Per-instance phase derived from instance matrix translation!
        float phase = instanceMatrix[3][0] * 0.17 + instanceMatrix[3][2] * 0.13;
        p.y += sin(uTime * 7.5 + phase) * wing * 0.42;
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
  });
  const birdMesh = new T.InstancedMesh(birdGeo, birdMat, birdCount);
  birdMesh.frustumCulled = false;
  dynamicGroup.add(birdMesh);

  const _m = new T.Matrix4();
  const _q = new T.Quaternion();
  const _p = new T.Vector3();
  const _s = new T.Vector3(1, 1, 1);
  const _up = new T.Vector3(0, 1, 0);

  return {
    staticGroup,
    dynamicGroup,
    setEnvironment(nightFactor: number, rainIntensity: number) {
      const lit = T.MathUtils.smoothstep(nightFactor, 0.15, 0.72);
      bridgeGold.emissiveIntensity = T.MathUtils.lerp(0.08, 1.85, lit);
      boatWarm.emissiveIntensity = T.MathUtils.lerp(0.12, 2.4, lit);
      planeGroup.visible = nightFactor > 0.35;
      birdMesh.visible = nightFactor < 0.65 && rainIntensity < 0.7;
    },
    update(dt: number, time: number) {
      // Gentle boat cruising & water bobbing along Saigon River
      for (const b of boats) {
        b.group.position.x += b.dir * b.speed * dt;
        if (b.group.position.x > b.maxX) b.group.position.x = b.minX;
        if (b.group.position.x < b.minX) b.group.position.x = b.maxX;
        b.group.position.y = -0.22 + Math.sin(time * 1.4 + b.bobOffset) * 0.09;
        b.group.rotation.z = Math.sin(time * 1.1 + b.bobOffset) * 0.018;
      }

      // High-altitude Tân Sơn Nhất approach aircraft with rhythmic aviation strobe
      if (planeGroup.visible) {
        planeGroup.position.x += 16.5 * dt;
        planeGroup.position.z -= 4.2 * dt;
        if (planeGroup.position.x > 260) {
          planeGroup.position.set(-240, 185 + Math.sin(time) * 18, -220);
        }
        const flash = (time * 1.1) % 1.0 < 0.09 ? 1.0 : 0.05;
        planeStrobeMat.color.setRGB(5.2 * flash, 5.4 * flash, 6.0 * flash);
      }

      // Soaring tropical swifts circling above Vinhomes Central Park & Saigon River
      if (birdMesh.visible) {
        birdMat.uniforms.uTime.value = time;
        for (let i = 0; i < birdCount; i++) {
          const ang = time * (0.14 + (i % 4) * 0.02) + i * 0.39;
          const rad = 52 + (i % 5) * 14;
          const cx = 32 + Math.cos(ang) * rad;
          const cz = -355 + Math.sin(ang) * rad * 0.78;
          const cy = 44 + (i % 4) * 8 + Math.sin(time * 0.9 + i) * 3.5;
          _p.set(cx, cy, cz);
          _q.setFromAxisAngle(_up, -ang);
          _s.setScalar(0.85 + (i % 3) * 0.22);
          _m.compose(_p, _q, _s);
          birdMesh.setMatrixAt(i, _m);
        }
        birdMesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      birdGeo.dispose();
      birdMat.dispose();
    },
  };
}
