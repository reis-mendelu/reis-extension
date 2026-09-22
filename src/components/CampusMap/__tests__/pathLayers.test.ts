import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import {
  CAMPUS_NETWORK,
  drawCampusPaths,
  findWalk,
  keepChipsOnScreen,
  showWalk,
  walkLabel,
} from '../pathLayers';

describe('walkLabel', () => {
  it('says how long the walk takes, and nothing else', () => {
    // It sits at the END of the walk, on a building that already draws its own
    // letter, so repeating the destination would be saying it twice.
    expect(
      walkLabel({ id: 1, from: 'Hlavní brána', to: 'Q', lengthM: 320, coords: [] }, 'cz')
    ).toBe('3 min');
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
