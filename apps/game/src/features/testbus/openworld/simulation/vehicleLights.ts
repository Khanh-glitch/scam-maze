import * as T from "three";

/**
 * Vehicle lights on the models' own lamp parts.
 *
 * `markLampParts` finds the headlight and tail-light meshes of a vehicle model by material / node name (lens glass,
 * reflector, lamp texture), keeps only the triangles at the matching end of the vehicle (some lens materials are
 * shared with other parts) and gives them an emissive copy of their own material, textured with their own map. At
 * night those parts glow and bloom; by day they are off. No sprites or lenses are added on top of the model.
 *
 * `addHeadlightBeam` adds the light pool on the road in front of a lit headlight (no real lights: an additive
 * textured fan about 14 m long for cars, 9 m for motorbikes, the bright part of a real low beam).
 * All vehicles share the same few materials, so the night switch is a handful of uniform writes.
 */

interface LampRule {
  role: "head" | "tail";
  /** Matches the material name (or the mesh / node name). */
  test: RegExp;
}

/** Lamp parts of the street models (motorbike.glb, taxi_corolla / harmony, savanna, mula_van, bike-supercub). */
const RULES: LampRule[] = [
  { role: "head", test: /^(farol|klosz$|lights$|headlight_metal|glass-headlight-cover|lamp_headlight)/i },
  { role: "tail", test: /^(luzes|material\.005$|stop$|glass_-_red)/i },
];
/** Share of the vehicle length, from each end, where its lamps can be. */
const END_SLAB = 0.16;

const headMats: T.MeshStandardMaterial[] = [];
const tailMats: T.MeshStandardMaterial[] = [];
const lampCache = new Map<string, T.MeshStandardMaterial>();
let level = { lit: 0, wet: 0 };

function lampMaterial(source: T.Material, role: "head" | "tail"): T.MeshStandardMaterial | null {
  if (!(source instanceof T.MeshStandardMaterial)) return null;
  const key = `${source.uuid}|${role}`;
  const hit = lampCache.get(key);
  if (hit) return hit;
  const m = source.clone();
  m.name = `${source.name}_lamp_${role}`;
  // A lit lens is not see-through: keep it opaque so its glow is not divided by the glass alpha.
  m.transparent = false;
  m.opacity = 1;
  m.depthWrite = true;
  if (role === "head") {
    m.color.lerp(new T.Color(0xf4f1ea), 0.6);
    m.emissive.set(0xfff0d2);
  } else {
    m.color.lerp(new T.Color(0x8a0f0a), 0.5);
    m.emissive.set(0xff1e0e);
  }
  m.emissiveMap = m.map ?? null;
  m.roughness = Math.min(m.roughness, 0.25);
  lampCache.set(key, m);
  (role === "head" ? headMats : tailMats).push(m);
  applyLevel(m, role);
  return m;
}

function applyLevel(m: T.MeshStandardMaterial, role: "head" | "tail") {
  m.emissiveIntensity = role === "head" ? 0.04 + level.lit * 7 : 0.12 + level.lit * 3.2;
}

const _v = new T.Vector3();
const _a = new T.Vector3();
const _b = new T.Vector3();
const _c = new T.Vector3();

/** The model's own nose direction in `host` space: front wheels minus rear wheels, else headlight minus tail. */
function modelForward(host: T.Object3D, vehicle: T.Object3D, fallback: T.Vector3): T.Vector3 {
  const pick = (re: RegExp) => {
    const out: T.Vector3[] = [];
    vehicle.traverse((o) => {
      if (re.test(o.name)) out.push(host.worldToLocal(o.getWorldPosition(new T.Vector3())));
    });
    return out;
  };
  const avg = (list: T.Vector3[]) => list.reduce((s, p) => s.add(p), new T.Vector3()).multiplyScalar(1 / list.length);
  const front = pick(/^wheel_F[LR]/i);
  const rear = pick(/^wheel_R[LR]/i);
  if (front.length && rear.length) return avg(front).sub(avg(rear)).setY(0).normalize();
  const centre = (re: RegExp) => {
    const box = new T.Box3();
    vehicle.traverse((o) => {
      if (o instanceof T.Mesh && (re.test(o.name) || materialsOf(o).some((m) => re.test(m.name)))) box.expandByObject(o);
    });
    return box.isEmpty() ? null : host.worldToLocal(box.getCenter(new T.Vector3()));
  };
  const head = centre(/^farol|lamp_headlight/i);
  const tail = centre(/^luzes/i);
  if (head && tail) return head.sub(tail).setY(0).normalize();
  return fallback.clone().setY(0).normalize();
}

function materialsOf(mesh: T.Mesh): T.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Turns the vehicle's own lamp parts into lamps. Call it on a vehicle placed under `host` and before its body is
 * merged. `fallbackForward` (host space) is only used when the model's nose cannot be found. Returns whether a
 * headlight part was found.
 */
