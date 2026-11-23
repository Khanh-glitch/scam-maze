import * as T from "three";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";
// Swap only index buffers: both levels retain the original weights, UVs and material.
export async function actorDetail(root: T.Object3D) {
  await MeshoptSimplifier.ready;
  const meshes: {
    mesh: T.Mesh;
    near: T.BufferGeometry;
    far: T.BufferGeometry;
  }[] = [];
  root.traverse((o) => {
    if (
      !(o instanceof T.Mesh) ||
      !o.geometry.index ||
      o.geometry.index.count < 2400
    )
      return;
    const near = o.geometry,
      attr = near.getAttribute("position"),
      pos = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) {
      pos[i * 3] = attr.getX(i);
      pos[i * 3 + 1] = attr.getY(i);
      pos[i * 3 + 2] = attr.getZ(i);
    }
    const indices = Uint32Array.from(near.index!.array);
    const [small] = MeshoptSimplifier.simplify(
      indices,
      pos,
      3,
      Math.floor((indices.length * 0.22) / 3) * 3,
      0.025,
      ["Permissive"],
    );
    const far = new T.BufferGeometry();
    for (const [key, v] of Object.entries(near.attributes))
      far.setAttribute(key, v as T.BufferAttribute);
    far.morphAttributes = near.morphAttributes;
    far.morphTargetsRelative = near.morphTargetsRelative;
    far.boundingSphere = near.boundingSphere;
    far.boundingBox = near.boundingBox;
    far.setIndex(new T.BufferAttribute(small, 1));
    meshes.push({ mesh: o, near, far });
  });
  return {
    update(distance: number) {
      for (const l of meshes) l.mesh.geometry = distance > 14 ? l.far : l.near;
    },
    dispose() {
      for (const l of meshes) {
        l.mesh.geometry = l.near;
        l.far.dispose();
      }
    },
  };
}
