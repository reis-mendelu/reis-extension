import { contentHash, eventId } from './eventIdentity';
import type { DesiredEvent, GoogleEventBody, NormalizedEvent } from './types';

const EXAM_COLOR = '11'; // Google "Tomato": exams must stand out among ~500 lessons

/** The day after an ISO date, for an event that ends past midnight. */
function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function toDesired(n: NormalizedEvent): Promise<DesiredEvent> {
  const [id, hash] = await Promise.all([eventId(n.kind, n.key), contentHash(n)]);
  const body: GoogleEventBody = {
    id,
    summary: n.title,
    location: n.location,
    description: n.description,
    start: { dateTime: `${n.date}T${n.start}:00`, timeZone: 'Europe/Prague' },
    // HH:mm compares as text. An end before the start is past midnight; sent
    // as-is, Google rejects the write and the whole run fails.
    end: {
      dateTime: `${n.end < n.start ? nextDay(n.date) : n.date}T${n.end}:00`,
      timeZone: 'Europe/Prague',
    },
    reminders: n.kind === 'exam' ? { useDefault: true } : { useDefault: false, overrides: [] },
    ...(n.kind === 'exam' ? { colorId: EXAM_COLOR } : {}),
    extendedProperties: { private: { reisKind: n.kind, reisHash: hash, reisV: '1' } },
  };
  return { id, kind: n.kind, date: n.date, hash, body };
}
