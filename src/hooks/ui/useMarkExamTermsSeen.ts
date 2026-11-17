import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Zkoušky on screen = the new terms in it have been seen, on both trees (the
 * phone's ExamsScreen and the extension's ExamPanel). Also when a sync finds
 * more while it is open: the student is looking at them.
 */
export function useMarkExamTermsSeen(onScreen: boolean): void {
  const pending = useAppStore((s) => s.examTermsNew.length > 0);
  const markExamTermsSeen = useAppStore((s) => s.markExamTermsSeen);
  useEffect(() => {
    if (onScreen && pending) markExamTermsSeen();
  }, [onScreen, pending, markExamTermsSeen]);
}
