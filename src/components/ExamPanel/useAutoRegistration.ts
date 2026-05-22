import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchServerTimeOffset, getSynchronizedServerTime } from '../../utils/serverTime';
import { parseRegistrationStart } from '../../utils/termUtils';
import type { ExamSection, ExamTerm } from '../../types/exams';
import { registerExam } from '../../api/exams';
import { useAppStore } from '../../store/useAppStore';
import { updateExamOptimistically } from './actions/optimisticUpdates';
import { logError } from '../../utils/reportError';
import { useTranslation } from '../../hooks/useTranslation';

export interface ArmedTerm {
    termId: string;
    section: ExamSection;
    regStart: Date;
}

export const SNIPER_WINDOW_MS = 60 * 60 * 1000; // 60 minutes window for auto-registration to appear

export function useAutoRegistration() {
    const { t } = useTranslation();
    const tRef = useRef(t);
    // eslint-disable-next-line react-hooks/refs
    tRef.current = t;
    const [armedTerms, setArmedTerms] = useState<Map<string, ArmedTerm>>(new Map());
    const [firingTerms, setFiringTerms] = useState<Set<string>>(new Set());
    
    // Store handlers — read fresh via getState() inside callbacks to keep deps stable
    const setExams = useAppStore(s => s.setExams);
    const fetchExams = useAppStore(s => s.fetchExams);

    // Use refs for intervals to avoid dependency loops in useEffect
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const firingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const armedTermsRef = useRef<Map<string, ArmedTerm>>(armedTerms);
    // eslint-disable-next-line react-hooks/refs
    armedTermsRef.current = armedTerms;

    useEffect(() => {
        if (armedTerms.size > 0) void fetchServerTimeOffset();
    }, [armedTerms.size]);

    const disarm = useCallback((termId: string) => {
        setArmedTerms(prev => {
            const map = new Map(prev);
            map.delete(termId);
            return map;
        });
        setFiringTerms(prev => {
            const next = new Set(prev);
            next.delete(termId);
            return next;
        });
        if (firingRefs.current.has(termId)) {
            clearTimeout(firingRefs.current.get(termId)!);
            firingRefs.current.delete(termId);
        }
    }, []);

    const performRegisterHit = useCallback(async (section: ExamSection, termId: string) => {
        try {
            const res = await registerExam(termId);
            if (res.success) {
                // Success! Stop the battering ram.
                disarm(termId);
                toast.success(tRef.current('exams.autoRegSuccess'));
                
                // Optimistic UI update — read latest exams from store, not closure
                const t = section.terms.find((x: ExamTerm) => x.id === termId);
                const currentExams = useAppStore.getState().exams.data;
                const updated = updateExamOptimistically(currentExams, section.id, {
                    status: 'registered',
                    registeredTerm: t ? { id: t.id, date: t.date, time: t.time, room: t.room, teacher: t.teacher, teacherId: t.teacherId, deregistrationDeadline: t.deregistrationDeadline } : undefined
                });
                setExams(updated);
                void fetchExams();
                return true;
            } else if (res.error === 'Termín je již plný.') {
                // Fatal error, no point in retrying
                disarm(termId);
                toast.error(tRef.current('exams.autoRegFull'));
                return true; // We want to stop
            }
            // Other errors (like 'nelze přihlásit' which might just mean the server hasn't opened it yet)
            // we ignore and keep firing.
            return false;
        } catch (e) {
            logError('useAutoRegistration.performRegisterHit', e, { termId });
            return false;
        }
    }, [setExams, fetchExams, disarm]);

    const fireBatteringRam = useCallback((termId: string, section: ExamSection) => {
        if (firingRefs.current.has(termId)) return;

        setFiringTerms(prev => {
            const next = new Set(prev);
            next.add(termId);
            return next;
        });

        // Serial fire-on-response loop. Each hit awaits its response before the next is dispatched,
        // which (a) maximizes throughput on fast RTTs without piling up concurrent in-flight requests
        // and (b) naturally backs off when the server is slow. Hard 10s wall-clock cap.
        const start = Date.now();
        const TIMEOUT_MS = 10000;

        const timeoutHandle = setTimeout(() => {
            if (firingRefs.current.get(termId) === timeoutHandle) {
                firingRefs.current.delete(termId);
                disarm(termId);
                toast.error(tRef.current('exams.autoRegExpired'));
            }
        }, TIMEOUT_MS);
        firingRefs.current.set(termId, timeoutHandle);

        (async () => {
            while (
                firingRefs.current.get(termId) === timeoutHandle &&
                armedTermsRef.current.has(termId) &&
                Date.now() - start < TIMEOUT_MS
            ) {
                const shouldStop = await performRegisterHit(section, termId);
                if (shouldStop) break;
            }
            if (firingRefs.current.get(termId) === timeoutHandle) {
                clearTimeout(timeoutHandle);
                firingRefs.current.delete(termId);
            }
        })();
    }, [performRegisterHit, disarm]);

    useEffect(() => {
        if (armedTerms.size === 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        intervalRef.current = setInterval(() => {
            const currentSyncTime = getSynchronizedServerTime();
            
            armedTerms.forEach((armed, termId) => {
                const targetTime = armed.regStart.getTime();
                const msRemaining = targetTime - currentSyncTime;

                if (msRemaining <= 2000 && !firingRefs.current.has(termId)) {
                    fireBatteringRam(termId, armed.section);
                }
            });
        }, 250);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [armedTerms, fireBatteringRam]);

    const arm = useCallback((term: ExamTerm, section: ExamSection) => {
        if (!term.registrationStart) {
            toast.error(tRef.current('exams.autoRegNoStart'));
            return;
        }
        const regStart = parseRegistrationStart(term.registrationStart);
        if (!regStart) return;

        const currentSyncTime = getSynchronizedServerTime();
        if (regStart.getTime() - currentSyncTime > SNIPER_WINDOW_MS) {
            toast.error(tRef.current('exams.autoRegTooEarly'));
            return;
        }

        // Check if another term for the same section is already armed
        const existingSectionTermId = Array.from(armedTerms.entries())
            .find(([, armed]) => armed.section.id === section.id)?.[0];

        if (existingSectionTermId && existingSectionTermId !== term.id) {
            disarm(existingSectionTermId);
        }

        setArmedTerms(prev => {
            const map = new Map(prev);
            map.set(term.id, { termId: term.id, section, regStart });
            return map;
        });
        toast.info(tRef.current('exams.autoRegArmedToast', { time: term.time }));
    }, [armedTerms, disarm]);

    const toggleArm = useCallback((term: ExamTerm, section: ExamSection) => {
        if (armedTerms.has(term.id)) disarm(term.id);
        else arm(term, section);
    }, [armedTerms, arm, disarm]);

    return { armedTerms, firingTerms, toggleArm };
}
