import { useAppStore } from '../../../../store/useAppStore';

/**
 * The bottom padding of the agenda and the week grid. Normally it clears the
 * floating tab bar (76px measured, +20). While the first-open view chooser is
 * up, the chooser itself sits in the layout below them and clears the tab bar
 * with its own margin, so they only need a small gap above it — and the week
 * grid, which never scrolls, shrinks to whatever height the chooser leaves.
 * Full literal class strings, so Tailwind's scanner sees both.
 */
const NAV_PAD = 'pb-[calc(6rem_+_var(--safe-bottom,0px))]';
const CHOOSER_PAD = 'pb-2';

export function useCalendarBottomPad(): string {
  const choosing = useAppStore((s) => s.calendarViewChosen === false);
  return choosing ? CHOOSER_PAD : NAV_PAD;
}
