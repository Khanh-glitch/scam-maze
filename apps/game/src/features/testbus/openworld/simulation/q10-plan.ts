export const DISTRICT_START = -195;
export const DISTRICT_BLOCK = 21;
type Kind =
  | "phone"
  | "kitchen"
  | "gate"
  | "blade"
  | "crest"
  | "shutter"
  | "awning"
  | "office"
  | "loggia"
  | "hem"
  | "balcony";
type Plot = [width: number, height: number, kind: Kind, setback: number];
// Per 21 m section, listed from -Z to +Z. Each lot has its own volume, not a sign swap.
export const strips: Record<number, [Plot[], Plot[]]> = {
  6: [
    [
      [6, 10, "balcony", 0],
      [4.1, 7.1, "awning", 0.15],
      [3.7, 12, "loggia", 0.9],
      [7.2, 15, "office", 0.65],
    ],
    [
      [8, 12, "crest", 0.3],
      [7, 9, "balcony", 0.5],
      [6, 7, "shutter", 0],
    ],
  ],
  7: [
    [
      [5, 8, "awning", 0.3],
      [9, 8.4, "phone", 0],
      [7, 7.5, "kitchen", 0],
    ],
    [
      [4.3, 12, "loggia", 0.4],
      [2.5, 0, "hem", 0],
      [6.2, 14, "blade", 0],
      [4.2, 9.2, "balcony", 0.8],
      [3.8, 11.5, "loggia", 0.2],
    ],
  ],
  8: [
    [
      [4.5, 9.7, "loggia", 0.25],
      [3.7, 6.4, "awning", 0],
      [6.3, 13, "crest", 0.8],
      [2.5, 0, "hem", 0],
      [4, 7.1, "shutter", 0.25],
    ],
    [
      [9, 3.5, "gate", 1.6],
      [6, 6, "awning", 0.65],
      [6, 10, "shutter", 0.15],
    ],
  ],
  9: [
    [
      [4.1, 8, "awning", 0.4],
      [4.6, 12.8, "loggia", 0.55],
      [4.3, 10, "balcony", 0],
      [8, 15, "office", 0.8],
    ],
    [
      [4.6, 7.2, "shutter", 0.3],
      [4.1, 11.1, "loggia", 0.3],
      [4.3, 6, "awning", 0.5],
      [8, 16, "office", 0.4],
    ],
  ],
  10: [
    [
      [6, 9, "balcony", 0.3],
      [8, 6, "awning", 0.15],
      [7, 7, "shutter", 0.4],
    ],
    [
      [7, 11, "balcony", 0.4],
      [8, 12, "blade", 0],
      [6, 9, "balcony", 0],
    ],
  ],
};

// The controller may cross the normal sidewalk bounds only in a modeled passage.
export const passages = Object.entries(strips).flatMap(([block, sides]) =>
  sides.flatMap((lots, side) => {
    let edge = DISTRICT_START + Number(block) * DISTRICT_BLOCK;
    return lots.flatMap(([w, , kind]) => {
      const start = edge;
      edge += w;
      return kind === "hem"
        ? [{ side: side === 0 ? 1 : -1, start, end: edge }]
        : [];
    });
  }),
);
