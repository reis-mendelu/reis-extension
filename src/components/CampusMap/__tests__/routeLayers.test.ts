import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { drawRoute } from '../routeLayers';
import type { Walk } from '../../../utils/routing/shortestWalk';

const walk: Walk = {
  coords: [
    [16.6, 49.21],
    [16.6, 49.2105],
    [16.6005, 49.2105],
  ],
  lengthM: 640,
  gates: [],
};

const chipOf = (layer: L.LayerGroup) =>
  layer.getLayers().find((l) => l instanceof L.Marker) as L.Marker | undefined;

describe('drawRoute', () => {
  it('draws the halo, the line, a start dot and one time chip', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    expect(layer.getLayers()).toHaveLength(4);
  });

  it('labels the walk in minutes at the shipped pace', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    // 640 m at 100 m/min.
    const html = (chipOf(layer)!.options.icon as L.DivIcon).options.html;
    expect(String(html)).toContain('6');
  });

  it('puts the chip at the destination, not at the start', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    const at = chipOf(layer)!.getLatLng();
    expect(at.lat).toBeCloseTo(49.2105, 6);
    expect(at.lng).toBeCloseTo(16.6005, 6);
  });

  it('puts the start dot where the walk begins', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    const dot = layer.getLayers().find((l) => l instanceof L.CircleMarker) as L.CircleMarker;
    expect(dot.getLatLng().lat).toBeCloseTo(49.21, 6);
  });

  it('converts [lon, lat] to Leaflet latlng rather than transposing them', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    const line = layer.getLayers().find((l) => l instanceof L.Polyline) as L.Polyline;
    const first = (line.getLatLngs() as L.LatLng[])[0];
    // Brno: latitude 49, longitude 16. Transposed, this would be lat 16.
    expect(first.lat).toBeGreaterThan(49);
    expect(first.lng).toBeGreaterThan(16);
    expect(first.lng).toBeLessThan(17);
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
    drawRoute(layer, walk, 'cz');
    expect(layer.getLayers()).toHaveLength(4);
  });

  it('draws nothing for a degenerate one-point walk', () => {
    const layer = L.layerGroup();
    drawRoute(layer, { coords: [[16.6, 49.21]], lengthM: 0, gates: [] }, 'cz');
    expect(layer.getLayers()).toHaveLength(0);
  });
});
