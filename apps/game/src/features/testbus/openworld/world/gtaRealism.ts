/**
 * GTA 6-Caliber Urban Realism Module for Saigon Open World
 *  1. Real-time 3D Ray-Box Parallax Interior Mapping Shader for glass skyscrapers & offices
 *  2. 1-Draw-Call 3D Instanced Wind-Swaying Multi-Blade Tropical Grass Tufts + Lush Organic Soil Ground
 *  3. 3D Vietnamese Shophouse Architectural Relief (striped awnings, AC condensers, iron balconies, damp plinths)
 */
import * as T from "three";

// =============================================================================
// 1. REAL-TIME 3D PARALLAX INTERIOR MAPPING GLASS TOWER SHADER (GTA 6 / SPIDER-MAN)
// =============================================================================
export interface InteriorTowerMaterialHandle {
  material: T.ShaderMaterial;
  setAtmosphere: (
    nightFactor: number,
    sunDir: T.Vector3,
    fogColor: T.Color,
    fogDensity: number,
    skyHorizon?: T.Color,
    rainIntensity?: number,
  ) => void;
}

export function createInteriorMappingTowerMaterial(opts: {
  glassTint: number;
  mullionColor: number;
  warmRatio?: number;
  seed?: number;
  cellWidth?: number;
  cellHeight?: number;
}): InteriorTowerMaterialHandle {
  const glassCol = new T.Color(opts.glassTint);
  const mullionCol = new T.Color(opts.mullionColor);

  const material = new T.ShaderMaterial({
    uniforms: {
      uNight: { value: 0.9 },
      uRain: { value: 0.36 },
      uSunDir: { value: new T.Vector3(0.4, 0.6, -0.5).normalize() },
      uGlassTint: { value: glassCol },
      uMullionCol: { value: mullionCol },
      uWarmRatio: { value: opts.warmRatio ?? 0.55 },
      uSeed: { value: opts.seed ?? 1.0 },
      uCellSize: { value: new T.Vector2(opts.cellWidth ?? 4.2, opts.cellHeight ?? 3.55) },
      uFogColor: { value: new T.Color(0x1d1a26) },
      uFogDensity: { value: 0.0024 },
      uSkyHorizon: { value: new T.Color(0x262230) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vObjPos;
      varying vec3 vObjNormal;
      varying float vFogDepth;

      void main() {
        vObjPos = position;
        vObjNormal = normalize(normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPos = viewMatrix * wp;
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uNight, uRain, uWarmRatio, uSeed, uFogDensity;
      uniform vec3 uSunDir, uGlassTint, uMullionCol, uFogColor, uSkyHorizon;
      uniform vec2 uCellSize;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vObjPos;
      varying vec3 vObjNormal;
      varying float vFogDepth;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345) + uSeed * 13.7);
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);

        // Tropical height-attenuated atmospheric fog (denser warm mist near street level, crisper upper skyline!)
        float heightAtten = mix(1.0, 0.52, smoothstep(8.0, 140.0, vWorldPos.y));
        float fogFactor = 1.0 - exp(-pow(vFogDepth * uFogDensity * heightAtten, 2.0));

        // Roof cap -> weathered architectural concrete deck with subtle gravel variation
        if (abs(N.y) > 0.7) {
          float roofNoise = hash21(floor(vWorldPos.xz * 0.5));
          vec3 roofCol = mix(vec3(0.28, 0.30, 0.32), vec3(0.08, 0.09, 0.11), uNight) * (0.85 + roofNoise * 0.3);
          gl_FragColor = vec4(mix(roofCol, uFogColor, clamp(fogFactor, 0.0, 1.0)), 1.0);
          return;
        }

        // Build clean facade tangent frame (world-aligned vertical + horizontal along wall)
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 tangent = normalize(cross(up, N));

        // Project world position into uniform architectural window grid (meters -> rooms)
        float uCoord = dot(vWorldPos, tangent) / uCellSize.x;
        float vCoord = vWorldPos.y / uCellSize.y;
        vec2 cellId = floor(vec2(uCoord, vCoord));
        vec2 f = fract(vec2(uCoord, vCoord));

        // Structural aluminum curtain-wall mullions + thicker architectural floor slab spandrel band
        float mullionX = step(0.945, f.x) + step(f.x, 0.055);
        float subMullion = step(0.485, f.x) * step(f.x, 0.515);
        float spandrelY = step(0.83, f.y) + step(f.y, 0.17);
        float isFrame = clamp(mullionX + subMullion * 0.65 + spandrelY, 0.0, 1.0);
        // Subtle per-pane glass reflection tint variation (real tempered glass panes bow slightly!)
        float paneVar = hash21(cellId + vec2(step(0.5, f.x) * 3.1, 17.4));

        // View ray transformed into room-local coordinates for 3D ray-box intersection!
        vec3 viewDir = -V;
        vec3 ray = vec3(
          dot(viewDir, tangent) / uCellSize.x,
          viewDir.y / uCellSize.y,
          dot(viewDir, -N) * 0.42 // room depth ratio (~2.4x cell depth)
        );
        // Normalize ray Z safely
        ray.z = max(ray.z, 0.08);

        // Starting point on front window glass (z = 0, xy in [0,1])
        vec3 ro = vec3(f.x, f.y, 0.0);
        vec3 invR = 1.0 / (ray + vec3(1e-5));

        // Intersect 5 interior room planes: ceiling (y=1), floor (y=0), right (x=1), left (x=0), back wall (z=1)
        float tX = (ray.x > 0.0 ? (1.0 - ro.x) : -ro.x) * invR.x;
        float tY = (ray.y > 0.0 ? (1.0 - ro.y) : -ro.y) * invR.y;
        float tZ = 1.0 * invR.z;

        float tHit = min(min(tX, tY), tZ);
        vec3 hit = ro + ray * tHit;

        // Per-room randomized occupancy, lighting color temperature & curtain blinds
        float r1 = hash21(cellId);
        float r2 = hash21(cellId + 71.3);
        float r3 = hash21(cellId + 193.7);
        float litProb = mix(0.05, 0.36, uNight);
        float isLit = smoothstep(1.0 - litProb - 0.06, 1.0 - litProb + 0.06, r1);
        float brightnessVar = 0.55 + 0.65 * hash21(cellId + vec2(37.2, 81.9));

        // Interior surface albedo & lighting depending on which plane was hit
        vec3 wallCol = mix(vec3(0.56, 0.55, 0.52), vec3(0.44, 0.48, 0.52), r2);
        vec3 lightTint = mix(vec3(0.84, 0.91, 1.0), vec3(1.0, 0.80, 0.54), step(1.0 - uWarmRatio, r2));

        vec3 interiorCol = vec3(0.0);
        if (tHit == tY && ray.y > 0.0) {
          float panelX = smoothstep(0.20, 0.26, hit.x) * (1.0 - smoothstep(0.74, 0.80, hit.x));
          float panelZ = smoothstep(0.24, 0.32, hit.z) * (1.0 - smoothstep(0.68, 0.76, hit.z));
          float ledPanel = panelX * panelZ;
          interiorCol = wallCol * 0.38 + lightTint * ledPanel * 1.45;
        } else if (tHit == tY && ray.y <= 0.0) {
          float rug = smoothstep(0.18, 0.25, hit.x) * (1.0 - smoothstep(0.75, 0.82, hit.x));
          interiorCol = mix(vec3(0.20, 0.18, 0.16), vec3(0.28, 0.27, 0.25), rug) * (0.42 + 0.58 * (1.0 - hit.z * 0.5));
        } else if (tHit == tZ) {
          float art = smoothstep(0.32, 0.35, hit.x) * (1.0 - smoothstep(0.65, 0.68, hit.x))
                    * smoothstep(0.42, 0.45, hit.y) * (1.0 - smoothstep(0.74, 0.77, hit.y));
          float desk = step(hit.y, 0.28) * step(0.18, hit.x) * step(hit.x, 0.82);
          interiorCol = wallCol * (0.45 + 0.32 * hit.y);
          interiorCol = mix(interiorCol, vec3(0.16, 0.18, 0.21), art * 0.60);
          interiorCol = mix(interiorCol, vec3(0.12, 0.11, 0.10), desk * 0.70);
        } else {
          interiorCol = wallCol * (0.38 + 0.36 * hit.y) * (1.0 - hit.z * 0.46);
        }

        // Depth ambient occlusion inside room + realistic dark Venetian blinds
        float roomAO = 1.0 - 0.54 * hit.z;
        float blindDrop = 0.58 + r3 * 0.38;
        float hasBlind = step(0.38, r3) * smoothstep(blindDrop - 0.03, blindDrop + 0.03, f.y);
        float slat = 0.72 + 0.28 * sin(f.y * 130.0);

        vec3 litInterior = interiorCol * lightTint * roomAO * mix(0.04, 0.92 * brightnessVar, isLit);
        litInterior += wallCol * 0.05 * (1.0 - uNight) * roomAO;
        litInterior = mix(litInterior, vec3(0.38, 0.37, 0.35) * slat * mix(0.16, 0.62, isLit), hasBlind * 0.82);

        // Photorealistic High-Reflectance Architectural Curtain-Wall Glass (Saigon Centre / Deutsches Haus look!)
        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float baseF0 = mix(0.46, 0.24, uNight);
        float fresnel = baseF0 + (0.96 - baseF0) * pow(1.0 - ndotv, 2.8);
        // Subtle tempered-glass micro-bow distortion per pane
        vec3 R = reflect(-V, normalize(N + tangent * (paneVar - 0.5) * 0.048 + vec3(0.0, (r2 - 0.5) * 0.018, 0.0)));
        float skyH = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);

        // Reflected realistic hazy sky + cloud structure + darker urban lower hemisphere
        vec3 zenithCol = mix(mix(vec3(0.24, 0.40, 0.58), vec3(0.32, 0.36, 0.40), uRain * 0.65), vec3(0.025, 0.038, 0.075), uNight);
        vec3 lowerUrban = mix(vec3(0.16, 0.17, 0.18), vec3(0.035, 0.038, 0.050), uNight);
        float cloudRefl = smoothstep(0.35, 0.78, sin(R.x * 7.5 + R.z * 5.2) * cos(R.y * 9.0 + R.x * 3.1) * 0.5 + 0.5);
        vec3 skyRefl = mix(uSkyHorizon * 1.05, zenithCol, smoothstep(0.46, 0.92, skyH));
        skyRefl = mix(skyRefl, uSkyHorizon * 1.18, cloudRefl * 0.24 * (1.0 - uNight));
        vec3 envRefl = mix(lowerUrban, skyRefl, smoothstep(0.38, 0.54, skyH));
        float cityBands = sin(R.x * 26.0 + vWorldPos.x * 0.06) * sin(R.y * 48.0) * 0.5 + 0.5;
        envRefl += vec3(0.24, 0.17, 0.10) * (1.0 - smoothstep(0.32, 0.54, skyH)) * cityBands * uNight * 0.52;
        envRefl *= (0.86 + paneVar * 0.24);
        // Crisp sunlight specular glare on glass panels
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 140.0) * (1.0 - uNight) * (1.0 - uRain * 0.75) * 1.35;
        vec3 glassSurface = mix(litInterior * mix(vec3(1.0), uGlassTint, 0.48), envRefl * mix(vec3(0.88), uGlassTint, 0.62), fresnel) + vec3(1.0, 0.95, 0.88) * spec;

        // Aluminum mullion & concrete spandrel shading with realistic height grime
        float ndotl = max(dot(N, uSunDir), 0.0);
        float grime = smoothstep(14.0, 0.0, vWorldPos.y) * 0.22;
        vec3 frameShaded = uMullionCol * (1.0 - grime) * (mix(0.36, 0.10, uNight) + ndotl * (1.0 - uNight) * 0.78)
                         + envRefl * 0.20 * fresnel;

        vec3 finalCol = mix(glassSurface, frameShaded, isFrame);
        finalCol = mix(finalCol, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });

  return {
    material,
    setAtmosphere: (nightFactor, sunDir, fogColor, fogDensity, skyHorizon, rainIntensity = 0.36) => {
      material.uniforms.uNight.value = nightFactor;
      material.uniforms.uRain.value = rainIntensity;
      material.uniforms.uSunDir.value.copy(sunDir);
      material.uniforms.uFogColor.value.copy(fogColor);
      material.uniforms.uFogDensity.value = fogDensity;
      if (skyHorizon) material.uniforms.uSkyHorizon.value.copy(skyHorizon);
      else material.uniforms.uSkyHorizon.value.copy(fogColor);
    },
  };
}

