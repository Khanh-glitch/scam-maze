import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { SURVEY } from "../simulation/survey462";
import { driveTexture } from "../simulation/drive-look";
import { ROOM_ANCHOR, type PooledLightSpec } from "./boardingHouse";
import { RealisticRainSystem } from "./RealisticRainSystem";

export type WeatherPreset = "clear" | "overcast" | "drizzle" | "monsoon";

export interface AtmosphereState {
  timeOfDay: number; // 0..24 hours
  autoCycle: boolean;
  cycleSpeed: number; // game minutes per real second
  weather: WeatherPreset;
  rainIntensity: number; // 0..1
  wetness: number; // 0..1
  windStrength: number; // 0..1
  nightFactor: number; // 0..1 (0 = bright noon, 1 = deep night)
  sunElevation: number; // -1..1
  lightningFlash: number; // 0..1
}

const WEATHER_TARGETS: Record<WeatherPreset, { rain: number; wet: number; wind: number; clouds: number }> = {
  clear: { rain: 0.0, wet: 0.04, wind: 0.22, clouds: 0.18 },
  overcast: { rain: 0.0, wet: 0.3, wind: 0.48, clouds: 0.68 },
  drizzle: { rain: 0.36, wet: 0.86, wind: 0.56, clouds: 0.72 },
  monsoon: { rain: 1.0, wet: 1.0, wind: 1.0, clouds: 0.96 },
};

export class AtmosphereSystem {
  private scene: T.Scene;
  private software: boolean;
  private pmrem: T.PMREMGenerator;
  private envScene = new T.Scene();
  private envSkyMesh: T.Mesh;
  private pmremDay: T.WebGLRenderTarget | null = null;
  private pmremSunset: T.WebGLRenderTarget | null = null;
  private pmremNight: T.WebGLRenderTarget | null = null;
  private activePmremMode: "day" | "sunset" | "night" = "night";

  public skyMesh: T.Mesh;
  public skyMat: T.ShaderMaterial;
  public sunDir = new T.Vector3(0.4, -0.5, -0.7).normalize();
  public sunLight: T.DirectionalLight;
  public hemiLight: T.HemisphereLight;
  public fog: T.FogExp2;
  private rainSystem: RealisticRainSystem;
  private wetReflector: Reflector;
  private wetMat: T.ShaderMaterial;
  private poolMask: T.Texture;
  private streetLamps: T.PointLight[] = [];

  private lightningTimer = 6;
  /** Strength of the lightning flashes (embedded in the room: a soft flicker, not a white-out of the doorway). */
  public lightningScale = 1;
  private reflFrame = 0;
  private onThunder?: (intensity: number) => void;

  public state: AtmosphereState = {
    timeOfDay: 22.15, // Authentic evening/night Ho Chi Minh City ("Sau cơn mưa" baseline)
    autoCycle: true,
    cycleSpeed: 1.6, // gentle real-time progression (~1.6 game minutes / real second)
    weather: "drizzle",
    rainIntensity: 0.36,
    wetness: 0.86,
    windStrength: 0.56,
    nightFactor: 0.95,
    sunElevation: -0.5,
    lightningFlash: 0,
  };

  private cloudCover = 0.72;
  private targetRain = 0.36;
  private targetWet = 0.86;
  private targetWind = 0.56;
  private targetClouds = 0.72;
  public reflectionsEnabled = true;
  private reflectorSuppressed = false;

  // Pre-allocated scratch math objects (zero per-frame GC churn!)
  private readonly _keyDir = new T.Vector3();
  private readonly _moonDir = new T.Vector3(-0.35, 0.62, -0.68).normalize();
  private readonly _sunCol = new T.Color();
  private readonly _sunsetCol = new T.Color(0xff9248);
  private readonly _moonCol = new T.Color(0x7c97cc);
  private readonly _skyDay = new T.Color();
  private readonly _skyRain = new T.Color(0x6e7b86);
  private readonly _skyNight = new T.Color(0x2d3756);
  private readonly _gndDay = new T.Color(0x4a453c);
  private readonly _gndNight = new T.Color(0x281e1a);
  private readonly _fogDay = new T.Color();
  private readonly _fogRain = new T.Color(0x6b7780);
  private readonly _fogSunset = new T.Color(0xdc9a72);
  private readonly _fogNight = new T.Color();
  private readonly _fogNightRain = new T.Color(0x1d1a26);

