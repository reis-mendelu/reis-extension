import { BookOpen, CheckCircle2 } from 'lucide-react';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectRow } from './SubjectRow';
import { isZameraniCode } from './utils';

// Winter semester: Sep 1 – Jan 31. Summer semester: Feb 1 – Aug 31.
function isThisSemester(fulfillmentDate?: string): boolean {
  if (!fulfillmentDate) return false;
  const parts = fulfillmentDate.split('.');
  if (parts.length < 3) return false;
  const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  const now = new Date();
  const isSummer = now.getMonth() >= 1 && now.getMonth() <= 7;
  const semStart = isSummer
    ? new Date(now.getFullYear(), 1, 1)
    : now.getMonth() >= 8
      ? new Date(now.getFullYear(), 8, 1)
      : new Date(now.getFullYear() - 1, 8, 1);
  return date >= semStart && date <= now;
}

interface Props {
  plan: StudyPlan;
  failRates?: Record<string, number | null>;
  subjectSemesters?: Map<string, string[]>;
  subjectToZameranis?: Map<string, string[]>;
  onOpenSubject: (courseCode: string, courseName: string, courseId: string, facultyCode?: string, initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates', isFulfilled?: boolean) => void;
  onSearchSubject: (name: string) => void;
}

function SubjectSlot({ subject, semLabel, failRates, subjectSemesters, subjectToZameranis, onOpenSubject, onSearchSubject }: {
  subject: SubjectStatus;
  semLabel: string | null;
} & Omit<Props, 'plan'>) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-mono text-base-content/25 shrink-0 w-6 md:w-10 text-right">
        {semLabel ?? '–'}
        {semLabel && <span className="hidden md:inline"> sem.</span>}
      </span>
      <div className="flex-1 min-w-0">
        <SubjectRow
          subject={subject}
          failRate={failRates?.[subject.code]}
          failRates={failRates}
          subjectSemesters={subjectSemesters}
          subjectToZameranis={subjectToZameranis}
          hideStatus
          onOpenSubject={onOpenSubject}
          onSearchSubject={onSearchSubject}
        />
      </div>
    </div>
  );
}

export function EnrolledNowSection({ plan, failRates, subjectSemesters, subjectToZameranis, onOpenSubject, onSearchSubject }: Props) {
  const { t } = useTranslation();

  const inProgress: { subject: SubjectStatus; semLabel: string | null }[] = [];
  const passed: { subject: SubjectStatus; semLabel: string | null }[] = [];
  const seen = new Set<string>();

  for (const block of plan.blocks) {
    const semNums = block.title.match(/^(\d+)/);
    const semLabel = semNums ? `${semNums[1]}.` : null;
    for (const group of block.groups) {
      for (const s of group.subjects) {
        if (isZameraniCode(s.code)) continue;
        if (seen.has(s.code)) continue;
        if (s.isEnrolled && !s.isFulfilled) {
          seen.add(s.code);
          inProgress.push({ subject: s, semLabel });
        } else if (s.isFulfilled && s.enrollmentCount > 0 && isThisSemester(s.fulfillmentDate)) {
          seen.add(s.code);
          passed.push({ subject: s, semLabel });
        }
      }
    }
  }

  if (inProgress.length === 0 && passed.length === 0) return null;

  const slotProps = { failRates, subjectSemesters, subjectToZameranis, onOpenSubject, onSearchSubject };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/10">
        <BookOpen className="w-3.5 h-3.5 text-primary/70 shrink-0" />
        <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">{t('subjects.enrolledNow')}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-primary/60 font-mono">{inProgress.length}</span>
          {passed.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-success/50 font-mono">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {passed.length}
            </span>
          )}
        </span>
      </div>

      <div className="px-2 py-1.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
          {inProgress.map(({ subject, semLabel }) => (
            <SubjectSlot key={subject.code} subject={subject} semLabel={semLabel} {...slotProps} />
          ))}
        </div>

        {passed.length > 0 && (
          <>
            {inProgress.length > 0 && (
              <div className="flex items-center gap-2 px-3 my-0.5">
                <div className="h-px flex-1 bg-success/15" />
                <span className="text-[9px] text-success/40 uppercase tracking-wider font-medium">{t('subjects.fulfilled')}</span>
                <div className="h-px flex-1 bg-success/15" />
              </div>
            )}
            <div className="opacity-60 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
              {passed.map(({ subject, semLabel }) => (
                <SubjectSlot key={subject.code} subject={subject} semLabel={semLabel} {...slotProps} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
