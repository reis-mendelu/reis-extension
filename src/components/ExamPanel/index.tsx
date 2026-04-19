import { useState, useEffect, useMemo } from 'react';
import { ExamFilterBar } from './ExamFilterBar';
import { ExamSectionCard } from './ExamSectionCard';
import { ConfirmationModal } from './ConfirmationModal';
import { EmptyExamsState } from './EmptyExamsState';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { useExamActions } from './useExamActions';
import { ExamPanelHeader } from './ExamPanelHeader';
import { useExamsData } from './useExamsData';
import ExamTimeline from '../Exams/Timeline/ExamTimeline';
import type { TimelineExam } from '../Exams/Timeline/ExamTimeline';
import { useAutoRegistration } from './useAutoRegistration';
import { Zap } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { fetchExamClassmates } from '../../api/terminyInfo';
import { useAppStore } from '../../store/useAppStore';

interface RegisteredExam {
    subjectName: string;
    subject: ExamSubject;
    section: ExamSection;
    term: { id: string; date: string; time: string; room: string; };
}

export function ExamPanel() {
    const { t, language } = useTranslation();
    const {
        exams,
        showSkeleton,
        statusFilter,
        onToggleStatus, 
        selectedSubjects, 
        setSelectedSubjects, 
        clearAllFilters,
        filterCounts, 
        filteredSubjects, 
        subjectOptions 
    } = useExamsData();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { processingSectionId, pendingAction, setPendingAction, handleRegisterRequest, handleUnregisterRequest, handleConfirmAction } = useExamActions({ exams, setExpandedSectionId: setExpandedId });
    const { armedTerms, firingTerms, toggleArm } = useAutoRegistration();
    const studiumId = useAppStore(s => s.studiumId);
    const obdobiId = useAppStore(s => s.obdobiId);

    // Extract registered exams from data
    const realExams = useMemo(() => {
        const registered: RegisteredExam[] = [];

        exams.forEach((sub: ExamSubject) => {
            sub.sections.forEach((sec: ExamSection) => {
                if (sec.status === 'registered' && sec.registeredTerm) {
                    const subjectName = (language === 'en' && sub.nameEn) ? sub.nameEn : (sub.nameCs || sub.name);
                    registered.push({
                        subjectName,
                        subject: sub,
                        section: sec,
                        term: {
                            id: sec.registeredTerm.id || `${sub.code}-${sec.id}`,
                            date: sec.registeredTerm.date,
                            time: sec.registeredTerm.time,
                            room: ((language === 'en' && sec.registeredTerm.roomEn) ? sec.registeredTerm.roomEn : (sec.registeredTerm.roomCs || sec.registeredTerm.room)) || ''
                        }
                    });
                }
            });
        });
        return registered;
    }, [exams, language]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]') && expandedId) setExpandedId(null); };
        document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
    }, [expandedId]);

    useEffect(() => {
        if (!studiumId || !obdobiId || !realExams.length) return;
        for (const exam of realExams) {
            const terminId = exam.term.id;
            if (!terminId || terminId.includes('-')) continue; // skip fallback ids
            fetchExamClassmates(terminId, studiumId, obdobiId).then(classmates => {
                console.log(`[spoluzaci] ${exam.subjectName} (termin ${terminId}):`, classmates);
            });
        }
    }, [realExams, studiumId, obdobiId]);

    return (
        <><div className="flex flex-col h-full bg-base-100 rounded-lg border border-base-300 overflow-hidden relative">
            <ExamPanelHeader />
            
            {armedTerms.size > 0 && (
                <div className="bg-warning/10 border-b border-warning/20 px-4 py-2.5 flex flex-wrap items-center justify-center gap-2">
                    <Zap size={16} className="text-warning animate-pulse shrink-0" />
                    <span className="text-xs font-semibold text-warning-content/80 text-center">
                        {t('exams.autoRegWarning')}
                    </span>
                </div>
            )}
            
            {/* Horizontal Timeline Integration */}
            {realExams.length > 0 && (
                <div className="px-4 pb-0 border-b border-base-200">
                    <ExamTimeline
                        exams={realExams as unknown as TimelineExam[]}
                        orientation="horizontal"
                    />
                </div>
            )}

            {(filterCounts.available === 0 && filterCounts.opening === 0 && filterCounts.registered === 0) && !showSkeleton ? (
                <div className="flex-1 flex items-center justify-center">
                    <EmptyExamsState />
                </div>
            ) : (
                <>
                    <ExamFilterBar 
                        statusFilter={statusFilter} 
                        selectedSubjects={selectedSubjects} 
                        filterCounts={filterCounts} 
                        subjectOptions={subjectOptions} 
                        onToggleStatus={onToggleStatus} 
                        onToggleSubject={(c: string) => setSelectedSubjects((p: string[]) => p.includes(c) ? p.filter((x: string) => x !== c) : [...p, c])} 
                        onClearFilters={clearAllFilters} 
                    />
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">{showSkeleton ? <div className="flex items-center justify-center h-32 opacity-50"><span className="loading loading-spinner mr-2" /> {t('exams.loading')}</div> : !filteredSubjects.length ? <EmptyExamsState />
                        : filteredSubjects.map(({ subject, section }: { subject: ExamSubject, section: ExamSection }) => <ExamSectionCard key={section.id} subject={subject} section={section} isExpanded={expandedId === section.id} isProcessing={processingSectionId === section.id} armedTerms={armedTerms} firingTerms={firingTerms} toggleArm={toggleArm} onToggleExpand={(id: string) => setExpandedId(p => p === id ? null : id)} onRegister={handleRegisterRequest} onUnregister={handleUnregisterRequest} />)}</div>
                </>
            )}
        </div>
        <ConfirmationModal isOpen={!!pendingAction} actionType={pendingAction?.type ?? 'register'} sectionName={pendingAction?.section.name ?? ''} termInfo={pendingAction?.type === 'register' ? pendingAction.section.terms.find((t) => t.id === pendingAction.termId) : (pendingAction?.section.registeredTerm)} onConfirm={handleConfirmAction} onCancel={() => setPendingAction(null)} /></>
    );
}
