import { useAppStore } from '../../../../store/useAppStore';
import { useSchedule } from '../../../../hooks/data/useSchedule';
import { isLessonHidden } from '../../../../utils/hiddenLessons';
import { defaultCalendarDay } from '../../../../utils/mobile/landingDay';
import { toIso } from '../../../../utils/mobile/weekDays';

/**
 * Where the calendar opens, and the way back to today — one answer for the
 * date in the header and for tapping the Kalendář tab again, so the two routes
 * cannot disagree about where "today" is.
 *
 * `defaultIso` is today, except before term, when it is the first teaching
 * day (utils/mobile/landingDay), computed from the VISIBLE schedule: a student
 * who hid the course that starts earliest would otherwise land on a day whose
 * agenda is empty once the hidden lessons are taken out.
 *
 * `goToday` clears the choice where it can (`null` re-derives at midnight
 * instead of pinning a date). Before term the default is not today, and
 * clearing would land right back on the first teaching day, so there it pins
 * today's date explicitly — otherwise the control would visibly do nothing.
 */
export function useCalendarToday() {
  const { schedule } = useSchedule();
  const hiddenItems = useAppStore((s) => s.hiddenItems);
  const teachingWeekData = useAppStore((s) => s.teachingWeekData);
  const selected = useAppStore((s) => s.mobileSelectedDayIso);
  const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);

  const visibleSchedule = schedule.filter((l) => !isLessonHidden(l, hiddenItems));
  const defaultIso = defaultCalendarDay(visibleSchedule, teachingWeekData, new Date());
  const todayIso = toIso(new Date());
  const selectedIso = selected ?? defaultIso;

  return {
    visibleSchedule,
    defaultIso,
    selectedIso,
    isAway: selectedIso !== todayIso,
    goToday: () => setMobileSelectedDay(defaultIso === todayIso ? null : todayIso),
  };
}
