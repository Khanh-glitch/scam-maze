# Character models

Owner-supplied animated people for the neighborhood (`Asset3D/human/`, added 2026-11-14). The game
does not load these files; it loads the optimized copies in
`public/assets/3d/optimized/characters/`, written by `node apps/game/scripts/optimize-characters.cjs`
(run from the workspace root; pass ids to rebuild only some).

| Id | Source file | Rig and clips | License |
|---|---|---|---|
| `banhmi-vendor` | `banhmi-vendor/banhmi_vendor_animated.glb` | 22 bones; VendorIdle, Welcome, Invite, PrepareBread, ServeBread, ReceivePayment, ThankCustomer, LookForCustomer; a baguette prop on the left hand, shown by the clips | Not provided |
| `manvn` | `manvn/manVN_rigged_animated.glb` | 22 bones (auto-rig, see `Asset3D/human/filecuachayxe/README.md`); Idle, Walk, Run, Jump, Wave, Bow, Clap, Dance, Squat, Cheer, Punch | Not provided |
| `juno3` | `juno3/juno3.glb` (+ `juno3.json`) | Mixamo, 64 bones, 5 face morphs; 18 clips incl. idle, walk, wave | Not provided; the JSON notes the clips are retargeted Mixamo captures (check before commercial use) |
| `rowan` | `rowan/rowan.glb` (+ `rowan.json`) | same as `juno3` | same as `juno3` |

Confirm every license before a public release.

## Optimized output (2026-11-14)

| Id | Size | Triangles | Textures |
|---|---|---|---|
| `banhmi-vendor` | 6.51 MB → 1.19 MB | 102,860 → 53,797 | WebP, color 2048, others 1024 |
| `manvn` | 2.33 MB → 0.83 MB | 20,635 (kept) | WebP 1024 |
| `juno3` | 27.98 MB → 2.10 MB | 67,157 → 40,283 | WebP 1024 |
| `rowan` | 32.48 MB → 2.19 MB | 68,448 → 41,068 | WebP 1024 |

## Adding a character

1. Put the `.glb` in `characters/<id>/` (Git LFS) and add an entry to `CHARACTERS` in the script.
2. Run the script for that id.
3. Register it in `HUMAN_MODELS` (`src/features/khupho/world/humans.ts`): file, standing height and
   the clip names for the roles it supports (`idle` is required; `walk` makes it usable as a walker).
   If the source states the walk clip's ground speed, set `walkSpeed`; otherwise it is measured
   from the planted foot at load.
4. Use it in `people.ts` (for example as the `model` argument of a sidewalk walker).
