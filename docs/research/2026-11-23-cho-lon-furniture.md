# Chợ Lớn furniture: what the repository already owns

Written before touching `choLon.ts`, because the last four rounds failed by building
copies of things that already existed.

## The finding

`choLon.ts` contains **91 hand-built primitives and 0 model references**. The market's
stools, tables, parked scooter, bins and crates are all boxes and cylinders. That is
exactly the "nhựa" the user has been pointing at: not the colour, the *construction*.

The repository already ships a complete, working pipeline for real furniture:

| Asset | Triangles | Materials | Textures | Size |
|---|---|---|---|---|
| `bike-pcx` | 19 306 | 5 | 5 | 308 KB |
| `bike-cg125` | 26 781 | 15 | 14 | 630 KB |
| `bike-supercub` | 7 947 | 7 | 5 | 186 KB |
| `bike-bobber` | 8 851 | 2 | 2 | 89 KB |
| `bike-fatboy` | 9 357 | 8 | 12 | 443 KB |
| `stool-low` | 1 654 | 1 | 3 | 73 KB |
| `table-set` | 5 594 | 1 | 2 | 38 KB |

`street-props.optimized.glb` additionally contains `Prop_BanhMi` (a bánh mì cart),
`Prop_BatterySwap` and `Prop_TrashBin`.

## The pipeline (do not rebuild it)

`features/khupho/world/streetFurniture.ts`:

- `loadStreetFurniture()` — loads and *prepares* every model once. Preparation scales
  each model to a real dimension (a PCX to 1.94 m long, a low stool to 0.27 m seat
  height), re-centres it on its own base, raises roughness to ≥ 0.35 so nothing reads as
  mirror plastic in the rain, and records its true footprint.
- `queueWorldProp(kind, x, y, z, yaw, scale)` — records one placement in world space.
  This is the bridge: it needs no `Builder`, no neighbourhood context.
- `placeStreetFurniture(root)` — draws every recorded placement as `InstancedMesh`,
  one draw per material per 24 m chunk, so a market full of stools costs almost nothing.
- `hasProp(kind)` / `propSize(kind)` — so a caller can fall back to procedural geometry
  when a model failed to load, rather than leaving a hole.

`features/khupho/world/furniture.ts` shows the intended call pattern: model first,
procedural fallback second, and **always a collider** sized from `propSize`.

## Consequences for the plan

1. Stools, tables, parked bikes, bins and crates in the market should be **instanced
   models**, not boxes.
2. Nothing may be placed without `propSize`-derived colliders, or the player walks
   through a motorcycle.
3. The procedural fallback stays: if the GLB fails, the market still has furniture.
4. `choLon.ts` must not import `khupho/world/engine` — only `streetFurniture` and
   `furniture`, which are leaf modules.

## What cannot be proved in Node

`GLTFLoader.parseAsync` hangs under jsdom: three's loader needs `fetch`/`Blob` plumbing
that this environment does not provide. **No test in this repository has ever rendered a
GLB.** `streetGltfLoader.test.ts` spies the load call instead. So model *appearance*
must be judged in the browser, and only model *plumbing* can be tested here.
