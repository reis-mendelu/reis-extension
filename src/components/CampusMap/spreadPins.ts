type Pin = { key: string; x: number; y: number };

/**
 * Places that share a spot would draw one pin on top of the other: the
 * Schreberovy court and pitch are ~6 m apart. `together` says which places are
 * at one spot. Where such pins overlap on screen (closer than `gap`), they are
 * pushed apart along the line between them until they are `gap` apart, each
 * moving half the shortfall — at most `gap / 2`. A pair on the very same point
 * goes side by side, ordered by key.
 *
 * Three or more at one spot (none in the bundled places today, which only form
 * pairs) go into a row around their midpoint once any two overlap: every
 * member moves, and the outer ones by up to a full `gap` per step from the
 * middle. A row is the simplest layout where none of them overlap; the
 * half-gap bound above holds for pairs only.
 *
 * Nothing else moves. Pins that merely meet on screen (two spots seen from far
 * out, or a pin under S-klub's) stay on their own places, and so does a
 * pair the map already shows apart. An earlier version pushed pins in pixels
 * to clear other pins and labels, and zoomed out that drew a pin streets away
 * from the court it marks (seen on the Pixel, PR 679).
 */
export function spreadPins<T extends Pin>(
  pins: T[],
  gap: number,
  together: (a: T, b: T) => boolean
): T[] {
  const parent = pins.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      if (together(pins[i]!, pins[j]!)) parent[root(i)] = root(j);
    }
  }
  const groups = new Map<number, number[]>();
  pins.forEach((_, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), i]));

  const out = [...pins];
  for (const members of groups.values()) {
    const group = members.map((i) => pins[i]!);
    if (group.length < 2 || !overlapping(group, gap)) continue;
    if (members.length === 2) {
      const [i, j] = [...members].sort((a, b) => pins[a]!.key.localeCompare(pins[b]!.key)) as [
        number,
        number,
      ];
      const a = pins[i]!;
      const b = pins[j]!;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const [ux, uy] = d === 0 ? [1, 0] : [(b.x - a.x) / d, (b.y - a.y) / d];
      const half = (gap - d) / 2;
      out[i] = { ...a, x: a.x - ux * half, y: a.y - uy * half };
      out[j] = { ...b, x: b.x + ux * half, y: b.y + uy * half };
      continue;
    }
    // Three or more at one spot: a row around the midpoint, west to east (see
    // the doc above: the outer members move further than half a gap).
    const sorted = [...members].sort(
      (i, j) => pins[i]!.x - pins[j]!.x || pins[i]!.key.localeCompare(pins[j]!.key)
    );
    const midX = members.reduce((s, i) => s + pins[i]!.x, 0) / members.length;
    const midY = members.reduce((s, i) => s + pins[i]!.y, 0) / members.length;
    sorted.forEach((i, k) => {
      out[i] = { ...pins[i]!, x: midX + (k - (sorted.length - 1) / 2) * gap, y: midY };
    });
  }
  return out;
}

function overlapping(pins: Pin[], gap: number): boolean {
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      if (Math.hypot(pins[i]!.x - pins[j]!.x, pins[i]!.y - pins[j]!.y) < gap) return true;
    }
  }
  return false;
}
