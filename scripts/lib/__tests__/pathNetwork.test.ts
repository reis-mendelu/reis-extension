import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import {
  buildGraph,
  snapAnchors,
  connectingRoutes,
  clipToRegion,
  networkStrokes,
} from '../pathNetwork.mjs';

/** A west→east line through three vertices, chopped into two OSM ways. */
const line = (lons: number[], lat = 49.21) => lons.map((lon) => [lon, lat] as [number, number]);

const pairOf = (r: { from: string; to: string }) => [r.from, r.to].sort().join('|');

describe('buildGraph', () => {
  it('joins ways that share an exact node into one network', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }, { coords: line([16.615, 16.616]) }]);
    expect(g.nodes.size).toBe(3);
    // the shared middle node reaches both ends
    const mid = [...g.nodes.keys()].find((k) => k.startsWith('16.6150000'))!;
    expect(g.adj.get(mid)!.size).toBe(2);
  });

  it('does not join ways that merely pass near each other', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }, { coords: line([16.6151, 16.616]) }]);
    expect(g.nodes.size).toBe(4);
    for (const nbrs of g.adj.values()) expect(nbrs.size).toBe(1);
  });

  it('measures each edge in metres', () => {
    const g = buildGraph([{ coords: line([16.614, 16.6155]) }]);
    const w = [...[...g.adj.values()][0].values()][0];
    expect(w).toBeGreaterThan(100);
    expect(w).toBeLessThan(120);
  });
});

describe('snapAnchors', () => {
  const g = buildGraph([{ coords: line([16.614, 16.615, 16.616]) }]);

  it('puts each named place on its nearest node', () => {
    const anchors = snapAnchors(g, [{ name: 'Q', lon: 16.61401, lat: 49.21 }], 35);
    expect([...anchors.values()]).toEqual(['Q']);
    expect([...anchors.keys()][0]).toMatch(/^16\.6140000/);
  });

  it('gives a place ONE node however many vertices it was passed as', () => {
    // A building arrives as one entry per outline vertex; as graph anchors that
    // would split every route at every wall corner.
    const wall = [16.6139, 16.61395, 16.614, 16.61405].map((lon) => ({
      name: 'Q',
      lon,
      lat: 49.21,
    }));
    const anchors = snapAnchors(g, wall, 35);
    expect(anchors.size).toBe(1);
  });

  it('drops a place with no node within the radius', () => {
    expect(snapAnchors(g, [{ name: 'Menza koleje', lon: 16.63, lat: 49.215 }], 35).size).toBe(0);
  });

  it('keeps two places that genuinely sit on different nodes', () => {
    const anchors = snapAnchors(
      g,
      [
        { name: 'Q', lon: 16.614, lat: 49.21 },
        { name: 'A', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    expect(anchors.size).toBe(2);
  });
});

describe('connectingRoutes', () => {
  it('runs a route THROUGH the plain junctions between two places', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }, { coords: line([16.615, 16.616]) }]);
    const anchors = snapAnchors(
      g,
      [
        { name: 'Hlavní brána', lon: 16.614, lat: 49.21 },
        { name: 'C', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    const routes = connectingRoutes(g, anchors);
    expect(routes).toHaveLength(1);
    expect(pairOf(routes[0])).toBe('C|Hlavní brána');
    // and it is one unbroken line, not two stubs
    expect(routes[0].coords).toHaveLength(3);
    expect(routes[0].lengthM).toBeGreaterThan(140);
  });

  it('stops a route at a place rather than running past it', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615, 16.616]) }]);
    const anchors = snapAnchors(
      g,
      [
        { name: 'Q', lon: 16.614, lat: 49.21 },
        { name: 'X', lon: 16.615, lat: 49.21 },
        { name: 'A', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    const pairs = connectingRoutes(g, anchors).map(pairOf).sort();
    expect(pairs).toEqual(['Q|X', 'A|X'].sort());
    expect(pairs).not.toContain('A|Q');
  });

  it('gives each pair of places one route, not one per direction', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }, { coords: line([16.615, 16.616]) }]);
    const anchors = snapAnchors(
      g,
      [
        { name: 'M', lon: 16.614, lat: 49.21 },
        { name: 'B', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    expect(connectingRoutes(g, anchors)).toHaveLength(1);
  });

  it('reaches every arm of a junction', () => {
    const g = buildGraph([
      { coords: line([16.614, 16.615]) },
      { coords: line([16.615, 16.616]) },
      {
        coords: [
          [16.615, 49.21],
          [16.615, 49.2106],
        ] as [number, number][],
      },
    ]);
    const anchors = snapAnchors(
      g,
      [
        { name: 'M', lon: 16.614, lat: 49.21 },
        { name: 'B', lon: 16.616, lat: 49.21 },
        { name: 'C', lon: 16.615, lat: 49.2106 },
      ],
      35
    );
    expect(connectingRoutes(g, anchors).map(pairOf).sort()).toEqual(['B|M', 'B|C', 'C|M'].sort());
  });

  it('emits geometry that is actually continuous', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }, { coords: line([16.615, 16.616]) }]);
    const anchors = snapAnchors(
      g,
      [
        { name: 'M', lon: 16.614, lat: 49.21 },
        { name: 'B', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    const [r] = connectingRoutes(g, anchors);
    for (let i = 1; i < r.coords.length; i++) {
      const a = `${r.coords[i - 1][0].toFixed(7)},${r.coords[i - 1][1].toFixed(7)}`;
      const b = `${r.coords[i][0].toFixed(7)},${r.coords[i][1].toFixed(7)}`;
      expect(g.adj.get(a)!.has(b)).toBe(true);
    }
  });

  it('says nothing about places the network cannot connect', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }, { coords: line([16.617, 16.618]) }]);
    const anchors = snapAnchors(
      g,
      [
        { name: 'M', lon: 16.614, lat: 49.21 },
        { name: 'B', lon: 16.618, lat: 49.21 },
      ],
      35
    );
    expect(connectingRoutes(g, anchors)).toHaveLength(0);
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

