import { useState, useEffect, useMemo } from 'react';
import { ExamFilterBar } from './ExamFilterBar';
import { ExamSectionCard } from './ExamSectionCard';
import { ConfirmationModal } from './ConfirmationModal';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { useExamActions } from './useExamActions';
import { ExamPanelHeader } from './ExamPanelHeader';
import { useExamsData } from './useExamsData';
import ExamTimeline from '../Exams/Timeline/ExamTimeline';
import type { TimelineExam } from '../Exams/Timeline/ExamTimeline';
import { useTranslation } from '../../hooks/useTranslation';

interface RegisteredExam {
    subjectName: string;
    subject: ExamSubject;
    section: ExamSection;
    term: { id: string; date: string; time: string; room: string; };
}

export function ExamPanel({ onSelectSubject }: { onSelectSubject: (subject: ExamSubject & { courseCode: string; courseName: string; sectionName: string; isExam: true }) => void }) {
    const { t, language } = useTranslation();
    const { 
        exams, 
        isLoading, 
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

    return (
        <><div className="flex flex-col h-full bg-base-100 rounded-lg border border-base-300 overflow-hidden">
            <ExamPanelHeader />
            
            {/* Horizontal Timeline Integration */}
            {realExams.length > 0 && (
                <div className="px-4 pb-0 border-b border-base-200">
                    <ExamTimeline 
                        exams={realExams as unknown as TimelineExam[]} 
                        orientation="horizontal" 
                        onSelectItem={(item) => {
                            const registeredItem = item as unknown as RegisteredExam;
                            const subName = (language === 'en' && registeredItem.subject.nameEn) ? registeredItem.subject.nameEn : (registeredItem.subject.nameCs || registeredItem.subject.name);
                            const secName = (language === 'en' && registeredItem.section.nameEn) ? registeredItem.section.nameEn : (registeredItem.section.nameCs || registeredItem.section.name);
                            onSelectSubject({ 
                                ...registeredItem.subject, 
                                courseCode: registeredItem.subject.code, 
                                courseName: subName, 
                                sectionName: secName, 
                                isExam: true 
                            });
                        }} 
                    />
                </div>
            )}

            <ExamFilterBar 
                statusFilter={statusFilter} 
                selectedSubjects={selectedSubjects} 
                filterCounts={filterCounts} 
                subjectOptions={subjectOptions} 
                onToggleStatus={onToggleStatus} 
                onToggleSubject={(c: string) => setSelectedSubjects((p: string[]) => p.includes(c) ? p.filter((x: string) => x !== c) : [...p, c])} 
                onClearFilters={clearAllFilters} 
            />
            <div className="flex-1 overflow-y-auto p-4 space-y-3">{isLoading ? <div className="flex items-center justify-center h-32 opacity-50"><span className="loading loading-spinner mr-2" /> {t('exams.loading')}</div> : !filteredSubjects.length ? <div className="flex flex-col items-center justify-center h-32 opacity-50"><span>{t('exams.empty')}</span></div>
                : filteredSubjects.map(({ subject, section }: { subject: ExamSubject, section: ExamSection }) => <ExamSectionCard key={section.id} subject={subject} section={section} isExpanded={expandedId === section.id} isProcessing={processingSectionId === section.id} onToggleExpand={(id: string) => setExpandedId(p => p === id ? null : id)} onRegister={handleRegisterRequest} onUnregister={handleUnregisterRequest} onSelectSubject={onSelectSubject} />)}</div>
        </div>
        <ConfirmationModal isOpen={!!pendingAction} actionType={pendingAction?.type ?? 'register'} sectionName={pendingAction?.section.name ?? ''} termInfo={pendingAction?.type === 'register' ? pendingAction.section.terms.find((t) => t.id === pendingAction.termId) : (pendingAction?.section.registeredTerm)} onConfirm={handleConfirmAction} onCancel={() => setPendingAction(null)} /></>
    );
}
