import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { CAMPUS_NETWORK, drawCampusPaths } from '../pathLayers';

describe('drawCampusPaths', () => {
  it('draws the network once, and nothing else', () => {
    // Nothing else at all now. It used to return two empty polylines and a
    // chip layer for the gate question to fill in; that question is the
    // router's, and it draws its own line in its own layer group.
    const layer = L.layerGroup();
    drawCampusPaths(layer);
    const strokes = layer.getLayers().filter((l) => l instanceof L.Polyline);
    expect(strokes.length).toBe(CAMPUS_NETWORK.length * 2);
    expect(layer.getLayers().length).toBe(strokes.length);
  });

  it('draws the network as a dotted TRAIL, not as another road', () => {
    const layer = L.layerGroup();
    drawCampusPaths(layer);
    const opts = (layer.getLayers() as L.Polyline[]).map((l) => l.options);
    const trail = opts.filter((o) => o.dashArray);
    expect(trail.length).toBe(CAMPUS_NETWORK.length);
    for (const o of trail) expect(o.dashArray).toBe('0.1 6');
  });

  it('keeps colour OUT of the always-on layer', () => {
    // The network sits under everything and must not compete with the route
    // the student asked for, nor with the arboretum's green.
    const layer = L.layerGroup();
    drawCampusPaths(layer);
    const colours = new Set((layer.getLayers() as L.Polyline[]).map((l) => l.options.color));
    expect([...colours].sort()).toEqual(['#a8a29e', '#ffffff']);
  });
});
