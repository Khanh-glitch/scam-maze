import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { warmSkin } from "./drive-look";
import { mergeVehicleBody } from "./vehicleLod";

/**
 * Seated drivers and riders for moving vehicles. Every moving vehicle except the two that already carry a rider
 * (`baothu` and `bike-rider`) gets one of the street NPC models, posed with simple bone aiming + two-bone arm IK.
 */

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const FILES = [
  "npc-alan",
  "npc-arthur",
  "manvn",
  "npc-yoshida",
  "npc-nguoigia",
  "npc-blackguy",
  "rowan",
  "juno3",
  "npc-napole",
  "npc-sofia",
  "npc-linmei",
  "npc-freya",
];
/** Long robes (the kimono) do not bend with a seated pose: on a motorbike they hang off the back like a fallen rider. */
const NO_MOTO = new Set(["npc-nguoigia"]);
const MOTO_FILES = FILES.filter((f) => !NO_MOTO.has(f));
/**
 * The pose code uses the Unreal-style bone names (`pelvis`, `thigh_l`, ...). The Mixamo rigs (`rowan`, `juno3`,
 * `manvn`) name the same joints differently; without this map they were left in their T-pose (arms spread, standing).
 */
const MIXAMO: Record<string, string> = {
  pelvis: "Hips",
  spine_01: "Spine",
  spine_02: "Spine1",
  head: "Head",
  thigh_l: "LeftUpLeg",
  calf_l: "LeftLeg",
  foot_l: "LeftFoot",
  thigh_r: "RightUpLeg",
  calf_r: "RightLeg",
  foot_r: "RightFoot",
  upperarm_l: "LeftArm",
  lowerarm_l: "LeftForeArm",
  hand_l: "LeftHand",
  upperarm_r: "RightArm",
  lowerarm_r: "RightForeArm",
  hand_r: "RightHand",
};
function findBone(root: T.Object3D, name: string): T.Object3D | undefined {
  const direct = root.getObjectByName(name);
  if (direct) return direct;
  const base = MIXAMO[name];
  if (!base) return undefined;
  return root.getObjectByName(`mixamorig${base}`) ?? root.getObjectByName(`mixamorig:${base}`) ?? root.getObjectByName(base) ?? undefined;
}
const cache = new Map<string, Promise<T.Group | null>>();
function source(file: string) {
  let p = cache.get(file);
  if (!p) {
    p = loader
      .loadAsync(`/assets/testbus/ow/models/${file}.optimized.glb`)
      .then((g) => g.scene)
      .catch(() => null);
    cache.set(file, p);
  }
  return p;
}

export type CrewKind = "car" | "moto";

export interface SeatSpec {
  /** Pelvis target in the host's local space. */
  pelvis: T.Vector3;
  /** Horizontal unit vector the vehicle drives toward, in host-local space. */
  forward: T.Vector3;
  /** Hand targets (host-local) for the steering wheel / handlebar grips. */
  handL: T.Vector3;
  handR: T.Vector3;
}

const UP = new T.Vector3(0, 1, 0);

function nodeCentre(host: T.Object3D, node: T.Object3D): T.Vector3 {
  const box = new T.Box3().setFromObject(node, true);
  return host.worldToLocal(box.getCenter(new T.Vector3()));
}

/**
 * Find the driving position of a vehicle from its named parts. Must run BEFORE the body meshes are merged,
 * and after the vehicle sits at its final place under `host`.
 */
