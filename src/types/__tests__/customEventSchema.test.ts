import { describe, it, expect } from 'vitest';
import { CalendarCustomEventSchema } from '../storage';

describe('CalendarCustomEventSchema', () => {
  it('keeps a library booking’s room and cancel keys through storage', () => {
    // Without them a booking came back from IndexedDB as a plain own event:
    // not cancellable, not even recognised as the library's (2026-11-16).
    const event = {
      id: 'library:A1',
      title: 'Studovna v knihovně',
      date: '20261120',
      startTime: '09:00',
      endTime: '11:00',
      room: 'Týmová 2',
      libraryBooking: { featureId: 57627, selfServiceIds: ['S1', 'S2'] },
    };
    expect(CalendarCustomEventSchema.parse(event)).toEqual(event);
    const unconfirmed = {
      ...event,
      libraryBooking: { featureId: 57627, selfServiceIds: [], unconfirmed: true },
    };
    expect(CalendarCustomEventSchema.parse(unconfirmed)).toEqual(unconfirmed);
  });
});
