import { UserRoundPen } from 'lucide-react';
import type { SemesterStats } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import { garantChange } from './garantChange';
import { semesterLabel } from './semesterLabel';

/**
 * Who was garant in the selected semester, and — when the shown semesters had
 * more than one — a one-line caveat that the older ones may not reflect the
 * subject as it is taught now (Task List, 2026-11-07). Renders nothing for
 * data crawled before reis-data carried `garant`.
 */
export function GarantNote({ current, shown }: { current: SemesterStats; shown: SemesterStats[] }) {
  const { t } = useTranslation();
  const change = garantChange(shown);
  if (!current.garant && !change) return null;
  return (
    <div className="-mt-4 mb-5 flex flex-col items-center gap-1 text-center text-xs text-base-content/70">
      {current.garant && (
        <p data-testid="garant-line">{t('successRate.garant', { name: current.garant })}</p>
      )}
      {change && (
        <p data-testid="garant-change" className="flex items-start gap-1.5">
          <UserRoundPen size={14} className="mt-px shrink-0 text-warning" aria-hidden />
          <span>
            {t('successRate.garantChanged', {
              semester: semesterLabel(t, change.since.year, change.since.semesterName),
              before: change.before,
              now: change.now,
            })}
          </span>
        </p>
      )}
    </div>
  );
}
