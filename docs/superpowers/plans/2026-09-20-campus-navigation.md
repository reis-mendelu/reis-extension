# Campus Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tap once and the map draws the walk from your GPS position to the room your next lesson is in — through the botanical garden when it is open, ending at the building rather than at the campus gate.

**Architecture:** The build pipeline gains a fourth output key, an explicit `graph` of nodes and edges, because the shipped `network` strokes are deduplicated rendering geometry from which adjacency cannot be recovered. A new pure-TypeScript routing module snaps an arbitrary coordinate onto that graph and runs Dijkstra over it, skipping edges whose gate is currently shut. Two new off-campus corridors (FRRMS, JAK dorms) join the campus graph at declared anchors, generalising what the arboretum corridor already does. Capacitor supplies one position fix per tap; everything else is offline and bundled.

**Tech Stack:** WXT, React 19, TypeScript (strict), Zustand, IndexedDB, Tailwind 4 + DaisyUI 5, Vitest 5 + happy-dom, Leaflet, Capacitor 8, `@capacitor/geolocation` (new), Overpass (build-time only).

**Spec:** `docs/superpowers/specs/2026-09-20-campus-navigation-design.md`

## Global Constraints

- **NO `localStorage`/`sessionStorage`** — persist via `IndexedDBService` only.
- **NO custom CSS** — DaisyUI semantic classes only. The standing exception is Leaflet-generated DOM, styled by class in `src/index.css`.
- **NO `useEffect` for data fetching** — fetch in the slice/api, not components.
- **NO proxy/re-export barrels** — import directly from implementation files.
- **NO generic state** — all state lives in Zustand slices.
- **Max 200 lines per file** — split if larger.
- **Test first** — write the failing test before implementation, always.
- **`buildingId === 0` is a REAL building (Q).** Never use truthiness to mean "no building selected"; use `=== null`.
- **Geometry is `[lon, lat]` everywhere**, matching every existing file in `src/data/map/`. The single exception is the dev `?at=` override, which takes `lat,lon` because a human pastes it from Google Maps, and transposes once at that boundary.
- **Language codes are `'cz'`/`'en'`.** `'cs'` is a BCP-47 locale and appears only at an `Intl` boundary.
- **Errors** route through `logError('Context.method', err)` — a local `console.error` only. Never pass payload data as `extra`. Contexts here: `Routing.snap`, `Routing.walk`, `RouteSlice.locate`.
- **Walking pace is `WALK_M_PER_MIN = 100`** (`src/utils/walkTime.ts`), already shipped. Do not change it in this work.
- **Parsers are off-limits.** Nothing in this plan touches `src/api/documents/parser.ts`, `src/api/cvicneTests.ts` or `src/utils/parsers/`.
- **Build-time scripts under `scripts/` do not ship.** Their JSON output is committed instead.

---

### Task 1: Emit the routing graph from the build pipeline

The largest and least visible piece. Nothing user-facing changes; every later task depends on this file shape.

**Files:**
- Create: `scripts/lib/graphExport.mjs`
- Create: `scripts/lib/__tests__/graphExport.test.ts`
- Modify: `scripts/fetch-campus-paths.mjs` (add the `graph` key to the written JSON)
- Modify: `src/types/campusMap.ts` (add `CampusGraph`)
- Modify: `src/data/map/campusPaths.json` (regenerated output — committed)
- Test: `src/data/map/__tests__/campusGraph.test.ts`

**Interfaces:**
- Consumes: `buildGraph(ways)` from `scripts/lib/pathGraph.mjs`, returning `{ nodes: Map<string,[number,number]>, adj: Map<string, Map<string, number>> }`; `splitAnchors(...)` from `scripts/lib/campusPlaces.mjs`, returning `{ entranceNodes, buildingNodes }` as `Map<nodeKey, placeName>`.
- Produces: `exportGraph(graph, buildingNodes, gateOf) => { nodes, edges, buildings }`, and the `CampusGraph` type consumed by every later task.

- [ ] **Step 1: Write the failing test for `exportGraph`**

Create `scripts/lib/__tests__/graphExport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGraph } from '../pathGraph.mjs';
import { exportGraph } from '../graphExport.mjs';

// Three points in a line, ~11 m apart in latitude.
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
    const pairs = out.edges.map((e) => [e[0], e[1]].sort().join('-'));
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
    // 0.0001 degrees of latitude is ~11 m.
    expect(out.edges[0][2]).toBeGreaterThan(10);
    expect(out.edges[0][2]).toBeLessThan(12);
  });

  it('tags an edge with its gate id, and leaves ungated edges at length 3', () => {
    const graph = buildGraph([{ coords: [A, B, C] }]);
    // Gate only the A-B stretch.
    const gateOf = (k1: string, k2: string) =>
      [k1, k2].every((k) => k.startsWith('16.6000000,49.210')) &&
      [k1, k2].some((k) => k.endsWith('49.2100000'))
        ? 'garden'
        : null;
    const out = exportGraph(graph, new Map(), gateOf);
    const gated = out.edges.filter((e) => e.length === 4);
    expect(gated).toHaveLength(1);
    expect(gated[0][3]).toBe('garden');
  });

  it('maps each building name to the node indices that count as arriving', () => {
    const graph = buildGraph([{ coords: [A, B, C] }]);
    const keys = [...graph.nodes.keys()];
    const out = exportGraph(graph, new Map([[keys[2], 'Q']]), () => null);
    expect(out.buildings.Q).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/lib/__tests__/graphExport.test.ts`
Expected: FAIL — `Failed to resolve import "../graphExport.mjs"`.

- [ ] **Step 3: Write `exportGraph`**

Create `scripts/lib/graphExport.mjs`:

```js
/**
 * The campus graph, flattened into something the app can ship.
 *
 * `buildGraph` produces Maps keyed by a 7-decimal coordinate string, which is
 * the right shape for the build and the wrong shape for a 30 KB JSON file that
 * every phone parses at startup. Here it becomes two arrays: deduplicated
 * coordinates, and edges that name their endpoints by index.
 *
 * Index pairs rather than repeated coordinates because the coordinate list is
 * the bulk of the file, and an edge naming its endpoints by value would double
 * it. `lengthM` is precomputed so the runtime never does trigonometry per edge
 * inside a Dijkstra loop.
 *
 * Build-time only — the output JSON is committed, so none of this ships.
 */

const round = (v) => Number(v.toFixed(6)); // ~0.1 m, matching the rest of the file

/**
 * @param {{nodes: Map<string,[number,number]>, adj: Map<string, Map<string, number>>}} graph
 * @param {Map<string,string>} buildingNodes  node key → building name
 * @param {(a: string, b: string) => string | null} gateOf  which gate, if any, controls this edge
 * @returns {{nodes: number[][], edges: (number|string)[][], buildings: Record<string, number[]>}}
 */
export function exportGraph(graph, buildingNodes, gateOf) {
  const index = new Map();
  const nodes = [];
  for (const [key, coord] of graph.nodes) {
    index.set(key, nodes.length);
    nodes.push([round(coord[0]), round(coord[1])]);
  }

  const edges = [];
  const seen = new Set();
  for (const [from, neighbours] of graph.adj) {
    for (const [to, lengthM] of neighbours) {
      // Undirected: emit the pair once. Sorting the indices rather than the
      // keys keeps the committed order stable across runs.
      const a = index.get(from);
      const b = index.get(to);
      const pair = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(pair)) continue;
      seen.add(pair);
      const gate = gateOf(from, to);
      const edge = [Math.min(a, b), Math.max(a, b), Number(lengthM.toFixed(1))];
      edges.push(gate ? [...edge, gate] : edge);
    }
  }
  edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]); // deterministic JSON

  const buildings = {};
  for (const [key, name] of buildingNodes) {
    (buildings[name] ??= []).push(index.get(key));
  }
  for (const name of Object.keys(buildings)) buildings[name].sort((a, b) => a - b);

  return { nodes, edges, buildings };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run scripts/lib/__tests__/graphExport.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add the `CampusGraph` type**

In `src/types/campusMap.ts`, directly above the existing `CampusPath` interface:

```ts
// The walking network as a graph, for routing from an arbitrary point.
//
// `routes` answers "walk from this gate to that building" and is what the
// entrance fan draws. It cannot answer "walk from where I am standing", which
// needs adjacency — and adjacency cannot be recovered from `network`, whose
// strokes are deduplicated RENDERING geometry. So the graph is emitted
// explicitly at build time (scripts/lib/graphExport.mjs) rather than derived
// here from something that was never meant to carry it.
export interface CampusGraph {
  /** [lon, lat] per node, 6 dp — the same rounding as every other geometry. */
  nodes: number[][];
  /**
   * `[fromIndex, toIndex, lengthM]`, or `[fromIndex, toIndex, lengthM, gateId]`
   * when the edge is only walkable while something is open. Undirected; each
   * pair appears once.
   *
   * Typed as `(number | string)[][]` rather than as a union of tuples for the
   * reason `CampusPath.coords` gives: this comes straight out of a JSON import,
   * whose inferred element type is not a tuple, and asserting one needs a cast
   * through `unknown` that buys nothing the shape tests do not already check.
   * Read it through `edgeLength` / `edgeGate`, never by index at a call site.
   */
  edges: (number | string)[][];
  /** Building letter → the node indices that count as having arrived there. */
  buildings: Record<string, number[]>;
}
```

- [ ] **Step 6: Wire `exportGraph` into the fetch script**

In `scripts/fetch-campus-paths.mjs`, add the import beside the others:

```js
import { exportGraph } from './lib/graphExport.mjs';
```

Find where the output object is assembled and written (the `writeFileSync` near the end, which currently writes `source`, `entrances`, `network`, `routes`). Add a `graph` key. The gate predicate marks every edge that came from the garden corridor — the corridor ways are already a distinct array in that script, so build a key set from them first:

```js
// Every node key that the garden corridor contributed. An edge is "garden" when
// BOTH its ends came from the corridor — an edge with one end on the campus is
// the join at the gate itself, which is public ground and always walkable.
const gardenKeys = new Set();
for (const way of gardenWays) for (const c of way.coords) gardenKeys.add(nodeKey(c));
const gateOf = (a, b) => (gardenKeys.has(a) && gardenKeys.has(b) ? 'garden' : null);

