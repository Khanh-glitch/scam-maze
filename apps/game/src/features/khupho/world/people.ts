import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Ctx } from './types';
import type { House } from './house';
import type { AudioSys } from './audio';
import { makeGroup, type Col } from './builder';
import { motorbike } from './furniture';
import { mulberry32, clamp } from './util';
import { mat } from './materials';
import { BikeRiderInstance, type BikeRiderTemplate } from './bikeRider';
import type { HumanActor, HumanLibrary, HumanModelId, OutfitPart } from './humans';

export interface Life {
  update(dt: number, t: number): void;
  /** Positions of the path walkers and the bikes (dev checks and tests). */
  stats(): { people: readonly THREE.Vector3[]; bikes: { x: number; lane: number; dir: number; speed: number }[] };
}

const SKIN = ['#e0ac84', '#d49a72', '#c98d68', '#e8bb96', '#a8714f'];
const SHIRT = ['#3f6fa8', '#b5473b', '#e0c36a', '#5f9a6a', '#d8d4c8', '#7a5a9a', '#2f2f35', '#d98a4a', '#6aa6b8', '#c4688a', '#f2efe6'];
const PANTS = ['#2d3445', '#4a4036', '#6b6f78', '#25292f', '#5a4a6a', '#8a7a62'];
const HELMET = ['#e8e4d8', '#d8322a', '#2a5aa0', '#1b1b1b', '#e8b02a', '#f0f0f0'];
const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];

