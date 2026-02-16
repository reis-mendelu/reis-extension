import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function useClassmates(courseCode: string | undefined) {
    const classmates = useAppStore(state => courseCode ? state.classmates[courseCode] : undefined);
    const isLoading = useAppStore(state => courseCode ? state.classmatesLoading[courseCode] : false);
    const fetchClassmates = useAppStore(state => state.fetchClassmates);

    useEffect(() => {
        if (courseCode && classmates === undefined) {
            fetchClassmates(courseCode);
        }
    }, [courseCode, classmates, fetchClassmates]);
    
    return {
        classmates: classmates || [],
        isLoading: isLoading
    };
}
