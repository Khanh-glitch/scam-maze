// The street network the minimap draws, kept as data in its own module so the world audit
// (`scripts/audit-world.mjs`) and `openWorldBounds.test.ts` can check every line against the
// walkable footprint without importing React or Three.
//
// Coordinates are world metres, identical to `OpenWorldEngine` / `saigonDistricts`.
// X grows east, Z grows south. A segment is a centreline plus `widthM` of paint.
export interface RoadSegment {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  widthM: number;
  kind: "avenue" | "alley" | "boulevard";
}

// Architectural Saigon street layout matching `OpenWorldEngine`, `boardingHouse`, and
// `saigonDistricts`. A segment may only be drawn where there is ground under it: the audit fails
// the build on any drawn road that leaves the walkable footprint for more than 3 m.
export const SAIGON_ROADS: readonly RoadSegment[] = [
  // Lý Thái Tổ & Northern Riverside Avenue. Stops where the asphalt stops (-312); north of that is
  // the Landmark 81 park, which has no street through it.
  { x0: -6, z0: 42, x1: -6, z1: -312, widthM: 12, kind: "avenue" },
  // Hẻm 462/14 Lý Thái Tổ into the boarding-house courtyard
  { x0: -2, z0: -11.2, x1: 23, z1: -11.2, widthM: 4.8, kind: "alley" },
  { x0: 20.5, z0: -11.2, x1: 20.5, z1: -19.5, widthM: 5.5, kind: "alley" },
  // East Boulevards (3/2 & District 1 approach)
  { x0: -6, z0: -76, x1: 126, z1: -76, widthM: 11, kind: "boulevard" },
  { x0: -6, z0: -147, x1: 126, z1: -147, widthM: 11, kind: "boulevard" },
  // Hải Triều connector toward Bitexco. Ends at -236, where the road plane and the sidewalk end;
  // the old -242 tail was 6 m of drawn road the player could not stand on.
  { x0: 56, z0: -72, x1: 56, z1: -236, widthM: 9.5, kind: "boulevard" },
  { x0: 56, z0: -186, x1: 118, z1: -186, widthM: 8.5, kind: "boulevard" },
  // Landmark 81 forecourt: the 8.6 m paved approach from the riverside up to the tower slab. The old
  // at z = -348 ran straight through the tower base (a 64 x 62 m paver slab at 26, -356).
  { x0: 26, z0: -316.4, x1: 26, z1: -325, widthM: 8.6, kind: "alley" },
];
