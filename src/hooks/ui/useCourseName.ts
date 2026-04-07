import { useAppStore } from '../../store/useAppStore';

export function useCourseName(courseCode: string | undefined, fallbackName: string | undefined): string {
    const defaultName = fallbackName || courseCode || '';
    const nickname = useAppStore(state => (courseCode ? state.courseNicknames?.[courseCode] : undefined));
    return nickname || defaultName;
}
