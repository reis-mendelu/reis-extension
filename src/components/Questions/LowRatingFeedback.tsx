import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { submitSuggestion } from '../../api/suggestions';
import { keepDraftOnEscape } from '../../hooks/ui/keepDraftOnEscape';

/**
 * Under a 1- or 2-star rating: an offer to say why, closed until tapped so
 * Novinky stays short. What the student writes goes out the way a report from
 * "Nahlásit chybu / Nápad" does (`submitSuggestion`, already disclosed), with
 * the rating and the question in its title. Nothing is sent unless they press
 * Odeslat.
 */
export function LowRatingFeedback({ title }: { title: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  if (state === 'sent') {
    return (
      <p role="status" className="text-2sm text-base-content/60">
        {t('questions.whySent')}
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-link btn-sm h-auto min-h-0 self-start px-0 text-[var(--tone-primary)]"
      >
        {t('questions.whyOpen')}
      </button>
    );
  }
  const send = async () => {
    setState('sending');
    const r = await submitSuggestion({ type: 'other', title: title.slice(0, 120), body: text });
    setState(r.ok ? 'sent' : 'failed');
  };
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        // Escape with a "why" typed must not pop Novinky and lose it.
        onKeyDown={keepDraftOnEscape(text)}
        maxLength={2000}
        rows={3}
        autoFocus
        aria-label={t('questions.whyLabel')}
        placeholder={t('questions.whyPlaceholder')}
        className="textarea textarea-bordered w-full text-sm"
      />
      {state === 'failed' && (
        <p role="alert" className="text-2sm text-error">
          {t('questions.whyFailed')}
        </p>
      )}
      <button
        type="button"
        disabled={!text.trim() || state === 'sending'}
        onClick={() => void send()}
        className="btn btn-primary btn-sm self-start"
      >
        {t('questions.whySend')}
      </button>
    </div>
  );
}
