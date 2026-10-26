import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    getAllWithKeys: vi.fn(async () => [
      { key: 'rsvp:e1', value: { id: 'rsvp:e1', title: 'Old RSVP block' } },
      { key: 'mine-1', value: { id: 'mine-1', title: 'Zubař' } },
    ]),
  },
}));

import { createCustomEventsSlice } from '../createCustomEventsSlice';
import type { CalendarCustomEventsSlice } from '../../types';

/**
 * A retired RSVP block the one-time cleanup could not delete yet has nothing
 * that can remove it any more (spec 2026-10-08), so it is never drawn.
 */
describe('loadCalendarCustomEvents', () => {
  it('skips retired RSVP blocks', async () => {
    let state = {} as CalendarCustomEventsSlice;
    const set = (patch: Partial<CalendarCustomEventsSlice>) => {
      state = { ...state, ...patch };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createCustomEventsSlice(set as any, () => state as any, {} as any);
    await state.loadCalendarCustomEvents();
    expect(state.customEvents.map((e) => e.id)).toEqual(['mine-1']);
  });
});
