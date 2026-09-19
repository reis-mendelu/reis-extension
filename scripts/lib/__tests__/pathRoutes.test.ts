import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { mergeRoutes, routeLengthM, labelRoute, clipToRegion } from '../pathRoutes.mjs';

/** A straight west→east run chopped into three OSM ways, as Overpass returns it. */
const straightChopped = [
  {
    id: 1,
    coords: [
      [16.614, 49.21],
      [16.6145, 49.21],
    ],
  },
  {
    id: 2,
    coords: [
      [16.6145, 49.21],
      [16.615, 49.21],
    ],
  },
  {
    id: 3,
    coords: [
      [16.615, 49.21],
      [16.6155, 49.21],
    ],
  },
];

describe('mergeRoutes', () => {
  it('joins ways chopped at plain degree-2 endpoints into one route', () => {
    const routes = mergeRoutes(straightChopped);
    expect(routes).toHaveLength(1);
    expect(routes[0].coords[0]).toEqual([16.614, 49.21]);
    expect(routes[0].coords.at(-1)).toEqual([16.6155, 49.21]);
    expect(routes[0].wayIds.sort()).toEqual([1, 2, 3]);
  });

  it('joins a way recorded in the opposite direction', () => {
    const routes = mergeRoutes([
      straightChopped[0],
      { id: 2, coords: [...straightChopped[1].coords].reverse() },
    ]);
    expect(routes).toHaveLength(1);
    expect(routes[0].coords.at(-1)).toEqual([16.615, 49.21]);
  });

  it('carries a route straight THROUGH a T-junction rather than stopping at it', () => {
    // A stub branches north from the midpoint; the straight run must stay whole.
    const routes = mergeRoutes([
      ...straightChopped,
      {
        id: 9,
        coords: [
          [16.6145, 49.21],
          [16.6145, 49.2106],
        ],
      },
    ]);
    const longest = routes.sort((a, b) => routeLengthM(b) - routeLengthM(a))[0];
    expect(longest.wayIds.sort()).toEqual([1, 2, 3]);
    expect(routes).toHaveLength(2);
  });

  it('does not join a way that turns back sharply', () => {
    const routes = mergeRoutes([
      {
        id: 1,
        coords: [
          [16.614, 49.21],
          [16.615, 49.21],
        ],
      },
      // doubles back west-north-west: a ~160° turn, not a continuation
      {
        id: 2,
        coords: [
          [16.615, 49.21],
          [16.6141, 49.2103],
        ],
      },
    ]);
    expect(routes).toHaveLength(2);
  });

  it('never emits the same way twice', () => {
    const routes = mergeRoutes([
      ...straightChopped,
      {
        id: 9,
        coords: [
          [16.6145, 49.21],
          [16.6145, 49.2106],
        ],
      },
      {
        id: 10,
        coords: [
          [16.6145, 49.2106],
          [16.6145, 49.2112],
        ],
      },
    ]);
    const all = routes.flatMap((r) => r.wayIds);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set([1, 2, 3, 9, 10]));
  });

  it('closes no gap between ways that merely pass near each other', () => {
    const routes = mergeRoutes([
      {
        id: 1,
        coords: [
          [16.614, 49.21],
          [16.6145, 49.21],
        ],
      },
      {
        id: 2,
        coords: [
          [16.6146, 49.21],
          [16.615, 49.21],
        ],
      },
    ]);
    expect(routes).toHaveLength(2);
  });
});

describe('routeLengthM', () => {
  it('measures a route in metres along the ground', () => {
    // 0.0015° of longitude at 49.21°N ≈ 109 m
    const m = routeLengthM(mergeRoutes(straightChopped)[0]);
    expect(m).toBeGreaterThan(100);
    expect(m).toBeLessThan(120);
  });
});

describe('labelRoute', () => {
  const places = [
    { name: 'Hlavní brána', lon: 16.614, lat: 49.21, kind: 'gate' },
    { name: 'Q', lon: 16.6155, lat: 49.21, kind: 'building' },
    { name: 'Menza', lon: 16.63, lat: 49.21, kind: 'cafeteria' },
  ];

  it('names a route by the place at each of its two ends', () => {
    const l = labelRoute(mergeRoutes(straightChopped)[0], places, 40);
    expect(l).toEqual({ from: 'Hlavní brána', to: 'Q' });
  });

  it('leaves an end unnamed when no place is within the radius', () => {
    const l = labelRoute(
      {
        coords: [
          [16.614, 49.21],
          [16.62, 49.21],
        ],
        wayIds: [1],
      },
      places,
      40
    );
    expect(l).toEqual({ from: 'Hlavní brána', to: null });
  });

  it('does not name both ends after the same place', () => {
    const l = labelRoute(
      {
        coords: [
          [16.614, 49.21],
          [16.61402, 49.21002],
        ],
        wayIds: [1],
      },
      places,
      40
    );
    expect(l).toEqual({ from: 'Hlavní brána', to: null });
  });
});

describe('labelRoute with a place given as many vertices', () => {
  // How a building is really passed in: one entry per outline vertex, so the
  // distance measured is to the wall rather than to the centroid.
  const wall = [16.6149, 16.615, 16.6151, 16.6152].map((lon) => ({
    name: 'Q',
    lon,
    lat: 49.21,
    kind: 'building',
  }));

  it('does not name both ends "Q" just because they touch different corners', () => {
    const l = labelRoute(
      {
        coords: [
          [16.6149, 49.21],
          [16.6152, 49.21],
        ],
        wayIds: [1],
      },
      wall,
      40
    );
    expect(l).toEqual({ from: 'Q', to: null });
  });
});

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
    const m = routeLengthM({ coords: runs[0], wayIds: [] });
    expect(m).toBeLessThan(500);
  });
});
