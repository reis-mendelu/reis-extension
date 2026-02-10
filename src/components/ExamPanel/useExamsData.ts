import { useState, useEffect, useMemo, useCallback } from 'react';
import { IndexedDBService } from '../../services/storage';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';

const STORAGE_KEY = 'exam_panel_filters';

export function useExamsData() {
    const storeExams = useAppStore(s => s.exams.data);
    const status = useAppStore(s => s.exams.status);
    const language = useAppStore(s => s.language);
    
    const exams = useMemo(() => {
        return storeExams;
    }, [storeExams]);
    const [statusFilter, setStatusFilter] = useState<any[]>(['available']), [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    
    useEffect(() => { 
        IndexedDBService.get('meta', STORAGE_KEY).then((s: any) => { 
            if (s?.statusFilter) setStatusFilter(Array.isArray(s.statusFilter) ? s.statusFilter : [s.statusFilter]); 
            if (s?.selectedSubjects) setSelectedSubjects(s.selectedSubjects); 
        }); 
    }, []);
    
    useEffect(() => { IndexedDBService.set('meta', STORAGE_KEY, { statusFilter, selectedSubjects }); }, [statusFilter, selectedSubjects]);

    const onToggleStatus = useCallback((status: any) => {
        setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
    }, []);

    const clearAllFilters = useCallback(() => {
        setStatusFilter([]);
        setSelectedSubjects([]);
    }, []);

    const filterCounts = useMemo(() => {
        const c = { registered: 0, available: 0, opening: 0 };
        exams.forEach((sub: ExamSubject) => sub.sections.forEach((sec: ExamSection) => {
            if (sec.status === 'registered') c.registered++;
            else {
                if (sec.terms.some((t: ExamTerm) => !t.full && t.canRegisterNow === true)) c.available++;
                if (sec.terms.some((t: ExamTerm) => !t.full && t.canRegisterNow !== true)) c.opening++;
            }
        }));
        return c;
    }, [exams]);

    const filtered = useMemo(() => {
        const res: any[] = [];
        exams.forEach((sub: ExamSubject) => {
            if (selectedSubjects.length && !selectedSubjects.includes(sub.code)) return;
            sub.sections.forEach((sec: ExamSection) => {
                const matchesStatus = (stat: any) => {
                    if (stat === 'registered') return sec.status === 'registered';
                    if (stat === 'available') return sec.status !== 'registered' && sec.terms.some((t: ExamTerm) => !t.full && t.canRegisterNow === true);
                    if (stat === 'opening') return sec.status !== 'registered' && sec.terms.some((t: ExamTerm) => !t.full && t.canRegisterNow !== true);
                    return true;
                };

                const activeStatuses = statusFilter.length > 0 ? statusFilter : ['registered', 'available', 'opening'];
                
                if (activeStatuses.some(stat => matchesStatus(stat))) {
                    let finalSec = sec;
                    // If filtering by specific available/opening status, filter the terms too for better UX
                    if (statusFilter.length > 0 && !statusFilter.includes('registered')) {
                        const ts = sec.terms.filter((t: ExamTerm) => {
                            if (t.full) return false;
                            if (statusFilter.includes('available') && t.canRegisterNow === true) return true;
                            if (statusFilter.includes('opening') && t.canRegisterNow !== true) return true;
                            return false;
                        });
                        if (ts.length) finalSec = { ...sec, terms: ts };
                        else return; // If no terms left after filtering, skip section
                    }
                    res.push({ subject: sub, section: finalSec });
                }
            });
        });
        return res;
    }, [exams, statusFilter, selectedSubjects]);

    return { 
        exams, 
        isLoading: status === 'loading' || status === 'idle', 
        statusFilter, 
        onToggleStatus, 
        selectedSubjects, 
        setSelectedSubjects, 
        clearAllFilters,
        filterCounts, 
        filteredSubjects: filtered, 
        subjectOptions: useMemo(() => exams.map(e => {
            const name = (language === 'en' && e.nameEn) ? e.nameEn : (e.nameCs || e.name);
            return { code: e.code, name };
        }).filter((v, i, a) => a.findIndex(t => t.code === v.code) === i).sort((a, b) => a.name.localeCompare(b.name)), [exams, language]) 
    };
}
