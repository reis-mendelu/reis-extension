import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { buildGraph, snapAnchors } from '../pathGraph.mjs';
// @ts-expect-error - plain .mjs build helper, no types
import { networkStrokes, walksFrom } from '../pathWalks.mjs';

describe('walksFrom', () => {
  const line = (lons: number[], lat = 49.21) => lons.map((lon) => [lon, lat] as [number, number]);

  it('walks from a gate all the way to a building, THROUGH whatever is between', () => {
    // The change this encodes: a walk is a journey someone makes, so it does
    // not stop at the first named thing it passes. "How long from the gate to
    // Q" is the question; "how long is this bit of path" is not.
    const g = buildGraph([{ coords: line([16.614, 16.615, 16.616]) }]);
    const gates = snapAnchors(g, [{ name: 'Hlavní brána', lon: 16.614, lat: 49.21 }], 35);
    const halls = snapAnchors(
      g,
      [
        { name: 'X', lon: 16.615, lat: 49.21 },
        { name: 'Q', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    const walks = walksFrom(g, gates, halls);
    expect(walks.map((w) => `${w.from}>${w.to}`).sort()).toEqual([
      'Hlavní brána>Q',
      'Hlavní brána>X',
    ]);
    const toQ = walks.find((w) => w.to === 'Q')!;
    expect(toQ.coords).toHaveLength(3); // ran straight past X, not stopped at it
    expect(toQ.lengthM).toBeGreaterThan(140);
  });

  it('gives every gate its own set of walks', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615, 16.616]) }]);
    const gates = snapAnchors(
      g,
      [
        { name: 'Brána A', lon: 16.614, lat: 49.21 },
        { name: 'Brána B', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    const halls = snapAnchors(g, [{ name: 'X', lon: 16.615, lat: 49.21 }], 35);
    expect(
      walksFrom(g, gates, halls)
        .map((w) => w.from)
        .sort()
    ).toEqual(['Brána A', 'Brána B']);
  });

  it('says nothing about a building the network cannot reach', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }, { coords: line([16.617, 16.618]) }]);
    const gates = snapAnchors(g, [{ name: 'Brána', lon: 16.614, lat: 49.21 }], 35);
    const halls = snapAnchors(g, [{ name: 'Z', lon: 16.618, lat: 49.21 }], 35);
    expect(walksFrom(g, gates, halls)).toHaveLength(0);
  });

  it('never walks a gate to itself', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615]) }]);
    const both = snapAnchors(g, [{ name: 'Brána', lon: 16.614, lat: 49.21 }], 35);
    expect(walksFrom(g, both, both)).toHaveLength(0);
  });

  it('is deterministic', () => {
    const g = buildGraph([{ coords: line([16.614, 16.615, 16.616]) }]);
    const gates = snapAnchors(g, [{ name: 'Brána', lon: 16.614, lat: 49.21 }], 35);
    const halls = snapAnchors(
      g,
      [
        { name: 'X', lon: 16.615, lat: 49.21 },
        { name: 'Q', lon: 16.616, lat: 49.21 },
      ],
      35
    );
    expect(JSON.stringify(walksFrom(g, gates, halls))).toBe(
      JSON.stringify(walksFrom(g, gates, halls))
    );
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
