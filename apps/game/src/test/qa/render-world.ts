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
import { sampleAt, tint, type SampledTexture } from "./texture-sampler";

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
  /** Per-vertex UVs, so a scanned facade is sampled where the GPU would sample it. */
  ua: T.Vector2;
  ub: T.Vector2;
  uc: T.Vector2;
  /** Mean texture colour, premultiplied by material colour. This is what a *textured* triangle shows. */
  color: [number, number, number];
  /**
   * True when `color` came from an actual image. A flat material is a fallback and must be reported
   * as such, because "the wall has a texture" is a claim this tool is allowed to check and must not
   * be allowed to invent.
   */
  textured: boolean;
  emissive: number;
  /** Which decoded image to sample, or "" when this triangle is a flat colour. */
  textureKey: string;
  /** `material.color`, which multiplies the map — needed to reproduce a tinted facade. */
  tint: [number, number, number];
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
  /**
   * Fraction of the *drawn* pixels that were shaded from a decoded image rather than a flat colour.
   * This is the measure the eye actually applies: twelve triangles of facade can fill half the frame,
   * while five thousand triangles of crate fill almost none. Counting triangles gets it backwards.
   */
  texturedPixels: number;
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
export function collectTriangles(root: T.Object3D, textures?: Map<string, SampledTexture | null>): Tri[] {
  const tris: Tri[] = [];
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as T.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry as T.BufferGeometry;
    const pos = geom.getAttribute("position");
    if (!pos) return;
    const uv = geom.getAttribute("uv");
    const index = geom.getIndex();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const mat = (materials[0] ?? new T.MeshStandardMaterial()) as T.MeshStandardMaterial;
    const color = colorOf(mat);
    // Preserve the recesses: a dark interior with a warm lamp is still lit, and this term is the only
    // light those surfaces get in a renderer with no shadowed ambient occlusion.
    const emissive = mat.emissive && mat.emissiveIntensity
      ? Math.min(0.55, mat.emissiveIntensity * (0.55 + (mat.emissive.r + mat.emissive.g + mat.emissive.b) / 3))
      : 0;
    const doubleSided = mat.side === T.DoubleSide || mat.side === T.BackSide;
    // Glass and other see-through surfaces are skipped, not faked as opaque: this renderer has no
    // blending or sort order, and drawing a display case as a solid pale wall is what made the first
    // counter frame unreadable. What is behind the glass is what the eye should see here.
    if (typeof mat.opacity === "number" && mat.opacity < 0.9) return;

    // A material is only "textured" if a real image was actually decoded for it. Anything else is a
    // flat colour and gets counted as one, so the report cannot flatter the build.
    const tex = textures?.get(textureKey(mat)) ?? null;
    const textured = !!tex;
    const base: [number, number, number] = tex
      ? [tex.mean[0] * (color[0] / 255), tex.mean[1] * (color[1] / 255), tex.mean[2] * (color[2] / 255)]
      : color;

    const m = mesh.matrixWorld;
    const count = index ? index.count : pos.count;
    const readUv = (i: number): T.Vector2 =>
      uv ? new T.Vector2().fromBufferAttribute(uv as T.BufferAttribute, i) : new T.Vector2(0.5, 0.5);
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      tris.push({
        a: new T.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(m),
        b: new T.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(m),
        c: new T.Vector3().fromBufferAttribute(pos, ic).applyMatrix4(m),
        ua: readUv(ia),
        ub: readUv(ib),
        uc: readUv(ic),
        color: base,
        textured,
        textureKey: textured ? textureKey(mat) : "",
        tint: color,
        emissive,
        doubleSided,
      });
    }
  });
  return tris;
}

/** Stable id for "which image does this material draw", so the decoder runs once per image. */
export function textureKey(mat: T.Material): string {
  const t = (mat as T.MeshStandardMaterial).map;
  const img = t?.image as { src?: string; currentSrc?: string } | string | undefined;
  if (typeof img === "string") return img;
  if (img?.currentSrc || img?.src) return img.currentSrc ?? img.src ?? "";
  // three's loader leaves `image` null until an async decode lands, which never happens in Node.
  // `loadPhotoTex` records the file it requested so the material stays auditable without a DOM.
  return (t?.userData?.src as string | undefined) ?? "";
}

/** Lambert from a high warm sun plus a cool sky fill; enough to read a form. */
function shade(base: [number, number, number], normal: T.Vector3, emissive: number): [number, number, number] {
  const sun = new T.Vector3(0.42, 0.82, -0.38).normalize();
  const sky = new T.Vector3(-0.2, 1, 0.3).normalize();
  const lambert = Math.max(0, normal.dot(sun));
  const fill = Math.max(0, normal.dot(sky)) * 0.35;
  // Exposure is deliberately conservative: a blown-out pavement hides the joints and the grime that
  // make a street read as a street, and this renderer's job is to show form, not to flatter it.
  // `emissive` arrives as emissiveIntensity already scaled by the collector. It is added as an
  // *ambient* term, not a highlight, and floored so an unlit interior is dark rather than black:
  // a hole with no information in it is a rendering failure, not a shadow.
  const gain = Math.min(1.14, 0.34 + lambert * 0.56 + fill * 0.8 + emissive);
  return [
    Math.min(255, base[0] * gain),
    Math.min(255, base[1] * gain * 0.995),
    Math.min(255, base[2] * gain * 0.975),
  ];
}

