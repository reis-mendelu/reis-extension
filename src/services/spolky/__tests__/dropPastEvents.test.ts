import { describe, it, expect } from 'vitest';
import { dropPastEvents } from '../spolkyService';
import type { SpolekNotification } from '../types';

/**
 * A society event stops being news the day after it happened.
 *
 * "Deskovky notification still shows and highlights even a day after they
 * happened." The server query already asks for `date >= today`, so a fresh
 * fetch never carries a past event — but the feed is also served from
 * `notifications_cache` in IndexedDB, which is written whenever a fetch lands
 * and is never re-examined afterwards. Nothing on the client has ever asked how
 * old any of it is, so an event that was current when the cache was written
 * stays in the feed, unread and highlighted, until some later fetch happens to
 * overwrite it.
 *
 * Day granularity, and the comparison is LOCAL. The server's filter is built
 * from `new Date().toISOString()`, which is UTC: between local midnight and
 * 02:00 CEST that string is still yesterday's date, so even the server keeps a
 * finished event for a couple of hours. The client is where the student is, so
 * the client uses the student's day.
 */
function event(over: Partial<SpolekNotification> = {}): SpolekNotification {
  return {
    id: 'e1',
    associationId: 'supef',
    title: 'Deskovky',
    body: 'Deskovky',
    createdAt: '2026-09-01T10:00:00Z',
    expiresAt: '2026-09-04',
    priority: 'normal',
    ...over,
  };
}

const TODAY = '2026-09-16';

describe('dropPastEvents', () => {
  it('drops an event whose day is behind us', () => {
    expect(dropPastEvents([event({ expiresAt: '2026-09-15' })], TODAY)).toEqual([]);
  });

  it("keeps today's event for the whole day", () => {
    // Deskovky at 19:00 is still news at 09:00, and the row carries no time.
    const today = event({ expiresAt: TODAY });
    expect(dropPastEvents([today], TODAY)).toEqual([today]);
  });

  it('keeps an event still to come', () => {
    const soon = event({ expiresAt: '2026-09-20' });
    expect(dropPastEvents([soon], TODAY)).toEqual([soon]);
  });

  it('keeps a multi-day event that is running right now', () => {
    // `expiresAt` is `end_date || date`, so a festival that started last week
    // and ends on Sunday is judged on the END, which is the point of the column.
    const running = event({ expiresAt: '2026-09-20' });
    expect(dropPastEvents([running], TODAY)).toEqual([running]);
  });

  it('reads a full timestamp as its day', () => {
    // Academic rows carry a real ISO timestamp rather than a bare date.
    expect(dropPastEvents([event({ expiresAt: '2026-09-15T23:59:00Z' })], TODAY)).toEqual([]);
    const later = event({ expiresAt: '2026-09-16T00:01:00Z' });
    expect(dropPastEvents([later], TODAY)).toEqual([later]);
  });

  it('keeps anything it cannot date, rather than hiding it', () => {
    // Silently swallowing a notification is worse than showing a stale one:
    // one is a nuisance, the other is a society's announcement never arriving.
    const undated = event({ expiresAt: '' });
    const nonsense = event({ id: 'e2', expiresAt: 'sometime' });
    expect(dropPastEvents([undated, nonsense], TODAY)).toEqual([undated, nonsense]);
  });

  it('keeps the order it was given', () => {
    const a = event({ id: 'a', expiresAt: '2026-09-17' });
    const old = event({ id: 'old', expiresAt: '2026-09-01' });
    const b = event({ id: 'b', expiresAt: '2026-09-18' });
    expect(dropPastEvents([a, old, b], TODAY).map((n) => n.id)).toEqual(['a', 'b']);
  });
});
