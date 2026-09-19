import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { corridorWays } from '../remoteCorridor.mjs';
// @ts-expect-error - plain .mjs build helper, no types
import { buildGraph } from '../pathGraph.mjs';

const GATE: [number, number] = [16.614543, 49.21122];

describe('corridorWays', () => {
  it('rewrites the vertex at the gate to the graph node exactly, so the two networks join', () => {
    // The curated corridor is committed at 6 decimals; the OSM node it starts
    // at has more. Left alone the two differ at nodeKey's 7th decimal and the
    // corridor hangs off the campus as its own island.
    const osmNode: [number, number] = [16.6145432, 49.2112203];
    const ways = corridorWays([[GATE, [16.6146, 49.2115]]], osmNode, 2);
    expect(ways[0].coords[0]).toEqual(osmNode);
    const g = buildGraph([{ coords: [osmNode, [16.6144, 49.211]] }, ...ways]);
    // one node, not two, where the corridor meets the campus
    expect(g.adj.get('16.6145432,49.2112203')!.size).toBe(2);
  });

  it('leaves every other vertex untouched', () => {
    const osmNode: [number, number] = [16.6145432, 49.2112203];
    const rest: [number, number][] = [
      [16.6146, 49.2115],
      [16.6147, 49.2118],
    ];
    const ways = corridorWays([[GATE, ...rest]], osmNode, 2);
    expect(ways[0].coords.slice(1)).toEqual(rest);
  });

  it('attaches only the ONE vertex nearest the anchor', () => {
    const osmNode: [number, number] = [16.6145432, 49.2112203];
    const ways = corridorWays([[GATE, [16.61455, 49.21123]]], osmNode, 2);
    expect(ways[0].coords[1]).toEqual([16.61455, 49.21123]);
  });

  it('refuses a corridor that does not actually start at the anchor', () => {
    // 200 m away is not "the path from this gate" — joining it would invent a
    // connection, which is the one thing this pipeline never does.
    expect(() =>
      corridorWays(
        [
          [
            [16.617, 49.2125],
            [16.618, 49.213],
          ],
        ],
        [16.614543, 49.21122],
        2
      )
    ).toThrow(/corridor/i);
  });

  it('refuses a corridor whose only match is in the MIDDLE of a stroke', () => {
    // A stroke merely passing the gate is not a corridor that starts there.
    // Rewriting its interior vertex would splice the campus into the side of a
    // path and attach both halves of it.
    const passingBy: [number, number][] = [[16.6143, 49.2114], GATE, [16.6147, 49.2111]];
    expect(() => corridorWays([passingBy], [16.614543, 49.21122], 2)).toThrow(/corridor/i);
  });

  it('keeps each committed path as its own way', () => {
    const ways = corridorWays(
      [
        [GATE, [16.6146, 49.2115]],
        [
          [16.6146, 49.2115],
          [16.6147, 49.2118],
        ],
      ],
      [16.614543, 49.21122],
      2
    );
    expect(ways).toHaveLength(2);
  });
});
