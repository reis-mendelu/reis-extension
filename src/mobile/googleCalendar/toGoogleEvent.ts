import { contentHash, eventId } from './eventIdentity';
import type { DesiredEvent, GoogleEventBody, NormalizedEvent } from './types';

const EXAM_COLOR = '11'; // Google "Tomato": exams must stand out among ~500 lessons

export async function toDesired(n: NormalizedEvent): Promise<DesiredEvent> {
  const [id, hash] = await Promise.all([eventId(n.kind, n.key), contentHash(n)]);
  const body: GoogleEventBody = {
    id,
    summary: n.title,
    location: n.location,
    description: n.description,
    start: { dateTime: `${n.date}T${n.start}:00`, timeZone: 'Europe/Prague' },
    end: { dateTime: `${n.date}T${n.end}:00`, timeZone: 'Europe/Prague' },
    reminders: n.kind === 'exam' ? { useDefault: true } : { useDefault: false, overrides: [] },
    ...(n.kind === 'exam' ? { colorId: EXAM_COLOR } : {}),
    extendedProperties: { private: { reisKind: n.kind, reisHash: hash, reisV: '1' } },
  };
  return { id, kind: n.kind, date: n.date, hash, body };
}
