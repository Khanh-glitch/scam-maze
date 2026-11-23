import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { disposeScene } from "./scene-kit";
import { bakeStaticVehicle, fixVanWheels, instantiateBaked, mergeVehicleBody, simplifyInPlace, type BakedLevel } from "./vehicleLod";
import { equipVehicle, wheelRadius, wheelSpinSigns } from "./vehicleCrew";
import { addHeadlightBeam, markLampParts } from "./vehicleLights";

/** Real-world length (m) the Mula van model is scaled to. The GLB is already ~3.4 m long. */
export const VAN_LENGTH = 3.9;

export interface ParkedBikeSlot {
  parent: T.Group;
  x: number;
  y: number;
  z: number;
  ry: number;
}

function normalizeVehicleToGround(
  src: T.Object3D,
  targetLength: number,
  facePosZ: boolean,
  castShadow = true,
): { root: T.Group; wheels: T.Object3D[] } {
  const clone = src.clone(true);
  const root = new T.Group();
  root.add(clone);
  const wheels: T.Object3D[] = [];
  clone.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = castShadow;
      o.receiveShadow = true;
    }
    if (/^wheel_/i.test(o.name)) wheels.push(o);
  });

  const bounds = new T.Box3().setFromObject(clone, true);
  const size = bounds.getSize(new T.Vector3());
  if (size.x > size.z) clone.rotation.y += Math.PI / 2;
  if (facePosZ) clone.rotation.y += Math.PI;
  clone.updateMatrixWorld(true);
  bounds.setFromObject(clone, true);
  const mid = bounds.getCenter(new T.Vector3());
  const len = Math.max(bounds.max.z - bounds.min.z, 0.5);
  const sc = targetLength / len;
  clone.position.set(-mid.x, -bounds.min.y, -mid.z);
  root.scale.setScalar(sc);
  return { root, wheels };
}

