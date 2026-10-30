import { getPlatform } from '../../platform';
import type { BookingsHttp } from './bookingsBase';

/** Booking exists on the phone and iPad only. The extension has no way to make this call. */
export const canBookLibrary = (): boolean => getPlatform().kind === 'capacitor';

/**
 * CapacitorHttp runs outside the WebView, where CORS does not apply, so the
 * library's Bookings answers. Imported lazily so the extension bundle never
 * pulls in @capacitor/*. A 10 s read timeout: a slower answer is "unknown".
 */
export const nativeBookingsHttp: BookingsHttp = async (req) => {
  const { CapacitorHttp } = await import('@capacitor/core');
  const res = await CapacitorHttp.request({
    url: req.url,
    method: req.method,
    headers: req.headers,
    data: req.data,
    connectTimeout: 10_000,
    readTimeout: 10_000,
  });
  return { status: res.status, data: res.data };
};
