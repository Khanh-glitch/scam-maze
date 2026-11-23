import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Vec = [number, number, number];
const cube = new T.BoxGeometry();
const quad = new T.PlaneGeometry();
const up = new T.Vector3(0, 1, 0);

export const asset = (name: string) => `/assets/testbus/ow/images/${name}`;
export const material = (color: T.ColorRepresentation, roughness = 0.75, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
export const lamp = (color: T.ColorRepresentation, intensity = 0.75) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35 });

export function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export function mesh(group: T.Object3D, geometry: T.BufferGeometry, surface: T.Material, position: Vec, shadow = true) {
  const object = new T.Mesh(geometry, surface);
  object.position.set(...position);
  object.castShadow = shadow && !surface.transparent;
  object.receiveShadow = shadow;
  group.add(object);
  return object;
}

export function box(group: T.Object3D, p: Vec, size: Vec, surface: T.Material, shadow = true) {
  const item = mesh(group, cube, surface, p, shadow);
  item.scale.set(...size);
  return item;
}

export function rounded(group: T.Object3D, p: Vec, size: Vec, radius: number, surface: T.Material, shadow = true) {
  return mesh(group, new RoundedBoxGeometry(...size, radius < 0.042 ? 1 : 2, radius), surface, p, shadow);
}

export function plane(group: T.Object3D, p: Vec, size: [number, number], surface: T.Material, yaw = 0, pitch = 0) {
  const item = mesh(group, quad, surface, p, false);
  item.scale.set(...size, 1);
  item.rotation.set(pitch, yaw, 0);
  item.receiveShadow = !surface.transparent;
  return item;
}

export function rod(group: T.Object3D, a: Vec, b: Vec, radius: number, surface: T.Material, top = radius, segments = 8) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b);
  const direction = end.clone().sub(start);
  const item = mesh(group, new T.CylinderGeometry(top, radius, direction.length(), segments), surface, start.lerp(end, 0.5).toArray());
  item.quaternion.setFromUnitVectors(up, direction.normalize());
  return item;
}

export function tube(group: T.Object3D, points: Vec[], radius: number, surface: T.Material, segments = 10, closed = false) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)), closed, 'centripetal');
  return mesh(group, new T.TubeGeometry(curve, segments, radius, 6, closed), surface, [0, 0, 0]);
}

export function orb(group: T.Object3D, p: Vec, scale: Vec, surface: T.Material, detail = 12) {
  const item = mesh(group, new T.SphereGeometry(1, detail, Math.ceil(detail * 0.68)), surface, p);
  item.scale.set(...scale);
  return item;
}

export function polygon(group: T.Object3D, points: Vec[], surface: T.Material) {
  const origin = new T.Vector3(...points[0]);
  const h = new T.Vector3(...points[1]).sub(origin).normalize();
  const normal = h.clone().cross(new T.Vector3(...points[2]).sub(origin)).normalize();
  const v = normal.cross(h);
  const points2d = points.map((point) => {
    const d = new T.Vector3(...point).sub(origin);
    return new T.Vector2(d.dot(h), d.dot(v));
  });
  const shape = new T.Shape(points2d);
  const geo = new T.ShapeGeometry(shape);
  geo.applyMatrix4(new T.Matrix4().makeBasis(h, v, h.clone().cross(v)));
  geo.translate(...points[0]);
  geo.computeVertexNormals();
  return mesh(group, geo, surface, [0, 0, 0]);
}

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function label(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, luminous = false) {
  const map = canvasTexture(width, height, draw);
  return luminous ? new T.MeshBasicMaterial({ map, toneMapped: false }) : new T.MeshStandardMaterial({ map, roughness: 0.8 });
}

export function write(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function textLabel(text: string, bg: string, fg: string, w = 512, h = 128, size = 58, luminous = false) {
  return label(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    write(ctx, text, w / 2, h * 0.5 + size * 0.34, size, fg, 700, 'center');
  }, luminous);
}

export function granular(base: [number, number, number], repeats: [number, number], tiled = false, seed = 9233) {
  const rng = random(seed);
  const n = 512;
  const texture = canvasTexture(n, n, (ctx) => {
    const pixels = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const grain = (rng() - 0.5) * (tiled ? 28 : 49);
        const broad = Math.sin(x * 0.036 + y * 0.013) * Math.cos(y * 0.024) * 7 + Math.sin(x * 0.014) * Math.sin(y * 0.013) * 8;
        const tile = tiled ? ((Math.floor(x / 128) * 17 + Math.floor(y / 128) * 23) % 16 - 8) : 0;
        const groove = tiled && (x % 128 < 3 || y % 128 < 3) ? -25 : 0;
        const off = (x + y * n) * 4;
        for (let c = 0; c < 3; c++) pixels.data[off + c] = base[c] + grain + broad + tile + groove;
        pixels.data[off + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    for (let j = 0; j < 3900; j++) {
      const a = rng() * 0.14;
      ctx.fillStyle = rng() > 0.56 ? `rgba(13,13,9,${a})` : `rgba(245,236,217,${a})`;
      ctx.fillRect(rng() * n, rng() * n, 1 + rng() * 3, 1 + rng() * 2);
    }
  });
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(...repeats);
  return texture;
}

export function contactMaterial(opacity = 0.68) {
  const map = canvasTexture(96, 96, (ctx) => {
    const gradient = ctx.createRadialGradient(48, 48, 7, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(23,21,15,0.92)');
    gradient.addColorStop(0.59, 'rgba(23,21,15,0.58)');
    gradient.addColorStop(1, 'rgba(23,21,15,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);
  });
  return new T.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false });
}

export function contact(group: T.Object3D, x: number, y: number, z: number, w: number, l: number, surface: T.Material) {
  return plane(group, [x, y, z], [w, l], surface, 0, -Math.PI / 2);
}

export function batch(group: T.Group) {
  group.updateMatrixWorld(true);
  const rootTransform = group.matrixWorld.clone().invert();
  const buckets = new Map<string, { surface: T.Material; geometries: T.BufferGeometry[]; cast: boolean; receive: boolean }>();
  const sources: T.Mesh[] = [];
  group.traverse((item) => {
    if (!(item instanceof T.Mesh) || Array.isArray(item.material) || item.material.transparent) return;
    const id = `${item.material.id}:${item.castShadow}:${item.receiveShadow}`;
    if (!buckets.has(id)) buckets.set(id, { surface: item.material, geometries: [], cast: item.castShadow, receive: item.receiveShadow });
    let geometry = item.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(rootTransform, item.matrixWorld));
    if (geometry.index) geometry = geometry.toNonIndexed();
    buckets.get(id)!.geometries.push(geometry);
    sources.push(item);
  });
  for (const source of sources) source.removeFromParent();
  for (const data of buckets.values()) {
    const geometry = data.geometries.length === 1 ? data.geometries[0] : mergeGeometries(data.geometries);
    if (!geometry) continue;
    const item = mesh(group, geometry, data.surface, [0, 0, 0], data.cast);
    item.receiveShadow = data.receive;
  }
}

export function disposeScene(scene: T.Object3D) {
  const geos = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  scene.traverse((object) => {
    if (object instanceof T.Mesh) {
      geos.add(object.geometry);
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m);
    }
  });
  for (const m of materials) {
    for (const val of Object.values(m)) if (val instanceof T.Texture) textures.add(val);
    m.dispose();
  }
  for (const g of geos) g.dispose();
  for (const t of textures) t.dispose();
}