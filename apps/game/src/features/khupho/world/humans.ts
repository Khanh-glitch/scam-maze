import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHARACTERS_GLB_BASE } from '../../../config/assetPaths';

/**
 * Animated character models for the neighborhood (scripts/optimize-characters.cjs).
 *
 * To add a character: optimize its .glb with the script, then add an entry to HUMAN_MODELS with
 * its height and the names of its clips for the roles it can play. Characters without a `walk`
 * clip can only stand (like the vendor); `idle` is required.
 */
export type HumanRole = 'idle' | 'walk' | 'wave' | 'welcome' | 'invite' | 'prepare' | 'lookAround' | 'thank';

export interface HumanModelSpec {
  /** File name under CHARACTERS_GLB_BASE. */
  file: string;
  /** Standing height in meters; the model is scaled to it and stood on its feet. */
  height: number;
  /** Clip name for each role this model supports. */
  clips: Partial<Record<HumanRole, string>> & { idle: string };
  /**
   * Ground speed (m/s) of the in-place walk clip at the source size, when the source states it
   * (`ground_speed_mps` in the character's JSON). Otherwise it is measured from the feet at load.
   */
  walkSpeed?: number;
}

export const HUMAN_MODELS = {
  banhmiVendor: {
    file: 'banhmi-vendor.optimized.glb',
    height: 1.55,
    clips: { idle: 'VendorIdle', welcome: 'Welcome', invite: 'Invite', prepare: 'PrepareBread', lookAround: 'LookForCustomer', thank: 'ThankCustomer' },
  },
  manVN: { file: 'manvn.optimized.glb', height: 1.68, clips: { idle: 'Idle', walk: 'Walk', wave: 'Wave' } },
  juno3: { file: 'juno3.optimized.glb', height: 1.6, clips: { idle: 'idle', walk: 'walk', wave: 'wave' }, walkSpeed: 1.359 },
  rowan: { file: 'rowan.optimized.glb', height: 1.76, clips: { idle: 'idle', walk: 'walk', wave: 'wave' }, walkSpeed: 1.445 },
} satisfies Record<string, HumanModelSpec>;

export type HumanModelId = keyof typeof HUMAN_MODELS;

interface LoadedHuman {
  spec: HumanModelSpec;
  scene: THREE.Object3D;
  clips: Map<string, THREE.AnimationClip>;
  /** Scale and vertical offset that stand the model on y = 0 at `spec.height`. */
  scale: number;
  lift: number;
  /** Ground speed (m/s, after scaling) the in-place walk clip was animated for; 0 without a walk. */
  walkSpeed: number;
}

/** Above this camera distance (m) an actor's animation runs at a third of the frame rate. */
const FAR_ANIMATION = 18;
/** Above this distance (m) the animation is not advanced at all. */
const NO_ANIMATION = 55;

/**
 * Estimates the ground speed of an in-place walk: while a foot is planted it slides backward at the
 * walking speed, so the median horizontal speed of the planted foot is the speed to move the body at.
 */
function measureWalkSpeed(scene: THREE.Object3D, clip: THREE.AnimationClip): number {
  const probe = cloneSkinned(scene);
  let foot: THREE.Object3D | undefined;
  probe.traverse((o) => { if (!foot && /left_?foot$/i.test(o.name.replace(/^mixamorig:?/i, ''))) foot = o; });
  if (!foot) return 0;
  const mixer = new THREE.AnimationMixer(probe);
  mixer.clipAction(clip).play();
  const samples = 60, dt = clip.duration / samples, pts: THREE.Vector3[] = [];
  let minY = Infinity;
  for (let i = 0; i <= samples; i++) {
    mixer.setTime(i * dt);
    probe.updateMatrixWorld(true);
    const p = foot.getWorldPosition(new THREE.Vector3());
    pts.push(p); minY = Math.min(minY, p.y);
  }
  mixer.stopAllAction();
  const speeds: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    // Planted: both samples within 2 cm of the lowest foot height.
    if (pts[i].y < minY + 0.02 && pts[i - 1].y < minY + 0.02) speeds.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z) / dt);
  }
  if (speeds.length < 3) return 0;
  speeds.sort((a, b) => a - b);
  return speeds[speeds.length >> 1];
}

export class HumanLibrary {
  private readonly models = new Map<HumanModelId, LoadedHuman>();

