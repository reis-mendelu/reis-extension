/** A point in px, or an offset. */
export interface Pt {
  x: number;
  y: number;
}

/** Another pin closer than this (metres) pushes the chip aside. */
const NEAR_M = 60;
const M_PER_DEG_LAT = 111_320;

/**
 * Which way the library chip sits from its coordinate, as a px offset of its
 * centre: centred, or moved away from the nearest other pin (Vazbič's, on the
 * same building A, sat under the same fingertip).
 *
 * Decided on the ground, in metres, never from screen distances: deciding it
 * from where pins happened to be drawn flipped the chip from side to side on
 * every frame of a pan or a pinch (Dominik on the Pixel, 2026-11-16). On the
 * ground nothing moves, so the chip keeps its side at every zoom.
 */
export function chipOffset(
  at: [number, number],
  others: readonly [number, number][],
  w: number,
  h: number
): Pt {
  const cos = Math.cos((at[1] * Math.PI) / 180);
  const metres = (o: [number, number]) => ({
    dx: (o[0] - at[0]) * M_PER_DEG_LAT * cos,
    dy: (o[1] - at[1]) * M_PER_DEG_LAT,
  });
  const near = others
    .map(metres)
    .map((m) => ({ ...m, d: Math.hypot(m.dx, m.dy) }))
    .filter((m) => m.d < NEAR_M)
    .sort((a, b) => a.d - b.d)[0];
  if (!near) return { x: 0, y: 0 };
  // Away from it, along whichever axis it mostly lies on.
  if (Math.abs(near.dx) >= Math.abs(near.dy))
    return { x: near.dx > 0 ? -(w / 2 + 11) : w / 2 + 11, y: 0 };
  return { x: 0, y: near.dy > 0 ? h / 2 + 4 : -(h / 2 + 4) };
}
