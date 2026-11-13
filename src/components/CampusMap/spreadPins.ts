/** Room another pin needs: nothing of ours may come closer than `r` to its centre. */
export interface PinObstacle {
  x: number;
  y: number;
  r: number;
}

type Point = { x: number; y: number };

/** The eight ways out tried besides straight away from the obstacle in the way. */
const COMPASS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
] as const;
/** Further than this and the pin no longer marks its place; leave it be. */
const MAX_PUSH = 400;

const clearOf = (pts: Point[], obstacles: PinObstacle[]) =>
  pts.every((p) => obstacles.every((o) => Math.hypot(p.x - o.x, p.y - o.y) >= o.r));

/**
 * Pins whose centres are closer than `gap` px would sit on top of each other —
 * the Schreberovy zahrádky court and pitch are ~6 m apart, the same spot at any
 * zoom. Each such cluster is laid out side by side, `gap` apart, around its
 * midpoint, west to east, so every place keeps a pin of its own. A cluster that
 * lands on a neighbour once spread absorbs it, and is laid out again.
 *
 * `obstacles` are other layers' pins (S-klub's logo and its name label): a
 * cluster that would cover one moves, all together, the shortest distance that
 * clears every member of every obstacle. Pins with room to spare stay exactly
 * where they are.
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
      const a = pins[i]!;
      const b = pins[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < gap) parent[root(i)] = root(j);
    }
  }

  let out = [...pins];
  // Each pass either merges two clusters or ends, so n passes always suffice.
  for (let pass = 0; pass < pins.length; pass++) {
    out = layOut(pins, root, gap);
    let merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (root(i) === root(j)) continue;
        // A hair of tolerance: a pair laid out exactly `gap` apart is fine.
        if (Math.hypot(out[i]!.x - out[j]!.x, out[i]!.y - out[j]!.y) < gap - 0.01) {
          parent[root(i)] = root(j);
          merged = true;
          break;
        }
      }
    }
    if (!merged) break;
  }

  if (obstacles.length === 0) return out;
  for (const members of clustersOf(pins, root).values()) {
    const shift = clearingShift(
      members.map((i) => out[i]!),
      obstacles
    );
    if (!shift) continue;
    for (const i of members)
      out[i] = { ...out[i]!, x: out[i]!.x + shift.x, y: out[i]!.y + shift.y };
  }
  return out;
}

function clustersOf(pins: unknown[], root: (i: number) => number): Map<number, number[]> {
  const clusters = new Map<number, number[]>();
  pins.forEach((_, i) => clusters.set(root(i), [...(clusters.get(root(i)) ?? []), i]));
  return clusters;
}

/** Every cluster of two or more side by side around its midpoint; singletons untouched. */
function layOut<T extends { key: string; x: number; y: number }>(
  pins: T[],
  root: (i: number) => number,
  gap: number
): T[] {
  const out = [...pins];
  for (const members of clustersOf(pins, root).values()) {
    if (members.length < 2) continue;
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

/**
 * The shortest whole-pixel move that clears every member of every obstacle:
 * straight away from the obstacle most in the way, or along one of the eight
 * compass directions, whichever is shorter. Null when already clear, or when
 * nothing within MAX_PUSH clears it.
 */
function clearingShift(members: Point[], obstacles: PinObstacle[]): Point | null {
  if (clearOf(members, obstacles)) return null;
  const mid = {
    x: members.reduce((s, p) => s + p.x, 0) / members.length,
    y: members.reduce((s, p) => s + p.y, 0) / members.length,
  };
  let worst = obstacles[0]!;
  let worstDepth = -Infinity;
  for (const o of obstacles) {
    for (const p of members) {
      const depth = o.r - Math.hypot(p.x - o.x, p.y - o.y);
      if (depth > worstDepth) {
        worstDepth = depth;
        worst = o;
      }
    }
  }
  const ax = mid.x - worst.x;
  const ay = mid.y - worst.y;
  const al = Math.hypot(ax, ay);
  // Dead centre has no direction away: go down, below the label.
  const away = al === 0 ? ([0, 1] as const) : ([ax / al, ay / al] as const);

  let best: { t: number; x: number; y: number } | null = null;
  for (const [dx, dy] of [away, ...COMPASS]) {
    for (let t = 1; t <= (best ? best.t - 1 : MAX_PUSH); t++) {
      const moved = members.map((p) => ({ x: p.x + dx * t, y: p.y + dy * t }));
      if (clearOf(moved, obstacles)) {
        best = { t, x: dx * t, y: dy * t };
        break;
      }
    }
  }
  return best && { x: best.x, y: best.y };
}
