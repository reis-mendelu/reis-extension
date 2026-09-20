import { describe, it, expect } from 'vitest';
import campusPaths from '../campusPaths.json';
import type { CampusGraph } from '../../../types/campusMap';

const graph = (campusPaths as unknown as { graph: CampusGraph }).graph;

/** Undirected adjacency, honouring a gate filter. */
function adjacency(open: (gate: string | null) => boolean) {
  const adj = new Map<number, number[]>();
  for (const e of graph.edges) {
    const gate = e.length > 3 ? (e[3] as string) : null;
    if (!open(gate)) continue;
    const a = e[0] as number;
    const b = e[1] as number;
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  return adj;
}

function reachableFrom(start: number, adj: Map<number, number[]>) {
  const seen = new Set<number>([start]);
  const stack = [start];
  while (stack.length) {
    for (const n of adj.get(stack.pop()!) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen;
}

describe('the committed campus graph', () => {
  it('has every edge index inside the node array', () => {
    for (const e of graph.edges) {
      expect(e[0]).toBeGreaterThanOrEqual(0);
      expect(e[0] as number).toBeLessThan(graph.nodes.length);
      expect(e[1]).toBeGreaterThanOrEqual(0);
      expect(e[1] as number).toBeLessThan(graph.nodes.length);
    }
  });

  it('stores each node as a [lon, lat] pair at 6 dp', () => {
    for (const n of graph.nodes) {
      expect(n).toHaveLength(2);
      // Brno, in [lon, lat] order. A transposed pair would sail through every
      // other check here and put the whole campus in the Indian Ocean.
      expect(n[0]).toBeGreaterThan(16);
      expect(n[0]).toBeLessThan(17);
      expect(n[1]).toBeGreaterThan(49);
      expect(n[1]).toBeLessThan(50);
    }
  });

  it('has no self-edges and no duplicate pairs', () => {
    const seen = new Set<string>();
    for (const e of graph.edges) {
      expect(e[0]).not.toBe(e[1]);
      // Normalised, because the contract is UNDIRECTED: 1-2 and 2-1 are the
      // same edge, and a key that tells them apart would pass a file
      // containing both.
      const a = e[0] as number;
      const b = e[1] as number;
      const pair = a < b ? `${a}-${b}` : `${b}-${a}`;
      expect(seen.has(pair)).toBe(false);
      seen.add(pair);
    }
  });

  it('gives every edge a positive length', () => {
    for (const e of graph.edges) {
      expect(e[2]).toBeGreaterThan(0);
      expect(Number.isFinite(e[2] as number)).toBe(true);
    }
  });

  it('uses only gate ids the runtime knows about', () => {
    const gates = new Set(graph.edges.filter((e) => e.length > 3).map((e) => e[3]));
    expect([...gates]).toEqual(['garden']);
  });

  it('names every campus building', () => {
    expect(Object.keys(graph.buildings).sort()).toEqual(['A', 'B', 'C', 'E', 'M', 'Q', 'X']);
    for (const nodes of Object.values(graph.buildings)) expect(nodes.length).toBeGreaterThan(0);
  });

  it('connects every building to every other with the garden open', () => {
    // A disconnected graph is the failure this feature would otherwise ship in
    // silence: the route simply never appears, and nothing says why.
    const seen = reachableFrom(
      graph.buildings.A![0]!,
      adjacency(() => true)
    );
    for (const [name, nodes] of Object.entries(graph.buildings)) {
      expect(`${name}:${nodes.some((n) => seen.has(n))}`).toBe(`${name}:true`);
    }
  });

  it('still connects every building to every other with the garden SHUT', () => {
    // The campus must not depend on the garden to hold itself together. If it
    // did, every route would vanish at 20:00 and at weekends.
    const seen = reachableFrom(
      graph.buildings.A![0]!,
      adjacency((gate) => gate === null)
    );
    for (const [name, nodes] of Object.entries(graph.buildings)) {
      expect(`${name}:${nodes.some((n) => seen.has(n))}`).toBe(`${name}:true`);
    }
  });
});
