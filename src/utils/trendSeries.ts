/** One day of a trend, after gap-filling. */
export interface TrendPoint {
  /** ISO date, `YYYY-MM-DD`. */
  day: string;
  value: number;
}

const DAY_MS = 86_400_000;

/** `Date` -> `YYYY-MM-DD` in LOCAL time, matching how the RPC's dates read. */
function iso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Turn the RPC's sparse rows into a dense series of `days` entries ending today.
 *
 * Gap-filling is the whole point. The RPC returns a row only for a day that had
 * activity, so a chart drawn straight from it would place Monday next to Friday
 * with equal spacing and no gap — a flat week and a quiet week would draw the
 * same shape, and the axis would be a lie. Missing days are zero, and zero is a
 * fact worth seeing.
 *
 * `today` is injected rather than read from the clock so the boundary is
 * testable; callers pass `new Date()`.
 */
export function buildTrendSeries(
  rows: readonly { day: string; value: number }[],
  days: number,
  today: Date
): TrendPoint[] {
  const span = Math.max(1, Math.floor(days));
  const byDay = new Map<string, number>();
  for (const r of rows) {
    // Summed, not overwritten: a caller may hand us several rows for one day
    // (two features, two events) and silently dropping all but the last would
    // under-report without a trace.
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.value);
  }

  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const out: TrendPoint[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * DAY_MS);
    const key = iso(d);
    out.push({ day: key, value: byDay.get(key) ?? 0 });
  }
  return out;
}

/** The largest value in a series, floored at 1 so a bar chart can divide by it. */
export function trendMax(series: readonly TrendPoint[]): number {
  return Math.max(1, ...series.map((p) => p.value));
}
