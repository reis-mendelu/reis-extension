import { useAppStore } from '../../store/useAppStore';
import { courseDisplayName } from '../../utils/courseDisplayName';

export function useCourseName(
  courseCode: string | undefined,
  fallbackName: string | undefined
): string {
  const nicknames = useAppStore((state) => state.courseNicknames);
  return courseDisplayName(nicknames, courseCode, fallbackName);
}
