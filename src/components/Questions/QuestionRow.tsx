import { useRef } from 'react';
import { Check, ExternalLink, MessageCircleQuestion } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useOnScreenDwell } from '../../hooks/ui/useOnScreenDwell';
import { openExternal } from '../../mobile/openExternal';
import type { Question, QuestionButton } from '../../types/questions';

/**
 * One console question as a Novinky row, on both trees (`QuestionList`).
 *
 * Answer buttons are all `btn-outline`, none primary: a poll that paints one
 * answer as the default nudges toward it. A link button is primary, because
 * opening it is the point. After an answer the row thanks and says what was
 * chosen, and stays until the question ends (decided 2026-10-22); a link tap
 * keeps the row as it is.
 *
 * Card and 32px icon slot as `SupportPrompt` and `DeadlineAlertItem`, so every
 * row in Novinky shares one left edge.
 */
export function QuestionRow({
  question,
  language,
  answeredKey,
  onAnswer,
  onSeen,
}: {
  question: Question;
  language: 'cz' | 'en';
  answeredKey: string | undefined;
  onAnswer: (key: string) => void;
  /** Once on screen for `SEEN_DWELL_MS`: the denominator. */
  onSeen?: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useOnScreenDwell(ref, () => onSeen?.());

  const label = (b: QuestionButton) => (language === 'cz' ? b.cz : b.en);
  const prompt = language === 'cz' ? question.promptCz : question.promptEn;
  const note = language === 'cz' ? question.noteCz : question.noteEn;
  const answered = question.buttons.find((b) => b.key === answeredKey);
  // A row of short labels ("1"…"5", "👍") is a scale: square buttons in one line.
  const isScale = question.buttons.every((b) => !b.url && label(b).length <= 2);

  const tap = (b: QuestionButton) => {
    onAnswer(b.key);
    if (b.url) void openExternal(b.url);
  };

  return (
    <div
      ref={ref}
      data-testid="question-row"
      className="flex items-start gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--tone-primary)]">
        {answered ? <Check size={16} aria-hidden /> : <MessageCircleQuestion size={16} aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-md font-bold text-base-content">{prompt}</p>
        {answered ? (
          <p role="status" className="text-2sm text-base-content/60">
            {t('questions.thanks', { answer: label(answered) })}
          </p>
        ) : (
          <>
            {note && <p className="text-2sm text-base-content/60">{note}</p>}
            <div className={`mt-1.5 flex flex-wrap ${isScale ? 'gap-1.5' : 'gap-2'}`}>
              {question.buttons.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => tap(b)}
                  className={`btn btn-sm ${
                    b.url ? 'btn-primary' : isScale ? 'btn-outline btn-square' : 'btn-outline'
                  }`}
                >
                  {label(b)}
                  {b.url && <ExternalLink size={14} aria-hidden />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
