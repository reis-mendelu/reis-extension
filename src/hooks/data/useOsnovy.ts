import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AppState } from '../../store/types';

export function useOsnovy(courseName?: string) {
    const globalTests = useAppStore((state: AppState) => state.osnovy);
    const status = useAppStore((state: AppState) => state.osnovyStatus);

    const tests = useMemo(() => {
        if (!courseName || !globalTests) return [];
        
        // Match by courseName. The parsed HTML name might not perfectly equal the schedule name,
        // but usually it's a solid substring match.
        const matchName = courseName.toLowerCase();
        return globalTests.filter(t => 
            t.courseName.toLowerCase().includes(matchName) || 
            matchName.includes(t.courseName.toLowerCase())
        );
    }, [courseName, globalTests]);




    return { tests, status };
}

