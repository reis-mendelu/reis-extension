import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchServerTimeOffset, getSynchronizedServerTime } from '../../utils/serverTime';
import { parseRegistrationStart } from '../../utils/termUtils';
import type { ExamSection, ExamTerm } from '../../types/exams';
import { registerExam } from '../../api/exams';
import { useAppStore } from '../../store/useAppStore';
import { IndexedDBService } from '../../services/storage';
import { updateExamOptimistically } from './actions/optimisticUpdates';

interface ArmedTerm {
    termId: string;
    section: ExamSection;
    regStart: Date;
}

export function useAutoRegistration() {
    const [armedTerms, setArmedTerms] = useState<Map<string, ArmedTerm>>(new Map());
    const [firingTerms, setFiringTerms] = useState<Set<string>>(new Set());
    
    // Store handlers
    const exams = useAppStore(s => s.exams.data);
    const setExams = useAppStore(s => s.setExams);
    const fetchExams = useAppStore(s => s.fetchExams);

    // Use refs for intervals to avoid dependency loops in useEffect
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const firingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

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
            clearInterval(firingRefs.current.get(termId)!);
            firingRefs.current.delete(termId);
        }
    }, []);

    const performRegisterHit = useCallback(async (section: ExamSection, termId: string) => {
        try {
            const res = await registerExam(termId);
            if (res.success) {
                // Success! Stop the battering ram.
                disarm(termId);
                toast.success('Auto-rezervace úspěšná! Jsi přihlášen.');
                
                // Optimistic UI update
                const t = section.terms.find((x: ExamTerm) => x.id === termId);
                const updated = updateExamOptimistically(exams, section.id, { 
                    status: 'registered', 
                    registeredTerm: t ? { id: t.id, date: t.date, time: t.time, room: t.room, teacher: t.teacher, teacherId: t.teacherId, deregistrationDeadline: t.deregistrationDeadline } : undefined 
                });
                setExams(updated); 
                IndexedDBService.set('exams', 'current', updated); 
                IndexedDBService.set('meta', 'exams_modified', Date.now());
                void fetchExams();
                return true;
            } else if (res.error === 'Termín je již plný.') {
                // Fatal error, no point in retrying
                disarm(termId);
                toast.error('Termín se zaplnil. Auto-rezervace byla ukončena.');
                return true; // We want to stop
            }
            // Other errors (like 'nelze přihlásit' which might just mean the server hasn't opened it yet)
            // we ignore and keep firing.
            return false;
        } catch (e) {
            return false;
        }
    }, [exams, setExams, fetchExams, disarm]);

    const fireBatteringRam = useCallback((termId: string, section: ExamSection) => {
        if (firingRefs.current.has(termId)) return;
        
        console.log(`[AutoReg] 🚀 Unleashing battering ram for ${termId}...`);
        setFiringTerms(prev => {
            const next = new Set(prev);
            next.add(termId);
            return next;
        });

        // Fire once immediately
        void performRegisterHit(section, termId);

        // Then fire every 350ms
        const intervalId = setInterval(async () => {
            if (!armedTerms.has(termId)) {
                clearInterval(intervalId);
                firingRefs.current.delete(termId);
                return;
            }
            console.log(`[AutoReg] 💥 Spamming ${termId}...`);
            const shouldStop = await performRegisterHit(section, termId);
            if (shouldStop) {
                clearInterval(intervalId);
                firingRefs.current.delete(termId);
            }
        }, 350);

        firingRefs.current.set(termId, intervalId);

        // Fallback: stop firing after 10 seconds
        setTimeout(() => {
            if (firingRefs.current.has(termId)) {
                console.warn(`[AutoReg] 🛑 Forced stop on battering ram for ${termId} after 10s.`);
                disarm(termId);
                toast.error('Auto-rezervace vypršela po 10 vteřinách bez úspěchu.');
            }
        }, 10000);
    }, [performRegisterHit, armedTerms, disarm]);

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
            toast.error("Tento termín nemá začátek přihlašování.");
            return;
        }
        const regStart = parseRegistrationStart(term.registrationStart);
        if (!regStart) return;

        setArmedTerms(prev => {
            const map = new Map(prev);
            map.set(term.id, { termId: term.id, section, regStart });
            return map;
        });
        toast.info(`Auto-rezervace aktivována pro termín v ${term.time}. Nezavírejte okno!`);
    }, []);

    const toggleArm = useCallback((term: ExamTerm, section: ExamSection) => {
        if (armedTerms.has(term.id)) disarm(term.id);
        else arm(term, section);
    }, [armedTerms, arm, disarm]);

    return { armedTerms, firingTerms, toggleArm };
}
