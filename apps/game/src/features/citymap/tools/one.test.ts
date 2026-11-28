import { it } from "vitest";
import { generateCity } from "../cityGen";
import { extendTrafficGraph } from "../cityTraffic";
import { SaigonTrafficManager } from "../../testbus/openworld/traffic";
it("dbg", () => {
  const city = generateCity(undefined, { realWorld: true });
  const t = new SaigonTrafficManager();
  const ext = extendTrafficGraph(t.graph, city, { near: { x: 0, z: -60 }, radiusM: 900, maxCorridors: 24 });
  let n = 0;
  for (const edgeId of ext.edgeIds) for (let k = 0; k < 2 && n < 36; k++) {
    t.spawnVehicle({ id: `P_${n}`, category: n % 3 === 0 ? "moto" : "car", edgeId, s: 20 + k * 40, halfWidth: 0.92, halfLength: 2.2 });
    n++;
  }
  const step = { dt: 1 / 60, playerX: 9999, playerY: 1.7, playerZ: 9999, playerYaw: 0, wetness: 0.1 };
  for (let i = 0; i < 240; i++) t.step(step);
  for (const v of t.vehicles) {
    const e = t.graph.edges.get(v.edgeId!)!;
    console.log("POS", v.id, v.edgeId, "x", v.x.toFixed(2), "z", v.z.toFixed(2), "lat", v.latOffset.toFixed(2), "laneIdx", v.laneIndex, "v", v.speed.toFixed(1));
  }
});
