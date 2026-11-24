// Decodes the image behind a material's `map` so the QA rasteriser can draw what a surface *looks
// like*, not only what shape it is.
//
// This module lives under `src/test/` on purpose. It needs `node:fs`, `node:path` and `sharp`, and
// `tsconfig.app.json` excludes `src/**/*.test.ts` and `src/test` — so the game bundle can never
// import it by accident. That is also the honest boundary: the running game gets its textures from
// three's async loader on the GPU, and nothing here changes that.
//
// What a textured frame from this tool proves: the material is bound to a real image, the image is
// the one that ships in `public/`, and its colours land on the surface at the right scale via the
// real interpolated UVs. What it does NOT prove: mipmapping, anisotropy, sRGB decode, normal maps,
// or the `injectTropicalWeathering` shader patch. Those are GPU work and this box has no GPU. Frames
// must be described with that limit attached.
import * as fs from "node:fs";
import * as path from "node:path";
import * as T from "three";
import sharp from "sharp";

/** A decoded texture, small enough to sample per pixel. */
export interface SampledTexture {
  width: number;
  height: number;
  /** RGB bytes, row-major, `width * height * 3` long. */
  data: Uint8Array;
  /** Repo-relative path, so a report can name the file that was actually drawn. */
  source: string;
  /** Mean colour, used for distant surfaces and to describe a material in the report. */
  mean: [number, number, number];
}

const cache = new Map<string, SampledTexture | null>();

/**
 * Where `three` would have found this texture on disk.
 *
 * `Texture.image` is null until an async image decode completes, which never happens in Node — so for
 * materials built by `loadPhotoTex` the authoritative source is `texture.userData.src`, recorded at
 * request time. Falling back to `image.src` covers textures created another way.
 */
function resolveTexturePath(texture: T.Texture): string | null {
  const publicDir = path.resolve(process.cwd(), "public");
  const image = texture.image as { src?: string; currentSrc?: string } | string | null | undefined;
  let url: string | null = null;

  if (typeof image === "string") url = image;
  else if (image && typeof image === "object") url = image.currentSrc ?? image.src ?? null;
  if (!url) url = (texture.userData?.src as string | undefined) ?? null;
  if (!url) return null;

  // Loader paths are site-absolute: "/assets/testbus/ow/images/q1/...".
  const rel = url.startsWith("/") ? url.slice(1) : url;
  const candidate = path.resolve(publicDir, rel);
  if (!candidate.startsWith(publicDir)) return null;
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Decode the image behind `texture` into a small RGB grid.
 *
 * Returns null when there is no image, the file is absent, or it cannot be decoded — facts the
 * caller must record rather than paper over.
 */
export async function sampleTexture(texture: T.Texture | null | undefined): Promise<SampledTexture | null> {
  if (!texture) return null;
  const file = resolveTexturePath(texture);
  if (!file) return null;

  const cached = cache.get(file);
  if (cached !== undefined) return cached;

  try {
    // 128 px carries a facade's colour rhythm at these frame sizes and keeps a full 8-look run to a
    // fraction of a second across every distinct material.
    const { data, info } = await sharp(file)
      .resize(128, 128, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const channels = info.channels;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      rgb[i * 3] = data[i * channels];
      rgb[i * 3 + 1] = data[i * channels + 1];
      rgb[i * 3 + 2] = data[i * channels + 2];
    }
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < w * h; i++) {
      r += rgb[i * 3];
      g += rgb[i * 3 + 1];
      b += rgb[i * 3 + 2];
    }
    const n = w * h;
    const tex: SampledTexture = {
      width: w,
      height: h,
      data: rgb,
      source: path.relative(process.cwd(), file),
      mean: [r / n, g / n, b / n],
    };
    cache.set(file, tex);
    return tex;
  } catch {
    cache.set(file, null);
    return null;
  }
}

/** Nearest sample with wrapping — `loadPhotoTex` sets `RepeatWrapping` on every one of these. */
export function sampleAt(tex: SampledTexture, u: number, v: number): [number, number, number] {
  const x = Math.floor((((u % 1) + 1) % 1) * tex.width);
  const y = Math.floor((1 - (((v % 1) + 1) % 1)) * tex.height);
  const xi = Math.min(tex.width - 1, Math.max(0, x));
  const yi = Math.min(tex.height - 1, Math.max(0, y));
  const i = (yi * tex.width + xi) * 3;
  return [tex.data[i], tex.data[i + 1], tex.data[i + 2]];
}

/** `MeshStandardMaterial.color` multiplies its map; keep parity so a tinted facade reads correctly. */
export function tint(
  sample: [number, number, number],
  materialColor: [number, number, number],
): [number, number, number] {
  return [
    (sample[0] * materialColor[0]) / 255,
    (sample[1] * materialColor[1]) / 255,
    (sample[2] * materialColor[2]) / 255,
  ];
}

/** Clears the cache between runs so an edited image is not served from memory. */
export function resetTextureCache() {
  cache.clear();
}
