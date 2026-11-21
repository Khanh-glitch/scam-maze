import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { disposeScene, modelUrl } from "./scene-kit";
export function streetVehicles(
  traffic: { body: T.Group; direction: number }[],
  parked: T.Group,
) {
  const load = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let disposed = false;
  const moving: { root: T.Group; wheels: T.Object3D[]; z: number }[] = [];
  async function add(file: string, slots: number[]) {
    const gltf = await load.loadAsync(modelUrl(`${file}.optimized`));
    if (disposed) {
      disposeScene(gltf.scene);
      return;
    }
    slots.forEach((index) => {
      const host = traffic[index].body;
      const root = new T.LOD();
      const wheels: T.Object3D[] = [];
      for (let i = 0; i < 3; i++) {
        const item = gltf.scene
          .getObjectByName("BikeRider_LOD" + i)
          ?.clone(true);
        if (!item) continue;
        item.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = i < 2;
            o.receiveShadow = i === 0;
          }
          if (/^FrontWheel|^RearWheel/.test(o.name)) wheels.push(o);
        });
        root.addLevel(item, [0, 9, 22][i], 0.12);
      }
      if (root.levels.length) {
        host.children.forEach((c) => (c.visible = false));
        root.scale.setScalar(1.9);
        root.rotation.y = Math.PI;
        root.addLevel(new T.Object3D(), 59, 0.1);
        host.add(root);
        moving.push({ root: host, wheels, z: host.position.z });
      }
    });
  }
  async function car() {
    const g = await load.loadAsync(modelUrl("city-cars.optimized"));
    if (disposed) {
      disposeScene(g.scene);
      return;
    }
    const car = g.scene.getObjectByName("car_00");
    if (!car) return;
    const root = new T.Group();
    root.add(car);
    car.position.set(0, 0, 0);
    const bounds = new T.Box3().setFromObject(root, true),
      size = bounds.getSize(new T.Vector3());
    if (size.x > size.z) car.rotation.y += Math.PI / 2;
    bounds.setFromObject(root, true);
    const mid = bounds.getCenter(new T.Vector3());
    car.position.set(-mid.x, -bounds.min.y, -mid.z);
    root.scale.setScalar(4.1 / Math.max(size.x, size.z));
    const slot = traffic[7].body;
    slot.add(root);
    const mpv = root.clone(true);
    mpv.scale.multiply(new T.Vector3(1.05, 1.17, 1.1));
    mpv.rotation.y = Math.PI;
    parked.add(mpv);
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    disposeScene(g.scene);
  }
  void Promise.all([
    add("bike-rider", [1, 3, 5]),
    add("baothu", [0, 2, 4, 6]),
    car(),
  ]).catch(console.error);
  return {
    update() {
      for (const a of moving) {
        const dz = Math.abs(a.root.position.z - a.z);
        if (dz < 8) for (const w of a.wheels) w.rotation.x += dz / 0.27;
        a.z = a.root.position.z;
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
