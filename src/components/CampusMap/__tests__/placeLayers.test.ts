import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { drawCampusPlaces, LABELLED_DESTINATIONS } from '../placeLayers';
import { CAMPUS_DESTINATIONS, CAMPUS_PATHS } from '../pathLayers';

describe('drawCampusPlaces', () => {
  it('names the places the map does not already name', () => {
    const names = LABELLED_DESTINATIONS.map((p) => p.name);
    expect(names).toContain('Hlavní brána');
    expect(names).toContain('Zemědělská');
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  it('does NOT label a lettered building — it already draws its own letter', () => {
    // The collision this exists for: a pill saying "A" landing on top of the A.
    for (const letter of ['A', 'B', 'C', 'E', 'M', 'Q', 'X'])
      expect(LABELLED_DESTINATIONS.map((p) => p.name)).not.toContain(letter);
  });

  it('marks every one of them', () => {
    const layer = L.layerGroup();
    const dots = drawCampusPlaces(layer);
    expect(dots).toHaveLength(LABELLED_DESTINATIONS.length);
    expect(layer.getLayers()).toHaveLength(LABELLED_DESTINATIONS.length);
    for (const d of dots) expect(d.getTooltip()).toBeTruthy();
  });

  it('never eats a tap meant for the path underneath it', () => {
    // These sit ON the trail. An interactive marker here would make the route
    // beneath it unselectable, and the paths are the thing you tap.
    for (const dot of drawCampusPlaces(L.layerGroup())) expect(dot.options.interactive).toBe(false);
  });
});

describe('the committed destinations', () => {
  it('places every one of them where a route actually ends', () => {
    const ends = new Set(CAMPUS_PATHS.flatMap((p) => [p.from, p.to]));
    for (const d of CAMPUS_DESTINATIONS) expect(ends.has(d.name)).toBe(true);
    expect(CAMPUS_DESTINATIONS.length).toBe(ends.size);
  });

  it('gives each one a kind the map can act on', () => {
    for (const d of CAMPUS_DESTINATIONS)
      expect(['building', 'gate', 'cafeteria', 'stop', 'other']).toContain(d.kind);
    expect(CAMPUS_DESTINATIONS.filter((d) => d.kind === 'building').length).toBe(7);
  });

  it('sits each one on the campus, not somewhere in Brno', () => {
    for (const d of CAMPUS_DESTINATIONS) {
      expect(d.lat).toBeGreaterThan(49.2086);
      expect(d.lat).toBeLessThan(49.2126);
      expect(d.lon).toBeGreaterThan(16.6127);
      expect(d.lon).toBeLessThan(16.6198);
    }
  });
});
