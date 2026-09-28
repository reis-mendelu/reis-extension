import { MiniCalendar } from './MiniCalendar';
import { ComposerTimeField } from './ComposerTimeField';

const LABEL = 'mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60';

// The date/time block, moved out of EventComposer so the end-date row (a
// second MiniCalendar, optional) has somewhere to live without pushing
// EventComposer.tsx over its line budget.
export function ComposerWhenField({
  date,
  time,
  endDate,
  onDate,
  onTime,
  onEndDate,
  t,
  locale,
}: {
  date: string;
  time: string;
  endDate: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  onEndDate: (v: string) => void;
  t: (k: string) => string;
  locale: string;
}) {
  return (
    <>
      <label className={LABEL}>{t('map.eventWhen')}</label>
      {/* One row when both fit, stacked when not: a picked date reads
          "čt 15. listopadu", which a half-width field in the desktop column
          (or a 320px phone) would cut off. Wrapping goes by the bases. */}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 grow-[3] basis-48">
          <MiniCalendar
            value={date || null}
            onChange={onDate}
            placeholder={t('map.selectDate')}
            t={t}
            locale={locale}
          />
        </div>
        <div className="min-w-0 grow basis-32">
          <ComposerTimeField value={time} onChange={onTime} t={t} />
        </div>
      </div>

      <label className={LABEL}>{t('map.endDate')}</label>
      {/* MiniCalendar has no way to clear a picked date on its own, so the
          clear control lives here, shown only once an end date is set. */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 grow">
          <MiniCalendar
            value={endDate || null}
            onChange={onEndDate}
            placeholder={t('map.selectDate')}
            t={t}
            locale={locale}
          />
        </div>
        {endDate && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            aria-label={t('map.clearEndDate')}
            onClick={() => onEndDate('')}
          >
            ✕
          </button>
        )}
      </div>
      {endDate && date && endDate < date && (
        <p className="mt-1 text-[11px] text-error">{t('map.endBeforeStart')}</p>
      )}
    </>
  );
}
