import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

const isShown = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * Zkoušky actually in front of the student = the new terms in it have been
 * seen, on both trees (the phone's ExamsScreen and the extension's ExamPanel).
 * Not while the page is hidden (a background browser tab, a phone app in the
 * background): a sync landing then would clear news nobody has looked at.
 * The caller says whether the view is uncovered (on the phone: no sheet over it).
 */
export function useMarkExamTermsSeen(onScreen: boolean): void {
  const pending = useAppStore((s) => s.examTermsNew.length > 0);
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
