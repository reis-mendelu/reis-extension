import type { RoomFeature } from '../../types/campusMap';

export type Side = 'north' | 'south' | 'east' | 'west';

/** A staircase (and the lift beside it, if any) that runs through several floors. */
export interface StairCore {
  side: Side;
  lift: boolean;
  /** The floors it stops at, ascending. */
  levels: number[];
  /** Its centre on its first floor, [lng, lat]. */
  at: [number, number];
  /** Its centre on each floor it serves: a dog-leg staircase drifts per landing. */
  atByLevel: Record<number, [number, number]>;
}

/** A building entrance: where it is and which floor it opens onto. */
export interface Entrance {
  at: [number, number];
  level: number;
}

export type Step =
  | { kind: 'enter'; side: Side; level: number }
  | {
      kind: 'core';
      side: Side;
      lift: boolean;
      direction: 'up' | 'down';
      level: number;
      /** The staircase's centre on the room's floor, [lng, lat] — where the map lights it. */
      at: [number, number];
    }
  | { kind: 'arrive'; name: string; level: number; byCore: boolean };

/** Shapes on different floors this close together (metres) are one staircase. */
const STACK_M = 8;
/** A lift this close to a staircase belongs to it. */
const LIFT_M = 12;
/** A room this close to its staircase is "by the stairs". */
const BY_CORE_M = 15;

/** A room's area centroid (shoelace; flat at campus scale): the vertex mean
 *  drifts toward a concave room's busy side. */
function centre(f: RoomFeature): [number, number] {
  const raw = (f.geometry.coordinates[0] ?? []).map((p): [number, number] => [
    p[0] ?? 0,
    p[1] ?? 0,
  ]);
  // Relative to the first corner: products of raw degrees (~800) cancel a
  // few-metre room away entirely in float64.
  const [ox, oy] = raw[0] ?? [0, 0];
  const pts = raw.map(([px, py]): [number, number] => [px - ox, py - oy]);
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const k = x0 * y1 - x1 * y0;
    a += k;
    x += (x0 + x1) * k;
    y += (y0 + y1) * k;
  }
  if (Math.abs(a) > 1e-18) return [ox + x / (3 * a), oy + y / (3 * a)];
  const n = Math.max(1, pts.length);
  return [ox + pts.reduce((s, p) => s + p[0], 0) / n, oy + pts.reduce((s, p) => s + p[1], 0) / n];
}

/** Metres between two [lng, lat] points (campus scale, equirectangular). */
function metres(a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * 111320 * k, (a[1] - b[1]) * 111320);
}

/** Which side of the building a point is on, from the building's middle. */
function sideOf(p: readonly [number, number], mid: readonly [number, number]): Side {
  const k = Math.cos((mid[1] * Math.PI) / 180);
  const dx = (p[0] - mid[0]) * k;
  const dy = p[1] - mid[1];
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'north' : 'south';
}

