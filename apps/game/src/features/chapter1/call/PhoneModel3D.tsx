/**
 * The 3D call phone inside the chapter canvas.
 *
 * `PhoneModel3D` draws the optimized phone model in front of the camera and publishes the
 * projected screen rectangle to the page's `PhoneScreenSink`, so the DOM screen content
 * (`PhoneScreenHost` in model mode) follows exactly what is drawn. It reads the camera pose and
 * field of view but never writes to the camera. It adds no light, no scene-wide environment,
 * no post-processing and no second canvas; the phone's own materials get a studio reflection
 * map (phoneReflections.ts) so metal and glass read as real. The phone is turned slightly
 * toward the player, and the projected screen corners are published as a quad so the DOM screen
 * follows the tilted glass.
 *
 * This file imports nothing from the narrative store, the selectors or `useChapterState`: the
 * call status reaches it only as the `ringing` prop.
 */
import { Component, Suspense, useEffect, useMemo, useRef, type ErrorInfo, type FC, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CALL_PHONE_GLB } from "../../../config/assetPaths";
import { BRAND } from "../theme";
import {
  SCREEN_HEIGHT_M,
  SCREEN_WIDTH_M,
  computeCallLayout,
  heldPhoneLayout,
  solveScreenPose,
  type Rect,
} from "./callLayout";
import { applyPhoneReflections, createPhoneReflectionMap } from "./phoneReflections";
import { heldPhoneRiseOffset, phoneMotionOffset } from "./phoneMotion";
import { HeldHand } from "./HeldHand";
import { quadBounds, type Point } from "./screenQuad";
import type { PhoneScreenSink } from "./phoneScreenSink";

/**
 * Loads the call phone. Draco is off (the file uses Meshopt, and Drei would otherwise point the
 * Draco decoder at a remote URL); Meshopt decoding is on. The model and the warmup use the same
 * arguments so they share one cache entry.
 */
function useCallPhoneGLTF() {
  return useGLTF(CALL_PHONE_GLB, false, true);
}

/**
 * Distance (meters) of the screen center in front of the model origin after the inner group's
 * rotation by π about Y. The `OLED` primitive lies in the plane z = −0.00343 facing −Z.
 */
const SCREEN_FRONT_OFFSET_M = 0.00343;
/** The dimming plane sits this far behind the screen (meters). */
const DIMMING_DISTANCE_BEHIND_M = 0.1;
/** Extra size so the dimming plane covers the frustum edges at any aspect ratio. */
const DIMMING_COVER_MARGIN = 1.2;
const DIMMING_OPACITY = 0.6;
/** The first rectangle must be published within this time for the entry slide to play. */
const ENTRY_ANIMATION_WINDOW_MS = 150;
/**
 * Turn of the phone toward the player (radians): the face turns left toward the view center
 * and the top leans back a little, like a phone held in the right hand.
 */
const PHONE_TILT_Y = -0.16;
const PHONE_TILT_X = -0.07;
/** Turn of the held phone (P) toward the view center (radians), against the off-axis view of its side. */
const HELD_TILT_Y = -0.22;
/** Roll of the held phone (radians, counterclockwise): its top leans left, in line with a forearm from the bottom right, like in GTA (owner). */
const HELD_ROLL_Z = 0.12;
/** Fallback vertical field of view (degrees) if the camera is not a perspective camera. */
const DEFAULT_FOV_DEG = 70;

export interface PhoneModel3DProps {
  /**
   * True while a call is shown. False keeps the model loaded, compiled and uploaded (the room
   * mounts it on entry so the first ring shows the phone at once), but publishes no screen
   * rectangle; the canvas is hidden by the layer meanwhile.
   */
  live: boolean;
  /** Call status from the page, as a prop. */
  ringing: boolean;
  reducedMotion: boolean;
  /** `performance.now()` when the call overlay opened. */
  openedAt: number;
  screenSink: PhoneScreenSink;
  /** `call` (default): the call framing with the room dimmed. `held`: the phone brought up with P, low on the right, no dimming. */
  placement?: "call" | "held";
}

