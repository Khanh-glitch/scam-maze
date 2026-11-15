// Property: the pure corner projection equals three.js `Vector3.project` for any camera in front of
// the points, and reports failure (never a number) for points behind the camera.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createLcg } from "../../../test/seededRandom";
import { cornersChanged, projectCornersToViewport, projectPointToViewport } from "./screenProjection";

const CASES = 200;
const BASE_SEED = 0x5c2e3a11;

function randomIn(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

function makeCamera(next: () => number, aspect: number) {
  const camera = new THREE.PerspectiveCamera(randomIn(next, 20, 70), aspect, 0.02, 50);
  camera.position.set(randomIn(next, -3, 3), randomIn(next, 0.2, 2), randomIn(next, -3, 3));
  camera.lookAt(randomIn(next, -3, 3), randomIn(next, 0, 1.5), randomIn(next, -3, 3));
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

describe("screenProjection", () => {
  it("matches THREE.Vector3.project for points in front of the camera", () => {
    for (let index = 0; index < CASES; index += 1) {
      const seed = (BASE_SEED + index) >>> 0;
      const next = createLcg(seed);
      const vw = Math.round(randomIn(next, 800, 2000));
      const vh = Math.round(randomIn(next, 450, 1200));
      const left = Math.round(randomIn(next, 0, 40));
      const top = Math.round(randomIn(next, 0, 40));
      const camera = makeCamera(next, vw / vh);
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const world: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        // A point 0.3 to 3 m ahead, offset sideways a little so it stays in the frustum most of the time.
        const p = camera.position
          .clone()
          .addScaledVector(forward, randomIn(next, 0.3, 3))
          .add(new THREE.Vector3(randomIn(next, -0.1, 0.1), randomIn(next, -0.1, 0.1), randomIn(next, -0.1, 0.1)));
        world.push(p.x, p.y, p.z);
      }
      const out: number[] = [];
      const ok = projectCornersToViewport(viewProjection.elements, world, vw, vh, left, top, out);
      const message = `seed=${seed} viewport=${vw}x${vh}`;
      expect(ok, message).toBe(true);
      for (let i = 0; i < 4; i += 1) {
        const ndc = new THREE.Vector3(world[i * 3], world[i * 3 + 1], world[i * 3 + 2]).project(camera);
        expect(out[i * 2], message).toBeCloseTo(left + ((ndc.x + 1) / 2) * vw, 4);
        expect(out[i * 2 + 1], message).toBeCloseTo(top + ((1 - ndc.y) / 2) * vh, 4);
      }
    }
  });

  it("fails for a point behind the camera and for an empty viewport", () => {
    for (let index = 0; index < CASES; index += 1) {
      const seed = (BASE_SEED + 1000 + index) >>> 0;
      const next = createLcg(seed);
      const camera = makeCamera(next, 16 / 9);
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const behind = camera.position.clone().addScaledVector(forward, -randomIn(next, 0.2, 3));
      const out: number[] = [];
      expect(
        projectPointToViewport(viewProjection.elements, behind.x, behind.y, behind.z, 1280, 720, 0, 0, out, 0),
        `seed=${seed}`,
      ).toBe(false);
      const ahead = camera.position.clone().addScaledVector(forward, 1);
      const corners = [behind.x, behind.y, behind.z, ahead.x, ahead.y, ahead.z, ahead.x, ahead.y, ahead.z, ahead.x, ahead.y, ahead.z];
      expect(projectCornersToViewport(viewProjection.elements, corners, 1280, 720, 0, 0, out), `seed=${seed}`).toBe(false);
      expect(projectCornersToViewport(viewProjection.elements, corners.map(() => 0), 0, 720, 0, 0, out)).toBe(false);
    }
  });

  it("cornersChanged respects the tolerance", () => {
    const a = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(cornersChanged(a, [...a], 0.25)).toBe(false);
    expect(cornersChanged(a, [0.2, 0, 10, 0, 10, 10, 0, 10], 0.25)).toBe(false);
    expect(cornersChanged(a, [0, 0, 10, 0, 10, 10.3, 0, 10], 0.25)).toBe(true);
  });
});
