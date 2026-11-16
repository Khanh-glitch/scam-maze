# Reckless scooter rider ("Bao Thu")
| File | Origin | License |
|---|---|---|
| `baothu_dream_animated.glb` | Owner-supplied: a photogrammetry Honda Dream with rider, auto-rigged by the owner's tool (same rig as `../bike-rider/`) | Not provided. Confirm before a public release. |
- Source: 1 skinned mesh, 130,000 triangles, 4 joints (Chassis, FrontWheel, RearWheel, Head; rear wheel
  pivot at z = -0.29, front wheel at z = 0.386), 7 clips (LookAround, DriveStraight, Wheelie, Weave,
  AeroTuck, ScoutLeftRight, RevIdle). 8.4 MB.
- The game does not load this file or its clips. It loads `public/assets/3d/optimized/baothu.optimized.glb`,
  written by `node apps/game/scripts/optimize-bike-rider.cjs baothu` (run from the workspace root). The
  output has the layout of `bike-rider.optimized.glb`: LOD0 64,319, LOD1 25,038 and LOD2 21,890
  triangles, 2.52 MB. The wheelie, the weave and the revving shake are done in code
  (`src/features/khupho/world/baothuMotion.ts`), about the rear wheel contact point.
- Sound: `public/audio/netpo.mp3` (owner-supplied engine rev, 4.9 s), played when the rider is held up.
