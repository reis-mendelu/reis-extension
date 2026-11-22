import { isoPixel } from './isoView';

/**
 * Stairs a student can climb. Not `emergency_stairs`: Q's floor plan has them where there is no staircase
 * (the topmost ones beside Q45 on floor 4), so drawing them would send a student to a wall.
 */
export const isStairs = (type: string) => type === 'stairs';

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG_AT_EQUATOR = 111320;

/**
 * A stairwell drawn as what it is: a flight of steps, the treads laid across the stairwell's long side,
 * so a student reads "stairs" at a glance. Deliberately no arrow and no slope: nobody can say which floor
 * a student starts from, so the picture never says up or down. `ring` is [lng, lat]; the result is one
 * path of picture-pixel segments, at `heightM` above the ground, or '' when the room is too small to be a flight.
 */
export function stairTreads(ring: number[][], heightM: number): string {
  const lng0 = ring[0]![0]!;
  const lat0 = ring[0]![1]!;
  const kx = M_PER_DEG_LNG_AT_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const pts = ring
    .slice(0, -1)
    .map(([lng, lat]) => [(lng! - lng0) * kx, (lat! - lat0) * M_PER_DEG_LAT]);

  // The smallest rectangle around the room, one side along each edge in turn: exact for a stairwell.
  let best: {
    area: number;
    c: number;
    s: number;
    u: [number, number];
    v: [number, number];
  } | null = null;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]!;
    const [bx, by] = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(bx! - ax!, by! - ay!);
    if (len === 0) continue;
    const c = (bx! - ax!) / len;
    const s = (by! - ay!) / len;
    const us = pts.map(([x, y]) => x! * c + y! * s);
    const vs = pts.map(([x, y]) => -x! * s + y! * c);
    const u: [number, number] = [Math.min(...us), Math.max(...us)];
    const v: [number, number] = [Math.min(...vs), Math.max(...vs)];
    const area = (u[1] - u[0]) * (v[1] - v[0]);
    if (!best || area < best.area) best = { area, c, s, u, v };
  }
  if (!best) return '';

  // Long side first: that is the way the flight runs.
  const alongU = best.u[1] - best.u[0] >= best.v[1] - best.v[0];
  const { c, s } = best;
  const run = alongU ? best.u : best.v;
  const width = alongU ? best.v : best.u;
  const length = run[1] - run[0];
  const span = width[1] - width[0];
  if (length < 2 || span < 1) return '';

  const n = Math.min(12, Math.max(4, Math.round(length / 0.55)));
  const inset = span * 0.08;
  const at = (r: number, w: number) => {
    const u = alongU ? r : w;
    const v = alongU ? w : r;
    const x = u * c - v * s;
    const y = u * s + v * c;
    const p = isoPixel(lat0 + y / M_PER_DEG_LAT, lng0 + x / kx, heightM);
    return `${p.px.toFixed(1)} ${p.py.toFixed(1)}`;
  };
  return Array.from({ length: n }, (_, i) => {
    const r = run[0] + (length * (i + 0.5)) / n;
    return `M${at(r, width[0] + inset)}L${at(r, width[1] - inset)}`;
  }).join('');
}

/**
 * The stairs to light up for the room a student picked: the nearest ones on the open floor. Nothing on the lowest floor above ground (a room there is
 * reached from the street), with nothing picked, or when the pick is itself the stairs. `at` is the room's
 * middle in picture pixels. Returns the stairs' room id.
 */
export function guideStairs(
  rooms: { id: number; type: string; at: [number, number] }[],
  selectedId: number | null,
  onLowestFloor: boolean
): number | null {
  const picked = rooms.find((r) => r.id === selectedId);
  if (onLowestFloor || !picked || isStairs(picked.type)) return null;
  const pool = rooms.filter((r) => isStairs(r.type));
  const dist = (r: { at: [number, number] }) =>
    Math.hypot(r.at[0] - picked.at[0], r.at[1] - picked.at[1]);
  return (
    pool.reduce<(typeof pool)[number] | null>((a, r) => (!a || dist(r) < dist(a) ? r : a), null)
      ?.id ?? null
  );
}
