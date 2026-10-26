import type { DrawerTab } from '../../SubjectFileDrawer/types';

/** Left to right: the tab bar's order, and the order a swipe steps through. */
export const SUBJECT_TAB_ORDER: readonly DrawerTab[] = [
  'files',
  'classmates',
  'stats',
  'syllabus',
  'zaznamnik',
];

/**
 * The tab a swipe across the subject sheet lands on.
 *
 * One tab per swipe, in the tab bar's own order, stepping OVER a disabled tab
 * rather than onto it — a subject with no subjectId has Soubory, Spolužáci and
 * Záznamník greyed out, and a swipe that landed there would show a dead body
 * under a tab the student cannot tap. With no live tab in that direction the
 * sheet stays where it is: the bar is a row, so it does not wrap round.
 */
export function stepTab(
  order: readonly DrawerTab[],
  active: DrawerTab,
  steps: -1 | 0 | 1,
  disabled: readonly DrawerTab[]
): DrawerTab {
  if (steps === 0) return active;
  for (let i = order.indexOf(active) + steps; i >= 0 && i < order.length; i += steps) {
    const tab = order[i];
    if (tab && !disabled.includes(tab)) return tab;
  }
  return active;
}
