import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AppState } from '../../store/types';

export function useOdevzdavarny(courseName?: string) {
    const globalAssignments = useAppStore((state: AppState) => state.odevzdavarny);
    const status = useAppStore((state: AppState) => state.odevzdavarnyStatus);
    const assignments = useMemo(() => {
        if (!globalAssignments || !courseName) {
            return [];
        }

        const normalize = (s: string) => s.replace(/^[A-Z]{2,4}-[A-Z0-9]+ /i, '').toLowerCase().replace(/\s+/g, ' ').replace(/-/g, ' ').trim();
        const matchName = normalize(courseName);

        const filtered = globalAssignments.filter(a =>
            normalize(a.courseNameCs) === matchName || normalize(a.courseNameEn) === matchName
        );

        return filtered;
    }, [courseName, globalAssignments]);

    return { assignments, status };
}
