import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  wid: number,
  angle: number,
  col1: string,
  col2: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, 0, -len);
  g.addColorStop(0, col1);
  g.addColorStop(1, col2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid * 0.9, -len * 0.28, wid * 0.72, -len * 0.78, 0, -len);
  ctx.bezierCurveTo(-wid * 0.72, -len * 0.78, -wid * 0.9, -len * 0.28, 0, 0);
  ctx.closePath();
  ctx.fill();

  // Crisp central midrib & lateral veins
  ctx.strokeStyle = "rgba(220,245,180,0.32)";
  ctx.lineWidth = Math.max(1, wid * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, -len * 0.92);
  ctx.stroke();

  ctx.lineWidth = Math.max(0.7, wid * 0.035);
  for (let v = 1; v <= 4; v++) {
    const vy = -len * (v * 0.18);
    const vw = wid * 0.45 * (1 - v * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, vy);
    ctx.lineTo(vw, vy - len * 0.1);
    ctx.moveTo(0, vy);
    ctx.lineTo(-vw, vy - len * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Photorealistic Vietnamese Bougainvillea (Hoa Giấy) & Tropical Foliage Sprig Texture (Alpha-Cutout) */
function createBougainvilleaSprigTexture(hasFlowers: boolean, seed: number): T.CanvasTexture {
  const rng = seeded(seed);
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 512);

  // Branching woody twigs from bottom center
  ctx.strokeStyle = "#4c3828";
  ctx.lineCap = "round";
  const branches: [number, number, number, number, number][] = [
    [256, 505, 252, 115, 7],
    [256, 420, 115, 205, 5],
    [256, 385, 398, 188, 5],
    [254, 305, 132, 115, 4],
    [254, 278, 382, 102, 4],
  ];
  for (const [x0, y0, x1, y1, lw] of branches) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) * 0.5 + (rng() - 0.5) * 32, (y0 + y1) * 0.5, x1, y1);
    ctx.stroke();
  }

  // Dense overlapping pointed tropical leaves with realistic color & light variation
  const leafGreens: [string, string][] = [
    ["#1f481f", "#3a722d"],
    ["#255324", "#4b8536"],
    ["#1a3d1c", "#32642a"],
    ["#2c5d26", "#5c943e"],
  ];
  for (let i = 0; i < 64; i++) {
    const b = branches[i % branches.length];
    const t = 0.18 + rng() * 0.82;
    const bx = b[0] + (b[2] - b[0]) * t + (rng() - 0.5) * 58;
    const by = b[1] + (b[3] - b[1]) * t + (rng() - 0.5) * 52;
    const ang = (rng() - 0.5) * 2.5;
    const len = 46 + rng() * 44;
    const wid = 20 + rng() * 18;
    const pal = leafGreens[i % leafGreens.length];
    drawLeaf(ctx, bx, by, len, wid, ang, pal[0], pal[1]);
  }

  // Vibrant papery Vietnamese Bougainvillea (Hoa Giấy) blossom clusters!
  if (hasFlowers) {
    const flowerPal: [string, string][] = [
      ["#9e174e", "#e63984"],
      ["#b51d5b", "#f05698"],
      ["#8c1444", "#d62972"],
      ["#c42362", "#ff72b0"],
    ];
    for (let i = 0; i < 42; i++) {
      const b = branches[i % branches.length];
      const t = 0.42 + rng() * 0.58;
      const fx = b[0] + (b[2] - b[0]) * t + (rng() - 0.5) * 76;
      const fy = b[1] + (b[3] - b[1]) * t + (rng() - 0.5) * 68;
      const pal = flowerPal[i % flowerPal.length];
      // 3 papery bracts per bougainvillea cluster + tiny cream stamen center
      for (let p = 0; p < 3; p++) {
        const pa = (p / 3) * Math.PI * 2 + rng() * 0.7;
        drawLeaf(ctx, fx, fy, 24 + rng() * 14, 15 + rng() * 8, pa, pal[0], pal[1]);
      }
      ctx.fillStyle = "#fff5d2";
      ctx.beginPath();
      ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Authentic Pinnate Saigon Royal Palm (Cau Vua) Feather Frond Texture (Alpha-Cutout) */
function createPalmFrondTexture(): T.CanvasTexture {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 512);

  // Central tapered green-yellow rachis stem
  const stemGrad = ctx.createLinearGradient(0, 512, 0, 0);
  stemGrad.addColorStop(0, "#4d6e2a");
  stemGrad.addColorStop(1, "#6f9438");
  ctx.strokeStyle = stemGrad;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(256, 510);
  ctx.lineTo(256, 16);
  ctx.stroke();

  // 44 pairs of slender drooping pinnate leaflets
  for (let i = 0; i < 44; i++) {
    const t = i / 43;
    const y = 492 - t * 470;
    const env = Math.sin(t * Math.PI * 0.92 + 0.12);
    const len = 36 + env * 195;
    for (const side of [-1, 1]) {
      const g = ctx.createLinearGradient(256, y, 256 + side * len, y - 34);
      g.addColorStop(0, "#235420");
      g.addColorStop(0.55, "#36732c");
      g.addColorStop(1, "#558f38");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(256, y + 3);
      ctx.quadraticCurveTo(256 + side * len * 0.52, y - 22, 256 + side * len, y - 4);
      ctx.quadraticCurveTo(256 + side * len * 0.52, y - 8, 256, y - 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Realistic Glazed Vietnamese Ceramic / Terracotta Pot Texture (weathered mineral ring + clay patina) */
function createCeramicPotTexture(baseHex: string, rimHex: string): T.CanvasTexture {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, rimHex);
  g.addColorStop(0.18, baseHex);
  g.addColorStop(0.75, baseHex);
  g.addColorStop(1, "#4e392d"); // damp base mineral patina
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle decorative grooved bands & mineral salt efflorescence
  ctx.fillStyle = "rgba(255,250,235,0.14)";
  ctx.fillRect(0, 44, 256, 8);
  ctx.fillRect(0, 58, 256, 4);
  for (let i = 0; i < 600; i++) {
    const x = (Math.sin(i * 17.3) * 0.5 + 0.5) * 256;
    const y = (Math.cos(i * 41.1) * 0.5 + 0.5) * 256;
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,248,236,0.08)" : "rgba(32,20,14,0.08)";
    ctx.fillRect(x, y, 3, 2);
  }

  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Creates an organic arched leaf-card geometry (slightly curved so it never looks like a flat sticker!) */
function createCurvedCardGeometry(w: number, h: number): T.BufferGeometry {
  const geo = new T.PlaneGeometry(w, h, 3, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const ny = (y + h * 0.5) / h; // 0 at bottom, 1 at top
    const nx = x / (w * 0.5);
    // Gentle outward botanical droop + subtle cup curvature
    const droop = -ny * ny * (h * 0.22) - nx * nx * (w * 0.08);
    pos.setZ(i, droop);
    pos.setY(i, y + h * 0.5); // anchor pivot at base of stem!
  }
  geo.computeVertexNormals();
  return geo;
}

/** Shared LatheGeometry for authentic Vietnamese curved ceramic flower pot with flared rolled rim */
function createVietnamesePotGeometry(): T.BufferGeometry {
  const pts = [
    new T.Vector2(0.0, 0.0),
    new T.Vector2(0.145, 0.0),
    new T.Vector2(0.165, 0.06),
    new T.Vector2(0.215, 0.2),
    new T.Vector2(0.225, 0.34),
    new T.Vector2(0.242, 0.385), // rolled lip rim
    new T.Vector2(0.245, 0.425),
    new T.Vector2(0.218, 0.43),
    new T.Vector2(0.205, 0.365), // recessed inner rim down to potting soil
    new T.Vector2(0.0, 0.365),
  ];
  return new T.LatheGeometry(pts, 18);
}

/**
 * Adds hyper-realistic Vietnamese potted plants (glaze/terracotta lathe pots + dark potting soil +
 * branching woody stems + 12 arched alpha-tested botanical foliage & bougainvillea cards per pot)
 * batched into ONLY 3 GPU draw calls total regardless of how many pots you place!
 */
export function buildRealisticPottedPlants(
  parent: T.Group,
  placements: { pos: [number, number, number]; scale?: number; hasFlowers?: boolean }[],
  windUniforms: { time: { value: number }; amp: { value: number } },
) {
  if (placements.length === 0) return;

  const potGeo = createVietnamesePotGeometry();
  const potMat = new T.MeshStandardMaterial({
    map: createCeramicPotTexture("#a65336", "#bd6846"),
    roughness: 0.62,
    metalness: 0.04,
  });
  const soilGeo = new T.CircleGeometry(0.205, 14);
  soilGeo.rotateX(-Math.PI / 2);
  const soilMat = new T.MeshStandardMaterial({ color: 0x2b2017, roughness: 0.96 });

  const potInst = new T.InstancedMesh(potGeo, potMat, placements.length);
  const soilInst = new T.InstancedMesh(soilGeo, soilMat, placements.length);
  potInst.castShadow = true;
  potInst.receiveShadow = true;
  soilInst.receiveShadow = true;

  // Build 1 curved botanical sprig card geometry and instance ALL foliage cards across ALL pots!
  const cardGeo = createCurvedCardGeometry(0.54, 0.64);
  const applyWind = (mat: T.MeshStandardMaterial) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniforms.time;
      shader.uniforms.uAmp = windUniforms.amp;
      shader.vertexShader =
        `uniform float uTime, uAmp;\n` +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float tip = clamp(position.y / 0.65, 0.0, 1.0);
           float w = sin(uTime * 2.2 + float(gl_InstanceID) * 1.7 + position.x * 3.0) * 0.032 * uAmp * tip;
           transformed.x += w;
           transformed.z += w * 0.6;`,
        );
    };
  };

  const flowerTex = createBougainvilleaSprigTexture(true, 9101);
  const greenTex = createBougainvilleaSprigTexture(false, 9202);
  const flowerMat = new T.MeshStandardMaterial({
    map: flowerTex,
    alphaTest: 0.38,
    side: T.DoubleSide,
    roughness: 0.66,
    metalness: 0.02,
  });
  const greenMat = new T.MeshStandardMaterial({
    map: greenTex,
    alphaTest: 0.38,
    side: T.DoubleSide,
    roughness: 0.62,
    metalness: 0.02,
  });
  applyWind(flowerMat);
  applyWind(greenMat);

  const cardsPerPot = 10;
  const flowerMatrices: T.Matrix4[] = [];
  const greenMatrices: T.Matrix4[] = [];
  const dummy = new T.Object3D();
  const rng = seeded(46214);

  placements.forEach((p, idx) => {
    const s = p.scale ?? 1;
    dummy.position.set(p.pos[0], p.pos[1], p.pos[2]);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    potInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(p.pos[0], p.pos[1] + 0.372 * s, p.pos[2]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    soilInst.setMatrixAt(idx, dummy.matrix);

    const targetList = p.hasFlowers !== false ? flowerMatrices : greenMatrices;
    for (let c = 0; c < cardsPerPot; c++) {
      const ang = (c / cardsPerPot) * Math.PI * 2 + (rng() - 0.5) * 0.45;
      const ring = c < 4 ? 0.03 : 0.095;
      const tilt = c < 4 ? 0.14 + rng() * 0.2 : 0.38 + rng() * 0.38;
      const cs = s * (c < 4 ? 1.02 + rng() * 0.24 : 0.78 + rng() * 0.26);

      dummy.position.set(
        p.pos[0] + Math.cos(ang) * ring * s,
        p.pos[1] + (0.35 + (c < 4 ? 0.04 : 0.0)) * s,
        p.pos[2] + Math.sin(ang) * ring * s,
      );
      dummy.rotation.set(tilt, -ang + Math.PI * 0.5, (rng() - 0.5) * 0.25);
      dummy.scale.set(cs, cs * (0.85 + rng() * 0.3), cs);
      dummy.updateMatrix();
      targetList.push(dummy.matrix.clone());
    }
  });

  potInst.instanceMatrix.needsUpdate = true;
  soilInst.instanceMatrix.needsUpdate = true;
  parent.add(potInst, soilInst);

  if (flowerMatrices.length > 0) {
    const fm = new T.InstancedMesh(cardGeo, flowerMat, flowerMatrices.length);
    flowerMatrices.forEach((m, i) => fm.setMatrixAt(i, m));
    fm.instanceMatrix.needsUpdate = true;
    parent.add(fm);
  }
  if (greenMatrices.length > 0) {
    const gm = new T.InstancedMesh(cardGeo, greenMat, greenMatrices.length);
    greenMatrices.forEach((m, i) => gm.setMatrixAt(i, m));
    gm.instanceMatrix.needsUpdate = true;
    parent.add(gm);
  }
}

/**
 * Instanced Botanical Saigon Boulevard Tree & Royal Palm Builder:
 * Replaces ALL low-poly icosahedron/dodecahedron tree blobs with real branching trunks +
 * hundreds of alpha-tested leaf-spray & pinnate palm frond cards batched into just 4 GPU draw calls!
 */
export class SaigonBotanicalBatch {
  private shadeTrees: { x: number; y: number; z: number; scale: number }[] = [];
  private palms: { x: number; y: number; z: number; scale: number }[] = [];

  addShadeTree(x: number, y: number, z: number, scale = 1) {
    this.shadeTrees.push({ x, y, z, scale });
  }

  addRoyalPalm(x: number, y: number, z: number, scale = 1) {
    this.palms.push({ x, y, z, scale });
  }

  commit(
    parent: T.Group,
    barkMat: T.Material,
    windUniforms: { uTime: { value: number }; uWind: { value: number } },
    castShadow: boolean,
  ) {
    const rng = seeded(202699);
    const dummy = new T.Object3D();

    const applyTreeWind = (mat: T.MeshStandardMaterial, scaleAmp: number) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = windUniforms.uTime;
        shader.uniforms.uWind = windUniforms.uWind;
        shader.vertexShader =
          `uniform float uTime, uWind;\n` +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             float sway = sin(uTime * 1.9 + float(gl_InstanceID) * 1.13 + position.x * 0.8) * ${scaleAmp.toFixed(3)} * uWind;
             transformed.x += sway * max(0.0, uv.y);
             transformed.z += sway * 0.6 * max(0.0, uv.y);`,
          );
      };
    };

    // 1. MULTI-BRANCH SAIGON SHADE TREES (Dầu / Sao Đen) — 2 Draw Calls for ALL trees!
    if (this.shadeTrees.length > 0) {
      // Build 1 realistic forked trunk+4-limb template geometry via mergeGeometries
      const parts: T.BufferGeometry[] = [];
      const mainTrunk = new T.CylinderGeometry(0.14, 0.24, 3.4, 8);
      mainTrunk.translate(0, 1.7, 0);
      parts.push(mainTrunk);
      for (let b = 0; b < 4; b++) {
        const ba = (b / 4) * Math.PI * 2 + 0.35;
        const limb = new T.CylinderGeometry(0.045, 0.11, 2.2, 6);
        limb.translate(0, 1.1, 0);
        limb.rotateZ(0.52);
        limb.rotateY(ba);
        limb.translate(0, 2.9, 0);
        parts.push(limb);
      }
      const mergedTrunk = mergeGeometries(parts, false);
      parts.forEach((p) => p.dispose());

      if (mergedTrunk) {
        const trunkInst = new T.InstancedMesh(mergedTrunk, barkMat, this.shadeTrees.length);
        trunkInst.castShadow = castShadow;
        trunkInst.receiveShadow = true;
        this.shadeTrees.forEach((t, i) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.setScalar(t.scale);
          dummy.updateMatrix();
          trunkInst.setMatrixAt(i, dummy.matrix);
        });
        trunkInst.instanceMatrix.needsUpdate = true;
        parent.add(trunkInst);
      }

      // 20 layered alpha-tested botanical foliage branch-cards per shade tree (ZERO bubbles!)
      const sprayTex = createBougainvilleaSprigTexture(false, 5151);
      const sprayMat = new T.MeshStandardMaterial({
        map: sprayTex,
        alphaTest: 0.36,
        side: T.DoubleSide,
        roughness: 0.72,
        metalness: 0.02,
      });
      applyTreeWind(sprayMat, 0.14);
      const sprayGeo = createCurvedCardGeometry(2.15, 2.35);
      const cardsPerTree = 20;
      const canopyInst = new T.InstancedMesh(sprayGeo, sprayMat, this.shadeTrees.length * cardsPerTree);
      canopyInst.castShadow = castShadow;
      canopyInst.receiveShadow = true;

      let ci = 0;
      dummy.rotation.order = "YXZ";
      for (const t of this.shadeTrees) {
        for (let k = 0; k < cardsPerTree; k++) {
          const tier = k < 10 ? 0 : k < 16 ? 1 : 2;
          const ang = (k / (tier === 0 ? 10 : tier === 1 ? 6 : 4)) * Math.PI * 2 + rng() * 0.55;
          const rad = (tier === 0 ? 1.15 : tier === 1 ? 0.72 : 0.28) * t.scale;
          const yOff = (tier === 0 ? 3.85 : tier === 1 ? 4.65 : 5.25) * t.scale;
          const tilt = tier === 0 ? 0.68 : tier === 1 ? 0.42 : 0.18;
          const cs = t.scale * (0.94 + rng() * 0.36);

          dummy.position.set(
            t.x + Math.cos(ang) * rad,
            t.y + yOff + (rng() - 0.5) * 0.35 * t.scale,
            t.z + Math.sin(ang) * rad,
          );
          dummy.rotation.set(tilt + (rng() - 0.5) * 0.25, -ang + Math.PI * 0.5, (rng() - 0.5) * 0.25);
          dummy.scale.setScalar(cs);
          dummy.updateMatrix();
          canopyInst.setMatrixAt(ci++, dummy.matrix);
        }
      }
      canopyInst.instanceMatrix.needsUpdate = true;
      parent.add(canopyInst);
    }

    // 2. AUTHENTIC SAIGON ROYAL PALMS (Cau Vua) — Full 360° Radial Crown in 2 Draw Calls!
    if (this.palms.length > 0) {
      const palmParts: T.BufferGeometry[] = [];
      const lower = new T.CylinderGeometry(0.16, 0.24, 3.4, 8);
      lower.translate(0, 1.7, 0);
      const upper = new T.CylinderGeometry(0.11, 0.16, 2.8, 8);
      upper.rotateZ(-0.04);
      upper.translate(0.06, 4.7, 0);
      palmParts.push(lower, upper);
      const mergedPalmTrunk = mergeGeometries(palmParts, false);
      palmParts.forEach((p) => p.dispose());

      if (mergedPalmTrunk) {
        const ptInst = new T.InstancedMesh(mergedPalmTrunk, barkMat, this.palms.length);
        ptInst.castShadow = castShadow;
        ptInst.receiveShadow = true;
        this.palms.forEach((p, i) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, rng() * Math.PI * 2, 0);
          dummy.scale.setScalar(p.scale);
          dummy.updateMatrix();
          ptInst.setMatrixAt(i, dummy.matrix);
        });
        ptInst.instanceMatrix.needsUpdate = true;
        parent.add(ptInst);
      }

      // 14 radially symmetric arching pinnate feather fronds per palm (natural olive tropical green!)
      const frondTex = createPalmFrondTexture();
      const frondMat = new T.MeshStandardMaterial({
        color: 0x8a967a,
        map: frondTex,
        alphaTest: 0.32,
        side: T.DoubleSide,
        roughness: 0.72,
        metalness: 0.02,
      });
      applyTreeWind(frondMat, 0.14);
      const frondGeo = createCurvedCardGeometry(1.24, 3.25);
      const frondsPerPalm = 14;
      const frondInst = new T.InstancedMesh(frondGeo, frondMat, this.palms.length * frondsPerPalm);
      frondInst.castShadow = castShadow;

      let fi = 0;
      dummy.rotation.order = "YXZ";
      for (const p of this.palms) {
        for (let k = 0; k < frondsPerPalm; k++) {
          const upperTier = k >= 8;
          const ang = (k / (upperTier ? 6 : 8)) * Math.PI * 2 + (upperTier ? 0.52 : 0) + (rng() - 0.5) * 0.22;
          const tilt = upperTier ? 0.48 + rng() * 0.18 : 1.02 + rng() * 0.22;
          const cs = p.scale * (0.92 + rng() * 0.22);

          dummy.position.set(p.x + 0.12 * p.scale, p.y + 6.0 * p.scale, p.z);
          dummy.rotation.set(tilt, ang, (rng() - 0.5) * 0.12);
          dummy.scale.setScalar(cs);
          dummy.updateMatrix();
          frondInst.setMatrixAt(fi++, dummy.matrix);
        }
      }
      frondInst.instanceMatrix.needsUpdate = true;
      parent.add(frondInst);
    }
  }
}
