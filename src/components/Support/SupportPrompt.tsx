import { useEffect, useRef } from 'react';
import { useOnScreenDwell } from '../../hooks/ui/useOnScreenDwell';
import { Check, Heart } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { trackFeatureSignal } from '../../api/featureUsage';

/**
 * "Would you support reIS with a one-time 99 Kč?", asked as a row in Novinky.
 *
 * A willingness-to-pay test, not a payment (2026-10-16). Building real in-app
 * purchases costs VAT registration, a public trader address and App Review
 * work, so this asks first. It is worded as a question, with the price, and
 * says up front that nothing is charged: a "Podpořit · 99 Kč" button that then
 * said "coming soon" would be a fake door, and App Review rejects unfinished
 * purchase UI (guideline 2.1).
 *
 * Two counters, both install-level labels on the existing feature counters:
 * `support_prompt_seen` once the question has been on screen for
 * `SEEN_DWELL_MS` (`useOnScreenDwell`) — the denominator — and `support_prompt_yes` on the
 * tap. The observer is what keeps a row scrolled out of a long feed out of the
 * denominator. "Ne" sends nothing: it only closes the row, on this device
 * (`createSupportQuestionSlice`). No price variant, no faculty, no timing.
 *
 * Mounted on both trees (supportPromptOnBothTrees.test.ts): the phone's
 * Novinky sheet and the extension's Novinky dropdown, at the top of each. It
 * lived in Profil until 2026-10-22. This is an observer over what is already
 * on screen, not a data fetch.
 */
const countSeen = () => void trackFeatureSignal('support_prompt_seen');

export function SupportPrompt({
  answered,
  onAnswer,
  onShown,
}: {
  /** "Ano" was tapped in this Novinky: thank instead of asking. */
  answered: boolean;
  /** `delivered` (with "yes") is the counter's write; see answerSupportQuestion. */
  onAnswer: (answer: 'yes' | 'dismissed', delivered?: Promise<boolean | void>) => void;
  /** Called once it is on screen: Novinky is open with it in, so its badge is read. */
  onShown: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onShown();
  }, [onShown]);

  useOnScreenDwell(ref, countSeen);

  // `DeadlineAlertItem`'s card and its 32px slot, so the question shares one
  // left edge with every other row in Novinky.
  return (
    <div
      ref={ref}
      data-testid="support-prompt"
      className="flex items-start gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[var(--tone-primary)]">
        {/* The slot answers the tap: a heart while asking, a check once answered. */}
        {answered ? <Check size={16} aria-hidden /> : <Heart size={16} aria-hidden />}
      </span>
      {answered ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5" role="status">
          <p className="text-md font-bold text-base-content">{t('support.thanks')}</p>
          <p className="text-2sm text-base-content/60">{t('support.thanksNote')}</p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-md font-bold text-base-content">{t('support.question')}</p>
          <p className="text-2sm text-base-content/60">{t('support.note')}</p>
          {/* Under the text, not beside it: at 320px two buttons beside it left
              the question ~100px and wrapped it into four lines. */}
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                // An answer is proof it was read: count it as seen too, so a quick
                // tap-and-leave cannot put a "yes" outside the denominator (the
                // session latch in featureUsage keeps this to one write).
                void trackFeatureSignal('support_prompt_seen');
                onAnswer('yes', trackFeatureSignal('support_prompt_yes'));
              }}
              className="btn btn-primary btn-sm"
            >
              {t('support.yes')}
            </button>
            <button
              type="button"
              onClick={() => onAnswer('dismissed')}
              className="btn btn-ghost btn-sm"
            >
              {t('support.no')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
