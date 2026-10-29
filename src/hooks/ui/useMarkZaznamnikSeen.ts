import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Clears a subject's "Nové body" and new submission boxes once its Záznamník tab is actually on screen,
 * however it got there: a tab tap, a row that opened straight on it, or a tapped
 * notification. Points arriving while the student is looking clear at once.
 * Both drawers call it: desktop's state hook and the phone's sheet.
 */
export function useMarkZaznamnikSeen(
  courseCode: string | undefined,
  activeTab: string,
  isOpen: boolean
): void {
  const isNew = useAppStore((s) => !!courseCode && !!s.zaznamnikNewPoints[courseCode]?.length);
  const markSeen = useAppStore((s) => s.markZaznamnikSeen);
  // New submission boxes sit on the same tab; the slice clears only this subject's.
  const hasNewBoxes = useAppStore((s) => s.odevzdavarnyNew.length > 0);
  const markBoxesSeen = useAppStore((s) => s.markBoxesSeen);
  useEffect(() => {
    if (isOpen && isNew && courseCode && activeTab === 'zaznamnik') void markSeen(courseCode);
  }, [isOpen, isNew, courseCode, activeTab, markSeen]);
  useEffect(() => {
    if (isOpen && hasNewBoxes && courseCode && activeTab === 'zaznamnik')
      void markBoxesSeen(courseCode);
  }, [isOpen, hasNewBoxes, courseCode, activeTab, markBoxesSeen]);
}