const graph = exportGraph(finalGraph, buildingNodes, gateOf);
```

Use the existing variable names from that file for `gardenWays`, `finalGraph` and `buildingNodes` — read the file rather than assuming these spellings; the two-pass structure names them locally. Import `nodeKey` from `./lib/pathGeo.mjs` if it is not already imported.

Then include `graph` in the written object, after `routes`.

- [ ] **Step 7: Regenerate the committed data**

Run: `node scripts/fetch-campus-paths.mjs`
Expected: the script's own summary line (`N entrances × M buildings → K walks`) is unchanged from before — **7 entrances × 7 buildings → 49 walks**. If that line changed, the graph work has altered the campus routes as a side effect; stop and find out why before continuing.

Verify the diff touches only the new key:

```bash
git diff --stat src/data/map/campusPaths.json
node -e "const d=require('./src/data/map/campusPaths.json');console.log('routes',d.routes.length,'network',d.network.length,'entrances',d.entrances.length,'nodes',d.graph.nodes.length,'edges',d.graph.edges.length,'buildings',Object.keys(d.graph.buildings))"
```

Expected: `routes 49 network 13 entrances 7`, a non-zero node and edge count, and `buildings` listing exactly `A B C E M Q X`.

- [ ] **Step 8: Write the shape test on the committed graph**

Create `src/data/map/__tests__/campusGraph.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import campusPaths from '../campusPaths.json';
import type { CampusGraph } from '../../../types/campusMap';

const graph = (campusPaths as unknown as { graph: CampusGraph }).graph;

