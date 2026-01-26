import { useState } from 'react';
import { toast } from 'sonner';
import { registerExam, unregisterExam } from '../../api/exams';
import { IndexedDBService } from '../../services/storage';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject, ExamSection } from '../../types/exams';

interface UseExamActionsProps {
    exams: ExamSubject[]; // Current exam state from store
    setExpandedSectionId: (id: string | null) => void;
}

/**
 * Update exam data optimistically without refetching from server.
 */
function updateExamOptimistically(
    currentExams: ExamSubject[],
    sectionId: string,
    update: Partial<ExamSection>
): ExamSubject[] {
    return currentExams.map(subject => ({
        ...subject,
        sections: subject.sections.map(section =>
            section.id === sectionId
                ? { ...section, ...update }
                : section
        )
    }));
}

export function useExamActions({ exams, setExpandedSectionId }: UseExamActionsProps) {
    const [processingSectionId, setProcessingSectionId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<{
        type: 'register' | 'unregister';
        section: ExamSection;
        termId?: string;
    } | null>(null);

    const setExams = useAppStore(state => state.setExams);
    const fetchExams = useAppStore(state => state.fetchExams);

    const handleRegisterRequest = (section: ExamSection, termId: string) => {
        setPendingAction({ type: 'register', section, termId });
    };

    const handleUnregisterRequest = (section: ExamSection) => {
        setPendingAction({ type: 'unregister', section });
    };

    const handleRegister = async (section: ExamSection, termId: string) => {
        setProcessingSectionId(section.id);
        setPendingAction(null);

        try {
            // Step 1: Unregister from previous term if needed
            if (section.status === 'registered' && section.registeredTerm?.id) {
                const unregResult = await unregisterExam(section.registeredTerm.id);
                if (!unregResult.success) {
                    toast.error(unregResult.error || 'Nepodařilo se odhlásit z předchozího termínu.');
                    setProcessingSectionId(null);
                    return;
                }
            }

            // Step 2: Register for new term
            const regResult = await registerExam(termId);
            
            if (regResult.success) {
                toast.success('Úspěšně přihlášeno na termín!');
                
                // Step 3: OPTIMISTIC UPDATE
                const selectedTerm = section.terms.find(t => t.id === termId);
                const updatedExams = updateExamOptimistically(
                    exams,
                    section.id,
                    {
                        status: 'registered',
                        registeredTerm: selectedTerm ? {
                            id: selectedTerm.id,
                            date: selectedTerm.date,
                            time: selectedTerm.time,
                            room: selectedTerm.room,
                            teacher: selectedTerm.teacher,
                            teacherId: selectedTerm.teacherId,
                            deregistrationDeadline: selectedTerm.registrationEnd
                        } : undefined
                    }
                );
                
                // Step 4: Update store immediately
                setExams(updatedExams);
                
                // Step 5: Persist to Storage
                IndexedDBService.set('exams', 'current', updatedExams)
                  .catch(err => console.error('[useExamActions] Failed to persist optimistic update:', err));
                
                // Step 6: Update last modified timestamp
                IndexedDBService.set('meta', 'exams_modified', Date.now());
                
                setExpandedSectionId(null);
                
                // Optional: trigger background fetch to ensure consistency
                void fetchExams();
            } else {
                toast.error(regResult.error || 'Registrace selhala.');
            }
        } catch {
            toast.error('Nastala neočekávaná chyba.');
        } finally {
            setProcessingSectionId(null);
        }
    };

    const handleUnregister = async (section: ExamSection) => {
        if (!section.registeredTerm?.id) {
            toast.error('Chybí ID termínu.');
            return;
        }

        setProcessingSectionId(section.id);
        setPendingAction(null);

        try {
            const result = await unregisterExam(section.registeredTerm.id);
            
            if (result.success) {
                toast.success('Úspěšně odhlášeno z termínu.');
                
                // OPTIMISTIC UPDATE
                const updatedExams = updateExamOptimistically(
                    exams,
                    section.id,
                    {
                        status: 'available',
                        registeredTerm: undefined
                    }
                );
                
                setExams(updatedExams);
                IndexedDBService.set('exams', 'current', updatedExams)
                  .catch(err => console.error('[useExamActions] Failed to persist unregister update:', err));
                IndexedDBService.set('meta', 'exams_modified', Date.now());
                
                void fetchExams();
            } else {
                toast.error(result.error || 'Odhlášení selhalo.');
            }
        } catch {
            toast.error('Nastala neočekávaná chyba.');
        } finally {
            setProcessingSectionId(null);
        }
    };

    const handleConfirmAction = () => {
        if (!pendingAction) return;
        
        if (pendingAction.type === 'register' && pendingAction.termId) {
            void handleRegister(pendingAction.section, pendingAction.termId);
        } else if (pendingAction.type === 'unregister') {
            void handleUnregister(pendingAction.section);
        }
    };

    return {
        processingSectionId,
        pendingAction,
        setPendingAction,
        handleRegisterRequest,
        handleUnregisterRequest,
        handleConfirmAction,
    };
}
