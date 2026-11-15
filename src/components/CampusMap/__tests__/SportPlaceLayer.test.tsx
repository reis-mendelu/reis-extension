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

  it('draws none over a floor plan', () => {
    render(<SportPlaceLayer />);
    act(() => useAppStore.setState({ activeBuildingId: 3 }));
    expect(pinsPane.querySelectorAll('[data-testid="sport-pin"]')).toHaveLength(0);
  });
});