  constructor(scene: T.Scene, renderer: T.WebGLRenderer, software: boolean, onThunder?: (intensity: number) => void) {
    this.scene = scene;
    this.software = software;
    this.onThunder = onThunder;
    this.pmrem = new T.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    this.fog = new T.FogExp2(0x161b26, 0.0022);
    scene.fog = this.fog;

    // 1. Physically-inspired Atmospheric Sky Dome Shader (Rayleigh + Mie + Tropical Clouds + Stars + City Glow)
    this.skyMat = new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: new T.Vector3(0.4, -0.5, -0.7).normalize() },
        uTime: { value: 0 },
        uNight: { value: 0.95 },
        uCloudCover: { value: 0.72 },
        uRain: { value: 0.36 },
        uLightning: { value: 0 },
        uZenithDay: { value: new T.Color(0x4a7eb0) },
        uHorizonDay: { value: new T.Color(0xd8e4ea) },
        uSunsetCol: { value: new T.Color(0xe6925c) },
        uZenithNight: { value: new T.Color(0x0b101b) },
        uHorizonNight: { value: new T.Color(0x23242f) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform float uTime, uNight, uCloudCover, uRain, uLightning;
        uniform vec3 uZenithDay, uHorizonDay, uSunsetCol, uZenithNight, uHorizonNight;
        varying vec3 vDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.07 + vec2(1.7, 9.2);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          float sunDot = dot(d, normalize(uSunDir));
          float sunsetBand = clamp(1.0 - abs(uSunDir.y) * 3.8, 0.0, 1.0) * (1.0 - uNight * 0.75);

          vec3 daySky = mix(uHorizonDay, uZenithDay, pow(h, 0.52));
          vec3 nightSky = mix(uHorizonNight, uZenithNight, pow(h, 0.48));
          vec3 col = mix(daySky, nightSky, uNight);

          // Golden hour / tropical sunset scattering
          float sunGlow = pow(max(sunDot, 0.0), 6.0);
          col = mix(col, uSunsetCol, sunsetBand * (0.45 * pow(1.0 - h, 2.2) + 0.55 * sunGlow));

          // Storm darkening
          vec3 stormTint = mix(vec3(0.32, 0.37, 0.42), vec3(0.05, 0.06, 0.09), uNight);
          col = mix(col, stormTint, uRain * 0.58);

          // Crisp Sun & Moon discs
          float sunDisc = smoothstep(0.9985, 0.9996, sunDot) * (1.0 - uRain * 0.85) * smoothstep(-0.08, 0.06, uSunDir.y);
          float sunHalo = pow(max(sunDot, 0.0), 48.0) * (1.0 - uRain * 0.75) * smoothstep(-0.12, 0.1, uSunDir.y);
          col += vec3(1.0, 0.92, 0.76) * (sunDisc * 5.0 + sunHalo * 0.85);

          vec3 moonDir = normalize(-uSunDir);
          float moonDot = dot(d, moonDir);
          float moonDisc = smoothstep(0.9988, 0.9996, moonDot) * uNight * (1.0 - uCloudCover * 0.75);
          col += vec3(0.75, 0.84, 1.0) * moonDisc * 1.4;

          // Subtle twinkling stars at clear night
          if (d.y > 0.08 && uNight > 0.45 && uCloudCover < 0.75) {
            vec2 sp = floor(d.xz / (d.y + 0.15) * 180.0);
            float st = hash(sp);
            float star = step(0.9965, st) * (0.5 + 0.5 * sin(uTime * 2.0 + st * 90.0));
            col += vec3(0.85, 0.9, 1.0) * star * uNight * (1.0 - uCloudCover) * smoothstep(0.08, 0.35, d.y) * 0.9;
          }

          // Volumetric-feel tropical Saigon clouds with Mie silver-lining scattering
          if (d.y > 0.02) {
            vec2 cuv = d.xz / (d.y + 0.16) * 1.35 + vec2(uTime * 0.014, uTime * 0.008);
            float c = fbm(cuv);
            float c2 = fbm(cuv * 2.1 - vec2(uTime * 0.018, -uTime * 0.011));
            float density = c * 0.72 + c2 * 0.28;
            float mask = smoothstep(1.0 - uCloudCover * 0.88, 1.0 - uCloudCover * 0.2, density);
            float silverLining = pow(max(sunDot, 0.0), 10.0) * (1.0 - mask * 0.65) * (1.0 - uNight * 0.85);
            vec3 cloudDay = mix(vec3(0.98, 0.98, 1.0), vec3(0.36, 0.41, 0.48), uRain * 0.78);
            cloudDay += vec3(1.0, 0.88, 0.68) * silverLining * 0.75;
            cloudDay = mix(cloudDay, vec3(1.0, 0.62, 0.34), sunsetBand * (0.5 + 0.5 * sunGlow));
            // Ho Chi Minh City sodium/neon urban bounce lighting the underside of clouds at night!
            vec3 cloudNight = vec3(0.13, 0.11, 0.17) + vec3(0.14, 0.08, 0.05) * pow(1.0 - h, 1.4);
            vec3 cloudCol = mix(cloudDay, cloudNight, uNight);
            cloudCol += vec3(0.75, 0.86, 1.0) * uLightning * 0.95;
            col = mix(col, cloudCol, mask * smoothstep(0.02, 0.18, d.y) * 0.9);
          }

          // Urban horizon bounce & realistic Saigon neon skyglow band
          col += vec3(0.22, 0.14, 0.10) * uNight * pow(1.0 - h, 4.8) * 0.65;
          col += vec3(0.06, 0.14, 0.22) * uNight * pow(1.0 - h, 7.5) * 0.45;
          col += vec3(0.55, 0.68, 0.95) * uLightning * 0.38;

          // Ground hemisphere bounce for PMREM reflections
          if (d.y < 0.0) {
            vec3 groundBounce = mix(vec3(0.18, 0.17, 0.15), vec3(0.05, 0.05, 0.07), uNight);
            col = mix(col, groundBounce, smoothstep(0.0, -0.25, d.y));
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyMesh = new T.Mesh(new T.SphereGeometry(920, 40, 20), this.skyMat);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -10;
    scene.add(this.skyMesh);

    // Clone sky dome into private PMREM scene for dynamic Global Illumination reflections
    this.envSkyMesh = new T.Mesh(new T.SphereGeometry(40, 24, 14), this.skyMat);
    this.envScene.add(this.envSkyMesh);

    // 2. Dynamic Sun / Moon Directional Light (snapped to 8m grid for zero-shimmer crisp contact shadows!)
    this.sunLight = new T.DirectionalLight(0xfff1dc, 2.2);
    this.sunLight.castShadow = true;
    const smSize = software ? 512 : 1024;
    this.sunLight.shadow.mapSize.set(smSize, smSize);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 115;
    const half = 26;
    this.sunLight.shadow.camera.left = -half;
    this.sunLight.shadow.camera.right = half;
    this.sunLight.shadow.camera.top = half;
    this.sunLight.shadow.camera.bottom = -half;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    scene.add(this.sunLight, this.sunLight.target);

    // 3. Hemisphere Sky/Ground GI Bounce Light
    this.hemiLight = new T.HemisphereLight(0x8bb6dc, 0x3b352c, 0.72);
    scene.add(this.hemiLight);

    // 4. Fixed Pool of 3 Outdoor PointLights (NEVER toggle .visible -> ZERO WebGL shader recompiles!)
    if (!software) {
      for (let i = 0; i < 3; i++) {
        const l = new T.PointLight(0xffc380, 0, 24, 1.8);
        scene.add(l);
        this.streetLamps.push(l);
      }
    }

    // 5. AAA GPU-Driven Rain Streaks, Ground Ripple Splashes & Monsoon Mist (3 single draw calls, ZERO CPU loop!)
    this.rainSystem = new RealisticRainSystem(scene, software);

    // 6. Planar Wet-Surface Reflection Plane with World-Space Concentric Raindrop Ripple Normals
    // (Technique adapted from ektogamat/threejs-conference wet-ground.md)
    const texLoader = new T.TextureLoader();
    this.poolMask = driveTexture(texLoader, "pool-mask", false);
    this.poolMask.wrapS = this.poolMask.wrapT = T.RepeatWrapping;

    this.wetReflector = new Reflector(new T.PlaneGeometry(SURVEY.width - 0.08, 300), {
      clipBias: 0.004,
      textureWidth: software ? 192 : 384,
      textureHeight: software ? 96 : 192,
      multisample: 0,
      color: 0x9aa4b4,
    });
    this.wetReflector.rotation.x = -Math.PI / 2;
    this.wetReflector.position.set(-SURVEY.width / 2, 0.011, -52);
    scene.add(this.wetReflector);

    this.wetMat = this.wetReflector.material as T.ShaderMaterial;
    this.wetMat.transparent = true;
    this.wetMat.depthWrite = false;
    this.wetMat.vertexShader = this.wetMat.vertexShader
      .replace("varying vec4 vUv;", "varying vec4 vUv; varying vec2 pavement;")
      .replace("vUv = textureMatrix", "pavement = position.xy; vUv = textureMatrix");
    this.wetMat.fragmentShader = this.wetMat.fragmentShader
      .replace(
        "varying vec4 vUv;",
        `varying vec4 vUv; varying vec2 pavement; uniform float uRain, uWet, uRainAmp; uniform sampler2D uMask;
        vec2 puddleRippleOffset(vec2 p, float t) {
          vec2 uv = p * 2.15;
          vec2 cell = floor(uv);
          vec2 local = fract(uv);
          vec2 offset = vec2(0.0);
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = cell + vec2(float(i), float(j));
              vec2 h = fract(sin(vec2(dot(g, vec2(127.1, 311.7)), dot(g, vec2(269.5, 183.3)))) * 43758.5453);
              float age = fract(t * (1.15 + h.x * 0.85) + h.y * 6.2831);
              vec2 d = (vec2(float(i), float(j)) + 0.18 + h * 0.64) - local;
              float dist = length(d);
              float radius = age * 0.72;
              float wave = sin((dist - radius) * 34.0) * exp(-pow((dist - radius) * 9.5, 2.0)) * (1.0 - age);
              offset += normalize(d + vec2(0.0001)) * wave;
            }
          }
          return offset;
        }`,
      )
      .replace(
        "texture2DProj( tDiffuse, vUv )",
        `texture2D(tDiffuse, vUv.xy / vUv.w +
          puddleRippleOffset(pavement, uRain) * (0.0014 + 0.0046 * uRainAmp) +
          vec2(
            0.0006 * sin(pavement.y * 42.0 + uRain * 5.0),
            0.0006 * cos(pavement.x * 29.0 + uRain * 4.2)
          ) * uRainAmp
        )`,
      )
      .replace(
        "color ), 1.0",
        `color ), uWet * (0.06 + 0.68 * smoothstep(0.24, 0.72,
          texture2D(uMask, pavement * 0.072).r * 0.66 +
          texture2D(uMask, pavement * 0.145 + 0.37).r * 0.34 +
          0.16 * smoothstep(4.6, 6.4, abs(pavement.x))
        ))`,
      );
    this.wetMat.uniforms.uRain = { value: 0 };
    this.wetMat.uniforms.uWet = { value: this.state.wetness };
    this.wetMat.uniforms.uRainAmp = { value: this.state.rainIntensity };
    this.wetMat.uniforms.uMask = { value: this.poolMask };

    const origBeforeRender = this.wetReflector.onBeforeRender.bind(this.wetReflector);
    const reflStride = this.software ? 6 : 3;
    // The puddle reflection is a 384x192 texture, so it only needs the near street. Skip everything else in that
    // extra scene pass (distant districts, alley house, skinned crowd, rain streaks, landmarks).
    const heavyHideNames = [
      "BitexcoFinancialTower",
      "Landmark81Tower",
      "ThuThiemWaterfrontAndBaSonBridge",
      "BusStationCast",
      "SaigonRiverBoatsAndSkyLife",
      "SaigonOpenWorldDistricts",
      "DayTro_462_14",
      "AAARealisticRainSystem",
    ];
    let reflHide: T.Object3D[] = [];
    let reflHideAge = Infinity;
    this.wetReflector.onBeforeRender = (...args) => {
      if (this.reflFrame++ % reflStride !== 0) return;
      // Re-resolve the hide list rarely: scene.traverse every reflection pass was a stutter source.
      if (reflHideAge++ > 240) {
        reflHideAge = 0;
        reflHide = [];
        this.scene.traverse((o) => {
          if (heavyHideNames.includes(o.name)) reflHide.push(o);
        });
      }
      const hidden: T.Object3D[] = [];
      for (const o of reflHide) {
        if (o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      }
      origBeforeRender(...args);
      for (const o of hidden) o.visible = true;
    };
    // Pre-bake 3 photographic PMREM cubemaps ONCE at boot (day, golden hour, night) -> ZERO runtime 200ms PMREM freezes!
    this.bakeStaticPMREMs();
    this.applyLighting(0, new T.Vector3(ROOM_ANCHOR.x, ROOM_ANCHOR.y, ROOM_ANCHOR.z));
    this.selectPMREM();
  }

  private bakeStaticPMREMs() {
    const u = this.skyMat.uniforms;
    const bake = (night: number, sunY: number, clouds: number, rain: number) => {
      u.uNight.value = night;
      u.uSunDir.value.set(0.55, sunY, -0.65).normalize();
      u.uCloudCover.value = clouds;
      u.uRain.value = rain;
      return this.pmrem.fromScene(this.envScene, 0.025, 0.1, 100);
    };
    this.pmremDay = bake(0.0, 0.72, 0.25, 0.0);
    this.pmremSunset = bake(0.22, 0.06, 0.45, 0.05);
    this.pmremNight = bake(0.96, -0.5, 0.72, 0.36);
  }

  private selectPMREM() {
    const s = this.state;
    const mode: "day" | "sunset" | "night" =
      s.nightFactor > 0.58 ? "night" : Math.abs(s.sunElevation) < 0.24 ? "sunset" : "day";
    if (mode === this.activePmremMode && this.scene.environment) return;
    this.activePmremMode = mode;
    const rt = mode === "night" ? this.pmremNight : mode === "sunset" ? this.pmremSunset : this.pmremDay;
    if (rt) this.scene.environment = rt.texture;
  }

  /** Weather changes by itself: every 1.5-4 minutes the sky picks the next preset at random (never the same twice). */
  autoWeather = true;
  private weatherTimer = 0;
  private weatherStarted = false;
  private pickNextWeather(avoid: WeatherPreset | null): WeatherPreset {
    const table: [WeatherPreset, number][] = [
      ["clear", 0.3],
      ["overcast", 0.25],
      ["drizzle", 0.25],
      ["monsoon", 0.2],
    ];
    const pool = table.filter(([w]) => w !== avoid);
    const total = pool.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [w, weight] of pool) {
      r -= weight;
      if (r <= 0) return w;
    }
    return pool[pool.length - 1][0];
  }
  private updateAutoWeather(dt: number) {
    if (!this.autoWeather) return;
    if (!this.weatherStarted) {
      // The first sky of a session is random too and starts there at once, with no ramp.
      this.weatherStarted = true;
      const first = this.pickNextWeather(null);
      this.setWeather(first);
      const s = this.state;
      s.rainIntensity = this.targetRain;
      s.wetness = this.targetWet;
      s.windStrength = this.targetWind;
      this.cloudCover = this.targetClouds;
      this.weatherTimer = 90 + Math.random() * 150;
      return;
    }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.setWeather(this.pickNextWeather(this.state.weather));
      this.weatherTimer = 90 + Math.random() * 150;
    }
  }
  setWeather(preset: WeatherPreset) {
    this.weatherTimer = 90 + Math.random() * 150;
    this.state.weather = preset;
    const t = WEATHER_TARGETS[preset];
    this.targetRain = t.rain;
    this.targetWet = t.wet;
    this.targetWind = t.wind;
    this.targetClouds = t.clouds;
  }

