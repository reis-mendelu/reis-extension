import type { AvailabilityBlock, AvailabilityStatus } from '@/types/library';

const HOUR_MS = 3_600_000;

interface RawItem {
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
  now: Date,
): string | null {
  const earliest = ceilToHour(new Date(now.getTime() + leadMinutes * 60_000));
  let best: Date | null = null;
  for (const b of blocks) {
    if (b.status !== 'AVAILABLE') continue;
    const bStart = new Date(b.start);
    const bEnd = new Date(b.end);
    let start = ceilToHour(new Date(Math.max(bStart.getTime(), earliest.getTime())));
    if (start.getTime() + HOUR_MS <= bEnd.getTime()) {
      if (!best || start < best) best = start;
    }
  }
  return best ? toLocalIso(best) : null;
}
