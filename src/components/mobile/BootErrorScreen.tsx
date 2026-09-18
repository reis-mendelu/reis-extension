import { useTranslation } from '../../hooks/useTranslation';

export interface BootErrorScreenProps {
  /** What actually went wrong, shown small — a student reporting this should
   *  be able to read the cause out rather than describe a blank screen. */
  detail: string;
  onRetry: () => void;
  /**
   * Omitted once the app's entry module has run: a dynamic import evaluates
   * once, so "start the demo" from that point would unmount this screen and
   * render nothing. A reload is then the only route, and it is the only one
   * offered.
   */
  onDemo?: () => void;
}

/**
 * The app could not start.
 *
 * What stood here was `document.getElementById('root')!.textContent = 'reIS
 * failed to start: ' + String(e)` — an untranslated English sentence with a
 * stringified Error after it, on a wiped page, with nothing to tap. A student
 * photographed one of these ("reIS failed to start: Error: Login cancelled: the
 * sign-in window was dismissed") and their only way out was to kill the app.
 *
 * Whatever produced that particular error — it is NOT a `LoginCancelledError`
 * instance, or `String(e)` would have printed the class name, so the
 * `instanceof` branch that routes a dismissed login to the sign-in gate was
 * right to decline it — the dead end is the part that must not exist. Boot has
 * exactly two useful answers at this point and this screen offers both: run it
 * again, or look at the app without an account.
 *
 * The cause is kept on screen rather than swallowed. reIS transmits nothing
 * about a failure (see CLAUDE.md), so the only route from a broken install to a
 * fix is a student reading this line out — deliberately the raw string, not a
 * friendlier paraphrase of it.
 */
export function BootErrorScreen({ detail, onRetry, onDemo }: BootErrorScreenProps) {
  const { t } = useTranslation();
  return (
    // The same shell LoginGate uses, for the same reason: this can be the first
    // thing the app ever draws, so the safe-area inset has to be here or the
    // title lands under the Dynamic Island.
    <div className="flex min-h-dvh items-center justify-center bg-base-100 px-6 pb-6 pt-[calc(1.5rem_+_var(--safe-top,0px))]">
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <h1 className="font-display text-2xl font-bold">{t('boot.failedTitle')}</h1>
        <p className="text-sm text-base-content/70">{t('boot.failedBody')}</p>

        <button className="btn btn-primary" onClick={onRetry}>
          {t('boot.retry')}
        </button>
        {onDemo && (
          <button className="btn btn-ghost" onClick={onDemo}>
            {t('demo.tryDemo')}
          </button>
        )}

        <p className="select-text break-words pt-2 font-mono text-xs text-base-content/50">
          {detail}
        </p>
      </div>
    </div>
  );
}
