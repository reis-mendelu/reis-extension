import { useState, useEffect, useCallback } from 'react';
import { parseCzechDate, getCountdown } from './useAutoBooking/utils';
import type { ExamTerm } from '../../types/exams';

interface AutoBookingProps {
    terms: ExamTerm[];
    findTerm?: (id: string, terms: ExamTerm[]) => ExamTerm | undefined;
    onRegister: (id: string) => Promise<void>;
    onBookingTriggered?: (id: string) => void;
    onError?: (e: Error) => void;
}

export function useAutoBooking({ terms, findTerm, onRegister, onBookingTriggered, onError }: AutoBookingProps) {
    const [id, setId] = useState<string | null>(null), [now, setNow] = useState(new Date());
    useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

    const start = useCallback((tid: string) => setId(tid), []), cancel = useCallback(() => setId(null), []);

    useEffect(() => {
        if (!id) return;
        const i = setInterval(async () => {
            const t = findTerm ? findTerm(id, terms) : terms.find(x => x.id === id);
            if (!t?.registrationStart) { setId(null); return; }
            if (new Date() >= parseCzechDate(t.registrationStart)) {
                try { onBookingTriggered?.(id); await onRegister(id); }
                catch (e) { onError?.(e as Error); } finally { setId(null); }
            }
        }, 1000);
        return () => clearInterval(i);
    }, [id, terms, findTerm, onRegister, onBookingTriggered, onError]);

    return { autoBookingTermId: id, startAutoBooking: start, cancelAutoBooking: cancel, isAutoBooking: (tid: string) => id === tid, getCountdown: (s: string | undefined) => getCountdown(s, now), parseDate: parseCzechDate };
}
