import { useTranslation } from '../../../../hooks/useTranslation';
import { computeFailRate } from '../../../SubjectsPanel/computeFailRate';
import { orderHardestFirst } from '../../../SubjectsPanel/orderHardestFirst';
import { FailRateLegend } from '../../../SubjectsPanel/FailRateLegend';
import { useAppStore } from '../../../../store/useAppStore';
import { pluralSuffix } from '../../../../utils/plural';
import type { SubjectStatus } from '../../../../types/studyPlan';
import type { EnrolledSubject } from '../../../../utils/mobile/enrolledSubjects';
import { SemesterRow } from './SemesterRow';

interface SemesterCardProps {
  /** What the student actually enrolled in — see utils/mobile/enrolledSubjects. */
  enrolled: EnrolledSubject[];
  /** The semester those enrolments are in, or null if the plan says nothing. */
  semester: number | null;
  onOpenSubject: (subject: SubjectStatus) => void;
  /**
   * The exchange-student fallback, built from the subjects store rather than a
   * study plan (see useEffectiveStudyPlan). It knows names and codes only, so
   * the card claims nothing else: no credits on the rows and no "done" count.
   */
  exchange?: boolean;
}

/**
 * This semester's subject list: header (semester number, enrolled count,
 * done/total badge) plus one row per subject with a grade chip.
 *
 * Fed the ENROLLED subjects rather than a study-plan block. A block is the
 * curriculum, so one offering a choice listed every option — a student taking
 * Java saw C++ beside it — and the block itself had to be guessed at. Both the
 * filtering and the guess are gone; this component only lays out what it is
 * given.
 */
export function SemesterCard({
  enrolled,
  semester,
  onOpenSubject,
  exchange = false,
}: SemesterCardProps) {
  const { t, language } = useTranslation();
  const successRates = useAppStore((s) => s.successRates);
  /**
   * Hardest first, with the subjects already passed at the end — the same rule
   * and the same shared function the desktop panel uses.
   *
   * Deliberately not a second implementation. `selectEnrolledNow` exists
   * because these two clients answering the same question differently has been
   * a reported bug before, and an order is part of that answer: a student
   * comparing the phone to the browser would otherwise see the same subjects in
   * two different sequences.
   *
   * `e.done` rather than `isFulfilled`: this list carries the subjects passed
   * THIS semester, which is what that flag means here.
   */
  const subjects = orderHardestFirst(
    enrolled,
    (e) => computeFailRate(successRates[e.subject.code]),
    (e) => e.done
  ).map((e) => e.subject);
  const doneCount = enrolled.filter((e) => e.done).length;
  // With no semester number the title says what the list is instead. "{n}.
  // semestr" with an empty n rendered ". semestr" — always, for the exchange
  // fallback, whose one block has no title.
  const title =
    semester === null
      ? t('subjects.enrolledNow')
      : t('mobile.subjects.currentSemester', { n: String(semester) });

  // Same test the rows apply, so the caption appears exactly when a number it
  // explains does: unfulfilled, and with enough results to compute a rate.
  const anyFailRate = subjects.some(
    (s) => !s.isFulfilled && computeFailRate(successRates[s.code]) != null
  );

  // How many subjects the student is enrolled in, and nothing else. This line
  // used to say whether term had started ("právě běží", "začíná 21. 9.") and
  // the credit total — the date belongs to the calendar, the credits are on
  // every row below, and the count, the one number checked here, was missing.
  const subtitle = t(`mobile.subjects.enrolledCount${pluralSuffix(language, subjects.length)}`, {
    count: subjects.length,
  });

  return (
    <div className="flex-shrink-0 overflow-hidden rounded-2xl border border-primary/30 bg-base-100 shadow-card">
      <div className="flex items-center gap-2.5 px-3.5 pb-0.5 pt-3">
        <span className="h-8 w-1 flex-shrink-0 rounded-full bg-primary" />
        <div className="flex flex-1 flex-col">
          <span className="font-display text-base font-semibold text-base-content">
            {title}
          </span>
          <span className="text-xs text-base-content/60">{subtitle}</span>
        </div>
        {!exchange && (
          <span className="flex-shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-[var(--tone-primary)]">
            {t('mobile.subjects.doneOf', { done: doneCount, total: subjects.length })}
          </span>
        )}
      </div>
      {/* Once for the list, never on the rows — the same bargain the study plan
          struck, and the reason the rows below show a bare percentage. Only
          where a row actually shows one: a caption over nothing is noise. */}
      {anyFailRate && (
        <div className="px-3.5 pt-1">
          <FailRateLegend />
        </div>
      )}
      <div className="flex flex-col px-2 pb-2 pt-1">
        {subjects.map((s) => (
          <SemesterRow
            key={s.code}
            subject={s}
            onOpenSubject={onOpenSubject}
            showCredits={!exchange}
          />
        ))}
      </div>
    </div>
  );
}
