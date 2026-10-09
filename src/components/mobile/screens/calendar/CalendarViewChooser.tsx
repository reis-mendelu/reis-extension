import { toast } from 'sonner';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MobileCalendarView } from '../../../../store/types';

/**
 * Asked once (spec 2026-10-09): Den or Týden, tried live on the student's own
 * timetable above it, saved only by the button that names what it saves.
 *
 * It stands where the view switch used to float, above the tab bar, and only
 * over the real day and week views — never the skeleton or the error state.
 * The toast after saving says where the choice lives now, because the
 * calendar itself no longer carries a switch.
 *
 * The segments are tonal like BottomNav's active tab (--tone-primary on the
 * /15 tint), so the one solid lime control is the save button.
 */
export function CalendarViewChooser() {
  const { t } = useTranslation();
  const view = useAppStore((s) => s.mobileCalendarView);
  const show = useAppStore((s) => s.showCalendarView);
  const save = useAppStore((s) => s.saveCalendarView);

  const label = (v: MobileCalendarView) =>
    t(v === 'day' ? 'mobile.calendar.dayView' : 'mobile.calendar.weekView');

  const option = (v: MobileCalendarView) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => show(v)}
      className={`join-item btn btn-ghost btn-sm flex-1 ${
        view === v ? 'bg-primary/15 text-[var(--tone-primary)]' : 'text-base-content/70'
      }`}
    >
      {label(v)}
    </button>
  );

  return (
    <section
      data-testid="calendar-view-chooser"
      aria-label={t('mobile.calendar.chooserTitle')}
      className="absolute bottom-[calc(84px_+_var(--safe-bottom,0px))] left-1/2 z-30 w-[calc(100%-20px)] max-w-sm -translate-x-1/2 rounded-3xl border border-base-300 bg-base-100 p-3 shadow-drawer"
    >
      <h2 className="text-md font-bold">{t('mobile.calendar.chooserTitle')}</h2>
      <p className="mt-0.5 text-sm text-base-content/70">{t('mobile.calendar.chooserLine')}</p>
      <div
        role="group"
        aria-label={t('mobile.calendar.viewLabel')}
        className="join mt-2.5 flex w-full rounded-full border border-base-300 bg-base-200 p-0.5"
      >
        {option('day')}
        {option('week')}
      </div>
      <button
        type="button"
        onClick={() => {
          save(view);
          toast(t('mobile.calendar.chooserSaved'));
        }}
        className="btn btn-primary btn-block mt-2.5 rounded-full"
      >
        {t('mobile.calendar.chooserSave', { view: label(view) })}
      </button>
    </section>
  );
}
