import { useState } from 'react';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { percentileStanding } from '../../../../api/studyComparison';
import type { StudyStats, StudyComparison } from '../../../../types/studyPlan';

interface AverageAccordionProps {
  studyStats: StudyStats | null;
  comparison: StudyComparison | null;
}

// IS Mendelu grade averages use a Czech decimal comma (lower is better).
function formatGpa(value: number): string {
  if (value <= 0) return '–';
  return value.toFixed(2).replace('.', ',');
}

function AverageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-base-300/60 py-2.5 first:border-t-0">
      <span className="text-base text-base-content/70">{label}</span>
      <span className="flex-1 border-b border-dotted border-base-300" />
      <span className="font-display text-base font-semibold text-base-content">{value}</span>
    </div>
  );
}

/**
 * Collapsible study-average section: the three GPA figures (this semester,
 * whole degree, weighted) plus the year-group standing line. Collapsed by
 * default — local `open` state only, nothing persisted.
 */
export function AverageAccordion({ studyStats, comparison }: AverageAccordionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const hasAverages =
    !!studyStats &&
    [studyStats.currentSemester.gpa, studyStats.gpaTotal, studyStats.weightedGpaTotal].some(
      (v) => v > 0
    );
  const standing = comparison ? percentileStanding(comparison.percentile) : null;

  if (!hasAverages && !standing) return null;

  return (
    <div className="flex-shrink-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3.5"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('mobile.subjects.average')}
        </span>
        {open ? (
          <ChevronUp size={14} className="flex-shrink-0 text-base-content/50" />
        ) : (
          <ChevronDown size={14} className="flex-shrink-0 text-base-content/50" />
        )}
      </button>
      {open && (
        <div className="flex flex-col px-4 pb-3.5">
          {hasAverages && studyStats && (
            <>
              <AverageRow
                label={t('mobile.subjects.avgSemester')}
                value={formatGpa(studyStats.currentSemester.gpa)}
              />
              <AverageRow
                label={t('mobile.subjects.avgTotal')}
                value={formatGpa(studyStats.gpaTotal)}
              />
              <AverageRow
                label={t('mobile.subjects.avgWeighted')}
                value={formatGpa(studyStats.weightedGpaTotal)}
              />
            </>
          )}
          {standing && comparison && (
            <div
              className={`flex items-center gap-2 pt-2.5 ${hasAverages ? 'mt-1 border-t border-base-300/60' : ''}`}
            >
              <Trophy size={15} className="flex-shrink-0 text-primary" />
              <span className="text-base font-medium text-base-content">
                {standing.tier === 'top'
                  ? t('mobile.subjects.topTier', { pct: Math.round(standing.pct) })
                  : t('mobile.subjects.beats', { pct: Math.round(standing.pct) })}
              </span>
            </div>
          )}
          {standing && comparison && (
            <div className="flex items-baseline justify-end gap-2 pt-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                {t('mobile.subjects.rank')}
              </span>
              <span className="font-display text-base font-semibold text-base-content">
                {comparison.rank}. / {comparison.total}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