// =============================================================================
// 2. GTA 6-LEVEL 3D INSTANCED WIND-SWAYING TROPICAL GRASS FIELD (1 DRAW CALL!)
// =============================================================================
export interface GrassRegion {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y?: number;
  density: number; // tufts per 100 m²
  scale?: number;
  excludeCircle?: { x: number; z: number; r: number };
}

export interface RealisticGrassHandle {
  mesh: T.InstancedMesh;
  update: (elapsed: number, windStrength: number) => void;
  dispose: () => void;
}

/** Create a fine, natural 9-blade tropical grass clump with soft ground-blended normals & organic Saigon colors */
function createCurvedGrassTuftGeo(): T.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const bladeCount = 9;
  const segs = 3;
  // Photorealistic earthy tropical turf palette (zero cartoon neon green!)
  const rootCol = new T.Color(0x162011); // shaded damp earth root
  const midCol = new T.Color(0x2f4621);  // natural tropical olive-emerald
  const tipCol = new T.Color(0x556c34);  // muted sunlit grass tip
  const tmpCol = new T.Color();

  let vOffset = 0;
  for (let b = 0; b < bladeCount; b++) {
    const yaw = (b / bladeCount) * Math.PI * 2 + (b % 3) * 0.29;
    const ca = Math.cos(yaw);
    const sa = Math.sin(yaw);
    const px = -sa;
    const pz = ca;

    const ringOff = (b % 3) * 0.055 + 0.015;
    const h = 0.19 + (b % 4) * 0.055;     // natural manicured park grass height (19-35cm, not giant weeds!)
    const w0 = 0.022 + (b % 2) * 0.008;   // fine slender grass blades!
    const bend = 0.08 + (b % 3) * 0.045;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = w0 * (1.0 - t * 0.94);
      const y = h * t - bend * t * t * 0.22;
      const out = ringOff + bend * t * t;

      if (t < 0.5) tmpCol.copy(rootCol).lerp(midCol, t * 2);
      else tmpCol.copy(midCol).lerp(tipCol, (t - 0.5) * 2);

      const cx = ca * out;
      const cz = sa * out;
      positions.push(cx - px * w, y, cz - pz * w);
      positions.push(cx + px * w, y, cz + pz * w);

      // Soft ground-blended upward normals eliminate harsh dark polygon facets completely!
      normals.push(ca * 0.14, 0.98, sa * 0.14, ca * 0.14, 0.98, sa * 0.14);
      colors.push(tmpCol.r, tmpCol.g, tmpCol.b, tmpCol.r, tmpCol.g, tmpCol.b);
    }

    for (let s = 0; s < segs; s++) {
      const i0 = vOffset + s * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;
      indices.push(i0, i1, i2, i1, i3, i2);
    }
    vOffset += (segs + 1) * 2;
  }

  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return geo;
}