export function findSeat(host: T.Object3D, vehicle: T.Object3D, kind: CrewKind): SeatSpec | null {
  host.updateWorldMatrix(true, true);
  const named = (re: RegExp) => {
    let hit: T.Object3D | null = null;
    vehicle.traverse((o) => {
      if (!hit && re.test(o.name)) hit = o;
    });
    return hit as T.Object3D | null;
  };
  if (kind === "car") {
    const front = [named(/^wheel_FL/i), named(/^wheel_FR/i)].filter((x): x is T.Object3D => !!x);
    const rear = [named(/^wheel_RL/i), named(/^wheel_RR/i)].filter((x): x is T.Object3D => !!x);
    const steer = named(/^steering_wheel/i);
    if (!front.length || !rear.length || !steer) return null;
    const avg = (list: T.Object3D[]) =>
      list.reduce((a, o) => a.add(host.worldToLocal(o.getWorldPosition(new T.Vector3()))), new T.Vector3()).multiplyScalar(1 / list.length);
    const forward = avg(front).sub(avg(rear));
    forward.y = 0;
    forward.normalize();
    const side = new T.Vector3().crossVectors(forward, UP).normalize();
    const wheel = host.worldToLocal(steer.getWorldPosition(new T.Vector3()));
    const pelvis = wheel.clone().addScaledVector(forward, -0.42);
    pelvis.y = wheel.y - 0.34;
    return {
      pelvis,
      forward,
      handL: wheel.clone().addScaledVector(side, -0.15).add(new T.Vector3(0, 0.02, 0)),
      handR: wheel.clone().addScaledVector(side, 0.15).add(new T.Vector3(0, 0.02, 0)),
    };
  }
  const head = named(/farol/i);
  const tail = named(/luzes.*tras/i);
  const seat = named(/banco/i);
  const grip = named(/acelerador/i);
  if (!head || !tail || !seat) return null;
  const forward = nodeCentre(host, head).sub(nodeCentre(host, tail));
  forward.y = 0;
  forward.normalize();
  const seatBox = new T.Box3().setFromObject(seat, true);
  const seatTop = host.worldToLocal(new T.Vector3(0, seatBox.max.y, 0)).y;
  const seatC = nodeCentre(host, seat);
  const pelvis = new T.Vector3(seatC.x, seatTop + 0.1, seatC.z).addScaledVector(forward, -0.05);
  const side = new T.Vector3().crossVectors(forward, UP).normalize();
  let gripPoint = seatC.clone().addScaledVector(forward, 0.62);
  gripPoint.y = seatTop + 0.42;
  if (grip) {
    const g = nodeCentre(host, grip);
    gripPoint = g;
  }
  const lateral = gripPoint.clone().sub(seatC).dot(side);
  const centre = gripPoint.clone().addScaledVector(side, -lateral);
  const half = Math.max(0.2, Math.min(0.34, Math.abs(lateral)));
  return {
    pelvis,
    forward,
    handL: centre.clone().addScaledVector(side, -half),
    handR: centre.clone().addScaledVector(side, half),
  };
}

function aim(bone: T.Object3D | undefined, child: T.Object3D | undefined, toWorld: T.Vector3) {
  if (!bone || !child || !bone.parent) return;
  const q = bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
  const dir = child
    .getWorldPosition(new T.Vector3())
    .sub(bone.getWorldPosition(new T.Vector3()))
    .normalize()
    .applyQuaternion(q);
  bone.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(dir, toWorld.clone().normalize().applyQuaternion(q)));
  bone.updateMatrixWorld(true);
}

/** Two-bone IK in world space: bend the elbow toward `hint` and put the hand on `target`. */
function reach(
  upper: T.Object3D | undefined,
  lower: T.Object3D | undefined,
  hand: T.Object3D | undefined,
  target: T.Vector3,
  hint: T.Vector3,
) {
  if (!upper || !lower || !hand) return;
  const s = upper.getWorldPosition(new T.Vector3());
  const e = lower.getWorldPosition(new T.Vector3());
  const h = hand.getWorldPosition(new T.Vector3());
  const l1 = s.distanceTo(e);
  const l2 = e.distanceTo(h);
  const toTarget = target.clone().sub(s);
  const d = Math.min(Math.max(toTarget.length(), 0.05), (l1 + l2) * 0.995);
  const dir = toTarget.normalize();
  const a = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const height = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pole = hint.clone().addScaledVector(dir, -hint.dot(dir)).normalize();
  const elbow = s.clone().addScaledVector(dir, a).addScaledVector(pole, height);
  aim(upper, lower, elbow.clone().sub(s));
  aim(lower, hand, s.clone().addScaledVector(dir, d).sub(elbow));
}

export interface CrewMember {
  root: T.Group;
  dispose(): void;
}

