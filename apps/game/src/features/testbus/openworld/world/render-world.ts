// A software rasteriser for looking at authored world geometry in Node.
//
// Why this exists: the world files build `three` geometry, and this environment has no browser and
// no GPU, so "I could not check it visually" would be true — and it is also not an excuse. This
// renders the *actual* BufferGeometry a chunk builder produced: real triangles, real depth buffer,
// real near-plane clipping, Lambert shading. It is not three's WebGL pipeline (no PBR, no shadows,
// no textures), so it proves **silhouette, scale, proportion, composition and occlusion**, and it
// proves nothing about materials. That distinction must be stated wherever a frame from here is
// cited.
import * as T from "three";

export interface Look {
  name: string;
  /** Eye position, world space. */
  eye: [number, number, number];
  /** Where the eye is pointed, world space. */
  target: [number, number, number];
  /** Vertical field of view in degrees. */
  fov?: number;
  /** Width in pixels; height follows a 16:9 frame. */
  width?: number;
  note?: string;
}

export interface Tri {
  a: T.Vector3;
  b: T.Vector3;
  c: T.Vector3;
  color: [number, number, number];
  emissive: number;
  /** True for materials drawn on both faces (cloth, canopies): a market is seen from below. */
  doubleSided: boolean;
}

export interface Frame {
  name: string;
  /** RGB bytes, row-major, `width * height * 3` long. A plain array so this stays node-type-free. */
  raw: Uint8Array;
  width: number;
  height: number;
  /** Fraction of pixels the geometry covered, 0..1. A frame near zero is a failed sightline. */
  coverage: number;
  triangles: number;
  note?: string;
}

const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

function colorOf(material: T.Material): [number, number, number] {
  const m = material as T.MeshStandardMaterial;
  const c = m.color;
  if (!c) return [200, 200, 200];
  return [
    Math.round(toSrgb(c.r) * 255),
    Math.round(toSrgb(c.g) * 255),
    Math.round(toSrgb(c.b) * 255),
  ];
}

/** Collects every mesh under `root` into world-space triangles. Instancing and skinning are ignored. */
export function collectTriangles(root: T.Object3D): Tri[] {
  const tris: Tri[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as T.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry as T.BufferGeometry;
    const pos = geom.getAttribute("position");
    if (!pos) return;
    const index = geom.getIndex();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const mat = (materials[0] ?? new T.MeshStandardMaterial()) as T.MeshStandardMaterial;
    const color = colorOf(mat);
    const emissive = mat.emissive && mat.emissiveIntensity ? mat.emissiveIntensity * 0.5 : 0;
    const doubleSided = mat.side === T.DoubleSide || mat.side === T.BackSide;
    // Glass and other see-through surfaces are skipped, not faked as opaque: this renderer has no
    // blending or sort order, and drawing a display case as a solid pale wall is what made the first
    // counter frame unreadable. What is behind the glass is what the eye should see here.
    if (typeof mat.opacity === "number" && mat.opacity < 0.9) return;
    const m = mesh.matrixWorld;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      tris.push({
        a: new T.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(m),
        b: new T.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(m),
        c: new T.Vector3().fromBufferAttribute(pos, ic).applyMatrix4(m),
        color,
        emissive,
        doubleSided,
      });
    }
  });
  return tris;
}

/** Lambert from a high warm sun plus a cool sky fill; enough to read a form. */
function shade(base: [number, number, number], normal: T.Vector3, emissive: number): [number, number, number] {
  const sun = new T.Vector3(0.42, 0.82, -0.38).normalize();
  const sky = new T.Vector3(-0.2, 1, 0.3).normalize();
  const lambert = Math.max(0, normal.dot(sun));
  const fill = Math.max(0, normal.dot(sky)) * 0.35;
  // Exposure is deliberately conservative: a blown-out pavement hides the joints and the grime that
  // make a street read as a street, and this renderer's job is to show form, not to flatter it.
  const gain = Math.min(1.06, 0.30 + lambert * 0.60 + fill * 0.8 + emissive);
  return [
    Math.min(255, base[0] * gain),
    Math.min(255, base[1] * gain * 0.995),
    Math.min(255, base[2] * gain * 0.975),
  ];
}

