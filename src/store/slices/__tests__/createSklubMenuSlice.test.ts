import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SocietyPin, VenueLunchDay } from '../../../types/campusMap';

const fetchSklubMenu = vi.hoisted(() => vi.fn<() => Promise<VenueLunchDay[]>>());
vi.mock('../../../api/sklubMenu', () => ({ fetchSklubMenu }));
const fetchVenuePins = vi.hoisted(() => vi.fn<() => Promise<SocietyPin[] | null>>());
vi.mock('../../../api/venues', async (orig) => ({
  ...(await orig<typeof import('../../../api/venues')>()),
  fetchVenuePins,
}));
vi.mock('../../../api/mapEvents', async (orig) => ({
  ...(await orig<typeof import('../../../api/mapEvents')>()),
  fetchSocietyPins: vi.fn(async () => []),
}));

import { useAppStore } from '../../useAppStore';
import { venueRowToPin } from '../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../test/fixtures/sklubVenueRow';

const WEEK: VenueLunchDay[] = [{ date: '2026-11-09', soup: 'Bramboračka', dishes: ['150g Kuře'] }];
const SKLUB = venueRowToPin(SKLUB_VENUE_ROW)!;
const MIN = 10 * 60 * 1000;

/**
 * S-klub's menu is scraped on the device like SKM's. It is asked for only
 * when the map's venues include S-klub, so nothing reaches sklubpixie.cz
 * before the release creates the venues table.
 */
describe('createSklubMenuSlice', () => {
  beforeEach(() => {
    fetchSklubMenu.mockReset();
    fetchVenuePins.mockReset();
    useAppStore.setState({
      sklubMenu: [],
      sklubMenuFetchedAt: null,
      demoMode: false,
      venuePins: [],
    } as never);
  });

  it('fetches and stamps the week', async () => {
    fetchSklubMenu.mockResolvedValue(WEEK);
    await useAppStore.getState().refreshSklubMenu(MIN);
    expect(useAppStore.getState().sklubMenu).toEqual(WEEK);
    expect(useAppStore.getState().sklubMenuFetchedAt).not.toBeNull();
  });

  it('skips a fresh menu, refetches a stale one', async () => {
    fetchSklubMenu.mockResolvedValue(WEEK);
    useAppStore.setState({ sklubMenu: WEEK, sklubMenuFetchedAt: Date.now() } as never);
    await useAppStore.getState().refreshSklubMenu(MIN);
    expect(fetchSklubMenu).not.toHaveBeenCalled();
    useAppStore.setState({ sklubMenuFetchedAt: Date.now() - MIN - 1 } as never);
    await useAppStore.getState().refreshSklubMenu(MIN);
    expect(fetchSklubMenu).toHaveBeenCalledTimes(1);
  });

  it('a failed or empty refresh keeps the week in hand', async () => {
    useAppStore.setState({ sklubMenu: WEEK, sklubMenuFetchedAt: 0 } as never);
    fetchSklubMenu.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    await useAppStore.getState().refreshSklubMenu(MIN);
    expect(useAppStore.getState().sklubMenu).toEqual(WEEK);
    await useAppStore.getState().refreshSklubMenu(MIN);
    expect(useAppStore.getState().sklubMenu).toEqual(WEEK);
  });

  it('one request at a time', async () => {
    let resolve!: (d: VenueLunchDay[]) => void;
    fetchSklubMenu.mockReturnValue(new Promise((r) => (resolve = r)));
    const a = useAppStore.getState().refreshSklubMenu(MIN);
    const b = useAppStore.getState().refreshSklubMenu(MIN);
    resolve(WEEK);
    await Promise.all([a, b]);
    expect(fetchSklubMenu).toHaveBeenCalledTimes(1);
  });

  it('never in demo mode', async () => {
    useAppStore.setState({ demoMode: true } as never);
    await useAppStore.getState().refreshSklubMenu(MIN);
    expect(fetchSklubMenu).not.toHaveBeenCalled();
  });

  it('is asked for by the venue load only when S-klub is among the venues', async () => {
    fetchSklubMenu.mockResolvedValue(WEEK);
    fetchVenuePins.mockResolvedValueOnce([]);
    await useAppStore.getState().loadSocietyPins();
    expect(fetchSklubMenu).not.toHaveBeenCalled();
    fetchVenuePins.mockResolvedValueOnce([SKLUB]);
    await useAppStore.getState().loadSocietyPins();
    await vi.waitFor(() => expect(useAppStore.getState().sklubMenu).toEqual(WEEK));
  });
});