export function buildRealisticGrassField(regions: GrassRegion[], software: boolean): RealisticGrassHandle {
  const densityScale = software ? 0.25 : 1.0;
  let rng = 884217;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  // Pre-generate clump transforms
  const matrices: T.Matrix4[] = [];
  const tints: T.Color[] = [];
  const dummy = new T.Object3D();
  const cA = new T.Color(0x98c47a);
  const cB = new T.Color(0xcce29e);
  const cC = new T.Color(0x7ca860);

  for (const r of regions) {
    const area = Math.abs((r.x1 - r.x0) * (r.z1 - r.z0));
    const count = Math.min(8000, Math.max(12, Math.floor((area / 100) * r.density * densityScale)));
    const baseY = r.y ?? 0.03;
    const baseScale = r.scale ?? 1.0;

    for (let i = 0; i < count; i++) {
      const x = r.x0 + rand() * (r.x1 - r.x0);
      const z = r.z0 + rand() * (r.z1 - r.z0);
      if (r.excludeCircle) {
        const dx = x - r.excludeCircle.x;
        const dz = z - r.excludeCircle.z;
        if (dx * dx + dz * dz < r.excludeCircle.r * r.excludeCircle.r) continue;
      }
      // Subtle organic clumping wave (natural lawn patches!)
      const patch = 0.72 + 0.56 * Math.sin(x * 0.14) * Math.cos(z * 0.13);
      const s = baseScale * (0.65 + rand() * 0.85) * patch;
      dummy.position.set(x, baseY, z);
      dummy.rotation.set((rand() - 0.5) * 0.12, rand() * Math.PI * 2, (rand() - 0.5) * 0.12);
      dummy.scale.set(s * (0.9 + rand() * 0.35), s * (0.75 + rand() * 0.55), s * (0.9 + rand() * 0.35));
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());

      const tint = new T.Color().copy(rand() < 0.5 ? cA : cB).lerp(cC, rand() * 0.45);
      tints.push(tint);
    }
  }

  const geo = createCurvedGrassTuftGeo();
  const windUniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } };
  const mat = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.76,
    metalness: 0.0,
    side: T.DoubleSide,
  });

  // GPU rolling grass wind waves (zero CPU matrix updates!)
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime, uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         float bendH = clamp(position.y * 2.2, 0.0, 1.0);
         float wave = sin(uTime * 2.3 + instPos.x * 0.35 + instPos.z * 0.25)
                    + 0.45 * cos(uTime * 3.7 + instPos.x * 0.8 - instPos.z * 0.5);
         transformed.x += wave * bendH * bendH * (0.045 + uWind * 0.09);
         transformed.z += wave * 0.45 * bendH * bendH * (0.03 + uWind * 0.06);`,
      );
  };

  const mesh = new T.InstancedMesh(geo, mat, matrices.length);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  for (let i = 0; i < matrices.length; i++) {
    mesh.setMatrixAt(i, matrices[i]);
    mesh.setColorAt(i, tints[i]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();

  return {
    mesh,
    update: (elapsed, windStrength) => {
      windUniforms.uTime.value = elapsed;
      windUniforms.uWind.value = windStrength;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Rich photorealistic dark organic soil + mossy clover/grass turf base material (replaces flat green!) */
export function createLushSoilGrassGroundMaterial(repeatX = 28, repeatY = 26): T.MeshStandardMaterial {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;

  // Deep organic tropical soil & mossy turf underlayer
  ctx.fillStyle = "#263a1c";
  ctx.fillRect(0, 0, 512, 512);

  let rng = 55102;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 4294967296;
  };

  // Earthy soil patches & clover variations
  for (let i = 0; i < 650; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const rad = 6 + rand() * 24;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const kind = rand();
    if (kind < 0.25) {
      g.addColorStop(0, "rgba(42, 34, 22, 0.42)"); // damp dark soil patch
    } else if (kind < 0.65) {
      g.addColorStop(0, "rgba(54, 88, 34, 0.45)"); // rich emerald clover
    } else {
      g.addColorStop(0, "rgba(86, 118, 46, 0.34)"); // warm sunlit grass patch
    }
    g.addColorStop(1, "rgba(38, 58, 28, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine high-frequency grass blade micro-texture
  for (let i = 0; i < 6000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const a = rand() * Math.PI * 2;
    const len = 3 + rand() * 7;
    ctx.strokeStyle = rand() < 0.5 ? "rgba(22, 42, 16, 0.55)" : "rgba(104, 142, 58, 0.42)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = 8;

  return new T.MeshStandardMaterial({
    map,
    roughness: 0.94,
    metalness: 0.0,
  });
}

// =============================================================================
// 3. 3D VIETNAMESE SHOPHOUSE ARCHITECTURAL RELIEF (MÁI HIÊN, BALCONIES, AC, PLINTH)
// =============================================================================
let cachedAwningMats: T.MeshStandardMaterial[] | null = null;
let cachedMetalDarkMat: T.MeshStandardMaterial | null = null;
let cachedAcMat: T.MeshStandardMaterial | null = null;
let cachedGrimePlinthMat: T.MeshStandardMaterial | null = null;

function ensureShophouseDetailMats() {
  if (cachedAwningMats) return;
  const palettes: [string, string][] = [
    ["#5a342c", "#b8afa4"], // sun-bleached dusty terracotta & aged cream
    ["#2b3e52", "#aeb4b8"], // weathered slate-navy & dusty grey
    ["#2f473c", "#b8b4a8"], // sun-faded dusty forest green & aged cream
    ["#684c32", "#b8b2a6"], // weathered ochre-brown & dusty cream
  ];
  cachedAwningMats = palettes.map(([c1, c2]) => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    for (let x = 0; x < 128; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x, 0, 16, 128);
    }
    // Weathered grime gradient toward lower valance edge
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(25,20,16,0.18)");
    g.addColorStop(0.75, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(20,18,15,0.38)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(3, 1);
    return new T.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.04, side: T.DoubleSide });
  });
  cachedMetalDarkMat = new T.MeshStandardMaterial({ color: 0x262a2e, roughness: 0.55, metalness: 0.65 });
  cachedAcMat = new T.MeshStandardMaterial({ color: 0xc2c0b8, roughness: 0.68, metalness: 0.25 });
  cachedGrimePlinthMat = new T.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.92, metalness: 0.02 });
}

export function addVietnameseShophouseRelief(
  parent: T.Group,
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
  facing: "+z" | "-z" | "+x" | "-x",
  seed: number,
  skipParapet = false,
) {
  ensureShophouseDetailMats();
  const isZ = facing === "+z" || facing === "-z";
  const sign = facing === "+z" || facing === "+x" ? 1 : -1;
  const span = isZ ? w : d;
  const halfDepth = (isZ ? d : w) * 0.5;

  // Build in local space where +Z is the street-facing front, then rotate/place cleanly!
  const g = new T.Group();
  g.position.set(x, 0, z);
  if (facing === "-z") g.rotation.y = Math.PI;
  else if (facing === "+x") g.rotation.y = Math.PI / 2;
  else if (facing === "-x") g.rotation.y = -Math.PI / 2;

  // 1. Dark weathered moisture/grime wall-base plinth trim (grounds building into sidewalk!)
  const plinth = new T.Mesh(
    new T.BoxGeometry(span + 0.04, 0.42, halfDepth * 2 + 0.08),
    cachedGrimePlinthMat!,
  );
  plinth.position.set(0, 0.21, 0);
  g.add(plinth);

  // 2. Rooftop architectural concrete parapet coping lip (optional so slanted roofs never clip it!)
  if (!skipParapet) {
    const parapet = new T.Mesh(
      new T.BoxGeometry(span + 0.08, 0.36, halfDepth * 2 + 0.14),
      cachedGrimePlinthMat!,
    );
    parapet.position.set(0, h + 0.14, 0);
    g.add(parapet);
  }

  // 3. 3D Slanted Striped Vietnamese Awning ("Mái Hiên Di Động") strictly on the street-facing front (+Z local)
  const awningMat = cachedAwningMats![Math.abs(seed) % cachedAwningMats!.length];
  const awningDepth = 1.45;
  const awning = new T.Mesh(new T.BoxGeometry(span * 0.88, 0.06, awningDepth), awningMat);
  awning.position.set(0, 3.28, halfDepth + awningDepth * 0.48);
  awning.rotation.x = 0.24;
  g.add(awning);

  // Steel awning support brackets
  for (const sx of [-span * 0.38, span * 0.38]) {
    const strut = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 1.25), cachedMetalDarkMat!);
    strut.position.set(sx, 3.02, halfDepth + 0.58);
    strut.rotation.x = -0.34;
    g.add(strut);
  }

  // 4. Cantilevered upper floor Vietnamese balcony slab + wrought-iron railing (for every floor >= 2)
  const floors = Math.max(1, Math.floor((h - 0.8) / 3.1));
  for (let f = 1; f < floors; f++) {
    const balcY = 3.6 + (f - 1) * 3.05;
    if (balcY + 1.4 > h) break;
    const balcSlab = new T.Mesh(new T.BoxGeometry(span * 0.84, 0.16, 0.88), cachedAcMat!);
    balcSlab.position.set(0, balcY, halfDepth + 0.44);
    g.add(balcSlab);

    const railTop = new T.Mesh(new T.BoxGeometry(span * 0.84, 0.05, 0.05), cachedMetalDarkMat!);
    railTop.position.set(0, balcY + 0.92, halfDepth + 0.86);
    g.add(railTop);

    const railMid = new T.Mesh(new T.BoxGeometry(span * 0.84, 0.035, 0.035), cachedMetalDarkMat!);
    railMid.position.set(0, balcY + 0.46, halfDepth + 0.86);
    g.add(railMid);

    // Side rails & pickets
    for (const px of [-span * 0.41, -span * 0.2, 0, span * 0.2, span * 0.41]) {
      const post = new T.Mesh(new T.BoxGeometry(0.035, 0.9, 0.035), cachedMetalDarkMat!);
      post.position.set(px, balcY + 0.46, halfDepth + 0.86);
      g.add(post);
    }
    for (const sx of [-span * 0.41, span * 0.41]) {
      const sideRail = new T.Mesh(new T.BoxGeometry(0.04, 0.04, 0.86), cachedMetalDarkMat!);
      sideRail.position.set(sx, balcY + 0.92, halfDepth + 0.44);
      g.add(sideRail);
    }

    // 5. Wall-mounted 3D outdoor AC condenser unit ("cục nóng máy lạnh") tucked cleanly on side of balcony
    if (f === 1) {
      const acSide = seed % 2 === 0 ? 1 : -1;
      const ac = new T.Mesh(new T.BoxGeometry(0.72, 0.52, 0.34), cachedAcMat!);
      ac.position.set(acSide * (span * 0.34), balcY + 1.55, halfDepth + 0.2);
      g.add(ac);
    }
  }

  void sign;
  parent.add(g);
}

// =============================================================================
// 4. SOFT FRESNEL VOLUMETRIC STREETLAMP MIST CONE SHADER (ZERO HARD CONE EDGES!)
// =============================================================================
export function createSoftVolumetricLampHaloMaterial(): T.ShaderMaterial {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
    uniforms: {
      uColor: { value: new T.Color(0xffcf88) },
      uOpacity: { value: 0.16 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewW = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uTime;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vViewW;
      void main() {
        // Silky view-angle Fresnel edge fade so cone silhouette completely vanishes!
        float edge = pow(abs(dot(normalize(vNormalW), normalize(vViewW))), 2.1);
        // Smooth vertical beam falloff (bright near luminaire vUv.y=1 -> fades cleanly before ground vUv.y=0)
        float vert = smoothstep(0.0, 0.42, vUv.y) * smoothstep(1.0, 0.86, vUv.y) * pow(vUv.y, 0.85);
        // Subtle humid mist drift inside beam
        float mist = 0.84 + 0.16 * sin(vUv.x * 12.56 + uTime * 0.8 + vUv.y * 5.0);
        float alpha = edge * vert * mist * uOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor * (0.9 + 0.35 * vUv.y), alpha);
      }
    `,
  });
}

