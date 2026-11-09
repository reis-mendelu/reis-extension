import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocietyPin } from '../../../types/campusMap';

const fetchSocietyPins = vi.hoisted(() => vi.fn<() => Promise<SocietyPin[] | null>>());
vi.mock('../../../api/mapEvents', async (orig) => ({
  ...(await orig<typeof import('../../../api/mapEvents')>()),
  fetchSocietyPins,
}));

const fetchVenuePinsMock = vi.hoisted(() => vi.fn<() => Promise<SocietyPin[] | null>>());
vi.mock('../../../api/venues', async (orig) => ({
  ...(await orig<typeof import('../../../api/venues')>()),
  fetchVenuePins: fetchVenuePinsMock,
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

describe('finding a venue from the map search', () => {
  const venue: SocietyPin = {
    ...pin,
    id: 'sklub',
    societyId: 'sklub',
    title: 'S-klub Pixie',
    venue: {
      kind: { cz: 'Kavárna', en: 'Café' },
      place: { cz: 'Budova Z', en: 'Building Z' },
      address: { cz: 'Přízemí FRRMS', en: 'FRRMS ground floor' },
      roomCode: 'BZ00N1015',
      hours: [],
      closure: null,
      lunch: null,
      lunchDays: [],
      menu: [],
      photos: [],
      instagram: null,
      source: null,
    },
  };

  beforeEach(() => useAppStore.setState({ venuePins: [venue], mapSearchQuery: '' }));

  it('the search lists the venue from venuePins', () => {
    useAppStore.getState().setMapSearchQuery('kavarna');
    expect(useAppStore.getState().mapSearchResults[0]).toEqual({ kind: 'societyPin', pin: venue });
  });

  it('choosing it leaves any floor plan, opens its card and moves the camera to it', () => {
    useAppStore.setState({
      activeBuildingId: 9000001,
      activeFloorId: 9000010,
      venueMenuSection: 'drinks',
      mapFocusTarget: 'draft',
    });
    const before = useAppStore.getState().mapFocusRequest;
    useAppStore.getState().focusSocietyPin(venue);
    const s = useAppStore.getState();
    expect(s.mapSelection).toEqual({ kind: 'societyPin', pin: venue });
    expect(s.activeBuildingId).toBeNull();
    expect(s.activeFloorId).toBeNull();
    expect(s.venueMenuSection).toBeNull();
    expect(s.mapFocusRequest).toBe(before + 1);
    expect(s.mapFocusTarget).toBe('campus');
  });
});

describe('venues arriving after the student typed', () => {
  it('re-runs the open query, so the venue shows without retyping', async () => {
    const venue: SocietyPin = {
      ...pin,
      id: 'sklub',
      title: 'S-klub Pixie',
      venue: {
        kind: { cz: 'Kavárna', en: 'Café' },
        place: { cz: 'Budova Z', en: 'Building Z' },
        address: { cz: 'Přízemí FRRMS', en: 'FRRMS ground floor' },
        roomCode: 'BZ00N1015',
        hours: [],
        closure: null,
        lunch: null,
        lunchDays: [],
        menu: [],
        photos: [],
        instagram: null,
        source: null,
      },
    };
    useAppStore.setState({ venuePins: [] });
    useAppStore.getState().setMapSearchQuery('pixie');
    expect(useAppStore.getState().mapSearchResults).toEqual([]);
    fetchSocietyPins.mockResolvedValueOnce(null);
    fetchVenuePinsMock.mockResolvedValueOnce([venue]);
    await useAppStore.getState().loadSocietyPins();
    expect(useAppStore.getState().mapSearchResults).toEqual([{ kind: 'societyPin', pin: venue }]);
  });
});
