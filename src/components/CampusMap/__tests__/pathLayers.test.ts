import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import {
  CAMPUS_NETWORK,
  CAMPUS_PATHS,
  drawCampusPaths,
  highlightPath,
  pathLabel,
} from '../pathLayers';

describe('pathLabel', () => {
  const route = (lengthM: number) => ({
    id: 1,
    from: 'Hlavní brána',
    to: 'C',
    lengthM,
    coords: [
      [16.614, 49.21],
      [16.615, 49.21],
    ] as [number, number][],
  });

  it('leads with how long the walk takes, then where it runs', () => {
    // Time first because the chip truncates: whatever leads survives a long
    // pair of names, and the minutes are what a student is deciding on.
    expect(pathLabel(route(436), 'cz')).toBe('5 min · Hlavní brána ↔ C');
  });

  it('speaks the student\u2019s language', () => {
    expect(pathLabel(route(240), 'en')).toBe('3 min · Hlavní brána ↔ C');
  });
});

describe('drawCampusPaths', () => {
  const layer = () => L.layerGroup();

  it('draws the network ONCE — a casing pass, a line pass, and nothing repeated', () => {
    // The bug it exists for: drawing a casing+line per ROUTE painted every
    // shared stretch several times, and one route's white casing scribbled
    // over the next route's line.
    const l = layer();
    drawCampusPaths(l, vi.fn());
    const expected = CAMPUS_NETWORK.length * 2 + 2 + CAMPUS_PATHS.length;
    expect(l.getLayers()).toHaveLength(expected);
    expect(CAMPUS_NETWORK.length).toBeLessThan(CAMPUS_PATHS.length);
  });

  it('puts every halo under every trail, not each halo under its own trail', () => {
    const l = layer();
    drawCampusPaths(l, vi.fn());
    const weights = (l.getLayers() as L.Polyline[])
      .slice(0, CAMPUS_NETWORK.length * 2)
      .map((p) => p.options.weight);
    expect(new Set(weights.slice(0, CAMPUS_NETWORK.length))).toEqual(new Set([6]));
    expect(new Set(weights.slice(CAMPUS_NETWORK.length))).toEqual(new Set([3]));
  });

  it('draws the network as a dotted TRAIL, not as another road', () => {
    const l = layer();
    drawCampusPaths(l, vi.fn());
    const trails = (l.getLayers() as L.Polyline[]).slice(
      CAMPUS_NETWORK.length,
      CAMPUS_NETWORK.length * 2
    );
    for (const t of trails) {
      expect(t.options.dashArray).toBeTruthy();
      expect(t.options.lineCap).toBe('round');
    }
  });

  it('keeps colour OUT of the always-on layer', () => {
    // The reversal this encodes: brand green in the base network collided with
    // the arboretum, with the primary-green UI, and worst of all with the
    // selected route — the one thing that has to be findable. A neutral base is
    // what lets the tapped route be the only saturated thing on the map.
    const l = layer();
    drawCampusPaths(l, vi.fn());
    const trails = (l.getLayers() as L.Polyline[]).slice(
      CAMPUS_NETWORK.length,
      CAMPUS_NETWORK.length * 2
    );
    for (const t of trails) {
      const c = t.options.color!;
      expect(c).not.toBe('#79be15'); // MENDELU green — the brand, spoken for
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      // near-neutral: no channel far from the others
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(24);
    }
  });

  it('gives every route a tap target', () => {
    const { hits, routes } = drawCampusPaths(layer(), vi.fn());
    expect(hits.size).toBe(CAMPUS_PATHS.length);
    expect(routes.size).toBe(CAMPUS_PATHS.length);
  });

  it('gives the hit line a finger-sized width — a 2.5px path is not tappable', () => {
    const { hits } = drawCampusPaths(layer(), vi.fn());
    const hit = [...hits.values()][0];
    expect(hit.options.weight).toBeGreaterThanOrEqual(20);
    expect(hit.options.opacity).toBe(0);
  });

  it('stops the tap from also reaching the map, which would clear the selection it just made', () => {
    const { hits } = drawCampusPaths(layer(), vi.fn());
    for (const hit of hits.values()) expect(hit.options.bubblingMouseEvents).toBe(false);
  });

  it('never lets a drawn line swallow a tap', () => {
    const l = layer();
    drawCampusPaths(l, vi.fn());
    const drawn = (l.getLayers() as L.Polyline[]).slice(0, CAMPUS_NETWORK.length * 2);
    for (const p of drawn) expect(p.options.interactive).toBe(false);
  });

  it('reports the tapped route to the caller', () => {
    const onSelect = vi.fn();
    const { hits } = drawCampusPaths(layer(), onSelect);
    const [id, hit] = [...hits.entries()][3];
    hit.fire('click');
    expect(onSelect).toHaveBeenCalledWith(id);
  });
});