describe('networkStrokes', () => {
  const line = (lons: number[], lat = 49.21) => lons.map((lon) => [lon, lat] as [number, number]);
  const edgesOf = (strokes: [number, number][][]) => {
    const out: string[] = [];
    for (const s of strokes)
      for (let i = 1; i < s.length; i++)
        out.push(
          [
            `${s[i - 1][0].toFixed(7)},${s[i - 1][1].toFixed(7)}`,
            `${s[i][0].toFixed(7)},${s[i][1].toFixed(7)}`,
          ]
            .sort()
            .join('|')
        );
    return out;
  };

  it('draws a stretch shared by two routes ONCE', () => {
    // The bug it exists for: 46 routes summed to 8.9 km over a 7 km network,
    // so every shared stretch was painted twice and each route's white casing
    // scribbled over the next route's line.
    const routes = [
      { coords: line([16.614, 16.615, 16.616]) },
      { coords: line([16.614, 16.615, 16.617]) },
    ];
    const edges = edgesOf(networkStrokes(routes));
    expect(new Set(edges).size).toBe(edges.length);
    expect(edges).toHaveLength(3); // 614-615, 615-616, 615-617
  });

  it('covers every edge the routes use, and nothing else', () => {
    const routes = [{ coords: line([16.614, 16.615]) }, { coords: line([16.616, 16.617]) }];
    expect(edgesOf(networkStrokes(routes)).sort()).toEqual(
      edgesOf(routes.map((r) => r.coords)).sort()
    );
  });

  it('treats a stretch walked in the opposite direction as the same stretch', () => {
    const routes = [{ coords: line([16.614, 16.615]) }, { coords: line([16.615, 16.614]) }];
    expect(networkStrokes(routes)).toHaveLength(1);
    expect(edgesOf(networkStrokes(routes))).toHaveLength(1);
  });

  it('joins what it can into long strokes rather than one per segment', () => {
    const strokes = networkStrokes([{ coords: line([16.614, 16.615, 16.616, 16.617]) }]);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toHaveLength(4);
  });

  it('emits continuous strokes', () => {
    const strokes = networkStrokes([
      { coords: line([16.614, 16.615, 16.616]) },
      {
        coords: [
          [16.615, 49.21],
          [16.615, 49.2106],
        ] as [number, number][],
      },
    ]);
    for (const s of strokes)
      for (let i = 1; i < s.length; i++)
        expect(s[i - 1][0] !== s[i][0] || s[i - 1][1] !== s[i][1]).toBe(true);
  });

  it('is deterministic — the committed JSON must not churn between runs', () => {
    const routes = [
      { coords: line([16.614, 16.615, 16.616]) },
      {
        coords: [
          [16.615, 49.21],
          [16.615, 49.2106],
        ] as [number, number][],
      },
      { coords: line([16.616, 16.617]) },
    ];
    expect(JSON.stringify(networkStrokes(routes))).toBe(
      JSON.stringify(networkStrokes([...routes].reverse()))
    );
  });
});

