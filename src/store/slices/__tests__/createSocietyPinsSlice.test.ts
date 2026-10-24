import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocietyPin } from '../../../types/campusMap';

const fetchSocietyPins = vi.hoisted(() => vi.fn<() => Promise<SocietyPin[] | null>>());
vi.mock('../../../api/mapEvents', async (orig) => ({
  ...(await orig<typeof import('../../../api/mapEvents')>()),
  fetchSocietyPins,
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
