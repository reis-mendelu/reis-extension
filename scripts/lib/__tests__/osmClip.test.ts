import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { clipToRegion } from '../osmClip.mjs';
// @ts-expect-error - plain .mjs build helper, no types
import { buildGraph } from '../pathGraph.mjs';

describe('clipToRegion', () => {
  const region = { s: 49.209, w: 16.613, n: 49.212, e: 16.619 };

  it('keeps a way that lies wholly inside, untouched', () => {
    const coords = [
      [16.614, 49.21],
      [16.615, 49.2105],
    ];
    expect(clipToRegion(coords, region)).toEqual([coords]);
  });

  it('drops a way that lies wholly outside', () => {
    expect(
      clipToRegion(
        [
          [16.63, 49.216],
          [16.631, 49.2165],
        ],
        region
      )
    ).toEqual([]);
  });

  it('cuts a way leaving the region at the boundary, not at the last vertex inside', () => {
    const runs = clipToRegion(
      [
        [16.618, 49.21],
        [16.625, 49.21],
      ],
      region
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(2);
    expect(runs[0][1][0]).toBeCloseTo(16.619, 9);
  });

  it('cuts a way entering the region at the boundary', () => {
    const runs = clipToRegion(
      [
        [16.605, 49.21],
        [16.615, 49.21],
      ],
      region
    );
    expect(runs[0][0][0]).toBeCloseTo(16.613, 9);
    expect(runs[0][1]).toEqual([16.615, 49.21]);
  });

  it('returns TWO runs for a way that crosses the region and comes back', () => {
    const runs = clipToRegion(
      [
        [16.614, 49.21],
        [16.625, 49.21],
        [16.625, 49.2105],
        [16.614, 49.2105],
      ],
      region
    );
    expect(runs).toHaveLength(2);
  });

  it('does not let a clipped 2 km pavement stay one route', () => {
    // The real failure: a way grazing the campus arrives with kilometres of
    // street attached. Clipped, its in-region part is a few hundred metres.
    const long = [];
    for (let i = 0; i < 200; i++) long.push([16.6 + i * 0.0002, 49.2105]);
    const runs = clipToRegion(long, region);
    expect(runs).toHaveLength(1);
    // its in-region part is a few hundred metres, not two kilometres
    const g = buildGraph([{ coords: runs[0] }]);
    const total =
      [...g.adj.values()].reduce(
        (a, nbrs) => a + [...nbrs.values()].reduce((x, y) => x + y, 0),
        0
      ) / 2;
    expect(total).toBeLessThan(500);
  });
});