/** Screen anchor corners in anchor-local space (the anchor sits on the screen center). */
const SCREEN_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-SCREEN_WIDTH_M / 2, SCREEN_HEIGHT_M / 2],
  [SCREEN_WIDTH_M / 2, SCREEN_HEIGHT_M / 2],
  [SCREEN_WIDTH_M / 2, -SCREEN_HEIGHT_M / 2],
  [-SCREEN_WIDTH_M / 2, -SCREEN_HEIGHT_M / 2],
];

export const PhoneModel3D: FC<PhoneModel3DProps> = ({ live, ringing, reducedMotion, openedAt, screenSink, placement = "call" }) => {
  const { scene } = useCallPhoneGLTF();
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
    });
    return clone;
  }, [scene]);

  // Studio reflections on the phone's own (cloned) materials only.
  useEffect(() => {
    const envMap = createPhoneReflectionMap(gl);
    const materials = applyPhoneReflections(model, envMap);
    return () => {
      materials.forEach((material) => material.dispose());
      envMap.dispose();
    };
  }, [gl, model]);

  const dimmingMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BRAND.graphite,
        transparent: true,
        opacity: DIMMING_OPACITY,
        depthWrite: false,
      }),
    [],
  );
  const dimmingGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(
    () => () => {
      dimmingMaterial.dispose();
      dimmingGeometry.dispose();
    },
    [dimmingMaterial, dimmingGeometry],
  );

  const rigRef = useRef<THREE.Group>(null);
  const anchorRef = useRef<THREE.Group>(null);
  const dimmingRef = useRef<THREE.Mesh>(null);
  const cornerScratch = useRef(new THREE.Vector3());
  const quadScratch = useRef<Point[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  /** Time of the first publication; `null` until the first frame. */
  const firstFrameAtRef = useRef<number | null>(null);
  const animateEntryRef = useRef(true);

  // Latest props for the frame callback without re-subscribing it.
  const propsRef = useRef({ live, ringing, reducedMotion, openedAt, screenSink, placement });
  propsRef.current = { live, ringing, reducedMotion, openedAt, screenSink, placement };
  useEffect(() => {
    return () => {
      screenSink.publish(null);
    };
  }, [screenSink]);
  // The model is parsed and the reflection map exists: the call screen may wait for the first frame.
  useEffect(() => {
    screenSink.setWarm(true);
    return () => screenSink.setWarm(false);
  }, [screenSink]);
  // A call opens: the entry slide starts from this moment, and the first frame is drawn at once.
  // A call ends: the stale rectangle is dropped so the next call does not start from it.
  useEffect(() => {
    if (live) {
      firstFrameAtRef.current = null;
      invalidate();
    } else {
      screenSink.publish(null);
    }
  }, [live, placement, invalidate, screenSink]);

  // Default priority (0): R3F keeps rendering. Mounted after the player, so this runs after the
  // player runtime has moved the camera in the same frame.
  useFrame(({ camera }) => {
    const rig = rigRef.current;
    const anchor = anchorRef.current;
    const dimming = dimmingRef.current;
    if (!rig || !anchor || !dimming) return;
    const props = propsRef.current;
    if (!props.live) return; // loaded and compiled, waiting for the first ring
    const now = performance.now();
    if (firstFrameAtRef.current === null) {
      firstFrameAtRef.current = now;
      animateEntryRef.current = now - props.openedAt <= ENTRY_ANIMATION_WINDOW_MS;
    }

    const viewport = { width: size.width, height: size.height };
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : DEFAULT_FOV_DEG;

    const layout = props.placement === "held" ? heldPhoneLayout(viewport) : computeCallLayout(viewport);
    // The held phone leaves the room as it is; only a call dims it.
    dimming.visible = props.placement !== "held";
    const motion = {
      elapsedMs: now - firstFrameAtRef.current,
      animateEntry: animateEntryRef.current,
      ringing: props.ringing,
      reducedMotion: props.reducedMotion,
      layout,
      viewport,
    };
    // The held phone rises from below into the hand; the call phone slides in from the right.
    const held = props.placement === "held";
    const offset = held ? 0 : phoneMotionOffset(motion);
    const rise = held ? heldPhoneRiseOffset(motion) : 0;
    const target: Rect = { ...layout.screen, left: layout.screen.left + offset, top: layout.screen.top + rise };
    const pose = solveScreenPose(target, viewport, fov);

    // Copy the camera pose (read only) into the rig, then move along the camera axes.
    rig.position.copy(camera.position);
    rig.quaternion.copy(camera.quaternion);
    rig.translateX(pose.x);
    rig.translateY(pose.y);
    rig.translateZ(pose.z - SCREEN_FRONT_OFFSET_M);
    // The held phone turns its face in toward the view center, so its outer side does not show
    // (owner); the call keeps its own turn.
    if (props.placement === "held") {
      rig.rotateY(HELD_TILT_Y);
      rig.rotateZ(HELD_ROLL_Z);
    } else {
      rig.rotateY(PHONE_TILT_Y);
      rig.rotateX(PHONE_TILT_X);
    }

    // Dimming plane: centered on the camera axis, behind the screen, covering the frustum.
    const dimmingDistance = -pose.z + DIMMING_DISTANCE_BEHIND_M;
    const dimmingHeight =
      2 * dimmingDistance * Math.tan((fov * Math.PI) / 360) * DIMMING_COVER_MARGIN;
    const dimmingWidth = dimmingHeight * (viewport.width / viewport.height);
    // The plane must face the camera, so it undoes the rig tilt before moving back on the axis.
    dimming.quaternion.copy(rig.quaternion).invert().multiply(camera.quaternion);
    dimming.position
      .set(-pose.x, -pose.y, SCREEN_FRONT_OFFSET_M - DIMMING_DISTANCE_BEHIND_M)
      .applyQuaternion(dimming.quaternion);
    dimming.scale.set(dimmingWidth, dimmingHeight, 1);

    // Project the four anchor corners with the current camera matrices and publish them as a
    // quad (with its bounding rectangle) in CSS px.
    rig.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const corner = cornerScratch.current;
    const quad = quadScratch.current;
    SCREEN_CORNERS.forEach(([x, y], index) => {
      corner.set(x, y, 0);
      anchor.localToWorld(corner);
      corner.project(camera);
      quad[index].x = ((corner.x + 1) / 2) * viewport.width;
      quad[index].y = ((1 - corner.y) / 2) * viewport.height;
    });
    if (!quad.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return;
    const published = [0, 1, 2, 3].map((i) => ({ x: quad[i].x, y: quad[i].y })) as [Point, Point, Point, Point];
    props.screenSink.publish({ ...quadBounds(published), quad: published });
  });

  return (
    <group ref={rigRef}>
      <group rotation={[0, Math.PI, 0]}>
        <primitive object={model} />
      </group>
      {/* The hand that holds the phone brought up with P; it loads on its own and never holds back the phone. */}
      {placement === "held" && (
        <Suspense fallback={null}>
          <HeldHand />
        </Suspense>
      )}
      <group ref={anchorRef} position={[0, 0, SCREEN_FRONT_OFFSET_M]} />
      <mesh
        ref={dimmingRef}
        geometry={dimmingGeometry}
        material={dimmingMaterial}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
};

/** Parses the phone model ahead of a call (from the HTTP cache the chapter loader filled). */
export const PhoneModelWarmup: FC = () => {
  useCallPhoneGLTF();
  return null;
};

interface PhoneModelBoundaryProps {
  onError: (error: unknown) => void;
  children: ReactNode;
}

interface PhoneModelBoundaryState {
  failed: boolean;
}

/** Catches phone model load and decode errors inside the canvas; renders nothing after one. */
export class PhoneModelBoundary extends Component<PhoneModelBoundaryProps, PhoneModelBoundaryState> {
  state: PhoneModelBoundaryState = { failed: false };

  static getDerivedStateFromError(): PhoneModelBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
