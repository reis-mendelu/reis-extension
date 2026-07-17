import type { AvailabilityBlock, AvailabilityStatus } from '@/types/library';

const HOUR_MS = 3_600_000;

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

// Every contiguous AVAILABLE range that a student can still book *today*: each
// range is clipped to start no earlier than the lead-time cutoff (now +
// leadMinutes, rounded up to the hour), holds at least one whole hour, and
// begins on `now`'s local day. Touching ranges are merged so the panel shows
// "14:00–18:00", not four one-hour fragments. Answers "which specific hours can
// I book?" — where computeNextSlot answers only "the single earliest one".
export function bookableRangesToday(
  blocks: AvailabilityBlock[],
  leadMinutes: number,
  now: Date
): TimeRange[] {
  const earliest = ceilToHour(new Date(now.getTime() + leadMinutes * 60_000));
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const clipped: TimeRange[] = [];
  for (const b of blocks) {
    if (b.status !== 'AVAILABLE') continue;
    const start = ceilToHour(new Date(Math.max(new Date(b.start).getTime(), earliest.getTime())));
    const end = new Date(Math.min(new Date(b.end).getTime(), endOfDay.getTime()));
    if (start.getTime() + HOUR_MS > end.getTime()) continue; // no whole hour left
    if (start.toDateString() !== now.toDateString()) continue; // slot is a future day
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
