import { useState, useEffect, useRef, useCallback } from 'react';
import { registerExam, unregisterExam } from '../api/exams';
import { useExams } from '../hooks/data';
import { useAppStore } from '../store/useAppStore';
import type { ExamSection, ExamTerm } from '../types/exams';

export function useExamDrawerLogic(isOpen: boolean, onClose: () => void) {
    const { exams, isLoaded, error } = useExams();
    const fetchExams = useAppStore(state => state.fetchExams);
    const [expandedSubjectId, setExpandedSubjectId] = useState("");
    const [popupSection, setPopupSection] = useState<ExamSection | null>(null);
    const [popupAnchor, setPopupAnchor] = useState<HTMLButtonElement | null>(null);
    const popupAnchorRef = useRef<HTMLButtonElement | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [autoBookingId, setAutoBookingId] = useState<string | null>(null);

    useEffect(() => { popupAnchorRef.current = popupAnchor; }, [popupAnchor]);

    const handleRegister = useCallback(async (sec: ExamSection, termId: string) => {
        setProcessingId(sec.id);
        try {
            if (sec.status === 'registered' && sec.registeredTerm?.id) {
                if (!(await unregisterExam(sec.registeredTerm.id))) { alert("Unreg failed"); return; }
            }
            if (await registerExam(termId)) { await fetchExams(); setPopupSection(null); }
            else alert("Reg failed");
        } catch (e) { console.error(e); } finally { setProcessingId(null); }
    }, [fetchExams]);

    useEffect(() => {
        if (!autoBookingId || !isOpen) return;
        const id = setInterval(() => {
            let t: ExamTerm | undefined, s: ExamSection | undefined;
            for (const sub of exams) { for (const sec of sub.sections) { t = sec.terms.find(x => x.id === autoBookingId); if (t) { s = sec; break; } }; if (t) break; }
            if (t && s && t.registrationStart) {
                const parse = (str: string) => { const [d, ti] = str.split(' '), [day, m, y] = d.split('.').map(Number), [h, min] = ti.split(':').map(Number); return new Date(y, m - 1, day, h, min); };
                if (new Date() >= parse(t.registrationStart)) { handleRegister(s, t.id); setAutoBookingId(null); }
            } else setAutoBookingId(null);
        }, 1000);
        return () => clearInterval(id);
    }, [autoBookingId, exams, isOpen, handleRegister]);

    return { exams, isLoading: !isLoaded && !exams.length, error, expandedSubjectId, setExpandedSubjectId, popupSection, setPopupSection, popupAnchorRef, setPopupAnchor, processingId, autoBookingId, handleRegister };
}
