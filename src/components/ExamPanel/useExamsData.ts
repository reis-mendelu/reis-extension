import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Status } from '../../store/types';
import type { ExamSubject, ExamSection } from '../../types/exams';

/**
 * Decide whether the exams panel shows its loading skeleton (vs. the
 * "nothing to display" empty state). Pure so it can be unit-tested without a
 * store. The `examsRefreshing` term is what keeps the skeleton up while a
 * panel-triggered refresh is in flight: on open the panel mounts and fires its
 * own refresh after the background sync has already settled (status 'success',
 * handshake done, not syncing), so without it an empty cache would flash the
 * empty state before the freshly-fetched exams arrive.
 */
export function shouldShowExamsSkeleton(opts: {
    examsCount: number;
    status: Status;
    handshakeDone: boolean;
    handshakeTimedOut: boolean;
    isSyncing: boolean;
    examsRefreshing: boolean;
}): boolean {
    return opts.examsCount === 0 && (
        opts.status === 'loading' || opts.status === 'idle' ||
        (!opts.handshakeDone && !opts.handshakeTimedOut) || opts.isSyncing || opts.examsRefreshing
    );
}

export function useExamsData() {
    const exams = useAppStore(s => s.exams.data);
    const status = useAppStore(s => s.exams.status);
    const handshakeDone = useAppStore(s => s.syncStatus.handshakeDone);
    const handshakeTimedOut = useAppStore(s => s.syncStatus.handshakeTimedOut);
    const isSyncing = useAppStore(s => s.syncStatus.isSyncing);
    const examsRefreshing = useAppStore(s => s.examsRefreshing);

    const sections = useMemo(() => {
        const res: { subject: ExamSubject; section: ExamSection }[] = [];
        exams.forEach((sub: ExamSubject) => {
            sub.sections.forEach((sec: ExamSection) => {
                if (sec.status !== 'registered') res.push({ subject: sub, section: sec });
            });
        });
        return res;
    }, [exams]);

    const showSkeleton = shouldShowExamsSkeleton({
        examsCount: exams.length,
        status,
        handshakeDone: !!handshakeDone,
        handshakeTimedOut: !!handshakeTimedOut,
        isSyncing,
        examsRefreshing,
    });

    return { exams, showSkeleton, sections };
}
