import type { AvailabilityBlock } from '@/types/library';
import { isOpenDay } from './nextSlot';

const HOUR_MS = 3_600_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// The local calendar days the picker can offer: today (when it's an open day)
// plus every later open day that still has an AVAILABLE window ending in the
// future, capped at `horizon` days and sorted ascending. Weekends are dropped —
// the library is closed then (see isOpenDay). Fed the union of all rooms' blocks
// so the picker covers any day any room is open.
export function pickableDays(blocks: AvailabilityBlock[], now: Date, horizon = 7): Date[] {
  const today = startOfDay(now);
  const days = new Map<string, Date>();
  if (isOpenDay(today)) days.set(today.toDateString(), today);
  for (const b of blocks) {
    if (b.status !== 'AVAILABLE') continue;
    if (new Date(b.end).getTime() <= now.getTime()) continue;
    const day = startOfDay(new Date(b.start));
    if (day.getTime() < today.getTime()) continue;
    if (!isOpenDay(day)) continue; // library closed on weekends
    days.set(day.toDateString(), day);
  }
  return [...days.values()].sort((a, b) => a.getTime() - b.getTime()).slice(0, horizon);
}

// The distinct hour-of-day starts (0–23) that begin at least one whole bookable
// hour inside some AVAILABLE block — e.g. an 08:00–16:00 window yields 8…15.
// The union across rooms gives the picker its hour options.
export function openStartHours(blocks: AvailabilityBlock[]): number[] {
  const hours = new Set<number>();
  for (const b of blocks) {
    if (b.status !== 'AVAILABLE') continue;
    const end = new Date(b.end).getTime();
    const h = new Date(b.start);
    if (h.getMinutes() || h.getSeconds() || h.getMilliseconds()) {
      h.setHours(h.getHours() + 1, 0, 0, 0);
    } else {
      h.setMinutes(0, 0, 0);
    }
    while (h.getTime() + HOUR_MS <= end) {
      hours.add(h.getHours());
      h.setTime(h.getTime() + HOUR_MS);
    }
  }
  return [...hours].sort((a, b) => a - b);
}
