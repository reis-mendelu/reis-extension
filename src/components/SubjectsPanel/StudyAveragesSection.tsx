import type { StudyStats } from '@/types/studyPlan';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  studyStats: StudyStats | null;
}

// IS Mendelu grade averages use a Czech decimal comma (lower is better).
function formatGpa(value: number): string {
  if (value <= 0) return '–'; // en-dash when the average isn't available yet
  return value.toFixed(2).replace('.', ',');
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-center">
      <span className="text-lg font-semibold tabular-nums leading-none">{formatGpa(value)}</span>
      <span className="text-[10px] text-base-content/50 leading-tight">{label}</span>
    </div>
  );
}

export function StudyAveragesSection({ studyStats }: Props) {
  const { t } = useTranslation();
  if (!studyStats) return null;

  const period = studyStats.currentSemester.gpa;
  const total = studyStats.gpaTotal;
  const weighted = studyStats.weightedGpaTotal;

  // Nothing to show for students with no graded subjects yet.
  if ([period, total, weighted].every(v => v <= 0)) return null;

  return (
    <div className="bg-base-200/30 border border-base-300/50 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-base-300/30">
        <span className="block text-center text-xs text-base-content/40 font-medium uppercase tracking-wider">{t('subjects.averages.title')}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-base-300/40">
        {/* Current term — single average */}
        <div className="flex flex-col gap-1.5 px-3 py-2">
          <span className="text-xs text-base-content/55 font-semibold uppercase tracking-wider text-center">{t('subjects.averages.term')}</span>
          <Stat value={period} label={t('subjects.averages.avg')} />
        </div>
        {/* Whole study — classic + weighted */}
        <div className="flex flex-col gap-1.5 px-3 py-2">
          <span className="text-xs text-base-content/55 font-semibold uppercase tracking-wider text-center">{t('subjects.averages.study')}</span>
          <div className="grid grid-cols-2">
            <Stat value={total} label={t('subjects.averages.avg')} />
            <Stat value={weighted} label={t('subjects.averages.weighted')} />
          </div>
        </div>
      </div>
    </div>
  );
}
