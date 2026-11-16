/** A point in layer pixels. */
export interface Pt {
  x: number;
  y: number;
}

/** Half the side of the square another pin claims: its 28px face plus its 8px tap pad. */
const OTHER_HALF = 22;
/** Air left between the chip's hit box and another pin's. */
const GAP = 4;

/**
 * Where the library chip sits relative to its coordinate, as an offset of the
 * chip's centre. Another pin on building A (Vazbič, 3. patro) stood ~37 px from
 * the library's 30 px dot, under one fingertip, and a tap meant for the library
 * opened Vazbič. The chip takes the first spot that keeps its whole hit box
 * (`w` × `h`) clear of every other pin's: centred, then left, right, above,
 * below. Centred when nothing is near, and centred as a last resort.
 */
export function chipOffset(at: Pt, others: readonly Pt[], w: number, h: number): Pt {
  const spots: Pt[] = [
    { x: 0, y: 0 },
    { x: -(w / 2 + OTHER_HALF / 2), y: 0 },
    { x: w / 2 + OTHER_HALF / 2, y: 0 },
    { x: 0, y: -(h + GAP) },
    { x: 0, y: h + GAP },
  ];
  const clear = (o: Pt) => (p: Pt) =>
    Math.abs(at.x + o.x - p.x) >= w / 2 + OTHER_HALF + GAP ||
    Math.abs(at.y + o.y - p.y) >= h / 2 + OTHER_HALF + GAP;
  return spots.find((o) => others.every(clear(o))) ?? spots[0]!;
}
