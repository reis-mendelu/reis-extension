import { useState } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { QuestionButton } from '../../types/questions';

/**
 * A scale question drawn as stars, like a Google Play rating (`display:
 * 'stars'`). Every star shows; the tapped one fills with every star to its
 * left. Hover previews that fill on the extension; the phone has no hover, so
 * a tap answers at once. Once answered (`answeredKey`) the stars stay, filled
 * up to the answer, and are no longer buttons.
 *
 * The buttons keep their keys and order, so the counts read as a 1–5 scale.
 */
export function StarScale({
  buttons,
  answeredKey,
  onTap,
}: {
  buttons: QuestionButton[];
  answeredKey: string | undefined;
  onTap: (b: QuestionButton) => void;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const answered = buttons.findIndex((b) => b.key === answeredKey);
  const lit = answered >= 0 ? answered : (hover ?? -1);

  const star = (i: number) => (
    <Star
      size={28}
      aria-hidden
      data-testid="question-star"
      data-filled={i <= lit ? 'true' : 'false'}
      className={i <= lit ? 'fill-warning text-warning' : 'text-base-content/30'}
    />
  );

  if (answered >= 0) {
    return (
      <div
        className="flex gap-1"
        aria-label={t('questions.starsOf', { n: answered + 1, max: buttons.length })}
      >
        {buttons.map((b, i) => (
          <span key={b.key}>{star(i)}</span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
      {buttons.map((b, i) => (
        <button
          key={b.key}
          type="button"
          aria-label={t('questions.starsOf', { n: i + 1, max: buttons.length })}
          onMouseEnter={() => setHover(i)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          onClick={() => onTap(b)}
          className="btn btn-ghost btn-sm btn-square border-none hover:bg-transparent focus-visible:bg-transparent"
        >
          {star(i)}
        </button>
      ))}
    </div>
  );
}
