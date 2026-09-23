import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { CAMPUS_ENTRANCES } from '../pathLayers';
import { drawCampusEntrances, markActiveEntrance } from '../entranceLayers';
import {
  markPickableBuildings,
  PICKABLE_BUILDING_STYLE,
  PICKED_BUILDING_STYLE,
} from '../buildingChooser';
import { BUILDING_STYLE } from '../mapHelpers';

const BUILDINGS = ['A', 'B', 'C', 'E', 'M', 'Q', 'X'];

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