export function streetVehicles(
  traffic: { body: T.Group; direction: number }[],
  parkedSuv: T.Group,
  parkedVan?: T.Group,
  movingTruck?: T.Group,
  parkedBikes: ParkedBikeSlot[] = [],
  onAssetLoaded?: (obj: T.Object3D) => void,
) {
  const load = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let disposed = false;
  const moving: { root: T.Group; wheels: { node: T.Object3D; sign: number }[]; z: number; wheelRadius: number }[] = [];
  const hostForward = (host: T.Object3D, direction: number) =>
    new T.Vector3(0, 0, direction).applyQuaternion(host.getWorldQuaternion(new T.Quaternion()).invert());
  const registerMoving = (host: T.Group, wheels: T.Object3D[], direction: number, fallbackRadius: number, radius?: number) => {
    const signs = wheelSpinSigns(host, wheels, hostForward(host, direction));
    moving.push({
      root: host,
      wheels: wheels.map((node, i) => ({ node, sign: signs[i] })),
      z: host.position.z,
      wheelRadius: radius ?? (wheels[0] ? wheelRadius(wheels[0], fallbackRadius) : fallbackRadius),
    });
  };
  let crewCount = 0;

  async function addRider(file: string, slots: number[]) {
    const gltf = await load.loadAsync(`/assets/testbus/ow/models/${file}.optimized.glb`);
    if (disposed) {
      disposeScene(gltf.scene);
      return;
    }
    slots.forEach((index) => {
      const host = traffic[index]?.body;
      if (!host) return;
      const root = new T.LOD();
      const wheels: T.Object3D[] = [];
      for (let i = 0; i < 3; i++) {
        const item = gltf.scene.getObjectByName("BikeRider_LOD" + i)?.clone(true);
        if (!item) continue;
        item.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = i < 2;
            o.receiveShadow = i === 0;
          }
          if (/^FrontWheel|^RearWheel/.test(o.name)) wheels.push(o);
        });
        root.addLevel(item, [0, 12, 28][i], 0.12);
      }
      if (root.levels.length) {
        host.children.forEach((c) => (c.visible = false));
        root.scale.setScalar(1.9);
        root.rotation.y = Math.PI;
        root.addLevel(new T.Object3D(), 68, 0.1);
        host.add(root);
        host.updateWorldMatrix(true, true);
        if (markLampParts(host, root, hostForward(host, traffic[index].direction)).head) {
          addHeadlightBeam(host, root, hostForward(host, traffic[index].direction), "moto");
        }
        registerMoving(host, wheels, traffic[index].direction, 0.27, 0.27);
      }
    });
  }

  async function addRealisticMotorbikes(slots: number[]) {
    const [motoGltf, pcxGltf, cubGltf] = await Promise.all([
      load.loadAsync("/assets/testbus/ow/models/vehicles/motorbike.glb").catch(() => null),
      load.loadAsync("/assets/testbus/ow/models/bike-pcx.optimized.glb").catch(() => null),
      load.loadAsync("/assets/testbus/ow/models/bike-supercub.optimized.glb").catch(() => null),
    ]);
    if (disposed) {
      if (motoGltf) disposeScene(motoGltf.scene);
      if (pcxGltf) disposeScene(pcxGltf.scene);
      if (cubGltf) disposeScene(cubGltf.scene);
      return;
    }

    // Moving realistic PBR motorbikes on Lý Thái Tổ, each with a rider (only baothu / bike-rider come pre-ridden).
    if (motoGltf) {
      for (const index of slots) {
        const host = traffic[index]?.body;
        if (!host) continue;
        const { root, wheels } = normalizeVehicleToGround(motoGltf.scene, 2.08, true, false);
        await simplifyInPlace(root, 0.4);
        if (disposed) return;
        host.children.forEach((c) => (c.visible = false));
        host.add(root);
        host.updateWorldMatrix(true, true);
        const motoLamps = markLampParts(host, root, hostForward(host, traffic[index].direction));
        const { vehicle, crew } = await equipVehicle({
          host,
          vehicle: root,
          kind: "moto",
          forward: hostForward(host, traffic[index].direction),
          variant: crewCount++,
          isDisposed: () => disposed,
        });
        if (motoLamps.head) addHeadlightBeam(host, vehicle, hostForward(host, traffic[index].direction), "moto");
        onAssetLoaded?.(vehicle);
        if (crew) onAssetLoaded?.(crew.root);
        registerMoving(host, wheels, traffic[index].direction, 0.3, 0.3);
      }
    }
    // Replace ALL procedural parked sidewalk scooters along Lý Thái Tổ with REAL 3D GLB motorbikes!
    const pool = [
      pcxGltf ? { scene: pcxGltf.scene, len: 1.92, flip: false } : null,
      cubGltf ? { scene: cubGltf.scene, len: 1.84, flip: false } : null,
      motoGltf ? { scene: motoGltf.scene, len: 2.04, flip: true } : null,
    ].filter((x): x is { scene: T.Group; len: number; flip: boolean } => x !== null);

    if (pool.length > 0 && parkedBikes.length > 0) {
      // Bake each parked bike model ONCE (merge by material + simplified LODs) and share it across every slot.
      const baked: (BakedLevel[] | null)[] = [];
      for (const pick of pool) {
        const { root } = normalizeVehicleToGround(pick.scene, pick.len, pick.flip, false);
        baked.push(await bakeStaticVehicle(root));
      }
      if (disposed) return;
      parkedBikes.forEach((slot, i) => {
        const levels = baked[i % pool.length];
        if (!levels) return;
        const lod = instantiateBaked(levels, 60);
        lod.position.set(slot.x, slot.y, slot.z);
        lod.rotation.set(0, slot.ry, -0.05);
        lod.matrixAutoUpdate = false;
        lod.updateMatrix();
        slot.parent.add(lod);
        if (i < pool.length) onAssetLoaded?.(lod);
      });
    }
  }
  async function equipFourWheeler(host: T.Group, vehicle: T.Object3D, direction: number, fallbackRadius: number) {
    host.children.forEach((c) => (c.visible = false));
    host.add(vehicle);
    host.updateWorldMatrix(true, true);
    const lamps = markLampParts(host, vehicle, hostForward(host, direction));
    const { vehicle: placed, crew } = await equipVehicle({
      host,
      vehicle,
      kind: "car",
      forward: hostForward(host, direction),
      variant: crewCount++,
      isDisposed: () => disposed,
    });
    if (disposed) return;
    const wheels: T.Object3D[] = [];
    placed.traverse((o) => {
      if (/^wheel_/i.test(o.name)) wheels.push(o);
    });
    if (lamps.head) addHeadlightBeam(host, placed, hostForward(host, direction), "car");
    onAssetLoaded?.(placed);
    if (crew) onAssetLoaded?.(crew.root);
    registerMoving(host, wheels, direction, fallbackRadius);
  }
  async function addRealisticFourWheelers() {
    const [taxiGltf, suvGltf, vanGltf] = await Promise.all([
      load.loadAsync("/assets/testbus/ow/models/vehicles/taxi_corolla.glb").catch(() => null),
      load.loadAsync("/assets/testbus/ow/models/vehicles/savanna.glb").catch(() => null),
      load.loadAsync("/assets/testbus/ow/models/vehicles/mula_van.glb").catch(() => null),
    ]);
    if (disposed) {
      if (taxiGltf) disposeScene(taxiGltf.scene);
      if (suvGltf) disposeScene(suvGltf.scene);
      if (vanGltf) disposeScene(vanGltf.scene);
      return;
    }

    if (vanGltf) fixVanWheels(vanGltf.scene);
    // Moving Saigon Corolla Taxi on Lý Thái Tổ lane (with a driver)
    const taxiHost = traffic[7]?.body;
    if (taxiHost && taxiGltf) {
      const { root } = normalizeVehicleToGround(taxiGltf.scene, 4.45, true, false);
      await equipFourWheeler(taxiHost, root, traffic[7].direction, 0.34);
    }

    // Parked realistic urban SUV beside Lý Thái Tổ Bus Station curb
    if (suvGltf) {
      const { root: suvRoot } = normalizeVehicleToGround(suvGltf.scene, 4.55, false, false);
      mergeVehicleBody(suvRoot);
      parkedSuv.children.forEach((c) => (c.visible = false));
      parkedSuv.add(suvRoot);
      onAssetLoaded?.(suvRoot);
    }

    // Parked commercial van beside the curb. The GLB is a compact van, so it is scaled to a real van length.
    if (parkedVan && vanGltf) {
      const { root: vanRoot } = normalizeVehicleToGround(vanGltf.scene, VAN_LENGTH, false, false);
      mergeVehicleBody(vanRoot);
      parkedVan.children.forEach((c) => (c.visible = false));
      parkedVan.add(vanRoot);
      onAssetLoaded?.(vanRoot);
    }

    // Moving delivery van on Lý Thái Tổ (same model and scale as the parked one, with a driver)
    const vanHost = movingTruck;
    const vanDirection = traffic.find((t) => t.body === movingTruck)?.direction ?? -1;
    if (vanHost && vanGltf) {
      const { root: vanRoot } = normalizeVehicleToGround(vanGltf.scene, VAN_LENGTH, false, false);
      await equipFourWheeler(vanHost, vanRoot, vanDirection, 0.34);
    }
  }

  void Promise.all([
    addRider("bike-rider", [1, 3]),
    addRider("baothu", [0, 4, 6]),
    addRealisticMotorbikes([2, 5]),
    addRealisticFourWheelers(),
  ]).catch(console.error);

  return {
    update() {
      for (const a of moving) {
        const dz = Math.abs(a.root.position.z - a.z);
        if (dz < 8) {
          const turn = dz / a.wheelRadius;
          for (const w of a.wheels) w.node.rotation.x += w.sign * turn;
        }
        a.z = a.root.position.z;
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
