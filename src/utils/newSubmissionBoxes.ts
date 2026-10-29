import type { Odevzdavarna } from '../api/odevzdavarny';
import { boxState, isBoxOpen } from './submissionBoxes';

/**
 * A box's identity across syncs: IS's own id, or the subject and the name for
 * a row without one. Never the name alone: two subjects can both have "Projekt".
 */
export const boxKey = (box: Odevzdavarna): string =>
  box.odevzdavarnaId || `${box.courseId}\u0000${box.name}`;

/** A box the student can still do something about: open, and not handed in. */
export const actionable = (box: Odevzdavarna, now: number) =>
  isBoxOpen(box, now) && boxState(box) !== 'confirmed';

/** Every box id and IS period this device has already seen. */
export interface KnownBoxes {
  ids: ReadonlySet<string>;
  periods: ReadonlySet<string>;
}

/**
 * The boxes of a fresh list (read for period `obdobi`) this device has not
 * seen before.
 *
 * Nothing without a known record: the first sync after install (or after the
 * study changed) would otherwise announce every box of the semester. The same
 * holds per period: when the semester turns, the new one's boxes were never
 * read before, and the teachers made most of them weeks ago. A known record
 * with no ids is still a record, so a student who started with no boxes hears
 * about the first one.
 */
export function findNewBoxes(
  known: KnownBoxes | undefined,
  fresh: Odevzdavarna[],
  obdobi: string,
  now: number
): string[] {
  if (!known) return [];
  return fresh
    .filter(
      (b) =>
        !known.ids.has(boxKey(b)) && known.periods.has(b.obdobi ?? obdobi) && actionable(b, now)
    )
    .map(boxKey);
}
