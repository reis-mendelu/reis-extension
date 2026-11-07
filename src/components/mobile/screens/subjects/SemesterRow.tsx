import { useTranslation } from '../../../../hooks/useTranslation';
import { useCourseGrade } from '../../../../hooks/data/useCourseGrade';
import { gradeBadge } from '../../../../utils/gradeLookup';
import { isRealCredits } from '../../../SubjectsPanel/utils';
import { computeFailRate } from '../../../SubjectsPanel/computeFailRate';
import { failRateTone } from '../../../SubjectsPanel/failRateTone';
import { useAppStore } from '../../../../store/useAppStore';
import { useCourseName } from '../../../../hooks/ui/useCourseName';
import { pluralSuffix } from '../../../../utils/plural';
import type { SubjectStatus } from '../../../../types/studyPlan';

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
 * How often this subject is failed, as the number and nothing else.
 *
 * The phone never showed this; the browser extension has carried it on every
 * row for years, from the same `computeFailRate` over the same store data —
 * another case of the phone screen being written fresh instead of reusing what
 * the desktop already had.
 *
 * It carried the words "Prům. neúspěšnost:" on every row until the study plan
 * settled the same question the other way: a column's name belongs in a header,
 * not on each cell, and at 320px the sentence was most of the row. The words
 * now appear once per list in `FailRateLegend`, exactly as they do in the plan,
 * so the two screens no longer describe the same number two different ways.
 *
 * `title`/`aria-label` keep the full sentence for a pointer and a screen
 * reader — including the PRŮM., an average, because `computeFailRate` pools the
 * last three semesters and the drawer this opens shows one: "people are
 * confused by seeing 28 % neúspěšnost on a subject but when clicking on it
 * seeing that the last semester had e.g. 35 %".
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

  const label = t('subjects.failRateChip', { rate: failRate });
  return (
    <span
      data-testid="subject-fail-rate"
      title={label}
      aria-label={label}
      // failRateTone, the band the study plan's pill uses: this chip had its
      // own copy, with `text-warning-content` — ink for a SOLID warning fill —
      // on a /15 tint, which is dark on dark and invisible in the dark theme.
      className={`w-fit flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${failRateTone(failRate)}`}
    >
      {failRate}%
    </span>
  );
}

export function SemesterRow({
  subject,
  onOpenSubject,
}: {
  subject: SubjectStatus;
  onOpenSubject: (subject: SubjectStatus) => void;
}) {
  const { t, language } = useTranslation();
  const name = useCourseName(subject.code, subject.name);
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
      {/* Inline with the name at every width now. It used to stack under the
          name on a phone for a measured reason: the chip read "Prům.
          neúspěšnost: 28 %" and was ~130px, which against ~65px of credits left
          an inline name forty pixels to live in. The chip is now the bare
          number the study plan uses — under 30px — so the reason is gone, and
          the row reads the way it always did from `md:` up.

          `justify-between` puts the chip at the right edge of this wrapper,
          which is the credits' left edge, so percentage and credits read as one
          metadata column rather than the chip trailing the name mid-row.

          The name wraps rather than truncating — the prototype ellipsizes exam
          card titles but deliberately not these, and at 390px a cut landed
          mid-word ("Databázové systémy a návrh d…"), losing the half that
          distinguishes one subject from another. */}
      <span className="flex min-w-0 flex-1 flex-row items-start justify-between gap-2.5">
        <span className="min-w-0 break-words text-md font-medium text-base-content">{name}</span>
        <FailRate subject={subject} />
      </span>
      <GradeChip subject={subject} />
      {isRealCredits(subject.credits) && (
        <span className="flex-shrink-0 text-sm font-semibold text-base-content/80">
          {subject.credits} {creditWord}
        </span>
      )}
    </button>
  );
}
