import * as THREE from 'three';

/**
 * Retargets animation clips between two humanoid skeletons with different bone names and rest
 * poses (for example Mixamo T-pose clips onto the street NPCs' A-pose skeleton).
 *
 * Method: each mapped bone first gets a fixed alignment that turns its rest direction (toward its
 * main child) onto the source bone's rest direction. Then, at every sample, the source bone's
 * world rotation relative to its rest is applied on top:
 *   targetWorld(t) = sourceWorld(t) * sourceWorldRest^-1 * align * targetWorldRest
 * and converted back to a local rotation under the (already retargeted) parent. The hips also
 * get the source's translation offset, scaled by the leg length ratio.
 */

/** Target bone -> source bone, for the street NPC rig (target) and Mixamo (source). */
export const UE_FROM_MIXAMO: Record<string, string> = (() => {
  const m: Record<string, string> = {
    pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', head: 'Head',
  };
  for (const [s, side] of [['l', 'Left'], ['r', 'Right']] as const) {
    Object.assign(m, {
      [`clavicle_${s}`]: `${side}Shoulder`, [`upperarm_${s}`]: `${side}Arm`, [`lowerarm_${s}`]: `${side}ForeArm`, [`hand_${s}`]: `${side}Hand`,
      [`thigh_${s}`]: `${side}UpLeg`, [`calf_${s}`]: `${side}Leg`, [`foot_${s}`]: `${side}Foot`, [`ball_${s}`]: `${side}ToeBase`,
    });
    for (const [f, F] of [['thumb', 'Thumb'], ['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']] as const) {
      for (const k of [1, 2, 3]) m[`${f}_0${k}_${s}`] = `${side}Hand${F}${k}`;
    }
  }
  return m;
})();

/** The child whose direction defines a target bone's rest direction (leaf bones reuse their parent's alignment). */
const MAIN_CHILD: Record<string, string> = (() => {
  const c: Record<string, string> = { pelvis: 'spine_01', spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'head' };
  for (const s of ['l', 'r']) {
    Object.assign(c, {
      [`clavicle_${s}`]: `upperarm_${s}`, [`upperarm_${s}`]: `lowerarm_${s}`, [`lowerarm_${s}`]: `hand_${s}`, [`hand_${s}`]: `middle_01_${s}`,
      [`thigh_${s}`]: `calf_${s}`, [`calf_${s}`]: `foot_${s}`, [`foot_${s}`]: `ball_${s}`,
    });
    for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) { c[`${f}_01_${s}`] = `${f}_02_${s}`; c[`${f}_02_${s}`] = `${f}_03_${s}`; }
  }
  return c;
})();

const stripPrefix = (n: string) => n.replace(/^mixamorig\d*:?/i, '');

function boneMap(root: THREE.Object3D, strip = false): Map<string, THREE.Bone> {
  const m = new Map<string, THREE.Bone>();
  root.traverse((o) => { if ((o as THREE.Bone).isBone) m.set(strip ? stripPrefix(o.name) : o.name, o as THREE.Bone); });
  return m;
}

function legLength(bones: Map<string, THREE.Bone>, thigh: string, foot: string): number {
  const a = bones.get(thigh), b = bones.get(foot);
  if (!a || !b) return 1;
  return a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3()));
}

/**
 * Builds `clip` for `target` (an unanimated clone at rest) from `source` (a clone at rest) and
 * returns a new clip named `name`. `map` is target bone -> source bone (source names without the
 * Mixamo prefix). Both objects must be clones nobody else animates.
 */
