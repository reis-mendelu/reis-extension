import { describe, it, expect } from 'vitest';
import { createRsvpBlockSync, type RsvpBlockSyncState } from '../rsvpBlockSync';
import type { CalendarCustomEvent } from '../../../types/calendarTypes';
import type { MapEvent } from '../../../types/events';

const event = (id: string): MapEvent =>
  ({
    id,
    title: 'Flag Party',
    date: '2026-09-21',
    time: '19:00',
    location: 'Zlatá loď',
  }) as MapEvent;

/** A store just real enough to interleave: every write takes a turn to land. */
function fakeStore(answered: boolean) {
  const state = {
    mapEvents: [event('a')],
    rsvp: (answered ? { a: 'interested' } : {}) as RsvpBlockSyncState['rsvp'],
    customEvents: [] as CalendarCustomEvent[],
    addCalendarCustomEvent: async (e: CalendarCustomEvent) => {
      await Promise.resolve();
      state.customEvents = [...state.customEvents, e];
    },
    updateCalendarCustomEvent: async (id: string, patch: Partial<CalendarCustomEvent>) => {
      await Promise.resolve();
      state.customEvents = state.customEvents.map((e) => (e.id === id ? { ...e, ...patch } : e));
    },
    removeCalendarCustomEvent: async (id: string) => {
      await Promise.resolve();
      state.customEvents = state.customEvents.filter((e) => e.id !== id);
    },
  };
  return state;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('createRsvpBlockSync', () => {
  it('adds the block for an answered event', async () => {
    const store = fakeStore(true);
    createRsvpBlockSync(() => store)();
    await settle();
    expect(store.customEvents.map((e) => e.id)).toEqual(['rsvp:a']);
  });

  /**
   * The race this serialisation exists for, raised in review: answer, withdraw,
   * and the two detached runs interleave at an await — the older plan adds the
   * block back after the newer one removed it, and the calendar keeps an event
   * the student pulled out of.
   */
  it('lets the last answer win when two runs overlap', async () => {
    const store = fakeStore(true);
    const refresh = createRsvpBlockSync(() => store);

    refresh(); // answered
    store.rsvp = {}; // ...withdrawn before the first run has finished
    refresh();
    await settle();

    expect(store.customEvents).toEqual([]);
  });

  it('never deletes a block the student made themselves', async () => {
    const store = fakeStore(false);
    const mine: CalendarCustomEvent = {
      id: 'custom-1',
      title: 'Gym',
      date: '20260921',
      startTime: '07:00',
      endTime: '08:00',
    };
    store.customEvents = [mine];

    createRsvpBlockSync(() => store)();
    await settle();

    expect(store.customEvents).toEqual([mine]);
  });

  it('moves the block when the society moves the event', async () => {
    const store = fakeStore(true);
    const refresh = createRsvpBlockSync(() => store);
    refresh();
    await settle();

    store.mapEvents = [{ ...event('a'), time: '20:00' } as MapEvent];
    refresh();
    await settle();

    expect(store.customEvents[0]).toMatchObject({ startTime: '20:00', endTime: '21:30' });
  });

  it('keeps the answer even when a calendar write throws', async () => {
    const store = fakeStore(true);
    store.addCalendarCustomEvent = async () => {
      throw new Error('IndexedDB is full');
    };
    const refresh = createRsvpBlockSync(() => store);
    expect(() => refresh()).not.toThrow();
    await settle();
    expect(store.customEvents).toEqual([]);
  });
});
