import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { SportPlaceLayer } from '../SportPlaceLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { EVENTS_PANE } from '../mapPanes';
import { SPORT_PLACES } from '../sportPlaces';

/**
 * A map that projects [lat, lng] far apart (1 m ≈ 10 px), so no two places
 * overlap and none is moved: what is drawn is just the places themselves.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fakeMap: any;
let pinsPane: HTMLElement;

beforeEach(() => {
  pinsPane = document.createElement('div');
  const panes = new Map<string, HTMLElement>();
  fakeMap = {
    getPane: (n: string) => panes.get(n),
    createPane: (n: string) => {
      const el = n === EVENTS_PANE ? pinsPane : document.createElement('div');
      panes.set(n, el);
      return el;
    },
    getZoom: () => 17,
    latLngToLayerPoint: (ll: [number, number] | { lat: number; lng: number }) => {
      const [lat, lng] = Array.isArray(ll) ? ll : [ll.lat, ll.lng];
      return { x: (lng - 16.6) * 1e6, y: (49.22 - lat) * 1e6 };
    },
    _latLngToNewLayerPoint: () => ({ round: () => ({ x: 0, y: 0 }) }),
    on: () => {},
    off: () => {},
  };
  useAppStore.setState({
    activeBuildingId: null,
    mapSelection: null,
    language: 'cz',
    societyPins: [],
    venuePins: [],
  });
  setMapInstance(fakeMap);
});

afterEach(() => {
  cleanup();
  setMapInstance(null);
});

describe('SportPlaceLayer', () => {
  it('draws every place on the campus map, with nothing to switch on', () => {
    render(<SportPlaceLayer />);
    const pins = [...pinsPane.querySelectorAll('[data-testid="sport-pin"]')];
    expect(pins.map((p) => p.getAttribute('aria-label')).sort()).toEqual(
      SPORT_PLACES.map((p) => p.name).sort()
    );
  });

  /** Where each pin is drawn, and where its own place projects, at `pxPerDeg`. */
  function drawnAt(pxPerDeg: number) {
    const project = (lat: number, lng: number) => ({
      x: (lng - 16.6) * pxPerDeg,
      y: (49.22 - lat) * pxPerDeg,
    });
    fakeMap.latLngToLayerPoint = (ll: [number, number] | { lat: number; lng: number }) =>
      Array.isArray(ll) ? project(ll[0], ll[1]) : project(ll.lat, ll.lng);
    const { unmount } = render(<SportPlaceLayer />);
    const out = [...pinsPane.querySelectorAll<HTMLElement>('[data-testid="sport-pin"]')].map(
      (el) => {
        const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform)!;
        const place = SPORT_PLACES.find((p) => p.name === el.getAttribute('aria-label'))!;
        const own = project(place.coord[1], place.coord[0]);
        return { place, x: Number(m[1]), y: Number(m[2]), own };
      }
    );
    unmount();
    return out;
  }

  it('keeps every pin on its own place, however far out the map is zoomed', () => {
    // On the Pixel, zoomed out, pins pushed off S-klub's label and away from
    // each other ended up streets away from where the place is. S-klub's own
    // pin is there now to show it no longer pushes anything.
    useAppStore.setState({
      venuePins: [
        {
          id: 'venue:sklub',
          societyId: 'sklub',
          title: 'S-klub Pixie',
          description: null,
          url: null,
          coord: [16.61439, 49.21817],
          venue: { hours: [], closure: null } as never,
        },
      ],
    });
    for (const pxPerDeg of [1e4, 1e5, 1e6]) {
      const pins = drawnAt(pxPerDeg);
      expect(pins).toHaveLength(SPORT_PLACES.length);
      for (const p of pins) {
        // At most half a gap: the one move a pin at a shared spot makes.
        expect(Math.hypot(p.x - p.own.x, p.y - p.own.y), p.place.id).toBeLessThanOrEqual(20.5);
      }
    }
  });

  it("sets places at one spot side by side, far enough apart that one's tap area misses the other", () => {
    // Zoomed far out (1 m ≈ 0.1 px): the court and pitch at Schreberovy and the
    // Lužánky and Píky pairs start on top of each other. A chosen pin's tap
    // area reaches 25 px; a resting neighbour's face is 14 px from its centre
    // (Greptile, PR 679).
    const pins = drawnAt(1e4);
    const metres = (a: [number, number], b: [number, number]) =>
      Math.hypot((a[0] - b[0]) * 72_800, (a[1] - b[1]) * 111_320);
    let pairs = 0;
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i]!;
        const b = pins[j]!;
        if (metres(a.place.coord, b.place.coord) > 50) continue;
        pairs++;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(25 + 14);
      }
    }
    expect(pairs).toBe(3);
  });

  it('draws none over a floor plan', () => {
    render(<SportPlaceLayer />);
    act(() => useAppStore.setState({ activeBuildingId: 3 }));
    expect(pinsPane.querySelectorAll('[data-testid="sport-pin"]')).toHaveLength(0);
  });
});
