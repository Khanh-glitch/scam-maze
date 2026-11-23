import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { retargetClip } from "../../../khupho/world/retarget";

/**
 * Walk and idle clips for the street NPCs. Most NPC files (npc-alan, npc-sofia, ...) ship a 53-bone rig with no
 * clips, so they used to slide along the pavement in their bind pose. Like the khupho neighborhood, they borrow
 * juno3's Mixamo walk and idle, retargeted onto their own skeleton once per model file.
 */
const SOURCE = "/assets/testbus/ow/models/juno3.optimized.glb";
/** juno3's walk covers this many metres per second at the source's own height (measured in khupho). */
const SOURCE_WALK_SPEED = 1.359;
const SOURCE_HEIGHT = 1.7;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let source: Promise<{ scene: T.Object3D; clips: T.AnimationClip[] } | null> | null = null;
const cache = new Map<string, Promise<StreetClips>>();

export interface StreetClips {
  walk?: T.AnimationClip;
  idle?: T.AnimationClip;
  /** Metres per second the walk clip covers for a model `height` metres tall at timeScale 1. */
  walkSpeedAt(height: number): number;
}

function loadSource() {
  source ??= loader
    .loadAsync(SOURCE)
    .then((g) => ({ scene: g.scene, clips: g.animations }))
    .catch(() => null);
  return source;
}

/**
 * `key` identifies the model file, `rest` is the loaded scene before anything is posed or scaled, `own` its clips.
 */
export function streetClips(key: string, rest: T.Object3D, own: T.AnimationClip[]): Promise<StreetClips> {
  let p = cache.get(key);
  if (p) return p;
  const ownWalk = own.find((c) => /^walk$/i.test(c.name));
  const ownIdle = own.find((c) => /^idle$/i.test(c.name));
  const restClone = cloneSkinned(rest);
  p = (async (): Promise<StreetClips> => {
    const fixed = (h: number) => (SOURCE_WALK_SPEED * h) / SOURCE_HEIGHT;
    if (ownWalk && ownIdle) return { walk: ownWalk, idle: ownIdle, walkSpeedAt: fixed };
    let ue = false;
    restClone.traverse((o) => {
      if (o.name === "pelvis") ue = true;
    });
    const src = ue ? await loadSource() : null;
    if (!src) return { walk: ownWalk, idle: ownIdle, walkSpeedAt: fixed };
    const pick = (name: string) => src.clips.find((c) => c.name === name);
    const make = (name: string) => {
      const clip = pick(name);
      if (!clip) return undefined;
      try {
        return retargetClip(cloneSkinned(src.scene), cloneSkinned(restClone), clip, name);
      } catch (error) {
        console.warn(`[testbus] could not retarget ${name} onto ${key}`, error);
        return undefined;
      }
    };
    return { walk: ownWalk ?? make("walk"), idle: ownIdle ?? make("idle"), walkSpeedAt: fixed };
  })();
  cache.set(key, p);
  return p;
}
