import { useAppStore } from '../../../../store/useAppStore';
import { formatHeaderDate } from '../../../../utils/mobile/formatHeaderDate';
import { formatWeekRange } from '../../../../utils/mobile/formatWeekRange';
import { toIso, weekDays } from '../../../../utils/mobile/weekDays';

/**
 * What the calendar header says, and whether it offers the way back.
 *
 * Den names the selected day ("Čt 26. listopadu"). Týden names the week the
 * strip shows ("12.–16. 10."), because nothing in it is selected: the week is
 * the unit, and the day the store holds is only the week's anchor. The way
 * back follows suit — in Týden it is offered for a week that does not hold
 * today, not for an anchor that is merely not today.
 */
export function useCalendarTitle({
  selectedIso,
  lessonDates,
  isAway,
}: {
  selectedIso: string;
  lessonDates: ReadonlySet<string>;
  isAway: boolean;
}) {
  const view = useAppStore((s) => s.mobileCalendarView);
  const language = useAppStore((s) => s.language);
  // The store's clock, as the strip's today mark reads it.
  const todayIso = toIso(useAppStore((s) => s.now));
  const week = weekDays(selectedIso, lessonDates, todayIso);
  const weekIsos = week.map(toIso);

  if (view !== 'week') {
    const locale = language === 'en' ? 'en-US' : 'cs-CZ';
    return {
      title: formatHeaderDate(new Date(`${selectedIso}T00:00:00`), locale, 'short'),
      away: isAway,
      weekIsos,
      todayIso,
    };
  }
  return {
    title: formatWeekRange(
      week[0]!,
      week[week.length - 1]!,
      language === 'en' ? 'en' : 'cz',
      'numeric'
    ),
    away: !weekIsos.includes(todayIso),
    weekIsos,
    todayIso,
  };
}
