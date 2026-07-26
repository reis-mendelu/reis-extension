import { BookOpen } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { useStudyPlan } from '../../../hooks/useStudyPlan';
import { getSemesterState } from '../../SubjectsPanel/utils';
import type { SubjectStatus } from '../../../types/studyPlan';
import { ScreenHeader } from './calendar/ScreenHeader';
import { CreditRing } from './subjects/CreditRing';
import { SemesterCard } from './subjects/SemesterCard';
import { AverageAccordion } from './subjects/AverageAccordion';

function SubjectsSkeleton() {
    return (
        <div data-testid="subjects-skeleton" className="flex flex-1 flex-col gap-3 overflow-hidden p-5">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-base-300" />
            <div className="h-20 animate-pulse rounded-2xl bg-base-300" />
            <div className="h-40 animate-pulse rounded-2xl bg-base-300" />
            <div className="h-14 animate-pulse rounded-2xl bg-base-300" />
        </div>
    );
}

function EmptyState() {
    const { t } = useTranslation();
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookOpen size={28} />
            </div>
            <div className="font-display text-base font-bold">{t('mobile.subjects.emptyTitle')}</div>
            <div className="max-w-56 text-2xs text-base-content/60">{t('mobile.subjects.emptyBody')}</div>
        </div>
    );
}

export function SubjectsScreen() {
    const { t } = useTranslation();
    const plan = useStudyPlan();
    const studyStats = useAppStore((s) => s.studyStats);
    const studyComparison = useAppStore((s) => s.studyComparison);
    const pushSheet = useAppStore((s) => s.pushSheet);
    const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
    const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);

    if (!handshakeDone && !handshakeTimedOut) {
        return <SubjectsSkeleton />;
    }

    const openPlan = () => pushSheet({ kind: 'studyPlan' });
    const headerAction = (
        <button
            type="button"
            onClick={openPlan}
            className="flex h-11 flex-shrink-0 items-center rounded-lg bg-primary/15 px-3.5 text-2xs font-semibold text-primary"
        >
            {t('mobile.subjects.studyPlan')}
        </button>
    );

    if (!plan) {
        return (
            <div data-testid="subjects-screen" className="flex flex-1 flex-col overflow-hidden">
                <ScreenHeader eyebrow="" title={t('mobile.subjects.title')} action={headerAction} />
                <EmptyState />
            </div>
        );
    }

    const currentBlock = plan.blocks.find((b) => getSemesterState(b) === 'current') ?? null;
    const openSubject = (subject: SubjectStatus) => {
        pushSheet({ kind: 'subjectDrawer', courseCode: subject.code, courseName: subject.name, courseId: subject.id });
    };

    return (
        <div data-testid="subjects-screen" className="flex flex-1 flex-col overflow-hidden">
            <ScreenHeader eyebrow={plan.title} title={t('mobile.subjects.title')} action={headerAction} />
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-24 pt-3.5">
                <CreditRing earned={plan.creditsAcquired} total={plan.creditsRequired} />
                {currentBlock && <SemesterCard block={currentBlock} onOpenSubject={openSubject} />}
                <AverageAccordion studyStats={studyStats} comparison={studyComparison} />
            </div>
        </div>
    );
}
