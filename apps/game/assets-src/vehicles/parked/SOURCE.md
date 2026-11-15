# Parked bikes

The source files are in Git LFS, except `honda-cg-125.glb`: its Sketchfab Standard license does
not allow redistributing the model file, so it stays local (git-ignored). Copy it from
`Asset3D/human/streetVehicle/` to rebuild its optimized file. The bobber and PCX state no license
(owner decision, 2026-11-15: committed anyway).

| File | Copied from | Title, author | License |
|---|---|---|---|
| `super-cub-c90.glb` | `Asset3D/human/streetVehicle/` | Honda Super cub, Aleksandr Sagidullin — https://sketchfab.com/3d-models/honda-super-cub-9ce554228fc746c89f6d02b995f43c41 | CC-BY 4.0 |
| `fat-boy-cruiser.glb` | `Asset3D/human/streetVehicle/` | Motorcycle (Harley Davidson Fat Boy inspired), christianchristian — https://sketchfab.com/3d-models/motorcycle-harley-davidson-fat-boy-inspired-4e7dc9622b3b457793fadeed4b5b2ff0 | CC-BY 4.0 |
| `honda-cg-125.glb` | `Asset3D/human/streetVehicle/` | Motorbike - Honda CG 125, LazyAstronaut3D — https://sketchfab.com/3d-models/motorbike-honda-cg-125-88a3e4989054480f9485cc658419de47 | Sketchfab Standard (use in a product allowed; the source is not redistributed) |
| `xyn-custom-bobber.glb` | `Asset3D/human/streetVehicle/` | not stated | not stated |
| `honda-pcx.glb` | `~/Downloads/honda-pcx/source/PCXDLXABS.glb` | not stated | not stated |

The PCX file carries a real brand logo texture and a Brazilian-format plate texture; the optimizer
removes both (`dropTexture`). The other bikes may still show small badge details in their textures.

Optimized by `node apps/game/scripts/optimize-street-props.cjs` into
`public/assets/3d/optimized/props/bike-*.optimized.glb`.
