import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHARACTERS_GLB_BASE } from '../../../config/assetPaths';
import { retargetClip } from './retarget';

/**
 * Animated character models for the neighborhood (scripts/optimize-characters.cjs).
 *
 * To add a character: optimize its .glb with the script, then add an entry to HUMAN_MODELS with
 * its height and the names of its clips for the roles it can play. Characters without a `walk`
 * clip can only stand (like the vendor); `idle` is required. A model without clips (the street
 * NPCs) names a `clipsFrom` model whose idle, walk and wave are retargeted onto its skeleton.
 */
export type HumanRole = 'idle' | 'walk' | 'wave' | 'welcome' | 'invite' | 'prepare' | 'lookAround' | 'thank';

export interface HumanModelSpec {
  /** File name under CHARACTERS_GLB_BASE. */
  file: string;
  /** Standing height in meters; the model is scaled to it. Without it the model keeps its own size. Always stood on its feet. */
  height?: number;
  /**
   * Model whose clips are retargeted onto this one (Mixamo -> street NPC rig, see retarget.ts).
   * The new clips are named after the roles: 'idle', 'walk', 'wave'.
   */
  clipsFrom?: 'juno3' | 'rowan';
  /** The model has separate clothing meshes (`Asset_top_`, `Asset_bottom_`, `Asset_shoes_`) that `spawn` can recolor. */
  outfit?: boolean;
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
  // Street NPCs (separate meshes, one 53-bone rig, no clips of their own). Authored at 1.5-1.9 m;
  // brought to everyday heights for the street.
  npcAlan: street('npc-alan.optimized.glb', 1.72),
  npcAlice: street('npc-alice.optimized.glb', 1.6),
  npcArchetype: street('npc-archetype.optimized.glb', 1.7),
  npcArthur: street('npc-arthur.optimized.glb', 1.72),
  npcLinMei: street('npc-linmei.optimized.glb', 1.58),
  npcNapole: street('npc-napole.optimized.glb', 1.5),
  npcYoshida: street('npc-yoshida.optimized.glb', 1.62),
} satisfies Record<string, HumanModelSpec>;

export type HumanModelId = keyof typeof HUMAN_MODELS;

function street(file: string, height: number): HumanModelSpec {
  return { file, height, clips: { idle: 'idle', walk: 'walk', wave: 'wave' }, clipsFrom: 'juno3', outfit: true };
}

/** Clothing parts `spawn` can recolor, by mesh name. */
export type OutfitPart = 'top' | 'bottom' | 'shoes';
const OUTFIT_PART: Record<OutfitPart, RegExp> = { top: /^Asset_top_/, bottom: /^Asset_bottom_/, shoes: /^Asset_shoes_/ };
/** Small face parts hidden past DETAIL_DISTANCE (fewer draws for people walking far away). */
const DETAIL_PART = /^Asset_(eyes|eyebrows|eyelashes)_/;
/** Parts too small to matter in the shadow map. */
const NO_SHADOW_PART = /^Asset_(eyes|eyebrows|eyelashes|shoes|glasses)_/;
const DETAIL_DISTANCE = 12;

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

interface LoadedGltf { id: HumanModelId; spec: HumanModelSpec; scene: THREE.Object3D; animations: THREE.AnimationClip[] }

/** Above this camera distance (m) an actor's animation runs at a third of the frame rate. */
const FAR_ANIMATION = 18;
/** Above this distance (m) the animation is not advanced at all. */
const NO_ANIMATION = 55;

/** True when two skeletons use the same bones with the same bind inverses. */
function sameBones(a: THREE.Skeleton, b: THREE.Skeleton): boolean {
  if (a.bones.length !== b.bones.length) return false;
  for (let i = 0; i < a.bones.length; i++) {
    if (a.bones[i].name !== b.bones[i].name || !a.boneInverses[i].equals(b.boneInverses[i])) return false;
  }
  return true;
}

/**
 * Estimates the ground speed of an in-place walk: while a foot is planted it slides backward at the
 * walking speed, so the median horizontal speed of the planted foot is the speed to move the body at.
 */
