import {
  fetchOdevzdavarny,
  type Odevzdavarna,
  type OdevzdavarnyResult,
} from '../../api/odevzdavarny';
import { IndexedDBService } from '../storage/IndexedDBService';

/** The period before `obdobi` in IS's oldest-first list, or null in the first one. */
export function previousPeriod(periods: string[], obdobi: string): string | null {
  const i = periods.indexOf(obdobi);
  return i > 0 ? (periods[i - 1] ?? null) : null;
}

/**
 * The current period's boxes, then the previous period's.
 *
 * Two periods because the semester turns before its boxes close: once
 * `obdobi` moves on, the last period's exam boxes are still open, and they
 * are listed only under that period.
 *
 * Null when the current read failed — callers keep their cache. A failed
 * previous-period read alone keeps that period's cached rows instead.
 */
export async function syncOdevzdavarny(
  studium: string,
  obdobi: string
): Promise<OdevzdavarnyResult | null> {
  const key = `${studium}_${obdobi}`;
  const current = await fetchOdevzdavarny(studium, obdobi);
  if (!current) return null;

  let previousRows: Odevzdavarna[] = [];
  const prev = previousPeriod(current.periods, obdobi);
  if (prev) {
    const previous = await fetchOdevzdavarny(studium, prev);
    if (previous) {
      previousRows = previous.assignments;
    } else {
      const cached = (await IndexedDBService.get('odevzdavarny', key)) ?? [];
      previousRows = cached.filter((a) => a.obdobi === prev);
    }
  }

  const assignments = [...current.assignments, ...previousRows];
  // An empty list is stored too: the parser answers null for a page it does
  // not recognise, so [] really means "no boxes" and must clear deleted ones.
  await IndexedDBService.set('odevzdavarny', key, assignments);
  return { ...current, assignments };
}
