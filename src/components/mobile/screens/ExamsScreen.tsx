import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { useExams } from '../../../hooks/data/useExams';
import { useExamActions } from '../../ExamPanel/useExamActions';
import { buildExamTimeline } from '../../../utils/mobile/examTimeline';
import type { ExamSubject, ExamSection } from '../../../types/exams';
import { ScreenHeader } from './calendar/ScreenHeader';
import { ExamTimeline } from './exams/ExamTimeline';
import { ExamGroup } from './exams/ExamGroup';
import { ExamCard } from './exams/ExamCard';
import { ConfirmSheet } from '../sheets/ConfirmSheet';

function ExamsSkeleton() {
    return (
        <div data-testid="exams-skeleton" className="flex flex-1 flex-col gap-3 overflow-hidden p-5">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-base-300" />
            <div className="h-14 animate-pulse rounded-2xl bg-base-300" />
            <div className="h-20 animate-pulse rounded-xl bg-base-300" />
            <div className="h-20 animate-pulse rounded-xl bg-base-300" />
        </div>
    );
}

type Row = { subject: ExamSubject; section: ExamSection };

export function ExamsScreen() {
    const { t } = useTranslation();
    const { exams } = useExams();
    const now = useAppStore((s) => s.now);
    const userSemester = useAppStore((s) => s.userSemester);
    const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
    const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);

    // ExamCard owns its own expand/collapse state (purely local disclosure) —
    // this screen doesn't track which card is open, so there's nothing for
    // useExamActions to collapse after a successful register.
    const { processingSectionId, pendingAction, setPendingAction, handleRegisterRequest, handleUnregisterRequest, handleConfirmAction } =
        useExamActions({ exams, setExpandedSectionId: () => {} });

    const timeline = useMemo(() => buildExamTimeline(exams, now), [exams, now]);

    const eyebrowLabel = t('mobile.exams.eyebrow');
    const eyebrow = userSemester ? `${eyebrowLabel} · ${userSemester}` : eyebrowLabel;

    const { upcoming, other } = useMemo(() => {
        const upcoming: Row[] = [];
        const other: Row[] = [];
        exams.forEach((subject) => {
            subject.sections.forEach((section) => {
                (section.status === 'registered' ? upcoming : other).push({ subject, section });
            });
        });
        return { upcoming, other };
    }, [exams]);

    if (!handshakeDone && !handshakeTimedOut) {
        return <ExamsSkeleton />;
    }

    return (
        <div data-testid="exams-screen" className="flex flex-1 flex-col overflow-hidden">
            <ScreenHeader
                eyebrow={eyebrow}
                title={t('mobile.exams.title')}
                action={upcoming.length > 0 ? (
                    <span className="flex-shrink-0 rounded-full bg-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary">
                        {t('mobile.exams.registeredCount', { count: upcoming.length })}
                    </span>
                ) : undefined}
            />

            {exams.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Calendar size={28} />
                    </div>
                    <div className="font-display text-lg font-bold">{t('mobile.exams.emptyTitle')}</div>
                    <div className="max-w-56 text-xs text-base-content/60">{t('mobile.exams.emptyBody')}</div>
                </div>
            ) : (
                <>
                    <ExamTimeline points={timeline} />
                    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-24 pt-4">
                        {upcoming.length > 0 && (
                            <ExamGroup title={t('mobile.exams.groupUpcoming')} count={upcoming.length}>
                                {upcoming.map(({ subject, section }) => (
                                    <ExamCard
                                        key={section.id}
                                        subject={subject}
                                        section={section}
                                        isProcessing={processingSectionId === section.id}
                                        onRegister={handleRegisterRequest}
                                        onUnregister={handleUnregisterRequest}
                                    />
                                ))}
                            </ExamGroup>
                        )}
                        {other.length > 0 && (
                            <ExamGroup title={t('mobile.exams.groupOther')} count={other.length}>
                                {other.map(({ subject, section }) => (
                                    <ExamCard
                                        key={section.id}
                                        subject={subject}
                                        section={section}
                                        isProcessing={processingSectionId === section.id}
                                        onRegister={handleRegisterRequest}
                                        onUnregister={handleUnregisterRequest}
                                    />
                                ))}
                            </ExamGroup>
                        )}
                    </div>
                </>
            )}

            <ConfirmSheet pendingAction={pendingAction} onConfirm={handleConfirmAction} onCancel={() => setPendingAction(null)} />
        </div>
    );
}
