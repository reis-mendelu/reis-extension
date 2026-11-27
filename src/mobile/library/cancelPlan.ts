import type { CalendarCustomEvent } from '../../types/calendarTypes';

export interface CancelPlan {
  /** Blocks to store, as they should read now. */
  put: CalendarCustomEvent[];
  /** Ids to remove. */
  drop: string[];
  /** Hours of the tapped block that were cancelled. */
  freed: number[];
}

interface Held {
  key: string;
  hour: number;
  from: CalendarCustomEvent;
}

const hourOf = (time: string) => Number(time.slice(0, 2));
const clock = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/**
 * What the calendar holds after cancelling `tapped`, with `left` the keys that
 * could not be cancelled. A key at index i holds the hour startTime + i.
 *
 * Every block that shares a key with `tapped` is reconciled with it, not just
 * `tapped`: an attempt that died after saving a split but before the original
 * went leaves both, and the retry may cancel hours the split still holds. A
 * related block's own later keys (an extension) are kept. The hours that stay
 * are grouped into consecutive runs; a run that starts where its block starts
 * keeps that block's id, any other is `${tapped.id}-${hour}`. Applied in one transaction, so
 * a key that still holds an hour is never lost between writes.
 */
export function planCancel(
  events: readonly CalendarCustomEvent[],
  tapped: CalendarCustomEvent,
  left: readonly string[]
): CancelPlan {
  const lb = tapped.libraryBooking;
  if (!lb) return { put: [], drop: [], freed: [] };
  const tappedKeys = new Set(lb.selfServiceIds);
  const cancelled = new Set(lb.selfServiceIds.filter((k) => !left.includes(k)));
  const start = hourOf(tapped.startTime);
  const freed = lb.selfServiceIds.flatMap((k, i) => (cancelled.has(k) ? [start + i] : []));

  const related = events.filter(
    (e) =>
      e.id === tapped.id ||
      (e.date === tapped.date &&
        e.libraryBooking?.featureId === lb.featureId &&
        e.libraryBooking.selfServiceIds.some((k) => tappedKeys.has(k)))
  );
  // `tapped` first: its keys are templated from it.
  related.sort((a, b) => Number(b.id === tapped.id) - Number(a.id === tapped.id));
  if (related[0]?.id !== tapped.id) related.unshift(tapped);

  // Each key once, at its hour; the block that holds it is the template, so
  // its own fields (an `unconfirmed` flag) never spread to other keys.
  const held = new Map<string, Held>();
  for (const e of related) {
    const keys = e.libraryBooking?.selfServiceIds ?? [];
    keys.forEach((key, i) => {
      if (!cancelled.has(key) && !held.has(key))
        held.set(key, { key, hour: hourOf(e.startTime) + i, from: e });
    });
  }
  const runs: Held[][] = [];
  for (const h of [...held.values()].sort((a, b) => a.hour - b.hour)) {
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1]!.hour + 1 === h.hour) last.push(h);
    else runs.push([h]);
  }

  const relatedIds = new Set(related.map((e) => e.id));
  const taken = new Set(events.filter((e) => !relatedIds.has(e.id)).map((e) => e.id));
  const made = new Set<string>();
  const put = runs.map((run) => {
    const first = run[0]!;
    // A run that starts where its block starts keeps that block's id.
    const own = hourOf(first.from.startTime) === first.hour && !made.has(first.from.id);
    let id = own ? first.from.id : `${tapped.id}-${first.hour}`;
    for (let n = 2; taken.has(id) || made.has(id); n++) id = `${tapped.id}-${first.hour}-${n}`;
    made.add(id);
    return {
      ...first.from,
      id,
      startTime: clock(first.hour),
      endTime: clock(first.hour + run.length),
      libraryBooking: { ...first.from.libraryBooking!, selfServiceIds: run.map((h) => h.key) },
    };
  });
  return { put, drop: [...relatedIds].filter((id) => !made.has(id)), freed };
}
