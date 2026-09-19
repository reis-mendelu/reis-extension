import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { drawGardenBubbles, GARDEN_PLACES } from '../gardenBubbleLayer';
import type { GardenPlace } from '../../../types/campusMap';

/** A place that HAS a photograph, so it draws as a bubble rather than a dot. */
const PHOTOGRAPHED: GardenPlace[] = [
  {
    id: 'rokle',
    number: '2.6',
    section: 2,
    name: { cz: 'Rokle', en: 'The ravine' },
    why: { cz: 'Zarostlý zářez.', en: 'An overgrown cut.' },
    lon: 16.6123,
    lat: 49.2141,
    photo: 'rokle.8f3a1c.webp',
  },
];

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

  it('draws a plain dot, not an empty ring, for a place with no photograph yet', () => {
    const layer = L.layerGroup();
    const noPhoto = { ...PHOTOGRAPHED[0]!, id: 'terasy', photo: undefined };
    drawGardenBubbles(layer, { lang: 'cz', touch: false, onSelect: () => {} }, [
      PHOTOGRAPHED[0]!,
      noPhoto,
    ]);
    const bubbles = layer
      .getLayers()
      .filter((l) => l instanceof L.Marker && !(l instanceof L.CircleMarker));
    const dots = layer.getLayers().filter((l) => l instanceof L.CircleMarker);
    expect(bubbles).toHaveLength(1);
    expect(dots).toHaveLength(1);
  });

  it('rests bigger on a touch device, where there is no hover to grow it', () => {
    const mouse = L.layerGroup();
    const touch = L.layerGroup();
    drawGardenBubbles(mouse, { lang: 'cz', touch: false, onSelect: () => {} }, PHOTOGRAPHED);
    drawGardenBubbles(touch, { lang: 'cz', touch: true, onSelect: () => {} }, PHOTOGRAPHED);
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
