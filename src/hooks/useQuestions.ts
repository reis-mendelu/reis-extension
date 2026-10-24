import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useViewer } from './useViewer';
import { visibleQuestions } from '../utils/questionVisibility';

/**
 * The console's questions in Novinky, shared by both trees: the phone's
 * `NotificationsSheet` and `HeaderActions`, the extension's
 * `NotificationDropdown` and `NotificationFeed`.
 *
 * Nothing shows until boot has read what this device saved, nor without
 * Firefox's technical-data consent (`createQuestionsSlice`). An answered
 * question stays, as "Díky", until it ends.
 */
export function useQuestions() {
  const { status, list, answers, badgeSeen, allowed, pending } = useAppStore((s) => s.questions);
  // Minutes, not the pulse's every second: a start or an end is judged to the
  // minute, and nothing re-renders in between.
  const minute = useAppStore((s) => Math.floor(s.now.getTime() / 60_000));
  const { facultyKey } = useViewer();
  const answer = useAppStore((s) => s.answerQuestion);
  const markBadgeSeen = useAppStore((s) => s.markQuestionsBadgeSeen);

  const visible = useMemo(
    () =>
      status === 'ready' && allowed
        ? visibleQuestions(list, { nowMs: minute * 60_000, facultyKey })
        : [],
    [status, allowed, list, minute, facultyKey]
  );

  return {
    visible,
    answers,
    /** Star answers that can still change: sent when Novinky closes. */
    pending: pending ?? {},
    /** What they add to the bell: unanswered ones Novinky has not shown yet. */
    badge: visible.filter((q) => !answers[q.id] && !badgeSeen.includes(q.id)).length,
    markShown: (ids: string[]) => void markBadgeSeen(ids),
    answer: (id: string, key: string) => void answer(id, key),
  };
}
