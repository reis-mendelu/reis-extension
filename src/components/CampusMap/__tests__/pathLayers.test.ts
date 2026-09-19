import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { CAMPUS_PATHS, drawCampusPaths, highlightPath, pathLabel } from '../pathLayers';

describe('pathLabel', () => {
  const path = (from: string | null, to: string | null) => ({
    id: 1,
    from,
    to,
    lengthM: 100,
    coords: [
      [16.614, 49.21],
      [16.615, 49.21],
    ] as [number, number][],
  });

  it('names both ends of a route that has them', () => {
    expect(pathLabel(path('Hlavní brána', 'C'))).toBe('Hlavní brána ↔ C');
  });

  it('falls back to the single end that is named', () => {
    expect(pathLabel(path(null, 'Lesnická'))).toBe('Lesnická');
    expect(pathLabel(path('X', null))).toBe('X');
  });

  it('gives no label to a route that ends in open ground at both ends', () => {
    expect(pathLabel(path(null, null))).toBeNull();
  });
});

describe('drawCampusPaths', () => {
  const layer = () => L.layerGroup();

  it('draws every campus route, keyed by id', () => {
    const drawn = drawCampusPaths(layer(), vi.fn());
    expect(drawn.size).toBe(CAMPUS_PATHS.length);
    expect(drawn.size).toBeGreaterThan(20);
  });

  it('draws each route as casing + line + an invisible hit line', () => {
    const l = layer();
    drawCampusPaths(l, vi.fn());
    expect(l.getLayers()).toHaveLength(CAMPUS_PATHS.length * 3);
  });

  it('gives the hit line a finger-sized width — a 2.5px path is not tappable', () => {
    const drawn = drawCampusPaths(layer(), vi.fn());
    const { hit, line } = [...drawn.values()][0];
    expect(hit.options.weight).toBeGreaterThanOrEqual(20);
    expect(hit.options.opacity).toBe(0);
    expect(line.options.weight).toBeLessThan(hit.options.weight!);
  });

  it('stops the tap from also reaching the map, which would clear the selection it just made', () => {
    const drawn = drawCampusPaths(layer(), vi.fn());
    for (const { hit, casing, line } of drawn.values()) {
      expect(hit.options.bubblingMouseEvents).toBe(false);
      // Only the hit line answers a tap; the drawn ones must never swallow it.
      expect(casing.options.interactive).toBe(false);
      expect(line.options.interactive).toBe(false);
    }
  });

  it('reports the tapped route to the caller', () => {
    const onSelect = vi.fn();
    const drawn = drawCampusPaths(layer(), onSelect);
    const [id, { hit }] = [...drawn.entries()][3];
    hit.fire('click');
    expect(onSelect).toHaveBeenCalledWith(id);
  });
});

describe('highlightPath', () => {
  it('marks the chosen route and leaves every other one plain', () => {
    const drawn = drawCampusPaths(L.layerGroup(), vi.fn());
    const ids = [...drawn.keys()];
    highlightPath(drawn, ids[2]);
    expect(drawn.get(ids[2])!.line.options.color).toBe('#ea580c');
    for (const other of ids.filter((i) => i !== ids[2]))
      expect(drawn.get(other)!.line.options.color).toBe('#94a3b8');
  });

  it('draws the chosen route thicker, so it can be traced end to end', () => {
    const drawn = drawCampusPaths(L.layerGroup(), vi.fn());
    const id = [...drawn.keys()][0];
    const plain = drawn.get(id)!.line.options.weight!;
    highlightPath(drawn, id);
    expect(drawn.get(id)!.line.options.weight!).toBeGreaterThan(plain);
    expect(drawn.get(id)!.casing.options.weight!).toBeGreaterThan(
      drawn.get(id)!.line.options.weight!
    );
  });

  it('clears the highlight when nothing is selected', () => {
    const drawn = drawCampusPaths(L.layerGroup(), vi.fn());
    const id = [...drawn.keys()][0];
    highlightPath(drawn, id);
    highlightPath(drawn, null);
    expect(drawn.get(id)!.line.options.color).toBe('#94a3b8');
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

  it('names both ends of the routes that carry the campus', () => {
    // The point of the merge step: without it the network is ~100 anonymous
    // 33 m ways. If this drops, the generator has stopped joining things up.
    const named = CAMPUS_PATHS.filter((p) => p.from && p.to);
    expect(named.length).toBeGreaterThanOrEqual(15);
    const labels = named.map(pathLabel);
    expect(labels).toContain('Brána u budovy Q ↔ Hlavní brána');
  });
});
