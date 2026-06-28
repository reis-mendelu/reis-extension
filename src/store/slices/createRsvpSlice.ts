import type { AppSlice } from '../types';

export type RsvpStatus = 'going' | 'interested';

export interface RsvpSlice {
  /** The current user's RSVP per event id. Absent = no response. */
  rsvp: Record<string, RsvpStatus>;
  /** Toggle an RSVP: tapping the active status clears it, otherwise it switches. */
  setRsvp: (eventId: string, status: RsvpStatus) => void;
}

// The student's own Going / Interested response to society events. Mock-phase
// state: lives in memory only (resets on reload) — there is no attendance
// backend yet. When one lands, hydrate this from / persist it to IndexedDB.
export const createRsvpSlice: AppSlice<RsvpSlice> = (set, get) => ({
  rsvp: {},
  setRsvp: (eventId, status) => {
    const current = get().rsvp[eventId];
    const next = { ...get().rsvp };
    if (current === status) {
      delete next[eventId]; // tapping the active choice un-RSVPs
    } else {
      next[eventId] = status;
    }
    set({ rsvp: next });
  },
});