describe('snapAnchors when two places want the same node', () => {
  const line = (lons: number[], lat = 49.21) => lons.map((lon) => [lon, lat] as [number, number]);
  // nodes ~7 m apart
  const g = buildGraph([{ coords: line([16.614, 16.6141, 16.6142, 16.6143]) }]);

  it('does not silently drop one of them', () => {
    // The real case: building E and the Akademická vinotéka both snap nearest
    // to one node. Resolving that alphabetically made a rename decide which
    // place existed — E only appeared on the map because "Vinotéka" sorts
    // after it.
    const anchors = snapAnchors(
      g,
      [
        { name: 'E', lon: 16.614, lat: 49.21 },
        { name: 'Vinotéka', lon: 16.61401, lat: 49.21 },
      ],
      35
    );
    expect([...anchors.values()].sort()).toEqual(['E', 'Vinotéka']);
    expect(anchors.size).toBe(2);
  });

  it('gives the contested node to whichever place is actually closer to it', () => {
    const anchors = snapAnchors(
      g,
      [
        { name: 'Far', lon: 16.61402, lat: 49.21 },
        { name: 'Near', lon: 16.614, lat: 49.21 },
      ],
      35
    );
    expect([...anchors.entries()].find(([k]) => k.startsWith('16.6140000'))?.[1]).toBe('Near');
  });

  it('drops a place only when every node in reach is already taken', () => {
    const tiny = buildGraph([{ coords: line([16.614, 16.6141]) }]);
    const anchors = snapAnchors(
      tiny,
      [
        { name: 'A', lon: 16.614, lat: 49.21 },
        { name: 'B', lon: 16.6141, lat: 49.21 },
        { name: 'C', lon: 16.61405, lat: 49.21 },
      ],
      35
    );
    expect(anchors.size).toBe(2);
    expect([...anchors.values()].sort()).toEqual(['A', 'B']);
  });
});

describe('snapAnchors keeps anchors apart', () => {
  const line = (lons: number[], lat = 49.21) => lons.map((lon) => [lon, lat] as [number, number]);
  // four nodes, ~7 m apart
  const g = buildGraph([{ coords: line([16.614, 16.6141, 16.6142, 16.6143]) }]);

  it('refuses a second anchor a few metres from the first', () => {
    // Building E and the Akademická vinotéka are the same doorway. Two anchors
    // that close produce a 7 m route, the length floor drops it, and whichever
    // place lost the contest is left on the map with no routes at all.
    const anchors = snapAnchors(
      g,
      [
        { name: 'E', lon: 16.614, lat: 49.21, rank: 0 },
        { name: 'Vinotéka', lon: 16.61401, lat: 49.21, rank: 2 },
      ],
      35,
      { minSeparationM: 25 }
    );
    expect([...anchors.values()]).toEqual(['E']);
  });

  it('lets the more useful place win — a lettered building over a café', () => {
    const anchors = snapAnchors(
      g,
      [
        // the café is NEARER the node, but a building is what people navigate by
        { name: 'Vinotéka', lon: 16.614, lat: 49.21, rank: 2 },
        { name: 'E', lon: 16.61401, lat: 49.21, rank: 0 },
      ],
      35,
      { minSeparationM: 25 }
    );
    expect([...anchors.values()]).toEqual(['E']);
  });

  it('still keeps two places that are genuinely far apart', () => {
    const far = buildGraph([{ coords: line([16.614, 16.6146]) }]); // ~44 m
    const anchors = snapAnchors(
      far,
      [
        { name: 'M', lon: 16.614, lat: 49.21, rank: 0 },
        { name: 'Q', lon: 16.6146, lat: 49.21, rank: 0 },
      ],
      35,
      { minSeparationM: 25 }
    );
    expect([...anchors.values()].sort()).toEqual(['M', 'Q']);
  });
});
