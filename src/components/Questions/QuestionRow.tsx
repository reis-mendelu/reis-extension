import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, MessageCircleQuestion, Share2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useOnScreenDwell } from '../../hooks/ui/useOnScreenDwell';
import { openExternal } from '../../mobile/openExternal';
import { shareLink } from '../../mobile/shareLink';
import { GooglePlayIcon } from './GooglePlayIcon';
import { StarScale } from './StarScale';
import type { Question, QuestionButton } from '../../types/questions';

/**
 * One console question as a Novinky row, on both trees (`QuestionList`).
 *
 * Answer buttons are all `btn-outline`, none primary: a poll that paints one
 * answer as the default nudges toward it. A link button is primary, because
 * opening it is the point. After an answer the row thanks and says what was
 * chosen, and stays until the question ends (decided 2026-10-22); a link tap
 * keeps the row as it is. A share button (`share`) hands its link on instead
 * of opening it, so a student can send it to a friend; a cancelled sheet keeps
 * the row too, so they can share again.
 *
 * Card and 32px icon slot as `DeadlineAlertItem`, so every
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
  const [copied, setCopied] = useState(false);
  // One timer: a second copy restarts the confirmation instead of an older
  // timer hiding it early (review #589).
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  useOnScreenDwell(ref, () => onSeen?.());

  const label = (b: QuestionButton) => (language === 'cz' ? b.cz : b.en);
  const prompt = language === 'cz' ? question.promptCz : question.promptEn;
  const note = language === 'cz' ? question.noteCz : question.noteEn;
  const answered = question.buttons.find((b) => b.key === answeredKey);
  // A row of short labels ("1"…"5", "👍") is a scale: square buttons in one line.
  const isScale = question.buttons.every((b) => !b.url && label(b).length <= 2);
  // Drawn as stars when the console asks for it; a question with a link stays buttons.
  const isStars = question.display === 'stars' && question.buttons.every((b) => !b.url);
  // What a scale's two ends mean, under them: "(1-5)" alone left students
  // guessing which end was good (Tonda, 2026-10-22).
  const hint = (b: QuestionButton | undefined) => (language === 'cz' ? b?.hintCz : b?.hintEn);
  const ends = isScale || isStars;
  const low = ends ? hint(question.buttons[0]) : undefined;
  const high = ends ? hint(question.buttons[question.buttons.length - 1]) : undefined;

  const tap = (b: QuestionButton) => {
    onAnswer(b.key);
    if (b.url && b.share) {
      void shareLink(b.url).then((r) => {
        if (r !== 'copied') return;
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2500);
      });
    } else if (b.url) void openExternal(b.url);
  };

  return (
    <div
      ref={ref}
      data-testid="question-row"
      className="flex items-start gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--tone-primary)]">
        {answered ? (
          <Check size={16} aria-hidden />
        ) : question.icon === 'google_play' ? (
          <GooglePlayIcon size={16} />
        ) : (
          <MessageCircleQuestion size={16} aria-hidden />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-md font-bold text-base-content">{prompt}</p>
        {answered && isStars ? (
          <>
            <StarScale buttons={question.buttons} answeredKey={answered.key} onTap={tap} />
            <p role="status" className="text-2sm text-base-content/60">
              {t('questions.thanksStars')}
            </p>
          </>
        ) : answered ? (
          <p role="status" className="text-2sm text-base-content/60">
            {t('questions.thanks', { answer: label(answered) })}
          </p>
        ) : (
          <>
            {note && <p className="text-2sm text-base-content/60">{note}</p>}
            {/* inline-flex, so the end labels span exactly the buttons. */}
            <div className="mt-1.5 inline-flex flex-col gap-0.5 self-start">
              {isStars ? (
                <StarScale buttons={question.buttons} answeredKey={undefined} onTap={tap} />
              ) : (
                <div className={`flex flex-wrap ${isScale ? 'gap-1.5' : 'gap-2'}`}>
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
                      {b.url && b.share && <Share2 size={14} aria-hidden />}
                      {b.url && !b.share && <ExternalLink size={14} aria-hidden />}
                    </button>
                  ))}
                </div>
              )}
              {copied && (
                <p role="status" className="text-2sm text-base-content/60">
                  {t('questions.linkCopied')}
                </p>
              )}
              {(low || high) && (
                <div className="flex justify-between gap-2 text-xs text-base-content/60">
                  <span>{low}</span>
                  <span>{high}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