// =============================================================================
// 5. GPU-ANIMATED SAIGON DIGITAL LED BILLBOARD SHADER (DISTRICT 1 INTERSECTIONS!)
// =============================================================================
export function createAnimatedLedBillboardMaterial(spec: {
  headline: string;
  subline: string;
  accentA: string;
  accentB: string;
  badge: string;
}): T.ShaderMaterial {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, "#0b1322");
  grad.addColorStop(0.55, spec.accentA);
  grad.addColorStop(1, "#0d1626");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle architectural geometric accent arcs
  ctx.strokeStyle = spec.accentB;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(430, 128, 95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(430, 128, 130, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Top badge pill
  ctx.fillStyle = spec.accentB;
  ctx.beginPath();
  ctx.roundRect(28, 24, 178, 34, 6);
  ctx.fill();
  ctx.fillStyle = "#09101c";
  ctx.font = "800 18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(spec.badge, 117, 47);

  // Bold Vietnamese headline & subline
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 46px sans-serif";
  ctx.fillText(spec.headline, 28, 132);
  ctx.fillStyle = "#e2eef8";
  ctx.font = "600 24px sans-serif";
  ctx.fillText(spec.subline, 28, 182);

  // Bottom neon ticker bar
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 214, 512, 42);
  ctx.fillStyle = spec.accentB;
  ctx.font = "700 18px monospace";
  ctx.fillText("TP. HỒ CHÍ MINH · QUẬN 1 · SÀI GÒN 24/7", 28, 241);

  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;

  return new T.ShaderMaterial({
    uniforms: {
      tBase: { value: tex },
      uTime: { value: 0 },
      uNight: { value: 0.9 },
      uAccent: { value: new T.Color(spec.accentB) },
      uFogColor: { value: new T.Color(0x1d1a26) },
      uFogDensity: { value: 0.0022 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFogDepth;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tBase;
      uniform float uTime, uNight, uFogDensity;
      uniform vec3 uAccent, uFogColor;
      varying vec2 vUv;
      varying float vFogDepth;
      void main() {
        vec2 uv = vUv;
        // Subtle ticker scroll on bottom 16% band!
        if (uv.y < 0.165) {
          uv.x = fract(uv.x + uTime * 0.085);
        }
        vec3 base = texture2D(tBase, uv).rgb;
        // Dynamic diagonal light sheen sweeping across LED billboard
        float sweep = smoothstep(0.0, 0.14, 0.14 - abs(fract(vUv.x * 0.7 - vUv.y * 0.25 - uTime * 0.18) - 0.5));
        // Authentic outdoor LED pixel-pitch matrix micro-grid
        float ledPitch = 0.88 + 0.12 * sin(vUv.x * 260.0) * sin(vUv.y * 130.0);
        float boost = mix(0.85, 1.48, uNight);
        vec3 col = (base + uAccent * sweep * 0.28) * ledPitch * boost;
        float fogFactor = 1.0 - exp(-pow(vFogDepth * uFogDensity, 2.0));
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

