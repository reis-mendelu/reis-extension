import { ChefHat } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { menuForDay } from '../../../../utils/menuForDay';

/**
 * The jídelníček's way in from the week view: a chef hat in the header that
 * opens the menu of the WEEK on screen.
 *
 * Den carries the menu as a card under the day's lessons, but the week grid
 * fills the screen and has no room for it, so a student who saved Týden never
 * reached the menu at all. A row of per-day icons under the date strip was
 * mocked and cost the grid ~35px, so the phone has one hat in the header, the
 * extension's icon.
 *
 * It needs no selected day. The first version opened "the selected day's"
 * menu, and Týden then selected a day on every swipe that nobody had chosen —
 * "unintuitive". Now the sheet gets the whole shown week as tabs and opens on
 * today, or the next day that serves; in another week, on its first serving
 * day. Days already past are no answer, so late in a week with nothing left
 * to serve, and in a week nothing serves, there is no hat. Today still counts
 * after lunch — the hat does not know serving hours, and today's menu is still
 * the likeliest question that day.
 */
export function WeekMenuButton({ days, todayIso }: { days: string[]; todayIso: string }) {
  const { t } = useTranslation();
  const view = useAppStore((s) => s.mobileCalendarView);
  const menu = useAppStore((s) => s.menu);
  const pushSheet = useAppStore((s) => s.pushSheet);

  if (view !== 'week') return null;
  // ISO dates compare as strings.
  const ahead = days.includes(todayIso) ? days.filter((d) => d >= todayIso) : days;
  const dayIso = ahead.find((d) => menuForDay(menu, new Date(`${d}T00:00:00`)).length);
  if (!dayIso) return null;

  return (
    <button
      type="button"
      onClick={() => pushSheet({ kind: 'menu', dayIso, week: days })}
      aria-label={t('menu.title')}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-base-100 max-[359px]:h-9 max-[359px]:w-9"
    >
      <ChefHat size={18} />
    </button>
  );
}
