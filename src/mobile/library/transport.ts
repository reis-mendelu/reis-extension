import { getPlatform } from '../../platform';
import type { BookingsHttp } from './bookingsBase';

/**
 * `?library` on the dev webapp, and nothing anywhere else: `import.meta.env.DEV`
 * strips it from every shipped build, as `?eduroam=` does (eduroamNative.ts).
 *
 * The library card is gated on Capacitor, so a browser could never show it and
 * the screen went unreviewed at tablet width. Only the gate is forced. Reading
 * availability goes out as an ordinary fetch, which Bookings refuses (CORS)
 * unless a run answers it (`verify:ui --route`); anything that would book or
 * cancel throws before a request is made.
 */
function devForced(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('library');
}

/** Booking exists on the phone and iPad only. The extension has no way to make this call. */
export const canBookLibrary = (): boolean => getPlatform().kind === 'capacitor' || devForced();

// The service answered in 8 to 14 s on 2026-10-30, from a laptop and a phone alike, so a
// 10 s limit made every request "unknown". A slower answer than this is still "unknown".
const READ_TIMEOUT_MS = 45_000;
// A booking or a cancel waits longer: on 2026-11-16 the first real booking was
// made at the library, e-mailed to the student, and never reached reIS, most
// likely because the create call outlived 45 s. Giving up early on a write is
// the worse failure, so the app waits as long as the booking page would.
const WRITE_TIMEOUT_MS = 120_000;

/**
 * CapacitorHttp runs outside the WebView, where CORS does not apply, so the
 * library's Bookings answers. Imported lazily so the extension bundle never
 * pulls in @capacitor/*.
 */
export const nativeBookingsHttp: BookingsHttp = async (req) => {
  if (getPlatform().kind !== 'capacitor') {
    if (!devForced() || !req.url.endsWith('/GetStaffAvailability'))
      throw new Error('Library booking runs only in the app');
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(req.data),
    });
    return { status: res.status, data: await res.json() };
  }
  const { CapacitorHttp } = await import('@capacitor/core');
  const res = await CapacitorHttp.request({
    url: req.url,
    method: req.method,
    headers: req.headers,
    data: req.data,
    connectTimeout: 10_000,
    readTimeout: req.url.endsWith('/GetStaffAvailability') ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS,
  });
  return { status: res.status, data: res.data };
};
