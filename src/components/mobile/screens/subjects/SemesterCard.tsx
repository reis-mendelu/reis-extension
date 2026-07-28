import { useTranslation } from '../../../../hooks/useTranslation';
import { useCourseGrade } from '../../../../hooks/data/useCourseGrade';
import { gradeBadge } from '../../../../utils/gradeLookup';
import { isZameraniCode, isRealCredits } from '../../../SubjectsPanel/utils';
import { pluralSuffix } from '../../../../utils/plural';
import type { SemesterBlock, SubjectStatus } from '../../../../types/studyPlan';

interface SemesterCardProps {
    block: SemesterBlock;
    onOpenSubject: (subject: SubjectStatus) => void;
}

function GradeChip({ subject }: { subject: SubjectStatus }) {
    const { t } = useTranslation();
    const grade = useCourseGrade(subject.id, subject.code);
    const badge = gradeBadge(grade);
    if (!badge) return null;

    const isFail = badge.kind === 'letter' && !badge.passed;
    const text = badge.kind === 'letter'
        ? badge.text
        : badge.kind === 'credited'
            ? t('subjects.grade.credited')
            : t('subjects.grade.completed');

    return (
        <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${isFail ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
            {text}
        </span>
    );
}

function SemesterRow({ subject, onOpenSubject }: { subject: SubjectStatus; onOpenSubject: (subject: SubjectStatus) => void }) {
    const { t, language } = useTranslation();
    // Per-subject credits are small numbers, where Czech needs all three forms
    // ("1 kredit" / "2 kredity" / "5 kreditů"). The shared `subjects.credits`
    // is the invariant genitive, correct only for the 5+ totals desktop shows.
    const creditWord = t(`mobile.subjects.credit${pluralSuffix(language, subject.credits)}`);
    return (
        <button
            type="button"
            onClick={() => onOpenSubject(subject)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left active:bg-base-200"
        >
            {/* Wraps rather than truncating — the prototype ellipsizes exam card
                titles but deliberately not these, and at 390px a cut landed
                mid-word ("Databázové systémy a návrh d…"), losing the half of
                the name that distinguishes one subject from another. */}
            <span className="flex-1 text-md font-medium text-base-content">{subject.name}</span>
            <GradeChip subject={subject} />
            {isRealCredits(subject.credits) && (
                <span className="flex-shrink-0 text-sm text-base-content/50">
                    {subject.credits} {creditWord}
                </span>
            )}
        </button>
    );
}

/** The current semester's subject list: header (semester number, total credits,
 * done/total badge) plus one row per subject with a grade chip. */
export function SemesterCard({ block, onOpenSubject }: SemesterCardProps) {
    const { t } = useTranslation();
    const subjects = block.groups.flatMap((g) => g.subjects).filter((s) => !isZameraniCode(s.code));
    const totalCredits = subjects.reduce((sum, s) => sum + (isRealCredits(s.credits) ? s.credits : 0), 0);
    const doneCount = subjects.filter((s) => s.isFulfilled).length;
    const semNum = block.title.match(/^(\d+)/)?.[1] ?? '';

    return (
        <div className="flex-shrink-0 overflow-hidden rounded-2xl border border-primary/30 bg-base-100 shadow-card">
            <div className="flex items-center gap-2.5 px-3.5 pb-0.5 pt-3">
                <span className="h-8 w-1 flex-shrink-0 rounded-full bg-primary" />
                <div className="flex flex-1 flex-col">
                    <span className="font-display text-base font-semibold text-base-content">
                        {t('mobile.subjects.currentSemester', { n: semNum })}
                    </span>
                    <span className="text-xs text-base-content/60">
                        {t('mobile.subjects.running', { credits: totalCredits })}
                    </span>
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
