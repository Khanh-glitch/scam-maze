import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/**
 * Draw-call reduction for the street outside the room window.
 *
 * Measured in the Chapter 1 room (dev probe, `renderer.info`, Apple M4): the city pass for the rain
 * glass drew 522 objects and the main pass 834, about 1,350 draws per frame, and the WebGL cost per
 * draw (`WebGLBindingStates`, `renderBufferDirect`) took most of the frame on the main thread. The
 * city is 429 meshes, nearly all with their own `MeshBasicMaterial` (a color per shop, a texture
 * clone per building), and a building box draws one call per face group.
 *
 * `mergeStaticCity` merges the static, direct children of the city group into one mesh per look:
 * the color moves into a vertex color, a texture's offset and repeat are baked into the UVs (the
 * clones share one image), and each face group of a multi-material box goes to the bucket of its
 * material. Unlit materials only, so the result looks the same. Lines become one line set per
 * material. Objects marked `userData.dynamic` (they move, blink or change their material later),
 * shader materials and groups are left alone.
 */
interface Bucket {
  material: THREE.Material;
  renderOrder: number;
  parts: { geometry: THREE.BufferGeometry; source: THREE.Object3D }[];
}
const _uv = new THREE.Vector3();
function lookKey(m: THREE.MeshBasicMaterial, renderOrder: number): string {
  const map = m.map;
  const tex = map ? `${map.source.uuid}:${map.wrapS}:${map.wrapT}:${map.colorSpace}:${map.minFilter}:${map.magFilter}:${map.anisotropy}` : 'none';
  return [tex, m.transparent, m.blending, m.depthWrite, m.depthTest, m.side, m.fog, m.opacity, m.toneMapped, m.alphaTest, renderOrder].join('|');
}
/** The faces `start..start+count` (index or vertex range) as a plain geometry in `matrix` space, with baked UVs and a vertex color. */
function piece(geometry: THREE.BufferGeometry, start: number, count: number, matrix: THREE.Matrix4, m: THREE.MeshBasicMaterial): THREE.BufferGeometry {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv as THREE.BufferAttribute | undefined;
  const index = geometry.index;
  const end = Math.min(start + count, index ? index.count : pos.count);
  const n = Math.max(0, end - start);
  const p = new Float32Array(n * 3);
  const t = new Float32Array(n * 2);
  const c = new Float32Array(n * 3);
  const map = m.map;
  if (map) map.updateMatrix();
  const v = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const i = index ? index.getX(start + k) : start + k;
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    p[k * 3] = v.x; p[k * 3 + 1] = v.y; p[k * 3 + 2] = v.z;
    if (uv) {
      _uv.set(uv.getX(i), uv.getY(i), 1);
      if (map) _uv.applyMatrix3(map.matrix);
      t[k * 2] = _uv.x; t[k * 2 + 1] = _uv.y;
    }
    c[k * 3] = m.color.r; c[k * 3 + 1] = m.color.g; c[k * 3 + 2] = m.color.b;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(t, 2));
  out.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return out;
}
/** The shared material of a bucket: the same look with white color, vertex colors and an untransformed texture. */
function bucketMaterial(m: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial {
  const out = m.clone();
  out.color.set(1, 1, 1);
  out.vertexColors = true;
  if (m.map) {
    const map = m.map.clone();
    map.offset.set(0, 0); map.repeat.set(1, 1); map.rotation = 0; map.center.set(0, 0);
    map.needsUpdate = true;
    out.map = map;
  }
  return out;
}
/** Returns the number of draw objects before and after (direct children of `root` only). */
export function mergeStaticCity(root: THREE.Object3D): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const local = new THREE.Matrix4();
  const meshBuckets = new Map<string, Bucket>();
  const lineBuckets = new Map<string, { material: THREE.Material; points: number[]; sources: THREE.Object3D[] }>();
  const before = root.children.length;
  for (const child of root.children) {
    if (child.userData.dynamic || child.children.length || !child.visible) continue;
    local.multiplyMatrices(inverse, child.matrixWorld);
    const line = child as THREE.Line;
    if (line.isLine && !(line as THREE.LineSegments).isLineSegments && line.material instanceof THREE.LineBasicMaterial && line.frustumCulled) {
      const pos = line.geometry.attributes.position;
      const key = line.material.uuid;
      let b = lineBuckets.get(key);
      if (!b) lineBuckets.set(key, (b = { material: line.material, points: [], sources: [] }));
      const a = new THREE.Vector3(), z = new THREE.Vector3();
      for (let i = 0; i + 1 < pos.count; i++) {
        a.fromBufferAttribute(pos, i).applyMatrix4(local);
        z.fromBufferAttribute(pos, i + 1).applyMatrix4(local);
        b.points.push(a.x, a.y, a.z, z.x, z.y, z.z);
      }
      b.sources.push(line);
      continue;
    }
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.frustumCulled || mesh.geometry.morphAttributes.position) continue;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.every((m) => m instanceof THREE.MeshBasicMaterial && !m.vertexColors && !m.alphaMap && !m.envMap && !m.lightMap && !m.aoMap && !m.specularMap)) continue;
    const g = mesh.geometry;
    const total = g.index ? g.index.count : g.attributes.position.count;
    const ranges = Array.isArray(mesh.material) && g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
    for (const range of ranges) {
      const m = mats[range.materialIndex ?? 0] as THREE.MeshBasicMaterial;
      if (!m) continue;
      const key = lookKey(m, mesh.renderOrder);
      let b = meshBuckets.get(key);
      if (!b) meshBuckets.set(key, (b = { material: m, renderOrder: mesh.renderOrder, parts: [] }));
      b.parts.push({ geometry: piece(g, range.start, range.count, local, m), source: mesh });
    }
  }
  // A mesh can leave only if every one of its face groups merges with others: a piece alone in its
  // bucket keeps its whole mesh, so that mesh's other pieces come out of their buckets too.
  const blocked = new Set<THREE.Object3D>();
  for (let changed = true; changed; ) {
    changed = false;
    meshBuckets.forEach((b) => {
      const live = b.parts.filter((part) => !blocked.has(part.source));
      if (live.length === 1 && !blocked.has(live[0].source)) { blocked.add(live[0].source); changed = true; }
    });
  }
  const removed = new Set<THREE.Object3D>();
  meshBuckets.forEach((b) => {
    const live = b.parts.filter((part) => !blocked.has(part.source));
    const geometry = live.length >= 2 ? mergeGeometries(live.map((part) => part.geometry), false) : null;
    b.parts.forEach((part) => part.geometry.dispose());
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const merged = new THREE.Mesh(geometry, bucketMaterial(b.material as THREE.MeshBasicMaterial));
    merged.name = 'MergedCity';
    merged.renderOrder = b.renderOrder;
    root.add(merged);
    live.forEach((part) => removed.add(part.source));
  });
  lineBuckets.forEach((b) => {
    if (b.sources.length < 2) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.points, 3));
    geometry.computeBoundingSphere();
    const merged = new THREE.LineSegments(geometry, b.material);
    merged.name = 'MergedCity';
    root.add(merged);
    b.sources.forEach((s) => removed.add(s));
  });
  removed.forEach((o) => { o.removeFromParent(); (o as THREE.Mesh).geometry?.dispose(); });
  root.children.forEach((c) => { if (c.name === 'MergedCity') { c.matrixAutoUpdate = false; c.updateMatrix(); } });
  root.updateMatrixWorld(true);
  return { before, after: root.children.length };
}
