import { Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { SubjectStatus } from '@/types/studyPlan';
import type { SubjectSuccessRate } from '@/types/documents';
import { useTranslation } from '@/hooks/useTranslation';

/** Avg fail rate over last 3 semesters using "Všechny termíny" aggregate. Returns 0-100 or null. */
export function computeFailRate(sr: SubjectSuccessRate | undefined): number | null {
  if (!sr?.stats?.length) return null;
  const recent = sr.stats.slice(0, 3);
  let totalPass = 0, totalFail = 0;
  for (const sem of recent) {
    const allTerms = sem.terms.find(t => t.term === 'Všechny termíny');
    if (allTerms) { totalPass += allTerms.pass; totalFail += allTerms.fail; }
    else { totalPass += sem.totalPass; totalFail += sem.totalFail; }
  }
  const total = totalPass + totalFail;
  if (total < 10) return null; // Too few students for meaningful data
  return Math.round((totalFail / total) * 100);
}

interface SubjectRowProps {
  subject: SubjectStatus;
  compact?: boolean;
  failRate?: number | null;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates') => void;
  onSearchSubject: (name: string) => void;
}

export function SubjectRow({ subject, compact, failRate, onOpenSubject, onSearchSubject }: SubjectRowProps) {
  const { t } = useTranslation();
  const hasId = subject.id !== '';

  const handleClick = () => {
    if (hasId) {
      onOpenSubject(subject.code, subject.name, subject.id);
    } else {
      onSearchSubject(subject.name);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-base-200/50 transition-colors text-left text-base-content/40"
      >
        {subject.isFulfilled && <CheckCircle2 className="w-3.5 h-3.5 text-success/50 shrink-0" />}
        <span className="text-xs font-mono shrink-0">{subject.code}</span>
        <span className="flex-1 text-xs truncate">{subject.name}</span>
        <span className="text-[10px] shrink-0">{subject.credits} kr.</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-base-200 transition-colors text-left group"
    >
      <span className="badge badge-sm badge-ghost font-mono shrink-0">{subject.code}</span>
      <span className="flex-1 text-sm truncate">{subject.name}</span>
      {failRate != null && failRate >= 20 && !subject.isFulfilled && (
        <span
          className={`badge badge-sm shrink-0 ${failRate >= 25 ? 'badge-error' : 'badge-warning'} badge-outline relative group/fail cursor-pointer`}
          onClick={(e) => { e.stopPropagation(); hasId ? onOpenSubject(subject.code, subject.name, subject.id, undefined, 'stats') : onSearchSubject(subject.name); }}
        >
          <span className="group-hover/fail:hidden">{failRate}%</span>
          <span className="hidden group-hover/fail:inline">{failRate}% {t('subjects.failRateLabel')}</span>
        </span>
      )}
      <span className="text-xs text-base-content/50 shrink-0">{subject.credits} kr.</span>
      {subject.enrollmentCount >= 2 && !subject.isFulfilled && (
        <span className="badge badge-sm badge-error gap-1" title={t('subjects.repeatWarning')}>
          <AlertTriangle className="w-3 h-3" />
          {subject.enrollmentCount}x
        </span>
      )}
      {subject.isFulfilled ? (
        <span className="badge badge-sm badge-success gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {t('subjects.fulfilled')}
        </span>
      ) : subject.isEnrolled ? (
        <span className="badge badge-sm badge-primary badge-outline">{subject.rawStatusText}</span>
      ) : !hasId ? (
        <span className="badge badge-sm badge-ghost gap-1 text-base-content/40">
          <Search className="w-3 h-3" />
          {t('subjects.searchToOpen')}
        </span>
      ) : (
        <span className="badge badge-sm badge-ghost text-base-content/40">{subject.rawStatusText || t('subjects.notFulfilled')}</span>
      )}
    </button>
  );
}
