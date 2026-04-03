import { Search, CheckCircle2, AlertTriangle, Timer } from 'lucide-react';
import type { SubjectStatus } from '@/types/studyPlan';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import { useTimeline } from '@/hooks';

interface SubjectRowProps {
  subject: SubjectStatus;
  compact?: boolean;
  failRate?: number | null;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates') => void;
  onSearchSubject: (name: string) => void;
  hideStatus?: boolean;
}

export function SubjectRow({ subject, compact, failRate, hideStatus, onOpenSubject, onSearchSubject }: SubjectRowProps) {
  const { t } = useTranslation();
  const hasId = subject.id !== '';
  const displayName = useCourseName(subject.code, subject.name);
  const timeline = useTimeline(subject.code);

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
        <span className="flex-1 text-xs truncate">{displayName}</span>
        {timeline && <span className="text-[9px] font-bold text-primary/60 shrink-0">{timeline.formatted}</span>}
        <span className="text-[10px] shrink-0 font-medium">{subject.credits} kr.</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-base-200 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-sm truncate font-medium">{displayName}</span>
        {timeline && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-primary/60 mt-0.5">
            <Timer size={10} />
            <span>{timeline.formatted}</span>
          </div>
        )}
      </div>
      {failRate != null && !subject.isFulfilled && (
        <span
          className={`flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-medium tracking-wide shrink-0 relative group/fail cursor-pointer transition-colors ${
            failRate >= 25 
              ? 'bg-error/10 text-error hover:bg-error/15'
              : failRate >= 20
              ? 'bg-warning/15 text-warning-content hover:bg-warning/20'
              : 'bg-base-content/5 text-base-content/40 hover:bg-base-content/10'
          }`}
          onClick={(e) => { e.stopPropagation(); if (hasId) onOpenSubject(subject.code, subject.name, subject.id, undefined, 'stats'); else onSearchSubject(subject.name); }}
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
      {!hideStatus && (
        <>
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
        </>
      )}
    </button>
  );
}
