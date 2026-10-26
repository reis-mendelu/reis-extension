import { describe, it, expect, afterEach } from 'vitest';
import L from 'leaflet';
import { initLeafletMap } from '../mapLayers';

// Návrhy #27 (Android, 2026-10): "rozmazaná obrazovka při přiblížení". Measured
// on a Pixel 9a: OSM serves nothing deeper than z19, so the map's z22 stretched
// one z19 tile 8× — the street label in budova Q's courtyard became a grey smear
// while the vector floor plan above it stayed sharp. The basemap now stops one
// level past its deepest tile; the map itself still zooms to 22, because that is
// where the small rooms of E, X and C become big enough to tap.
describe('initLeafletMap zoom ceilings', () => {
  let map: L.Map | null = null;
  let el: HTMLDivElement | null = null;
  afterEach(() => {
    // map.remove() tears down Leaflet's DOM but leaves the container itself.
    map?.remove();
    el?.remove();
    map = null;
    el = null;
  });

  const init = () => {
    el = document.createElement('div');
    document.body.appendChild(el);
    map = initLeafletMap(el, [
      [49.209, 16.613],
      [49.212, 16.619],
    ]);
    let tiles: L.TileLayer | null = null;
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) tiles = l;
    });
    expect(tiles).not.toBeNull();
    return { map, tiles: tiles! as L.TileLayer };
  };

  it('never stretches a basemap tile more than 2×', () => {
    const { tiles } = init();
    const { maxZoom, maxNativeZoom } = tiles.options;
    expect(maxNativeZoom).toBe(19); // OSM's deepest level
    expect(maxZoom! - maxNativeZoom!).toBeLessThanOrEqual(1);
  });

  it('keeps zooming past the basemap so small rooms stay tappable', () => {
    const { map: m, tiles } = init();
    expect(m.getMaxZoom()).toBe(22);
    expect(m.getMaxZoom()).toBeGreaterThan(tiles.options.maxZoom!);
  });
});

// The pins draw Twemoji SVGs, which are CC BY 4.0: the credit sits beside
// OpenStreetMap's in the one attribution line the map already shows.
describe('initLeafletMap attribution', () => {
  let map: L.Map | null = null;
  let el: HTMLDivElement | null = null;
  afterEach(() => {
    map?.remove();
    el?.remove();
    map = null;
    el = null;
  });

  it('credits Twemoji next to OpenStreetMap', () => {
    el = document.createElement('div');
    document.body.appendChild(el);
    map = initLeafletMap(el, [
      [49.209, 16.613],
      [49.212, 16.619],
    ]);
    const text = el.querySelector('.leaflet-control-attribution')?.textContent ?? '';
    expect(text).toContain('OpenStreetMap');
    expect(text).toContain('Twemoji');
    expect(text).toContain('CC BY 4.0');
    // CC BY 4.0 asks for the licence's URI next to the credit.
    const licence = [...el.querySelectorAll('.leaflet-control-attribution a')].find(
      (a) => a.textContent === 'CC BY 4.0'
    );
    expect(licence?.getAttribute('href')).toBe('https://creativecommons.org/licenses/by/4.0/');
  });
});
