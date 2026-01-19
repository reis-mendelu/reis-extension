import { useState, useEffect, useMemo } from 'react';
import { useExams } from '../../hooks/data';
import { StorageService } from '../../services/storage';
import type { ExamSubject, ExamSection, ExamFilterState } from '../../types/exams';

import { ExamFilterBar, type StatusFilter } from './ExamFilterBar';
import { ExamSectionCard } from './ExamSectionCard';
import { ConfirmationModal } from './ConfirmationModal';
import { useExamActions } from './useExamActions';

import { ExamPanelHeader } from './ExamPanelHeader';

interface ExamPanelProps {
    onSelectSubject: (subj: { code: string; name: string; courseCode?: string; courseName?: string; isExam?: boolean; sectionName?: string; date?: string; time?: string; room?: string }) => void;
}

const FILTER_STORAGE_KEY = 'exam_panel_filters';

export function ExamPanel({ onSelectSubject }: ExamPanelProps) {
    const { exams: storedExams, isLoaded } = useExams();

    // Local state
    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Sync stored exams to local state
    useEffect(() => {
        if (storedExams && storedExams.length > 0) {
            queueMicrotask(() => {
                setExams(storedExams);
                setIsLoading(false);
            });
        } else if (isLoaded) {
            queueMicrotask(() => setIsLoading(false));
        }
    }, [storedExams, isLoaded]);

    // UI state
    const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

    // Extract action logic to hook
    const {
        processingSectionId,
        pendingAction,
        setPendingAction,
        handleRegisterRequest,
        handleUnregisterRequest,
        handleConfirmAction,
    } = useExamActions({ exams, setExams, setExpandedSectionId });

    // Filter state with localStorage persistence
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
        const stored = StorageService.get<ExamFilterState>(FILTER_STORAGE_KEY);
        return (stored?.statusFilter as StatusFilter) ?? 'available';
    });
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() => {
        const stored = StorageService.get<ExamFilterState>(FILTER_STORAGE_KEY);
        return stored?.selectedSubjects ?? [];
    });

    // Persist filter state
    useEffect(() => {
        StorageService.set(FILTER_STORAGE_KEY, { statusFilter, selectedSubjects });
    }, [statusFilter, selectedSubjects]);

    // Escape key handler
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Ignore if any dialog/modal is open (e.g. SubjectFileDrawer, ConfirmationModal)
                if (document.querySelector('[role="dialog"]')) return;

                if (expandedSectionId) {
                    setExpandedSectionId(null);
                } 
                // Do NOT close the panel (navigate home) on Escape
                // The user wants to stay in the Exam View
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [expandedSectionId]);

    // Computed values
    const filterCounts = useMemo(() => {
        const counts = { registered: 0, available: 0, opening: 0 };

        exams.forEach(subject => {
            subject.sections.forEach(section => {
                if (section.status === 'registered') {
                    counts.registered++;
                } else {
                    const hasAvailable = section.terms.some(term =>
                        !term.full && term.canRegisterNow === true
                    );
                    const hasOpeningSoon = section.terms.some(term =>
                        !term.full && term.canRegisterNow !== true
                    );

                    if (hasAvailable) counts.available++;
                    if (hasOpeningSoon) counts.opening++;
                }
            });
        });

        return counts;
    }, [exams]);

    const subjectOptions = useMemo(() =>
        exams.map(e => ({ code: e.code, name: e.name }))
            .filter((v, i, a) => a.findIndex(t => t.code === v.code) === i)
            .sort((a, b) => a.name.localeCompare(b.name)),
        [exams]);

    const filteredSections = useMemo(() => {
        const results: Array<{ subject: ExamSubject; section: ExamSection }> = [];

        exams.forEach(subject => {
            if (selectedSubjects.length > 0 && !selectedSubjects.includes(subject.code)) return;

            subject.sections.forEach(section => {
                if (statusFilter === 'registered') {
                    if (section.status !== 'registered') return;
                    results.push({ subject, section });
                } else if (statusFilter === 'available') {
                    if (section.status === 'registered') return;
                    const availableTerms = section.terms.filter(term =>
                        !term.full && term.canRegisterNow === true
                    );
                    if (availableTerms.length === 0) return;
                    results.push({ subject, section: { ...section, terms: availableTerms } });
                } else if (statusFilter === 'opening') {
                    if (section.status === 'registered') return;
                    const openingTerms = section.terms.filter(term =>
                        !term.full && term.canRegisterNow !== true
                    );
                    if (openingTerms.length === 0) return;
                    results.push({ subject, section: { ...section, terms: openingTerms } });
                } else {
                    results.push({ subject, section });
                }
            });
        });

        return results;
    }, [exams, statusFilter, selectedSubjects]);

    const toggleExpand = (sectionId: string) => {
        setExpandedSectionId(prev => prev === sectionId ? null : sectionId);
    };

    const toggleSubjectFilter = (code: string) => {
        setSelectedSubjects(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    return (
        <>
            <div className="flex flex-col h-full bg-base-100 rounded-lg border border-base-300 overflow-hidden">
                <ExamPanelHeader />

                <ExamFilterBar
                    statusFilter={statusFilter}
                    selectedSubjects={selectedSubjects}
                    filterCounts={filterCounts}
                    subjectOptions={subjectOptions}
                    onStatusChange={setStatusFilter}
                    onToggleSubject={toggleSubjectFilter}
                    onClearFilters={() => setSelectedSubjects([])}
                />

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32 text-base-content/50">
                            <span className="loading loading-spinner loading-md mr-2"></span>
                            Načítání zkoušek...
                        </div>
                    ) : filteredSections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-base-content/50">
                            <span className="text-4xl mb-2">📭</span>
                            <span>Žádné zkoušky pro vybrané filtry</span>
                        </div>
                    ) : (
                        filteredSections.map(({ subject, section }) => (
                            <ExamSectionCard
                                key={section.id}
                                subject={subject}
                                section={section}
                                isExpanded={expandedSectionId === section.id}
                                isProcessing={processingSectionId === section.id}
                                onToggleExpand={toggleExpand}
                                onRegister={handleRegisterRequest}
                                onUnregister={handleUnregisterRequest}
                                onSelectSubject={onSelectSubject}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!pendingAction}
                actionType={pendingAction?.type ?? 'register'}
                sectionName={pendingAction?.section.name ?? ''}
                termInfo={pendingAction?.type === 'register' 
                    ? pendingAction.section.terms.find(t => t.id === pendingAction.termId)
                    : pendingAction?.section.registeredTerm}
                onConfirm={handleConfirmAction}
                onCancel={() => setPendingAction(null)}
            />
        </>
    );
}