const skinMats = new Map<string, THREE.MeshStandardMaterial>();
const skinM = (c: string) => { let m = skinMats.get(c); if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }); skinMats.set(c, m); } return m; };
const G = {
  torso: new THREE.CapsuleGeometry(0.15, 0.3, 5, 12),
  neck: new THREE.CylinderGeometry(0.045, 0.052, 0.1, 10),
  head: new THREE.SphereGeometry(0.108, 18, 14),
  ear: new THREE.SphereGeometry(0.022, 6, 6),
  nose: new THREE.SphereGeometry(0.018, 8, 6),
  eye: new THREE.SphereGeometry(0.011, 6, 5),
  hairCap: new THREE.SphereGeometry(0.114, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
  helmet: new THREE.SphereGeometry(0.136, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
  upper: new THREE.CylinderGeometry(0.052, 0.042, 0.3, 10),
  fore: new THREE.CylinderGeometry(0.042, 0.034, 0.28, 10),
  hand: new THREE.SphereGeometry(0.042, 10, 8),
  thigh: new THREE.CylinderGeometry(0.08, 0.06, 0.46, 12),
  calf: new THREE.CylinderGeometry(0.06, 0.042, 0.42, 12),
  shoe: new RoundedBoxGeometry(0.1, 0.07, 0.25, 2, 0.03),
  sandal: new RoundedBoxGeometry(0.11, 0.022, 0.25, 2, 0.008),
  // nón lá: conical with a soft crown, bottom to top
  shoulder: new THREE.SphereGeometry(0.062, 12, 10),
  yoke: new THREE.SphereGeometry(0.15, 16, 10),
  pelvis: new THREE.SphereGeometry(0.15, 16, 10),
  collar: new THREE.TorusGeometry(0.06, 0.014, 6, 16),
  brow: new RoundedBoxGeometry(0.036, 0.007, 0.01, 1, 0.003),
  mouth: new THREE.SphereGeometry(0.014, 8, 5),
  bun: new THREE.SphereGeometry(0.05, 10, 8),
  hairBack: new THREE.SphereGeometry(0.108, 14, 10, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.6),
  bag: new RoundedBoxGeometry(0.2, 0.15, 0.07, 2, 0.025),
  strap: new THREE.CylinderGeometry(0.009, 0.009, 0.5, 5),
  hat: new THREE.LatheGeometry([new THREE.Vector2(0.31, 0), new THREE.Vector2(0.2, 0.04), new THREE.Vector2(0.07, 0.11), new THREE.Vector2(0.0, 0.16)], 28),
};

interface Person { g: THREE.Group; root: THREE.Group; head: THREE.Group; armL: THREE.Group; armR: THREE.Group; elL: THREE.Group; elR: THREE.Group; legL: THREE.Group; legR: THREE.Group; knL: THREE.Group; knR: THREE.Group }

/** Every person group built so far; the engine merges their rigid parts once the world is built. */
export const PERSON_GROUPS: THREE.Group[] = [];
function makePerson(r: () => number, o: { hat?: boolean; shirt?: string; elder?: boolean; kid?: boolean; helmet?: boolean; female?: boolean } = {}): Person {
  const skin = pick(r, SKIN), shirt = o.shirt ?? pick(r, SHIRT), pants = pick(r, PANTS);
  const sk = skinM(skin), cloth = mat('cloth:' + shirt), pm = mat('cloth:' + pants), hairM = mat('r:' + (o.elder ? '#d6d4cf' : '#15120f'));
  const eyeM = mat('r:#101010');
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, p: [number, number, number], s?: [number, number, number], shadow = true) => {
    const mm = new THREE.Mesh(geo, m); mm.position.set(p[0], p[1], p[2]); if (s) mm.scale.set(s[0], s[1], s[2]); mm.castShadow = shadow; parent.add(mm); return mm;
  };
  add(G.torso, cloth, root, [0, 1.14, 0], [1.12, 1, 0.78]);
  add(G.neck, sk, root, [0, 1.47, 0], undefined, false);
  const head = new THREE.Group(); head.position.set(0, 1.56, 0); root.add(head);
  add(G.head, sk, head, [0, 0, 0]);
  add(G.ear, sk, head, [-0.1, -0.01, 0], [0.6, 1, 0.5], false); add(G.ear, sk, head, [0.1, -0.01, 0], [0.6, 1, 0.5], false);
  add(G.nose, sk, head, [0, -0.025, 0.1], [1, 1.2, 1.3], false);
  add(G.eye, eyeM, head, [-0.036, 0.014, 0.093], undefined, false); add(G.eye, eyeM, head, [0.036, 0.014, 0.093], undefined, false);
  const dark = mat('r:#1a1410');
  add(G.brow, dark, head, [-0.036, 0.047, 0.098], [1, 1, 1], false); add(G.brow, dark, head, [0.036, 0.047, 0.098], [1, 1, 1], false);
  add(G.mouth, mat('r:#8a4a42'), head, [0, -0.06, 0.098], [1.7, 0.45, 0.6], false);
  if (!o.helmet && !o.kid) { add(G.hairBack, hairM, head, [0, 0.0, -0.014], [1, 1.02, 1.02], false); if (o.female) add(G.bun, hairM, head, [0, 0.0, -0.115], [1, 1, 1], false); }
  add(G.collar, cloth, root, [0, 1.435, 0], [1, 1, 0.9], false).rotation.x = Math.PI / 2;
  add(G.yoke, cloth, root, [0, 1.35, 0], [1.38, 0.5, 0.85]);
  add(G.pelvis, pm, root, [0, 0.93, 0], [1.1, 0.7, 0.85]);
  if (o.helmet) add(G.helmet, mat('g:' + pick(r, HELMET)), head, [0, 0.005, 0]);
  else add(G.hairCap, hairM, head, [0, 0.01, -0.012]);
  if (o.hat) add(G.hat, mat('woodP:#d9c08a'), head, [0, 0.085, 0]);
  // arms: shoulder → elbow, sleeve is the upper arm
  const limb = (x: number, y: number, parent: THREE.Object3D) => { const p = new THREE.Group(); p.position.set(x, y, 0); parent.add(p); return p; };
  const armL = limb(-0.2, 1.36, root), armR = limb(0.2, 1.36, root);
  add(G.shoulder, cloth, armL, [0, 0, 0]); add(G.shoulder, cloth, armR, [0, 0, 0]);
  add(G.upper, cloth, armL, [0, -0.15, 0]); add(G.upper, cloth, armR, [0, -0.15, 0]);
  const elL = limb(0, -0.3, armL), elR = limb(0, -0.3, armR);
  add(G.fore, sk, elL, [0, -0.14, 0]); add(G.fore, sk, elR, [0, -0.14, 0]);
  add(G.hand, sk, elL, [0, -0.3, 0]); add(G.hand, sk, elR, [0, -0.3, 0]);
  // legs: hip → knee → ankle
  const legL = limb(-0.09, 0.89, root), legR = limb(0.09, 0.89, root);
  add(G.thigh, pm, legL, [0, -0.23, 0]); add(G.thigh, pm, legR, [0, -0.23, 0]);
  const knL = limb(0, -0.46, legL), knR = limb(0, -0.46, legR);
  add(G.calf, pm, knL, [0, -0.21, 0]); add(G.calf, pm, knR, [0, -0.21, 0]);
  const sandal = r() < 0.4;
  const fm = sandal ? mat('woodP:#7a5a3a') : mat('r:#1e1e20');
  add(sandal ? G.sandal : G.shoe, fm, knL, [0, sandal ? -0.415 : -0.385, 0.05]); add(sandal ? G.sandal : G.shoe, fm, knR, [0, sandal ? -0.415 : -0.385, 0.05]);
  if (!o.helmet && r() < 0.4) { // cross-body shoulder bag
    const bm = mat('r:' + pick(r, ['#3a3226', '#6b4a32', '#2b3a4a', '#7a2f2a']));
    add(G.bag, bm, root, [-0.2, 0.98, 0.08], [1, 1, 1]); const st = add(G.strap, bm, root, [-0.04, 1.2, 0.09], [1, 1, 1], false); st.rotation.z = -0.62; st.rotation.x = 0.05;
  }
  if (o.kid) g.scale.setScalar(0.72);
  PERSON_GROUPS.push(g);
  return { g, root, head, armL, armR, elL, elR, legL, legR, knL, knR };
}

function pose(p: Person, name: string, t: number, ph: number, mv: number) {
  const { root, head, armL, armR, elL, elR, legL, legR, knL, knR } = p;
  root.rotation.set(0, 0, 0); root.position.set(0, 0, 0); head.rotation.set(0, 0, 0);
  armL.rotation.set(0, 0, 0.08); armR.rotation.set(0, 0, -0.08); elL.rotation.set(0.12, 0, 0); elR.rotation.set(0.12, 0, 0);
  legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0); knL.rotation.set(0.04, 0, 0); knR.rotation.set(0.04, 0, 0);
  switch (name) {
    case 'walk': {
      const s = Math.sin(ph) * 0.5 * mv;
      legL.rotation.x = s; legR.rotation.x = -s; knL.rotation.x = Math.max(0, -s) * 0.7 + 0.04; knR.rotation.x = Math.max(0, s) * 0.7 + 0.04;
      armL.rotation.x = -s * 0.7; armR.rotation.x = s * 0.7; elL.rotation.x = 0.25; elR.rotation.x = 0.25;
      root.position.y = Math.abs(Math.sin(ph)) * 0.02 * mv; break;
    }
    case 'sit': case 'eat': case 'work': case 'ride': {
      const ride = name === 'ride';
      root.position.y = ride ? -0.22 : -0.43;
      legL.rotation.x = legR.rotation.x = ride ? -1.15 : -1.5;
      knL.rotation.x = knR.rotation.x = ride ? 1.0 : 1.5;
      if (name === 'work') { armL.rotation.x = armR.rotation.x = -1.2; elL.rotation.x = -1.2; elR.rotation.x = -1.3; head.rotation.x = 0.2; }
      else if (name === 'eat') { armL.rotation.x = -0.9; elL.rotation.x = -1.2; armR.rotation.x = -1.2 - Math.max(0, Math.sin(t * 1.6)) * 0.3; elR.rotation.x = -1.7 + Math.max(0, Math.sin(t * 1.6)) * 0.6; head.rotation.x = 0.1; }
      else if (ride) { armL.rotation.x = armR.rotation.x = -1.0; elL.rotation.x = elR.rotation.x = -0.3; }
      else { armL.rotation.x = -0.3; elL.rotation.x = 0.3; armR.rotation.x = -0.3 + Math.sin(t * 0.7) * 0.05; }
      break;
    }
    case 'lie': root.rotation.x = Math.PI / 2; armL.rotation.x = 0.1; armR.rotation.x = 0.1; break;
    case 'cook': armR.rotation.x = -1.15 + Math.sin(t * 5) * 0.18; elR.rotation.x = -0.9; armL.rotation.x = -0.6; elL.rotation.x = -0.8; armR.rotation.z = Math.sin(t * 5) * 0.2; head.rotation.x = 0.25; break;
    case 'wash': root.rotation.x = 0.35; root.position.z = 0.05; armL.rotation.x = -1.0 + Math.sin(t * 6) * 0.2; armR.rotation.x = -1.0 - Math.sin(t * 6) * 0.2; elL.rotation.x = -0.9; elR.rotation.x = -0.9; break;
    case 'phone': armR.rotation.x = -1.6; elR.rotation.x = -2.0; armR.rotation.z = 0.2; head.rotation.z = -0.12; break;
    case 'sweep': root.rotation.x = 0.2; armL.rotation.x = armR.rotation.x = -0.9 + Math.sin(t * 3) * 0.3; elL.rotation.x = elR.rotation.x = -0.3; legL.rotation.x = Math.sin(t * 3) * 0.1; break;
    case 'exercise': armL.rotation.z = 0.2 + (Math.sin(t * 2) * 0.5 + 0.5) * 1.8; armR.rotation.z = -armL.rotation.z; legL.rotation.z = 0.05; break;
    case 'sip': armR.rotation.x = -1.3 - Math.max(0, Math.sin(t * 0.8)) * 0.8; elR.rotation.x = -1.9; armL.rotation.x = -0.4; root.position.y = -0.43; legL.rotation.x = legR.rotation.x = -1.5; knL.rotation.x = knR.rotation.x = 1.5; break;
    case 'stand': default: armL.rotation.x = Math.sin(t * 0.9) * 0.03; armR.rotation.x = -Math.sin(t * 0.9) * 0.03; break;
  }
}

