import { describe, it, expect } from 'vitest';
import L from 'leaflet';
import { drawRoute, drawPosition, ROUTE_COLOR } from '../routeLayers';
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
  layer.getLayers().find((l) => l instanceof L.Tooltip) as L.Tooltip | undefined;

describe('drawRoute', () => {
  it('draws the halo, the line and one time chip', () => {
    // No start dot here: the position marker is its own layer, because it must
    // show even when there is no route to be the start of.
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    expect(layer.getLayers()).toHaveLength(3);
  });

  it('labels the walk in minutes at the shipped pace', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    // 640 m at 100 m/min.
    expect(String(chipOf(layer)!.getContent())).toContain('6');
  });

  it('emits a TOOLTIP, because only a tooltip gets styled', () => {
    // The first version used L.divIcon, which renders
    // `leaflet-marker-icon route-chip` and never matches the
    // `.leaflet-tooltip.route-chip` rule — so it shipped as a 12x12
    // transparent box with theme-coloured text on an always-light basemap.
    // The old test asserted the divIcon's html and passed the whole way.
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    const chip = chipOf(layer)!;
    expect(chip).toBeInstanceOf(L.Tooltip);
    expect(chip.options.className).toBe('route-chip');
    expect(chip.options.permanent).toBe(true);
  });

  it('puts the chip at the destination, not at the start', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    const at = chipOf(layer)!.getLatLng()!;
    expect(at.lat).toBeCloseTo(49.2105, 6);
    expect(at.lng).toBeCloseTo(16.6005, 6);
  });

  it('leaves the start dot to the position layer', () => {
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    expect(layer.getLayers().some((l) => l instanceof L.CircleMarker)).toBe(false);
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
    expect(layer.getLayers()).toHaveLength(3);
  });

  it('draws nothing for a degenerate one-point walk', () => {
    const layer = L.layerGroup();
    drawRoute(layer, { coords: [[16.6, 49.21]], lengthM: 0, gates: [] }, 'cz');
    expect(layer.getLayers()).toHaveLength(0);
  });



  it('is not the colour the buildings are drawn in', () => {
    // The route was #2563eb, which is exactly BUILDING_STYLE.color in
    // mapHelpers — the same hex as the footprints it threads between. Every
    // other hue on this map is taken: orange is the entrance
    // fan, green is the garden and the brand, grey is the path network.
    const layer = L.layerGroup();
    drawRoute(layer, walk, 'cz');
    const line = layer.getLayers()[1] as L.Polyline;
    expect(line.options.color).toBe(ROUTE_COLOR);
    expect(ROUTE_COLOR).not.toBe('#2563eb');
  });

  it('shows where you are even with no route at all', () => {
    // The bug this fixes: the dot lived inside drawRoute, so every answer that
    // is not a walk left the map with no "you are here" — the app talked about
    // a place it never pointed at.
    const layer = L.layerGroup();
    drawPosition(layer, [16.614118, 49.218161]);
    expect(layer.getLayers()).toHaveLength(3); // glow + white collar + core
    const dot = layer.getLayers()[2] as L.CircleMarker;
    expect(dot.getLatLng().lat).toBeCloseTo(49.218161, 6);
    expect(dot.getLatLng().lng).toBeCloseTo(16.614118, 6);
  });

  it('wears a white collar between the core and the map', () => {
    // The collar is what stops the dot reading as a smudge on whatever is
    // underneath — pale paper, garden green or a building fill.
    const layer = L.layerGroup();
    drawPosition(layer, [16.6, 49.21]);
    const [glow, collar, core] = layer.getLayers() as L.CircleMarker[];
    expect(collar.options.fillColor).toBe('#ffffff');
    expect(core.options.fillColor).toBe(ROUTE_COLOR);
    expect(glow.options.radius).toBeGreaterThan(collar.options.radius!);
    expect(collar.options.radius).toBeGreaterThan(core.options.radius!);
  });

  it('clears when the position is gone', () => {
    const layer = L.layerGroup();
    drawPosition(layer, [16.6, 49.21]);
    drawPosition(layer, null);
    expect(layer.getLayers()).toHaveLength(0);
  });
});
