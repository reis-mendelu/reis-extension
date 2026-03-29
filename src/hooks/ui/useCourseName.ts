import { useAppStore } from '../../store/useAppStore';

export function useCourseName(courseCode: string | undefined, fallbackName: string | undefined): string {
    const defaultName = fallbackName || courseCode || '';
    if (!courseCode) return defaultName;
    const nickname = useAppStore(state => state.courseNicknames?.[courseCode]);
    return nickname || defaultName;
}
