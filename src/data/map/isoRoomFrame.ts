import { isoPixel } from './isoView';

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG_AT_EQUATOR = 111320;

/**
 * The smallest rectangle around a room, one side along each edge in turn: exact for a rectangular room, a
 * fair frame for any other. `ring` is [lng, lat]. `long` runs along the room's longer side and `short`
 * across it, both in metres from the frame's corner; `at(l, s, heightM)` turns such a spot into a picture
 * pixel "x y", lifted `heightM` above the ground. `fill` is how much of the frame the room covers (1 for a
 * rectangle), so a caller can tell a room it may lay furniture in from an L-shaped one.
 */
export function roomFrame(ring: number[][]) {
  const lng0 = ring[0]![0]!;
  const lat0 = ring[0]![1]!;
  const kx = M_PER_DEG_LNG_AT_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const pts = ring
    .slice(0, -1)
    .map(([lng, lat]) => [(lng! - lng0) * kx, (lat! - lat0) * M_PER_DEG_LAT] as [number, number]);

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
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const c = (bx - ax) / len;
    const s = (by - ay) / len;
    const us = pts.map(([x, y]) => x * c + y * s);
    const vs = pts.map(([x, y]) => -x * s + y * c);
    const u: [number, number] = [Math.min(...us), Math.max(...us)];
    const v: [number, number] = [Math.min(...vs), Math.max(...vs)];
    const area = (u[1] - u[0]) * (v[1] - v[0]);
    if (!best || area < best.area) best = { area, c, s, u, v };
  }
  if (!best) return null;

  // Long side first: that is the way a flight of stairs runs, and the way a classroom's rows do.
  const alongU = best.u[1] - best.u[0] >= best.v[1] - best.v[0];
  const { c, s } = best;
  const long = alongU ? best.u : best.v;
  const short = alongU ? best.v : best.u;
  const shoelace = pts.reduce((sum, [x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]!;
    return sum + (x * ny - nx * y);
  }, 0);
  return {
    long,
    short,
    fill: Math.abs(shoelace / 2) / best.area,
    at: (l: number, sh: number, heightM: number) => {
      const u = alongU ? l : sh;
      const v = alongU ? sh : l;
      const x = u * c - v * s;
      const y = u * s + v * c;
      const p = isoPixel(lat0 + y / M_PER_DEG_LAT, lng0 + x / kx, heightM);
      return `${p.px.toFixed(1)} ${p.py.toFixed(1)}`;
    },
  };
}
