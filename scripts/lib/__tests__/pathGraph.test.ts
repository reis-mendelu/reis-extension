import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { buildGraph, snapAnchors } from '../pathGraph.mjs';

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
