import { describe, it, expect } from 'vitest';
import { shortestWalk } from '../shortestWalk';
import { snapToGraph } from '../snapToGraph';
import type { CampusGraph } from '../../../types/campusMap';

// 0 --100m-- 1 --100m-- 3    the long way round, always open
//  \                   /
//   -50m- 2 --50m-----       the short way, gated as "garden"
const graph: CampusGraph = {
  nodes: [
    [16.6, 49.21],
    [16.6, 49.2109],
    [16.6009, 49.21],
    [16.6009, 49.2109],
  ],
  edges: [
    [0, 1, 100],
    [1, 3, 100],
    [0, 2, 50, 'garden'],
    [2, 3, 50, 'garden'],
  ],
  buildings: { Q: [3] },
};

const open = () => true;
const shut = () => false;

describe('shortestWalk', () => {
  it('takes the short gated way when the gate is open', () => {
    const from = snapToGraph(graph, [16.6, 49.21])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, open)!;
    expect(walk.lengthM).toBeCloseTo(100, 0);
  });

  it('takes the long way when the gate is shut, rather than giving up', () => {
    const from = snapToGraph(graph, [16.6, 49.21])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, shut)!;
    expect(walk.lengthM).toBeCloseTo(200, 0);
  });

  it('never threads a shut gate through the middle of a journey', () => {
    const from = snapToGraph(graph, [16.6, 49.21])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, shut)!;
    // Node 2 is reachable only over garden edges, so it must not appear.
    expect(walk.coords.map((c) => c.join(','))).not.toContain('16.6009,49.21');
  });

  it('starts the polyline at the snapped point, not at a node', () => {
    const from = snapToGraph(graph, [16.60002, 49.2104])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, open)!;
    expect(walk.coords[0]).toEqual(from.point);
  });

  it('ends the polyline at the target node', () => {
    const from = snapToGraph(graph, [16.6, 49.21])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, open)!;
    expect(walk.coords[walk.coords.length - 1]).toEqual(graph.nodes[3]);
  });

  it('picks the nearer of several target nodes', () => {
    const many = { ...graph, buildings: { Q: [1, 3] } };
    const from = snapToGraph(many, [16.6, 49.21])!;
    const walk = shortestWalk(many, from, many.buildings.Q, shut)!;
    expect(walk.lengthM).toBeCloseTo(100, 0); // node 1, not node 3
  });

  it('returns null when the target cannot be reached at all', () => {
    const island: CampusGraph = {
      nodes: [...graph.nodes, [16.7, 49.3]],
      edges: graph.edges,
      buildings: { Z: [4] },
    };
    const from = snapToGraph(island, [16.6, 49.21])!;
    expect(shortestWalk(island, from, island.buildings.Z, open)).toBeNull();
  });

  it('returns null for an empty target list rather than an empty walk', () => {
    const from = snapToGraph(graph, [16.6, 49.21])!;
    expect(shortestWalk(graph, from, [], open)).toBeNull();
  });

  it('refuses to start from a stretch that is currently shut', () => {
    // Snapped onto a garden edge while the garden is shut: you are not
    // standing somewhere you are allowed to walk from.
    const from = snapToGraph(graph, [16.60045, 49.21])!;
    expect(from.gateId).toBe('garden');
    expect(shortestWalk(graph, from, graph.buildings.Q, shut)).toBeNull();
  });

  it('reports the garden when the chosen path went through it', () => {
    const from = snapToGraph(graph, [16.6, 49.21])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, open)!;
    expect(walk.gates).toEqual(['garden']);
  });

  it('reports no gates when the chosen path avoided them', () => {
    const from = snapToGraph(graph, [16.6, 49.21])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, shut)!;
    expect(walk.gates).toEqual([]);
  });

  it('counts the gate of the edge it STARTED on', () => {
    // Standing inside the garden and walking out of it still went through it.
    const from = snapToGraph(graph, [16.60045, 49.21])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, open)!;
    expect(walk.gates).toContain('garden');
  });

  it('includes the walk from the snapped point to the first node in the total', () => {
    // Snapped a quarter of the way along edge 0-1, heading for node 3 the long
    // way: 75 m to node 1, then 100 m on. Not 100.
    const from = snapToGraph(graph, [16.6, 49.210675])!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, shut)!;
    expect(walk.lengthM).toBeGreaterThan(120);
    expect(walk.lengthM).toBeLessThan(130);
  });
});