type Slot = [number, number, string];
const MOM: Slot[] = [[5.5, 6.2, 'rice'], [6.2, 7.6, 'cook'], [7.6, 8.3, 'eat1'], [8.3, 10.3, 'laundry'], [10.3, 11.4, 'cook'], [11.4, 12.4, 'eat1'], [12.4, 14.3, 'tv'], [14.3, 15.5, 'pray'], [15.5, 17, 'wash'], [17, 18.6, 'cook'], [18.6, 19.6, 'eat1'], [19.6, 22, 'tv'], [22, 24, 'bed'], [0, 5.5, 'bed']];
const DAD: Slot[] = [[5.5, 6.4, 'eat2'], [6.4, 17.3, 'out'], [17.3, 18.5, 'lounge'], [18.5, 19.6, 'eat2'], [19.6, 22.5, 'tv'], [22.5, 24, 'bed'], [0, 5.5, 'bed']];
const KID: Slot[] = [[6, 7, 'eat3'], [7, 11.5, 'out'], [11.5, 12.5, 'eat3'], [12.5, 13.5, 'lounge'], [13.5, 17, 'desk'], [17, 18.6, 'out'], [18.6, 19.6, 'eat3'], [19.6, 22, 'desk'], [22, 24, 'bed'], [0, 6, 'bed']];
const SHOP: Slot[] = [[6, 11.8, 'shop'], [11.8, 12.8, 'eat1'], [12.8, 15.8, 'shop'], [15.8, 16.6, 'pray'], [16.6, 21, 'shop'], [21, 22.5, 'tv'], [22.5, 24, 'bed'], [0, 6, 'bed']];
const ELDER: Slot[] = [[5, 6.5, 'pray'], [6.5, 9, 'tv'], [9, 12, 'lounge'], [12, 13, 'eat2'], [13, 15, 'bed'], [15, 17, 'lounge'], [17, 19, 'tv'], [19, 21, 'pray'], [21, 24, 'bed'], [0, 5, 'bed']];
const pickSlot = (s: Slot[], h: number) => (s.find((x) => h >= x[0] && h < x[1]) ?? s[0])[2];