  setTimeOfDay(hours: number) {
    this.state.timeOfDay = ((hours % 24) + 24) % 24;
  }

  setCustomWeather(rain: number, wind: number) {
    this.targetRain = T.MathUtils.clamp(rain, 0, 1);
    this.targetWind = T.MathUtils.clamp(wind, 0, 1);
    this.targetClouds = T.MathUtils.clamp(0.2 + rain * 0.78, 0, 1);
    this.targetWet = rain > 0.05 ? Math.max(this.targetWet, 0.55 + rain * 0.45) : this.targetWet;
    this.state.weather = rain > 0.7 ? "monsoon" : rain > 0.15 ? "drizzle" : this.targetClouds > 0.5 ? "overcast" : "clear";
  }

  setReflectorSuppressed(suppressed: boolean) {
    this.reflectorSuppressed = suppressed;
    if (suppressed) this.wetReflector.visible = false;
  }

  private applyLighting(dt: number, focusPos: T.Vector3) {
    const s = this.state;
    // Solar arc: sunrise ~05:45, zenith ~12:00, sunset ~18:15 (Ho Chi Minh City latitude ~10.8°N)
    const sunAngle = ((s.timeOfDay - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * 0.85;
    const sunZ = -0.45 - Math.cos(sunAngle) * 0.25;
    this.sunDir.set(sunX, sunY, sunZ).normalize();
    s.sunElevation = sunY;
    s.nightFactor = T.MathUtils.smoothstep(-sunY, -0.14, 0.18);

    // Monsoon lightning flashes
    if (s.rainIntensity > 0.72) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        s.lightningFlash = (0.85 + Math.random() * 0.45) * this.lightningScale;
        this.lightningTimer = 7 + Math.random() * 14;
        this.onThunder?.(s.lightningFlash);
      }
    }
    s.lightningFlash = Math.max(0, s.lightningFlash - dt * 3.8);

    // Update sky shader uniforms
    this.skyMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.skyMat.uniforms.uNight.value = s.nightFactor;
    this.skyMat.uniforms.uCloudCover.value = this.cloudCover;
    this.skyMat.uniforms.uRain.value = s.rainIntensity;
    this.skyMat.uniforms.uLightning.value = s.lightningFlash;

    // Directional Sun/Moon key light snapped to an 8m world grid (prevents shadow swimming & redundant rebuilds!)
    const isDay = s.nightFactor < 0.65;
    this._keyDir.copy(isDay ? this.sunDir : this._moonDir);
    const snapX = Math.round(focusPos.x / 8) * 8;
    const snapZ = Math.round(focusPos.z / 8) * 8;
    this.sunLight.target.position.set(snapX, 0, snapZ);
    this.sunLight.position.copy(this.sunLight.target.position).addScaledVector(this._keyDir, 56);
    this.sunLight.target.updateMatrixWorld();

    const sunsetFactor = T.MathUtils.clamp(1 - Math.abs(sunY) * 4.2, 0, 1) * (1 - s.nightFactor * 0.8);
    this._sunCol.setHex(0xfff4e0).lerp(this._sunsetCol, sunsetFactor);
    this.sunLight.color.copy(this._sunCol).lerp(this._moonCol, s.nightFactor);

    const stormAtten = 1 - s.rainIntensity * 0.52;
    const dayInt = Math.max(0.45, sunY * 3.65) * stormAtten;
    const nightInt = 0.62 + s.lightningFlash * 2.2;
    this.sunLight.intensity = T.MathUtils.lerp(dayInt, nightInt, s.nightFactor);

    // Rich Sky/Ground Hemisphere GI Bounce: prevents pitch-black daylight shadows & keeps night NPCs/courtyards readable!
    this._skyDay.setHex(0xb2d8f6).lerp(this._skyRain, s.rainIntensity * 0.62);
    this._gndDay.setHex(0x6e685c);
    this._gndNight.setHex(0x2c2824);
    this.hemiLight.color.copy(this._skyDay).lerp(this._skyNight, s.nightFactor);
    this.hemiLight.groundColor.copy(this._gndDay).lerp(this._gndNight, s.nightFactor);
    this.hemiLight.intensity =
      T.MathUtils.lerp(1.58 * (1 - s.rainIntensity * 0.25), 0.62, s.nightFactor) + s.lightningFlash * 0.4;

    // Scene IBL & Exponential Atmospheric Fog
    this.scene.environmentIntensity = T.MathUtils.lerp(1.28, 0.62, s.nightFactor);
    this._fogDay.setHex(0xcbe0eb).lerp(this._fogRain, s.rainIntensity * 0.68);
    this._fogDay.lerp(this._fogSunset, sunsetFactor * 0.65);
    this._fogNight.setHex(0x181d2c).lerp(this._fogNightRain, s.rainIntensity * 0.45);
    this.fog.color.copy(this._fogDay).lerp(this._fogNight, s.nightFactor);
    this.fog.density = 0.00125 + s.rainIntensity * 0.0024 + s.nightFactor * 0.00045;

    // Keep sunLight.visible & castShadow CONSTANT forever (NEVER toggle -> ZERO WebGL shader recompiles when opening door!)
    // When indoors at night, reduce intensity smoothly without altering Three.js programCacheKey.
    if (this.reflectorSuppressed && s.nightFactor > 0.6) {
      this.sunLight.intensity *= 0.15;
    }
  }

