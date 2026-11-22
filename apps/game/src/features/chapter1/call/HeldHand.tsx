// The right hand that holds the phone brought up with P (like in GTA VI). It is the first-person arms
// model the room uses (`first_person_animations.glb`), frozen in a relaxed pose whose fingers
// curl naturally around the phone, with the thumb resting along the side and the left arm
// folded away. It lives in the phone's own canvas, as a child of the phone rig, so it follows the
// phone and the phone (and the page on its screen) are drawn over it. DOM-free; no light: the skin
// takes the same studio reflections as the phone.
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, type FC } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { ARMS_MODEL_PATH } from "../../player/runtime/CharacterAssetCache";
import { createPhoneReflectionMap } from "./phoneReflections";

/** The pose: a clip and the time it is frozen at (the relaxed idle hand curls its fingers). */
const POSE_CLIP = "rig|Idle";
const POSE_TIME_S = 0.5;
/**
 * Extra bone turns (radians, local XYZ) on top of the pose, so the hand grips the phone: all four
 * fingers curl around the left edge, stacked side by side without passing into each other (measured:
 * at least 1.36 cm between neighbouring finger bones), with their tips turned back toward the screen;
 * the index spreads a little (local Z) to reach the edge. The thumb stands up along the right edge,
 * beside the screen. In this rig the ring finger flexes about -X, the other fingers about +X.
 */
const BONE_TURNS: Readonly<Record<string, readonly [number, number, number]>> = {
  "DEF-f_index.01.R": [-0.234, 0.115, 0.222],
  "DEF-f_index.02.R": [-0.7, 0, 0],
  "DEF-f_index.03.R": [-0.2, 0, 0],
  "DEF-f_middle.01.R": [0.162, 0.197, 0.455],
  "DEF-f_middle.02.R": [-0.5, 0, 0],
  "DEF-f_middle.03.R": [0.8, 0, 0],
  "DEF-f_ring.01.R": [0.2, 0, -0.4],
  "DEF-f_ring.02.R": [-0.6, 0, 0],
  "DEF-f_ring.03.R": [-0.9, 0, 0],
  "DEF-f_pinky.01.R": [-1.185, -0.077, 0.693],
  "DEF-f_pinky.02.R": [1.4, 0, 0],
  "DEF-f_pinky.03.R": [-0.1, 0, 0],
  "DEF-thumb.01.R": [-0.476, 0.073, -0.24],
  "DEF-thumb.02.R": [0.127, 0.008, 0.161],
  "DEF-thumb.03.R": [-0.471, -0.047, 0.177],
};
/** Bones scaled to nothing: the left arm is not in the picture. */
const HIDDEN_BONES = [
  "DEF-shoulder.L",
  "DEF-upper_arm.L",
  "DEF-upper_arm.L.001",
  "DEF-forearm.L",
  "DEF-hand.L",
] as const;
/**
 * Where the palm goes in the phone rig's space (meters; the screen faces +z): behind the lower right
 * of the phone, the palm toward its back, the hand pointing up and left so the fingers reach the left
 * edge and the thumb base sits at the right edge. The wrist keeps the clip's own angle (no extra
 * bend or forearm roll), so at this hand angle the forearm runs straight down to the bottom right.
 */
const PALM_AT: readonly [number, number, number] = [0.024, -0.05, -0.024];
const FINGERS_ALONG: readonly [number, number, number] = [-0.6, 0.8, 0];
const PALM_FACING: readonly [number, number, number] = [0, 0, 1];
const HAND_SIZE_M = 0.08;
/** The studio reflections are bright for skin in a dark room: lower, and the skin a little darker. */
const SKIN_ENV_INTENSITY = 0.3;
const SKIN_TINT = 0.72;

/** The bone whose (sanitized) name starts with `name` (three removes the dots from node names). */
function findBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const want = `${name.replace(/[.]/g, "")}_`;
  let found: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (found === null && object.name.startsWith(want)) found = object;
  });
  return found;
}

/**
 * The transform of the arms root (in the rig's space) that puts the posed hand at `PALM_AT`.
 */
export function heldHandTransform(arms: THREE.Object3D): THREE.Matrix4 | null {
  arms.updateMatrixWorld(true);
  const inverse = arms.matrixWorld.clone().invert();
  const at = (name: string) => {
    const bone = findBone(arms, name);
    return bone ? new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(inverse) : null;
  };
  const wrist = at("DEF-hand.R");
  const middle = at("DEF-f_middle.01.R");
  const index = at("DEF-f_index.01.R");
  const pinky = at("DEF-f_pinky.01.R");
  if (!wrist || !middle || !index || !pinky) return null;
  const y = middle.clone().sub(wrist).normalize();
  const across = index.clone().sub(pinky).normalize();
  const z = new THREE.Vector3().crossVectors(across, y).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const scale = HAND_SIZE_M / wrist.distanceTo(middle);
  const hand = new THREE.Matrix4().makeBasis(x, y, z).setPosition(wrist.clone().lerp(middle, 0.5).multiplyScalar(scale));
  const ty = new THREE.Vector3(...FINGERS_ALONG).normalize();
  const tx = new THREE.Vector3().crossVectors(ty, new THREE.Vector3(...PALM_FACING)).normalize();
  const tz = new THREE.Vector3().crossVectors(tx, ty).normalize();
  const target = new THREE.Matrix4().makeBasis(tx, ty, tz).setPosition(new THREE.Vector3(...PALM_AT));
  return target.multiply(hand.invert()).multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
}

export const HeldHand: FC = () => {
  const gltf = useGLTF(ARMS_MODEL_PATH);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const arms = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    clone.traverse((object) => {
      if (object.name.includes("Background")) object.visible = false;
      object.frustumCulled = false;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    // The pose, frozen: one evaluation of the clip, then the extra turns. Nothing updates it later.
    const clip = gltf.animations.find((entry) => entry.name === POSE_CLIP);
    if (clip) {
      const mixer = new THREE.AnimationMixer(clone);
      mixer.clipAction(clip).play();
      mixer.setTime(POSE_TIME_S);
      mixer.stopAllAction();
      mixer.uncacheRoot(clone);
    }
    for (const [name, turn] of Object.entries(BONE_TURNS)) {
      findBone(clone, name)?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...turn)));
    }
    for (const name of HIDDEN_BONES) findBone(clone, name)?.scale.setScalar(1e-4);
    const transform = heldHandTransform(clone);
    if (transform) transform.decompose(clone.position, clone.quaternion, clone.scale);
    return clone;
  }, [gltf]);
  // Own materials, with the phone's studio reflections at a lower strength.
  useEffect(() => {
    const envMap = createPhoneReflectionMap(gl);
    const owned: THREE.Material[] = [];
    arms.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const copies = list.map((material) => {
        const copy = material.clone();
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.envMap = envMap;
          copy.envMapIntensity = SKIN_ENV_INTENSITY;
          copy.color.multiplyScalar(SKIN_TINT);
        }
        owned.push(copy);
        return copy;
      });
      mesh.material = Array.isArray(mesh.material) ? copies : copies[0];
    });
    invalidate();
    return () => {
      owned.forEach((material) => material.dispose());
      envMap.dispose();
    };
  }, [arms, gl, invalidate]);
  return <primitive object={arms} />;
};
useGLTF.preload(ARMS_MODEL_PATH);
