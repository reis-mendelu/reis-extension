import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { drawGardenBubbles, GARDEN_PLACES } from '../gardenBubbleLayer';

describe('drawGardenBubbles', () => {
  it('adds one marker per garden place', () => {
    const layer = L.layerGroup();
    const n = drawGardenBubbles(layer, { lang: 'cz', touch: false, onSelect: () => {} });
    expect(n).toBe(GARDEN_PLACES.length);
    expect(layer.getLayers()).toHaveLength(GARDEN_PLACES.length);
  });

  it('hands the clicked place to onSelect', () => {
    const layer = L.layerGroup();
    const onSelect = vi.fn();
    drawGardenBubbles(layer, { lang: 'cz', touch: false, onSelect });
    (layer.getLayers()[0] as L.Marker).fire('click');
    expect(onSelect).toHaveBeenCalledWith(GARDEN_PLACES[0]);
  });

  it('rests bigger on a touch device, where there is no hover to grow it', () => {
    const mouse = L.layerGroup();
    const touch = L.layerGroup();
    drawGardenBubbles(mouse, { lang: 'cz', touch: false, onSelect: () => {} });
    drawGardenBubbles(touch, { lang: 'cz', touch: true, onSelect: () => {} });
    const size = (g: L.LayerGroup) =>
      ((g.getLayers()[0] as L.Marker).options.icon as L.DivIcon).options.iconSize as L.PointTuple;
    expect(size(touch)[0]).toBeGreaterThan(size(mouse)[0]);
    expect(size(touch)[0]).toBeGreaterThanOrEqual(44);
  });

  it('labels each bubble in the chosen language', () => {
    const cz = L.layerGroup();
    drawGardenBubbles(cz, { lang: 'cz', touch: false, onSelect: () => {} });
    expect((cz.getLayers()[0] as L.Marker).getTooltip()!.getContent()).toBe(
      GARDEN_PLACES[0]!.name.cz
    );
  });
});
