/**
 * A feature signal as a share of the day's installs, pooled over the window:
 * the installs that sent the signal, summed day by day, over the installs that
 * opened reIS on those same days.
 *
 * Pooled rather than a mean of daily ratios, so a quiet Sunday with 40 installs
 * does not weigh as much as a Monday with 900. Both inputs are counts of
 * INSTALLS — the daily count and the feature counters carry the same random
 * install id — so the answer is "share of installs", never "of students".
 *
 * Only days the usage read covers with a positive count enter either side: the
 * two numbers come from independent RPCs, and a signal day with no denominator
 * has nothing to be a share of. Returns null when no day qualifies.
 */
export function signalShare(
  signalDaily: { day: string; installs: number }[],
  usageDaily: { day: string; active: number }[]
): number | null {
  const active = new Map<string, number>();
  for (const d of usageDaily) if (d.active > 0) active.set(d.day, d.active);
  let denominator = 0;
  for (const n of active.values()) denominator += n;
  if (denominator === 0) return null;
  let numerator = 0;
  for (const d of signalDaily) if (active.has(d.day) && d.installs > 0) numerator += d.installs;
  return numerator / denominator;
}
