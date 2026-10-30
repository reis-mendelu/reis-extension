import { BOOKINGS_BASE, BOOKINGS_TZ } from './bookingsBase';
import type { BookingsHttp } from './bookingsBase';

export type BlockStatus = 'free' | 'busy' | 'closed';
/** One stretch of a room's day, in local (Prague) time, `YYYY-MM-DDTHH:mm`. */
export interface Block {
  status: BlockStatus;
  start: string;
  end: string;
}

interface RawItem {
  status?: string;
  startDateTime?: { dateTime?: string };
  endDateTime?: { dateTime?: string };
}

// A status Bookings adds one day is not free: wrongly offering a taken hour
// costs a failed booking, wrongly hiding a free one costs nothing.
function statusOf(raw: string | undefined): BlockStatus {
  if (raw === 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE') return 'free';
  if (raw === 'BOOKINGSAVAILABILITYSTATUS_OUT_OF_OFFICE') return 'closed';
  return 'busy';
}

const minutes = (iso: string | undefined): string => (iso ?? '').slice(0, 16);

/**
 * One room's blocks for [fromDay, toDay), both `YYYY-MM-DD`.
 *
 * `null` means "could not ask", which is not the same as an empty room: a caller
 * that read an empty list as "nothing free" would claim a full library at the
 * first dropped connection. Availability is gaps and blocks, never "free now".
 */
export async function fetchRoomBlocks(
  http: BookingsHttp,
  staffMemberId: string,
  fromDay: string,
  toDay: string
): Promise<Block[] | null> {
  try {
    const res = await http({
      method: 'POST',
      url: `${BOOKINGS_BASE}/GetStaffAvailability`,
      headers: { 'content-type': 'application/json' },
      data: {
        staffIds: [staffMemberId],
        startDateTime: { dateTime: fromDay, timeZone: BOOKINGS_TZ },
        endDateTime: { dateTime: toDay, timeZone: BOOKINGS_TZ },
      },
    });
    if (res.status !== 200) return null;
    const items = (res.data as { staffAvailabilityResponse?: { availabilityItems?: RawItem[] }[] })
      .staffAvailabilityResponse?.[0]?.availabilityItems;
    if (!Array.isArray(items)) return null;
    return items.map((i) => ({
      status: statusOf(i.status),
      start: minutes(i.startDateTime?.dateTime),
      end: minutes(i.endDateTime?.dateTime),
    }));
  } catch {
    return null;
  }
}
