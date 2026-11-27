// The ledger's entries as "upcoming" items (step 4b of the map): Prague days, soonest first,
// past events gone after their day. Merged with IS's own items by overviewUpcoming.ts.
import type { LedgerEntry } from './ledgerEntry';
import { recheckReason, type Listings } from './ledgerSource';
import { DAY, parsePrague, pragueToday } from './pragueTime';
import type { Upcoming } from './overviewUpcoming';

/** YYYY-MM-DD as IS prints a date, so it sorts and compares with IS's own items. */
export const isDate = (iso: string) =>
  `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}.${iso.slice(0, 4)}`;

/** An entry's days left, counted on Prague's calendar; negative once its last day is past. */
export function daysLeftOf(e: LedgerEntry, now: Date): { start: number; end: number } {
  const today = pragueToday(now.getTime()) / DAY;
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY;
  return { start: day(e.date) - today, end: day(e.until ?? e.date) - today };
}

export function whenOf(e: LedgerEntry): string {
  if (e.until && e.until !== e.date)
    return `${isDate(e.date)}${e.time ? ` ${e.time}` : ''} – ${isDate(e.until)}`;
  return `${isDate(e.date)}${e.time ? ` ${e.time}` : ''}`;
}

export const confirmNote = (e: LedgerEntry) =>
  e.basis === 'inferred'
    ? `Date inferred, not stated: ${e.inferredHow}. Confirm with the teacher.`
    : undefined;

/** `timed`: the instant is a real start time, which an IS term of the same subject can be the same event at. */
type Row = { at: number; item: Upcoming; timed: boolean };

/** Entries not yet past, as upcoming items; an event inside its window shows 0 days left. */
export function ledgerItems(entries: LedgerEntry[], now: Date, listings: Listings): Row[] {
  const rows: Row[] = [];
  for (const e of entries) {
    const { start, end } = daysLeftOf(e, now);
    if (end < 0) continue;
    const starts = parsePrague(isDate(e.date), e.time ?? '00:00');
    if (!starts) continue;
    const recheck = recheckReason(e, listings);
    const confirm = confirmNote(e);
    rows.push({
      // A window already under way sorts as of today, so it is not buried behind its start.
      at: start < 0 ? now.getTime() : starts.at,
      timed: !!e.time && start >= 0,
      item: {
        id: e.id,
        when: whenOf(e),
        daysLeft: Math.max(0, start),
        kind: e.kind,
        code: e.code ?? '',
        title: e.title,
        attendance: e.attendance ? 'yes' : '',
        source: 'ledger',
        basis: e.basis,
        ...(e.room ? { room: e.room } : {}),
        ...(e.unregisterBy ? { unregisterBy: e.unregisterBy } : {}),
        ...(recheck ? { recheck } : {}),
        ...(confirm ? { confirm } : {}),
      },
    });
  }
  return rows;
}