describe('the committed campus graph', () => {
  it('has every edge index inside the node array', () => {
    for (const e of graph.edges) {
      expect(e[0]).toBeGreaterThanOrEqual(0);
      expect(e[0]).toBeLessThan(graph.nodes.length);
      expect(e[1]).toBeLessThan(graph.nodes.length);
    }
  });

  it('has no self-edges and no duplicate pairs', () => {
    const seen = new Set<string>();
    for (const e of graph.edges) {
      expect(e[0]).not.toBe(e[1]);
      const pair = `${e[0]}-${e[1]}`;
      expect(seen.has(pair)).toBe(false);
      seen.add(pair);
    }
  });

  it('names every campus building', () => {
    expect(Object.keys(graph.buildings).sort()).toEqual(['A', 'B', 'C', 'E', 'M', 'Q', 'X']);
    for (const nodes of Object.values(graph.buildings)) expect(nodes.length).toBeGreaterThan(0);
  });

  it('is connected enough that every building reaches every other', () => {
    // A disconnected graph is the failure this feature would otherwise ship
    // in silence: a route simply never appears, and nothing says why.
    const adj = new Map<number, number[]>();
    for (const e of graph.edges) {
      const [a, b] = [e[0] as number, e[1] as number];
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    }
    const start = graph.buildings.A[0];
    const seen = new Set<number>([start]);
    const queue = [start];
    while (queue.length) {
      for (const n of adj.get(queue.pop()!) ?? []) {
        if (!seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    for (const [name, nodes] of Object.entries(graph.buildings)) {
      expect(nodes.some((n) => seen.has(n))).toBe(true);
      expect(name).toBeTruthy();
    }
  });
});
```

- [ ] **Step 9: Run it**

Run: `npx vitest run src/data/map/__tests__/campusGraph.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/graphExport.mjs scripts/lib/__tests__/graphExport.test.ts \
        scripts/fetch-campus-paths.mjs src/types/campusMap.ts \
        src/data/map/campusPaths.json src/data/map/__tests__/campusGraph.test.ts
git commit -m "feat(map): emit an explicit routing graph from the path pipeline

Routing from an arbitrary GPS fix needs adjacency, and adjacency cannot be
recovered from the shipped network strokes: those are deduplicated rendering
geometry, so rebuilding which stroke touches which would mean matching
coordinates by proximity — the 7th-decimal failure remoteCorridor refuses.

So the graph is emitted rather than derived. Nodes deduplicated, edges naming
their endpoints by index with the length precomputed, and a gateId on the
edges that are only walkable while something is open.

No user-visible change; routes, network and entrances are byte-identical."
```

---

### Task 2: Runtime geometry helpers

`scripts/lib/pathGeo.mjs` is build-time and does not ship. The runtime needs the same arithmetic, and the two must agree on what a metre is.

**Files:**
- Create: `src/utils/routing/geo.ts`
- Test: `src/utils/routing/__tests__/geo.test.ts`

**Interfaces:**
- Produces: `metres(a: [number, number], b: [number, number]): number`, `nearestOnSegment(p, a, b): { point: [number, number]; t: number; distanceM: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/routing/__tests__/geo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { metres, nearestOnSegment } from '../geo';

const A: [number, number] = [16.6, 49.21];
const B: [number, number] = [16.6, 49.2101];

describe('metres', () => {
  it('measures 0.0001 degrees of latitude as about 11 m', () => {
    expect(metres(A, B)).toBeGreaterThan(10.5);
    expect(metres(A, B)).toBeLessThan(11.5);
  });

  it('agrees with the build pipeline, which uses the same flat-earth constants', () => {
    // 110540 m per degree of latitude — the value in scripts/lib/pathGeo.mjs.
    expect(metres([16.6, 49.0], [16.6, 50.0])).toBeCloseTo(110540, 0);
  });

  it('is zero for a point against itself', () => {
    expect(metres(A, A)).toBe(0);
  });
});

describe('nearestOnSegment', () => {
  it('finds the perpendicular foot when it falls inside the segment', () => {
    const r = nearestOnSegment([16.60005, 49.21005], A, B);
    expect(r.t).toBeGreaterThan(0.4);
    expect(r.t).toBeLessThan(0.6);
    expect(r.distanceM).toBeGreaterThan(0);
  });

  it('clamps to the near end when the foot falls beyond the segment', () => {
    const r = nearestOnSegment([16.6, 49.209], A, B);
    expect(r.t).toBe(0);
    expect(r.point).toEqual(A);
  });

  it('clamps to the far end likewise', () => {
    const r = nearestOnSegment([16.6, 49.2105], A, B);
    expect(r.t).toBe(1);
    expect(r.point).toEqual(B);
  });

  it('handles a degenerate zero-length segment without dividing by zero', () => {
    const r = nearestOnSegment([16.6, 49.2105], A, A);
    expect(Number.isFinite(r.distanceM)).toBe(true);
    expect(r.t).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/routing/__tests__/geo.test.ts`
Expected: FAIL — cannot resolve `../geo`.

- [ ] **Step 3: Implement**

Create `src/utils/routing/geo.ts`:

```ts
/**
 * The flat-earth arithmetic the runtime router uses.
 *
 * A deliberate duplicate of `scripts/lib/pathGeo.mjs`, which is build-time and
 * does not ship. The constants are repeated rather than shared because the two
 * live on opposite sides of the bundle boundary, and the tests below pin them
 * to the same values so the router and the pipeline cannot drift apart on what
 * a metre is.
 *
 * A campus is 400 m across and the longest route here is under 2 km, so an
 * equirectangular approximation is exact enough; a great-circle formula would
 * be noise inside a Dijkstra loop.
 */

const R_LAT_M = 110540;
const lonScale = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

export function metres(a: [number, number], b: [number, number]): number {
  return Math.hypot((b[0] - a[0]) * lonScale(a[1]), (b[1] - a[1]) * R_LAT_M);
}

export interface NearestPoint {
  point: [number, number];
  /** Where along a→b the foot lands: 0 at a, 1 at b. */
  t: number;
  distanceM: number;
}

/**
 * The point on segment a→b nearest to p, clamped to the segment.
 *
 * Projected in metres rather than in degrees: a degree of longitude is 0.65 of
 * a degree of latitude at this cosine, so projecting in raw degrees would put
 * the foot in the wrong place on any segment that is not axis-aligned.
 */
export function nearestOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): NearestPoint {
  const s = lonScale(a[1]);
  const ax = 0;
  const ay = 0;
  const bx = (b[0] - a[0]) * s;
  const by = (b[1] - a[1]) * R_LAT_M;
  const px = (p[0] - a[0]) * s;
  const py = (p[1] - a[1]) * R_LAT_M;

  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  // A zero-length segment is a repeated vertex, not a direction. Clamp to a
  // rather than dividing by zero and returning NaN into a shortest-path search.
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  const point: [number, number] =
    t === 0 ? a : t === 1 ? b : [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, t, distanceM: metres(p, point) };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/utils/routing/__tests__/geo.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/routing/geo.ts src/utils/routing/__tests__/geo.test.ts
git commit -m "feat(routing): flat-earth geometry for the runtime router

A deliberate duplicate of the build pipeline's pathGeo, which does not ship.
The tests pin both to the same constants so the router and the pipeline
cannot drift on what a metre is."
```

---

### Task 3: Snap an arbitrary coordinate onto the graph

**Files:**
- Create: `src/utils/routing/snapToGraph.ts`
- Test: `src/utils/routing/__tests__/snapToGraph.test.ts`

**Interfaces:**
- Consumes: `metres`, `nearestOnSegment` from `src/utils/routing/geo.ts`; `CampusGraph` from `src/types/campusMap.ts`.
- Produces:

```ts
export interface Snap {
  point: [number, number];
  distanceM: number;
  a: number;      // node index at one end of the edge
  b: number;      // node index at the other
  toA: number;    // metres from `point` to node a, along the edge
  toB: number;    // metres from `point` to node b, along the edge
  gateId: string | null;
}
export function snapToGraph(graph: CampusGraph, at: [number, number], maxM?: number): Snap | null;
export function edgeLength(edge: (number | string)[]): number;
export function edgeGate(edge: (number | string)[]): string | null;
```

- [ ] **Step 1: Write the failing test**

Create `src/utils/routing/__tests__/snapToGraph.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { snapToGraph, edgeLength, edgeGate } from '../snapToGraph';
import type { CampusGraph } from '../../../types/campusMap';

// Two segments in an L: node 0 -> 1 north, node 1 -> 2 east.
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
  });

  it('reads the gate off the fourth, and null when there is none', () => {
    expect(edgeGate(graph.edges[0])).toBe(null);
    expect(edgeGate(graph.edges[1])).toBe('garden');
  });
});

describe('snapToGraph', () => {
  it('lands on the nearest edge, not merely the nearest node', () => {
    // Beside the midpoint of edge 0-1. The nearest NODE is a toss-up; the
    // nearest point on the network is unambiguous, and that is what a walk
    // starts from.
    const s = snapToGraph(graph, [16.60003, 49.21005]);
    expect(s).not.toBeNull();
    expect([s!.a, s!.b].sort()).toEqual([0, 1]);
    expect(s!.distanceM).toBeLessThan(5);
  });

  it('splits the edge length between the two ends', () => {
    const s = snapToGraph(graph, [16.6, 49.21005])!;
    expect(s.toA + s.toB).toBeCloseTo(edgeLength(graph.edges[0]), 1);
    expect(s.toA).toBeGreaterThan(0);
    expect(s.toB).toBeGreaterThan(0);
  });

  it('carries the gate of the edge it landed on', () => {
    const s = snapToGraph(graph, [16.6001, 49.2101])!;
    expect(s.gateId).toBe('garden');
  });

  it('returns null beyond the cutoff, rather than inventing a start', () => {
    // Prague. A student there gets an honest nothing, not a route from the
    // main gate.
    expect(snapToGraph(graph, [14.42, 50.08])).toBeNull();
  });

  it('honours a caller-supplied cutoff', () => {
    expect(snapToGraph(graph, [16.6, 49.2115], 250)).toBeNull();
    expect(snapToGraph(graph, [16.6, 49.2115], 2000)).not.toBeNull();
  });

  it('returns null for an empty graph instead of throwing', () => {
    expect(snapToGraph({ nodes: [], edges: [], buildings: {} }, [16.6, 49.21])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/routing/__tests__/snapToGraph.test.ts`
Expected: FAIL — cannot resolve `../snapToGraph`.

- [ ] **Step 3: Implement**

Create `src/utils/routing/snapToGraph.ts`:

```ts
import type { CampusGraph } from '../../types/campusMap';
import { metres, nearestOnSegment } from './geo';

/** The length of an edge, in metres. Always the third element. */
export function edgeLength(edge: (number | string)[]): number {
  return edge[2] as number;
}

/** Which gate controls this edge, or null when it is always walkable. */
export function edgeGate(edge: (number | string)[]): string | null {
  return edge.length > 3 ? (edge[3] as string) : null;
}

export interface Snap {
  /** The point on the network the walk actually starts from. */
  point: [number, number];
  /** How far the query point was from the network. */
  distanceM: number;
  a: number;
  b: number;
  /** Metres from `point` to node `a` along the edge. */
  toA: number;
  /** Metres from `point` to node `b` along the edge. */
  toB: number;
  gateId: string | null;
}

/**
 * Where on the walking network a given position sits.
 *
 * Nearest EDGE, not nearest node. A student standing halfway along a path is
 * nearest to a point with no node on it, and snapping them to whichever end
 * happened to be closer would add up to half an edge of phantom walking in
 * whichever direction the graph's vertices happened to fall.
 *
 * `maxM` is how far off the network a position may be and still be routed
 * from. Beyond it the answer is `null` — "you are not near the campus" is a
 * real answer, and inventing a start at the main gate for someone in Prague is
 * not.
 */
export function snapToGraph(
  graph: CampusGraph,
  at: [number, number],
  maxM = 250
): Snap | null {
  let best: Snap | null = null;
  for (const edge of graph.edges) {
    const a = edge[0] as number;
    const b = edge[1] as number;
    const na = graph.nodes[a] as [number, number];
    const nb = graph.nodes[b] as [number, number];
    const near = nearestOnSegment(at, na, nb);
    if (best && near.distanceM >= best.distanceM) continue;
    const len = edgeLength(edge);
    best = {
      point: near.point,
      distanceM: near.distanceM,
      a,
      b,
      // Split by `t` rather than re-measuring: the committed length is what
      // every other cost in the search is denominated in, and re-measuring
      // here would make the two halves not add up to it.
      toA: len * near.t,
      toB: len * (1 - near.t),
      gateId: edgeGate(edge),
    };
  }
  return best && best.distanceM <= maxM ? best : null;
}
```

Note the unused-import risk: `metres` is imported but only used if you add a guard. Remove it from the import if ESLint flags it.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/utils/routing/__tests__/snapToGraph.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Lint**

Run: `npx eslint src/utils/routing/`
Expected: clean. If `metres` is reported unused, delete it from the import.

- [ ] **Step 6: Commit**

```bash
git add src/utils/routing/snapToGraph.ts src/utils/routing/__tests__/snapToGraph.test.ts
git commit -m "feat(routing): snap a position onto the nearest edge of the network

Nearest edge, not nearest node: a student halfway along a path is nearest to
a point with no node on it, and snapping to whichever end is closer adds up
to half an edge of phantom walking.

Beyond the cutoff the answer is null. 'You are not near the campus' is a real
answer; a route from the main gate for someone in Prague is not."
```

---

### Task 4: Shortest walk, skipping shut gates

**Files:**
- Create: `src/utils/routing/shortestWalk.ts`
- Test: `src/utils/routing/__tests__/shortestWalk.test.ts`

**Interfaces:**
- Consumes: `Snap`, `edgeLength`, `edgeGate` from `./snapToGraph`; `CampusGraph`.
- Produces:

```ts
export interface Walk { coords: number[][]; lengthM: number; }
export function shortestWalk(
  graph: CampusGraph,
  from: Snap,
  targets: number[],
  isOpen: (gateId: string) => boolean
): Walk | null;
```

- [ ] **Step 1: Write the failing test**

Create `src/utils/routing/__tests__/shortestWalk.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shortestWalk } from '../shortestWalk';
import { snapToGraph } from '../snapToGraph';
import type { CampusGraph } from '../../../types/campusMap';

// 0 --100m-- 1 --100m-- 3   (the long way round, always open)
//  \                   /
//   --50m-- 2 --50m----     (the short way, gated as "garden")
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
const at = (lon: number, lat: number): [number, number] => [lon, lat];

describe('shortestWalk', () => {
  it('takes the short gated way when the gate is open', () => {
    const from = snapToGraph(graph, at(16.6, 49.21))!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, open)!;
    expect(walk.lengthM).toBeCloseTo(100, 0);
  });

  it('takes the long way when the gate is shut, rather than returning nothing', () => {
    const from = snapToGraph(graph, at(16.6, 49.21))!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, shut)!;
    expect(walk.lengthM).toBeCloseTo(200, 0);
  });

  it('never routes THROUGH a shut gate as an intermediate leg', () => {
    const from = snapToGraph(graph, at(16.6, 49.21))!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, shut)!;
    // Node 2 is reachable only over garden edges.
    const visited = walk.coords.map((c) => `${c[0]},${c[1]}`);
    expect(visited).not.toContain('16.6009,49.21');
  });

  it('returns a polyline that starts at the snapped point, not at a node', () => {
    const from = snapToGraph(graph, at(16.60002, 49.2104))!;
    const walk = shortestWalk(graph, from, graph.buildings.Q, open)!;
    expect(walk.coords[0]).toEqual(from.point);
  });

  it('picks the nearer of several target nodes', () => {
    const many = { ...graph, buildings: { Q: [1, 3] } };
    const from = snapToGraph(many, at(16.6, 49.21))!;
    const walk = shortestWalk(many, from, many.buildings.Q, shut)!;
    expect(walk.lengthM).toBeCloseTo(100, 0); // node 1, not node 3
  });

  it('returns null when the target cannot be reached at all', () => {
    const island: CampusGraph = {
      nodes: [...graph.nodes, [16.7, 49.3]],
      edges: graph.edges,
      buildings: { Z: [4] },
    };
    const from = snapToGraph(island, at(16.6, 49.21))!;
    expect(shortestWalk(island, from, island.buildings.Z, open)).toBeNull();
  });

  it('returns null for an empty target list rather than an empty walk', () => {
    const from = snapToGraph(graph, at(16.6, 49.21))!;
    expect(shortestWalk(graph, from, [], open)).toBeNull();
  });

  it('refuses to start across a shut gate', () => {
    // Snapped onto a garden edge while the garden is shut: you are not
    // standing somewhere you may walk from.
    const from = snapToGraph(graph, at(16.60045, 49.21))!;
    expect(from.gateId).toBe('garden');
    expect(shortestWalk(graph, from, graph.buildings.Q, shut)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/routing/__tests__/shortestWalk.test.ts`
Expected: FAIL — cannot resolve `../shortestWalk`.

- [ ] **Step 3: Implement**

Create `src/utils/routing/shortestWalk.ts`:

```ts
import type { CampusGraph } from '../../types/campusMap';
import { edgeGate, edgeLength, type Snap } from './snapToGraph';

export interface Walk {
  /** [lon, lat] from the snapped start to the arrival node. */
  coords: number[][];
  lengthM: number;
}

/**
 * The shortest walk from a snapped position to any one of several target nodes.
 *
 * Multi-target because a building is a set of door nodes, not a point: asking
 * for "the" node would pick a door on the wrong side of the building as often
 * as not.
 *
 * `isOpen` is what stops the router recommending a walk nobody can take. The
 * garden shuts at 20:00 and all weekend, and greying the card afterwards is not
 * enough — left to itself the search returns the garden route at 21:00 on a
 * Saturday, and worse, threads the garden through the middle of an unrelated
 * journey. Availability is a property of the graph, so it is applied here,
 * where the path is chosen, and the card only has to explain the answer.
 */
export function shortestWalk(
  graph: CampusGraph,
  from: Snap,
  targets: number[],
  isOpen: (gateId: string) => boolean
): Walk | null {
  if (targets.length === 0) return null;
  // Standing on a shut edge is not a place you may walk from.
  if (from.gateId && !isOpen(from.gateId)) return null;

  const walkable = (edge: (number | string)[]) => {
    const gate = edgeGate(edge);
    return gate === null || isOpen(gate);
  };

  const adj = new Map<number, { to: number; len: number }[]>();
  for (const edge of graph.edges) {
    if (!walkable(edge)) continue;
    const a = edge[0] as number;
    const b = edge[1] as number;
    const len = edgeLength(edge);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, len });
    (adj.get(b) ?? adj.set(b, []).get(b)!).push({ to: a, len });
  }

  const goal = new Set(targets);
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  // Two seeds: the walk may leave the snapped point in either direction along
  // the edge it landed on.
  dist.set(from.a, from.toA);
  dist.set(from.b, from.toB);

  // A binary heap is not worth it at this size — the campus graph is a few
  // thousand edges and this runs once per tap, not per frame.
  const queue: number[] = [from.a, from.b];
  const done = new Set<number>();
  let arrived: number | null = null;

  while (queue.length) {
    let bestI = 0;
    for (let i = 1; i < queue.length; i++) {
      if ((dist.get(queue[i]) ?? Infinity) < (dist.get(queue[bestI]) ?? Infinity)) bestI = i;
    }
    const u = queue.splice(bestI, 1)[0];
    if (done.has(u)) continue;
    done.add(u);
    if (goal.has(u)) { arrived = u; break; }
    for (const { to, len } of adj.get(u) ?? []) {
      if (done.has(to)) continue;
      const nd = (dist.get(u) ?? Infinity) + len;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, u);
        queue.push(to);
      }
    }
  }

  if (arrived === null) return null;

  const back: number[] = [arrived];
  while (prev.has(back[back.length - 1])) back.push(prev.get(back[back.length - 1])!);
  const nodes = back.reverse();
  return {
    coords: [from.point, ...nodes.map((n) => graph.nodes[n])],
    lengthM: dist.get(arrived)!,
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/utils/routing/__tests__/shortestWalk.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Check the file length**

Run: `wc -l src/utils/routing/shortestWalk.ts`
Expected: under 200. If it is over, split the adjacency build into `src/utils/routing/adjacency.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/routing/shortestWalk.ts src/utils/routing/__tests__/shortestWalk.test.ts
git commit -m "feat(routing): shortest walk that refuses a shut gate

Availability is a property of the graph, not of the card. Greying a route
card is not enough: left alone the search returns the garden route at 21:00
on a Saturday, and threads the garden through the middle of unrelated
journeys. isOpen is applied where the path is chosen."
```

---

### Task 5: When the garden is open

**Files:**
- Create: `src/utils/routing/gateHours.ts`
- Test: `src/utils/routing/__tests__/gateHours.test.ts`

**Interfaces:**
- Produces: `isGateOpen(gateId: string, now: Date): boolean`, and `GARDEN_HOURS` for the copy layer.

- [ ] **Step 1: Write the failing test**

Create `src/utils/routing/__tests__/gateHours.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isGateOpen } from '../gateHours';

// 2026-09-21 is a Monday; 2026-09-26 a Saturday; 2026-09-27 a Sunday.
const on = (iso: string) => new Date(iso);

describe('isGateOpen("garden")', () => {
  it('is open across the whole teaching day on a weekday', () => {
    expect(isGateOpen('garden', on('2026-09-21T06:00:00'))).toBe(true);
    expect(isGateOpen('garden', on('2026-09-21T12:00:00'))).toBe(true);
    expect(isGateOpen('garden', on('2026-09-21T19:59:00'))).toBe(true);
  });

  it('is shut before six and from eight', () => {
    expect(isGateOpen('garden', on('2026-09-21T05:59:00'))).toBe(false);
    expect(isGateOpen('garden', on('2026-09-21T20:00:00'))).toBe(false);
    expect(isGateOpen('garden', on('2026-09-21T23:30:00'))).toBe(false);
  });

  it('is shut at weekends whatever the hour', () => {
    expect(isGateOpen('garden', on('2026-09-26T12:00:00'))).toBe(false);
    expect(isGateOpen('garden', on('2026-09-27T12:00:00'))).toBe(false);
  });

  it('treats an unknown gate as open, because a gate nobody modelled is a path', () => {
    expect(isGateOpen('turnstile-that-does-not-exist', on('2026-09-27T23:00:00'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/routing/__tests__/gateHours.test.ts`
Expected: FAIL — cannot resolve `../gateHours`.

- [ ] **Step 3: Implement**

Create `src/utils/routing/gateHours.ts`:

```ts
/**
 * When the gated stretches of the walking network are actually walkable.
 *
 * There is exactly one gate today. The mechanism is general because the cost of
 * making it general was one string.
 */

/**
 * The botanical garden, as a MENDELU student experiences it: ISIC on the
 * reader, weekdays 06:00–20:00, free.
 *
 * This is NOT the visitor tariff published on arboretum.mendelu.cz, which says
 * Mon–Fri 07:00–15:00, closed weekends, 150 Kč, and describes the paying public
 * entering through the main building. Routing by the published hours would shut
 * the shortcut five hours early — across most of the afternoon teaching block —
 * for students who can in fact walk through. If someone "corrects" these
 * numbers against the website, they have read the wrong regime.
 */
export const GARDEN_HOURS = { fromHour: 6, toHour: 20, weekdaysOnly: true } as const;

export function isGateOpen(gateId: string, now: Date): boolean {
  // A gate nobody has modelled is not a locked gate — it is a path. Defaulting
  // to shut would silently delete parts of the network on a typo.
  if (gateId !== 'garden') return true;
  const day = now.getDay(); // 0 Sun … 6 Sat
  if (day === 0 || day === 6) return false;
  const hour = now.getHours();
  return hour >= GARDEN_HOURS.fromHour && hour < GARDEN_HOURS.toHour;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/utils/routing/__tests__/gateHours.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/routing/gateHours.ts src/utils/routing/__tests__/gateHours.test.ts
git commit -m "feat(routing): the garden's student hours, not its visitor tariff

ISIC on the reader, weekdays 06:00-20:00. The published 07:00-15:00 is the
paying public entering through the main building; routing by it would shut
the shortcut five hours early, across most of the afternoon teaching block.
Said in the comment so nobody 'corrects' it against the website."
```

---

### Task 6: The dev position override

The user asked for this by name. It is what makes every later task testable without standing outside.

**Files:**
- Create: `src/utils/routing/devPosition.ts`
- Test: `src/utils/routing/__tests__/devPosition.test.ts`

**Interfaces:**
- Produces: `devForcedPosition(): [number, number] | null` — `[lon, lat]`, converted from the `lat,lon` the query string carries.

- [ ] **Step 1: Write the failing test**

Create `src/utils/routing/__tests__/devPosition.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { devForcedPosition } from '../devPosition';

const setSearch = (search: string) => {
  vi.stubGlobal('window', { location: { search } } as unknown as Window);
};
afterEach(() => vi.unstubAllGlobals());

describe('devForcedPosition', () => {
  it('reads lat,lon from the query string and returns [lon, lat]', () => {
    // FRRMS. Typed the way a human copies it out of Google Maps.
    setSearch('?at=49.218161,16.614118');
    expect(devForcedPosition()).toEqual([16.614118, 49.218161]);
  });

  it('tolerates whitespace around the comma', () => {
    setSearch('?at=49.218161, 16.614118');
    expect(devForcedPosition()).toEqual([16.614118, 49.218161]);
  });

  it('is null when the parameter is absent', () => {
    setSearch('?native=ios');
    expect(devForcedPosition()).toBeNull();
  });

  it('is null for a malformed value rather than NaN into the router', () => {
    setSearch('?at=banana');
    expect(devForcedPosition()).toBeNull();
    setSearch('?at=49.21');
    expect(devForcedPosition()).toBeNull();
  });

  it('rejects a transposed pair, which is the mistake this format invites', () => {
    // 16.61 is not a latitude anywhere near Brno; 49.21 is not a longitude.
    // Refusing beats silently routing from the Indian Ocean.
    setSearch('?at=16.614118,49.218161');
    expect(devForcedPosition()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/routing/__tests__/devPosition.test.ts`
Expected: FAIL — cannot resolve `../devPosition`.

- [ ] **Step 3: Implement**

Create `src/utils/routing/devPosition.ts`:

```ts
/**
 * `?at=<lat>,<lon>` on the dev webapp, and nothing anywhere else.
 *
 * `import.meta.env.DEV` dead-code-strips this out of every shipped build,
 * exactly as `devForcedPlatform` does for the Profil map row.
 *
 * Without it, verifying a route means walking to the JAK dormitories with a
 * laptop. With it, every position in the design — JAK, FRRMS, mid-campus, two
 * kilometres away — is one URL.
 *
 * `lat,lon` ORDER, deliberately against this codebase's `[lon, lat]`
 * convention: the value gets pasted straight out of Google Maps by a human, so
 * it takes the order a human copies, and transposes once here at the boundary.
 * The same reasoning as `'cz'` against the `'cs'` locale — convert where the
 * outside world meets the app, not everywhere inside it.
 */

// Brno is near 49.2 N, 16.6 E. A pair that cannot be a Brno lat/lon in that
// order is almost certainly transposed, and routing from the resulting point
// in the Indian Ocean would waste an afternoon.
const PLAUSIBLE_LAT = (v: number) => v > 48 && v < 51;
const PLAUSIBLE_LON = (v: number) => v > 12 && v < 19;

export function devForcedPosition(): [number, number] | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('at');
  if (!raw) return null;
  const parts = raw.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lat, lon] = parts;
  if (!PLAUSIBLE_LAT(lat) || !PLAUSIBLE_LON(lon)) return null;
  return [lon, lat];
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/utils/routing/__tests__/devPosition.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Confirm it is stripped from a production build**

```bash
npm run build
grep -r "PLAUSIBLE_LAT\|?at=" .output/ | head
```

Expected: no matches. If the identifier survives, the `import.meta.env.DEV` guard is not at the top of the function and the bundler could not eliminate it.

- [ ] **Step 6: Commit**

```bash
git add src/utils/routing/devPosition.ts src/utils/routing/__tests__/devPosition.test.ts
git commit -m "feat(routing): dev-only ?at=<lat>,<lon> position override

Verifying a route otherwise means walking to the JAK dormitories with a
laptop. lat,lon order because the value is pasted out of Google Maps;
transposed once here, and refused outright when the pair cannot be a Brno
coordinate in that order."
```

---

### Task 7: The route slice

**Files:**
- Create: `src/store/slices/createRouteSlice.ts`
- Modify: `src/store/types.ts` (add `RouteSlice` to `AppState`)
- Modify: `src/store/useAppStore.ts` (compose the slice)
- Test: `src/store/slices/__tests__/createRouteSlice.test.ts`

**Interfaces:**
- Consumes: `snapToGraph`, `shortestWalk`, `isGateOpen`, `devForcedPosition`; `CampusGraph` from the committed JSON.
- Produces: store fields `routeFrom`, `routeWalk`, `routeStatus`, `routeTargetBuilding`; actions `routeTo(buildingName: string)`, `clearRoute()`.

```ts
export type RouteStatus =
  | 'idle' | 'locating' | 'ready'
  | 'denied' | 'unavailable' | 'too-far' | 'no-route';

export interface RouteSlice {
  routeFrom: [number, number] | null;
  routeWalk: Walk | null;
  routeStatus: RouteStatus;
  routeTargetBuilding: string | null;
  routeTo: (buildingName: string) => Promise<void>;
  clearRoute: () => void;
}
```

- [ ] **Step 1: Write the failing test**

Create `src/store/slices/__tests__/createRouteSlice.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../useAppStore';

const currentPosition = vi.fn();
vi.mock('../../../utils/routing/position', () => ({
  currentPosition: (...args: unknown[]) => currentPosition(...args),
}));

describe('createRouteSlice', () => {
  beforeEach(() => {
    currentPosition.mockReset();
    useAppStore.getState().clearRoute();
  });

  it('starts idle with nothing drawn', () => {
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('idle');
    expect(s.routeWalk).toBeNull();
  });

  it('routes from a position on campus to a building', async () => {
    // The main gate.
    currentPosition.mockResolvedValue([16.617241, 49.210133]);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('ready');
    expect(s.routeTargetBuilding).toBe('Q');
    expect(s.routeWalk!.lengthM).toBeGreaterThan(0);
    expect(s.routeWalk!.coords.length).toBeGreaterThan(1);
  });

  it('reports too-far rather than inventing a start', async () => {
    currentPosition.mockResolvedValue([14.42, 50.08]); // Prague
    await useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('too-far');
    expect(useAppStore.getState().routeWalk).toBeNull();
  });

  it('reports denied when the fix cannot be had', async () => {
    currentPosition.mockRejectedValue(new Error('User denied Geolocation'));
    await useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('denied');
  });

  it('reports no-route for a building the graph does not name', async () => {
    currentPosition.mockResolvedValue([16.617241, 49.210133]);
    await useAppStore.getState().routeTo('Z');
    expect(useAppStore.getState().routeStatus).toBe('no-route');
  });

  it('clears back to idle', async () => {
    currentPosition.mockResolvedValue([16.617241, 49.210133]);
    await useAppStore.getState().routeTo('Q');
    useAppStore.getState().clearRoute();
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('idle');
    expect(s.routeWalk).toBeNull();
    expect(s.routeTargetBuilding).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/store/slices/__tests__/createRouteSlice.test.ts`
Expected: FAIL — `routeTo is not a function`.

- [ ] **Step 3: Write the position source**

Create `src/utils/routing/position.ts`:

```ts
import { Geolocation } from '@capacitor/geolocation';
import { getPlatform } from '../../platform';
import { devForcedPosition } from './devPosition';

/**
 * One position fix, as `[lon, lat]`.
 *
 * `getCurrentPosition`, never `watchPosition`: the plugin's own documentation
 * warns that watching "can consume a large amount of energy", and a route drawn
 * on screen does not need re-deriving while you walk along looking at it.
 *
 * Capacitor only. On the web the app is a chrome-extension:// iframe inside
 * is.mendelu.cz, where geolocation needs `allow="geolocation"` on the iframe
 * element; a student at a desk has no use for a blue dot anyway, so the whole
 * question is sidestepped rather than answered.
 */
export async function currentPosition(): Promise<[number, number]> {
  const forced = devForcedPosition();
  if (forced) return forced;
  if (getPlatform().kind !== 'capacitor') throw new Error('geolocation: not a native platform');
  const fix = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
  return [fix.coords.longitude, fix.coords.latitude];
}
```

Install the dependency first:

```bash
npm install @capacitor/geolocation@^8
npx cap sync
```

- [ ] **Step 4: Write the slice**

Create `src/store/slices/createRouteSlice.ts`:

```ts
import campusPaths from '../../data/map/campusPaths.json';
import type { AppSlice } from '../types';
import type { CampusGraph } from '../../types/campusMap';
import { snapToGraph } from '../../utils/routing/snapToGraph';
import { shortestWalk, type Walk } from '../../utils/routing/shortestWalk';
import { isGateOpen } from '../../utils/routing/gateHours';
import { currentPosition } from '../../utils/routing/position';
import { logError } from '../../utils/reportError';

const GRAPH = (campusPaths as unknown as { graph: CampusGraph }).graph;

export type RouteStatus =
  | 'idle'
  | 'locating'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'too-far'
  | 'no-route';

export interface RouteSlice {
  routeFrom: [number, number] | null;
  routeWalk: Walk | null;
  routeStatus: RouteStatus;
  routeTargetBuilding: string | null;
  routeTo: (buildingName: string) => Promise<void>;
  clearRoute: () => void;
}

export const createRouteSlice: AppSlice<RouteSlice> = (set) => ({
  routeFrom: null,
  routeWalk: null,
  routeStatus: 'idle',
  routeTargetBuilding: null,

  routeTo: async (buildingName) => {
    set({ routeStatus: 'locating', routeTargetBuilding: buildingName, routeWalk: null });
    let at: [number, number];
    try {
      at = await currentPosition();
    } catch (err) {
      logError('RouteSlice.locate', err);
      // A denied permission and an unavailable platform are different answers
      // to the student: one is "you said no", the other is "not here".
      const native = String((err as Error)?.message ?? '').includes('not a native platform');
      set({ routeStatus: native ? 'unavailable' : 'denied' });
      return;
    }

    const snap = snapToGraph(GRAPH, at);
    if (!snap) {
      set({ routeFrom: at, routeStatus: 'too-far' });
      return;
    }
    const targets = GRAPH.buildings[buildingName] ?? [];
    const now = new Date();
    const walk = shortestWalk(GRAPH, snap, targets, (gate) => isGateOpen(gate, now));
    if (!walk) {
      set({ routeFrom: at, routeStatus: 'no-route' });
      return;
    }
    set({ routeFrom: at, routeWalk: walk, routeStatus: 'ready' });
  },

  clearRoute: () =>
    set({ routeFrom: null, routeWalk: null, routeStatus: 'idle', routeTargetBuilding: null }),
});
```

- [ ] **Step 5: Register the slice**

In `src/store/types.ts`, add `RouteSlice` to the `AppState` intersection alongside the other slice types, and import it from `./slices/createRouteSlice`.

In `src/store/useAppStore.ts`, add the import beside the others and spread it into the composed store exactly as the neighbouring slices are spread:

```ts
import { createRouteSlice } from './slices/createRouteSlice';
// …
  ...createRouteSlice(set, get, api),
```

Match the surrounding call signature — read the file; the existing slices show whether the third argument is passed.

- [ ] **Step 6: Run the test and watch it pass**

Run: `npx vitest run src/store/slices/__tests__/createRouteSlice.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/createRouteSlice.ts src/store/slices/__tests__/createRouteSlice.test.ts \
        src/store/types.ts src/store/useAppStore.ts src/utils/routing/position.ts \
        package.json package-lock.json
git commit -m "feat(routing): route slice, one position fix per tap

getCurrentPosition rather than watchPosition: the plugin warns that watching
costs a large amount of energy, and a route on screen does not need
re-deriving while you walk along looking at it.

Denied and unavailable are different answers — 'you said no' is not 'not
here' — and too-far is a real answer rather than a route invented from the
main gate."
```

---

### Task 8: Draw the route

**Files:**
- Create: `src/components/CampusMap/routeLayers.ts`
- Modify: `src/components/CampusMap/MapCanvas.tsx` (mount the layer)
- Test: `src/components/CampusMap/__tests__/routeLayers.test.ts`

**Interfaces:**
- Consumes: `Walk` from `src/utils/routing/shortestWalk.ts`.
- Produces: `drawRoute(layer: L.LayerGroup, walk: Walk | null, language: string): void`.

- [ ] **Step 1: Write the failing test**

Create `src/components/CampusMap/__tests__/routeLayers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { drawRoute } from '../routeLayers';

const walk = {
  coords: [
    [16.6, 49.21],
    [16.6, 49.2105],
    [16.6005, 49.2105],
  ],
  lengthM: 640,
};

describe('drawRoute', () => {
  it('draws the line, its halo, a start dot and one time chip', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    // halo + line + start marker + chip
    expect(layer.getLayers()).toHaveLength(4);
  });

  it('labels the walk in minutes at the shipped pace', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    const chip = layer.getLayers().find((l) => l instanceof L.Marker) as L.Marker;
    // 640 m at 100 m/min.
    expect(chip.getTooltip()?.getContent() ?? (chip.options.icon as L.DivIcon).options.html)
      .toContain('6');
  });

  it('empties the layer when there is no walk', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    drawRoute(layer, null, 'cz');
    expect(layer.getLayers()).toHaveLength(0);
  });

  it('redraws rather than accumulating on repeated calls', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    drawRoute(layer, walk, 'cz');
    expect(layer.getLayers()).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/CampusMap/__tests__/routeLayers.test.ts`
Expected: FAIL — cannot resolve `../routeLayers`.

- [ ] **Step 3: Implement**

Create `src/components/CampusMap/routeLayers.ts`. Follow the style of `pathLayers.ts` exactly — fixed colour literals, because the basemap is always light whatever the app theme is, and a white halo under the stroke:

```ts
import L from 'leaflet';
import { translate } from '../../i18n/translate';
import { walkMinutes } from '../../utils/walkTime';
import type { Walk } from '../../utils/routing/shortestWalk';

// The route is the loudest thing on the map while it is shown — it is the
// answer to the question that was asked. The campus network underneath stays
// the quiet dotted trail it already is.
//
// Fixed literals, like every other style on this map: the basemap is always
// light whatever the app theme is (see the note above CATEGORY_STYLE).
const HALO: L.PathOptions = {
  color: '#ffffff',
  weight: 9,
  opacity: 0.95,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
const LINE: L.PathOptions = {
  color: '#2563eb',
  weight: 5,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
const START: L.CircleMarkerOptions = {
  radius: 6,
  color: '#2563eb',
  weight: 3,
  fillColor: '#ffffff',
  fillOpacity: 1,
  interactive: false,
};

/**
 * The walk, redrawn from scratch.
 *
 * Clearing and rebuilding rather than mutating: a route is recomputed once per
 * tap, not per frame, and a layer that accumulates is the bug this shape makes
 * impossible.
 */
export function drawRoute(layer: L.LayerGroup, walk: Walk | null, language: string): void {
  layer.clearLayers();
  if (!walk || walk.coords.length < 2) return;

  const latlngs = walk.coords.map(([lon, lat]) => L.latLng(lat, lon));
  L.polyline(latlngs, HALO).addTo(layer);
  L.polyline(latlngs, LINE).addTo(layer);
  L.circleMarker(latlngs[0], START).addTo(layer);

  const label = translate(language, 'map.walkMinutes', { n: walkMinutes(walk.lengthM) });
  L.marker(latlngs[latlngs.length - 1], {
    interactive: false,
    icon: L.divIcon({ className: 'walk-chip', html: label }),
  }).addTo(layer);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/components/CampusMap/__tests__/routeLayers.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Mount the layer in `MapCanvas`**

Read `MapCanvas.tsx` and find where the other Leaflet layer groups are created and kept across renders. Add a route layer group beside them, and call `drawRoute(routeLayer, routeWalk, language)` whenever `routeWalk` changes — reading `routeWalk` from the store with `useAppStore((s) => s.routeWalk)`.

This is a `useEffect` that reacts to store state and fetches nothing, which the project's rule permits. Do not fetch in it.

- [ ] **Step 6: Commit**

```bash
git add src/components/CampusMap/routeLayers.ts \
        src/components/CampusMap/__tests__/routeLayers.test.ts \
        src/components/CampusMap/MapCanvas.tsx
git commit -m "feat(map): draw the computed route

The loudest thing on the map while it is shown, because it is the answer to
the question that was asked. Clear-and-rebuild rather than mutate: a route is
recomputed once per tap, and a layer that accumulates is the bug this shape
makes impossible."
```

---

### Task 9: The building picker and the route card

**Files:**
- Create: `src/components/CampusMap/RouteCard.tsx`
- Modify: `src/components/mobile/screens/MapScreen.tsx` (render the card)
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json`
- Test: `src/components/CampusMap/__tests__/RouteCard.test.tsx`

**Interfaces:**
- Consumes: `routeStatus`, `routeWalk`, `routeTargetBuilding`, `routeTo`, `clearRoute` from the store.

- [ ] **Step 1: Add the copy**

In `src/i18n/locales/cs.json`, inside the existing `map` object:

```json
"routeTakeMeThere": "Najdi cestu",
"routeLocating": "Hledám, kde jsi…",
"routeDenied": "reIS nemá přístup k poloze. Povol ji v nastavení telefonu, nebo si vyber budovu ručně.",
"routeUnavailable": "Polohu umí jen mobilní aplikace.",
"routeTooFar": "Nejsi v okolí kampusu.",
"routeNoRoute": "Odsud sem cesta nevede.",
"routeThroughGarden": "Přes botanickou zahradu — zdarma s ISIC, u brány z Generála Píky.",
"routeGardenShut": "Zahrada je teď zavřená (po–pá 6:00–20:00). Pěšky to odsud nejde — jeď tramvají 9 nebo 11 z Bieblovy.",
"routePickBuilding": "Kam jdeš?"
```

In `src/i18n/locales/en.json`, the same keys:

```json
"routeTakeMeThere": "Take me there",
"routeLocating": "Finding you…",
"routeDenied": "reIS can't see your location. Allow it in your phone's settings, or pick a building instead.",
"routeUnavailable": "Location works in the mobile app only.",
"routeTooFar": "You're not near the campus.",
"routeNoRoute": "There's no walk from here to there.",
"routeThroughGarden": "Through the botanical garden — free with your ISIC, at the Gen. Píky gate.",
"routeGardenShut": "The garden is closed right now (Mon–Fri 6:00–20:00). There's no walk from here — take tram 9 or 11 from Bieblova.",
"routePickBuilding": "Where are you headed?"
```

- [ ] **Step 2: Write the failing test**

Create `src/components/CampusMap/__tests__/RouteCard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { RouteCard } from '../RouteCard';

const set = (patch: Record<string, unknown>) => useAppStore.setState(patch);

describe('RouteCard', () => {
  beforeEach(() => useAppStore.getState().clearRoute());

  it('shows nothing at all while idle', () => {
    const { container } = render(<RouteCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says it is looking while locating', () => {
    set({ routeStatus: 'locating' });
    render(<RouteCard />);
    expect(screen.getByText(/Hledám|Finding/)).toBeTruthy();
  });

  it('shows the walk time and the destination when ready', () => {
    set({
      routeStatus: 'ready',
      routeTargetBuilding: 'Q',
      routeWalk: { coords: [[16.6, 49.21], [16.6, 49.211]], lengthM: 1326 },
    });
    render(<RouteCard />);
    // 1326 m at 100 m/min.
    expect(screen.getByText(/13/)).toBeTruthy();
    expect(screen.getByText(/Q/)).toBeTruthy();
  });

  it('explains a denied permission instead of failing silently', () => {
    set({ routeStatus: 'denied' });
    render(<RouteCard />);
    expect(screen.getByText(/polo|location/i)).toBeTruthy();
  });

  it('says so plainly when you are not near the campus', () => {
    set({ routeStatus: 'too-far' });
    render(<RouteCard />);
    expect(screen.getByText(/kampusu|near the campus/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/components/CampusMap/__tests__/RouteCard.test.tsx`
Expected: FAIL — cannot resolve `../RouteCard`.

- [ ] **Step 4: Implement `RouteCard`**

Create `src/components/CampusMap/RouteCard.tsx`. DaisyUI semantic classes only — no custom CSS. Render `null` when `routeStatus === 'idle'`. For `ready`, show `walkMinutes(routeWalk.lengthM)` through the `map.walkMinutes` key, the destination letter, and — when the walk's coordinates pass through the garden and the gate is open — the `map.routeThroughGarden` line, because a student who does not know the shortcut is theirs is exactly who this feature is for.

Keep it under 200 lines. If the status-to-copy mapping grows past a handful of branches, lift it into a pure `routeMessage(status, walk)` helper in `src/utils/routing/routeMessage.ts` with its own test.

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run src/components/CampusMap/__tests__/RouteCard.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Render it on the map screen**

In `src/components/mobile/screens/MapScreen.tsx`, render `<RouteCard />` in the floating chrome over the canvas, beside the existing search. Do not nest it inside `MapCanvas` — that would remount Leaflet.

- [ ] **Step 7: Verify it in the browser**

```bash
npm run dev:web
```

Open `http://localhost:3000/?at=49.218161,16.614118`, go to the Mapa tab, pick building Q, and confirm a blue route is drawn from FRRMS with a time chip on the end.

Expected: the walk renders and reads about **13 min** (1,326 m at 100 m/min). If it reads 17, the pace constant has been reverted; if no route draws, check the console for a `Routing.` error.

- [ ] **Step 8: Screenshot at the three widths**

Use the `verify-ui` skill on the Mapa screen at 320 / 390 / 430 px, in both themes, with the route drawn. Confirm the card does not overflow and the chip is legible against the basemap.

- [ ] **Step 9: Commit**

```bash
git add src/components/CampusMap/RouteCard.tsx \
        src/components/CampusMap/__tests__/RouteCard.test.tsx \
        src/components/mobile/screens/MapScreen.tsx \
        src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(map): the route card

Every state the student can reach says something: locating, denied,
unavailable, too far, no route. A button that looks fine and does nothing is
the failure this card exists to prevent.

When the walk goes through the garden it says so, and says the ISIC gets you
in free — a first-year does not know the shortcut is theirs, and that
sentence is the feature."
```

---

### Task 10: The FRRMS corridor

**Files:**
- Modify: `scripts/fetch-campus-paths.mjs` (a second corridor beside the garden one)
- Modify: `scripts/lib/campusPlaces.mjs` (admit off-campus origins to `entranceNodes`)
- Modify: `scripts/lib/__tests__/campusPlaces.test.ts`
- Modify: `src/data/map/campusPaths.json` (regenerated)

**Interfaces:**
- Consumes: `corridorWays(paths, anchor, maxM)` from `scripts/lib/remoteCorridor.mjs`.
- Produces: `RANK.origin`, and `CampusEntrance` entries with `kind: 'other'`.

- [ ] **Step 1: Write the failing test for the new rank**

In `scripts/lib/__tests__/campusPlaces.test.ts`, add:

```ts
it('admits an off-campus origin to the entrances, not to the walk ends', () => {
  const anchors = new Map([
    ['k1', 'FRRMS'],
    ['k2', 'Q'],
  ]);
  const rankByName = new Map([
    ['FRRMS', RANK.origin],
    ['Q', RANK.building],
  ]);
  const { entranceNodes, buildingNodes } = splitAnchors(anchors, rankByName, new Set(['Q']));
  expect([...entranceNodes.values()]).toEqual(['FRRMS']);
  expect([...buildingNodes.values()]).toEqual(['Q']);
});

it('still keeps a landmark out of both, which is why the rank had to be new', () => {
  const anchors = new Map([['k1', 'Koleje JAK Blok A']]);
  const rankByName = new Map([['Koleje JAK Blok A', RANK.building]]);
  const { entranceNodes, buildingNodes } = splitAnchors(anchors, rankByName, new Set());
  expect(entranceNodes.size).toBe(0);
  expect(buildingNodes.size).toBe(0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run scripts/lib/__tests__/campusPlaces.test.ts`
Expected: FAIL — `RANK.origin` is undefined.

- [ ] **Step 3: Add the rank**

In `scripts/lib/campusPlaces.mjs`, extend `RANK` and `KIND_OF_RANK`, and admit the new rank in `splitAnchors`:

```js
// `origin` is an off-campus place a student STARTS from — FRRMS, the JAK
// dormitories. It outranks a stop for a contested node and is admitted to the
// entrances, which landmarks deliberately are not: a landmark carries
// RANK.building so it beats a café for a doorway, and admitting it to the
// entrances would ship it with kind 'building' and give a lettered building a
// pill it must never have. An origin is not a lettered building, so it can.
export const RANK = { building: 0, origin: 1, gate: 2, cafeteria: 3, stop: 4 };
export const KIND_OF_RANK = ['building', 'other', 'gate', 'cafeteria', 'stop'];
```

In `splitAnchors`, add `rank === RANK.origin` to the branch that fills `entranceNodes`.

**Careful:** the numeric values of `gate`, `cafeteria` and `stop` all shift by one. `KIND_OF_RANK` is indexed by rank, so it must shift with them — it is written above already shifted. Anything else that hardcodes a rank number must be found and updated:

```bash
grep -rn "RANK\." scripts/
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run scripts/lib/__tests__/campusPlaces.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the FRRMS corridor to the fetch script**

In `scripts/fetch-campus-paths.mjs`, beside the existing garden corridor block, add a second Overpass extract for the FRRMS approach. Its region is the box containing the FRRMS building (16.614118, 49.218161) and the garden's Gen. Píky gate (16.614899, 49.215931), plus a 60 m margin. Its declared anchor is `Brána u FRRMS`.

Push FRRMS into `campusPlaces` with `RANK.origin`, using the landmark outline already in `landmarks.json` (id 1587) so "near it" means near its wall.

Follow the existing two-pass structure: the corridor can only be pinned once the campus graph exists.

- [ ] **Step 6: Regenerate and check**

Run: `node scripts/fetch-campus-paths.mjs`

```bash
node -e "const d=require('./src/data/map/campusPaths.json');console.log(d.entrances.map(e=>e.kind+':'+e.name).join(' | '));console.log('routes',d.routes.length)"
```

Expected: the entrances now include `other:FRRMS`, and the route count has grown from 49 to 56 (one new origin × 7 buildings). If FRRMS is absent, `snapAnchors` did not place it — the script logs unplaced places loudly; read that output rather than guessing.

- [ ] **Step 7: Verify the route in the browser**

```bash
npm run dev:web
```

Open `http://localhost:3000/?at=49.218161,16.614118`, route to Q, and confirm the drawn walk goes **through the garden** and reads about 13 min.

Then force the gate shut by changing your machine's clock to a Saturday, reload, and confirm the route either goes around or the card says the garden is closed — and that it never draws a line through the garden.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/campusPlaces.mjs scripts/lib/__tests__/campusPlaces.test.ts \
        scripts/fetch-campus-paths.mjs src/data/map/campusPaths.json
git commit -m "feat(map): route in from FRRMS, through the garden

A new RANK.origin admitted to the entrances, which landmarks deliberately are
not: a landmark carries RANK.building so it beats a cafe for a doorway, and
admitting it to the entrances would give a lettered building a pill it must
never have. An origin is not a lettered building, so it can."
```

---

### Task 11: The JAK corridor

**Files:**
- Modify: `scripts/fetch-campus-paths.mjs`
- Modify: `src/data/map/campusPaths.json` (regenerated)

- [ ] **Step 1: Add the corridor**

Same shape as Task 10. Region: the box containing the four JAK blocks (around 16.6300–16.6314, 49.2154–49.2162) and the campus eastern edge, plus a 60 m margin. Declared anchor: `Brána Lesnická`.

The four blocks collapse to **one origin named for the place, not per block** — "Koleje JAK" — because four fans from four doors 60 m apart is four answers to one question. Use the union of the four landmark outlines as the candidate vertices.

- [ ] **Step 2: Regenerate and check the size**

Run: `node scripts/fetch-campus-paths.mjs`

```bash
ls -l src/data/map/campusPaths.json
node -e "const d=require('./src/data/map/campusPaths.json');console.log('routes',d.routes.length,'nodes',d.graph.nodes.length,'edges',d.graph.edges.length)"
```

Expected: 63 routes (9 origins × 7 buildings). **Record the file size.** The spec's budget is roughly 120 KB; if it is over, tighten the corridor clip radius in the script and regenerate rather than shipping it.

- [ ] **Step 3: Verify from JAK in the browser**

Open `http://localhost:3000/?at=49.216233,16.630584`, route to Q, and confirm a route draws with the corridor streets visible underneath it as a dotted trail — not a line across white.

- [ ] **Step 4: Verify from mid-campus**

Open `http://localhost:3000/?at=49.2106,16.6155` (between B and M) and route to Q. Confirm the walk starts where you are and does **not** detour back out to a gate. This is the case that precomputed routes could never answer and the whole reason the graph exists.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-campus-paths.mjs src/data/map/campusPaths.json
git commit -m "feat(map): route in from the JAK dormitories

One origin for the four blocks, named for the place: four fans from four
doors 60 m apart is four answers to one question."
```

---

### Task 12: Destination from the next lesson

**Files:**
- Create: `src/utils/routing/nextLessonTarget.ts`
- Test: `src/utils/routing/__tests__/nextLessonTarget.test.ts`
- Modify: `src/components/CampusMap/RouteCard.tsx` (offer the lesson as the default destination)

**Interfaces:**
- Consumes: `resolveRoomCode` from `src/utils/mobile/resolveRoomCode.ts`; `rooms-index.json`; `buildings.json`.
- Produces:

```ts
export interface LessonTarget {
  buildingName: string;
  roomLabel: string;
  startsAt: Date;
}
export function nextLessonTarget(lessons: Lesson[], now: Date): LessonTarget | null;
```

- [ ] **Step 1: Write the failing test**

Create `src/utils/routing/__tests__/nextLessonTarget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nextLessonTarget } from '../nextLessonTarget';

const at = (iso: string) => new Date(iso);
// BA39N4051 is Q31 in building Q — verified against the shipped rooms index.
const lesson = (startISO: string, room: string) => ({ start: at(startISO), room });

describe('nextLessonTarget', () => {
  it('picks the next lesson remaining today', () => {
    const t = nextLessonTarget(
      [lesson('2026-09-21T09:00:00', 'Q31'), lesson('2026-09-21T13:00:00', 'Q31')],
      at('2026-09-21T10:00:00')
    );
    expect(t!.buildingName).toBe('Q');
    expect(t!.startsAt.getHours()).toBe(13);
  });

  it('is null when there is no lesson left today, rather than routing to Thursday', () => {
    const t = nextLessonTarget(
      [lesson('2026-09-24T09:00:00', 'Q31')],
      at('2026-09-21T10:00:00')
    );
    expect(t).toBeNull();
  });

  it('still targets a lesson that has already started, because you are late', () => {
    const t = nextLessonTarget(
      [lesson('2026-09-21T09:50:00', 'Q31')],
      at('2026-09-21T10:00:00')
    );
    expect(t).not.toBeNull();
    expect(t!.buildingName).toBe('Q');
  });

  it('is null for a room the map does not know, which is every FRRMS room today', () => {
    // Budova Z is not in the My MENDELU survey, so Z25 has no geometry and no
    // building. A button that looks fine and does nothing is worse than none.
    const t = nextLessonTarget([lesson('2026-09-21T13:00:00', 'Z25')], at('2026-09-21T10:00:00'));
    expect(t).toBeNull();
  });

  it('strips the campus in brackets that schedules print after the room', () => {
    const t = nextLessonTarget(
      [lesson('2026-09-21T13:00:00', 'Q31 (Černá Pole)')],
      at('2026-09-21T10:00:00')
    );
    expect(t!.buildingName).toBe('Q');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/routing/__tests__/nextLessonTarget.test.ts`
Expected: FAIL — cannot resolve `../nextLessonTarget`.

- [ ] **Step 3: Implement**

Create `src/utils/routing/nextLessonTarget.ts`. Use `resolveRoomCode([room])` — it already strips the bracketed campus and matches either the code or the printed name — then look the entry's `buildingId` up in `buildings.json` to get the letter. Return `null` when the room does not resolve or the building is not in the map.

Note the `buildingId === 0` trap: Q is building 0. Compare with `=== undefined`, never with truthiness.

Read the real `Lesson` shape from the schedule slice rather than inventing one; the test above uses `{ start, room }` and must be adjusted to whatever the codebase actually stores.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/utils/routing/__tests__/nextLessonTarget.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into the card**

In `RouteCard`, when a next lesson resolves, make it the default destination: the button reads "Take me there" and names the room. When it does not, fall back to the building picker from Task 9.

- [ ] **Step 6: Commit**

```bash
git add src/utils/routing/nextLessonTarget.ts \
        src/utils/routing/__tests__/nextLessonTarget.test.ts \
        src/components/CampusMap/RouteCard.tsx
git commit -m "feat(routing): the next lesson is the destination

Next lesson remaining TODAY, not 'next lesson whenever', which would
cheerfully route someone to Thursday. A lesson that has already started still
targets, because the student knows they are late and the useful number is how
much later they are about to be.

A FRRMS room resolves to nothing, so no button appears. Budova Z is not in
the My MENDELU survey; that is the floor-plan work, not a bug here."
```

---

### Task 13: Native permissions and the release build

**Files:**
- Modify: `ios/App/App/Info.plist`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `scripts/check-native-plugins.mjs` (add the new plugin to whatever it asserts)
- Modify: `docs/app-store-listing.md`, `docs/play-store-listing.md` (the location disclosure)

- [ ] **Step 1: Add the iOS usage string**

In `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>reIS uses your location once, when you ask it to, to draw the walk from where you are standing to your next lesson. Your position never leaves the phone.</string>
```

`NSLocationAlwaysAndWhenInUseUsageDescription` is **not** added: there is no background location and asking for a permission the app never uses is a review rejection waiting to happen.

- [ ] **Step 2: Add the Android permissions**

In `android/app/src/main/AndroidManifest.xml`, inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

- [ ] **Step 3: Sync and check the plugin guard**

```bash
npx cap sync
node scripts/check-native-plugins.mjs
```

Expected: passes with `@capacitor/geolocation` recognised. If the script has an explicit list, add the plugin to it.

- [ ] **Step 4: Verify on the iOS Simulator**

Build and launch, then set a custom location in the Simulator (Features → Location → Custom Location) to `49.218161, 16.614118`. Tap the route button and confirm the permission prompt appears, then the route draws.

- [ ] **Step 5: Verify the RELEASE Android build**

This is the step that cannot be skipped: **R8 strips plugins, and a debug build proves nothing.**

```bash
npm run android:release
```

Install the resulting APK on the emulator or the cabled device, set a mock location, and confirm the route draws. If the plugin is missing at runtime, add a keep rule and rebuild — a debug build passing is not evidence.

- [ ] **Step 6: Update the store disclosures**

Add the location permission to `docs/app-store-listing.md` and `docs/play-store-listing.md`, stating plainly that the position is used once per tap, is never transmitted, and is not linked to the student. This must be true: nothing in this plan sends a coordinate anywhere.

- [ ] **Step 7: Commit**

```bash
git add ios/App/App/Info.plist android/app/src/main/AndroidManifest.xml \
        scripts/check-native-plugins.mjs docs/app-store-listing.md docs/play-store-listing.md
git commit -m "feat(native): location permission for campus navigation

When-in-use only; no background string, because there is no background
location and asking for a permission the app never uses is a rejection
waiting to happen.

Verified against the RELEASE apk, not a debug build — R8 strips plugins."
```

---

### Task 14: Guard the privacy claim

The project transmits nothing about a student. A feature that learns where they are standing must be provably no exception.

**Files:**
- Modify: `src/test/guards/noStudentDataLeaves.test.ts`

- [ ] **Step 1: Write the failing guard**

Add to `src/test/guards/noStudentDataLeaves.test.ts`:

```ts
it('never sends a coordinate anywhere', async () => {
  // The routing module learns where the student is standing. It is the most
  // sensitive thing reIS has ever held, and it must stay on the device.
  const files = await glob('src/utils/routing/**/*.ts', { ignore: '**/__tests__/**' });
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/supabase/i);
    expect(src).not.toMatch(/XMLHttpRequest|navigator\.sendBeacon/);
  }
});
```

Match the glob/readFile helpers already used in that file rather than importing new ones.

- [ ] **Step 2: Run the whole guard suite**

Run: `npx vitest run src/test/guards/`
Expected: PASS. If the new test fails, something in `src/utils/routing/` is making a network call, and that is a bug in this feature, not in the guard.

- [ ] **Step 3: Commit**

```bash
git add src/test/guards/noStudentDataLeaves.test.ts
git commit -m "test(guards): a coordinate never leaves the device

The routing module learns where the student is standing — the most sensitive
thing reIS has ever held. The guard makes 'it stays on the phone' a property
the suite enforces rather than a sentence in a policy."
```

---

### Task 15: Final verification

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all green. Record the counts.

- [ ] **Step 2: Lint and types**

```bash
npx eslint src scripts
npx tsc --noEmit
```

- [ ] **Step 3: The app health check**

Run: `npm run check:app`
Expected: passes. This is what CI runs — it boots the built app in a real browser and fails if it lands on skeletons, calls IS Mendelu, writes to Supabase, or ships a real snapshot.

- [ ] **Step 4: Confirm the dev override is absent from the shipped bundle**

```bash
npm run build
grep -rn "PLAUSIBLE_LAT" .output/ | head
```

Expected: nothing.

- [ ] **Step 5: The five position fixtures, in the browser**

With `npm run dev:web`, route to Q from each and record what happens:

| `?at=` | Expect |
|---|---|
| `49.218161,16.614118` (FRRMS) | ~13 min, through the garden |
| `49.216233,16.630584` (JAK Blok A) | a route, corridor streets drawn under it |
| `49.2106,16.6155` (mid-campus) | starts where you are, no detour to a gate |
| `50.08,14.42` (Prague) | "You're not near the campus" |
| Inside Q itself | 1 min, or the "you are here" case |

- [ ] **Step 6: Screenshots**

Use the `verify-ui` skill: Mapa screen at 320 / 390 / 430, both themes, route drawn. Confirm no overflow, and the chip legible on the basemap.

- [ ] **Step 7: Open the PR**

```bash
gh pr create --base test --title "Campus navigation: walk me to my next lesson" --body "…"
```

**`--base test`, never `main`.** Include the measured `campusPaths.json` size, the five fixture results, and the release-APK confirmation in the body.

---

## Self-Review

**Spec coverage.** Graph emission → Task 1. Corridors → Tasks 10, 11. Corridor ways drawn as context → Task 11 Step 3 (verified) via the existing network trail. `splitAnchors` rank → Task 10. Routing module → Tasks 2–4. Closed edges → Tasks 4, 5. Geolocation → Tasks 7, 13. Destination and the rule table → Task 12, with the remaining branches in the card at Task 9. Garden hours and the ISIC line → Tasks 5, 9. Error/degradation table → Tasks 7, 9. Dev override → Task 6. Testing and verification → Tasks 6, 9, 11, 15. Privacy → Task 14.

**One spec item deliberately deferred:** the weekend "around" route. The spec settles this as a text note, not a second corridor, and Task 9's `routeGardenShut` copy is that note. No task builds a third corridor, which is correct.

**Placeholders.** None. Every code step carries the code. Three steps deliberately say "read the file first" rather than quoting a line range — Task 1 Step 6, Task 7 Step 5, Task 8 Step 5 — because the surrounding variable names and call signatures are local to files this plan does not reproduce, and a guessed line number ages worse than an instruction to look.

**Type consistency.** `Snap` is produced in Task 3 and consumed in Task 4 and Task 7 under that name. `Walk` is produced in Task 4 and consumed in Tasks 7, 8, 9. `CampusGraph` is defined in Task 1 and used in Tasks 3, 4, 7. `edgeLength`/`edgeGate` are exported from `snapToGraph.ts` in Task 3 and imported in Task 4. `isGateOpen(gateId, now)` in Task 5 matches the `(gate) => isGateOpen(gate, now)` adapter in Task 7. `RANK.origin` is added in Task 10 and used in Tasks 10 and 11.

**Known risk carried into execution.** Task 10 Step 3 renumbers `RANK`, and `KIND_OF_RANK` is indexed by rank. The step says so and includes the grep. If a task fails mysteriously after Task 10, this is the first thing to check.
