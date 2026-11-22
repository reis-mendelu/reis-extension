/**
 * Per building, how it stands in the isometric picture, and the re-rendered patches that cut it at a
 * floor (see isoCutaway.ts). Every height is metres above the picture's 17 m ground (isoView.ts).
 *
 * Written by izomapa's build/cuts_all.py, which also renders the patches (outside this repo). Q is
 * measured from the render's hand-built model: a 3.3 m plinth, 3.55 m storeys, a 24.7 m roof. Every
 * other building's roof is the laser (DMP 1G) 90th-percentile height of its footprint and its storeys
 * are that divided by its number of floors, 3.0 to 4.2 m: an estimate, good for "about this high up",
 * not for a surveyor. `lowest` is the first floor level at or above ground; `baseM` is where it stands
 * (the building's highest ground, so the cut never digs into a slope).
 */
export interface IsoBuilding {
  groundM: number;
  baseM: number;
  floorM: number;
  roofM: number;
  lowest: number;
  top: number;
  cut: { x: number; y: number; w: number; h: number };
}

export const ISO_BUILDINGS: Readonly<Record<number, IsoBuilding>> = {
  // Q
  0: {
    groundM: 0.34,
    baseM: 3.64,
    floorM: 3.55,
    roofM: 25.04,
    lowest: 0,
    top: 5,
    cut: { x: 5512, y: 5207, w: 584, h: 421 },
  },
  // A
  54678: {
    groundM: 15.05,
    baseM: 17.97,
    floorM: 4.2,
    roofM: 44.25,
    lowest: 0,
    top: 4,
    cut: { x: 6028, y: 4896, w: 767, h: 483 },
  },
  // B
  510096: {
    groundM: 18.71,
    baseM: 21.66,
    floorM: 3.6,
    roofM: 40.31,
    lowest: 1,
    top: 6,
    cut: { x: 6793, y: 4631, w: 451, h: 463 },
  },
  // C
  489829: {
    groundM: 10.58,
    baseM: 13.75,
    floorM: 3.6,
    roofM: 35.78,
    lowest: 0,
    top: 6,
    cut: { x: 6497, y: 4346, w: 380, h: 486 },
  },
  // E
  1279313: {
    groundM: 16.61,
    baseM: 18.21,
    floorM: 4.2,
    roofM: 33.61,
    lowest: 1,
    top: 4,
    cut: { x: 7324, y: 4741, w: 245, h: 206 },
  },
  // M
  582134: {
    groundM: -3.47,
    baseM: 1.2,
    floorM: 4.2,
    roofM: 11.53,
    lowest: 1,
    top: 2,
    cut: { x: 5385, y: 4935, w: 464, h: 370 },
  },
  // X
  465899: {
    groundM: 3.79,
    baseM: 6.93,
    floorM: 4.2,
    roofM: 19.09,
    lowest: 1,
    top: 3,
    cut: { x: 5749, y: 4899, w: 426, h: 265 },
  },
  // Z
  9000001: {
    groundM: 7.82,
    baseM: 10.49,
    floorM: 4.2,
    roofM: 30.52,
    lowest: 0,
    top: 3,
    cut: { x: 5579, y: 1739, w: 585, h: 519 },
  },
};