class Resident {
  p: Person; cur = ''; spot: House['spots'][string] | null = null; route: { x: number; z: number }[] = []; ph = 0;
  hidden = false; poseName = 'stand'; spotDev = '';
  h: House;
  sched: Slot[];
  ctx: Ctx;
  constructor(h: House, sched: Slot[], ctx: Ctx, r: () => number, o: { female?: boolean; kid?: boolean; elder?: boolean } = {}) { this.h = h; this.sched = sched; this.ctx = ctx;
    this.p = makePerson(r, o); ctx.root.add(this.p.g); this.p.g.visible = false; this.hidden = true;
  }
  localNow() { const l = this.h.toLocal(this.p.g.position.x, this.p.g.position.z); return { x: l.x, z: l.z, k: clamp(Math.round((this.p.g.position.y - 0.35) / 3.3), 0, this.h.n) }; }
  setDev(on: boolean) { const d = this.spotDev && this.h.devices[this.spotDev]; if (d && d.on !== on) d.set(on); }
  begin(act: string, near: boolean) {
    this.setDev(false); this.spotDev = '';
    const h = this.h;
    if (act === 'out') {
      if (this.hidden) { this.cur = act; return; }
      const l = this.localNow(); const pts = h.route(l.k, l.x, l.z, 0, 0, 0, false, true);
      this.route = pts.map((q) => { const w = h.wp(q.x, 0, q.z); return { x: w.x, z: w.z }; }); this.cur = act; this.spot = null; this.poseName = 'walk';
      if (!near) this.finishOut(); return;
    }
    const s = h.spots[act] ?? h.spots['lounge'] ?? h.spots['tv']; this.cur = act;
    if (!s) return;
    let pts: { x: number; z: number }[];
    if (this.hidden) { this.p.g.visible = true; this.hidden = false; const w = h.wp(h.doorX, 0.2, -1.3); this.p.g.position.set(w.x, 0.15, w.z); pts = h.route(0, 0, 0, s.k, s.x, s.z, true); }
    else { const l = this.localNow(); pts = h.route(l.k, l.x, l.z, s.k, s.x, s.z); }
    this.route = pts.map((q) => { const w = h.wp(q.x, 0, q.z); return { x: w.x, z: w.z }; }); this.spot = s; this.poseName = 'walk';
    if (!near) this.arrive();
  }
  finishOut() { this.p.g.visible = false; this.hidden = true; this.route = []; }
  arrive() {
    const s = this.spot; if (!s) return; const h = this.h, w = h.wp(s.x, 0, s.z);
    this.route = []; this.p.g.position.set(w.x, h.F(s.k) + (s.y ?? 0) + (s.pose === 'lie' ? 0.12 : 0), w.z);
    this.p.g.rotation.y = s.yaw + h.rot; this.poseName = s.pose; this.p.g.visible = true; this.hidden = false;
    this.spotDev = s.device ?? ''; if (this.spotDev) { const d = h.devices[this.spotDev]; if (d && !d.on) d.set(true); }
  }
  update(dt: number, t: number, hour: number, player: THREE.Vector3) {
    const act = pickSlot(this.sched, hour);
    const dist = this.hidden ? 99 : this.p.g.position.distanceTo(player);
    if (act !== this.cur && !this.route.length) this.begin(act, dist < 22 || this.h.contains(player.x, player.z));
    if (this.hidden) return;
    const g = this.p.g;
    if (this.route.length) {
      const n = this.route[0], dx = n.x - g.position.x, dz = n.z - g.position.z, d = Math.hypot(dx, dz);
      const sp = 1.15;
      if (d < 0.12) { this.route.shift(); if (!this.route.length) { if (this.cur === 'out') this.finishOut(); else this.arrive(); } }
      else {
        const want = Math.atan2(dx, dz); let dy = want - g.rotation.y; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        g.rotation.y += dy * Math.min(1, dt * 8); const st = Math.min(d, sp * dt);
        g.position.x += (dx / d) * st; g.position.z += (dz / d) * st;
        const fy = this.ctx.phys.floorAt(g.position.x, g.position.z, g.position.y + 0.1, 0.55).y; g.position.y += (fy - g.position.y) * Math.min(1, dt * 10);
        this.ph += st * 5.2; this.poseName = 'walk';
      }
    }
    pose(this.p, this.poseName, t, this.ph, this.poseName === 'walk' ? 1 : 0);
  }
}

/** How far ahead (m) a walker looks for people in its way, and how wide its way is (to each side). */
const AVOID_LOOK = 2.8;
const AVOID_WIDTH = 0.7;
/** Side step (m) off the path to pass someone, and how fast (m/s) the walker moves sideways. */
const SIDESTEP = 0.7;
const SIDESTEP_SPEED = 0.9;
/** Seconds without anyone in the way before a walker drifts back onto its path. */
const AVOID_CLEAR = 1.2;
/** A walker that cannot step aside waits at most this long (s), then squeezes past slowly. */
const AVOID_WAIT = 2.5;

/**
 * Walks back and forth along `pts`, stepping to one side when a person (another walker or the
 * player) is in the way: away from where that person is, to the right when they are straight ahead,
 * so two people walking toward each other pass. A side blocked by a solid (tree, parked bike, wall)
 * is not taken; with both sides blocked the walker waits, then squeezes past slowly.
 */
class PathFollower {
  i = 0;
  /** Point on the path the walker is abreast of; the walker stands `offset` m to its right. */
  private readonly base: THREE.Vector3;
  private offset = 0;
  private target = 0;
  private clearT = 0;
  private decideT = Math.random() * 0.15;
  private waitT = 0;
  /** Share of the walking speed used now (slower while passing close, 0 while waiting). */
  pace = 1;
  private readonly probe = { x: 0, z: 0 };
  readonly pts: THREE.Vector3[];
  sp: number;
  private readonly ctx: Ctx;
  readonly g: THREE.Object3D;
  constructor(pts: THREE.Vector3[], sp: number, ctx: Ctx, g: THREE.Object3D) {
    this.pts = pts; this.sp = sp; this.ctx = ctx; this.g = g;
    this.base = pts[0].clone(); g.position.copy(pts[0]);
  }
  /** True when a 0.25 m body at (x, z) would be pushed out of a solid. */
  private solidAt(x: number, z: number) {
    this.probe.x = x; this.probe.z = z;
    this.ctx.phys.collide(this.probe, this.base.y, 0.25);
    return Math.abs(this.probe.x - x) + Math.abs(this.probe.z - z) > 0.05;
  }
  /** Moves the walker; returns the distance walked this frame. `people` are all walkers' positions. */
  step(dt: number, people: readonly THREE.Vector3[], player: THREE.Vector3): number {
    const g = this.g, n = this.pts[this.i];
    let dx = n.x - this.base.x, dz = n.z - this.base.z, d = Math.hypot(dx, dz);
    if (d < 0.15) {
      // Turning around: the right-hand side flips, so the same spot is now on the other side.
      this.i = (this.i + 1) % this.pts.length; this.offset = -this.offset; this.target = -this.target;
      const m = this.pts[this.i]; dx = m.x - this.base.x; dz = m.z - this.base.z; d = Math.max(1e-4, Math.hypot(dx, dz));
    }
    const fx = dx / d, fz = dz / d, rx = -fz, rz = fx;
    this.decideT -= dt;
    if (this.decideT <= 0) {
      this.decideT = 0.15;
      let along = Infinity, lat = 0;
      const look = (px: number, pz: number) => {
        const ox = px - g.position.x, oz = pz - g.position.z, a = ox * fx + oz * fz, l = ox * rx + oz * rz;
        if (a > -0.3 && a < AVOID_LOOK && Math.abs(l) < AVOID_WIDTH && a < along) { along = a; lat = l; }
      };
      for (const q of people) if (q !== g.position) look(q.x, q.z);
      if (player.y - 1.62 < this.base.y + 1) look(player.x, player.z);
      if (along !== Infinity) {
        // Away from the person; to the right when they are straight ahead.
        const side = lat > 0.1 ? -1 : 1;
        const free = (o: number) => !this.solidAt(this.base.x + rx * o + fx * 0.5, this.base.z + rz * o + fz * 0.5);
        if (free(side * SIDESTEP)) this.target = side * SIDESTEP;
        else if (free(-side * SIDESTEP)) this.target = -side * SIDESTEP;
        const close = along < 0.9 && Math.abs(lat - (this.target - this.offset)) < 0.55;
        const blocked = close && Math.abs(this.target - this.offset) < 0.1 && along < 0.7;
        this.waitT = blocked ? this.waitT + 0.15 : 0;
        this.pace = blocked ? (this.waitT > AVOID_WAIT ? 0.35 : 0) : close ? 0.45 : 0.85;
        this.clearT = AVOID_CLEAR;
      } else {
        this.clearT -= 0.15;
        this.pace = 1; this.waitT = 0;
        if (this.clearT <= 0) this.target = 0;
      }
    }
    const before = this.offset;
    const ds = SIDESTEP_SPEED * dt;
    this.offset += THREE.MathUtils.clamp(this.target - this.offset, -ds, ds);
    const st = Math.min(this.sp * this.pace * dt, d);
    this.base.x += fx * st; this.base.z += fz * st;
    const side = this.offset - before;
    const nx = this.base.x + rx * this.offset, nz = this.base.z + rz * this.offset;
    const mx = fx * st + rx * side, mz = fz * st + rz * side;
    g.position.x = nx; g.position.z = nz;
    if (mx * mx + mz * mz > 1e-8) {
      const want = Math.atan2(mx, mz); let dy = want - g.rotation.y; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      g.rotation.y += dy * Math.min(1, dt * 6);
    }
    const fy = this.ctx.phys.floorAt(g.position.x, g.position.z, 2, 0.6).y; g.position.y += (fy - g.position.y) * Math.min(1, dt * 8);
    this.base.y = g.position.y;
    return Math.hypot(st, side);
  }
}

