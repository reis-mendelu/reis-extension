import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { logError } from '@/utils/reportError';
import type { BookingRequest, BookingResult } from '@/types/library';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/bookings-create`;

// POST a booking through the secret-gated edge proxy. The edge builds the MS
// envelope and creates the appointment; we map its response to a typed result
// so the UI can show a specific message (slot taken / rate-limited / offline).
export async function createLibraryBooking(req: BookingRequest): Promise<BookingResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
      },
      body: JSON.stringify(req),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      appointmentId?: string;
      error?: string;
    };
    // appointmentId is optional — the booking is confirmed by ok:true. Requiring
    // it would turn a successful booking whose id we couldn't parse into a false
    // failure, prompting a retry and a double-booking.
    if (res.ok && data.ok) {
      return { ok: true, appointmentId: data.appointmentId ?? '' };
    }
    if (res.status === 409) return { ok: false, error: 'conflict' };
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    if (res.status === 400) return { ok: false, error: 'invalid' };
    return { ok: false, error: 'upstream' };
  } catch (err) {
    logError('Api.createLibraryBooking', err);
    return { ok: false, error: 'offline' };
  }
}
