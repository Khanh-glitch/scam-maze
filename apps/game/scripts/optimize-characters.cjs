/**
 * SCAMMAZE character optimization (people in the /khupho neighborhood and the prologue).
 *
 * Input:  apps/game/assets-src/characters/<id>/<file>.glb (never modified)
 * Output: apps/game/public/assets/3d/optimized/characters/<id>.optimized.glb
 *
 * Every character keeps its skeleton, skin and animation clips. Per character:
 * 1. Textures: longest side at most `colorSize` (base color) or `dataSize` (normal, ORM), WebP
 *    (quality 88 color, 92 data), `EXT_texture_webp` required.
 * 2. Optional decimation (`ratio` < 1) with the Meshopt simplifier and an error cap, for dense scans.
 * 3. prune, dedup, weld, resample (drops redundant keyframes), quantize, reorder, meshopt.
 *
 * To add a character: put its .glb in assets-src/characters/<id>/, add an entry to CHARACTERS
 * below, run this script, then register it in src/features/khupho/world/humans.ts.
 *
 * Run from the workspace root: node apps/game/scripts/optimize-characters.cjs [id ...]
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, weld, resample, quantize, reorder, meshopt, simplify } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require("meshoptimizer");
const sharp = require("sharp");

const SRC = path.resolve(__dirname, "../assets-src/characters");
const OUT = path.resolve(__dirname, "../public/assets/3d/optimized/characters");
/** Per-file size gate. */
const MAX_OUTPUT_BYTES = 5_242_880;

/**
 * `colorSize`: the banh mi vendor is seen at arm's length when the story starts, so she keeps
 * 2048 px color; people walking past use 1024 px.
 */
const CHARACTERS = [
  { id: "banhmi-vendor", file: "banhmi-vendor/banhmi_vendor_animated.glb", colorSize: 2048, dataSize: 1024, ratio: 0.5, error: 0.0015 },
  { id: "manvn", file: "manvn/manVN_rigged_animated.glb", colorSize: 1024, dataSize: 1024, ratio: 1 },
  { id: "juno3", file: "juno3/juno3.glb", colorSize: 1024, dataSize: 1024, ratio: 0.6, error: 0.001 },
  { id: "rowan", file: "rowan/rowan.glb", colorSize: 1024, dataSize: 1024, ratio: 0.6, error: 0.001 },
];

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const triangles = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);

async function optimize(io, c) {
  const input = path.join(SRC, c.file);
  if (!fs.existsSync(input)) throw new Error(`Input not found: ${input}`);
  const output = path.join(OUT, `${c.id}.optimized.glb`);
  const doc = await io.read(input);
  const root = doc.getRoot();
  const before = triangles(doc);

  doc.createExtension(EXTTextureWebP).setRequired(true);
  const colorTextures = new Set(root.listMaterials().map((m) => m.getBaseColorTexture()).filter(Boolean));
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const isColor = colorTextures.has(texture);
    const size = isColor ? c.colorSize : c.dataSize;
    const webp = await sharp(image).resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).webp({ quality: isColor ? 88 : 92, effort: 4 }).toBuffer();
    texture.setImage(webp).setMimeType("image/webp");
    if (texture.getURI()) texture.setURI(texture.getURI().replace(/\.[a-z]+$/i, ".webp"));
  }

  const steps = [prune(), dedup(), weld({ tolerance: 0.0001 })];
  if (c.ratio < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: c.ratio, error: c.error ?? 0.001 }));
  steps.push(resample(), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await doc.transform(...steps);

  await io.write(output, doc);
  const bytes = fs.statSync(output).size;
  const clips = root.listAnimations().map((a) => a.getName()).join(", ");
  console.log(`${c.id}: ${mb(fs.statSync(input).size)} -> ${mb(bytes)} | triangles ${before.toLocaleString("en-US")} -> ${triangles(doc).toLocaleString("en-US")} | skins ${root.listSkins().length} | clips: ${clips}`);
  if (root.listSkins().length === 0) throw new Error(`${c.id}: the skin was lost`);
  if (bytes > MAX_OUTPUT_BYTES) throw new Error(`${c.id}: ${bytes} bytes is above the ${MAX_OUTPUT_BYTES} byte limit`);
}

async function main() {
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  fs.mkdirSync(OUT, { recursive: true });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
  const only = process.argv.slice(2);
  const list = only.length ? CHARACTERS.filter((c) => only.includes(c.id)) : CHARACTERS;
  if (!list.length) throw new Error(`Unknown id. Known: ${CHARACTERS.map((c) => c.id).join(", ")}`);
  console.log("=== SCAMMAZE CHARACTER OPTIMIZER ===");
  for (const c of list) await optimize(io, c);
}

main().catch((err) => {
  console.error("Optimization failed:", err.message || err);
  process.exit(1);
});