class Walker {
  p: Person; ph = Math.random() * 6;
  path: PathFollower;
  constructor(pts: THREE.Vector3[], sp: number, ctx: Ctx, r: () => number, o: { hat?: boolean; kid?: boolean; elder?: boolean; pole?: boolean; shirt?: string } = {}) {
    this.p = makePerson(r, o); ctx.root.add(this.p.g);
    this.path = new PathFollower(pts, sp, ctx, this.p.g);
    if (o.pole) {
      // carrying pole with two baskets (gánh hàng rong)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.4, 6), mat('woodP:#8a6a3a'));
      pole.rotation.z = Math.PI / 2; pole.position.set(0, 1.42, 0); this.p.root.add(pole);
      for (const s of [-1, 1]) {
        const bsk = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.14, 0), new THREE.Vector2(0.2, 0.16), new THREE.Vector2(0.18, 0.2)], 16), mat(s > 0 ? 'woodP:#c9a06a' : 'woodP:#b08a58'));
        bsk.position.set(s * 0.65, 1.0, 0); bsk.castShadow = true; this.p.root.add(bsk);
        const cov = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 14), mat(s > 0 ? 'g:#e8452a' : 'g:#7ab04a'));
        cov.position.set(s * 0.65, 1.12, 0); this.p.root.add(cov);
      }
    }
  }
  update(dt: number, t: number, people: readonly THREE.Vector3[], player: THREE.Vector3) {
    this.ph += this.path.step(dt, people, player) * 5.4;
    pose(this.p, 'walk', t, this.ph, this.path.pace > 0 ? 1 : 0);
  }
}

class Static {
  p: Person;
  poseName: string;
  hours?: [number, number];
  constructor(ctx: Ctx, r: () => number, x: number, y: number, z: number, yaw: number, poseName: string, o: { hat?: boolean; elder?: boolean; kid?: boolean } = {}, hours?: [number, number]) {
    this.poseName = poseName; this.hours = hours;
    this.p = makePerson(r, o); this.p.g.position.set(x, y, z); this.p.g.rotation.y = yaw; ctx.root.add(this.p.g);
  }
  update(t: number, hour: number) { const v = !this.hours || (hour >= this.hours[0] && hour < this.hours[1]); this.p.g.visible = v; if (v) pose(this.p, this.poseName, t, 0, 0); }
}

/** Clothing colors for street NPCs (each walker draws its own top, bottom and shoes). */
const OUTFIT_TOP = ['#f2efe6', '#3f6fa8', '#b5473b', '#5f9a6a', '#2f2f35', '#d8d4c8', '#c4688a', '#e0c36a', '#6aa6b8', '#7a5a9a', '#d98a4a'];
const OUTFIT_BOTTOM = ['#2d3445', '#4a4036', '#6b6f78', '#25292f', '#8a7a62', '#1f2a3a', '#5a4a3a', '#d8d0c0'];
const OUTFIT_SHOES = ['#1b1b1b', '#3a2a20', '#e8e4dc', '#5a4a3a'];
/** Model walkers farther than this (m) are not drawn. */
const WALKER_HIDE_DISTANCE = 60;

/** Slowest and fastest playback of a walk clip before its legs look wrong. */
const WALK_CLIP_RANGE: [number, number] = [0.8, 1.45];

/** A character model walking back and forth along `pts` (same path logic as Walker). */
class ModelWalker {
  a: HumanActor;
  path: PathFollower;
  private clipScale = 1;
  constructor(actor: HumanActor, pts: THREE.Vector3[], sp: number, ctx: Ctx) {
    this.a = actor; ctx.root.add(actor.object);
    // The clip speed follows the ground speed so the feet do not slide. A clip is sped up or slowed
    // down by at most WALK_CLIP_RANGE; past that the walker moves at the clip's pace instead.
    let ts = 1;
    if (actor.walkSpeed > 0) {
      ts = THREE.MathUtils.clamp(sp / actor.walkSpeed, WALK_CLIP_RANGE[0], WALK_CLIP_RANGE[1]);
      sp = actor.walkSpeed * ts;
    }
    this.clipScale = ts;
    this.path = new PathFollower(pts, sp, ctx, actor.object);
    actor.play('walk', { fade: 0, timeScale: ts });
  }
  update(dt: number, player: THREE.Vector3, people: readonly THREE.Vector3[]) {
    const g = this.a.object;
    this.path.step(dt, people, player);
    // Waiting for someone: stand; walking slower to pass close: slower steps, so the feet do not slide.
    const pace = this.path.pace;
    if (pace === 0) { if (this.a.playing !== 'idle') this.a.play('idle', { fade: 0.25 }); }
    else if (this.a.playing !== 'walk') this.a.play('walk', { fade: 0.25, timeScale: this.clipScale * pace });
    else this.a.setTimeScale(this.clipScale * pace);
    const away = g.position.distanceTo(player);
    g.visible = away < WALKER_HIDE_DISTANCE;
    this.a.update(dt, away);
  }
}