describe('highlightPath', () => {
  it('lays the chosen route over the network, whole', () => {
    const layers = drawCampusPaths(L.layerGroup(), vi.fn());
    const id = [...layers.routes.keys()][2];
    highlightPath(layers, id);
    const route = layers.routes.get(id)!;
    expect((layers.highlight.line.getLatLngs() as L.LatLng[]).length).toBe(route.coords.length);
    expect(layers.highlight.line.options.color).toBe('#ea580c');
  });

  it('keeps ONE highlight however many routes get tapped', () => {
    const layers = drawCampusPaths(L.layerGroup(), vi.fn());
    for (const id of layers.routes.keys()) {
      highlightPath(layers, id);
      const n = (layers.highlight.line.getLatLngs() as L.LatLng[]).length;
      expect(n).toBe(layers.routes.get(id)!.coords.length);
    }
  });

  it('draws the chosen route heavier than the network under it', () => {
    const layers = drawCampusPaths(L.layerGroup(), vi.fn());
    highlightPath(layers, [...layers.routes.keys()][0]);
    expect(layers.highlight.line.options.weight!).toBeGreaterThan(2.5);
    expect(layers.highlight.casing.options.weight!).toBeGreaterThan(
      layers.highlight.line.options.weight!
    );
  });

  it('clears the highlight when nothing is selected', () => {
    const layers = drawCampusPaths(L.layerGroup(), vi.fn());
    highlightPath(layers, [...layers.routes.keys()][0]);
    highlightPath(layers, null);
    expect(layers.highlight.line.getLatLngs()).toEqual([]);
    expect(layers.highlight.casing.getLatLngs()).toEqual([]);
  });
});

