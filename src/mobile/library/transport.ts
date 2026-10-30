import { getPlatform } from '../../platform';
import type { BookingsHttp } from './bookingsBase';

/** Booking exists on the phone and iPad only. The extension has no way to make this call. */
export const canBookLibrary = (): boolean => getPlatform().kind === 'capacitor';

// The service answered in 8 to 14 s on 2026-10-30, from a laptop and a phone alike, so a
// 10 s limit made every request "unknown". A slower answer than this is still "unknown".
const READ_TIMEOUT_MS = 45_000;

/**
 * CapacitorHttp runs outside the WebView, where CORS does not apply, so the
 * library's Bookings answers. Imported lazily so the extension bundle never
 * pulls in @capacitor/*.
 */
export const nativeBookingsHttp: BookingsHttp = async (req) => {
  const { CapacitorHttp } = await import('@capacitor/core');
  const res = await CapacitorHttp.request({
    url: req.url,
    method: req.method,
    headers: req.headers,
    data: req.data,
    connectTimeout: 10_000,
    readTimeout: READ_TIMEOUT_MS,
  });
  return { status: res.status, data: res.data };
};
