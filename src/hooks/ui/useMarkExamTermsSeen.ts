import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { allTermKeys } from '../../utils/newExamTerms';

const isShown = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * Zkoušky actually in front of the student = the new terms in its list have
 * been seen, on both trees (the phone's ExamsScreen and the extension's ExamPanel).
 * Not while the page is hidden (a background browser tab, a phone app in the
 * background): a sync landing then would clear news nobody has looked at.
 * The caller says whether the view is uncovered (on the phone: no sheet over it).
 */
export function useMarkExamTermsSeen(onScreen: boolean): void {
  // Only terms the displayed list holds: a key newer than the cached list
  // (Android's background check) waits for the list that shows it.
  const pending = useAppStore((s) => {
    if (s.examTermsNew.length === 0) return false;
    const listed = new Set(allTermKeys(s.exams.data));
    return s.examTermsNew.some((k) => listed.has(k));
  });
  const markExamTermsSeen = useAppStore((s) => s.markExamTermsSeen);
  const [shown, setShown] = useState(isShown);
  useEffect(() => {
    const onChange = () => setShown(isShown());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  useEffect(() => {
    if (onScreen && shown && pending) markExamTermsSeen();
  }, [onScreen, shown, pending, markExamTermsSeen]);
}
