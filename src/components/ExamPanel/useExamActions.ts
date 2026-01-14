import { useState } from 'react';
import { toast } from 'sonner';
import { fetchExamData, registerExam, unregisterExam } from '../../api/exams';
import type { ExamSubject, ExamSection } from '../../types/exams';

interface UseExamActionsProps {
    setExams: (exams: ExamSubject[]) => void;
    setExpandedSectionId: (id: string | null) => void;
}

export function useExamActions({ setExams, setExpandedSectionId }: UseExamActionsProps) {
    const [processingSectionId, setProcessingSectionId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<{
        type: 'register' | 'unregister';
        section: ExamSection;
        termId?: string;
    } | null>(null);

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
            if (section.status === 'registered' && section.registeredTerm?.id) {
                const unregResult = await unregisterExam(section.registeredTerm.id);
                if (!unregResult.success) {
                    toast.error(unregResult.error || 'Nepodařilo se odhlásit z předchozího termínu.');
                    setProcessingSectionId(null);
                    return;
                }
            }

            const regResult = await registerExam(termId);
            if (regResult.success) {
                toast.success('Úspěšně přihlášeno na termín!');
                const data = await fetchExamData();
                setExams(data);
                setExpandedSectionId(null);
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
                const data = await fetchExamData();
                setExams(data);
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
            handleRegister(pendingAction.section, pendingAction.termId);
        } else if (pendingAction.type === 'unregister') {
            handleUnregister(pendingAction.section);
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
