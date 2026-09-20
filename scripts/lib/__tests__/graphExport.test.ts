import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { buildGraph } from '../pathGraph.mjs';
// @ts-expect-error - plain .mjs build helper, no types
import { exportGraph } from '../graphExport.mjs';

// Three points in a line, 0.0001 degrees of latitude (~11 m) apart.
const A: [number, number] = [16.6, 49.21];
const B: [number, number] = [16.6, 49.2101];
const C: [number, number] = [16.6, 49.2102];

describe('exportGraph', () => {
  it('emits every node once and every edge once', () => {
    const graph = buildGraph([{ coords: [A, B, C] }]);
    const out = exportGraph(graph, new Map(), () => null);

    expect(out.nodes).toHaveLength(3);
    expect(out.edges).toHaveLength(2);
    // Undirected: the pair appears once, not once per direction.
    const pairs = out.edges.map((e: number[]) => [e[0], e[1]].sort().join('-'));
    expect(new Set(pairs).size).toBe(2);
  });

  it('rounds coordinates to 6 dp, like every other geometry in the file', () => {
    const graph = buildGraph([{ coords: [[16.61234567, 49.2123456789], B] }]);
    const out = exportGraph(graph, new Map(), () => null);
    for (const [lon, lat] of out.nodes) {
      expect(String(lon).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
      expect(String(lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
    }
  });

  it('carries the edge length in metres as the third element', () => {
    const graph = buildGraph([{ coords: [A, B] }]);
    const out = exportGraph(graph, new Map(), () => null);
    expect(out.edges[0][2]).toBeGreaterThan(10);
    expect(out.edges[0][2]).toBeLessThan(12);
  });

  it('tags a gated edge with its id, and leaves an ungated edge at length 3', () => {
    const graph = buildGraph([{ coords: [A, B, C] }]);
    const keys: string[] = [...graph.nodes.keys()];
    // Gate only the stretch between the first two nodes.
    const gated = new Set([keys[0], keys[1]]);
    const gateOf = (k1: string, k2: string) =>
      gated.has(k1) && gated.has(k2) ? 'garden' : null;

    const out = exportGraph(graph, new Map(), gateOf);
    const withGate = out.edges.filter((e: unknown[]) => e.length === 4);
    expect(withGate).toHaveLength(1);
    expect(withGate[0][3]).toBe('garden');
    expect(out.edges.filter((e: unknown[]) => e.length === 3)).toHaveLength(1);
  });

  it('maps each building name to the node indices that count as arriving', () => {
    const graph = buildGraph([{ coords: [A, B, C] }]);
    const keys: string[] = [...graph.nodes.keys()];
    const out = exportGraph(graph, new Map([[keys[2], 'Q']]), () => null);
    expect(out.buildings.Q).toEqual([2]);
  });

  it('is deterministic, so the committed JSON does not churn between runs', () => {
    const graph = buildGraph([{ coords: [A, B, C] }]);
    const a = exportGraph(graph, new Map(), () => null);
    const b = exportGraph(graph, new Map(), () => null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