/** Seconds between the vendor's own little actions (looking for customers, preparing bread). */
const VENDOR_FIDGET: [number, number] = [9, 16];
/** The vendor greets the player who comes within this distance (m), at most once per cooldown. */
const VENDOR_GREET_DISTANCE = 3.2;
const VENDOR_GREET_COOLDOWN = 25;

/** The banh mi vendor beside the cart: idle, an occasional action, and a greeting when the player comes close. */
class Vendor {
  a: HumanActor;
  hours: [number, number];
  private next = 4;
  private greetT = 0;
  private near = false;
  constructor(actor: HumanActor, ctx: Ctx, x: number, y: number, z: number, yaw: number, hours: [number, number]) {
    this.a = actor; this.hours = hours;
    actor.object.position.set(x, y, z); actor.object.rotation.y = yaw; ctx.root.add(actor.object);
    actor.play('idle', { fade: 0 });
  }
  private once(role: 'welcome' | 'invite' | 'prepare' | 'lookAround') {
    if (!this.a.can(role)) return;
    this.a.play(role, { once: true, fade: 0.35, then: () => this.a.play('idle', { fade: 0.45 }) });
  }
  update(dt: number, hour: number, player: THREE.Vector3) {
    const v = hour >= this.hours[0] && hour < this.hours[1];
    this.a.object.visible = v;
    if (!v) return;
    const d = this.a.object.position.distanceTo(player);
    this.greetT -= dt;
    const near = d < VENDOR_GREET_DISTANCE && player.y < 1.2;
    if (near && !this.near && this.greetT <= 0) {
      this.greetT = VENDOR_GREET_COOLDOWN;
      this.once(Math.random() < 0.5 ? 'welcome' : 'invite');
      this.next = VENDOR_FIDGET[0];
    }
    this.near = near;
    this.next -= dt;
    if (this.next <= 0 && this.a.playing === 'idle') {
      this.next = VENDOR_FIDGET[0] + Math.random() * (VENDOR_FIDGET[1] - VENDOR_FIDGET[0]);
      this.once(Math.random() < 0.55 ? 'lookAround' : 'prepare');
    }
    this.a.update(dt, d);
  }
}

/** Half length and half width (m) of a bike with rider, used for its collider and for braking. */
const BIKE_HALF_LEN = 0.95;
const BIKE_HALF_WIDTH = 0.42;
/** Collision radius of the player (Player.update uses 0.28). */
const PLAYER_RADIUS = 0.28;
/** Distance (m) a bike keeps to the player or to the bike ahead once stopped. */
const BIKE_STOP_GAP = 0.8;
/** Braking deceleration (m/s²) a bike plans with; it brakes harder only when it must. */
const BIKE_DECEL = 4.5;
/** How far ahead (m) a bike looks for the player and for other bikes. */
const BIKE_LOOK = 18;
/** Street loop: bikes leave at +/-STREET_END and come back on the other end. */
const STREET_END = 72;
/** Height of the camera above the feet (Player.eyeH). */
const EYE_HEIGHT = 1.62;

/** Highest speed that still stops `gap` meters ahead at BIKE_DECEL (0 when the gap is used up). */
const speedForGap = (gap: number) => (gap <= BIKE_STOP_GAP ? 0 : Math.sqrt(2 * BIKE_DECEL * (gap - BIKE_STOP_GAP)));

