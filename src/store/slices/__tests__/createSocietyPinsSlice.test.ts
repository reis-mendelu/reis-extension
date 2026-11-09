import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocietyPin } from '../../../types/campusMap';

const fetchSocietyPins = vi.hoisted(() => vi.fn<() => Promise<SocietyPin[] | null>>());
vi.mock('../../../api/mapEvents', async (orig) => ({
  ...(await orig<typeof import('../../../api/mapEvents')>()),
  fetchSocietyPins,
}));

// Hermetic: unmocked, the venues read went to the real Supabase and the load
// timed out whenever the network was slow.
vi.mock('../../../api/venues', async (orig) => ({
  ...(await orig<typeof import('../../../api/venues')>()),
  fetchVenuePins: vi.fn(async () => null),
}));

import { useAppStore } from '../../useAppStore';

const pin: SocietyPin = {
  id: 'p1',
  societyId: 'vazbic',
  title: 'Vazbič',
  description: null,
  url: null,
  coord: [16.61, 49.21],
};

describe('society pins', () => {
  beforeEach(() => useAppStore.setState({ societyPins: [], mapSelection: null }));

  it('loads the live pins, and keeps them when a later read fails', async () => {
    fetchSocietyPins.mockResolvedValueOnce([pin]).mockResolvedValueOnce(null);
    await useAppStore.getState().loadSocietyPins();
    expect(useAppStore.getState().societyPins).toEqual([pin]);
    await useAppStore.getState().loadSocietyPins();
    expect(useAppStore.getState().societyPins).toEqual([pin]);
  });

  it('a tapped pin becomes the map selection, never one of the events', () => {
    useAppStore.getState().selectSocietyPin(pin);
    expect(useAppStore.getState().mapSelection).toEqual({ kind: 'societyPin', pin });
    expect(useAppStore.getState().mapEvents.some((e) => e.id === pin.id)).toBe(false);
  });
});

/**
 * "Celé menu a ceny" in the Jídelníček's S-klub tab: the venue card on the
 * map. The extension switches to the map view only on a `mapFocusRequest`
 * bump (useAppLogic), and pins are not drawn over a floor plan, so the jump
 * leaves any open building and asks the canvas to move.
 */
describe('showVenueOnMap', () => {
  it('selects the pin, leaves any building and asks the canvas to move', () => {
    useAppStore.setState({
      mapSelection: null,
      activeBuildingId: 9000001,
      activeFloorId: 9000010,
      venueMenuSection: 'coffee',
      mapFocusRequest: 4,
      mapRailOpen: false,
    } as never);
    useAppStore.getState().showVenueOnMap(pin);
    const s = useAppStore.getState();
    expect(s.mapSelection).toEqual({ kind: 'societyPin', pin });
    expect(s.activeBuildingId).toBeNull();
    expect(s.activeFloorId).toBeNull();
    expect(s.venueMenuSection).toBeNull();
    expect(s.mapFocusRequest).toBe(5);
    expect(s.mapFocusTarget).toBe('campus');
    // The iPad rail opens with it, so the camera clears it.
    expect(s.mapRailOpen).toBe(true);
  });
});
