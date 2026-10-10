import { CalendarDays } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MobileCalendarView } from '../../../../store/types';

/**
 * Den | Týden in Nastavení — the one place the calendar view changes after the
 * first-open chooser. Same "label left, options right" join as the language
 * row in AppearanceRows. Writes the SAVED view directly.
 */
export function CalendarViewRow() {
  const { t } = useTranslation();
  const saved = useAppStore((s) => s.savedCalendarView);
  const save = useAppStore((s) => s.saveCalendarView);

  const option = (v: MobileCalendarView, label: string) => (
    <button
      type="button"
      aria-pressed={saved === v}
      onClick={() => save(v)}
      className={`join-item btn btn-xs ${saved === v ? 'btn-primary' : 'btn-ghost opacity-60'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <CalendarDays size={16} className="flex-shrink-0 text-base-content/50" />
      <span className="flex-1 text-md font-medium">{t('mobile.profile.calendar')}</span>
      <div className="join">
        {option('day', t('mobile.calendar.dayView'))}
        {option('week', t('mobile.calendar.weekView'))}
      </div>
    </div>
  );
}
