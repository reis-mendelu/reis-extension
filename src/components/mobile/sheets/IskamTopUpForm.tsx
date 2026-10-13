import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';
import { validateAmount, type PayMethod } from '../../../mobile/iskam/topUp';

/**
 * One amount, two ways to pay. Google Pay only on Android: WebISKAM offers no
 * Apple Pay, and Google Pay is an Android wallet.
 */
export function IskamTopUpForm() {
  const { t } = useTranslation();
  const phase = useIskamStore((s) => s.topUp);
  const [text, setText] = useState('');
  const checked = validateAmount(text);
  const busy = phase === 'starting' || phase === 'paying';
  const invalid = text.trim() !== '' && !checked.ok;
  const gpay = Capacitor.getPlatform() === 'android';
  const pay = (method: PayMethod) => {
    if (checked.ok) void useIskamStore.getState().startTopUp(checked.amount, method);
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-2sm text-base-content/70">{t('iskam.amount')}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="input input-bordered input-sm w-full"
          value={text}
          aria-invalid={invalid}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {invalid && <p className="text-2sm text-error">{t('iskam.invalid')}</p>}
      {phase === 'failed' && (
        <p role="alert" className="text-2sm text-error">
          {t('iskam.failed')}
        </p>
      )}
      <div className="flex gap-2">
        {gpay && (
          <button
            type="button"
            className="btn btn-sm flex-1"
            disabled={!checked.ok || busy}
            onClick={() => pay('gpay')}
          >
            {t('iskam.gpay')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1"
          disabled={!checked.ok || busy}
          onClick={() => pay('card')}
        >
          {t('iskam.card')}
        </button>
      </div>
    </div>
  );
}
