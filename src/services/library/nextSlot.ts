import type { AvailabilityBlock, AvailabilityStatus } from '@/types/library';

const HOUR_MS = 3_600_000;

// The MENDELU library is closed on weekends, so Saturday/Sunday are never
// bookable — even though the room mailbox reports them free (GetStaffAvailability
// returns raw free/busy, not the library's business hours). Weekday hours
// already come through the availability blocks; only the weekend gap leaks.
export function isOpenDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

export interface RawItem {
  status: string;
  startDateTime: { dateTime: string; timeZone: string };
  endDateTime: { dateTime: string; timeZone: string };
}

export function parseAvailabilityItems(items: RawItem[]): AvailabilityBlock[] {
  return items.map((it) => ({
    status: it.status.replace('BOOKINGSAVAILABILITYSTATUS_', '') as AvailabilityStatus,
    start: it.startDateTime.dateTime,
    end: it.endDateTime.dateTime,
  }));
}

function ceilToHour(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() || r.getSeconds() || r.getMilliseconds()) {
    r.setHours(r.getHours() + 1, 0, 0, 0);
  } else {
    r.setMinutes(0, 0, 0);
  }
  return r;
}

function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function computeNextSlot(
  blocks: AvailabilityBlock[],
  leadMinutes: number,
  now: Date
): string | null {
  const earliest = ceilToHour(new Date(now.getTime() + leadMinutes * 60_000));
  let best: Date | null = null;
  for (const b of blocks) {
    if (b.status !== 'AVAILABLE') continue;
    const bStart = new Date(b.start);
    const bEnd = new Date(b.end);
    const start = ceilToHour(new Date(Math.max(bStart.getTime(), earliest.getTime())));
    if (!isOpenDay(start)) continue; // library closed on weekends
    if (start.getTime() + HOUR_MS <= bEnd.getTime()) {
      if (!best || start < best) best = start;
    }
  }
  return best ? toLocalIso(best) : null;
}

export interface TimeRange {
  start: string; // naive local ISO
  end: string;
}

// Every contiguous AVAILABLE range a student can still book on `day`'s local
// calendar date: each range starts no earlier than the lead-time cutoff (now +
// leadMinutes, rounded up to the hour), holds at least one whole hour, and
// begins on `day`. Touching ranges are merged so the panel shows "14:00–18:00",
// not four one-hour fragments. For a future `day` the lead cutoff is already in
// the past, so the whole open day qualifies; for today it clips the morning.
export function bookableRangesOnDay(
  blocks: AvailabilityBlock[],
  leadMinutes: number,
  day: Date,
  now: Date
): TimeRange[] {
  if (!isOpenDay(day)) return []; // library closed on weekends
  const earliest = ceilToHour(new Date(now.getTime() + leadMinutes * 60_000));
  const endOfDay = new Date(day);
  endOfDay.setHours(23, 59, 59, 999);
  const dayStr = day.toDateString();
  const clipped: TimeRange[] = [];
  for (const b of blocks) {
    if (b.status !== 'AVAILABLE') continue;
    const start = ceilToHour(new Date(Math.max(new Date(b.start).getTime(), earliest.getTime())));
    const end = new Date(Math.min(new Date(b.end).getTime(), endOfDay.getTime()));
    if (start.getTime() + HOUR_MS > end.getTime()) continue; // no whole hour left
    if (start.toDateString() !== dayStr) continue; // slot is not on this day
    clipped.push({ start: toLocalIso(start), end: toLocalIso(end) });
  }
  clipped.sort((a, b) => a.start.localeCompare(b.start));
  const merged: TimeRange[] = [];
  for (const r of clipped) {
    const last = merged[merged.length - 1];
    if (last && last.end === r.start) last.end = r.end;
    else merged.push({ ...r });
  }
  return merged;
}

// Today's bookable ranges — the day-scoped view for `now`'s own date.
export function bookableRangesToday(
  blocks: AvailabilityBlock[],
  leadMinutes: number,
  now: Date
): TimeRange[] {
  return bookableRangesOnDay(blocks, leadMinutes, now, now);
}

// Whether a room's specific hour-aligned slot (starting at `slotStart`) is
// bookable: it must clear the lead-time cutoff and fall entirely inside one
// AVAILABLE block. Answers the picker's "is THIS room free at THIS time?".
export function isRoomFreeAt(
  blocks: AvailabilityBlock[],
  leadMinutes: number,
  slotStart: Date,
  now: Date
): boolean {
  if (!isOpenDay(slotStart)) return false; // library closed on weekends
  const cutoff = now.getTime() + leadMinutes * 60_000;
  if (slotStart.getTime() < cutoff) return false;
  const slotEnd = slotStart.getTime() + HOUR_MS;
  return blocks.some(
    (b) =>
      b.status === 'AVAILABLE' &&
      new Date(b.start).getTime() <= slotStart.getTime() &&
      slotEnd <= new Date(b.end).getTime()
  );
}

// Whether the room's earliest bookable slot falls on `now`'s local calendar
// day. Distinct from "computeNextSlot returns non-null" — a room can have a
// next slot several days out (or, for the 2-day-lead seminar room, can never
// have one today at all) and must not be counted/tinted as free-today.
export function isBookableToday(
  blocks: AvailabilityBlock[],
  leadMinutes: number,
  now: Date
): boolean {
  const iso = computeNextSlot(blocks, leadMinutes, now);
  if (!iso) return false;
  return new Date(iso).toDateString() === now.toDateString();
}
