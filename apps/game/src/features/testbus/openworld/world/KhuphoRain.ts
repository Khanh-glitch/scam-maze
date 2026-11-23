import * as T from "three";

/**
 * Rain streaks taken from the khupho neighborhood (`features/khupho/world/engine.ts`): one LineSegments draw call,
 * thin water threads that fall through a box around the camera. This version differs from the original in four
 * ways so it looks smoother in the open world:
 *  - the streak follows the fall direction (wind slants it), and its tail fades out like motion blur;
 *  - the amount of rain is a per-streak threshold, so changing the intensity adds and removes streaks gradually;
 *  - streaks fade in and out at the box edge and near the camera, so none pops in;
 *  - nothing falls inside the Room 6.07 box.
 */
export class KhuphoRain {
  readonly object: T.LineSegments;
  private readonly material: T.ShaderMaterial;
  private readonly count: number;
  private drawn = 0;

  constructor(count: number, roomMin: T.Vector3, roomMax: T.Vector3) {
    this.count = count;
    const pos = new Float32Array(count * 6);
    const seed = new Float32Array(count * 2);
    const end = new Float32Array(count * 2);
    // Fixed-seed sequence: the same box every run, and the density threshold rises with the index.
    let state = 7719;
    const rand = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const x = rand() * 40;
      const y = rand() * 26;
      const z = rand() * 40;
      pos.set([x, y, z, x, y, z], i * 6);
      const sd = i / count; // 0..1, used as the density threshold (and for speed variety)
      seed[i * 2] = sd;
      seed[i * 2 + 1] = sd;
      end[i * 2] = 0;
      end[i * 2 + 1] = 1;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(pos, 3));
    geometry.setAttribute("sd", new T.BufferAttribute(seed, 1));
    geometry.setAttribute("tail", new T.BufferAttribute(end, 1));
    this.material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new T.Vector3() },
        uWind: { value: new T.Vector2() },
        uDensity: { value: 0 },
        uOpacity: { value: 0.8 },
        uTint: { value: new T.Color(0.78, 0.84, 0.9) },
        uRoomMin: { value: roomMin.clone() },
        uRoomMax: { value: roomMax.clone() },
      },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; uniform float uDensity;
        uniform vec3 uRoomMin; uniform vec3 uRoomMax;
        attribute float sd; attribute float tail;
        varying float vA;
        void main() {
          float speed = 15.0 + fract(sd * 97.0) * 6.0;
          float len = 0.55 + fract(sd * 53.0) * 0.45;
          // head position wraps inside a 40 x 26 x 40 box that follows the camera
          vec3 p = position;
          float ty = mod(p.y - uTime * speed, 26.0);
          vec3 head;
          head.xz = uCam.xz + mod(p.xz - uCam.xz + 20.0, 40.0) - 20.0;
          head.y = ty - 0.5 + uCam.y - 8.0;
          // slanted fall direction, tail trails behind the head
          vec3 dir = normalize(vec3(uWind.x, -speed, uWind.y));
          vec3 q = head - dir * len * tail;
          // fade at the box edge, close to the camera and with the fall height
          vec2 e = abs(head.xz - uCam.xz) / 20.0;
          float edge = 1.0 - smoothstep(0.78, 1.0, max(e.x, e.y));
          float near = smoothstep(0.6, 2.2, length(head - uCam));
          float h = smoothstep(0.0, 1.5, ty) * (1.0 - smoothstep(22.0, 26.0, ty));
          float on = step(sd, uDensity);
          bool inRoom = all(greaterThan(q, uRoomMin)) && all(lessThan(q, uRoomMax));
          vA = (1.0 - tail * 0.92) * edge * near * h * on * (inRoom ? 0.0 : 1.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint; uniform float uOpacity; varying float vA;
        void main() {
          if (vA < 0.004) discard;
          gl_FragColor = vec4(uTint, vA * uOpacity);
        }`,
    });
    this.object = new T.LineSegments(geometry, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 10;
    this.object.name = "KhuphoRain";
  }

  update(elapsed: number, camPos: T.Vector3, intensity: number, wind: T.Vector2, nightFactor: number, flash: number) {
    const u = this.material.uniforms;
    u.uTime.value = elapsed;
    (u.uCam.value as T.Vector3).copy(camPos);
    (u.uWind.value as T.Vector2).copy(wind);
    u.uDensity.value = Math.min(1, intensity * 1.05);
    // Lines catch less light at night; lightning flashes light them up.
    const day = 1 - nightFactor * 0.45;
    (u.uTint.value as T.Color).setRGB(0.78 * day + flash * 0.2, 0.84 * day + flash * 0.2, 0.9 * day + flash * 0.25);
    u.uOpacity.value = 0.62 + 0.3 * intensity;
    // Draw only the streaks that can pass the threshold.
    const drawn = Math.max(2, Math.ceil(Math.min(1, intensity * 1.05) * this.count) * 2);
    if (drawn !== this.drawn) {
      this.drawn = drawn;
      this.object.geometry.setDrawRange(0, drawn);
    }
  }

  dispose() {
    this.object.geometry.dispose();
    this.material.dispose();
  }
}
