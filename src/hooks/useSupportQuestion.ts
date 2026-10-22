import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

/**
 * The support question's place in Novinky, shared by both trees: the phone's
 * `NotificationsSheet` and `HeaderActions`, the extension's
 * `NotificationDropdown` and `NotificationFeed`.
 *
 * `visible` is latched to the surface that calls this. Once "Ano" is tapped
 * the store says `yes` straight away, and a row filtered on `open` would
 * vanish before the thanks could show — so a "yes" given HERE keeps the row
 * up until this Novinky closes. The next one opens without it.
 */
export function useSupportQuestion() {
  const { status, badgeSeen } = useAppStore((s) => s.supportQuestion);
  const answer = useAppStore((s) => s.answerSupportQuestion);
  const markSeen = useAppStore((s) => s.markSupportQuestionSeen);
  const [answeredHere, setAnsweredHere] = useState(false);

  return {
    visible: status === 'open' || (status === 'yes' && answeredHere),
    answered: status === 'yes' && answeredHere,
    /** What it adds to the bell: 1 until Novinky has been opened with it in. */
    badge: status === 'open' && !badgeSeen ? 1 : 0,
    markSeen,
    onAnswer: (a: 'yes' | 'dismissed') => {
      if (a === 'yes') setAnsweredHere(true);
      void answer(a);
    },
  };
}
