import { describe, it, expect } from 'vitest';
import { snapToGraph, edgeLength, edgeGate } from '../snapToGraph';
import type { CampusGraph } from '../../../types/campusMap';

// An L: node 0 -> 1 runs north, node 1 -> 2 runs east.
const graph: CampusGraph = {
  nodes: [
    [16.6, 49.21],
    [16.6, 49.2101],
    [16.6002, 49.2101],
  ],
  edges: [
    [0, 1, 11.1],
    [1, 2, 14.6, 'garden'],
  ],
  buildings: { Q: [2] },
};

describe('edge accessors', () => {
  it('reads the length off the third element', () => {
    expect(edgeLength(graph.edges[0])).toBe(11.1);
    expect(edgeLength(graph.edges[1])).toBe(14.6);
  });

  it('reads the gate off the fourth, and null when there is none', () => {
    expect(edgeGate(graph.edges[0])).toBe(null);
    expect(edgeGate(graph.edges[1])).toBe('garden');
  });
});

describe('snapToGraph', () => {
  it('lands on the nearest edge, not merely the nearest node', () => {
    // Beside the midpoint of edge 0-1. The nearest NODE is a toss-up; the
    // nearest point on the network is unambiguous, and that is where a walk
    // actually starts.
    const s = snapToGraph(graph, [16.60003, 49.21005]);
    expect(s).not.toBeNull();
    expect([s!.a, s!.b].sort()).toEqual([0, 1]);
    expect(s!.distanceM).toBeLessThan(5);
  });

  it('splits the edge length between the two ends', () => {
    const s = snapToGraph(graph, [16.6, 49.21005])!;
    expect(s.toA + s.toB).toBeCloseTo(edgeLength(graph.edges[0]), 5);
    expect(s.toA).toBeGreaterThan(0);
    expect(s.toB).toBeGreaterThan(0);
  });

  it('carries the gate of the edge it landed on', () => {
    const s = snapToGraph(graph, [16.6001, 49.21012])!;
    expect(s.gateId).toBe('garden');
  });

  it('reports no gate when it landed on open ground', () => {
    const s = snapToGraph(graph, [16.59998, 49.21005])!;
    expect(s.gateId).toBeNull();
  });

  it('returns null beyond the cutoff, rather than inventing a start', () => {
    // Prague. A student there gets an honest nothing, not a route from the
    // main gate of a campus 200 km away.
    expect(snapToGraph(graph, [14.42, 50.08])).toBeNull();
  });

  it('honours a caller-supplied cutoff', () => {
    // 0.0025 degrees of latitude north of the far node: 276 m, just outside
    // the default 250 m and comfortably inside a 2 km one.
    expect(snapToGraph(graph, [16.6, 49.2126], 250)).toBeNull();
    expect(snapToGraph(graph, [16.6, 49.2126], 2000)).not.toBeNull();
  });

  it('returns null for an empty graph instead of throwing', () => {
    expect(snapToGraph({ nodes: [], edges: [], buildings: {} }, [16.6, 49.21])).toBeNull();
  });

  it('snaps a point already on a node to that node, with a zero offset', () => {
    const s = snapToGraph(graph, [16.6, 49.21])!;
    expect(s.distanceM).toBeCloseTo(0, 6);
    expect(s.toA).toBeCloseTo(0, 6);
  });
});
