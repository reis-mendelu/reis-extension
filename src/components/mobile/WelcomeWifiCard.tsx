import { motion, useReducedMotion } from 'motion/react';
import { Check, Wifi } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';
import type { EduroamConfigOutcome } from '../../mobile/configureEduroam';
import type { NativeEduroamTarget } from '../../mobile/eduroamNative';

export interface WelcomeWifiCardProps {
  status: EduroamStatus;
  outcome: EduroamConfigOutcome | null;
  target: NativeEduroamTarget;
  onSetup: () => void;
}

/**
 * The hero of the first-run screen: one glyph, one line, one button. The
 * setup itself is `useEduroamSetup`'s native branch, verified on both phone
 * OSes — this card only lays its state out.
 *
 * A tinted glyph while idle, a pulse while the OS dialog is up, solid primary
 * with a check once the network is saved, an error tint if it did not. Reduced
 * motion keeps the state change and drops the pulse.
 *
 * A stacked card on the phone; one row — glyph, message, action — inside the
 * tablet dialog. See `WelcomeScreen` for why the tablet gets a dialog and not
 * a bigger screen.
 */
export function WelcomeWifiCard({ status, outcome, target, onSetup }: WelcomeWifiCardProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const working = status === 'working';
  const done = status === 'done' && (outcome === 'saved' || outcome === 'already-configured');
  // Any error lands here — a genuine `failed` from the OS, or a throw before
  // the OS was reached (lapsed session, cert fetch). One line either way.
  const failed = status === 'error';

  const line = done
    ? t('mobile.welcome.wifiDone')
    : failed
      ? t('mobile.welcome.wifiFailed')
      : t('mobile.welcome.wifiLine');

  return (
    // A centred card on the phone. Inside the tablet dialog it is already on a
    // raised surface, so it drops its own background and turns on its side —
    // glyph, message, action across one row. That is what uses the dialog's
    // width: stacking the phone card inside a 672pt box would leave the width
    // unspent and the box taller than it needs to be.
    <div className="flex flex-col items-center gap-4 rounded-box bg-base-100 p-6 text-center shadow-card md:flex-row md:items-center md:gap-6 md:border-t md:border-base-content/10 md:bg-transparent md:p-0 md:pt-8 md:text-left md:shadow-none">
      <motion.div
        aria-hidden
        className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full md:h-14 md:w-14 ${
          // A tinted disc rather than `bg-base-200`: on the light theme a
          // base-200 disc on a base-100 surface is 1.03:1 and simply is not
          // there. The solid fill on success is still the state change.
          //
          // The disc is also where failure is coloured. `text-error` on the
          // line itself measured 3.90:1 against base-100 — under AA, and not
          // fixable by weight at this size — whereas a 56pt glyph only owes
          // the 3:1 that non-text graphics owe, and clears it. The words say
          // "Nepovedlo se" regardless; the red is not carrying the meaning.
          failed
            ? 'bg-error/15 text-error'
            : done
              ? 'bg-primary text-primary-content'
              : 'bg-primary/10 text-primary'
        }`}
        animate={working && !reduced ? { scale: [1, 1.08, 1], opacity: [1, 0.55, 1] } : {}}
        transition={working && !reduced ? { duration: 1.2, repeat: Infinity } : { duration: 0.25 }}
      >
        <Wifi className="h-8 w-8 md:h-7 md:w-7" strokeWidth={done ? 2.5 : 2} />
        {done && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-base-100 text-primary shadow-card">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
      </motion.div>

      {/* `contents` on the phone: the wrapper vanishes and its children go on
          participating in the card's own column, in the order they always did.
          At `md` it becomes the message column between the glyph and the
          action. The iOS note lives in here rather than after the button
          because it only ever appears when the button is gone. */}
      <div className="contents md:flex md:flex-1 md:flex-col md:items-start md:gap-1">
        <p className="text-base font-medium text-base-content md:text-lg md:font-semibold md:tracking-tight">
          {line}
        </p>

        {/* What the tap does, while it is still on offer. Gone once done: the
            done line already says everything that is left to say. */}
        {!done && !failed && (
          <p className="text-sm text-base-content/70">{t('mobile.welcome.wifiBody')}</p>
        )}

        {/* iOS only, and only once it matters: a network added through
            NEHotspotConfiguration is removed with the app. Android's saved
            network is the student's own and survives. */}
        {done && target === 'ios' && (
          <p className="text-xs text-base-content/60">{t('eduroam.native.iosLifetime')}</p>
        )}
      </div>

      {!done && (
        <button
          type="button"
          onClick={onSetup}
          disabled={working}
          // After a failure the way forward is the footer's "Continue" and
          // this is only a retry, so it drops to the ghost + hairline pattern
          // `EventComposer` uses: two buttons of equal weight read as one
          // decision asked twice. Not `btn-outline` (it fills near-black on
          // the dark theme and outshouts the primary it was meant to yield
          // to), and not `btn-outline btn-primary` (the project's soft-button
          // rule fills `.btn-primary` regardless of the modifier).
          className={`btn w-full gap-2 md:w-auto md:shrink-0 md:px-8 ${
            failed ? 'btn-ghost border border-base-content/20' : 'btn-primary'
          }`}
        >
          {working && <span className="loading loading-spinner loading-xs" />}
          {working ? t('eduroam.native.working') : t('eduroam.native.button')}
        </button>
      )}
    </div>
  );
}
