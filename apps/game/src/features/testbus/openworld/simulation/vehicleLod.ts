import * as T from "three";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Simplify an indexed geometry to roughly `ratio` of its triangles (keeps position/normal/uv). */
export function simplifyGeometry(src: T.BufferGeometry, ratio: number): T.BufferGeometry {
  const index = src.index;
  const pos = src.getAttribute("position") as T.BufferAttribute;
  if (!index || !pos || index.count < 600 || ratio >= 1) return src;
  const positions = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    positions[i * 3] = pos.getX(i);
    positions[i * 3 + 1] = pos.getY(i);
    positions[i * 3 + 2] = pos.getZ(i);
  }
  const indices = Uint32Array.from(index.array as ArrayLike<number>);
  const target = Math.max(60, Math.floor((indices.length * ratio) / 3) * 3);
  const [small] = MeshoptSimplifier.simplify(indices, positions, 3, target, 0.04, ["Permissive"]);
  const out = new T.BufferGeometry();
  for (const [key, attr] of Object.entries(src.attributes)) out.setAttribute(key, attr as T.BufferAttribute);
  out.setIndex(new T.BufferAttribute(small, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Replace every mesh geometry under `root` with a simplified copy (node hierarchy stays intact, so wheels still spin). */
export async function simplifyInPlace(root: T.Object3D, ratio: number) {
  await MeshoptSimplifier.ready;
  root.traverse((o) => {
    if (o instanceof T.Mesh && !(o instanceof T.SkinnedMesh)) o.geometry = simplifyGeometry(o.geometry, ratio);
  });
}

export interface BakedLevel {
  parts: { geometry: T.BufferGeometry; material: T.Material }[];
  distance: number;
}

/**
 * Bake a static (non-animated) vehicle: merge every mesh sharing a material into one geometry, then build
 * simplified LOD levels. ~20 draw calls and ~50k triangles per parked bike become ~6 calls and ~8k.
 */
export async function bakeStaticVehicle(
  root: T.Object3D,
  ratios: number[] = [0.35, 0.1],
  distances: number[] = [0, 22, 50],
): Promise<BakedLevel[] | null> {
  await MeshoptSimplifier.ready;
  root.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  let ok = true;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh) || !ok) return;
    if (o instanceof T.SkinnedMesh || Array.isArray(o.material) || !o.geometry.index) {
      ok = false;
      return;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", o.geometry.getAttribute("position").clone());
    const normal = o.geometry.getAttribute("normal");
    if (normal) g.setAttribute("normal", normal.clone());
    const uv = o.geometry.getAttribute("uv");
    g.setAttribute("uv", uv ? uv.clone() : new T.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
    g.setIndex(o.geometry.index.clone());
    if (!normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    const list = buckets.get(o.material) ?? [];
    list.push(g);
    buckets.set(o.material, list);
  });
  if (!ok) return null;
  const merged: { geometry: T.BufferGeometry; material: T.Material }[] = [];
  for (const [material, list] of buckets) {
    const geometry = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (geometry) merged.push({ geometry, material });
  }
  const levels: BakedLevel[] = ratios.map((ratio, i) => ({
    distance: distances[i],
    parts: merged.map(({ geometry, material }) => ({ geometry: simplifyGeometry(geometry, ratio), material })),
  }));
  return levels;
}

/** A cheap LOD instance that shares the baked geometry and materials with every other instance. */
export function instantiateBaked(levels: BakedLevel[], cullDistance: number): T.LOD {
  const lod = new T.LOD();
  levels.forEach((level) => {
    const group = new T.Group();
    for (const { geometry, material } of level.parts) {
      const mesh = new T.Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    group.matrixAutoUpdate = false;
    lod.addLevel(group, level.distance, 0.1);
  });
  lod.addLevel(new T.Object3D(), cullDistance, 0.1);
  return lod;
}

const WHEEL_NODE = /^(wheel_|FrontWheel|RearWheel)/i;

/**
 * Merge every body mesh of a vehicle that shares a material into one mesh (wheels keep their own nodes so they can
 * still spin). A GLB car arrives as 50-90 separate primitives; this brings it down to roughly 15 draw calls.
 */
export function mergeVehicleBody(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { material: T.Material; cast: boolean; recv: boolean; geoms: T.BufferGeometry[] }>();
  const doomed: T.Mesh[] = [];
  const visit = (node: T.Object3D) => {
    if (node !== root && WHEEL_NODE.test(node.name)) return;
    if (node instanceof T.Mesh && !(node instanceof T.SkinnedMesh) && !Array.isArray(node.material) && node.geometry.index) {
      const src = node.geometry;
      const pos = src.getAttribute("position");
      if (pos && !src.getAttribute("color") && !src.morphAttributes.position?.length) {
        const g = new T.BufferGeometry();
        g.setAttribute("position", pos.clone());
        const normal = src.getAttribute("normal");
        if (normal) g.setAttribute("normal", normal.clone());
        const uv = src.getAttribute("uv");
        g.setAttribute("uv", uv ? uv.clone() : new T.BufferAttribute(new Float32Array(pos.count * 2), 2));
        g.setIndex(src.index!.clone());
        if (!normal) g.computeVertexNormals();
        g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, node.matrixWorld));
        const key = `${node.material.uuid}|${node.castShadow ? 1 : 0}|${node.receiveShadow ? 1 : 0}`;
        let b = buckets.get(key);
        if (!b) {
          b = { material: node.material, cast: node.castShadow, recv: node.receiveShadow, geoms: [] };
          buckets.set(key, b);
        }
        b.geoms.push(g);
        doomed.push(node);
        return;
      }
    }
    for (const c of [...node.children]) visit(c);
  };
  visit(root);
  for (const m of doomed) m.removeFromParent();
  for (const b of buckets.values()) {
    const geometry = mergeGeometries(b.geoms, false);
    b.geoms.forEach((g) => g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, b.material);
    mesh.name = "MergedVehicleBody";
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    root.add(mesh);
  }
}