describe('the committed campus path data', () => {
  it('gives every route a unique id and a drawable line', () => {
    expect(new Set(CAMPUS_PATHS.map((p) => p.id)).size).toBe(CAMPUS_PATHS.length);
    for (const p of CAMPUS_PATHS) expect(p.coords.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every route on the Brno campus and off the rest of the city', () => {
    // campus bounds (buildings.json) plus the generator's 50 m margin, which is
    // what keeps the layer from trailing off down Zemědělská into Černá Pole.
    // + the 1e-6 the generator rounds coordinates to, which can nudge a point
    // clipped exactly onto the boundary a tenth of a metre past it.
    const eps = 1e-6;
    const dLat = 50 / 110540 + eps;
    const dLon = 50 / (111320 * Math.cos((49.21 * Math.PI) / 180)) + eps;
    for (const p of CAMPUS_PATHS)
      for (const [lon, lat] of p.coords) {
        expect(lat).toBeGreaterThanOrEqual(49.209106 - dLat);
        expect(lat).toBeLessThanOrEqual(49.212072 + dLat);
        expect(lon).toBeGreaterThanOrEqual(16.613191 - dLon);
        expect(lon).toBeLessThanOrEqual(16.619034 + dLon);
      }
  });

  it('draws no stub too short to be worth a tap', () => {
    for (const p of CAMPUS_PATHS) expect(p.lengthM).toBeGreaterThanOrEqual(25);
  });

  it('runs every route between two named places, never into open ground', () => {
    for (const p of CAMPUS_PATHS) {
      expect(p.from).toBeTruthy();
      expect(p.to).toBeTruthy();
      expect(p.from).not.toBe(p.to);
    }
  });

  it('CONNECTS the routes — every place is walkable from every other one', () => {
    // The whole point of building this from a graph rather than by chaining
    // ways. Routes are not isolated pieces: `to` of one is `from` of others, so
    // you can get from any place on the campus to any other by following them.
    // If this splits into two groups, the network has broken in half.
    const nbrs = new Map<string, string[]>();
    const link = (a: string, b: string) => nbrs.set(a, [...(nbrs.get(a) ?? []), b]);
    for (const p of CAMPUS_PATHS) {
      link(p.from, p.to);
      link(p.to, p.from);
    }
    expect(nbrs.size).toBeGreaterThanOrEqual(12);
    const seen = new Set([[...nbrs.keys()].sort()[0]]);
    for (const place of seen) for (const n of nbrs.get(place)!) seen.add(n);
    expect([...seen].sort()).toEqual([...nbrs.keys()].sort());
  });

  it('reaches the lettered buildings and the gates a student arrives through', () => {
    const places = new Set(CAMPUS_PATHS.flatMap((p) => [p.from, p.to]));
    // The generator refuses to write a file that misses any of these, so this
    // is the shipped half of that guard.
    for (const letter of ['A', 'B', 'C', 'E', 'M', 'Q', 'X']) expect(places).toContain(letter);
    expect(places).toContain('Hlavní brána');
  });
});

describe('the route label', () => {
  it('names the route that was tapped', () => {
    const layers = drawCampusPaths(L.layerGroup(), vi.fn());
    const id = [...layers.routes.keys()][0];
    highlightPath(layers, id);
    expect(layers.highlight.line.getTooltip()?.getContent()).toBe(
      pathLabel(layers.routes.get(id)!, 'cz')
    );
  });

  it('leaves exactly one on the map, however many routes get tapped', () => {
    // One tooltip on one layer, so a stale label is not a thing that can exist.
    const layers = drawCampusPaths(L.layerGroup(), vi.fn());
    for (const id of layers.routes.keys()) {
      highlightPath(layers, id);
      expect(layers.highlight.line.getTooltip()?.getContent()).toBe(
        pathLabel(layers.routes.get(id)!, 'cz')
      );
    }
  });

  it('takes the label away again when the route is dropped', () => {
    const layers = drawCampusPaths(L.layerGroup(), vi.fn());
    highlightPath(layers, [...layers.routes.keys()][0]);
    highlightPath(layers, null);
    expect(layers.highlight.line.getTooltip()).toBeFalsy();
  });
});

describe('route names fit a phone', () => {
  it('keeps every label short enough for a 320 px chip', () => {
    // "Pizzerie v budově O ↔ Vedlejší brána z ulice Lesnická" was 53 characters
    // and ran off the screen; the generator shortens the place names for this.
    for (const p of CAMPUS_PATHS) expect(pathLabel(p, 'cz').length).toBeLessThanOrEqual(42);
  });
});

describe('the committed network', () => {
  it('draws each stretch of path exactly once', () => {
    const edges = CAMPUS_NETWORK.flatMap((s) =>
      s.slice(1).map((c, i) => [`${s[i][0]},${s[i][1]}`, `${c[0]},${c[1]}`].sort().join('|'))
    );
    expect(new Set(edges).size).toBe(edges.length);
  });

  it('covers every stretch the routes run over', () => {
    const drawn = new Set(
      CAMPUS_NETWORK.flatMap((s) =>
        s.slice(1).map((c, i) => [`${s[i][0]},${s[i][1]}`, `${c[0]},${c[1]}`].sort().join('|'))
      )
    );
    for (const p of CAMPUS_PATHS)
      for (let i = 1; i < p.coords.length; i++) {
        const e = [
          `${p.coords[i - 1][0]},${p.coords[i - 1][1]}`,
          `${p.coords[i][0]},${p.coords[i][1]}`,
        ]
          .sort()
          .join('|');
        expect(drawn.has(e)).toBe(true);
      }
  });

  it('is fewer, longer strokes than there are routes', () => {
    for (const s of CAMPUS_NETWORK) expect(s.length).toBeGreaterThanOrEqual(2);
    expect(CAMPUS_NETWORK.length).toBeLessThanOrEqual(25);
  });
});
