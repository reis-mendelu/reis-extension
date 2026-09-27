import type { RoomFeature } from '../../types/campusMap';

export type Side = 'north' | 'south' | 'east' | 'west';

/** A staircase (and the lift beside it, if any) that runs through several floors. */
export interface StairCore {
  side: Side;
  lift: boolean;
  /** The floors it stops at, ascending. */
  levels: number[];
  /** Its centre, [lng, lat]. */
  at: [number, number];
}

/** A building entrance: where it is and which floor it opens onto. */
export interface Entrance {
  at: [number, number];
  level: number;
}

export type Step =
  | { kind: 'enter'; side: Side; level: number }
  | { kind: 'core'; side: Side; lift: boolean; direction: 'up' | 'down'; level: number }
  | { kind: 'arrive'; name: string; level: number; byCore: boolean };

/** Shapes on different floors this close together (metres) are one staircase. */
const STACK_M = 8;
/** A lift this close to a staircase belongs to it. */
const LIFT_M = 12;
/** A room this close to its staircase is "by the stairs". */
const BY_CORE_M = 15;

const centre = (f: RoomFeature): [number, number] => {
  const ring = f.geometry.coordinates[0] ?? [];
  const pts = ring.slice(0, -1);
  const n = Math.max(1, pts.length);
  return [
    pts.reduce((s, p) => s + (p[0] ?? 0), 0) / n,
    pts.reduce((s, p) => s + (p[1] ?? 0), 0) / n,
  ];
};

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
  levels: Set<number>;
}

function stack(shapes: RoomFeature[]): Stack[] {
  const stacks: Stack[] = [];
  for (const f of shapes) {
    const c = centre(f);
    const s = stacks.find((x) => metres(x.at, c) <= STACK_M);
    if (s) s.levels.add(f.properties.floorLevel);
    else stacks.push({ at: c, levels: new Set([f.properties.floorLevel]) });
  }
  return stacks;
}

/**
 * The building's staircases, each stacked across the floors it serves, with the
 * lift beside it joined in and its side of the building named. Emergency
 * stairs are left out: they are not a way a student is sent.
 */
export function stairCores(rooms: RoomFeature[]): StairCore[] {
  const mid = middle(rooms);
  const lifts = stack(rooms.filter((f) => f.properties.type === 'elevator'));
  return stack(rooms.filter((f) => f.properties.type === 'stairs')).map((s) => ({
    side: sideOf(s.at, mid),
    lift: lifts.some((l) => metres(l.at, s.at) <= LIFT_M),
    levels: [...s.levels].sort((a, b) => a - b),
    at: s.at,
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
  const room = centre(target);
  const enter: Step = { kind: 'enter', side: sideOf(entrance.at, mid), level: entrance.level };
  if (level === entrance.level)
    return [enter, { kind: 'arrive', name: target.properties.name, level, byCore: false }];
  const core = stairCores(rooms)
    .filter((c) => c.levels.includes(level) && c.levels.includes(entrance.level))
    .sort((a, b) => metres(a.at, room) - metres(b.at, room))[0];
  if (!core) return null;
  return [
    enter,
    {
      kind: 'core',
      side: core.side,
      lift: core.lift,
      direction: level > entrance.level ? 'up' : 'down',
      level,
    },
    {
      kind: 'arrive',
      name: target.properties.name,
      level,
      byCore: metres(core.at, room) <= BY_CORE_M,
    },
  ];
}
