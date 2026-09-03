import { useTranslation } from '../../../../hooks/useTranslation';
import { useCourseGrade } from '../../../../hooks/data/useCourseGrade';
import { gradeBadge } from '../../../../utils/gradeLookup';
import { isRealCredits } from '../../../SubjectsPanel/utils';
import { computeFailRate } from '../../../SubjectsPanel/computeFailRate';
import { useAppStore } from '../../../../store/useAppStore';
import { useSchedule } from '../../../../hooks/data/useSchedule';
import { semesterProgress } from '../../../../utils/mobile/semesterStart';
import { pluralSuffix } from '../../../../utils/plural';
import type { SubjectStatus } from '../../../../types/studyPlan';
import type { EnrolledSubject } from '../../../../utils/mobile/enrolledSubjects';

interface SemesterCardProps {
  /** What the student actually enrolled in — see utils/mobile/enrolledSubjects. */
  enrolled: EnrolledSubject[];
  /** The semester those enrolments are in, or null if the plan says nothing. */
  semester: number | null;
  onOpenSubject: (subject: SubjectStatus) => void;
}

function GradeChip({ subject }: { subject: SubjectStatus }) {
  const { t } = useTranslation();
  const grade = useCourseGrade(subject.id, subject.code);
  const badge = gradeBadge(grade);
  if (!badge) return null;

  const isFail = badge.kind === 'letter' && !badge.passed;
  const text =
    badge.kind === 'letter'
      ? badge.text
      : badge.kind === 'credited'
        ? t('subjects.grade.credited')
        : t('subjects.grade.completed');

  return (
    <span
      className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${isFail ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}
    >
      {text}
    </span>
  );
}

/**
 * How often this subject is failed, and the word saying so.
 *
 * The phone never showed this; the browser extension has carried it on every
 * row for years, from the same `computeFailRate` over the same store data —
 * another case of the phone screen being written fresh instead of reusing what
 * the desktop already had.
 *
 * The label is not hover-revealed, the way the desktop's was until this same
 * change: a bare colour-coded percentage does not say what it measures, and a
 * touch screen has no hover to reveal it with. It reads "Neúspěšnost: 28 %" in
 * full — the word and the number together, so the row needs no legend.
 */
function FailRate({ subject }: { subject: SubjectStatus }) {
  const { t } = useTranslation();
  const rate = useAppStore((s) => s.successRates[subject.code]);
  // A rate is a forecast. Once the subject is passed it is history, and
  // computeFailRate already returns null below ten results, where the number
  // would be noise dressed as a warning.
  if (subject.isFulfilled) return null;
  const failRate = computeFailRate(rate);
  if (failRate == null) return null;

  return (
    <span
      data-testid="subject-fail-rate"
      className={`w-fit flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
        failRate >= 25
          ? 'bg-error/10 text-error'
          : failRate >= 20
            ? 'bg-warning/15 text-warning-content'
            : 'bg-base-content/5 text-base-content/50'
      }`}
    >
      {t('subjects.failRateChip', { rate: failRate })}
    </span>
  );
}

function SemesterRow({
  subject,
  onOpenSubject,
}: {
  subject: SubjectStatus;
  onOpenSubject: (subject: SubjectStatus) => void;
}) {
  const { t, language } = useTranslation();
  // Per-subject credits are small numbers, where Czech needs all three forms
  // ("1 kredit" / "2 kredity" / "5 kreditů"). The shared `subjects.credits`
  // is the invariant genitive, correct only for the 5+ totals desktop shows.
  const creditWord = t(`mobile.subjects.credit${pluralSuffix(language, subject.credits)}`);
  return (
    <button
      type="button"
      onClick={() => onOpenSubject(subject)}
      // items-start, not items-center: a long name wraps to three lines at
      // 320px, and centring put the chip and the credits in the MIDDLE of it —
      // "Počítačové [Neúspěšnost: 28 %] sítě". Top-aligned they sit beside the
      // first line, and on the common single-line row this renders identically.
      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left active:bg-base-200"
    >
      {/* Inline with the name from `md:` up, stacked under it below that.
          Measured, not taste: the labelled chip is ~130px and the credits ~65px,
          so on a phone an inline name is left with forty pixels — `break-words`
          then breaks it mid-word and it still spills over the chip. The iPad
          (834pt portrait, and it runs this same phone tree) and the desktop sit
          above the breakpoint and keep the chip on the row, where there is
          room for it.

          The name wraps rather than truncating either way — the prototype
          ellipsizes exam card titles but deliberately not these, and at 390px a
          cut landed mid-word ("Databázové systémy a návrh d…"), losing the half
          that distinguishes one subject from another. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-start md:gap-2.5">
        <span className="min-w-0 break-words text-md font-medium text-base-content">
          {subject.name}
        </span>
        <FailRate subject={subject} />
      </span>
      <GradeChip subject={subject} />
      {isRealCredits(subject.credits) && (
        <span className="flex-shrink-0 text-sm text-base-content/50">
          {subject.credits} {creditWord}
        </span>
      )}
    </button>
  );
}

/**
 * This semester's subject list: header (semester number, total credits,
 * done/total badge) plus one row per subject with a grade chip.
 *
 * Fed the ENROLLED subjects rather than a study-plan block. A block is the
 * curriculum, so one offering a choice listed every option — a student taking
 * Java saw C++ beside it — and the block itself had to be guessed at. Both the
 * filtering and the guess are gone; this component only lays out what it is
 * given.
 */
export function SemesterCard({ enrolled, semester, onOpenSubject }: SemesterCardProps) {
  const { t, language } = useTranslation();
  const subjects = enrolled.map((e) => e.subject);
  const totalCredits = subjects.reduce(
    (sum, s) => sum + (isRealCredits(s.credits) ? s.credits : 0),
    0
  );
  const doneCount = enrolled.filter((e) => e.done).length;
  const semNum = semester === null ? '' : String(semester);

  // "Právě běží" used to be asserted whatever the date, so the week before term
  // announced these subjects as already running. The schedule answers it: the
  // earliest stored lesson is the first teaching day.
  const { schedule } = useSchedule();
  const progress = semesterProgress(schedule);
  const subtitle =
    progress.state === 'running'
      ? t('mobile.subjects.running', { credits: totalCredits })
      : progress.state === 'upcoming'
        ? t('mobile.subjects.startsOn', {
            date: progress.start.toLocaleDateString(language === 'en' ? 'en-US' : 'cs-CZ', {
              day: 'numeric',
              month: 'numeric',
            }),
            credits: totalCredits,
          })
        : // No schedule to reason from: the credits are a fact, "running" is not.
          t('mobile.subjects.creditsOnly', { credits: totalCredits });

  return (
    <div className="flex-shrink-0 overflow-hidden rounded-2xl border border-primary/30 bg-base-100 shadow-card">
      <div className="flex items-center gap-2.5 px-3.5 pb-0.5 pt-3">
        <span className="h-8 w-1 flex-shrink-0 rounded-full bg-primary" />
        <div className="flex flex-1 flex-col">
          <span className="font-display text-base font-semibold text-base-content">
            {t('mobile.subjects.currentSemester', { n: semNum })}
          </span>
          <span className="text-xs text-base-content/60">{subtitle}</span>
        </div>
        <span className="flex-shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          {t('mobile.subjects.doneOf', { done: doneCount, total: subjects.length })}
        </span>
      </div>
      <div className="flex flex-col px-2 pb-2 pt-1">
        {subjects.map((s) => (
          <SemesterRow key={s.code} subject={s} onOpenSubject={onOpenSubject} />
        ))}
      </div>
    </div>
  );
}
