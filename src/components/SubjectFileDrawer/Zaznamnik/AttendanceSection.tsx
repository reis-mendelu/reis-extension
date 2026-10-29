import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { pluralSuffix } from '../../../utils/plural';
import {
  czFromPreposition,
  dashRange,
  groupDetail,
  shortDate,
  summarizeAttendance,
} from '../../../utils/attendanceSummary';
import type { AttendanceStatus } from '../../../types/documents';

// The status is always a word; the tint only repeats it.
const PILL: Record<AttendanceStatus, string> = {
  present: 'bg-success/12 text-[var(--tone-success)]',
  elsewhere: 'bg-success/12 text-[var(--tone-success)]',
  absent: 'bg-error/12 text-[var(--tone-error)]',
  excluded: 'bg-error/12 text-[var(--tone-error)]',
  late: 'bg-warning/15 text-[var(--tone-warning)]',
  'early-leave': 'bg-warning/15 text-[var(--tone-warning)]',
  excused: 'bg-base-content/8 text-base-content/70',
};

/**
 * Docházka at the top of the Záznamník tab, on both trees (Task List,
 * 2026-10-29). It replaces the unlabelled dots and "0/1" the desktop header
 * used to show: a summary in words, then every recorded session.
 *
 * One `@container` per group: the phone sheet is too narrow for the detail
 * after the summary and for the time column, so they drop out by width.
 */
export function AttendanceSection({ courseCode }: { courseCode: string }) {
  const groups = useAppStore((s) => s.attendance[courseCode]);
  const { t, language } = useTranslation();
  const recorded = groups?.filter((g) => g.records.length > 0) ?? [];
  if (recorded.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/70">
        {t('zaznamnik.attendanceSection')}
      </p>
      {recorded.map((group, gi) => {
        const { attended, counted, absent } = summarizeAttendance(group.records);
        const summary = t(`zaznamnik.attendanceSummary${pluralSuffix(language, counted)}`)
          .replace('{n}', String(attended))
          .replace('{z}', czFromPreposition(counted))
          .replace('{total}', String(counted));
        const detail = [
          absent > 0 ? t('zaznamnik.attendanceAbsences').replace('{n}', String(absent)) : null,
          groupDetail(group.label, courseCode),
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <div key={gi} className="@container border border-base-content/15 rounded-lg px-3 py-2">
            <p className="flex flex-wrap items-baseline gap-x-2 mb-1">
              <span className="text-[13px] font-semibold text-base-content">{summary}</span>
              {detail && (
                <span className="hidden @md:inline text-[11px] text-base-content/60">{detail}</span>
              )}
            </p>
            <ul>
              {group.records.map((r, ri) => (
                <li
                  key={ri}
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 border-t border-base-content/10 text-[12px] tabular-nums"
                >
                  <span className="text-base-content">{shortDate(r.date)}</span>
                  <span className="flex gap-2 min-w-0 text-base-content/60">
                    <span className="hidden @xs:inline whitespace-nowrap">{dashRange(r.time)}</span>
                    <span className="truncate">{r.room}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${PILL[r.status]}`}
                  >
                    {t(`zaznamnik.attendanceStatus.${r.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-[11px] text-base-content/60">{t('zaznamnik.attendanceNote')}</p>
    </div>
  );
}