export function markLampParts(host: T.Object3D, vehicle: T.Object3D, fallbackForward: T.Vector3): { head: boolean } {
  host.updateWorldMatrix(true, true);
  const fwd = modelForward(host, vehicle, fallbackForward);
  const toHost = new T.Matrix4().copy(host.matrixWorld).invert();
  // Vehicle extent along its nose.
  let lo = Infinity;
  let hi = -Infinity;
  const meshes: T.Mesh[] = [];
  vehicle.traverse((o) => {
    if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh) return;
    meshes.push(o);
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    const m = new T.Matrix4().multiplyMatrices(toHost, o.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step) {
      const d = _v.fromBufferAttribute(pos, i).applyMatrix4(m).dot(fwd);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
  });
  if (!Number.isFinite(lo)) return { head: false };
  const len = hi - lo;
  let foundHead = false;
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) continue;
    const src = mesh.material;
    const rule = RULES.find((r) => r.test.test(src.name) || r.test.test(mesh.name) || r.test.test(mesh.parent?.name ?? ""));
    if (!rule) continue;
    const lamp = lampMaterial(src, rule.role);
    if (!lamp) continue;
    const m = new T.Matrix4().multiplyMatrices(toHost, mesh.matrixWorld);
    const pos = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    const vert = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    const atEnd = (d: number) => (rule.role === "head" ? d > hi - len * END_SLAB : d < lo + len * END_SLAB);
    let lit: number[] = [];
    let rest: number[] = [];
    let onHalf = true;
    const mid = (lo + hi) / 2;
    for (let t = 0; t < triCount; t++) {
      _a.fromBufferAttribute(pos, vert(t, 0)).applyMatrix4(m);
      _b.fromBufferAttribute(pos, vert(t, 1)).applyMatrix4(m);
      _c.fromBufferAttribute(pos, vert(t, 2)).applyMatrix4(m);
      const d = (_a.dot(fwd) + _b.dot(fwd) + _c.dot(fwd)) / 3;
      if (rule.role === "head" ? d < mid : d > mid) onHalf = false;
      const target = atEnd(d) ? lit : rest;
      target.push(vert(t, 0), vert(t, 1), vert(t, 2));
    }
    // A small lamp set back from the bumper (a motorbike headlight behind the front wheel): the whole mesh is the lamp.
    if (!lit.length && onHalf) {
      lit = rest;
      rest = [];
    }
    if (!lit.length) continue;
    if (rule.role === "head") foundHead = true;
    if (!rest.length) {
      mesh.material = lamp;
      continue;
    }
    // Only one end of this mesh is a lamp: split it (own geometry, the source model stays untouched).
    const keep = mesh.geometry.clone();
    keep.setIndex(rest);
    const glow = mesh.geometry.clone();
    glow.setIndex(lit);
    mesh.geometry = keep;
    const part = new T.Mesh(glow, lamp);
    part.name = `${mesh.name}_lamp`;
    part.position.copy(mesh.position);
    part.quaternion.copy(mesh.quaternion);
    part.scale.copy(mesh.scale);
    part.castShadow = false;
    part.receiveShadow = mesh.receiveShadow;
    mesh.parent?.add(part);
  }
  host.updateWorldMatrix(true, true);
  return { head: foundHead };
}

let beamMat: T.MeshBasicMaterial | null = null;

function beamTexture(): T.Texture {
  const w = 128;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  if (!ctx) return t;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const along = y / (h - 1); // 0 at the bumper, 1 at the far end
    const half = 0.22 + 0.78 * Math.sqrt(along);
    const fall = Math.min(1, along * 7) * Math.pow(1 - along, 1.6);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) * 2;
      const edge = 1 - Math.min(1, Math.max(0, (u - half * 0.55) / (half * 0.45)));
      const v = Math.max(0, fall * edge * edge);
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 240;
      img.data[i + 2] = 210;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return t;
}

function beamMaterial() {
  beamMat ??= new T.MeshBasicMaterial({
    map: beamTexture(),
    color: 0xffe9c4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return beamMat;
}

export type LightKind = "car" | "truck" | "moto";

/** The pool of light on the road ahead of a vehicle whose headlight was found. `forward` is the driving direction. */
export function addHeadlightBeam(host: T.Object3D, vehicle: T.Object3D, forward: T.Vector3, kind: LightKind) {
  host.updateWorldMatrix(true, true);
  const inv = new T.Matrix4().copy(host.matrixWorld).invert();
  const box = new T.Box3();
  const tmp = new T.Box3();
  vehicle.traverse((o) => {
    if (o instanceof T.Mesh && !(o instanceof T.SkinnedMesh)) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      box.union(tmp);
    }
  });
  if (box.isEmpty()) return;
  const f = forward.clone().setY(0).normalize();
  const centre = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3());
  const halfLen = Math.abs(f.x) > Math.abs(f.z) ? size.x / 2 : size.z / 2;
  const len = kind === "moto" ? 9 : kind === "truck" ? 15 : 14;
  const wid = kind === "moto" ? 3.2 : 5.2;
  const beam = new T.Mesh(new T.PlaneGeometry(wid, len), beamMaterial());
  // Texture row 0 (the bumper end) is the plane's +y edge; after these rotations +y points back along -forward.
  beam.rotation.order = "YXZ";
  beam.rotation.set(-Math.PI / 2, Math.atan2(f.x, f.z), 0);
  beam.position.copy(centre).addScaledVector(f, halfLen + len / 2 - 0.2).setY(box.min.y + 0.03);
  beam.renderOrder = 2;
  beam.name = "HeadlightBeam";
  host.add(beam);
}

/** 0 = day (lamps off), 1 = night. Wet roads show a brighter pool. */
export function setVehicleLightLevel(lit: number, wetness: number) {
  if (Math.abs(lit - level.lit) < 0.004 && Math.abs(wetness - level.wet) < 0.01) return;
  level = { lit, wet: wetness };
  for (const m of headMats) applyLevel(m, "head");
  for (const m of tailMats) applyLevel(m, "tail");
  if (beamMat) beamMat.opacity = lit * (0.18 + wetness * 0.14);
}