  /**
   * Assign the 4 closest active outdoor lights (boarding house + districts + Lý Thái Tổ streetlamps)
   * into our FIXED 4-PointLight pool using .intensity only (NEVER toggles .visible -> 0ms shader recompile!).
   */
  updateOutdoorLightPool(specs: readonly PooledLightSpec[], focusPos: T.Vector3, indoors: boolean) {
    if (this.streetLamps.length === 0) return;
    if (indoors) {
      for (const l of this.streetLamps) l.intensity = 0;
      return;
    }

    const s = this.state;
    const lampLit = T.MathUtils.smoothstep(s.nightFactor, 0.18, 0.72);
    const poolCount = this.streetLamps.length;
    const bestIdx: number[] = [-1, -1, -1, -1];
    const bestScore: number[] = [Infinity, Infinity, Infinity, Infinity];

    // Only allocate Lý Thái Tổ avenue lamp slots when actually near/on Lý Thái Tổ (NEVER steal Dãy Trọ 462/14 lights!)
    const aveSlotCount = lampLit > 0.04 && focusPos.x < 10.5 && focusPos.z > -205 ? 2 : 0;
    const baseIdx = Math.floor((focusPos.z + 192.85) / 21);
    for (let i = 0; i < aveSlotCount; i++) {
      const l = this.streetLamps[i];
      l.color.setHex(0xffc380);
      l.distance = 22;
      l.decay = 1.9;
      l.position.set(2.87, 6.48, -192.85 + 21 * (baseIdx + i));
      l.intensity = lampLit * (42 + s.wetness * 35);
    }

    // Fill remaining pool slots with closest active boarding-house / district light specs
    const remSlots = poolCount - aveSlotCount;
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      if (sp.intensity < 0.05) continue;
      const dx = focusPos.x - sp.x;
      const dz = focusPos.z - sp.z;
      const d2 = dx * dx + dz * dz;
      const maxR = sp.distance + 14;
      if (d2 > maxR * maxR) continue;
      for (let k = 0; k < remSlots; k++) {
        if (d2 < bestScore[k]) {
          for (let j = remSlots - 1; j > k; j--) {
            bestScore[j] = bestScore[j - 1];
            bestIdx[j] = bestIdx[j - 1];
          }
          bestScore[k] = d2;
          bestIdx[k] = i;
          break;
        }
      }
    }

