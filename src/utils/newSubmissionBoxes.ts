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

/**
 * The boxes of a fresh list this device has not seen before.
 *
 * Nothing without a known list: the first sync after install (or after the
 * study changed) would otherwise announce every box of the semester. An empty
 * known list is still a list, so a student who started with no boxes hears
 * about the first one.
 */
export function findNewBoxes(
  known: ReadonlySet<string> | undefined,
  fresh: Odevzdavarna[],
  now: number
): string[] {
  if (!known) return [];
  return fresh.filter((b) => !known.has(boxKey(b)) && actionable(b, now)).map(boxKey);
}