  /** Loads the given models; a model that fails is skipped (its users fall back to procedural people). */
  static async load(ids: HumanModelId[] = Object.keys(HUMAN_MODELS) as HumanModelId[]): Promise<HumanLibrary> {
    const lib = new HumanLibrary();
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    await Promise.all(ids.map(async (id) => {
      const spec: HumanModelSpec = HUMAN_MODELS[id];
      try {
        const gltf = await loader.loadAsync(`${CHARACTERS_GLB_BASE}/${spec.file}`);
        const scene = gltf.scene;
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const scale = spec.height / Math.max(0.01, box.max.y - box.min.y);
        const clips = new Map(gltf.animations.map((c) => [c.name, c]));
        for (const role of Object.keys(spec.clips) as HumanRole[]) {
          const name = spec.clips[role];
          if (name && !clips.has(name)) console.warn(`[khupho] ${id}: clip "${name}" (${role}) not found`);
        }
        const walk = spec.clips.walk ? clips.get(spec.clips.walk) : undefined;
        const measured = walk ? measureWalkSpeed(scene, walk) : 0;
        const walkSpeed = (spec.walkSpeed ?? measured) * scale;
        lib.models.set(id, { spec, scene, clips, scale, lift: -box.min.y * scale, walkSpeed });
        if (import.meta.env.DEV) console.info(`[khupho] character ${id}: scale ${scale.toFixed(3)}, walk ${walkSpeed.toFixed(2)} m/s (measured ${(measured * scale).toFixed(2)})`);
      } catch (err) {
        console.warn(`[khupho] character "${id}" failed to load`, err);
      }
    }));
    return lib;
  }

  has(id: HumanModelId): boolean {
    return this.models.has(id);
  }

  /** A new actor of model `id`, or null when that model did not load. */
  spawn(id: HumanModelId): HumanActor | null {
    const m = this.models.get(id);
    return m ? new HumanActor(m) : null;
  }
}

/**
 * One animated character in the world. `object` is placed and turned by its owner; `play` cross-fades
 * between roles, and `update` advances the animation (less often when far away).
 */
export class HumanActor {
  readonly object = new THREE.Group();
  /** Ground speed (m/s) of the walk clip at normal speed; 0 when the model cannot walk. */
  readonly walkSpeed: number;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<HumanRole, THREE.AnimationAction>();
  private readonly model: LoadedHuman;
  private current: THREE.AnimationAction | null = null;
  private role: HumanRole | null = null;
  private pending = 0;
  private frame = Math.floor(Math.random() * 3);
  private onceDone: (() => void) | null = null;

  constructor(model: LoadedHuman) {
    this.model = model;
    const body = cloneSkinned(model.scene);
    body.scale.setScalar(model.scale);
    body.position.y = model.lift;
    this.object.add(body);
    this.walkSpeed = model.walkSpeed;
    this.mixer = new THREE.AnimationMixer(body);
    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.current) return;
      const done = this.onceDone; this.onceDone = null;
      done?.();
    });
  }

  can(role: HumanRole): boolean {
    const name = this.model.spec.clips[role];
    return !!name && this.model.clips.has(name);
  }

  get playing(): HumanRole | null {
    return this.role;
  }

  private action(role: HumanRole): THREE.AnimationAction | null {
    let a = this.actions.get(role);
    if (a) return a;
    const name = this.model.spec.clips[role];
    const clip = name ? this.model.clips.get(name) : undefined;
    if (!clip) return null;
    a = this.mixer.clipAction(clip);
    this.actions.set(role, a);
    return a;
  }

  /**
   * Cross-fades to `role`. With `once`, the clip plays one time and `then` runs when it ends
   * (the caller usually returns to idle). `timeScale` changes the clip speed (walk matching).
   */
  play(role: HumanRole, opts: { once?: boolean; fade?: number; timeScale?: number; then?: () => void } = {}): boolean {
    const a = this.action(role);
    if (!a) return false;
    a.timeScale = opts.timeScale ?? 1;
    if (this.role === role && !opts.once) return true;
    a.reset();
    a.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = !!opts.once;
    a.enabled = true;
    const fade = opts.fade ?? 0.3;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    else a.fadeIn(fade);
    a.play();
    this.current = a; this.role = role;
    this.onceDone = opts.once ? opts.then ?? null : null;
    return true;
  }

  /** Sets the speed of the clip playing now (walk speed matching). */
  setTimeScale(s: number) {
    if (this.current) this.current.timeScale = s;
  }

  /** Advances the animation; `distance` is the camera distance, used to update far actors less often. */
  update(dt: number, distance: number) {
    if (!this.object.visible || distance > NO_ANIMATION) { this.pending = 0; return; }
    this.pending += dt;
    if (distance > FAR_ANIMATION && (this.frame++ % 3) !== 0) return;
    this.mixer.update(this.pending);
    this.pending = 0;
  }
}
