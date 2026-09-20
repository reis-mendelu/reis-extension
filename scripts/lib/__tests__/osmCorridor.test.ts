import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { joinAtAnchor } from '../osmCorridor.mjs';
// @ts-expect-error - plain .mjs build helper, no types
import { buildGraph } from '../pathGraph.mjs';

// The real hazard, at the real scale: a curated gate and OSM's node for the
// same gate, two centimetres and one nodeKey apart.
const CURATED: [number, number] = [16.614899, 49.215931];
const OSM_SAME_GATE: [number, number] = [16.6148992, 49.2159308];

describe('joinAtAnchor', () => {
  it('rewrites EVERY vertex at the anchor, not just one', () => {
    // Three ways meeting at OSM's version of the gate. Rewriting one would
    // move it onto the curated node and detach it from the other two.
    const ways: [number, number][][] = [
      [OSM_SAME_GATE, [16.6149, 49.2162]],
      [OSM_SAME_GATE, [16.6152, 49.2159]],
      [OSM_SAME_GATE, [16.6145, 49.2158]],
    ];
    const out = joinAtAnchor(ways, CURATED, 1);
    for (const w of out) expect(w.coords[0]).toEqual(CURATED);
  });

  it('leaves the corridor connected to itself once joined', () => {
    const ways: [number, number][][] = [
      [OSM_SAME_GATE, [16.6149, 49.2162]],
      [OSM_SAME_GATE, [16.6152, 49.2159]],
    ];
    // Plus the curated path arriving at the gate from the other side.
    const curatedPath = { coords: [[16.6145, 49.2155], CURATED] as [number, number][] };
    const graph = buildGraph([...joinAtAnchor(ways, CURATED, 1), curatedPath]);

    const start = '16.6149000,49.2162000';
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length) {
      for (const n of graph.adj.get(stack.pop()!)?.keys() ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    // Everything, including the far end of the curated path.
    expect(seen.size).toBe(graph.nodes.size);
  });

  it('leaves vertices outside the tolerance untouched', () => {
    const far: [number, number] = [16.62, 49.22];
    const out = joinAtAnchor([[OSM_SAME_GATE, far]], CURATED, 1);
    expect(out[0].coords[1]).toEqual(far);
  });

  it('refuses a corridor with nothing near its anchor, rather than stretching', () => {
    expect(() => joinAtAnchor([[[16.7, 49.3], [16.71, 49.31]]], CURATED, 1)).toThrow(
      /does not reach the place it claims/
    );
  });

  it('says how far off it actually was, so the box can be fixed', () => {
    expect(() => joinAtAnchor([[[16.615, 49.216]], [[16.62, 49.22]]], CURATED, 0.5)).toThrow(
      /nearest \d+\.\d m/
    );
  });
});
