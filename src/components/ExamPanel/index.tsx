import { useState, useEffect } from 'react';
import { ExamFilterBar } from './ExamFilterBar';
import { ExamSectionCard } from './ExamSectionCard';
import { ConfirmationModal } from './ConfirmationModal';
import { useExamActions } from './useExamActions';
import { ExamPanelHeader } from './ExamPanelHeader';
import { useExamsData } from './useExamsData';

export function ExamPanel({ onSelectSubject }: any) {
    const { exams, isLoading, statusFilter, setStatusFilter, selectedSubjects, setSelectedSubjects, filterCounts, filteredSubjects, subjectOptions } = useExamsData();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { processingSectionId, pendingAction, setPendingAction, handleRegisterRequest, handleUnregisterRequest, handleConfirmAction } = useExamActions({ exams, setExpandedSectionId: setExpandedId });

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"]') && expandedId) setExpandedId(null); };
        document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
    }, [expandedId]);

    return (
        <><div className="flex flex-col h-full bg-base-100 rounded-lg border border-base-300 overflow-hidden">
            <ExamPanelHeader /><ExamFilterBar statusFilter={statusFilter} selectedSubjects={selectedSubjects} filterCounts={filterCounts} subjectOptions={subjectOptions} onStatusChange={setStatusFilter} onToggleSubject={(c: string) => setSelectedSubjects((p: any) => p.includes(c) ? p.filter((x: any) => x !== c) : [...p, c])} onClearFilters={() => setSelectedSubjects([])} />
            <div className="flex-1 overflow-y-auto p-4 space-y-3">{isLoading ? <div className="flex items-center justify-center h-32 opacity-50"><span className="loading loading-spinner mr-2" /> Načítání zkoušek...</div> : !filteredSubjects.length ? <div className="flex flex-col items-center justify-center h-32 opacity-50"><span>📭 Žádné zkoušky</span></div>
                : filteredSubjects.map(({ subject, section }) => <ExamSectionCard key={section.id} subject={subject} section={section} isExpanded={expandedId === section.id} isProcessing={processingSectionId === section.id} onToggleExpand={(id: any) => setExpandedId(p => p === id ? null : id)} onRegister={handleRegisterRequest} onUnregister={handleUnregisterRequest} onSelectSubject={onSelectSubject} />)}</div>
        </div>
        <ConfirmationModal isOpen={!!pendingAction} actionType={pendingAction?.type ?? 'register'} sectionName={pendingAction?.section.name ?? ''} termInfo={pendingAction?.type === 'register' ? pendingAction.section.terms.find((t: any) => t.id === pendingAction.termId) : pendingAction?.section.registeredTerm} onConfirm={handleConfirmAction} onCancel={() => setPendingAction(null)} /></>
    );
}
