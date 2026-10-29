import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { pluralSuffix } from '../../../utils/plural';
import {
  czFromPreposition,
  dashRange,
  groupDetail,
  recordedGroups,
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
  excused: 'bg-base-content/8 text-base-content/75',
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
  // While an admin views as a student, the slice still holds the admin's own
  // attendance (the overlay leaves code-keyed stores alone), and a shared course
  // code would show it under the student. Nothing is loaded for the student.
  const groups = useAppStore((s) => (s.impersonation ? undefined : s.attendance[courseCode]));
  const { t, language } = useTranslation();
  const recorded = recordedGroups(groups);
  if (recorded.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/70">
        {t('zaznamnik.attendanceSection')}
      </p>
      {recorded.map((group, gi) => {
        const { attended, counted, absent } = summarizeAttendance(group.records);
        // Every session excused or excluded: "Na 0 z 0" would say nothing, the rows say it all.
        const summary =
          counted > 0
            ? t(`zaznamnik.attendanceSummary${pluralSuffix(language, counted)}`, {
                n: attended,
                z: czFromPreposition(counted),
                total: counted,
              })
            : null;
        const detail = [
          absent > 0 ? t('zaznamnik.attendanceAbsences', { n: absent }) : null,
          groupDetail(group.label, courseCode, group.records[0]?.room),
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <div key={gi} className="@container border border-base-content/15 rounded-lg px-3 py-2">
            {summary && (
              <p className="flex flex-wrap items-baseline gap-x-1.5 mb-1">
                <span className="text-[13px] font-semibold text-base-content">{summary}</span>
                {detail && (
                  <span className="hidden @md:inline text-[11px] text-base-content/70">
                    · {detail}
                  </span>
                )}
              </p>
            )}
            <ul
              className={`divide-y divide-base-content/10 ${summary ? 'border-t border-base-content/10' : ''}`}
            >
              {group.records.map((r, ri) => (
                <li
                  key={ri}
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-[12px] tabular-nums"
                >
                  <span className="text-base-content">{shortDate(r.date)}</span>
                  <span className="flex gap-2 min-w-0 text-base-content/70">
                    <span className="hidden @2xs:inline whitespace-nowrap">
                      {dashRange(r.time)}
                    </span>
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
      <p className="text-[11px] text-base-content/70">{t('zaznamnik.attendanceNote')}</p>
    </div>
  );
}
