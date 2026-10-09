import { toast } from 'sonner';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MobileCalendarView } from '../../../../store/types';

/**
 * Asked once (spec 2026-10-09): Den or Týden, tried live on the student's own
 * timetable above it, saved only by the button that names what it saves.
 *
 * It stands above the tab bar, and only under the real day and week views —
 * never the skeleton or the error state. In the layout flow rather than
 * floating: the week grid never scrolls, so it has to shrink to the height
 * left above the panel, whatever height the panel turns out to have (its title
 * wraps at 320px, and in English).
 * The toast after saving says where the choice lives now, because the
 * calendar itself no longer carries a switch.
 *
 * The segments are neutral — the picked one a raised pill, as an iOS segmented
 * control — so the save button is the one green thing on the panel. The pill
 * carries a hairline because base-100 on base-200 is 1.03:1 in the light theme.
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
      className={`flex min-h-9 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
        view === v
          ? 'border-base-content/10 bg-base-100 text-base-content shadow-sm'
          : 'border-transparent text-base-content/70'
      }`}
    >
      {label(v)}
    </button>
  );

  return (
    <section
      data-testid="calendar-view-chooser"
      aria-label={t('mobile.calendar.chooserTitle')}
      className="mx-auto mb-[calc(84px_+_var(--safe-bottom,0px))] w-[calc(100%-20px)] max-w-sm flex-shrink-0 rounded-3xl border border-base-300 bg-base-100 p-3 shadow-drawer"
    >
      <h2 className="text-md font-bold">{t('mobile.calendar.chooserTitle')}</h2>
      <p className="mt-0.5 text-sm text-base-content/70">{t('mobile.calendar.chooserLine')}</p>
      <div
        role="group"
        aria-label={t('mobile.calendar.viewLabel')}
        className="mt-2.5 flex w-full gap-1 rounded-full border border-base-content/10 bg-base-200 p-1"
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
