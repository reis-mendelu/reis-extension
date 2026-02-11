import { useState } from 'react';
import { toast } from 'sonner';
import { registerExam, unregisterExam } from '../../api/exams';
import { IndexedDBService } from '../../services/storage';
import { useAppStore } from '../../store/useAppStore';
import { updateExamOptimistically } from './actions/optimisticUpdates';
import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';

interface PendingAction {
    type: 'register' | 'unregister';
    section: ExamSection;
    termId?: string;
}

export function useExamActions({ exams, setExpandedSectionId }: { exams: ExamSubject[]; setExpandedSectionId: (id: string | null) => void }) {
    const [procId, setProcId] = useState<string | null>(null), [pending, setPending] = useState<PendingAction | null>(null);
    const setExams = useAppStore(s => s.setExams), fetchExams = useAppStore(s => s.fetchExams);

    const handleRegister = async (sec: ExamSection, tid: string) => {
        setProcId(sec.id); setPending(null);
        try {
            if (sec.status === 'registered' && sec.registeredTerm?.id) {
                if (!(await unregisterExam(sec.registeredTerm.id)).success) { toast.error('Nepodařilo se odhlásit.'); setProcId(null); return; }
            }
            const res = await registerExam(tid);
            if (res.success) {
                toast.success('Přihlášeno!');
                const t = sec.terms.find((x: ExamTerm) => x.id === tid), updated = updateExamOptimistically(exams, sec.id, { status: 'registered', registeredTerm: t ? { id: t.id, date: t.date, time: t.time, room: t.room, teacher: t.teacher, teacherId: t.teacherId, deregistrationDeadline: t.registrationEnd } : undefined });
                setExams(updated); IndexedDBService.set('exams', 'current', updated); IndexedDBService.set('meta', 'exams_modified', Date.now());
                setExpandedSectionId(null); void fetchExams();
            } else toast.error(res.error || 'Selhalo.');
        } catch { toast.error('Chyba.'); } finally { setProcId(null); }
    };

    const handleUnregister = async (sec: ExamSection) => {
        if (!sec.registeredTerm?.id) return toast.error('Chybí ID.');
        setProcId(sec.id); setPending(null);
        try {
            const res = await unregisterExam(sec.registeredTerm.id);
            if (res.success) {
                toast.success('Odhlášeno!');
                const updated = updateExamOptimistically(exams, sec.id, { status: 'available', registeredTerm: undefined });
                setExams(updated); IndexedDBService.set('exams', 'current', updated); IndexedDBService.set('meta', 'exams_modified', Date.now());
                void fetchExams();
            } else toast.error(res.error || 'Selhalo.');
        } catch { toast.error('Chyba.'); } finally { setProcId(null); }
    };

    return { processingSectionId: procId, pendingAction: pending, setPendingAction: setPending, handleRegisterRequest: (s: ExamSection, t: string) => setPending({ type: 'register', section: s, termId: t }), handleUnregisterRequest: (s: ExamSection) => setPending({ type: 'unregister', section: s }), handleConfirmAction: () => { if (!pending) return; if (pending.type === 'register' && pending.termId) handleRegister(pending.section, pending.termId); else if (pending.type === 'unregister') handleUnregister(pending.section); } };
}
