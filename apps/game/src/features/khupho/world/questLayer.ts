import * as THREE from 'three';
import { buildGrid, findPath, pathLength, resamplePath, trimEnd, type NavGrid, type Point } from '../../../game/world/pathfinding';
import type { Interactions } from './interact';
import type { Physics } from './physics';
import type { House } from './house';

/**
 * Quest presentation in the neighborhood: the icon above a person's head, talking to that person
 * (an interaction prompt), the glowing guide trail on the ground, and the data for the minimap.
 * No story rules live here: the host page decides which icon shows and what a conversation does.
 */

/** Icon above an NPC: a pending quest, or the same icon emphasized (bigger, with a pulsing glow) while talking. */
export type MarkerKind = 'quest' | 'active';

export interface MapRect { x0: number; z0: number; x1: number; z1: number; kind: 'road' | 'walk' | 'alley' | 'court' }
export interface MapData {
  rects: MapRect[];
  /** House footprints: four corners each, in world x and z. */
  houses: [number, number][][];
}

export interface QuestLayerDeps {
  scene: THREE.Scene;
  phys: Physics;
  inter: Interactions;
  houses: House[];
  /** People the story talks about, by id (their 3D object). */
  npcs: Readonly<Record<string, THREE.Object3D>>;
  /** Called when the player talks to a person (E on the prompt). */
  onTalk: (npc: string) => void;
  /** Interaction prompt text for a person, already translated. */
  label: (npc: string) => string;
  /** World position of any quest goal (a person or a place), by id. */
  target?: (id: string) => Point | null;
  /** A hand-made climbing path (with heights) from the player's eye to a goal, for goals inside a building; null when the street grid applies. */
  route?: (id: string, from: { x: number; y: number; z: number }) => Point[] | null;
}

const ICON_URL = '/assets/ui/hud/scammaze-quest-icon-512.png';
const ICON_SIZE = 0.05;
const ICON_SIZE_ACTIVE = 0.066;

/** Street, sidewalks, alley and courtyard as laid out in neighborhood.ts. */
const MAP_RECTS: MapRect[] = [
  { x0: -70, z0: -3.6, x1: 70, z1: 3.6, kind: 'road' },
  { x0: -70, z0: 3.6, x1: 8.5, z1: 6, kind: 'walk' },
  { x0: 11.5, z0: 3.6, x1: 70, z1: 6, kind: 'walk' },
  { x0: -70, z0: -6, x1: 70, z1: -3.6, kind: 'walk' },
  { x0: 8.5, z0: 3.6, x1: 11.5, z1: 52, kind: 'alley' },
  { x0: -4.6, z0: 40.5, x1: 23.6, z1: 53, kind: 'court' },
];

/** Walkable area the guide trail searches (the street, alley and courtyard). */
const NAV = { x0: -64, z0: -8, x1: 64, z1: 56, cell: 0.8 };
/** Clearance (m) the trail keeps from walls and props. */
const NAV_RADIUS = 0.42;
/** The trail ends this far from the person's feet (m): at her feet, not short of her. */
const TRAIL_STOP = 0.25;
const TRAIL_STEP = 0.6;
const TRAIL_WIDTH = 0.95;
const TRAIL_LIFT = 0.05;
/** Seconds: the trail lights up along the path, stays, then fades. */
const REVEAL_S = 1.3;
const HOLD_S = 9;
const FADE_S = 1;
const REPATH_S = 0.45;

