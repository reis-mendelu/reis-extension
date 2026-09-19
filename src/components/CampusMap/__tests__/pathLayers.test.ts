import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import {
  CAMPUS_ENTRANCES,
  CAMPUS_NETWORK,
  CAMPUS_WALKS,
  WALKS_BY_ENTRANCE,
  drawCampusPaths,
  findWalk,
  keepChipsOnScreen,
  showWalk,
  walkLabel,
} from '../pathLayers';
import { drawCampusEntrances, markActiveEntrance } from '../entranceLayers';
import {
  markPickableBuildings,
  PICKABLE_BUILDING_STYLE,
  PICKED_BUILDING_STYLE,
} from '../buildingChooser';
import { BUILDING_STYLE } from '../mapHelpers';

const BUILDINGS = ['A', 'B', 'C', 'E', 'M', 'Q', 'X'];

describe('walkLabel', () => {
  it('says how long the walk takes, and nothing else', () => {
    // It sits at the END of the walk, on a building that already draws its own
    // letter, so repeating the destination would be saying it twice.
    expect(
      walkLabel({ id: 1, from: 'Hlavní brána', to: 'Q', lengthM: 320, coords: [] }, 'cz')
    ).toBe('4 min');
  });
});

describe('drawCampusPaths', () => {
  it('draws the network once, and nothing else until a gate is chosen', () => {
    const layer = L.layerGroup();
    const layers = drawCampusPaths(layer);
    // halo pass + line pass + the two fan polylines + the chip group
    expect(layer.getLayers()).toHaveLength(CAMPUS_NETWORK.length * 2 + 3);
    expect(layers.fanLine.getLatLngs()).toEqual([]);
    expect(layers.chips.getLayers()).toHaveLength(0);
  });

  it('draws the network as a dotted TRAIL, not as another road', () => {
    const layer = L.layerGroup();
    drawCampusPaths(layer);
    const trails = (layer.getLayers() as L.Polyline[]).slice(
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
    // the arboretum, with the primary-green UI, and worst of all with the walks
    // themselves — the thing that has to be findable.
    const layer = L.layerGroup();
    drawCampusPaths(layer);
    const trails = (layer.getLayers() as L.Polyline[]).slice(
      CAMPUS_NETWORK.length,
      CAMPUS_NETWORK.length * 2
    );
    for (const t of trails) {
      const c = t.options.color!;
      expect(c).not.toBe('#79be15');
      const rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThan(24);
    }
  });
});

describe('findWalk', () => {
  it('finds the one walk from this gate to this building', () => {
    const w = findWalk('Hlavní brána', 'Q');
    expect(w?.from).toBe('Hlavní brána');
    expect(w?.to).toBe('Q');
  });

  it('answers nothing until both halves of the question are asked', () => {
    expect(findWalk('Hlavní brána', null)).toBeUndefined();
    expect(findWalk(null, 'Q')).toBeUndefined();
    expect(findWalk(null, null)).toBeUndefined();
  });

  it('shrugs off a gate or a building it does not know', () => {
    expect(findWalk('Brána, která neexistuje', 'Q')).toBeUndefined();
    expect(findWalk('Hlavní brána', 'Ž')).toBeUndefined();
  });
});

describe('showWalk', () => {
  const setup = () => drawCampusPaths(L.layerGroup());

  it('draws ONE walk, not a fan of them', () => {
    // Seven walks at once meant seven times on the map and a campus to read.
    const layers = setup();
    showWalk(layers, findWalk('Hlavní brána', 'Q'), 'cz');
    const line = layers.fanLine.getLatLngs() as L.LatLng[];
    expect(line.length).toBe(findWalk('Hlavní brána', 'Q')!.coords.length);
    expect(layers.chips.getLayers()).toHaveLength(1);
  });

  it('puts the time at the building end, where you are going', () => {
    const layers = setup();
    const walk = findWalk('Zemědělská', 'C')!;
    showWalk(layers, walk, 'cz');
    const chip = layers.chips.getLayers()[0] as L.Tooltip;
    const [lon, lat] = walk.coords.at(-1) as [number, number];
    expect(chip.getLatLng()!.lat).toBeCloseTo(lat, 9);
    expect(chip.getLatLng()!.lng).toBeCloseTo(lon, 9);
    expect(String(chip.getContent())).toMatch(/^\d+ min$/);
  });

  it('swaps cleanly from one walk to another — no leftovers', () => {
    const layers = setup();
    showWalk(layers, findWalk('Hlavní brána', 'Q'), 'cz');
    showWalk(layers, findWalk('Brána Lesnická', 'C'), 'cz');
    expect(layers.chips.getLayers()).toHaveLength(1);
    expect((layers.fanLine.getLatLngs() as L.LatLng[]).length).toBe(
      findWalk('Brána Lesnická', 'C')!.coords.length
    );
  });

  it('clears everything when the question is unanswered', () => {
    const layers = setup();
    showWalk(layers, findWalk('Hlavní brána', 'Q'), 'cz');
    showWalk(layers, undefined, 'cz');
    expect(layers.fanLine.getLatLngs()).toEqual([]);
    expect(layers.fanHalo.getLatLngs()).toEqual([]);
    expect(layers.chips.getLayers()).toHaveLength(0);
  });
});

describe('drawCampusEntrances', () => {
  it('marks every way onto the campus, and nothing in the middle of it', () => {
    const marks = drawCampusEntrances(L.layerGroup(), vi.fn());
    expect(marks.size).toBe(CAMPUS_ENTRANCES.length);
    expect([...marks.keys()]).toContain('Hlavní brána');
    // "Budova O" sat in the middle of the campus and answered nothing.
    expect([...marks.keys()]).not.toContain('Budova O');
    for (const letter of BUILDINGS) expect([...marks.keys()]).not.toContain(letter);
  });

  it('keeps the gate name for hover, not permanently on the map', () => {
    const marks = drawCampusEntrances(L.layerGroup(), vi.fn());
    for (const dot of marks.values()) {
      expect(dot.getTooltip()).toBeTruthy();
      expect(dot.getTooltip()!.options.permanent).toBeFalsy();
    }
  });

  it('reports the tapped gate', () => {
    const onSelect = vi.fn();
    const marks = drawCampusEntrances(L.layerGroup(), onSelect);
    marks.get('Hlavní brána')!.fire('click');
    expect(onSelect).toHaveBeenCalledWith('Hlavní brána');
  });

  it('does not let the tap fall through to the map, which would clear it again', () => {
    const marks = drawCampusEntrances(L.layerGroup(), vi.fn());
    for (const dot of marks.values()) expect(dot.options.bubblingMouseEvents).toBe(false);
  });

  it('shows which gate the walks are coming from', () => {
    const marks = drawCampusEntrances(L.layerGroup(), vi.fn());
    markActiveEntrance(marks, 'Hlavní brána');
    expect(marks.get('Hlavní brána')!.options.color).toBe('#ea580c');
    for (const [name, dot] of marks)
      if (name !== 'Hlavní brána') expect(dot.options.color).toBe('#78716c');
    markActiveEntrance(marks, null);
    for (const dot of marks.values()) expect(dot.options.color).toBe('#78716c');
  });
});

describe('the committed walks', () => {
  it('runs every walk from an entrance to a lettered building', () => {
    const gates = new Set(CAMPUS_ENTRANCES.map((e) => e.name));
    for (const w of CAMPUS_WALKS) {
      expect(gates.has(w.from)).toBe(true);
      expect(BUILDINGS).toContain(w.to);
      expect(w.coords.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('gets you from every gate to every building', () => {
    // The promise the fan makes. If a gate cannot reach a building the map
    // quietly stops answering the question someone walked up with.
    for (const gate of CAMPUS_ENTRANCES) {
      const reached = (WALKS_BY_ENTRANCE.get(gate.name) ?? []).map((w) => w.to).sort();
      expect(reached).toEqual([...BUILDINGS].sort());
    }
  });

  it('keeps every walk plausible for a campus 400 m across', () => {
    for (const w of CAMPUS_WALKS) {
      expect(w.lengthM).toBeGreaterThanOrEqual(25);
      expect(w.lengthM).toBeLessThan(900);
    }
  });

  it('marks six ways in', () => {
    expect(CAMPUS_ENTRANCES).toHaveLength(6);
    for (const e of CAMPUS_ENTRANCES) expect(['gate', 'stop']).toContain(e.kind);
  });

  /** Every segment of a line, as an order-independent key. */
  const edgesOf = (coords: number[][]) => {
    const out: string[] = [];
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1] ?? [];
      const b = coords[i] ?? [];
      out.push([a.join(','), b.join(',')].sort().join('|'));
    }
    return out;
  };

  it('draws every stretch of the network exactly once', () => {
    const edges = CAMPUS_NETWORK.flatMap(edgesOf);
    expect(new Set(edges).size).toBe(edges.length);
  });

  it('covers every stretch the walks run over', () => {
    const drawn = new Set(CAMPUS_NETWORK.flatMap(edgesOf));
    for (const w of CAMPUS_WALKS)
      for (const edge of edgesOf(w.coords)) expect(drawn.has(edge)).toBe(true);
  });
});

describe('markPickableBuildings', () => {
  const polys = () =>
    new Map(
      BUILDINGS.map((n) => [
        n,
        L.polygon([
          [49.21, 16.614],
          [49.211, 16.615],
          [49.21, 16.616],
        ]),
      ])
    );

  it('leaves the buildings alone until a gate is chosen', () => {
    const p = polys();
    markPickableBuildings(p, null, null);
    for (const poly of p.values()) expect(poly.options.color).toBe(BUILDING_STYLE.color);
  });

  it('lights every building once a gate is chosen, so you can see what to pick', () => {
    // Replaces an orange lettered pill per building, which sat on top of the
    // letter each building already draws and said its name twice.
    const p = polys();
    markPickableBuildings(p, 'Hlavní brána', null);
    for (const poly of p.values()) expect(poly.options.color).toBe(PICKABLE_BUILDING_STYLE.color);
  });

  it('marks the one you picked more strongly than the rest', () => {
    const p = polys();
    markPickableBuildings(p, 'Hlavní brána', 'Q');
    expect(p.get('Q')!.options.color).toBe(PICKED_BUILDING_STYLE.color);
    expect(p.get('Q')!.options.weight!).toBeGreaterThan(PICKABLE_BUILDING_STYLE.weight!);
    for (const n of BUILDINGS.filter((x) => x !== 'Q'))
      expect(p.get(n)!.options.color).toBe(PICKABLE_BUILDING_STYLE.color);
  });

  it('puts them all back when the gate is dropped', () => {
    const p = polys();
    markPickableBuildings(p, 'Hlavní brána', 'Q');
    markPickableBuildings(p, null, null);
    for (const poly of p.values()) {
      expect(poly.options.color).toBe(BUILDING_STYLE.color);
      expect(poly.options.weight).toBe(BUILDING_STYLE.weight);
    }
  });
});

describe('keepChipsOnScreen', () => {
  it('does nothing, safely, when no walk is showing', () => {
    const layers = drawCampusPaths(L.layerGroup());
    const map = { getContainer: () => document.createElement('div') } as unknown as L.Map;
    expect(() => keepChipsOnScreen(layers.chips, map)).not.toThrow();
  });

  it('does not accumulate a shift when run again and again', () => {
    // It runs on every camera settle now, so an implementation that measured
    // the already-shifted box would walk the label further off on every pan.
    const layers = drawCampusPaths(L.layerGroup());
    showWalk(layers, findWalk('Hlavní brána', 'Q'), 'cz');
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 320 });
    const map = { getContainer: () => container } as unknown as L.Map;

    const shifts: string[] = [];
    for (let i = 0; i < 3; i++) {
      keepChipsOnScreen(layers.chips, map);
      const el = (layers.chips.getLayers()[0] as L.Tooltip).getElement();
      shifts.push(el?.style.marginLeft ?? '');
    }
    expect(new Set(shifts).size).toBe(1);
  });
});