interface Vtx {
  p: T.Vector3;
  uv: T.Vector2;
  /** 1/z, interpolated linearly in screen space. Carried through the clip so the cut is correct. */
  w: number;
}

/**
 * Sutherland–Hodgman against the plane `z = near` in view space, carrying UV and 1/z with the
 * geometry. Clipping the positions alone is what makes a long wall sample a different part of its
 * image the moment the camera gets close to it.
 */
function clipNear(poly: Vtx[], near: number): Vtx[] {
  const out: Vtx[] = [];
  const lerpVtx = (a: Vtx, b: Vtx, t: number): Vtx => ({
    p: new T.Vector3().lerpVectors(a.p, b.p, t).setZ(near),
    uv: new T.Vector2().lerpVectors(a.uv, b.uv, t),
    w: a.w + (b.w - a.w) * t,
  });
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = cur.p.z >= near;
    const prevIn = prev.p.z >= near;
    if (curIn !== prevIn) {
      const t = (near - prev.p.z) / (cur.p.z - prev.p.z);
      out.push(lerpVtx(prev, cur, t));
    }
    if (curIn) out.push(cur);
  }
  return out;
}

export function renderLook(
  tris: Tri[],
  look: Look,
  textures?: Map<string, SampledTexture | null>,
): Frame {
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

  // Per-pixel record of which fragment survived, so coverage and texture share are counted once.
  const survivorDepth = new Float32Array(width * height).fill(Infinity);
  const survivorIsTextured = new Uint8Array(width * height);
  let triEmissive = 0;
  let pixels = 0;
  let texturedHits = 0;
  const e1 = new T.Vector3();
  const e2 = new T.Vector3();
  const normal = new T.Vector3();
  const toEye = new T.Vector3();

  const project = (v: T.Vector3) => ({
    x: ((v.x / v.z) * f / aspect * 0.5 + 0.5) * width,
    y: (1 - ((v.y / v.z) * f * 0.5 + 0.5)) * height,
    z: v.z,
  });

  const fillTriangle = (
    va: T.Vector3, vb: T.Vector3, vc: T.Vector3,
    qa: T.Vector2, qb: T.Vector2, qc: T.Vector2,
    color: [number, number, number], tex: SampledTexture | null, tintCol: [number, number, number] | null,
  ) => {
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
        // Coverage and texture share must both count a pixel exactly once, at the depth that
        // actually survived. Counting fragments makes both fractions exceed 100%, which is how the
        // first version of this renderer reported "144% coverage" and went unnoticed.
        if (z < survivorDepth[i]) {
          survivorDepth[i] = z;
          survivorIsTextured[i] = tex ? 1 : 0;
        }
        depth[i] = z;
        if (tex) {
          // Perspective-correct UV: interpolate u/z and v/z, then divide by the interpolated 1/z.
          const u = (w0 * qa.x / p0.z + w1 * qb.x / p1.z + w2 * qc.x / p2.z) * z;
          const v = (w0 * qa.y / p0.z + w1 * qb.y / p1.z + w2 * qc.y / p2.z) * z;
          const sampled = sampleAt(tex, u, v);
          const lit = shade(tint(sampled, tintCol ?? [255, 255, 255]), normal, triEmissive);
          rgb[i * 3] = lit[0];
          rgb[i * 3 + 1] = lit[1];
          rgb[i * 3 + 2] = lit[2];
        } else {
          rgb[i * 3] = color[0];
          rgb[i * 3 + 1] = color[1];
          rgb[i * 3 + 2] = color[2];
        }
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

    triEmissive = tri.emissive;
    const color = shade(tri.color, normal, tri.emissive);
    const tex = tri.textured ? textures?.get(tri.textureKey ?? "") ?? null : null;
    const tintCol = tri.tint;

    const a = toView(tri.a);
    const b = toView(tri.b);
    const c = toView(tri.c);
    const poly = clipNear(
      [
        { p: a, uv: tri.ua, w: 1 / a.z },
        { p: b, uv: tri.ub, w: 1 / b.z },
        { p: c, uv: tri.uc, w: 1 / c.z },
      ],
      NEAR,
    );
    if (poly.length < 3) continue;
    for (let t = 1; t < poly.length - 1; t++) {
      fillTriangle(poly[0].p, poly[t].p, poly[t + 1].p, poly[0].uv, poly[t].uv, poly[t + 1].uv, color, tex, tintCol);
    }
  }

  for (let i = 0; i < width * height; i++) {
    if (depth[i] !== Infinity) {
      pixels++;
      if (survivorIsTextured[i]) texturedHits++;
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
    texturedPixels: pixels > 0 ? texturedHits / pixels : 0,
    triangles: tris.length,
    note: look.note,
  };
}
