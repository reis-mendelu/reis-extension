import { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown } from 'lucide-react';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectRow } from './SubjectRow';
import { FailRateLegend } from './FailRateLegend';
import { isZameraniCode, isThisSemester } from './utils';

interface Props {
  plan: StudyPlan;
  failRates?: Record<string, number | null>;
  subjectSemesters?: Map<string, string[]>;
  subjectToZameranis?: Map<string, string[]>;
  onOpenSubject: (
    courseCode: string,
    courseName: string,
    courseId: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates',
    isFulfilled?: boolean
  ) => void;
  onSearchSubject: (name: string) => void;
}

function SubjectSlot({
  subject,
  semLabel,
  failRates,
  subjectSemesters,
  subjectToZameranis,
  onOpenSubject,
  onSearchSubject,
}: {
  subject: SubjectStatus;
  semLabel: string | null;
} & Omit<Props, 'plan'>) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] md:text-[11px] font-mono text-base-content/70 shrink-0 w-6 md:w-12 text-right">
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

export function EnrolledNowSection({
  plan,
  failRates,
  subjectSemesters,
  subjectToZameranis,
  onOpenSubject,
  onSearchSubject,
}: Props) {
  const { t } = useTranslation();
  // Passed subjects are non-actionable (already done), so they stay collapsed by
  // default — the count lives in the header, so no progress signal is lost. Auto-expand
  // when nothing is in progress, so the section is never empty at semester's end.
  const [showPassed, setShowPassed] = useState(false);

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

  /**
   * Hardest first, not plan order.
   *
   * The rates were already on every row; this is what turns the list into a
   * ranking — "can we sort these subjects according to their success rates?".
   * The subject most likely to cost a student their semester now leads instead
   * of sitting wherever the study plan happened to put it.
   *
   * A MISSING rate sorts last rather than as a zero. `computeFailRate` returns
   * null under ten results, so absence means "not enough data", and ranking
   * that as the easiest subject on the screen would be a claim the data does
   * not support. Ties keep the plan's own order, which `sort` gives us for free
   * — it is stable, and the plan's order is the only other meaningful one here.
   *
   * Only the in-progress list. The passed rows are history: `SubjectRow` hides
   * the pill on a fulfilled subject, so sorting them by an invisible number
   * would shuffle a list for no visible reason.
   */
  const rank = (s: SubjectStatus) => failRates?.[s.code] ?? -1;
  inProgress.sort((a, b) => rank(b.subject) - rank(a.subject));

  if (inProgress.length === 0 && passed.length === 0) return null;

  // Same rule as the study plan's: the caption goes only where the column it
  // names actually appears. Every row here is visible, so this is simply "does
  // any of them carry a rate" — SubjectRow additionally hides the pill behind a
  // grade badge, which costs a spurious line on a section where every enrolled
  // subject is already graded, and that is the narrow case worth living with
  // rather than lifting a per-row hook up here.
  const anyFailRate = [...inProgress, ...passed].some(
    ({ subject }) => !subject.isFulfilled && failRates?.[subject.code] != null
  );

  const slotProps = {
    failRates,
    subjectSemesters,
    subjectToZameranis,
    onOpenSubject,
    onSearchSubject,
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/12 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/10">
        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">
          {t('subjects.enrolledNow')}
        </span>
        {/* No counter for the subjects in progress. It was a red ⊗ and a
            number — the error tone, over every subject the student was
            currently taking, none of which had gone wrong. The count is also
            the length of the list directly underneath. The passed count stays:
            those rows are collapsed by default, so it is the only place that
            progress shows. */}
        <span className="ml-auto flex items-center gap-3">
          {passed.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-base-content/70 font-mono font-normal">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              {passed.length}
            </span>
          )}
        </span>
      </div>

      <div className="px-2 py-1.5">
        {/* The rows below show the fail rate as a bare number; this names it
            once for the section — see FailRateLegend. */}
        {anyFailRate && (
          <div className="px-1 pb-1">
            <FailRateLegend />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
          {inProgress.map(({ subject, semLabel }) => (
            <SubjectSlot key={subject.code} subject={subject} semLabel={semLabel} {...slotProps} />
          ))}
        </div>

        {passed.length > 0 && (
          <>
            {inProgress.length > 0 && (
              <button
                onClick={() => setShowPassed((v) => !v)}
                className="w-full flex items-center gap-2 px-3 mt-2 mb-1 group"
              >
                <div className="h-px flex-1 bg-success/15" />
                <span className="flex items-center gap-1 text-[9px] text-success/40 group-hover:text-success/70 uppercase tracking-wider font-medium transition-colors">
                  {passed.length} {t('subjects.fulfilled')}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${showPassed ? 'rotate-180' : ''}`}
                  />
                </span>
                <div className="h-px flex-1 bg-success/15" />
              </button>
            )}
            {(inProgress.length === 0 || showPassed) && (
              <div className="opacity-60 grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {passed.map(({ subject, semLabel }) => (
                  <SubjectSlot
                    key={subject.code}
                    subject={subject}
                    semLabel={semLabel}
                    {...slotProps}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
