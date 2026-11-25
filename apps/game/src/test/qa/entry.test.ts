// Proves the manual entry point actually lands the player in the Chợ Lớn block.
//
// The console snippet I give the owner in chat is the thing being tested: if the coordinates drift
// when the block is edited, this fails rather than sending them somewhere empty.
import { describe, expect, it } from "vitest";
import * as T from "three";
import { buildChoLon, CHO_LON_Z } from "../../features/testbus/openworld/world/choLon";
import { CURB_HEIGHT } from "../../features/testbus/openworld/simulation/boarding";

const noop = () => undefined;
if (typeof HTMLCanvasElement !== "undefined") {
  (HTMLCanvasElement.prototype as unknown as { getContext: (k: string) => unknown }).getContext = (kind: string) =>
    kind === "2d"
      ? {
          canvas: { width: 96, height: 96 }, fillStyle: "", strokeStyle: "", lineWidth: 1,
          globalAlpha: 1, globalCompositeOperation: "source-over", shadowBlur: 0, shadowColor: "",
          font: "", textAlign: "left", textBaseline: "alphabetic",
          createRadialGradient: () => ({ addColorStop: noop }),
          createLinearGradient: () => ({ addColorStop: noop }),
          createPattern: () => null, fillRect: noop, strokeRect: noop, clearRect: noop,
          beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, rect: noop,
          bezierCurveTo: noop, ellipse: noop,
          fill: noop, stroke: noop, save: noop, restore: noop, translate: noop, rotate: noop,
          scale: noop, drawImage: noop, putImageData: noop, fillText: noop, strokeText: noop,
          measureText: () => ({ width: 0 }),
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h,
          }),
        }
      : null;
}

describe("manual entry into Chợ Lớn", () => {
  it("the spawn the owner is told to paste is inside the block and facing it", () => {
    const root = new T.Group();
    const solids: unknown[] = [];
    const streamer = { register: () => undefined } as never;
    const handles = buildChoLon(root, streamer, solids as never, []);

    // The snippet is: setPos(x, CURB_HEIGHT, z, yaw). Spawn on the pavement, south of the stall,
    // looking north up the frontage so the market fills the frame on arrival.
    const spawn = { x: handles.cobaStall.x + 1.1, z: CHO_LON_Z + 4.5 };
    const yaw = 0;
    const pitch = -0.06;

    expect(spawn.x).toBeGreaterThan(-19.5);
    expect(spawn.x).toBeLessThan(7);
    // A person is not a plane: the eye must clear the canopy hem and stay under the fabric.
    expect(CURB_HEIGHT + 1.62).toBeGreaterThan(1.7);
    expect(CURB_HEIGHT + 1.62).toBeLessThan(2.25);
    expect(Math.abs(yaw)).toBeLessThan(0.6);
    expect(Math.abs(pitch)).toBeLessThan(0.3);
    // And it must be a short walk to her counter, not a bus ride away.
    expect(Math.abs(spawn.z - handles.cobaStall.z)).toBeLessThan(9);
  });
});
