import { it } from "vitest";
import { generateCity } from "../cityGen";
it("dbg", () => {
  const city = generateCity(undefined, { realWorld: true });
  const k: Record<string, number> = {};
  for (const p of city.props) k[p.kind] = (k[p.kind] ?? 0) + 1;
  console.log("PROPS", JSON.stringify(k), "total", city.props.length);
  console.log("SAMPLE", JSON.stringify(city.props.slice(0, 4)));
});
