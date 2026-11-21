# `taixe.glb` (bus driver)

Supplied by Men Le (Khanh-glitch/hauek, commit `703cfc1`) with the
rebuilt bus scene used by `/testbus`.

- Game version of the original `taixe.glb` (MD5 `34dfa5ea8466213167c267c9a333e257`). Source: 563,179
  vertices, 1 million triangles, one mesh, one UV set, three embedded textures, no rig or animation.
- Game version: 48,000 triangles, an eight-joint cabin rig and reduced textures. Rebuilt with
  `prepare_driver.py` (in the source repository, needs Pillow), then
  `npx gltfpack -i cabin.glb -o taixe.glb -si 0.048 -sp -cc -ce ext -kn`.
- License of the original model: **not stated** in the source repository. Confirm the
  distribution rights with the owner before any public release.
