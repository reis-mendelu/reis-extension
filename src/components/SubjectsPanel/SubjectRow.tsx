import { Search, CheckCircle2, AlertTriangle, Timer, Layers } from 'lucide-react';
import type { SubjectStatus, Zamerani } from '@/types/studyPlan';
import type { ZameraniProgress } from './SubjectsPanelHeader';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import { useTimeline } from '@/hooks';

interface SubjectRowProps {
  subject: SubjectStatus;
  compact?: boolean;
  failRate?: number | null;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates') => void;
  onSearchSubject: (name: string) => void;
  hideStatus?: boolean;
  zamerani?: Zamerani | null;
  zameraniProgress?: ZameraniProgress | null;
}

// Zaměření pseudo-subjects in the plan table always carry these code prefixes.
const ZAMERANI_PREFIXES = ['EBC-ZB', 'EBA-ZB'];
const isZameraniCode = (code: string) => ZAMERANI_PREFIXES.some(p => code.startsWith(p));
// IS Mendelu uses 999 as a sentinel "credits unknown / pass-through" value.
const isSentinelCredits = (credits: number) => credits >= 999;

export function SubjectRow({ subject, compact, failRate, hideStatus, onOpenSubject, onSearchSubject, zamerani, zameraniProgress }: SubjectRowProps) {
  const { t } = useTranslation();
  const hasId = subject.id !== '';
  const displayName = useCourseName(subject.code, subject.name);
  const timeline = useTimeline(subject.code);
  const isZamerani = isZameraniCode(subject.code);
  const showCredits = !isSentinelCredits(subject.credits) && !isZamerani;
  const typeLabel = subject.type?.trim();

  const handleClick = () => {
    if (isZamerani) return; // pseudo-row, not openable
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
        {subject.fulfillmentDate && (
          <span className="text-[9px] text-base-content/30 shrink-0">{subject.fulfillmentDate}</span>
        )}
        {timeline && <span className="text-[9px] font-bold text-primary/60 shrink-0">{timeline.formatted}</span>}
        {showCredits && <span className="text-[10px] shrink-0 font-medium">{subject.credits} kr.</span>}
      </button>
    );
  }

  if (isZamerani) {
    const progressLabel = zameraniProgress
      ? `${zameraniProgress.fulfilled}/${zameraniProgress.total}` +
        (zameraniProgress.enrolled > 0 ? ` (+${zameraniProgress.enrolled})` : '')
      : null;
    return (
      <div className="w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-base-200/30 border border-dashed border-base-300 text-left">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-base-content/50 shrink-0" />
          <span className="text-sm font-medium truncate flex-1">{displayName}</span>
          {progressLabel && (
            <span className="text-[10px] font-mono text-base-content/60 shrink-0">{progressLabel}</span>
          )}
          <span className="badge badge-sm badge-ghost text-[10px]">{t('subjects.zamerani')}</span>
        </div>
        {zamerani?.description && (
          <p className="pl-5 text-[11px] text-base-content/60 leading-snug line-clamp-3">{zamerani.description}</p>
        )}
        {zamerani && zamerani.subjects.length > 0 && (
          <div className="pl-5 flex flex-col gap-0.5">
            <div className="text-[10px] uppercase tracking-wider text-base-content/40">{t('subjects.zameraniMembers')}</div>
            {zamerani.subjects.map(s => (
              <div key={s.code} className="text-[11px] text-base-content/60 truncate">
                <span className="font-mono text-base-content/70">{s.code}</span>
                {s.name !== s.code && <span> — {s.name}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
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
      {typeLabel && (
        <span className="text-[10px] font-mono uppercase text-base-content/40 shrink-0">{typeLabel}</span>
      )}
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
      {showCredits && (
        <span className="text-xs text-base-content/50 shrink-0">{subject.credits} kr.</span>
      )}
      {subject.fulfillmentDate && (
        <span className="text-[10px] text-base-content/40 font-mono shrink-0 hidden sm:inline">{subject.fulfillmentDate}</span>
      )}
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
