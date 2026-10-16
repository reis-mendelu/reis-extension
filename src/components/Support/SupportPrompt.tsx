import { useEffect, useRef, useState } from 'react';
import { Check, Heart } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { trackFeatureSignal } from '../../api/featureUsage';

/**
 * "Would you support reIS with a one-time 99 Kč?", with a single answer.
 *
 * A willingness-to-pay test, not a payment (2026-10-16). Building real in-app
 * purchases costs VAT registration, a public trader address and App Review
 * work, so this asks first. It is worded as a question, with the price, and
 * says up front that nothing is charged: a "Podpořit · 99 Kč" button that then
 * said "coming soon" would be a fake door, and App Review rejects unfinished
 * purchase UI.
 *
 * Two counters, both install-level labels on the existing feature counters:
 * `support_prompt_seen` once the question has been on screen for
 * {@link SEEN_DWELL_MS} — the
 * denominator, since most students rarely open Profil — and
 * `support_prompt_yes` on the tap. The observer is what keeps a copy hidden by
 * the phone's short-screen rule out of the denominator. Nothing else is sent:
 * no price variant, no faculty, no timing.
 *
 * Mounted on both trees (supportPromptOnBothTrees.test.ts): the phone's Profil
 * and the extension's settings popup; `compact` is the popup's smaller type.
 * This is an observer over what is already on screen, not a data fetch.
 */
/**
 * How long the question must stay on screen to count as seen. The extension's
 * popup opens on hover, so a pointer passing over Profil would otherwise put
 * an install in the denominator that never read the question. Both trees use
 * the same threshold, so their shares mean the same thing.
 */
export const SEEN_DWELL_MS = 1500;

export function SupportPrompt({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [answered, setAnswered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return stop();
        if (timer !== null) return;
        timer = setTimeout(() => {
          timer = null;
          void trackFeatureSignal('support_prompt_seen');
          io.disconnect();
        }, SEEN_DWELL_MS);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => {
      stop();
      io.disconnect();
    };
  }, []);

  const title = compact ? 'text-xs font-medium' : 'text-md font-medium';
  const sub = 'text-xs text-base-content/60';

  return (
    <div ref={ref} data-testid="support-prompt" className={`flex items-center gap-3 ${className}`}>
      {/* The row icon answers the tap: a heart while asking, a check once
          answered, in the same slot so nothing else on Profil moves. */}
      {answered ? (
        <Check
          size={compact ? 16 : 17}
          className="flex-shrink-0 text-[var(--tone-primary)]"
          aria-hidden
        />
      ) : (
        <Heart
          size={compact ? 16 : 17}
          className="flex-shrink-0 text-base-content/50"
          aria-hidden
        />
      )}
      {answered ? (
        <div className="min-w-0 flex-1" role="status">
          <p className={title}>{t('support.thanks')}</p>
          <p className={sub}>{t('support.thanksNote')}</p>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className={title}>{t('support.question')}</p>
            <p className={sub}>{t('support.note')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void trackFeatureSignal('support_prompt_yes');
              setAnswered(true);
            }}
            // In the 320px popup the note needs 208px and the row gives it
            // 206; pulling the button 4px in keeps the note to one line while
            // the text still lines up with the rows below it.
            className={`btn btn-primary flex-shrink-0 ${compact ? 'btn-xs -ml-1' : 'btn-sm'}`}
          >
            {t('support.yes')}
          </button>
        </>
      )}
    </div>
  );
}
