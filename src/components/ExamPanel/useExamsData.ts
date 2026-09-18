import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { isGroupSignupSection } from '../../utils/exams/isGroupSignup';

export function useExamsData() {
    const exams = useAppStore(s => s.exams.data);
    const status = useAppStore(s => s.exams.status);
    const handshakeDone = useAppStore(s => s.syncStatus.handshakeDone);
    const handshakeTimedOut = useAppStore(s => s.syncStatus.handshakeTimedOut);
    const isSyncing = useAppStore(s => s.syncStatus.isSyncing);

    const sections = useMemo(() => {
        const res: { subject: ExamSubject; section: ExamSection }[] = [];
        exams.forEach((sub: ExamSubject) => {
            sub.sections.forEach((sec: ExamSection) => {
                // Seminar-group signup rides in on the same IS table as exam
                // terms but is not an exam — see utils/exams/isGroupSignup.
                if (isGroupSignupSection(sec)) return;
                if (sec.status !== 'registered') res.push({ subject: sub, section: sec });
            });
        });
        return res;
    }, [exams]);

    const showSkeleton = exams.length === 0 && (
        status === 'loading' || status === 'idle' ||
        (!handshakeDone && !handshakeTimedOut) || isSyncing
    );

    return { exams, showSkeleton, sections };
}
