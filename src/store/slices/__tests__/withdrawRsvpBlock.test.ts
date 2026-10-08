import { describe, it, expect, vi, beforeEach } from 'vitest';

const setEventRsvp = vi.fn();
vi.mock('../../../api/eventRsvp', () => ({
  fetchEventRsvps: vi.fn(async () => ({ counts: {}, ok: true })),
  setEventRsvp: (...a: unknown[]) => setEventRsvp(...a),
}));

const idb = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));

vi.mock('../../../services/eventReminders/sync', () => ({
  askNotificationPermission: vi.fn(async () => 'granted'),
}));

import { createRsvpSlice, type RsvpSlice } from '../createRsvpSlice';
import type { CalendarCustomEvent } from '../../../types/calendarTypes';
import type { MapEvent } from '../../../types/events';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const event = {
  id: 'e1',
  title: 'Flag Party',
  date: '2026-11-21',
  time: '19:00',
  location: 'Zlatá loď',
} as MapEvent;

type State = RsvpSlice & {
  mapEvents: MapEvent[];
  customEvents: CalendarCustomEvent[];
  notifyPrefs: { myEvents: boolean };
  replanNotifications: () => void;
  setNotifyPermission: () => void;
  addCalendarCustomEvent: (e: CalendarCustomEvent) => Promise<void>;
  updateCalendarCustomEvent: (id: string, p: Partial<CalendarCustomEvent>) => Promise<void>;
  removeCalendarCustomEvent: (id: string) => Promise<void>;
};

/**
 * "Odebrat z kalendáře" on an answered society event.
 *
 * The block is DERIVED from the answer, so deleting it as a plain custom event
 * only lasted until the next reconciliation put it back — on the next answer,
 * the next launch. Removing it has to mean withdrawing the answer it stands for.
 */
describe('withdrawRsvpBlock', () => {
  let state: State;

  /** A fresh slice over the shared fake disk — a new one is a new launch. */
  const launch = (customEvents: CalendarCustomEvent[] = []) => {
    const set = (updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    };
    const get = () => state;
    state = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createRsvpSlice(set as any, get as any, {} as any),
      mapEvents: [event],
      customEvents,
      notifyPrefs: { myEvents: false },
      replanNotifications: () => {},
      setNotifyPermission: () => {},
      addCalendarCustomEvent: async (e) =>
        set((s: State) => ({ customEvents: [...s.customEvents, e] })),
      updateCalendarCustomEvent: async (id, p) =>
        set((s: State) => ({
          customEvents: s.customEvents.map((e) => (e.id === id ? { ...e, ...p } : e)),
        })),
      removeCalendarCustomEvent: async (id) =>
        set((s: State) => ({ customEvents: s.customEvents.filter((e) => e.id !== id) })),
    };
  };

  beforeEach(() => {
    idb.clear();
    setEventRsvp.mockReset().mockResolvedValue(true);
    launch();
  });

  it('withdraws the answer, and the block stays gone after the next reconciliation', async () => {
    idb.set('event_rsvps_mine', { e1: 'interested' });
    await state.loadRsvps(['e1']);
    await flush();
    expect(state.customEvents.map((e) => e.id)).toEqual(['rsvp:e1']);

    await state.withdrawRsvpBlock('rsvp:e1');
    await flush();

    expect(setEventRsvp).toHaveBeenCalledWith('e1', null);
    expect(state.rsvp).toEqual({});
    expect(state.customEvents).toEqual([]);

    // The next launch, from a NEW slice: the same one would skip hydrating an
    // id it has already touched, and so could not see a stale answer on disk
    // (raised in review). Worst case for the calendar too — it still holds the
    // block, as if it had been persisted before the removal landed.
    launch([
      {
        id: 'rsvp:e1',
        title: 'Flag Party',
        date: '20261121',
        startTime: '19:00',
        endTime: '20:30',
      },
    ]);
    await state.loadRsvps(['e1']);
    await flush();
    expect(idb.get('event_rsvps_mine')).toEqual({});
    expect(state.rsvp).toEqual({});
    expect(state.customEvents).toEqual([]);
  });

  it('never ANSWERS an event it holds no answer for', async () => {
    // setRsvp is a toggle; withdrawing an event with no answer must not be
    // read as "Mám zájem".
    await state.withdrawRsvpBlock('rsvp:e1');
    await flush();

    expect(setEventRsvp).not.toHaveBeenCalled();
    expect(state.rsvp).toEqual({});
  });

  it('ignores an entry the student typed in themselves', async () => {
    await state.withdrawRsvpBlock('custom-1');
    await flush();

    expect(setEventRsvp).not.toHaveBeenCalled();
  });
});
