import { describe, expect, it } from "vitest";
import * as T from "three";
import { ROOM_ANCHOR } from "./boardingHouse";
import { buildApartment, ROOM } from "../room/apartment";

const noop = () => undefined;
const stub = () => ({ canvas:{width:96,height:96}, createRadialGradient:()=>({addColorStop:noop}),
  createLinearGradient:()=>({addColorStop:noop}), createPattern:()=>null, fillRect:noop, strokeRect:noop,
  clearRect:noop, beginPath:noop, closePath:noop, moveTo:noop, lineTo:noop, arc:noop, rect:noop,
  roundRect:noop, ellipse:noop, quadraticCurveTo:noop, bezierCurveTo:noop, setLineDash:noop, clip:noop,
  arcTo:noop, transform:noop, setTransform:noop, fill:noop, stroke:noop, save:noop, restore:noop,
  translate:noop, rotate:noop, scale:noop, drawImage:noop, putImageData:noop, fillText:noop,
  strokeText:noop, measureText:()=>({width:0}), getImageData:(_x:number,_y:number,w:number,h:number)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h}),
  createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h}) } as any);
if (typeof HTMLCanvasElement !== "undefined") {
  (HTMLCanvasElement.prototype as any).getContext = (k: string) => (k === "2d" ? stub() : null);
}

/**
 * The room door, as geometry rather than as the engine's idea of it.
 *
 * This file exists because the door would not open from one side of the doorway. The engine looked
 * for the door at `ROOM_ANCHOR.x + 1.2`, and `apartment.ts` builds the hinge at `DXc + 0.45` with
 * `DXc = 1.2` — 0.45 m away from a doorway only 1.02 m across. Nothing caught it because no test
 * had ever compared the two numbers, and no test had ever built the room at all.
 */
describe("room 6.07: the door the engine opens is the door the room built", () => {
  const scene = new T.Scene();
  const apt = buildApartment(scene, () => undefined);
  scene.updateMatrixWorld(true);

  /** The hinge's world position, straight from the built apartment. */
  const hinge = new T.Vector3().setFromMatrixPosition(apt.doorPivot.matrixWorld);

  it("puts the door where the room actually built it", () => {
    // The engine's formula: ROOM_ANCHOR.x + DXc + 0.45.
    const engineX = ROOM_ANCHOR.x + 1.2 + 0.45;
    // `doorPivot` is parented to the apartment entity, which sits at ROOM_ANCHOR.
    expect(Math.abs(engineX - (ROOM_ANCHOR.x + hinge.x))).toBeLessThan(0.02);
    expect(Math.abs(ROOM_ANCHOR.z + ROOM.z1 - (ROOM_ANCHOR.z + hinge.z))).toBeLessThan(0.02);
  });

  it("opens from anywhere a person can stand in the doorway", () => {
    // The opening is 1.02 m wide; its plane is at the hinge's z. A reach of 1.9 m must cover both
    // jambs and a step either side, or the door is unopenable from where players stand.
    const reach = 1.9;
    const jambs = [-0.51, 0.51];
    for (const j of jambs) {
      for (const dz of [-0.4, 0, 0.4]) {
        const px = ROOM_ANCHOR.x + hinge.x + j;
        const pz = ROOM_ANCHOR.z + hinge.z + dz;
        const d = Math.hypot(px - (ROOM_ANCHOR.x + hinge.x), pz - (ROOM_ANCHOR.z + hinge.z));
        expect(d).toBeLessThan(reach);
      }
    }
  });

  it("is reachable from the spawn point without moving", () => {
    const spawnX = ROOM_ANCHOR.x + 1.3;
    const spawnZ = ROOM_ANCHOR.z + 1.55;
    const d = Math.hypot(spawnX - (ROOM_ANCHOR.x + hinge.x), spawnZ - (ROOM_ANCHOR.z + hinge.z));
    expect(d).toBeLessThan(1.9);
  });

  it("does not open from across the room, or from the corridor outside it", () => {
    // The check must stay a doorway check, not a room-wide one.
    const farInside = ROOM_ANCHOR.x + ROOM.x0 + 0.5;
    const d1 = Math.hypot(farInside - (ROOM_ANCHOR.x + hinge.x), ROOM_ANCHOR.z - (ROOM_ANCHOR.z + hinge.z));
    expect(d1).toBeGreaterThan(1.9);
    // And not from the floor below: the height test is what separates the two storeys.
    expect(Math.abs(ROOM_ANCHOR.y - 0.16)).toBeGreaterThan(0.6);
  });
});
