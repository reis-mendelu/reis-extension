import { useEffect } from 'react';
import { useQuestions } from '../../hooks/useQuestions';
import { useTranslation } from '../../hooks/useTranslation';
import { countQuestion } from '../../api/questions';
import { QuestionRow } from './QuestionRow';
import { useAppStore } from '../../store/useAppStore';

/**
 * The console's live questions at the top of Novinky. Mounted on both trees
 * (questionsOnBothTrees.test.ts): the phone's `NotificationsSheet` and the
 * extension's `NotificationDropdown`. Being on screen in an open Novinky reads
 * their badge, as every other row's.
 */
export function QuestionList() {
  const { visible, answers, pending, markShown, answer } = useQuestions();
  const { language } = useTranslation();
  const ids = visible.map((q) => q.id).join(',');

  // Novinky closing is when a star rating stops being changeable: send it then.
  useEffect(() => () => void useAppStore.getState().flushQuestionAnswers(), []);

  useEffect(() => {
    if (ids) markShown(ids.split(','));
    // `ids` is the list's identity; markShown is a fresh closure every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (!visible.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {visible.map((q) => (
        <QuestionRow
          key={q.id}
          question={q}
          language={language}
          answeredKey={answers[q.id]}
          changeable={Boolean(pending[q.id])}
          onAnswer={(key) => answer(q.id, key)}
          onSeen={() => void countQuestion(q.id, 'seen')}
        />
      ))}
    </div>
  );
}
