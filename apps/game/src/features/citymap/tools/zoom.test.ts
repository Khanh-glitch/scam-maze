import { describe, it } from "vitest";
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { generateCity } from "../cityGen";
import { buildCityMesh } from "../cityMesh";
import { renderCityTopView } from "./topView";

/** Phóng to vài chỗ có lỗi để nhìn bằng mắt. */
describe("zoom", () => {
  it("xuất các lát cắt", async () => {
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    mkdirSync("docs/product/audit", { recursive: true });
    const shots: Array<[string, { x0: number; z0: number; x1: number; z1: number }, number]> = [
      ["z1", { x0: 250, z0: -60, x1: 380, z1: 40 }, 9],
      ["z2", { x0: -160, z0: -120, x1: -30, z1: -20 }, 9],
      ["z3", { x0: -40, z0: -120, x1: 90, z1: -20 }, 9],
    ];
    for (const [name, region, px] of shots) {
      const v = renderCityTopView(city, mesh, { pxPerM: px, region, highlight: true });
      await sharp(Buffer.from(v.data), { raw: { width: v.width, height: v.height, channels: 4 } })
        .png()
        .toFile(`docs/product/audit/city-${name}.png`);
    }
  });
});
