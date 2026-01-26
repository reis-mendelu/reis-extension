import { useState, useEffect, useMemo, useCallback } from 'react';
import { IndexedDBService } from '../../services/storage';
import { useAppStore } from '../../store/useAppStore';

const STORAGE_KEY = 'exam_panel_filters';

export function useExamsData() {
    const exams = useAppStore(s => s.exams.data), status = useAppStore(s => s.exams.status);
    const [statusFilter, setStatusFilter] = useState<any>('available'), [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    
    useEffect(() => { 
        IndexedDBService.get('meta', STORAGE_KEY).then((s: any) => { 
            if (s?.statusFilter) setStatusFilter(s.statusFilter); 
            if (s?.selectedSubjects) setSelectedSubjects(s.selectedSubjects); 
        }); 
    }, []);
    
    useEffect(() => { IndexedDBService.set('meta', STORAGE_KEY, { statusFilter, selectedSubjects }); }, [statusFilter, selectedSubjects]);

    const filterCounts = useMemo(() => {
        const c = { registered: 0, available: 0, opening: 0 };
        exams.forEach(sub => sub.sections.forEach(sec => {
            if (sec.status === 'registered') c.registered++;
            else {
                if (sec.terms.some(t => !t.full && t.canRegisterNow === true)) c.available++;
                if (sec.terms.some(t => !t.full && t.canRegisterNow !== true)) c.opening++;
            }
        }));
        return c;
    }, [exams]);

    const filtered = useMemo(() => {
        const res: any[] = [];
        exams.forEach(sub => {
            if (selectedSubjects.length && !selectedSubjects.includes(sub.code)) return;
            sub.sections.forEach(sec => {
                if (statusFilter === 'registered') { if (sec.status === 'registered') res.push({ subject: sub, section: sec }); }
                else if (statusFilter === 'available') {
                    if (sec.status !== 'registered') { const ts = sec.terms.filter(t => !t.full && t.canRegisterNow === true); if (ts.length) res.push({ subject: sub, section: { ...sec, terms: ts } }); }
                } else if (statusFilter === 'opening') {
                    if (sec.status !== 'registered') { const ts = sec.terms.filter(t => !t.full && t.canRegisterNow !== true); if (ts.length) res.push({ subject: sub, section: { ...sec, terms: ts } }); }
                } else res.push({ subject: sub, section: sec });
            });
        });
        return res;
    }, [exams, statusFilter, selectedSubjects]);

    return { exams, isLoading: status === 'loading' || status === 'idle', statusFilter, setStatusFilter, selectedSubjects, setSelectedSubjects, filterCounts, filteredSubjects: filtered, subjectOptions: useMemo(() => exams.map(e => ({ code: e.code, name: e.name })).filter((v, i, a) => a.findIndex(t => t.code === v.code) === i).sort((a, b) => a.name.localeCompare(b.name)), [exams]) };
}