const TRAIL_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TRAIL_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uReveal;
uniform float uLen;
uniform float uAlpha;
void main() {
  float x = vUv.x;
  float v = abs(vUv.y);
  float edge = 1.0 - smoothstep(0.45, 1.0, v);
  float reach = uReveal * (uLen + 3.0);
  float mask = 1.0 - smoothstep(reach - 3.0, reach, x);
  float head = exp(-pow((x - reach + 0.4) * 0.9, 2.0));
  // Chevrons that flow toward the person.
  float s = fract(x / 1.5 - uTime * 0.55);
  float line = 0.3 + 0.35 * (1.0 - v);
  float chev = smoothstep(0.09, 0.0, abs(s - line));
  float fadeStart = smoothstep(0.4, max(0.8, min(2.2, uLen * 0.45)), x);
  // Only dims a little near the end so the light still lands on her feet.
  float fadeEnd = 1.0 - 0.3 * smoothstep(max(uLen - 1.0, 0.0), max(uLen, 0.01), x);
  float a = ((0.22 + chev * 0.9) * mask * fadeEnd + head * 0.8) * edge * fadeStart;
  vec3 col = mix(vec3(1.0, 0.86, 0.5), vec3(0.78, 0.7, 1.0), smoothstep(0.0, 1.0, v));
  gl_FragColor = vec4(col * a * uAlpha, a * uAlpha);
}`;

export class QuestLayer {
  private d: QuestLayerDeps;
  private texture: THREE.Texture;
  private markers = new Map<string, { sprite: THREE.Sprite; halo: THREE.Sprite; kind: MarkerKind; top: number | null }>();
  private nav: NavGrid | null = null;
  private trail: THREE.Mesh;
  private trailUniforms = { uTime: { value: 0 }, uReveal: { value: 0 }, uLen: { value: 1 }, uAlpha: { value: 0 } };
  private trailTarget: string | null = null;
  private trailT = 0;
  private repathT = 0;
  private lastFrom = new THREE.Vector2(Infinity, Infinity);
  private mapData: MapData | null = null;
  private tmp = new THREE.Vector3();
  private disposers: (() => void)[] = [];

  constructor(deps: QuestLayerDeps) {
    this.d = deps;
    this.texture = new THREE.TextureLoader().load(ICON_URL);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // Trail mesh: geometry is rebuilt when the path changes.
    const mat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, uniforms: this.trailUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.trail = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    this.trail.renderOrder = 5;
    this.d.scene.add(this.trail);
    // Talking to a person: an invisible capsule-ish box on the person is what the crosshair hits.
    for (const [id, obj] of Object.entries(this.d.npcs)) {
      const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.9, 8), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
      proxy.position.y = 0.95;
      obj.add(proxy);
      this.d.inter.add({ obj: proxy, label: () => this.d.label(id), act: () => this.d.onTalk(id) });
      this.disposers.push(() => { obj.remove(proxy); proxy.geometry.dispose(); (proxy.material as THREE.Material).dispose(); });
    }
  }

  /** World position of a person (x, z), or null when unknown. */
  npcPosition(id: string): Point | null {
    const o = this.d.npcs[id];
    if (!o) return null;
    o.getWorldPosition(this.tmp);
    return { x: this.tmp.x, z: this.tmp.z };
  }

  /** Shows the quest icon above a person (`active`: emphasized while talking); `null` hides it. */
  setMarker(id: string, kind: MarkerKind | null) {
    let m = this.markers.get(id);
    if (kind === null) {
      if (m) { m.sprite.visible = false; m.halo.visible = false; }
      return;
    }
    if (!m) {
      // Always drawn on top and a fixed size on screen, so it can be seen through walls and from far away.
      const make = (additive: boolean) => {
        const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
        const sprite = new THREE.Sprite(mat);
        sprite.frustumCulled = false;
        sprite.renderOrder = additive ? 9 : 10;
        this.d.scene.add(sprite);
        return sprite;
      };
      m = { sprite: make(false), halo: make(true), kind, top: null };
      this.markers.set(id, m);
    }
    m.kind = kind;
    m.sprite.visible = true;
    m.halo.visible = kind === 'active';
    const size = kind === 'active' ? ICON_SIZE_ACTIVE : ICON_SIZE;
    m.sprite.scale.set(size, size, 1);
    m.halo.scale.set(size * 1.7, size * 1.7, 1);
  }

  /** Lights the guide trail from the player to a person. Calling it again restarts the animation. */
  showPath(id: string) {
    this.trailTarget = id;
    this.trailT = 0;
    this.repathT = 0;
    this.lastFrom.set(Infinity, Infinity);
    this.trail.visible = true;
  }

  hidePath() {
    this.trailTarget = null;
    this.trail.visible = false;
  }

  get pathVisible() { return this.trailTarget !== null; }

  /** Roads and house footprints for the minimap (built once). */
  getMapData(): MapData {
    if (!this.mapData) {
      const houses: [number, number][][] = [];
      for (const h of this.d.houses) {
        h.group.updateWorldMatrix(true, false);
        const c = [h.wp(0, 0, 0), h.wp(h.W, 0, 0), h.wp(h.W, 0, h.D), h.wp(0, 0, h.D)];
        houses.push(c.map((v) => [v.x, v.z] as [number, number]));
      }
      this.mapData = { rects: MAP_RECTS, houses };
    }
    return this.mapData;
  }

  private walkable(x: number, z: number): boolean {
    const p = { x, z };
    this.d.phys.collide(p, this.d.phys.floorAt(x, z, 0.6).y, NAV_RADIUS);
    return Math.hypot(p.x - x, p.z - z) < 0.03;
  }

  private ensureNav(): NavGrid {
    if (!this.nav) {
      // Bikes on the street move; only the fixed world counts for the grid.
      const phys = this.d.phys, dyn = phys.dynamic;
      phys.dynamic = [];
      try { this.nav = buildGrid(NAV.x0, NAV.z0, NAV.x1, NAV.z1, NAV.cell, (x, z) => this.walkable(x, z)); } finally { phys.dynamic = dyn; }
    }
    return this.nav;
  }

  private rebuildTrail(from: Point, to: Point, eyeY: number) {
    const climb = this.trailTarget ? this.d.route?.(this.trailTarget, { x: from.x, y: eyeY, z: from.z }) ?? null : null;
    const raw = climb ?? findPath(this.ensureNav(), from, to) ?? [from, to];
    const path = trimEnd(raw, TRAIL_STOP);
    const total = pathLength(path);
    if (path.length < 2 || total < 0.5) { this.trailUniforms.uLen.value = 0.01; this.trail.geometry.setDrawRange(0, 0); return; }
    const pts = resamplePath(path, TRAIL_STEP);
    const n = pts.length;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const nx = -dz * TRAIL_WIDTH / 2, nz = dx * TRAIL_WIDTH / 2;
      const y = (pts[i].y ?? this.d.phys.floorAt(pts[i].x, pts[i].z, 0.6).y) + TRAIL_LIFT;
      pos.set([pts[i].x + nx, y, pts[i].z + nz, pts[i].x - nx, y, pts[i].z - nz], i * 6);
      uv.set([pts[i].d, -1, pts[i].d, 1], i * 4);
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.trail.geometry.dispose();
    this.trail.geometry = g;
    this.trailUniforms.uLen.value = pts[n - 1].d;
  }

  /** Per frame: bobs the icons, keeps the trail under the player and runs its light-up animation. */
  update(dt: number, elapsed: number, player: THREE.Vector3) {
    for (const [id, m] of this.markers) {
      const obj = this.d.npcs[id];
      if (!m.sprite.visible || !obj) continue;
      if (!obj.visible) { m.sprite.position.set(0, -1000, 0); m.halo.position.set(0, -1000, 0); continue; }
      obj.getWorldPosition(this.tmp);
      if (m.top === null) { const box = new THREE.Box3().setFromObject(obj); m.top = Number.isFinite(box.max.y) ? Math.min(1.65, Math.max(1.5, box.max.y - this.tmp.y)) : 1.7; }
      const far = Math.hypot(this.tmp.x - player.x, this.tmp.z - player.z) > 160;
      const y = far ? -1000 : this.tmp.y + m.top + 0.18 + Math.sin(elapsed * 2.2) * 0.06;
      m.sprite.position.set(this.tmp.x, y, this.tmp.z);
      m.halo.position.copy(m.sprite.position);
      if (m.kind === 'active') (m.halo.material as THREE.SpriteMaterial).opacity = 0.35 + 0.25 * Math.sin(elapsed * 4);
    }
    if (!this.trailTarget) return;
    this.trailT += dt;
    const total = REVEAL_S + HOLD_S + FADE_S;
    if (this.trailT >= total) { this.hidePath(); return; }
    this.trailUniforms.uTime.value = elapsed;
    this.trailUniforms.uReveal.value = Math.min(1, this.trailT / REVEAL_S);
    this.trailUniforms.uAlpha.value = this.trailT > REVEAL_S + HOLD_S ? 1 - (this.trailT - REVEAL_S - HOLD_S) / FADE_S : 1;
    this.repathT -= dt;
    if (this.repathT <= 0) {
      this.repathT = REPATH_S;
      const to = this.d.target?.(this.trailTarget) ?? this.npcPosition(this.trailTarget);
      if (to && Math.hypot(player.x - this.lastFrom.x, player.z - this.lastFrom.y) > 0.4) {
        this.lastFrom.set(player.x, player.z);
        this.rebuildTrail({ x: player.x, z: player.z }, to, player.y);
      }
    }
  }

  dispose() {
    for (const f of this.disposers) f();
    this.disposers.length = 0;
    for (const m of this.markers.values()) { for (const sp of [m.sprite, m.halo]) { this.d.scene.remove(sp); (sp.material as THREE.Material).dispose(); } }
    this.markers.clear();
    this.d.scene.remove(this.trail);
    this.trail.geometry.dispose();
    (this.trail.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
