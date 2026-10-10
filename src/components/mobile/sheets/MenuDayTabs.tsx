import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { menuForDay } from '../../../utils/menuForDay';

/**
 * The days of the shown week, above the canteens in the menu sheet opened from
 * Týden's chef hat.
 *
 * Every day of the week is drawn, so the row has the strip's shape, but a day
 * nothing serves is disabled: picking it could only show "Menu není
 * k dispozici". The picked day wears the canteen tabs' style — one visual
 * language for "this one" in the sheet.
 */
export function MenuDayTabs({
  week,
  day,
  onPick,
}: {
  week: string[];
  day: string;
  onPick: (iso: string) => void;
}) {
  const { t, language } = useTranslation();
  const menu = useAppStore((s) => s.menu);
  const weekday = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'cs', {
    weekday: 'short',
  });

  return (
    // A group of pressed/unpressed buttons, not a tablist: tabs promise
    // arrow-key movement and linked tab panels this row does not have
    // (CodeRabbit on #530), so screen readers would announce controls that
    // then do not behave as announced.
    <div role="group" aria-label={t('menu.day')} className="mb-2 flex gap-1.5">
      {week.map((iso) => {
        const date = new Date(`${iso}T00:00:00`);
        const serves = menuForDay(menu, date).length > 0;
        const label = weekday.format(date);
        return (
          <button
            key={iso}
            type="button"
            aria-pressed={iso === day}
            disabled={!serves}
            onClick={() => onPick(iso)}
            className={`min-h-11 flex-1 rounded-xl border px-1 text-sm ${
              iso === day
                ? 'border-primary bg-primary/10 font-bold text-primary'
                : serves
                  ? 'border-transparent font-medium text-base-content/70'
                  : 'border-transparent font-medium text-base-content/30'
            }`}
          >
            <span className="block">{label.charAt(0).toUpperCase() + label.slice(1)}</span>
            <span className="block tabular-nums">{date.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
