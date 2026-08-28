import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchEventRsvps = vi.fn();
const setEventRsvp = vi.fn();
vi.mock('../../../api/eventRsvp', () => ({
  fetchEventRsvps: (...a: unknown[]) => fetchEventRsvps(...a),
  setEventRsvp: (...a: unknown[]) => setEventRsvp(...a),
}));

const syncReminders = vi.fn();
vi.mock('../../../services/eventReminders/sync', () => ({
  syncReminders: (...a: unknown[]) => syncReminders(...a),
}));

import { createRsvpSlice, type RsvpSlice } from '../createRsvpSlice';
import type { MapEvent } from '../../../types/events';

describe('createRsvpSlice', () => {
  // The slice reads studentId and mapEvents off the composed store; the test
  // supplies just those two neighbours rather than the whole thing.
  let state: RsvpSlice & { studentId: string | null; mapEvents: MapEvent[] };
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchEventRsvps.mockReset().mockResolvedValue({ counts: {}, mine: {} });
    setEventRsvp.mockReset().mockResolvedValue(true);
    syncReminders.mockReset().mockResolvedValue(undefined);
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = { ...createRsvpSlice(set, get, {} as any), studentId: '123456', mapEvents: [] };
  });

  it('starts with no responses and no counts', () => {
    expect(state.rsvp).toEqual({});
    expect(state.rsvpCounts).toEqual({});
  });

  describe('loading real counts', () => {
    it('replaces the invented numbers with what the backend reports', async () => {
      fetchEventRsvps.mockResolvedValue({
        counts: { e1: { going: 4, interested: 2 } },
        mine: { e1: 'interested' },
      });
      await state.loadRsvps(['e1']);
      expect(fetchEventRsvps).toHaveBeenCalledWith(['e1'], '123456');
      expect(state.rsvpCounts.e1).toEqual({ going: 4, interested: 2 });
      expect(state.rsvp.e1).toBe('interested');
    });

    // An event nobody has answered is a real, honest zero — not a missing
    // number and certainly not a hashed-up 108.
    it('reports a genuine zero for an event with no attendance', async () => {
      fetchEventRsvps.mockResolvedValue({ counts: { e1: { going: 0, interested: 0 } }, mine: {} });
      await state.loadRsvps(['e1']);
      expect(state.rsvpCounts.e1).toEqual({ going: 0, interested: 0 });
    });

    it('does not ask about nothing', async () => {
      await state.loadRsvps([]);
      expect(fetchEventRsvps).not.toHaveBeenCalled();
    });
  });

  describe('answering', () => {
    it('shows the response immediately, before the write lands', async () => {
      let resolve!: (v: boolean) => void;
      setEventRsvp.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));
      const pending = state.setRsvp('e1', 'going');

      expect(state.rsvp.e1).toBe('going');
      expect(state.rsvpCounts.e1?.going).toBe(1);

      resolve(true);
      await pending;
      expect(state.rsvp.e1).toBe('going');
    });

    it('moves the count across when switching Going to Interested', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 2 } };
      await state.setRsvp('e1', 'going');
      expect(state.rsvpCounts.e1).toEqual({ going: 5, interested: 2 });
      await state.setRsvp('e1', 'interested');
      expect(state.rsvpCounts.e1).toEqual({ going: 4, interested: 3 });
    });

    it('tapping the active status clears the response and its count', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 0 } };
      await state.setRsvp('e1', 'going');
      expect(state.rsvpCounts.e1?.going).toBe(5);
      await state.setRsvp('e1', 'going');
      expect(state.rsvp.e1).toBeUndefined();
      expect(state.rsvpCounts.e1?.going).toBe(4);
      expect(setEventRsvp).toHaveBeenLastCalledWith('e1', '123456', null);
    });

    it('keeps per-event responses independent', async () => {
      await state.setRsvp('e1', 'going');
      await state.setRsvp('e2', 'interested');
      expect(state.rsvp).toEqual({ e1: 'going', e2: 'interested' });
    });

    // The whole point of replacing the mock is that the number on the card is
    // real. A count that only exists on this device is the same lie in a
    // smaller font, so a rejected write is rolled back.
    it('rolls back when the write is refused', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 2 } };
      setEventRsvp.mockResolvedValue(false);

      await state.setRsvp('e1', 'going');

      expect(state.rsvp.e1).toBeUndefined();
      expect(state.rsvpCounts.e1).toEqual({ going: 4, interested: 2 });
    });

    it('restores the previous answer, not just the absence of one', async () => {
      state.rsvpCounts = { e1: { going: 4, interested: 2 } };
      await state.setRsvp('e1', 'going');
      setEventRsvp.mockResolvedValue(false);

      await state.setRsvp('e1', 'interested');

      expect(state.rsvp.e1).toBe('going');
      expect(state.rsvpCounts.e1).toEqual({ going: 5, interested: 2 });
    });

    it('never drives a count below zero', async () => {
      state.rsvpCounts = { e1: { going: 0, interested: 0 } };
      state.rsvp = { e1: 'going' };
      await state.setRsvp('e1', 'going');
      expect(state.rsvpCounts.e1?.going).toBe(0);
    });
  });

  describe('reminders', () => {
    const party = {
      id: 'e1',
      title: 'Beánie PEF',
      url: '',
      date: '2999-09-10',
      endDate: null,
      time: '19:00',
      location: 'Q01',
      imageUrl: null,
      organizerKey: 'pef',
      societyId: 'supef',
      coord: [16.61, 49.21],
      roomCode: null,
      venueKind: 'campus',
      category: 'party',
    };

    it('schedules a reminder when the student says they are going', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      expect(syncReminders).toHaveBeenCalledWith([expect.objectContaining({ eventId: 'e1' })]);
    });

    // Backing out has to take the notification with it.
    it('drops the reminder when the student un-RSVPs', async () => {
      state.mapEvents = [party] as never;
      await state.setRsvp('e1', 'going');
      syncReminders.mockClear();
      await state.setRsvp('e1', 'going');
      expect(syncReminders).toHaveBeenCalledWith([]);
    });

    it('does not schedule anything off the back of a refused write', async () => {
      state.mapEvents = [party] as never;
      setEventRsvp.mockResolvedValue(false);
      await state.setRsvp('e1', 'going');
      expect(syncReminders).toHaveBeenCalledWith([]);
    });

    // Reopening the app restores the student's answers, so their reminders have
    // to come back with them — on a fresh install there is nothing pending.
    it('restores reminders for answers loaded from the backend', async () => {
      state.mapEvents = [party] as never;
      fetchEventRsvps.mockResolvedValue({
        counts: { e1: { going: 1, interested: 0 } },
        mine: { e1: 'going' },
      });
      await state.loadRsvps(['e1']);
      expect(syncReminders).toHaveBeenCalledWith([expect.objectContaining({ eventId: 'e1' })]);
    });
  });
});
