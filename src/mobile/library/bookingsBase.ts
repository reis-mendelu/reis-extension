/**
 * The library's Microsoft Bookings business, and the one request shape every
 * call here shares.
 *
 * The device calls this endpoint itself, anonymously, exactly as the booking
 * web page does: no reIS server sits in between and nothing is stored there. The
 * `services` and `GetStaffAvailability` calls need no auth, `appointments` (POST)
 * creates, and `DELETE appointments/{selfServiceAppointmentId}` cancels
 * (verified live, 2026-10-30; undocumented, so a failure is "unknown", never
 * "cancelled"). Foreign web origins are refused by CORS, which is why the
 * transport is native (see `transport.ts`) and the extension never books.
 */
export const BOOKINGS_BUSINESS = 'RezervacestudovenMENDELU@mendelu.onmicrosoft.com';
export const BOOKINGS_BASE = `https://bookings.cloud.microsoft/BookingsService/api/V1/bookingBusinessesc2/${BOOKINGS_BUSINESS}`;
export const BOOKINGS_TZ = 'Central Europe Standard Time';

/**
 * The two required free-text questions on every service. Match by GUID, never by
 * position: the order differs per service. The text is not in the anonymous
 * `services` response (read off the booking page, 2026-10-30).
 */
export const QUESTION_FACULTY = '51ae56d9-10e3-4388-8acc-590f9f2bc258'; // fakulta / faculty
export const QUESTION_STUDENT_ID = 'c7fe8a04-e915-4a06-a045-36b68532ed90'; // student / employee ID

export interface BookingsRequest {
  method: 'POST' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  data?: unknown;
}
export interface BookingsResponse {
  status: number;
  data: unknown;
}
/** One HTTP call. Throws when the request could not be made or never answered. */
export type BookingsHttp = (req: BookingsRequest) => Promise<BookingsResponse>;

export const bookingsHeaders = (): Record<string, string> => ({
  'content-type': 'application/json; charset=utf-8',
  'x-anchormailbox': BOOKINGS_BUSINESS,
  'x-req-source': 'BookingsC2',
});
