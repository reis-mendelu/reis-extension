import type { VenueHours } from '../../types/campusMap';

export type VenueStatus =
  | { open: true; closes: string }
  /** `day` is the ISO weekday it next opens; null when it never does. */
  | { open: false; opens: string | null; day: VenueHours['day'] | null };

/** Weekday (1 = Monday) and 'HH:MM' in Prague, whatever the device's zone. */
export function pragueClock(now: Date): { day: VenueHours['day']; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const day = (days.indexOf(get('weekday')) + 1) as VenueHours['day'];
  // en-GB writes midnight as 24 in some engines.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { day, time: `${hour}:${get('minute')}` };
}

/**
 * Open now, and until when — or when it next opens. Hours are local Prague
 * time, as a café states them, so the answer is the same on a phone set to
 * any time zone. Holidays and one-off closures are not modelled: the card
 * says where the hours come from.
 */
export function venueStatus(hours: VenueHours[], now: Date): VenueStatus {
  const { day, time } = pragueClock(now);
  const today = hours.find((h) => h.day === day);
  if (today && time >= today.open && time < today.close) return { open: true, closes: today.close };
  if (today && time < today.open) return { open: false, opens: today.open, day };
  for (let i = 1; i <= 7; i++) {
    const next = (((day - 1 + i) % 7) + 1) as VenueHours['day'];
    const h = hours.find((x) => x.day === next);
    if (h) return { open: false, opens: h.open, day: next };
  }
  return { open: false, opens: null, day: null };
}
