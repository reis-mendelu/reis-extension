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
 * Outlined glyph while idle, a pulse while the OS dialog is up, solid primary
 * with a check once the network is saved. Reduced motion keeps the state
 * change and drops the pulse.
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
    // Card on the phone; on a tablet the raised pane behind it already is the
    // surface, so the card drops its own background and becomes the pane's
    // content — left-aligned, because a centred stack in a tall pane reads as
    // something that lost its way there. The `md:` classes are safe to hang on
    // this component: it only mounts on the native path, which is the same
    // condition that turns the split on.
    <div className="flex flex-col items-center gap-4 rounded-box bg-base-100 p-6 text-center shadow-card md:items-start md:gap-6 md:bg-transparent md:p-0 md:text-left md:shadow-none">
      <motion.div
        aria-hidden
        className={`relative flex h-16 w-16 items-center justify-center rounded-full md:h-20 md:w-20 ${
          // A primary tint rather than `bg-base-200`: on the light theme a
          // base-200 disc on a base-100 surface is 1.03:1 and simply is not
          // there. The solid fill on success is still the state change.
          done ? 'bg-primary text-primary-content' : 'bg-primary/10 text-primary'
        }`}
        animate={working && !reduced ? { scale: [1, 1.08, 1], opacity: [1, 0.55, 1] } : {}}
        transition={working && !reduced ? { duration: 1.2, repeat: Infinity } : { duration: 0.25 }}
      >
        <Wifi className="h-8 w-8 md:h-10 md:w-10" strokeWidth={done ? 2.5 : 2} />
        {done && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-base-100 text-primary shadow-card">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
      </motion.div>

      <p
        className={`text-base font-medium md:text-2xl md:font-semibold md:tracking-tight ${
          failed ? 'text-error' : 'text-base-content'
        }`}
      >
        {line}
      </p>

      {/* What the tap does, while it is still on offer. Gone once done: the
          done line already says everything that is left to say. */}
      {!done && !failed && (
        <p className="text-sm text-base-content/70 md:text-base">{t('mobile.welcome.wifiBody')}</p>
      )}

      {!done && (
        <button
          type="button"
          onClick={onSetup}
          disabled={working}
          // After a failure the way forward is the footer's "Continue" and
          // this is only a retry, so it drops to an outline: two tinted
          // primaries stacked in the tablet pane read as one decision asked
          // twice. (`btn-outline btn-primary` would not do it — the project's
          // soft-button rule fills `.btn-primary` regardless.)
          className={`btn w-full gap-2 md:btn-lg ${failed ? 'btn-outline' : 'btn-primary'}`}
        >
          {working && <span className="loading loading-spinner loading-xs" />}
          {working ? t('eduroam.native.working') : t('eduroam.native.button')}
        </button>
      )}

      {/* iOS only, and only once it matters: a network added through
          NEHotspotConfiguration is removed with the app. Android's saved
          network is the student's own and survives. */}
      {done && target === 'ios' && (
        <p className="text-xs text-base-content/60 md:text-sm">{t('eduroam.native.iosLifetime')}</p>
      )}
    </div>
  );
}