class Bike {
  g: THREE.Group; speed = 0; base: number; dir: 1 | -1; lane: number; x: number; info: { pos: THREE.Vector3; speed: number };
  /** Box the player collides with (Physics.dynamic), moved with the bike. */
  col: Col;
  /** The scanned scooter and rider when its file loaded; otherwise the procedural bike and person below. */
  private model: BikeRiderInstance | null = null;
  constructor(ctx: Ctx, r: () => number, dir: 1 | -1, x: number, vehicles: { pos: THREE.Vector3; speed: number }[], template: BikeRiderTemplate | null) {
    const col = pick(r, ['#c92f2a', '#2a5aa0', '#222', '#e8e6e0', '#3a7a4a', '#d8a92a', '#7a2a2a']);
    const shirt = pick(r, SHIRT);
    if (template) {
      this.g = new THREE.Group();
      this.model = new BikeRiderInstance(template);
      this.g.add(this.model.object);
    } else {
      this.g = makeGroup((b) => motorbike(b, 0, 0, 0, 0, col, false));
      const rider = makePerson(r, { shirt, helmet: true }); rider.g.position.set(0, 0.0, -0.1); this.g.add(rider.g);
      pose(rider, 'ride', 0, 0, 0);
      this.g.traverse((o) => { o.castShadow = true; });
    }
    this.dir = dir; this.lane = dir > 0 ? 1.8 + r() * 0.5 : -1.8 - r() * 0.5; this.x = x; this.base = 4.5 + r() * 5;
    this.g.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; ctx.root.add(this.g);
    this.info = { pos: this.g.position, speed: 0 }; vehicles.push(this.info);
    this.col = { x0: 0, x1: 0, y0: 0, y1: 1.5, z0: this.lane - BIKE_HALF_WIDTH, z1: this.lane + BIKE_HALF_WIDTH, enabled: true, tag: 'bike' };
    ctx.phys.dynamic.push(this.col);
    this.placeCollider();
  }
  private placeCollider() { this.col.x0 = this.x - BIKE_HALF_LEN; this.col.x1 = this.x + BIKE_HALF_LEN; }
  /** Free road (m) in front of this bike's nose up to `x`, along its direction, across the street loop. */
  private aheadOf(x: number) { const L = STREET_END * 2; return (((x - this.x) * this.dir) % L + L) % L; }
  /**
   * Speed limit from what is ahead: the player standing in (or next to) the lane, and the next
   * bike in the same lane. Bikes brake to stop BIKE_STOP_GAP short of either.
   */
  private limit(player: THREE.Vector3, bikes: readonly Bike[]): { v: number; playerGap: number } {
    let v = this.base, playerGap = Infinity;
    const feet = player.y - EYE_HEIGHT;
    if (feet < 0.8 && Math.abs(player.z - this.lane) < BIKE_HALF_WIDTH + PLAYER_RADIUS + 0.35) {
      const along = (player.x - this.x) * this.dir;
      // Also while overlapping from behind the nose (the player stepped onto the bike): stand still.
      if (along > -BIKE_HALF_LEN - PLAYER_RADIUS && along < BIKE_LOOK) {
        playerGap = along - BIKE_HALF_LEN - PLAYER_RADIUS;
        v = Math.min(v, speedForGap(playerGap));
      }
    }
    for (const o of bikes) {
      if (o === this || o.dir !== this.dir || Math.abs(o.lane - this.lane) > BIKE_HALF_WIDTH * 2 + 0.25) continue;
      const gap = this.aheadOf(o.x) - BIKE_HALF_LEN * 2;
      if (gap < BIKE_LOOK) v = Math.min(v, Math.max(0, Math.min(o.speed + speedForGap(gap) * 0.5, speedForGap(gap))));
    }
    return { v, playerGap };
  }
  update(dt: number, player: THREE.Vector3, audio: AudioSys, bikes: readonly Bike[]) {
    const { v, playerGap } = this.limit(player, bikes);
    // Brake at once to the limit when it is below the speed; speed up gently otherwise.
    if (v < this.speed) this.speed = Math.max(v, this.speed - BIKE_DECEL * 2.5 * dt);
    else this.speed += (v - this.speed) * Math.min(1, dt * 1.2);
    let step = this.speed * dt;
    // Never move into the player or the bike ahead, whatever the speed was.
    if (playerGap !== Infinity) step = Math.min(step, Math.max(0, playerGap - BIKE_STOP_GAP * 0.5));
    for (const o of bikes) {
      if (o === this || o.dir !== this.dir || Math.abs(o.lane - this.lane) > BIKE_HALF_WIDTH * 2 + 0.25) continue;
      step = Math.min(step, Math.max(0, this.aheadOf(o.x) - BIKE_HALF_LEN * 2 - 0.3));
    }
    if (step < this.speed * dt) this.speed = step / Math.max(dt, 1e-4);
    this.x += this.dir * step; if (this.x > STREET_END) this.x -= STREET_END * 2; if (this.x < -STREET_END) this.x += STREET_END * 2;
    this.g.position.set(this.x, 0, this.lane); this.info.speed = this.speed;
    this.placeCollider();
    if (this.model) {
      // While stopped, the rider looks at the player (yaw in the bike's own frame, 0 = ahead).
      let look: number | null = null;
      if (this.speed < 1.5) {
        const yaw = this.g.rotation.y, dx = player.x - this.x, dz = player.z - this.lane;
        look = Math.atan2(dx * Math.cos(yaw) - dz * Math.sin(yaw), dx * Math.sin(yaw) + dz * Math.cos(yaw));
      }
      this.model.update(dt, this.speed, look);
    }
    if (this.speed < 0.5 && playerGap < 4) audio.horn(this.g.position);
  }
}

