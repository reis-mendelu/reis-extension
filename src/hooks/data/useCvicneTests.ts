import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AppState } from '../../store/types';

export function useCvicneTests(courseName?: string) {
    const globalTests = useAppStore((state: AppState) => state.cvicneTests);
    const status = useAppStore((state: AppState) => state.cvicneTestsStatus);
    const tests = useMemo(() => {
        if (!globalTests || !courseName) {
            return [];
        }

        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/-/g, ' ').trim();
        const matchName = normalize(courseName);

        const filtered = globalTests.filter(t =>
            normalize(t.courseNameCs) === matchName || normalize(t.courseNameEn) === matchName
        );

        return filtered;
    }, [courseName, globalTests]);

    return { tests, status };
}