    for (let k = 0; k < remSlots; k++) {
      const l = this.streetLamps[aveSlotCount + k];
      const idx = bestIdx[k];
      if (idx >= 0) {
        const sp = specs[idx];
        l.position.set(sp.x, sp.y, sp.z);
        l.color.setHex(sp.color);
        l.distance = sp.distance;
        l.decay = sp.decay;
        l.intensity = sp.intensity;
      } else {
        l.intensity = 0;
      }
    }
  }

  setPrecipitationVisible(visible: boolean) {
    if (!visible) {
      this.rainSystem.setVisible(false);
    }
  }

  update(dt: number, elapsed: number, cameraPos: T.Vector3) {
    const s = this.state;
    this.updateAutoWeather(dt);
    // Advance dynamic Day/Night clock
    if (s.autoCycle) {
      s.timeOfDay = (s.timeOfDay + (dt * s.cycleSpeed) / 60) % 24;
    }

    // Smooth weather & wetness physics (asphalt wets quickly in rain, evaporates slowly in sun!)
    s.rainIntensity = T.MathUtils.lerp(s.rainIntensity, this.targetRain, 1 - Math.exp(-dt * 1.4));
    s.windStrength = T.MathUtils.lerp(s.windStrength, this.targetWind, 1 - Math.exp(-dt * 1.2));
    this.cloudCover = T.MathUtils.lerp(this.cloudCover, this.targetClouds, 1 - Math.exp(-dt * 0.9));

    const wetRate = this.targetWet > s.wetness ? 0.55 : 0.14;
    s.wetness = T.MathUtils.lerp(s.wetness, this.targetWet, 1 - Math.exp(-dt * wetRate));

    this.skyMat.uniforms.uTime.value = elapsed;
    this.skyMesh.position.copy(cameraPos);

    this.applyLighting(dt, cameraPos);

    // Instant 0ms swap between pre-baked Day / Golden-Hour / Night PMREM cubemaps (ZERO runtime stutter!)
    this.selectPMREM();

    // Update Planar Wet-Surface Reflector (auto-suppressed indoors, inside Dãy Trọ courtyard, or during cityRT pass!)
    this.wetReflector.visible =
      !this.reflectorSuppressed && this.reflectionsEnabled && s.wetness > 0.08 && cameraPos.x < 13.0 && cameraPos.z > -205;
    if (this.wetReflector.visible) {
      this.wetMat.uniforms.uRain.value = elapsed;
      this.wetMat.uniforms.uWet.value = s.wetness;
      this.wetMat.uniforms.uRainAmp.value = s.rainIntensity;
    }

    // Update 100% GPU AAA Cylindrical Rain Streaks + Expanding Ripple Splashes + Monsoon Mist
    this.rainSystem.update(elapsed, cameraPos, s.rainIntensity, s.windStrength, s.nightFactor, s.lightningFlash);
  }

  dispose() {
    this.pmremDay?.dispose();
    this.pmremSunset?.dispose();
    this.pmremNight?.dispose();
    this.pmrem.dispose();
    this.poolMask.dispose();
    this.wetReflector.dispose();
    this.rainSystem.dispose();
    this.skyMesh.geometry.dispose();
    this.skyMat.dispose();
  }
}
