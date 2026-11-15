import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { STREET_PROPS_GLB, STREET_PROPS_MODELS_BASE } from '../../../config/assetPaths';

/**
 * Street furniture and parked vehicles drawn from models (scripts/optimize-street-props.cjs):
 * low plastic stools, the tall plastic chair, the table-and-stools set and five parked bikes.
 *
 * The models load before the world is built (`loadStreetFurniture`). While building, furniture
 * helpers (furniture.ts) record a placement with `Builder.prop` instead of building procedural
 * geometry; `placeStreetFurniture` then draws every placement of a kind as instanced meshes, one
 * draw per material and 24 m chunk, however many copies there are. If the models did not load,
 * the helpers build their procedural versions as before.
 */
export type PropKind = 'stool-low' | 'stool-high' | 'table-set' | 'bike-cg125' | 'bike-supercub' | 'bike-fatboy' | 'bike-bobber' | 'bike-pcx' | 'trash-bin';

interface PropSpec {
  /** Real size in meters: the model is scaled so this dimension matches. */
  height?: number;
  length?: number;
  /** Turn (radians, about Y) that makes the model face +Z like the procedural props. */
  yaw?: number;
  shadow: boolean;
  /** Node to use from a shared file instead of `<kind>.optimized.glb` (the street environment's props). */
  source?: { file: string; node: string };
}

/** Height of the low stool seat (m); seated characters use it (people.ts). */
export const STOOL_LOW_HEIGHT = 0.27;

const SPECS: Record<PropKind, PropSpec> = {
  'stool-low': { height: STOOL_LOW_HEIGHT, shadow: true },
  'stool-high': { height: 0.84, shadow: true },
  // A low street table with four stools around it.
  'table-set': { height: 0.5, shadow: true },
  'bike-cg125': { length: 1.98, shadow: true },
  'bike-supercub': { length: 1.82, shadow: true },
  'bike-fatboy': { length: 2.37, shadow: true },
  'bike-bobber': { length: 2.2, shadow: true },
  'bike-pcx': { length: 1.94, yaw: -Math.PI / 2, shadow: true },
  // The owner's penguin bin, from the street environment (the same model stands beside the banh mi cart).
  // Authored facing +X; turned to face +Z.
  'trash-bin': { height: 1.05, yaw: -Math.PI / 2, shadow: true, source: { file: STREET_PROPS_GLB, node: 'Prop_TrashBin' } },
};

export const PARKED_BIKES: readonly PropKind[] = ['bike-cg125', 'bike-supercub', 'bike-fatboy', 'bike-bobber', 'bike-pcx'];

interface PreparedProp { parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[]; size: THREE.Vector3 }

const prepared = new Map<PropKind, PreparedProp>();

/** True when `kind` loaded; furniture helpers fall back to procedural geometry otherwise. */
export function hasProp(kind: PropKind): boolean {
  return prepared.has(kind);
}

/** Footprint (m) of a prepared prop after scaling, or null when it did not load. */
export function propSize(kind: PropKind): THREE.Vector3 | null {
  return prepared.get(kind)?.size ?? null;
}

