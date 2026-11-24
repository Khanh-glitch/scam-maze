// Visual QA for the Chợ Lớn block: renders the shipped geometry to PNG so it can be looked at.
//
// This is a vitest test because vitest is the only TypeScript runner in this repo that resolves the
// extensionless imports the world files use, and because a visual check should fail the build when
// it sees nothing. It renders through `render-world.ts` (a CPU rasteriser), not through WebGL: it
// proves silhouette, scale, proportion, composition and occlusion; it proves nothing about PBR,
// shadows or textures, and must never be cited as "visually verified" in the game sense.
//
// Frames land in ../../../../../../../.kiro/qa-output/choLon/ (git-ignored).
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as T from "three";
import sharp from "sharp";
import { buildChoLon, CHO_LON_Z } from "./choLon";
import { collectTriangles, renderLook, textureKey, type Look } from "../../../../test/qa/render-world";
import { sampleTexture, type SampledTexture } from "../../../../test/qa/texture-sampler";

const OUT = "/home/user/scam-maze/.kiro/qa-output/choLon";

// jsdom gives an <canvas> with no 2D context, and `scene-kit` draws textures with one (a radial
// gradient for the contact shadow). The block under test builds no textures of its own; it only
// borrows that shadow decal. Stubbing the context here keeps the production path untouched and
// keeps this suite about geometry.
const noop = () => undefined;
const stubContext = () =>
  ({
    canvas: { width: 96, height: 96 },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    drawImage: noop,
    putImageData: noop,
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
      width: w,
      height: h,
    }),
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 0 }),
  }) as unknown as CanvasRenderingContext2D;

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === "2d" ? stubContext() : null;
  } as unknown as HTMLCanvasElement["getContext"];
}

function textureByKey(root: T.Object3D, key: string): T.Texture | undefined {
  let found: T.Texture | undefined;
  root.traverse((obj) => {
    const mesh = obj as T.Mesh;
    if (found || !mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (textureKey(m) === key) {
        found = (m as T.MeshStandardMaterial).map ?? undefined;
        return;
      }
    }
  });
  return found;
}