/** The middle of the building's extent, from every room on every floor. */
function middle(rooms: RoomFeature[]): [number, number] {
  const pts = rooms.flatMap((f) => f.geometry.coordinates[0] ?? []);
  const lngs = pts.map((p) => p[0] ?? 0);
  const lats = pts.map((p) => p[1] ?? 0);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

interface Stack {
  at: [number, number];
  /** Every floor's shape centre: a dog-leg staircase drifts per landing. */
  members: { at: [number, number]; level: number }[];
  levels: Set<number>;
}

function stack(shapes: RoomFeature[]): Stack[] {
  const stacks: Stack[] = [];
  for (const f of shapes) {
    const level = f.properties.floorLevel;
    if (level === null) continue;
    const c = centre(f);
    const s = stacks.find((x) => x.members.some((m) => metres(m.at, c) <= STACK_M));
    if (s) {
      s.members.push({ at: c, level });
      s.levels.add(level);
    } else stacks.push({ at: c, members: [{ at: c, level }], levels: new Set([level]) });
  }
  return stacks;
}

/** The closest two stacks come on any floor they share (any floor, if none). */
function gap(a: Stack, b: Stack): number {
  const pairs = a.members.flatMap((m) => b.members.map((n) => ({ m, n })));
  const same = pairs.filter((p) => p.m.level === p.n.level);
  return Math.min(...(same.length ? same : pairs).map((p) => metres(p.m.at, p.n.at)));
}

/** A staircase's centre on `level`, or its first floor's. */
const atOn = (core: StairCore, level: number): [number, number] => core.atByLevel[level] ?? core.at;

/**
 * The building's staircases, each stacked across the floors it serves, with the
 * lift beside it joined in and its side of the building named. Emergency
 * stairs are left out: they are not a way a student is sent.
 */
export function stairCores(rooms: RoomFeature[]): StairCore[] {
  const mid = middle(rooms);
  const stairs = stack(rooms.filter((f) => f.properties.type === 'stairs'));
  // Each lift belongs to its nearest staircase alone: a liftless staircase near
  // another's lift must not be sent as "stairs or lift".
  const withLift = new Set<Stack>();
  for (const lift of stack(rooms.filter((f) => f.properties.type === 'elevator'))) {
    const nearest = stairs
      .map((s) => ({ s, d: gap(s, lift) }))
      .filter((x) => x.d <= LIFT_M)
      .sort((a, b) => a.d - b.d)[0];
    if (nearest) withLift.add(nearest.s);
  }
  return stairs.map((s) => ({
    side: sideOf(s.at, mid),
    lift: withLift.has(s),
    levels: [...s.levels].sort((a, b) => a - b),
    at: s.at,
    atByLevel: Object.fromEntries(s.members.map((m) => [m.level, m.at])),
  }));
}

/**
 * Floor-first directions from the entrance to `target`: in, up (or down) to the
 * room's floor, then the room. The staircase is the one nearest the room that
 * serves both floors — without corridor data, a courtyard building's upper
 * wings may not connect, so walking the entrance floor to the room's own stairs
 * is the way that surely arrives. Null when no staircase serves the room's floor.
 */
export function roomDirections(
  rooms: RoomFeature[],
  target: RoomFeature,
  entrance: Entrance
): Step[] | null {
  const mid = middle(rooms);
  const level = target.properties.floorLevel;
  if (level === null) return null;
  const room = centre(target);
  const enter: Step = { kind: 'enter', side: sideOf(entrance.at, mid), level: entrance.level };
  if (level === entrance.level)
    return [enter, { kind: 'arrive', name: target.properties.name, level, byCore: false }];
  const core = stairCores(rooms)
    .filter((c) => c.levels.includes(level) && c.levels.includes(entrance.level))
    .sort((a, b) => metres(atOn(a, level), room) - metres(atOn(b, level), room))[0];
  if (!core) return null;
  return [
    enter,
    {
      kind: 'core',
      side: core.side,
      lift: core.lift,
      direction: level > entrance.level ? 'up' : 'down',
      level,
      at: atOn(core, level),
    },
    {
      kind: 'arrive',
      name: target.properties.name,
      level,
      byCore: metres(atOn(core, level), room) <= BY_CORE_M,
    },
  ];
}

/**
 * The staircase (and its lift) at `at` among one floor's shapes: what the map
 * lights as the route on that floor. Empty on a floor the staircase misses.
 */
export function coreShapeIds(floorRooms: RoomFeature[], at: readonly [number, number]): number[] {
  // Its own stairs by the stacking radius — a second staircase a few metres off
  // stays unlit — and its lift by the lift radius.
  return floorRooms
    .filter((f) => {
      const t = f.properties.type;
      const d = metres(centre(f), at);
      return (t === 'stairs' && d <= STACK_M) || (t === 'elevator' && d <= LIFT_M);
    })
    .map((f) => f.properties.id);
}
