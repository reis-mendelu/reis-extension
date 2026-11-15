import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { SocietyPinLayer } from '../SocietyPinLayer';
import { SportPlaceLayer } from '../SportPlaceLayer';
import { setMapInstance } from '../mapInstance';
import { useAppStore } from '../../../store/useAppStore';
import { EVENTS_PANE } from '../mapPanes';
import type { SocietyPin, Venue } from '../../../types/campusMap';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fakeMap: any;
let pinsPane: HTMLElement;

/** No opening hours at all: closed every minute of the week. */
const closedVenue: SocietyPin = {
  id: 'venue:sklub',
  societyId: 'sklub',
  title: 'S-klub Pixie',
  description: null,
  url: null,
  coord: [16.61439, 49.21817],
  venue: { hours: [], closure: null } as unknown as Venue,
};

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
    venuePins: [closedVenue],
  });
  setMapInstance(fakeMap);
});

afterEach(() => {
  cleanup();
  setMapInstance(null);
});

const venuePin = () => pinsPane.querySelector<HTMLElement>('[data-testid="society-pin"]')!;
/** The round face a pin draws: the button's first child. */
const face = (button: HTMLElement) => button.firstElementChild as HTMLElement;

describe('a venue on the map (decided 2026-11-15)', () => {
  it('is a standard pin until tapped: the same face as a sport pin, no name, no open or closed', () => {
    render(
      <>
        <SocietyPinLayer />
        <SportPlaceLayer />
      </>
    );
    const venue = venuePin();
    const sport = pinsPane.querySelector<HTMLElement>('[data-testid="sport-pin"]')!;
    expect(face(venue).style.width).toBe(face(sport).style.width);
    expect(face(venue).style.height).toBe(face(sport).style.height);
    expect(venue.style.padding).toBe(sport.style.padding);
    expect(venue.textContent).not.toContain('S-klub Pixie');
    expect(venue.textContent).not.toContain('zavřeno');
    expect(venue.innerHTML).not.toContain('opacity-60');
    expect(venue.getAttribute('aria-label')).toBe('S-klub Pixie');
  });

  it('names itself once tapped, as a sport pin does', () => {
    render(<SocietyPinLayer />);
    act(() => useAppStore.getState().selectSocietyPin(closedVenue));
    expect(venuePin().textContent).toContain('S-klub Pixie');
    expect(venuePin().textContent).not.toContain('zavřeno');
  });
});