export function retargetClip(source: THREE.Object3D, target: THREE.Object3D, clip: THREE.AnimationClip, name: string, map: Record<string, string> = UE_FROM_MIXAMO, fps = 30): THREE.AnimationClip {
  source.updateMatrixWorld(true); target.updateMatrixWorld(true);
  const src = boneMap(source, true), tgt = boneMap(target);
  const order: THREE.Bone[] = [];
  target.traverse((o) => { if ((o as THREE.Bone).isBone) order.push(o as THREE.Bone); });

  // Rest data.
  const q = () => new THREE.Quaternion();
  const srcRest = new Map<string, THREE.Quaternion>(), tgtRest = new Map<string, THREE.Quaternion>(), align = new Map<string, THREE.Quaternion>();
  const restLocal = new Map<THREE.Bone, THREE.Quaternion>();
  for (const b of order) restLocal.set(b, b.quaternion.clone());
  for (const [t, s] of Object.entries(map)) {
    const tb = tgt.get(t), sb = src.get(s);
    if (!tb || !sb) continue;
    srcRest.set(t, sb.getWorldQuaternion(q()));
    tgtRest.set(t, tb.getWorldQuaternion(q()));
  }
  for (const b of order) {
    const t = b.name;
    if (!tgtRest.has(t)) continue;
    const child = MAIN_CHILD[t], tc = child && tgt.get(child), sc = child && map[child] && src.get(map[child]);
    const sb = src.get(map[t])!;
    if (tc && sc) {
      const dt = tc.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
      const ds = sc.getWorldPosition(new THREE.Vector3()).sub(sb.getWorldPosition(new THREE.Vector3())).normalize();
      align.set(t, q().setFromUnitVectors(dt, ds));
    } else {
      // Leaf bone: reuse the parent's alignment so it keeps its rest pose relative to the parent.
      const parent = b.parent as THREE.Bone | null;
      align.set(t, (parent && align.get(parent.name)?.clone()) ?? q());
    }
  }
  const hipsT = tgt.get('pelvis'), hipsS = src.get(map.pelvis ?? 'Hips');
  const legRatio = legLength(tgt, 'thigh_l', 'foot_l') / legLength(src, 'LeftUpLeg', 'LeftFoot');
  // Hips offsets are taken in world space (Mixamo files often have a scaled parent node).
  const hipsRestS = hipsS ? hipsS.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
  const hipsRestT = hipsT ? hipsT.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
  const pos = new THREE.Vector3();

  // Sample.
  const mixer = new THREE.AnimationMixer(source);
  mixer.clipAction(clip).play();
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(frames);
  const values = new Map<string, Float32Array>();
  for (const t of tgtRest.keys()) values.set(t, new Float32Array(frames * 4));
  const hipsPos = new Float32Array(frames * 3);
  const world = new Map<THREE.Bone, THREE.Quaternion>();
  const tmp = q(), inv = q();
  const targetRootQ = target.getWorldQuaternion(q());
  for (let f = 0; f < frames; f++) {
    const time = Math.min(clip.duration, f / fps);
    times[f] = time;
    mixer.setTime(time);
    source.updateMatrixWorld(true);
    world.clear();
    for (const b of order) {
      const parentWorld = (b.parent && world.get(b.parent as THREE.Bone)) ?? (b.parent ? b.parent.getWorldQuaternion(q()) : targetRootQ);
      let w: THREE.Quaternion;
      const t = b.name, sb = tgtRest.has(t) ? src.get(map[t]) : undefined;
      if (sb) {
        // sourceWorld(t) * sourceWorldRest^-1 * align * targetWorldRest
        w = sb.getWorldQuaternion(q()).multiply(inv.copy(srcRest.get(t)!).invert()).multiply(align.get(t)!).multiply(tgtRest.get(t)!);
        const local = tmp.copy(parentWorld).invert().multiply(w);
        values.get(t)!.set([local.x, local.y, local.z, local.w], f * 4);
      } else {
        w = parentWorld.clone().multiply(restLocal.get(b)!);
      }
      world.set(b, w);
    }
    if (hipsS && hipsT) {
      hipsS.getWorldPosition(pos).sub(hipsRestS).multiplyScalar(legRatio).add(hipsRestT);
      if (hipsT.parent) hipsT.parent.worldToLocal(pos);
      hipsPos.set([pos.x, pos.y, pos.z], f * 3);
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(source);
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [t, v] of values) tracks.push(new THREE.QuaternionKeyframeTrack(`${t}.quaternion`, times, v));
  if (hipsS && hipsT) tracks.push(new THREE.VectorKeyframeTrack('pelvis.position', times, hipsPos));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

/**
 * A still sitting pose for the street NPC rig (`pelvis`, `thigh_l`, `calf_l`, `foot_l`, ...) on a
 * seat `seatHeight` m high, as a looping one-frame clip named `name`. Built from the model's own
 * rest pose (feet on y = 0, facing +Z, model units = meters):
 * - the pelvis drops so the hip joints sit `HIP_ABOVE_SEAT` above the seat;
 * - each leg: the shin stands vertical with the ankle at its rest height, the thigh reaches from
 *   the hip to the knee on top of it (knees rise above the hips on a low stool), feet stay flat;
 * - the upper arms hang forward and the forearms rest toward the knees; spine and head keep the rest pose.
 */
const HIP_ABOVE_SEAT = 0.09;

export function sitClip(target: THREE.Object3D, seatHeight: number, name = 'sit'): THREE.AnimationClip | null {
  target.updateMatrixWorld(true);
  const bones = boneMap(target);
  const need = ['pelvis', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'];
  if (need.some((n) => !bones.has(n))) return null;
  const order: THREE.Bone[] = [];
  target.traverse((o) => { if ((o as THREE.Bone).isBone) order.push(o as THREE.Bone); });
  const wp = (n: string) => bones.get(n)!.getWorldPosition(new THREE.Vector3());
  const restWorld = new Map<THREE.Bone, THREE.Quaternion>(), restLocal = new Map<THREE.Bone, THREE.Quaternion>();
  for (const b of order) { restWorld.set(b, b.getWorldQuaternion(new THREE.Quaternion())); restLocal.set(b, b.quaternion.clone()); }

  // Pelvis offset and the joint targets in world space.
  const drop = seatHeight + HIP_ABOVE_SEAT - (wp('thigh_l').y + wp('thigh_r').y) / 2;
  const shift = new THREE.Vector3(0, drop, -0.04);
  const dirs = new Map<string, THREE.Vector3>();
  for (const s of ['l', 'r']) {
    const hip = wp(`thigh_${s}`).add(shift), knee0 = wp(`calf_${s}`), ankle0 = wp(`foot_${s}`);
    const l1 = knee0.distanceTo(wp(`thigh_${s}`)), l2 = ankle0.distanceTo(knee0);
    const kneeY = ankle0.y + l2;
    const sinA = THREE.MathUtils.clamp((kneeY - hip.y) / l1, -0.95, 0.95);
    const knee = new THREE.Vector3(hip.x * 1.08, kneeY, hip.z + l1 * Math.sqrt(1 - sinA * sinA));
    const ankle = new THREE.Vector3(knee.x, ankle0.y, knee.z + 0.04);
    dirs.set(`thigh_${s}`, knee.clone().sub(hip).normalize());
    dirs.set(`calf_${s}`, ankle.clone().sub(knee).normalize());
    dirs.set(`upperarm_${s}`, new THREE.Vector3(0, -0.82, 0.57).normalize());
    dirs.set(`lowerarm_${s}`, new THREE.Vector3(s === 'l' ? -0.08 : 0.08, -0.35, 0.93).normalize());
  }
  const childOf: Record<string, string> = {};
  for (const s of ['l', 'r']) Object.assign(childOf, { [`thigh_${s}`]: `calf_${s}`, [`calf_${s}`]: `foot_${s}`, [`upperarm_${s}`]: `lowerarm_${s}`, [`lowerarm_${s}`]: `hand_${s}` });
  /** Bones kept at their rest world orientation (flat feet, level hands). */
  const keepWorld = new Set(['foot_l', 'foot_r', 'ball_l', 'ball_r']);

  const world = new Map<THREE.Bone, THREE.Quaternion>();
  const tracks: THREE.KeyframeTrack[] = [];
  const targetRoot = target.getWorldQuaternion(new THREE.Quaternion());
  for (const b of order) {
    const parentWorld = (b.parent && world.get(b.parent as THREE.Bone)) ?? (b.parent ? b.parent.getWorldQuaternion(new THREE.Quaternion()) : targetRoot);
    let w: THREE.Quaternion;
    const want = dirs.get(b.name);
    if (want) {
      const rest = bones.get(childOf[b.name])!.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();
      w = new THREE.Quaternion().setFromUnitVectors(rest, want).multiply(restWorld.get(b)!);
    } else if (keepWorld.has(b.name)) {
      w = restWorld.get(b)!.clone();
    } else {
      w = parentWorld.clone().multiply(restLocal.get(b)!);
    }
    world.set(b, w);
    const local = parentWorld.clone().invert().multiply(w);
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, [0, 1], [local.x, local.y, local.z, local.w, local.x, local.y, local.z, local.w]));
  }
  const pelvis = bones.get('pelvis')!;
  const p = pelvis.getWorldPosition(new THREE.Vector3()).add(shift);
  if (pelvis.parent) pelvis.parent.worldToLocal(p);
  tracks.push(new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], [p.x, p.y, p.z, p.x, p.y, p.z]));
  return new THREE.AnimationClip(name, 1, tracks);
}