const vanFixed = new WeakSet<T.Object3D>();

interface WheelKit {
  tire: T.BufferGeometry;
  rim: T.BufferGeometry;
  bolts: Record<"-1" | "1", T.BufferGeometry>;
  tireMat: T.Material;
  rimMat: T.Material;
  boltMat: T.Material;
}

/** Clean procedural wheel parts (tyre, steel rim, wheel nuts) lying on the x axle, centred on the origin. */
const wheelKits = new Map<string, WheelKit>();
function getWheelKit(radius: number, width: number): WheelKit {
  const kitKey = `${radius.toFixed(3)}|${width.toFixed(3)}`;
  const cachedKit = wheelKits.get(kitKey);
  if (cachedKit) return cachedKit;
  const h = width / 2;
  const tire = new T.LatheGeometry(
    [
      new T.Vector2(radius * 0.62, -h),
      new T.Vector2(radius * 0.93, -h),
      new T.Vector2(radius, -h * 0.72),
      new T.Vector2(radius, h * 0.72),
      new T.Vector2(radius * 0.93, h),
      new T.Vector2(radius * 0.62, h),
    ],
    32,
  );
  tire.rotateZ(Math.PI / 2);
  const rim = new T.CylinderGeometry(radius * 0.66, radius * 0.66, width * 1.02, 24).rotateZ(Math.PI / 2);
  const bolts = { "-1": [] as T.BufferGeometry[], "1": [] as T.BufferGeometry[] };
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const g = new T.CylinderGeometry(0.018, 0.018, 0.03, 8).rotateZ(Math.PI / 2);
      g.translate(side * (h * 1.04), Math.sin(a) * radius * 0.3, Math.cos(a) * radius * 0.3);
      bolts[String(side) as "-1" | "1"].push(g);
    }
    const hub = new T.CylinderGeometry(radius * 0.16, radius * 0.16, 0.035, 14).rotateZ(Math.PI / 2);
    hub.translate(side * (h * 1.04), 0, 0);
    bolts[String(side) as "-1" | "1"].push(hub);
  }
  const made: WheelKit = {
    tire,
    rim,
    bolts: {
      "-1": mergeGeometries(bolts["-1"], false)!,
      "1": mergeGeometries(bolts["1"], false)!,
    },
    tireMat: new T.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.92, metalness: 0 }),
    rimMat: new T.MeshStandardMaterial({ color: 0xaeb3b9, roughness: 0.38, metalness: 0.75 }),
    boltMat: new T.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.5, metalness: 0.6 }),
  };
  wheelKits.set(kitKey, made);
  return made;
}

/**
 * The Mula van GLB ships 0.48 m wide tyres that stick out of the body, rim meshes that z-fight with the tyre
 * (black shimmer) and discs too big for the arches. Swap every wheel for clean parts, tuck them under the
 * arches and sit them on the ground. Mutates the loaded scene once, so every clone inherits the fix.
 */
export function fixVanWheels(scene: T.Object3D) {
  if (vanFixed.has(scene)) return;
  vanFixed.add(scene);
  scene.updateMatrixWorld(true);
  // Size every new wheel from the wheel it replaces, so it fills the arch of the model it sits in.
  scene.traverse((w) => {
    if (!/^wheel_/i.test(w.name) || !w.parent) return;
    const box = new T.Box3().setFromObject(w, true);
    const size = box.getSize(new T.Vector3());
    const worldScale = new T.Vector3();
    w.parent.getWorldScale(worldScale);
    const k = 1 / Math.max(1e-4, worldScale.y);
    const radius = T.MathUtils.clamp(size.y > 0.1 ? (size.y / 2) * k : 0.3, 0.22, 0.5);
    const width = T.MathUtils.clamp(size.x > 0.05 ? size.x * k * 0.9 : 0.2, 0.15, 0.24);
    const centre = box.isEmpty() ? null : w.parent.worldToLocal(box.getCenter(new T.Vector3()));
    const side = Math.sign(centre ? centre.x : w.position.x) || 1;
    const kit = getWheelKit(radius, width);
    for (const child of [...w.children]) w.remove(child);
    if (w instanceof T.Mesh) w.visible = false;
    if (centre) w.position.set(centre.x - side * 0.03, centre.y, centre.z);
    else w.position.set(side * 0.75, radius, w.position.z);
    w.rotation.set(0, 0, 0);
    w.scale.set(1, 1, 1);
    const key = String(side) as "-1" | "1";
    for (const [geometry, material] of [
      [kit.tire, kit.tireMat],
      [kit.rim, kit.rimMat],
      [kit.bolts[key], kit.boltMat],
    ] as const) {
      const mesh = new T.Mesh(geometry, material);
      mesh.castShadow = false;
      w.add(mesh);
    }
  });
  scene.updateMatrixWorld(true);
}
