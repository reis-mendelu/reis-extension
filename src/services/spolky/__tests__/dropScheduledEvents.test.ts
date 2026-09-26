import { describe, it, expect } from 'vitest';
import { dropScheduledEvents } from '../dropScheduledEvents';
import type { SpolekNotification } from '../types';

/**
 * A society event reaches Novinky when it reaches the map, not before.
 *
 * The console files an event 14+ days out under "Naplánované — zveřejní se
 * <date>", and the map honours that through `isPublicEvent`. Novinky did not:
 * `fetchNotifications` only asks for `date >= today`, and `visible_from` is null
 * on every row, so a subscriber saw the event — and it collected views and
 * clicks the society is shown — from the moment it was published, while the
 * console told its author it was still hidden.
 *
 * Judged on the event's START (`startsAt`), as the map judges it, so a
 * multi-day event goes live by when it begins, not when it ends.
 */
function event(over: Partial<SpolekNotification> = {}): SpolekNotification {
  return {
    id: 'e1',
    associationId: 'supef',
    title: 'Ples',
    body: 'Ples',
    createdAt: '2026-09-01T10:00:00Z',
    expiresAt: '2026-09-20',
    startsAt: '2026-09-20',
    priority: 'normal',
    ...over,
  };
}

// Local noon, so no timezone puts it on a different calendar day.
const NOW = new Date(2026, 8, 16, 12, 0, 0);

describe('dropScheduledEvents', () => {
  it('keeps an event on the last day of the public window (day 13)', () => {
    const lastDay = event({ startsAt: '2026-09-29', expiresAt: '2026-09-29' });
    expect(dropScheduledEvents([lastDay], NOW)).toEqual([lastDay]);
  });

  it('drops an event the console calls scheduled (day 14 and on)', () => {
    const scheduled = event({ startsAt: '2026-09-30', expiresAt: '2026-09-30' });
    const farOut = event({ id: 'e2', startsAt: '2026-12-12', expiresAt: '2026-12-12' });
    expect(dropScheduledEvents([scheduled, farOut], NOW)).toEqual([]);
  });

  it('judges a multi-day event on its start, not its end', () => {
    const startsSoon = event({ startsAt: '2026-09-25', expiresAt: '2026-10-10' });
    const startsLater = event({ id: 'e2', startsAt: '2026-10-01', expiresAt: '2026-10-03' });
    expect(dropScheduledEvents([startsSoon, startsLater], NOW)).toEqual([startsSoon]);
  });

  it('keeps a row that carries no start date', () => {
    // Academic/admin rows, and caches written before `startsAt` existed. The
    // next fetch fills it in; hiding an announcement on a missing field is the
    // worse failure, as in dropPastEvents.
    const noStart = event({ startsAt: undefined, expiresAt: '2026-12-12' });
    const nonsense = event({ id: 'e2', startsAt: 'sometime' });
    expect(dropScheduledEvents([noStart, nonsense], NOW)).toEqual([noStart, nonsense]);
  });

  it('keeps the order it was given', () => {
    const a = event({ id: 'a', startsAt: '2026-09-17' });
    const hidden = event({ id: 'hidden', startsAt: '2026-11-01' });
    const b = event({ id: 'b', startsAt: '2026-09-18' });
    expect(dropScheduledEvents([a, hidden, b], NOW).map((n) => n.id)).toEqual(['a', 'b']);
  });
});
