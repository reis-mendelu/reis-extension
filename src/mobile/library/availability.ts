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

const toBlock = (i: RawItem): Block => ({
  status: statusOf(i.status),
  start: minutes(i.startDateTime?.dateTime),
  end: minutes(i.endDateTime?.dateTime),
});

/**
 * Every room's blocks for [fromDay, toDay), both `YYYY-MM-DD`, in ONE request:
 * the endpoint takes a list of staff ids and answers per id. Six parallel calls
 * were six times the work for a service that can take 10 s or more to answer,
 * and on a phone all six timed out together (2026-10-30).
 *
 * A room missing from the answer is `null`, and so is every room when the
 * request fails: "could not ask" is not "nothing free", and a caller that read
 * an empty list as full would claim a full library at the first dropped
 * connection. Availability is gaps and blocks, never "free now".
 */
export async function fetchAllBlocks(
  http: BookingsHttp,
  staffIds: string[],
  fromDay: string,
  toDay: string
): Promise<Record<string, Block[] | null> | null> {
  try {
    const res = await http({
      method: 'POST',
      url: `${BOOKINGS_BASE}/GetStaffAvailability`,
      headers: { 'content-type': 'application/json' },
      data: {
        staffIds,
        startDateTime: { dateTime: fromDay, timeZone: BOOKINGS_TZ },
        endDateTime: { dateTime: toDay, timeZone: BOOKINGS_TZ },
      },
    });
    if (res.status !== 200) return null;
    const answers = (
      res.data as {
        staffAvailabilityResponse?: { staffId?: string; availabilityItems?: RawItem[] }[];
      }
    ).staffAvailabilityResponse;
    if (!Array.isArray(answers)) return null;
    const out: Record<string, Block[] | null> = Object.fromEntries(
      staffIds.map((id) => [id, null])
    );
    for (const a of answers) {
      if (a.staffId !== undefined && a.staffId in out && Array.isArray(a.availabilityItems))
        out[a.staffId] = a.availabilityItems.map(toBlock);
    }
    return out;
  } catch {
    return null;
  }
}

/** One room's blocks: the same question, for the booking's own re-check. */
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
    return Array.isArray(items) ? items.map(toBlock) : null;
  } catch {
    return null;
  }
}
