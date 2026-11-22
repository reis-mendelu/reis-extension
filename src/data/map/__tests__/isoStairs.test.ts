import { describe, expect, it } from 'vitest';
import { isoPixel } from '../isoView';
import { guideStairs, isStairs, stairTreads } from '../isoStairs';

// A stairwell 2.5 m wide and 6 m long, long side north-south, somewhere on the campus.
const [LNG, LAT] = [16.6135, 49.2095];
const DLNG = 2.5 / (111320 * Math.cos((LAT * Math.PI) / 180));
const DLAT = 6 / 110540;
const ring: [number, number][] = [
  [LNG, LAT],
  [LNG + DLNG, LAT],
  [LNG + DLNG, LAT + DLAT],
  [LNG, LAT + DLAT],
  [LNG, LAT],
];

const segments = (d: string) =>
  d
    .split('M')
    .filter(Boolean)
    .map((s) => s.split('L').map((p) => p.trim().split(' ').map(Number)) as [number, number][]);

/**
 * Stairs are drawn as what they are: a flight of steps, so a student reads "stairs" at a glance.
 * No arrow: nobody can tell which floor a student starts from, so the picture never says up or down.
 */
describe('isStairs', () => {
  it('knows the stairs and the emergency stairs, and nothing else', () => {
    expect(isStairs('stairs')).toBe(true);
    expect(isStairs('emergency_stairs')).toBe(true);
    expect(isStairs('elevator')).toBe(false);
    expect(isStairs('classroom_and_laboratory')).toBe(false);
  });
});

describe('stairTreads', () => {
  const treads = segments(stairTreads(ring, 10));

  it('draws a handful of treads, enough to read as steps and few enough to stay apart', () => {
    expect(treads.length).toBeGreaterThanOrEqual(4);
    expect(treads.length).toBeLessThanOrEqual(12);
  });

  it('runs every tread across the long side, the way a step runs across a flight', () => {
    // The short side (west to east) in the picture.
    const a = isoPixel(LAT, LNG, 10);
    const b = isoPixel(LAT, LNG + DLNG, 10);
    const side = [b.px - a.px, b.py - a.py];
    for (const [p, q] of treads) {
      const t = [q![0]! - p![0]!, q![1]! - p![1]!];
      const cross = side[0]! * t[1]! - side[1]! * t[0]!;
      expect(Math.abs(cross)).toBeLessThan(1e-3 * Math.hypot(...side) * Math.hypot(...t));
    }
  });

  it('keeps the treads inside the stairwell, evenly spaced from end to end', () => {
    const ys = treads.map(([p]) => p![1]!).sort((x, y) => x - y);
    const gaps = ys.slice(1).map((y, i) => y - ys[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1e-6 + Math.max(...gaps) * 0.05);
    const lo = isoPixel(LAT, LNG, 10).py;
    const hi = isoPixel(LAT + DLAT, LNG + DLNG, 10).py;
    ys.forEach((y) => {
      expect(y).toBeGreaterThan(Math.min(lo, hi) - 1);
      expect(y).toBeLessThan(Math.max(lo, hi) + 1);
    });
  });

  it('draws nothing for a ring too small to be stairs', () => {
    const tiny = ring.map(([x, y]) => [LNG + (x - LNG) / 20, LAT + (y - LAT) / 20]) as [
      number,
      number,
    ][];
    expect(stairTreads(tiny, 10)).toBe('');
  });
});

/**
 * Pick a room on another floor and the stairs nearest it light up and move, so a student sees where
 * to climb. Nobody knows which floor they start from, so which way it points is not said.
 */
describe('guideStairs', () => {
  const rooms = [
    { id: 1, type: 'classroom_and_laboratory', at: [100, 100] as [number, number] },
    { id: 2, type: 'stairs', at: [400, 100] as [number, number] },
    { id: 3, type: 'stairs', at: [150, 100] as [number, number] },
    { id: 4, type: 'emergency_stairs', at: [110, 100] as [number, number] },
    { id: 5, type: 'elevator', at: [101, 100] as [number, number] },
  ];

  it('picks the stairs nearest the room, emergency stairs included', () => {
    expect(guideStairs(rooms, 1, false)).toBe(4);
    expect(
      guideStairs(
        rooms.filter((r) => r.id !== 4),
        1,
        false
      )
    ).toBe(3);
  });

  it('says nothing on the lowest floor, with nothing picked, or when the pick is the stairs', () => {
    expect(guideStairs(rooms, 1, true)).toBeNull();
    expect(guideStairs(rooms, null, false)).toBeNull();
    expect(guideStairs(rooms, 3, false)).toBeNull();
    expect(guideStairs(rooms, 99, false)).toBeNull();
  });

  it('says nothing when the floor has no stairs', () => {
    expect(guideStairs([rooms[0]!, rooms[4]!], 1, false)).toBeNull();
  });
});