/** Add a seated driver / rider to `host`. Returns null when the model or the seat cannot be resolved. */
export async function addCrew(
  host: T.Object3D,
  seat: SeatSpec,
  kind: CrewKind,
  variant: number,
  isDisposed: () => boolean,
): Promise<CrewMember | null> {
  const files = kind === "moto" ? MOTO_FILES : FILES;
  const src = await source(files[variant % files.length]);
  if (!src || isDisposed()) return null;
  const obj = cloneSkinned(src) as T.Group;
  const crew = new T.Group();
  crew.name = "VehicleCrew";
  crew.add(obj);
  const bounds = new T.Box3().setFromObject(obj, true);
  const height = 1.64 + (variant % 4) * 0.035;
  obj.scale.setScalar(height / Math.max(0.1, bounds.max.y - bounds.min.y));
  obj.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.name === "HumanBody") {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m instanceof T.MeshStandardMaterial) warmSkin(m);
        }
      }
    }
  });
  // Face the vehicle's driving direction (the rig faces +z).
  crew.rotation.y = Math.atan2(seat.forward.x, seat.forward.z);
  host.add(crew);
  host.updateWorldMatrix(true, true);
  const bone = (n: string) => findBone(obj, n);
  const fwdW = seat.forward.clone().transformDirection(host.matrixWorld);
  const sideW = new T.Vector3().crossVectors(fwdW, UP).normalize();
  const point = (v: T.Vector3) => v.clone().applyMatrix4(host.matrixWorld);
  for (const [side, sign] of [["l", -1], ["r", 1]] as const) {
    const lateral = sideW.clone().multiplyScalar(sign * (kind === "moto" ? 0.3 : 0.1));
    if (kind === "moto") {
      aim(bone(`thigh_${side}`), bone(`calf_${side}`), fwdW.clone().multiplyScalar(0.85).add(lateral).add(new T.Vector3(0, -0.3, 0)));
      aim(bone(`calf_${side}`), bone(`foot_${side}`), fwdW.clone().multiplyScalar(-0.2).add(new T.Vector3(0, -1, 0)));
    } else {
      aim(bone(`thigh_${side}`), bone(`calf_${side}`), fwdW.clone().multiplyScalar(0.97).add(lateral).add(new T.Vector3(0, -0.08, 0)));
      aim(bone(`calf_${side}`), bone(`foot_${side}`), fwdW.clone().multiplyScalar(-0.12).add(new T.Vector3(0, -1, 0)));
    }
  }
  // Seat the pelvis, then reach for the wheel / bars.
  const pelvis = bone("pelvis");
  if (pelvis) {
    crew.position.copy(seat.pelvis).sub(host.worldToLocal(pelvis.getWorldPosition(new T.Vector3())).sub(crew.position));
    host.updateWorldMatrix(true, true);
  }
  if (kind === "moto") {
    // Lean the torso toward the bars a little.
    aim(bone("spine_01"), bone("spine_02"), fwdW.clone().multiplyScalar(0.28).add(new T.Vector3(0, 1, 0)));
  }
  host.updateWorldMatrix(true, true);
  for (const [side, target, sign] of [["l", seat.handL, -1], ["r", seat.handR, 1]] as const) {
    const hint = new T.Vector3(0, -0.8, 0).addScaledVector(sideW, sign * 0.12).addScaledVector(fwdW, -0.25);
    reach(bone(`upperarm_${side}`), bone(`lowerarm_${side}`), bone(`hand_${side}`), point(target), hint);
  }
  obj.updateMatrixWorld(true);
  return {
    root: crew,
    dispose() {
      crew.removeFromParent();
    },
  };
}

/**
 * Sign (+1/-1) to apply to `wheel.rotation.x` per unit of travel so each wheel rolls in the direction the vehicle
 * moves. Works from the wheel's own axle direction, so it is correct for left/right wheels and flipped models.
 */
export function wheelSpinSigns(host: T.Object3D, wheels: T.Object3D[], forwardLocal: T.Vector3): number[] {
  host.updateWorldMatrix(true, true);
  const hostInv = host.getWorldQuaternion(new T.Quaternion()).invert();
  return wheels.map((w) => {
    const parentQ = (w.parent ?? host).getWorldQuaternion(new T.Quaternion());
    const axle = new T.Vector3(1, 0, 0).applyQuaternion(parentQ).applyQuaternion(hostInv);
    const rolls = new T.Vector3().crossVectors(axle, UP);
    return rolls.dot(forwardLocal) >= 0 ? 1 : -1;
  });
}

/** World-size wheel radius of a wheel node (half its height). */
export function wheelRadius(wheel: T.Object3D, fallback: number): number {
  const size = new T.Box3().setFromObject(wheel, true).getSize(new T.Vector3());
  return size.y > 0.05 ? size.y / 2 : fallback;
}

/**
 * Make a moving vehicle drive "forward" (host-local `forward`), merge its body to a few draw calls and seat a
 * driver. Returns the vehicle node to use (it is wrapped in a flipped group when the model faced backwards).
 */
export async function equipVehicle(opts: {
  host: T.Object3D;
  vehicle: T.Object3D;
  kind: CrewKind;
  forward: T.Vector3;
  variant: number;
  isDisposed: () => boolean;
  withCrew?: boolean;
}): Promise<{ vehicle: T.Object3D; crew: CrewMember | null }> {
  const { host, kind, forward, variant, isDisposed } = opts;
  let vehicle = opts.vehicle;
  let seat = findSeat(host, vehicle, kind);
  if (seat && seat.forward.dot(forward) < 0 && vehicle.parent) {
    const parent = vehicle.parent;
    const flip = new T.Group();
    flip.rotation.y = Math.PI;
    parent.add(flip);
    flip.add(vehicle);
    vehicle = flip;
    seat = findSeat(host, vehicle, kind);
  }
  if (kind === "car") mergeVehicleBody(vehicle);
  let crew: CrewMember | null = null;
  if (seat && opts.withCrew !== false) crew = await addCrew(host, seat, kind, variant, isDisposed);
  return { vehicle, crew };
}
