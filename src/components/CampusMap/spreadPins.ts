/** Room another pin needs: nothing of ours may come closer than `r` to its centre. */
export interface PinObstacle {
  x: number;
  y: number;
  r: number;
}

/**
 * Pins whose centres are closer than `gap` px would sit on top of each other —
 * the Schreberovy zahrádky court and pitch are ~6 m apart, the same spot at any
 * zoom. Each such cluster is laid out side by side, `gap` apart, around its
 * midpoint, west to east, so every place keeps a pin of its own.
 *
 * `obstacles` are other layers' pins (S-klub's logo and its name label): a
 * cluster that would cover one steps straight away from it, all together, by
 * what its worst member needs. Pins with room to spare stay exactly where they
 * are.
 */
export function spreadPins<T extends { key: string; x: number; y: number }>(
  pins: T[],
  gap: number,
  obstacles: PinObstacle[] = []
): T[] {
  const parent = pins.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i]!,
        b = pins[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < gap) parent[root(i)] = root(j);
    }
  }
  const clusters = new Map<number, number[]>();
  pins.forEach((_, i) => clusters.set(root(i), [...(clusters.get(root(i)) ?? []), i]));

  const out = [...pins];
  for (const members of clusters.values()) {
    if (members.length > 1) {
      const sorted = [...members].sort(
        (i, j) => pins[i]!.x - pins[j]!.x || pins[i]!.key.localeCompare(pins[j]!.key)
      );
      const midX = members.reduce((s, i) => s + pins[i]!.x, 0) / members.length;
      const midY = members.reduce((s, i) => s + pins[i]!.y, 0) / members.length;
      sorted.forEach((i, k) => {
        out[i] = { ...pins[i]!, x: midX + (k - (sorted.length - 1) / 2) * gap, y: midY };
      });
    }
    // The largest push any member needs, applied to the whole cluster.
    let push = { dx: 0, dy: 0, len: 0 };
    for (const i of members) {
      for (const o of obstacles) {
        const dx = out[i]!.x - o.x,
          dy = out[i]!.y - o.y;
        const d = Math.hypot(dx, dy);
        const need = o.r - d;
        if (need <= push.len) continue;
        // Dead centre has no direction away: go down, below the label.
        push =
          d === 0
            ? { dx: 0, dy: need, len: need }
            : { dx: (dx / d) * need, dy: (dy / d) * need, len: need };
      }
    }
    if (push.len > 0) {
      for (const i of members)
        out[i] = { ...out[i]!, x: out[i]!.x + push.dx, y: out[i]!.y + push.dy };
    }
  }
  return out;
}
