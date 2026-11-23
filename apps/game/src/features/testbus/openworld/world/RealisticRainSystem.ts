/**
 * Photorealistic GPU-Driven Tropical Rain & Splash System for Ho Chi Minh City Open World
 * Inspired by:
 *  - ektogamat/threejs-conference ("Threejs-Punk": collision-rain & wet-ground ripples)
 *  - frmlinn/raindrops-v2 (GPU cylindrical velocity-aligned instanced billboard streaks)
 *
 * Tuned for photographic realism (GTA 6 / real night rain photography):
 *  - Razor-thin (2.5-4.5mm), long motion-blurred water threads using NormalBlending (NO glowing white sticks!)
 *  - Subtle light-catching sheen near sky & warm amber streetlamps, fading naturally into shadow
 *  - Tiny delicate ground splash micro-mist & hairline ripples (5-9cm, NO giant bright white sticker circles!)
 *  - 100% GPU vertex/fragment shaders in 3 draw calls, ZERO per-frame CPU particle updates.
 */
import * as T from "three";
import { ROOM_ANCHOR } from "./boardingHouse";
import { ROOM } from "../room/apartment";
import { KhuphoRain } from "./KhuphoRain";

export class RealisticRainSystem {
  private root = new T.Group();
  private streaks: KhuphoRain;
  private readonly windVec = new T.Vector2();
  private splashMesh: T.Mesh;
  private splashMat: T.ShaderMaterial;
  private mistMesh: T.Mesh;
  private mistMat: T.ShaderMaterial;

  constructor(scene: T.Scene, software: boolean) {
    this.root.name = "AAARealisticRainSystem";
    scene.add(this.root);

    const roomMin = new T.Vector3(ROOM_ANCHOR.x + ROOM.x0 - 0.35, ROOM_ANCHOR.y - 0.2, ROOM_ANCHOR.z + ROOM.z0 - 0.35);
    const roomMax = new T.Vector3(ROOM_ANCHOR.x + ROOM.x1 + 0.35, ROOM_ANCHOR.y + 3.4, ROOM_ANCHOR.z + ROOM.z1 + 0.35);

    // 1. KHUPHO RAIN STREAKS (1 DRAW CALL, see KhuphoRain.ts)
    this.streaks = new KhuphoRain(software ? 1800 : 7000, roomMin, roomMax);
    this.root.add(this.streaks.object);
    const baseQuad = new T.PlaneGeometry(1, 1);
    let rng = 20260711;
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0;
      return rng / 4294967296;
    };

    // =========================================================================
    // 2. DELICATE REALISTIC MICRO-SPLASH MIST & HAIRLINE RIPPLES (1 DRAW CALL!)
    // =========================================================================
    const splashCount = software ? 200 : 750;
    const splashGeo = new T.InstancedBufferGeometry();
    splashGeo.index = baseQuad.index;
    splashGeo.attributes.position = baseQuad.attributes.position;
    splashGeo.attributes.uv = baseQuad.attributes.uv;
    splashGeo.instanceCount = splashCount;

    const spOffsets = new Float32Array(splashCount * 3);
    const spSeeds = new Float32Array(splashCount * 2);
    const spArea = 26.0;
    for (let i = 0; i < splashCount; i++) {
      spOffsets[i * 3] = rand() * spArea;
      spOffsets[i * 3 + 1] = rand() * spArea;
      spOffsets[i * 3 + 2] = 2.6 + rand() * 2.4; // crisp rapid splash lifetime (~0.25-0.38s!)
      spSeeds[i * 2] = rand();
      spSeeds[i * 2 + 1] = rand();
    }
    splashGeo.setAttribute("aSpOff", new T.InstancedBufferAttribute(spOffsets, 3));
    splashGeo.setAttribute("aSpSeed", new T.InstancedBufferAttribute(spSeeds, 2));
    splashGeo.boundingSphere = new T.Sphere(new T.Vector3(), 10000);