describe("Chợ Lớn is a place, not a label (R16)", () => {
  it("builds the block, registers the chunk, and stands on the corridor the bus arrives at", () => {
    const root = new T.Group();
    const registered: string[] = [];
    const streamer = { register: (c: { id: string }) => registered.push(c.id) };
    const solids: Parameters<typeof buildChoLon>[2] = [];
    const lights: Parameters<typeof buildChoLon>[3] = [];

    const handles = buildChoLon(
      root,
      streamer as unknown as Parameters<typeof buildChoLon>[1],
      solids,
      lights,
    );

    expect(registered).toContain("cho-lon-market");
    // The block must actually contain geometry, not just exist as a group.
    const tris = collectTriangles(root);
    expect(tris.length).toBeGreaterThan(2000);

    // Cô Ba's stall stands on the walkable corridor (isWithinOpenWorld: x ∈ [-19.5, 7]).
    expect(handles.cobaStall.x).toBeGreaterThan(-19.5);
    expect(handles.cobaStall.x).toBeLessThan(7);
    expect(handles.cobaStall.z).toBeGreaterThan(-146);
    expect(handles.cobaStall.z).toBeLessThan(-114);
    // Her stall is inside the block's z span and near the bus, and it is a *point*, not a prompt.
    expect(Math.abs(handles.cobaStall.z - CHO_LON_Z)).toBeLessThan(16);

    // Two shelters, one at each end of the route (A4/A5).
    expect(handles.busStops).toHaveLength(2);
    const choLonStop = handles.busStops[0];
    const lyThaiToStop = handles.busStops[1];
    expect(Math.abs(choLonStop.z - CHO_LON_Z)).toBeLessThan(8);
    expect(Math.abs(lyThaiToStop.z)).toBeLessThan(12);
    // The nail must be reachable: on the market side of the pavement, at chest-to-shoulder height.
    expect(handles.receiptNail.x).toBeGreaterThan(-19.5);
    expect(handles.receiptNail.x).toBeLessThan(7);
    expect(handles.receiptNail.y).toBeGreaterThan(1.2);
    expect(handles.receiptNail.y).toBeLessThan(2.0);

    // The block must be solid where it is a wall, or the player walks through the market.
    expect(solids.length).toBeGreaterThanOrEqual(18);
    // Every solid must actually have area, or the player walks through a degenerate rect.
    for (const s of solids) {
      expect(s.x1 - s.x0).toBeGreaterThan(0.05);
      expect(s.z1 - s.z0).toBeGreaterThan(0.05);
    }
    // And it must light its own alley and shelters.
    expect(lights.length).toBeGreaterThanOrEqual(2);
    for (const l of lights) {
      expect(l.distance).toBeGreaterThan(0);
      expect(l.intensity).toBeGreaterThan(0);
    }
  });

  it("renders the mission's own sightlines to PNG (visual QA, not a WebGL claim)", async () => {
    const root = new T.Group();
    const streamer = { register: () => undefined };
    const solids: Parameters<typeof buildChoLon>[2] = [];
    const lights: Parameters<typeof buildChoLon>[3] = [];
    const handles = buildChoLon(
      root,
      streamer as unknown as Parameters<typeof buildChoLon>[1],
      solids,
      lights,
    );

    const looks: Look[] = [
      {
        name: "01-step-off-the-bus",
        eye: [2.6, 1.62, CHO_LON_Z + 3.0],
        target: [-6.0, 1.45, CHO_LON_Z - 8.0],
        fov: 68,
        width: 640,
      },
      {
        name: "02-approach-the-stalls",
        eye: [-2.0, 1.62, CHO_LON_Z + 2.0],
        target: [-8.4, 1.5, CHO_LON_Z - 5.0],
        fov: 68,
        width: 640,
      },
      {
        // The player's own eye-line at Cô Ba's counter: standing on the pavement, looking slightly
        // down and left into the display case and the receipt string above it. This is the frame the
        // mission's key prop has to survive, so it is framed like a shot, not like a survey.
        name: "03-coba-counter",
        // Standing square to the counter, 2.2 m back on the pavement: the distance a person stops at
        // when they are about to speak to the vendor. The earlier frame stood almost against the
        // display case, so the shutter and the case filled the shot and the receipt string — the one
        // prop this mission is built on — was behind the camera's own shoulder.
        eye: [handles.cobaStall.x + 1.05, 1.62, handles.cobaStall.z + 2.2],
        target: [handles.cobaStall.x - 2.3, 1.2, handles.cobaStall.z - 0.15],
        fov: 58,
        width: 640,
      },
      {
        name: "04-inside-the-canopy",
        eye: [-4.2, 1.68, CHO_LON_Z + 6.0],
        target: [-8.4, 1.55, CHO_LON_Z - 9.0],
        fov: 70,
        width: 640,
      },
      {
        name: "05-the-alley",
        eye: [-2.0, 1.62, -129.4],
        target: [-13.0, 1.5, -132.0],
        fov: 62,
        width: 640,
      },
      {
        name: "06-shelter-and-atm",
        eye: [1.5, 1.62, CHO_LON_Z + 10.0],
        target: [-4.2, 1.5, CHO_LON_Z + 0.5],
        fov: 66,
        width: 640,
      },
      {
        name: "07-wide-from-the-road",
        eye: [5.0, 3.0, CHO_LON_Z + 4.0],
        target: [-8.4, 2.2, CHO_LON_Z - 10.0],
        fov: 62,
        width: 640,
      },
      {
        // W6: the inspect frame. The mission's proof object is eleven bills on a nail, and a player
        // who leans in is the only one who ever sees them. If this frame cannot be read, the prop
        // does not exist no matter how correct the geometry is.
        name: "09-inspect-the-receipts",
        eye: [handles.receiptNail.x + 0.62, 1.63, handles.receiptNail.z + 0.5],
        target: [handles.receiptNail.x, handles.receiptNail.y - 0.05, handles.receiptNail.z],
        fov: 42,
        width: 640,
      },
      {
        name: "08-plan-from-above",
        eye: [1.0, 15.0, CHO_LON_Z + 2.0],
        target: [-8.4, 0.0, CHO_LON_Z - 9.0],
        fov: 66,
        width: 640,
      },
    ];

    mkdirSync(OUT, { recursive: true });

    // Decode every image this chunk actually binds, so the frames show surfaces rather than blocks.
    // A material whose image cannot be decoded stays a flat colour AND lowers `texturedShare`, which
    // the report prints and the test asserts — the tool is not allowed to claim a texture it did not
    // draw.
    const textures = new Map<string, SampledTexture | null>();
    root.traverse((obj) => {
      const mesh = obj as T.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const key = textureKey(m);
        if (key && !textures.has(key)) textures.set(key, null);
      }
    });
    for (const key of [...textures.keys()]) {
      textures.set(key, await sampleTexture(textureByKey(root, key)));
    }

    const tris = collectTriangles(root, textures);
    const texturedTris = tris.filter((tri) => tri.textured).length;
    const texturedShare = tris.length ? texturedTris / tris.length : 0;
    const imageSources = [...textures.entries()]
      .filter(([, v]) => v)
      .map(([, v]) => `  - ${(v as SampledTexture).source} (${(v as SampledTexture).width}px)`);
    const report: string[] = [
      `# Chợ Lớn — CPU-rasterised visual QA`,
      ``,
      `triangles: ${tris.length}`,
      `triangles on a decoded image: ${texturedTris} (${(texturedShare * 100).toFixed(1)}%)`,
      `distinct images decoded: ${imageSources.length}`,
      ...imageSources,
      ``,
      `Not proved here: mipmapping, anisotropy, sRGB decode, normal maps, shadowing, the`,
      `tropical-weathering shader. This box has no GPU.`,
      ``,
    ];

    for (const look of looks) {
      const res = renderLook(tris, look, textures);
      const png = await sharp(res.raw, {
        raw: { width: res.width, height: res.height, channels: 3 },
      })
        .png()
        .toBuffer();
      writeFileSync(`${OUT}/${look.name}.png`, png);
      report.push(
        `${look.name}: coverage ${(res.coverage * 100).toFixed(1)}%, textured ${(res.texturedPixels * 100).toFixed(1)}% of drawn pixels`,
      );
      // A sightline that sees nothing is a failed sightline, not a subtle one.
      expect(res.coverage, `${look.name} sees nothing`).toBeGreaterThan(0.2);
    }
    // The whole point of this round: the surfaces the eye spends its time on must be built from real
    // scanned material, not flat colour. Measured in *drawn pixels*, not triangles — twelve facade
    // triangles fill half a frame and five thousand crate triangles fill none, so a triangle count
    // reports the opposite of what a player sees.
    //
    // The bar is per-sightline and low on purpose. The market is genuinely full of small flat-coloured
    // objects (stools, crates, produce, cabling) and they should stay flat: they are 20 cm props, not
    // architecture, and texturing them is where a scene starts to look like a texture demo. What must
    // not happen is the *ground and the walls* being flat, which is what the first version got wrong.
    for (const line of report.filter((r) => r.includes("coverage"))) {
      const pct = Number(/textured ([\d.]+)%/.exec(line)?.[1] ?? 0);
      expect(pct, `a sightline is almost entirely flat colour: ${line}`).toBeGreaterThan(15);
    }
    expect(texturedShare, "no material in the block binds a real image").toBeGreaterThan(0);
    writeFileSync(`${OUT}/report.md`, report.join("\n"));
  });
});
