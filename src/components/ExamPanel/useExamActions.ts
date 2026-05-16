import { useState } from 'react';
import { toast } from 'sonner';
import { registerExam, unregisterExam } from '../../api/exams';
import { useAppStore } from '../../store/useAppStore';
import { updateExamOptimistically } from './actions/optimisticUpdates';
import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';
import { logError } from '../../utils/reportError';
import { useTranslation } from '../../hooks/useTranslation';

interface PendingAction {
    type: 'register' | 'unregister';
    section: ExamSection;
    termId?: string;
}

export function useExamActions({ exams, setExpandedSectionId }: { exams: ExamSubject[]; setExpandedSectionId: (id: string | null) => void }) {
    const { t: tr } = useTranslation();
    const [procId, setProcId] = useState<string | null>(null), [pending, setPending] = useState<PendingAction | null>(null);
    const setExams = useAppStore(s => s.setExams), fetchExams = useAppStore(s => s.fetchExams);

    const handleRegister = async (sec: ExamSection, tid: string) => {
        setProcId(sec.id); setPending(null);
        try {
            const previousTermId = sec.status === 'registered' ? sec.registeredTerm?.id : undefined;
            if (previousTermId) {
                if (!(await unregisterExam(previousTermId)).success) { toast.error(tr('exams.actionUnregisterFailed')); setProcId(null); return; }
            }
            const res = await registerExam(tid);
            if (res.success) {
                toast.success(tr('exams.actionRegistered'));
                const t = sec.terms.find((x: ExamTerm) => x.id === tid), updated = updateExamOptimistically(exams, sec.id, { status: 'registered', registeredTerm: t ? { id: t.id, date: t.date, time: t.time, room: t.room, teacher: t.teacher, teacherId: t.teacherId, deregistrationDeadline: t.deregistrationDeadline } : undefined });
                setExams(updated);
                setExpandedSectionId(null); void fetchExams();
                return;
            }
            // Registration failed. If we unregistered first, attempt best-effort rollback.
            if (previousTermId) {
                const rollback = await registerExam(previousTermId);
                if (rollback.success) {
                    toast.error(tr('exams.actionSwitchFailedRolledBack'));
                } else {
                    logError('useExamActions.handleRegister.rollbackFailed', new Error(`restore failed for ${previousTermId} after register ${tid} failed: regErr=${res.error}; rollbackErr=${rollback.error}`));
                    toast.error(tr('exams.actionSwitchFailedNoRollback'));
                }
                void fetchExams();
            } else {
                toast.error(res.error || tr('exams.actionFailed'));
            }
        } catch (e) { logError('useExamActions.handleRegister', e); toast.error(tr('exams.actionGenericError')); } finally { setProcId(null); }
    };

    const handleUnregister = async (sec: ExamSection) => {
        if (!sec.registeredTerm?.id) return toast.error(tr('exams.actionMissingId'));
        setProcId(sec.id); setPending(null);
        try {
            const res = await unregisterExam(sec.registeredTerm.id);
            if (res.success) {
                toast.success(tr('exams.actionUnregistered'));
                const updated = updateExamOptimistically(exams, sec.id, { status: 'available', registeredTerm: undefined });
                setExams(updated);
                void fetchExams();
            } else toast.error(res.error || tr('exams.actionFailed'));
        } catch (e) { logError('useExamActions.handleUnregister', e); toast.error(tr('exams.actionGenericError')); } finally { setProcId(null); }
    };

    return { processingSectionId: procId, pendingAction: pending, setPendingAction: setPending, handleRegisterRequest: (s: ExamSection, t: string) => setPending({ type: 'register', section: s, termId: t }), handleUnregisterRequest: (s: ExamSection) => setPending({ type: 'unregister', section: s }), handleConfirmAction: () => { if (!pending) return; if (pending.type === 'register' && pending.termId) handleRegister(pending.section, pending.termId); else if (pending.type === 'unregister') handleUnregister(pending.section); }, handleRegisterDirect: handleRegister };
}