    this.splashMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.NormalBlending, // Delicate translucent water splash — NEVER bright white sticker donuts!
      side: T.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: new T.Vector3() },
        uRain: { value: 0.4 },
        uNight: { value: 0.9 },
        uArea: { value: spArea },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSpOff;
        attribute vec2 aSpSeed;

        uniform float uTime, uRain, uArea;
        uniform vec3 uCamPos;

        varying vec2 vUv;
        varying float vLife;
        varying float vAlpha;

        void main() {
          vUv = uv;
          if (aSpSeed.y > uRain * 1.05) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vAlpha = 0.0;
            vLife = 1.0;
            return;
          }

          float cycle = uTime * aSpOff.z + aSpSeed.x * 19.3;
          float life = fract(cycle);
          float id = floor(cycle);
          vLife = life;

          vec2 jitter = vec2(
            fract(sin(id * 127.1 + aSpSeed.x * 311.7) * 43758.5453),
            fract(sin(id * 269.5 + aSpSeed.y * 183.3) * 43758.5453)
          ) * uArea;

          vec2 origin = uCamPos.xz - vec2(uArea * 0.5);
          vec2 xz = origin + mod(aSpOff.xy + jitter - origin, uArea);

          // Sheltered under Dãy Trọ roof/balcony/stairs & bus canopy
          bool underRoof = (xz.x >= 13.0 && xz.x <= 32.0 && xz.y >= -19.5 && xz.y <= -12.0)
                        || (xz.x >= 0.4 && xz.x <= 3.6 && xz.y >= -5.2 && xz.y <= 4.4);
          if (underRoof) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vAlpha = 0.0;
            return;
          }

          float groundY = (xz.x >= 0.0 || xz.x <= -12.8) ? 0.172 : 0.022;
          // Realistic micro-scale splash (4cm -> 8.5cm) as vertical camera-facing mist crown!
          vec3 center = vec3(xz.x, groundY + 0.022 + life * 0.032, xz.y);
          vec3 toCam = normalize(cameraPosition - center);
          vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
          float w = 0.045 + life * 0.055;
          float h = (0.04 + sin(life * 3.14159) * 0.055);

          vec3 worldPos = center + right * (position.x * w) + vec3(0.0, position.y * h, 0.0);

          float dist = length(cameraPosition.xz - xz);
          float nearF = smoothstep(0.8, 2.0, dist);
          float farF = 1.0 - smoothstep(5.5, uArea * 0.46, dist);
          vAlpha = nearF * farF * sin(life * 3.14159) * (0.08 + uRain * 0.14);

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        varying vec2 vUv;
        varying float vLife;
        varying float vAlpha;

        void main() {
          if (vAlpha <= 0.002) discard;
          // Soft microscopic water spray puff (4-5 scattered sub-droplet glints fading smoothly!)
          vec2 p = vUv * 2.0 - 1.0;
          float puff = exp(-dot(p, p) * 3.2);
          float d1 = exp(-dot(p - vec2(-0.32 * vLife, 0.15 * vLife), p - vec2(-0.32 * vLife, 0.15 * vLife)) * 28.0);
          float d2 = exp(-dot(p - vec2( 0.28 * vLife, 0.22 * vLife), p - vec2( 0.28 * vLife, 0.22 * vLife)) * 28.0);
          float d3 = exp(-dot(p - vec2( 0.02, 0.35 * (1.0 - vLife)), p - vec2( 0.02, 0.35 * (1.0 - vLife))) * 32.0);
          float mask = puff * 0.42 + (d1 + d2 + d3) * 0.55;

          vec3 col = mix(vec3(0.78, 0.82, 0.86), vec3(0.38, 0.44, 0.54), uNight);
          gl_FragColor = vec4(col, mask * vAlpha);
        }
      `,
    });

    this.splashMesh = new T.Mesh(splashGeo, this.splashMat);
    this.splashMesh.frustumCulled = false;
    this.splashMesh.renderOrder = 9;
    this.root.add(this.splashMesh);

    // =========================================================================
    // 3. VOLUMETRIC DRIFTING MONSOON RAIN-CURTAIN HAZE (1 DRAW CALL!)
    // =========================================================================
    const mistCount = software ? 10 : 28;
    const mistGeo = new T.InstancedBufferGeometry();
    mistGeo.index = baseQuad.index;
    mistGeo.attributes.position = baseQuad.attributes.position;
    mistGeo.attributes.uv = baseQuad.attributes.uv;
    mistGeo.instanceCount = mistCount;

    const mOff = new Float32Array(mistCount * 4);
    for (let i = 0; i < mistCount; i++) {
      mOff[i * 4] = (rand() - 0.5) * 46;
      mOff[i * 4 + 1] = 2.6 + rand() * 6.0;
      mOff[i * 4 + 2] = (rand() - 0.5) * 46;
      mOff[i * 4 + 3] = rand();
    }
    mistGeo.setAttribute("aMist", new T.InstancedBufferAttribute(mOff, 4));
    mistGeo.boundingSphere = new T.Sphere(new T.Vector3(), 10000);

    this.mistMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: new T.Vector3() },
        uRain: { value: 0.4 },
        uNight: { value: 0.9 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aMist;
        uniform float uTime, uRain;
        uniform vec3 uCamPos;
        varying vec2 vUv;
        varying float vAlpha;

        void main() {
          vUv = uv;
          float area = 46.0;
          vec2 drift = vec2(uTime * (2.4 + aMist.w * 1.4), uTime * 0.7);
          vec2 origin = uCamPos.xz - vec2(area * 0.5);
          vec2 xz = origin + mod(aMist.xz + drift - origin, area);

          if (xz.x >= 16.0 && xz.x <= 28.0 && xz.y >= -20.0 && xz.y <= -12.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vAlpha = 0.0;
            return;
          }

          vec3 center = vec3(xz.x, aMist.y, xz.y);
          vec3 toCam = normalize(cameraPosition - center);
          vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
          vec3 up = vec3(0.0, 1.0, 0.0);

          float sz = 8.5 + aMist.w * 6.5;
          vec3 worldPos = center + right * position.x * sz + up * position.y * (sz * 0.65);

          float dist = length(cameraPosition - center);
          float nearF = smoothstep(6.5, 13.0, dist);
          float farF = 1.0 - smoothstep(15.0, 23.0, dist);
          vAlpha = nearF * farF * smoothstep(0.25, 1.0, uRain) * 0.065;

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.001) discard;
          vec2 p = vUv * 2.0 - 1.0;
          float soft = exp(-dot(p, p) * 2.6);
          vec3 col = mix(vec3(0.72, 0.76, 0.80), vec3(0.18, 0.22, 0.30), uNight);
          gl_FragColor = vec4(col, soft * vAlpha);
        }
      `,
    });

    this.mistMesh = new T.Mesh(mistGeo, this.mistMat);
    this.mistMesh.frustumCulled = false;
    this.mistMesh.renderOrder = 8;
    this.root.add(this.mistMesh);

    baseQuad.dispose();
  }

  update(
    elapsed: number,
    camPos: T.Vector3,
    rainIntensity: number,
    windStrength: number,
    nightFactor: number,
    lightningFlash: number,
  ) {
    const active = rainIntensity > 0.03;
    this.root.visible = active;
    if (!active) return;

    const wx = (0.8 + windStrength * 3.2) * (0.75 + 0.25 * Math.sin(elapsed * 0.65));
    const wz = (0.3 + windStrength * 1.4) * Math.cos(elapsed * 0.45);

    this.windVec.set(wx, wz);
    this.streaks.update(elapsed, camPos, rainIntensity, this.windVec, nightFactor, lightningFlash);

    this.splashMat.uniforms.uTime.value = elapsed;
    this.splashMat.uniforms.uCamPos.value.copy(camPos);
    this.splashMat.uniforms.uRain.value = rainIntensity;
    this.splashMat.uniforms.uNight.value = nightFactor;

    this.mistMesh.visible = rainIntensity > 0.25;
    if (this.mistMesh.visible) {
      this.mistMat.uniforms.uTime.value = elapsed;
      this.mistMat.uniforms.uCamPos.value.copy(camPos);
      this.mistMat.uniforms.uRain.value = rainIntensity;
      this.mistMat.uniforms.uNight.value = nightFactor;
    }
  }

  setVisible(visible: boolean) {
    this.root.visible = visible;
  }

  dispose() {
    this.streaks.dispose();
    this.splashMesh.geometry.dispose();
    this.splashMat.dispose();
    this.mistMesh.geometry.dispose();
    this.mistMat.dispose();
  }
}
