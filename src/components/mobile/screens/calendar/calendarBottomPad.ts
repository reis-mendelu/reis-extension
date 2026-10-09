import { useAppStore } from '../../../../store/useAppStore';

/**
 * The bottom padding of the agenda and the week grid. It clears the tab bar
 * (76px measured, +20) — and, while the first-open view chooser is up, the
 * chooser's band as well. The week grid never scrolls, so this is what makes
 * it compress to fit ABOVE the chooser instead of drawing its afternoon under
 * it while the student compares. Full literal class strings, so Tailwind's
 * scanner sees both.
 */
const NAV_PAD = 'pb-[calc(6rem_+_var(--safe-bottom,0px))]';
const CHOOSER_PAD = 'pb-[calc(16rem_+_var(--safe-bottom,0px))]';

export function useCalendarBottomPad(): string {
  const choosing = useAppStore((s) => s.calendarViewChosen === false);
  return choosing ? CHOOSER_PAD : NAV_PAD;
}
