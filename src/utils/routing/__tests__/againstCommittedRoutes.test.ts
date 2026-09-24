import { describe, it, expect } from 'vitest';
import campusPaths from '../../../data/map/campusPaths.json';
import type { CampusGraph, CampusEntrance, CampusPath } from '../../../types/campusMap';
import { snapToGraph } from '../snapToGraph';
import { shortestWalk } from '../shortestWalk';

/**
 * The router, run against the real committed graph and checked against the
 * routes the BUILD computed independently.
 *
 * The unit tests above run on four-node fixtures, which cannot catch a whole
 * class of mistake: a unit error, an edge split the wrong way, a gate tagged
 * onto the wrong stretch. Those only show up as "the number is subtly wrong",
 * and the only thing that can say so is a second, independent computation of
 * the same walk. `routes` in campusPaths.json is exactly that — Dijkstra run
 * at build time over the un-flattened graph.
 */
const data = campusPaths as unknown as {
  graph: CampusGraph;
  entrances: CampusEntrance[];
  routes: CampusPath[];
};
const { graph, entrances, routes } = data;
const alwaysOpen = () => true;

describe('the router against the committed routes', () => {
  it.each(entrances.map((e) => e.name))('reproduces every walk from %s', (name) => {
    const entrance = entrances.find((e) => e.name === name)!;
    const snap = snapToGraph(graph, [entrance.lon, entrance.lat], 30);
    expect(snap).not.toBeNull();

    for (const route of routes.filter((r) => r.from === name)) {
      const walk = shortestWalk(graph, snap!, graph.buildings[route.to]!, alwaysOpen);
      expect(walk, `${name} → ${route.to} should be routable`).not.toBeNull();
      // Within 1 m. Not exact: the build snaps a place to one node, while the
      // router snaps a coordinate to the nearest point on an edge, and the
      // entrance's committed lon/lat is rounded to 6 dp on the way out.
      expect(
        Math.abs(walk!.lengthM - route.lengthM),
        `${name} → ${route.to}: router ${walk!.lengthM.toFixed(1)} m vs build ${route.lengthM.toFixed(1)} m`
      ).toBeLessThan(1);
    }
  });

  it('finds the garden route from the Gen. Píky gate shorter than going round', () => {
    const gate = entrances.find((e) => e.name === 'Brána u FRRMS')!;
    const snap = snapToGraph(graph, [gate.lon, gate.lat], 30)!;
    const through = shortestWalk(graph, snap, graph.buildings.Q!, alwaysOpen);
    const around = shortestWalk(graph, snap, graph.buildings.Q!, () => false);
    // With the garden shut the gate is cut off entirely — it opens onto the
    // garden and nothing else. That is the honest answer, and the reason the
    // card has to say so rather than drawing a line.
    expect(through).not.toBeNull();
    expect(around).toBeNull();
  });

  it('routes from the middle of the campus without detouring to a gate', () => {
    // Between B and M, which is the case precomputed routes can never answer
    // and the entire reason the graph exists.
    const snap = snapToGraph(graph, [16.6155, 49.2106])!;
    const walk = shortestWalk(graph, snap, graph.buildings.Q!, alwaysOpen)!;
    expect(walk.lengthM).toBeLessThan(400);
    expect(walk.coords[0]).toEqual(snap.point);
  });
});