/** Sutherland–Hodgman against the plane `z = near` in view space. */
function clipNear(poly: T.Vector3[], near: number): T.Vector3[] {
  const out: T.Vector3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = cur.z >= near;
    const prevIn = prev.z >= near;
    if (curIn !== prevIn) {
      const t = (near - prev.z) / (cur.z - prev.z);
      out.push(new T.Vector3().lerpVectors(prev, cur, t).setZ(near));
    }
    if (curIn) out.push(cur);
  }
  return out;
}

export function renderLook(tris: Tri[], look: Look): Frame {
  const width = look.width ?? 1280;
  const height = Math.round((width * 9) / 16);
  const fov = ((look.fov ?? 58) * Math.PI) / 180;
  const f = 1 / Math.tan(fov / 2);
  const aspect = width / height;

  const eye = new T.Vector3(...look.eye);
  const forward = new T.Vector3(...look.target).sub(eye).normalize();
  const right = new T.Vector3().crossVectors(forward, new T.Vector3(0, 1, 0)).normalize();
  const up = new T.Vector3().crossVectors(right, forward).normalize();

  const bg: [number, number, number] = [198, 209, 216]; // an overcast Saigon morning
  const rgb = new Float32Array(width * height * 3);
  const depth = new Float32Array(width * height).fill(Infinity);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = bg[0];
    rgb[i * 3 + 1] = bg[1];
    rgb[i * 3 + 2] = bg[2];
  }

  const NEAR = 0.08;
  const tmp = new T.Vector3();
  const toView = (p: T.Vector3) =>
    new T.Vector3(tmp.copy(p).sub(eye).dot(right), tmp.copy(p).sub(eye).dot(up), tmp.copy(p).sub(eye).dot(forward));

  let pixels = 0;
  const e1 = new T.Vector3();
  const e2 = new T.Vector3();
  const normal = new T.Vector3();
  const toEye = new T.Vector3();

  const project = (v: T.Vector3) => ({
    x: ((v.x / v.z) * f / aspect * 0.5 + 0.5) * width,
    y: (1 - ((v.y / v.z) * f * 0.5 + 0.5)) * height,
    z: v.z,
  });

  const fillTriangle = (va: T.Vector3, vb: T.Vector3, vc: T.Vector3, color: [number, number, number]) => {
    const p0 = project(va);
    const p1 = project(vb);
    const p2 = project(vc);
    const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
    const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
    if (minX > maxX || minY > maxY) return;
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    if (Math.abs(area) < 1e-9) return;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / area;
        const w1 = ((p2.x - px) * (p0.y - py) - (p0.x - px) * (p2.y - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const inv = w0 / p0.z + w1 / p1.z + w2 / p2.z;
        if (inv <= 0) continue;
        const z = 1 / inv;
        const i = y * width + x;
        if (z >= depth[i]) continue;
        // Count a pixel once, no matter how many fragments land on it: coverage must be a fraction
        // of the frame, not a count of overdraw.
        if (depth[i] === Infinity) pixels++;
        depth[i] = z;
        rgb[i * 3] = color[0];
        rgb[i * 3 + 1] = color[1];
        rgb[i * 3 + 2] = color[2];
      }
    }
  };

  for (const tri of tris) {
    e1.subVectors(tri.b, tri.a);
    e2.subVectors(tri.c, tri.a);
    normal.crossVectors(e1, e2);
    if (normal.lengthSq() === 0) continue;
    normal.normalize();
    toEye.subVectors(eye, tri.a).normalize();
    const facing = normal.dot(toEye);
    if (facing < 0) {
      // A single-sided surface seen from behind is not drawn; a double-sided one is drawn with its
      // normal flipped, which is exactly what walking under a fabric canopy requires.
      if (!tri.doubleSided) continue;
      normal.negate();
    }

    const color = shade(tri.color, normal, tri.emissive);
    const poly = clipNear([toView(tri.a), toView(tri.b), toView(tri.c)], NEAR);
    if (poly.length < 3) continue;
    for (let t = 1; t < poly.length - 1; t++) {
      fillTriangle(poly[0], poly[t], poly[t + 1], color);
    }
  }

  const raw = new Uint8Array(width * height * 3);
  for (let i = 0; i < rgb.length; i++) raw[i] = Math.max(0, Math.min(255, rgb[i]));
  return {
    name: look.name,
    raw,
    width,
    height,
    coverage: pixels / (width * height),
    triangles: tris.length,
    note: look.note,
  };
}