/** Bakes the model into one geometry per material, scaled, turned to +Z, centered and stood on y = 0. */
function prepare(kind: PropKind, scene: THREE.Object3D): PreparedProp {
  const spec = SPECS[kind];
  scene.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    // The files are quantized (normalized 16-bit positions, scaled back by the node matrix).
    // Baking the matrix into such an attribute clamps every value to [-1, 1] and cuts the model
    // apart, so the attributes become plain floats first.
    for (const name of Object.keys(g.attributes)) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      if (a.array instanceof Float32Array && !a.normalized) continue;
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    g.applyMatrix4(mesh.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const m = mesh.material as THREE.Material;
    const list = byMaterial.get(m) ?? [];
    list.push(g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()]));
    byMaterial.set(m, list);
  });
  const parts = [...byMaterial].map(([material, geos]) => ({ material, geometry: geos.length === 1 ? geos[0] : mergeGeometries(geos)! }));
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox!); }
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const yaw = spec.yaw ?? 0;
  const turnedLen = Math.abs(Math.cos(yaw)) * size.z + Math.abs(Math.sin(yaw)) * size.x;
  const k = spec.height ? spec.height / size.y : spec.length ? spec.length / turnedLen : 1;
  const fit = new THREE.Matrix4().makeScale(k, k, k)
    .multiply(new THREE.Matrix4().makeRotationY(yaw))
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
  for (const p of parts) {
    p.geometry.applyMatrix4(fit);
    p.geometry.computeBoundingBox(); p.geometry.computeBoundingSphere();
    const mat = p.material as THREE.MeshStandardMaterial;
    // The props are seen in the rain too: no mirror-like plastic or chrome.
    if (mat.roughness !== undefined) mat.roughness = Math.max(mat.roughness, 0.35);
  }
  const out = new THREE.Box3();
  for (const p of parts) out.union(p.geometry.boundingBox!);
  return { parts, size: out.getSize(new THREE.Vector3()) };
}

/** Loads every prop model once; a model that fails is skipped (its helper stays procedural). */
export async function loadStreetFurniture(): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await Promise.all((Object.keys(SPECS) as PropKind[]).map(async (kind) => {
    if (prepared.has(kind)) return;
    try {
      const src = SPECS[kind].source;
      const gltf = await loader.loadAsync(src ? src.file : `${STREET_PROPS_MODELS_BASE}/${kind}.optimized.glb`);
      const node = src ? gltf.scene.getObjectByName(src.node) : gltf.scene;
      if (!node) throw new Error(`node "${src!.node}" not found`);
      if (src) { node.removeFromParent(); node.position.set(0, 0, 0); }
      prepared.set(kind, prepare(kind, node));
    } catch (err) {
      console.warn(`[khupho] prop "${kind}" failed to load`, err);
    }
  }));
}

/** One recorded placement, in the space of the group its builder is built into. */
export interface PropPlacement { kind: PropKind; matrix: THREE.Matrix4 }

/** Placements waiting for `placeStreetFurniture`: the group they belong to (null = world) and the list. */
const pending: { group: THREE.Object3D | null; items: PropPlacement[] }[] = [];

/** Called by Builder.build with the placements recorded in that builder. */
export function queueProps(group: THREE.Object3D | null, items: PropPlacement[]) {
  if (items.length) pending.push({ group, items });
}

/** A placement directly in world space (props set up outside a builder, e.g. under seated people). */
export function queueWorldProp(kind: PropKind, x: number, y: number, z: number, yaw = 0, scale = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(scale, scale, scale));
  pending.push({ group: null, items: [{ kind, matrix: m }] });
}

/** Chunk size (m) for instanced meshes, so the frustum culls the far ones. */
const CHUNK = 24;

/** Draws every queued placement as instanced meshes under `root`; returns the number of instances. */
export function placeStreetFurniture(root: THREE.Object3D): number {
  const groups = new Map<string, { kind: PropKind; matrices: THREE.Matrix4[] }>();
  const pos = new THREE.Vector3();
  for (const { group, items } of pending) {
    group?.updateMatrixWorld(true);
    for (const it of items) {
      if (!prepared.has(it.kind)) continue;
      const world = group ? group.matrixWorld.clone().multiply(it.matrix) : it.matrix;
      pos.setFromMatrixPosition(world);
      const key = `${it.kind}|${Math.floor(pos.x / CHUNK)}|${Math.floor(pos.z / CHUNK)}`;
      let g = groups.get(key);
      if (!g) { g = { kind: it.kind, matrices: [] }; groups.set(key, g); }
      g.matrices.push(world);
    }
  }
  pending.length = 0;
  let count = 0;
  for (const { kind, matrices } of groups.values()) {
    const p = prepared.get(kind)!;
    for (const part of p.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = SPECS[kind].shadow; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      mesh.name = `prop:${kind}`;
      root.add(mesh);
    }
    count += matrices.length;
  }
  return count;
}
