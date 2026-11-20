import { BOOKINGS_BASE, bookingsHeaders } from './bookingsBase';
import type { BookingsHttp } from './bookingsBase';

export type CancelOutcome =
  | { kind: 'ok' }
  /** Already not there: nothing left to cancel. */
  | { kind: 'gone' }
  | { kind: 'unknown' }
  | { kind: 'failed'; status: number };

/**
 * Cancels a booking by its self-service id: a bearer capability, whoever holds it
 * can cancel that booking. It goes in the path and nowhere else, and never in a
 * log, a diagnostic or a shared link.
 */
export async function cancelBooking(
  http: BookingsHttp,
  selfServiceId: string
): Promise<CancelOutcome> {
  try {
    const res = await http({
      method: 'DELETE',
      url: `${BOOKINGS_BASE}/appointments/${encodeURIComponent(selfServiceId)}`,
      headers: bookingsHeaders(),
    });
    if (res.status === 200) return { kind: 'ok' };
    if (res.status === 404) return { kind: 'gone' };
    return { kind: 'failed', status: res.status };
  } catch {
    return { kind: 'unknown' };
  }
}
