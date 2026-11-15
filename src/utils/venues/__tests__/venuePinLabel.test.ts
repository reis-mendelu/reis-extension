import { describe, it, expect } from 'vitest';
import { venuePinLabel } from '../venuePinLabel';
import type { SocietyPin, Venue } from '../../../types/campusMap';

// Wednesday 2026-11-18, 12:00 in Prague.
const NOON_WED = new Date('2026-11-18T11:00:00Z');

const venue = (hours: Venue['hours']): SocietyPin => ({
  id: 'venue:sklub',
  societyId: 'sklub',
  title: 'S-klub Pixie',
  description: null,
  url: null,
  coord: [16.614, 49.218],
  venue: { hours, closure: null } as unknown as Venue,
});

describe('venuePinLabel', () => {
  it('is the name alone while the venue is open', () => {
    const pin = venue([{ day: 3, open: '08:00', close: '20:00' }]);
    expect(venuePinLabel(pin, NOON_WED, 'zavřeno')).toEqual({ open: true, label: 'S-klub Pixie' });
  });

  it('adds "· zavřeno" while it is closed', () => {
    const pin = venue([{ day: 3, open: '18:00', close: '22:00' }]);
    expect(venuePinLabel(pin, NOON_WED, 'zavřeno')).toEqual({
      open: false,
      label: 'S-klub Pixie · zavřeno',
    });
  });

  it('is the plain title for a society pin, which has no hours', () => {
    const pin = { ...venue([]), venue: undefined };
    expect(venuePinLabel(pin, NOON_WED, 'zavřeno')).toEqual({ open: true, label: 'S-klub Pixie' });
  });
});
