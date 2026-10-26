import { useAppStore } from '../../store/useAppStore';

/**
 * The hook form of `courseDisplayName` (utils/courseDisplayName). It selects
 * only this course's nickname, so renaming one subject does not re-render
 * every row that names another.
 */
export function useCourseName(
  courseCode: string | undefined,
  fallbackName: string | undefined
): string {
  const nickname = useAppStore((state) =>
    courseCode ? state.courseNicknames?.[courseCode] : undefined
  );
  return nickname || fallbackName || courseCode || '';
}
