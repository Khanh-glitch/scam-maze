// Renders the *whole* district around the Chợ Lớn block, not just the block, so that a placement
// mistake cannot hide inside a tidy close-up.
//
// Why this exists: the Chợ Lớn chunk passed every test I had and still shipped a market standing in
// the middle of a roadway, because every frame I rendered was framed on the market. A frame that only
// contains the thing you built can never tell you whether the thing you built is in the right place.
//
// This renders `buildSaigonDistricts` itself — every chunk, both roads, the sidewalks — from high
// above, with the Chợ Lớn block tinted. Frames land in .kiro/qa-output/plan/.
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as T from "three";
import sharp from "sharp";
import { buildSaigonDistricts } from "../../features/testbus/openworld/world/saigonDistricts";
import { CHO_LON_X, CHO_LON_Z } from "../../features/testbus/openworld/world/choLon";
import { collectTriangles, renderLook, type Look } from "./render-world";
import { sampleTexture, type SampledTexture } from "./texture-sampler";
import { textureKey } from "./render-world";

const OUT = "/home/user/scam-maze/.kiro/qa-output/plan";

const noop = () => undefined;
const stub = () =>
  ({
    canvas: { width: 96, height: 96 }, fillStyle: "", strokeStyle: "", lineWidth: 1,
    globalAlpha: 1, globalCompositeOperation: "source-over", shadowBlur: 0, shadowColor: "",
    font: "", textAlign: "left", textBaseline: "alphabetic",
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null, fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, rect: noop,
    roundRect: noop, ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    setLineDash: noop, clip: noop, arcTo: noop, transform: noop, setTransform: noop,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    fill: noop, stroke: noop, save: noop, restore: noop, translate: noop, rotate: noop,
    scale: noop, drawImage: noop, putImageData: noop, fillText: noop, strokeText: noop,
    measureText: () => ({ width: 0 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h,
    }),
  }) as unknown as CanvasRenderingContext2D;

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === "2d" ? stub() : null;
  } as unknown as HTMLCanvasElement["getContext"];
}

describe("the Chợ Lớn block in its district (placement, not decoration)", () => {
  it("renders the whole district from above with the market in context", async () => {
    const scene = new T.Scene();
    const streamer = { register: () => undefined, getZone: () => ({}) } as never;
    const districts = buildSaigonDistricts(scene, streamer, false);
    const root = districts.root;

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
      textures.set(key, await sampleTexture(found));
    }

    // First: the district exactly as it was before this chunk existed. This is the research step the
    // placement needed and skipped — knowing what the space *is* before putting anything in it.
    const market = root.getObjectByName("ChoLonMarket");
    // `traverse` visits hidden nodes, so `visible = false` is not an exclusion. Detach it.
    const pristineTris = (() => {
      if (!market) return null;
      const parent = market.parent;
      market.removeFromParent();
      const t = collectTriangles(root, textures);
      parent?.add(market);
      return t;
    })();

    const tris = collectTriangles(root, textures);
    const looks: Look[] = [
      {
        // Straight down on the district: both boulevards, the corridor, and the market inside it.
        name: "plan-01-district-overhead",
        eye: [-2.0, 120.0, CHO_LON_Z + 34.0],
        target: [-2.0, 0.0, CHO_LON_Z - 6.0],
        fov: 72,
        width: 900,
      },
      {
        // Low oblique from the east, the way a player crosses toward the market.
        name: "plan-02-street-level-approach",
        // Down the street from the south-east, eye height just above a person, so the market frontage
        // and the far terrace both sit in the frame the way a player meets them.
        eye: [4.4, 2.4, CHO_LON_Z + 24.0],
        target: [CHO_LON_X, 1.2, CHO_LON_Z - 4.0],
        fov: 62,
        width: 900,
      },
      {
        // Stand on the service lane behind the market and look north: is the block's back wall
        // cutting through the district's existing riverside frontage at x -17..-15?
        name: "plan-04-behind-the-market",
        eye: [-20.5, 2.2, CHO_LON_Z - 40.0],
        target: [-14.0, 2.0, CHO_LON_Z + 6.0],
        fov: 66,
        width: 900,
      },
      {
        // Bird's eye: the whole block from 60 m up. This is the frame that answers, at a glance,
        // whether anything is standing in the road and whether the new houses touch the old ones.
        name: "plan-06-from-above",
        eye: [-2.0, 62.0, CHO_LON_Z + 26.0],
        target: [-2.0, 0.0, CHO_LON_Z - 10.0],
        fov: 62,
        width: 1100,
      },
      {
        // The terrace the neighbourhood sees: stand on the far pavement across the road and look back
        // at the houses this chunk added. This is the frame that must not show a row of identical
        // grey boxes.
        name: "plan-05-the-added-terrace",
        eye: [-7.4, 1.72, CHO_LON_Z + 22.0],
        target: [6.4, 4.6, CHO_LON_Z - 8.0],
        fov: 72,
        width: 900,
      },
      {
        // Looking straight across the corridor at the market frontage: is anything standing on the road?
        name: "plan-03-cross-the-road",
        // Stand on the far pavement, at the kerb, where a pedestrian waits to cross. x = 10.5 was
        // inside the far terrace this round added; a camera inside a wall reports the wall.
        eye: [5.6, 1.78, CHO_LON_Z],
        target: [CHO_LON_X, 1.5, CHO_LON_Z],
        fov: 64,
        width: 900,
      },
    ];

    mkdirSync(OUT, { recursive: true });
    const report = [`# District placement QA`, `triangles: ${tris.length}`, ""];

    if (pristineTris) {
      const pristineLook: Look = {
        name: "plan-00-what-was-there",
        eye: [-2.0, 120.0, CHO_LON_Z + 34.0],
        target: [-2.0, 0.0, CHO_LON_Z - 6.0],
        fov: 72,
        width: 900,
      };
      const res = renderLook(pristineTris, pristineLook, textures);
      writeFileSync(
        `${OUT}/${pristineLook.name}.png`,
        await sharp(res.raw, { raw: { width: res.width, height: res.height, channels: 3 } }).png().toBuffer(),
      );
      report.push(
        `${pristineLook.name}: coverage ${(res.coverage * 100).toFixed(1)}% (no market), ${pristineTris.length} tris vs ${tris.length} with it`,
      );
    }
    for (const look of looks) {
      const res = renderLook(tris, look, textures);
      writeFileSync(
        `${OUT}/${look.name}.png`,
        await sharp(res.raw, { raw: { width: res.width, height: res.height, channels: 3 } }).png().toBuffer(),
      );
      report.push(`${look.name}: coverage ${(res.coverage * 100).toFixed(1)}%`);
      expect(res.coverage, `${look.name} sees nothing`).toBeGreaterThan(0.15);
    }
    writeFileSync(`${OUT}/report.md`, report.join("\n"));
  }, 300_000);
});