export function buildLife(ctx: Ctx, houses: House[], vehicles: { pos: THREE.Vector3; speed: number }[], audio: AudioSys, bikeRider: BikeRiderTemplate | null = null, humans: HumanLibrary | null = null): Life {
  PERSON_GROUPS.length = 0;
  const r = mulberry32(99);
  const residents: Resident[] = [], walkers: Walker[] = [], statics: Static[] = [], bikes: Bike[] = [];
  const modelWalkers: ModelWalker[] = [], vendors: Vendor[] = [];
  houses.filter((h) => !h.spec.lite).forEach((h, i) => {
    const shop = ['grocery', 'cafe', 'pho', 'repair', 'hair'].includes(h.spec.ground);
    const list: Slot[][] = shop ? [SHOP, MOM, h.n > 1 ? KID : DAD] : i % 3 === 0 ? [MOM, DAD, KID] : i % 3 === 1 ? [MOM, ELDER] : [ELDER, DAD, MOM];
    list.forEach((s, j) => residents.push(new Resident(h, s, ctx, r, { female: j === 0, kid: s === KID, elder: s === ELDER })));
  });
  residents.forEach((res) => { const act = pickSlot(res.sched, ctx.env.hour); res.cur = ''; res.begin(act, false); });
  const V = (x: number, z: number) => new THREE.Vector3(x, 0.15, z);
  // Street NPCs get their own random stream for outfits, so adding one does not reshuffle the rest of the world.
  const outfitRng = mulberry32(4242);
  const outfit = (model: HumanModelId): Partial<Record<OutfitPart, string>> | undefined => model.startsWith('npc')
    ? { top: pick(outfitRng, OUTFIT_TOP), bottom: pick(outfitRng, OUTFIT_BOTTOM), shoes: pick(outfitRng, OUTFIT_SHOES) }
    : undefined;
  /** A path walker using a character model when it loaded; otherwise a procedural person, or nobody when `fallback` is false. */
  const walk = (pts: THREE.Vector3[], sp: number, o: ConstructorParameters<typeof Walker>[4], model?: HumanModelId, fallback = true) => {
    const actor = model ? humans?.spawn(model, outfit(model)) : null;
    if (actor && actor.can('walk')) modelWalkers.push(new ModelWalker(actor, pts, sp, ctx));
    else if (fallback) walkers.push(new Walker(pts, sp, ctx, r, o));
  };
  const sid = (zz: number, a: number, b: number, sp: number, o: ConstructorParameters<typeof Walker>[4] = {}, model?: HumanModelId, fallback = true) => walk([V(a, zz), V(b, zz)], sp, o, model, fallback);
  sid(4.7, -50, 50, 1.2, { hat: true }, 'npcYoshida'); sid(-4.6, 45, -50, 1.1, {}, 'juno3'); sid(4.3, 40, -30, 1.3, { kid: true }); sid(-4.3, -45, 40, 0.8, { pole: true, hat: true });
  sid(4.9, -20, 30, 1.0, { elder: true }, 'npcNguoiGia'); sid(-5.0, 20, -40, 1.25, { hat: true }, 'manVN'); sid(4.5, 45, -45, 1.4, {}, 'rowan');
  const alley = (a: number, b: number, sp: number, x: number, o: ConstructorParameters<typeof Walker>[4] = {}, model?: HumanModelId) => walk([new THREE.Vector3(x, 0.02, a), new THREE.Vector3(x, 0.02, b)], sp, o, model);
  alley(8, 45, 1.0, 10.1, { hat: true }, 'npcArthur'); alley(44, 8, 1.2, 9.3, {}, 'npcAlice'); alley(20, 46, 0.7, 10.7, { elder: true }); alley(12, 38, 1.5, 9.8, { kid: true });
  // Extra sidewalk walkers from the street NPC set (only when their model loaded).
  sid(-4.9, -30, 35, 1.15, {}, 'npcAlan', false); sid(4.6, 10, -45, 1.05, {}, 'npcLinMei', false);
  sid(-4.4, 0, 55, 1.2, {}, 'npcNapole', false); sid(4.2, -40, 20, 1.3, {}, 'npcArchetype', false);
  sid(-4.7, 40, -20, 1.2, {}, 'npcBlackGuy', false); sid(4.4, -10, 50, 1.1, {}, 'npcFreya', false); sid(-4.5, -50, 0, 1.0, {}, 'npcSofia', false);
  const cafe = houses.filter((h) => !h.spec.lite)[3];
  if (cafe) { const cx = cafe.ox - cafe.W / 2; statics.push(new Static(ctx, r, cx - 1.5, 0.15, 4.5, Math.PI / 2, 'sip', { elder: true }, [6, 21])); statics.push(new Static(ctx, r, cx + 0.5, 0.15, 5.0, -Math.PI / 2, 'sip', {}, [7, 20])); }
  // Banh mi vendor beside the cart from streetProps.ts.
  const vendorActor = humans?.spawn('banhmiVendor');
  if (vendorActor) vendors.push(new Vendor(vendorActor, ctx, -1.75, 0.15, -4.9, 0, [6, 20]));
  else statics.push(new Static(ctx, r, -1.75, 0.15, -4.9, 0, 'stand', { hat: true }, [6, 20]));
  statics.push(new Static(ctx, r, 6.6, 0.02, 46.2, 0.5, 'exercise', { elder: true }, [4.8, 7.5]));
  statics.push(new Static(ctx, r, 20.6, 0.02, 45.8, Math.PI, 'sit', { elder: true }, [6, 22]));
  statics.push(new Static(ctx, r, 10.3, 0.02, 14.0, -Math.PI / 2, 'sweep', {}, [5.5, 7.2]));
  statics.push(new Static(ctx, r, 15.3, 0.02, 45.0, 0, 'phone', { kid: true }, [15.5, 22]));
  for (let i = 0; i < 12; i++) bikes.push(new Bike(ctx, r, i % 2 ? 1 : -1, -70 + i * 12 + r() * 6, vehicles, bikeRider));
  // Everyone walking a path, for side-stepping (each walker skips its own entry).
  const people: THREE.Vector3[] = [...walkers.map((w) => w.p.g.position), ...modelWalkers.map((w) => w.a.object.position)];
  let acc = 0;
  const occ = new Map<object, number>();
  return {
    stats: () => ({ people, bikes: bikes.map((b) => ({ x: b.x, lane: b.lane, dir: b.dir, speed: b.speed })) }),
    update(dt, t) {
      const hour = ctx.env.hour, pp = ctx.eye;
      for (const rs of residents) rs.update(dt, t, hour, pp);
      for (const w of walkers) w.update(dt, t, people, pp);
      for (const w of modelWalkers) w.update(dt, pp, people);
      for (const v of vendors) v.update(dt, hour, pp);
      for (const s of statics) s.update(t, hour);
      for (const b of bikes) b.update(dt, pp, audio, bikes);
      acc -= dt; if (acc > 0) return; acc = 0.6;
      occ.clear();
      for (const rs of residents) {
        if (rs.hidden) continue;
        const rm = rs.h.roomAtWorld(rs.p.g.position.x, rs.p.g.position.y + 1, rs.p.g.position.z);
        if (rm) occ.set(rm, (occ.get(rm) ?? 0) + 1);
      }
      const dark = ctx.env.sun < 0.62;
      for (const h of houses) {
        if (h.spec.lite) continue;
        const shop = ['grocery', 'cafe', 'pho', 'repair', 'hair'].includes(h.spec.ground);
        const dayOpen = hour >= 6 && hour < (shop ? 21.5 : 22);
        const sh = h.devices['shutter']; if (sh && sh.on !== dayOpen) sh.set(dayOpen);
        // Front doors stay closed unless the player opens them (owner); the schedule no longer opens them by day.
        for (const rm of h.rooms) {
          const l = rm.light; if (!l) continue;
          const n = occ.get(rm) ?? 0, prev = (l as any)._occ ?? -1;
          const interiorDark = ['hall', 'wc', 'laundry', 'kitchen'].includes(rm.kind);
          if (n !== prev) { l.manual = false; (l as any)._occ = n; }
          if (l.manual) continue;
          const shopOpen = ['shop', 'cafe', 'pho', 'hair', 'repair'].includes(rm.kind) && dayOpen && (dark || hour > 15);
          const want = (n > 0 && (dark || interiorDark)) || shopOpen;
          l.target = want ? 1 : 0;
        }
      }
    },
  };
}