function measureWalkSpeed(scene: THREE.Object3D, clip: THREE.AnimationClip): number {
  const probe = cloneSkinned(scene);
  let foot: THREE.Object3D | undefined;
  probe.traverse((o) => { if (!foot && /^(left_?foot|foot_l)$/i.test(o.name.replace(/^mixamorig\d*:?/i, ''))) foot = o; });
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
    // Models that borrow clips need their source too.
    const wanted = new Set(ids);
    for (const id of ids) { const from = (HUMAN_MODELS[id] as HumanModelSpec).clipsFrom; if (from) wanted.add(from); }
    const loaded = new Map<HumanModelId, LoadedGltf>();
    await Promise.all([...wanted].map(async (id) => {
      const spec: HumanModelSpec = HUMAN_MODELS[id];
      try {
        const gltf = await loader.loadAsync(`${CHARACTERS_GLB_BASE}/${spec.file}`);
        loaded.set(id, { id, spec, scene: gltf.scene, animations: gltf.animations });
      } catch (err) {
        console.warn(`[khupho] character "${id}" failed to load`, err);
      }
    }));
    for (const id of ids) {
      const g = loaded.get(id);
      if (!g) continue;
      try {
        const { spec, scene } = g;
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = !NO_SHADOW_PART.test(mesh.name);
          mesh.receiveShadow = true;
        });
        scene.updateMatrixWorld(true);
        let animations = g.animations;
        if (spec.clipsFrom) {
          const from = loaded.get(spec.clipsFrom);
          if (!from) { console.warn(`[khupho] ${id}: clip source "${spec.clipsFrom}" did not load`); continue; }
          const fromClips = new Map(from.animations.map((c) => [c.name, c]));
          const fromSpec: HumanModelSpec = from.spec;
          animations = [];
          for (const role of ['idle', 'walk', 'wave'] as const) {
            const clip = fromSpec.clips[role] ? fromClips.get(fromSpec.clips[role]!) : undefined;
            if (clip) animations.push(retargetClip(cloneSkinned(from.scene), cloneSkinned(scene), clip, role));
          }
        }
        const box = new THREE.Box3().setFromObject(scene);
        const scale = spec.height ? spec.height / Math.max(0.01, box.max.y - box.min.y) : 1;
        const clips = new Map(animations.map((c) => [c.name, c]));
        for (const role of Object.keys(spec.clips) as HumanRole[]) {
          const name = spec.clips[role];
          if (name && !clips.has(name)) console.warn(`[khupho] ${id}: clip "${name}" (${role}) not found`);
        }
        const walk = spec.clips.walk ? clips.get(spec.clips.walk) : undefined;
        const measured = walk ? measureWalkSpeed(scene, walk) : 0;
        const walkSpeed = (spec.walkSpeed ?? measured) * scale;
        lib.models.set(id, { spec, scene, clips, scale, lift: -box.min.y * scale, walkSpeed });
        if (import.meta.env.DEV) console.info(`[khupho] character ${id}: height ${((box.max.y - box.min.y) * scale).toFixed(2)} m, walk ${walkSpeed.toFixed(2)} m/s (measured ${(measured * scale).toFixed(2)})`);
      } catch (err) {
        console.warn(`[khupho] character "${id}" could not be prepared`, err);
      }
    }
    return lib;
  }

  has(id: HumanModelId): boolean {
    return this.models.has(id);
  }

  /**
   * A new actor of model `id`, or null when that model did not load. `outfit` recolors clothing
   * parts (models with `outfit: true`); other parts keep the authored look.
   */
  spawn(id: HumanModelId, outfit?: Partial<Record<OutfitPart, THREE.ColorRepresentation>>): HumanActor | null {
    const m = this.models.get(id);
    return m ? new HumanActor(m, outfit) : null;
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
  private readonly details: THREE.Object3D[] = [];
  private detailShown = true;

  constructor(model: LoadedHuman, outfit?: Partial<Record<OutfitPart, THREE.ColorRepresentation>>) {
    this.model = model;
    const body = cloneSkinned(model.scene);
    body.scale.setScalar(model.scale);
    body.position.y = model.lift;
    this.object.add(body);
    let shared: THREE.Skeleton | null = null;
    body.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      if (DETAIL_PART.test(mesh.name)) this.details.push(mesh);
      // The clone gives every mesh its own skeleton; meshes on the same bones share one, so the
      // bone matrices are computed once per frame instead of once per clothing part.
      if (mesh.isSkinnedMesh) {
        if (!shared) shared = mesh.skeleton;
        else if (sameBones(shared, mesh.skeleton)) mesh.bind(shared, mesh.bindMatrix);
      }
      if (outfit && model.spec.outfit) {
        for (const part of Object.keys(outfit) as OutfitPart[]) {
          const color = outfit[part];
          if (color === undefined || !OUTFIT_PART[part].test(mesh.name)) continue;
          const m = (mesh.material as THREE.MeshStandardMaterial).clone();
          m.color.set(color);
          mesh.material = m;
        }
      }
    });
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
    const detail = distance < DETAIL_DISTANCE;
    if (detail !== this.detailShown) { this.detailShown = detail; for (const d of this.details) d.visible = detail; }
    if (!this.object.visible || distance > NO_ANIMATION) { this.pending = 0; return; }
    this.pending += dt;
    if (distance > FAR_ANIMATION && (this.frame++ % 3) !== 0) return;
    this.mixer.update(this.pending);
    this.pending = 0;
  }
}
